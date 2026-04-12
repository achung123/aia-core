import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

vi.mock('./CardPicker.jsx', () => ({
  CardPicker: () => <div data-testid="card-picker" />,
}));

import { DetectionReview } from './DetectionReview.tsx';
import type { DetectionReviewProps } from './DetectionReview.tsx';
import type { CardDetectionEntry } from '../api/types.ts';

afterEach(cleanup);

describe('DetectionReview', () => {
  const defaultDetections: CardDetectionEntry[] = [
    { card_position: 'hole1', detected_value: 'Ah', confidence: 0.99 },
    { card_position: 'hole2', detected_value: 'Kd', confidence: 0.95 },
  ];

  const defaultProps: DetectionReviewProps = {
    detections: defaultDetections,
    imageUrl: null,
    mode: 'player',
    targetName: 'Alice',
    onConfirm: vi.fn(),
    onRetake: vi.fn(),
  };

  it('renders heading and target name', () => {
    render(<DetectionReview {...defaultProps} />);
    expect(screen.getByText('Review Detection')).toBeDefined();
    expect(screen.getByText('Alice')).toBeDefined();
  });

  it('renders detected cards', () => {
    const { container } = render(<DetectionReview {...defaultProps} />);
    expect(container.textContent).toContain('A');
    expect(container.textContent).toContain('K');
  });

  it('calls onConfirm with card values', () => {
    const onConfirm = vi.fn();
    render(<DetectionReview {...defaultProps} onConfirm={onConfirm} />);
    const confirmBtn = screen.getByText('Confirm');
    fireEvent.click(confirmBtn);
    expect(onConfirm).toHaveBeenCalledWith('Alice', ['Ah', 'Kd']);
  });

  it('calls onRetake when Retake button is clicked', () => {
    const onRetake = vi.fn();
    render(<DetectionReview {...defaultProps} onRetake={onRetake} />);
    fireEvent.click(screen.getByText('Retake'));
    expect(onRetake).toHaveBeenCalled();
  });

  it('disables Confirm button when no detections', () => {
    render(<DetectionReview {...defaultProps} detections={[]} />);
    const confirmBtn = screen.getByText('Confirm') as HTMLButtonElement;
    expect(confirmBtn.disabled).toBe(true);
  });

  it('shows warning when detection count is below expected', () => {
    render(<DetectionReview {...defaultProps} detections={[defaultDetections[0]]} />);
    expect(screen.getByText(/Expected 2 cards, detected 1/)).toBeDefined();
  });
});

describe('DetectionReview per-street modes', () => {
  it('flop mode passes cards in detection order (no bbox sorting)', () => {
    const onConfirm = vi.fn();
    const detections: CardDetectionEntry[] = [
      { card_position: 'flop1', detected_value: 'Kd', confidence: 0.90, bbox_x: 300 },
      { card_position: 'flop2', detected_value: 'Ah', confidence: 0.99, bbox_x: 50 },
      { card_position: 'flop3', detected_value: '5c', confidence: 0.85, bbox_x: 175 },
    ];
    render(
      <DetectionReview
        detections={detections}
        imageUrl={null}
        mode="flop"
        targetName="flop"
        onConfirm={onConfirm}
        onRetake={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText('Confirm'));
    expect(onConfirm).toHaveBeenCalledWith('flop', ['Kd', 'Ah', '5c']);
  });

  it('labels flop cards with Flop position labels', () => {
    const detections: CardDetectionEntry[] = [
      { card_position: 'flop1', detected_value: 'Ah', confidence: 0.99, bbox_x: 50 },
      { card_position: 'flop2', detected_value: '5c', confidence: 0.85, bbox_x: 175 },
      { card_position: 'flop3', detected_value: 'Kd', confidence: 0.90, bbox_x: 300 },
    ];
    render(
      <DetectionReview
        detections={detections}
        imageUrl={null}
        mode="flop"
        targetName="flop"
        onConfirm={vi.fn()}
        onRetake={vi.fn()}
      />,
    );

    const labels = screen.getAllByTestId(/^card-position-/);
    expect(labels.length).toBe(3);
    expect(labels[0].textContent).toBe('Flop');
    expect(labels[1].textContent).toBe('Flop');
    expect(labels[2].textContent).toBe('Flop');
  });

  it('labels turn card with Turn position label', () => {
    const detections: CardDetectionEntry[] = [
      { card_position: 'turn', detected_value: 'Js', confidence: 0.88, bbox_x: 450 },
    ];
    render(
      <DetectionReview
        detections={detections}
        imageUrl={null}
        mode="turn"
        targetName="turn"
        onConfirm={vi.fn()}
        onRetake={vi.fn()}
      />,
    );

    const labels = screen.getAllByTestId(/^card-position-/);
    expect(labels.length).toBe(1);
    expect(labels[0].textContent).toBe('Turn');
  });

  it('labels river card with River position label', () => {
    const detections: CardDetectionEntry[] = [
      { card_position: 'river', detected_value: 'Qh', confidence: 0.92, bbox_x: 600 },
    ];
    render(
      <DetectionReview
        detections={detections}
        imageUrl={null}
        mode="river"
        targetName="river"
        onConfirm={vi.fn()}
        onRetake={vi.fn()}
      />,
    );

    const labels = screen.getAllByTestId(/^card-position-/);
    expect(labels.length).toBe(1);
    expect(labels[0].textContent).toBe('River');
  });

  it('does not show position labels for player mode', () => {
    const detections: CardDetectionEntry[] = [
      { card_position: 'hole1', detected_value: 'Ah', confidence: 0.99, bbox_x: 50 },
      { card_position: 'hole2', detected_value: 'Kd', confidence: 0.90, bbox_x: 300 },
    ];
    render(
      <DetectionReview
        detections={detections}
        imageUrl={null}
        mode="player"
        targetName="Alice"
        onConfirm={vi.fn()}
        onRetake={vi.fn()}
      />,
    );

    const labels = screen.queryAllByTestId(/^card-position-/);
    expect(labels.length).toBe(0);
  });
});
