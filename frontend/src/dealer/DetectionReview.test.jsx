/** @vitest-environment happy-dom */
import { describe, it, expect, vi } from 'vitest';
import { render } from 'preact';

vi.mock('./CardPicker.jsx', () => ({
  CardPicker: () => <div data-testid="card-picker" />,
}));

import { DetectionReview } from './DetectionReview.jsx';

function renderToContainer(vnode) {
  const container = document.createElement('div');
  render(vnode, container);
  return container;
}

describe('DetectionReview', () => {
  const defaultProps = {
    detections: [
      { detected_value: 'Ah', confidence: 0.99 },
      { detected_value: 'Kd', confidence: 0.95 },
    ],
    imageUrl: null,
    mode: 'player',
    targetName: 'Alice',
    onConfirm: vi.fn(),
    onRetake: vi.fn(),
  };

  it('renders heading and target name', () => {
    const container = renderToContainer(<DetectionReview {...defaultProps} />);
    expect(container.textContent).toContain('Review Detection');
    expect(container.textContent).toContain('Alice');
  });

  it('renders detected cards', () => {
    const container = renderToContainer(<DetectionReview {...defaultProps} />);
    expect(container.textContent).toContain('A');
    expect(container.textContent).toContain('K');
  });

  it('calls onConfirm with card values', () => {
    const onConfirm = vi.fn();
    const container = renderToContainer(<DetectionReview {...defaultProps} onConfirm={onConfirm} />);
    container.querySelector('button').click(); // first button is Retake? Let's find Confirm
    const buttons = container.querySelectorAll('button');
    const confirmBtn = Array.from(buttons).find(b => b.textContent === 'Confirm');
    confirmBtn.click();
    expect(onConfirm).toHaveBeenCalledWith('Alice', ['Ah', 'Kd']);
  });
});

describe('DetectionReview per-street modes', () => {
  it('flop mode passes cards in detection order (no bbox sorting)', () => {
    const onConfirm = vi.fn();
    // Cards in detection order — no reordering by bbox_x
    const detections = [
      { detected_value: 'Kd', confidence: 0.90, bbox_x: 300 },
      { detected_value: 'Ah', confidence: 0.99, bbox_x: 50 },
      { detected_value: '5c', confidence: 0.85, bbox_x: 175 },
    ];
    const container = renderToContainer(
      <DetectionReview
        detections={detections}
        imageUrl={null}
        mode="flop"
        targetName="flop"
        onConfirm={onConfirm}
        onRetake={vi.fn()}
      />,
    );

    const confirmBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Confirm',
    );
    confirmBtn.click();

    // No sorting — cards come in detection order
    expect(onConfirm).toHaveBeenCalledWith('flop', ['Kd', 'Ah', '5c']);
  });

  it('labels flop cards with Flop position labels', () => {
    const detections = [
      { detected_value: 'Ah', confidence: 0.99, bbox_x: 50 },
      { detected_value: '5c', confidence: 0.85, bbox_x: 175 },
      { detected_value: 'Kd', confidence: 0.90, bbox_x: 300 },
    ];
    const container = renderToContainer(
      <DetectionReview
        detections={detections}
        imageUrl={null}
        mode="flop"
        targetName="flop"
        onConfirm={vi.fn()}
        onRetake={vi.fn()}
      />,
    );

    const labels = container.querySelectorAll('[data-testid^="card-position-"]');
    expect(labels.length).toBe(3);
    expect(labels[0].textContent).toBe('Flop');
    expect(labels[1].textContent).toBe('Flop');
    expect(labels[2].textContent).toBe('Flop');
  });

  it('labels turn card with Turn position label', () => {
    const detections = [
      { detected_value: 'Js', confidence: 0.88, bbox_x: 450 },
    ];
    const container = renderToContainer(
      <DetectionReview
        detections={detections}
        imageUrl={null}
        mode="turn"
        targetName="turn"
        onConfirm={vi.fn()}
        onRetake={vi.fn()}
      />,
    );

    const labels = container.querySelectorAll('[data-testid^="card-position-"]');
    expect(labels.length).toBe(1);
    expect(labels[0].textContent).toBe('Turn');
  });

  it('labels river card with River position label', () => {
    const detections = [
      { detected_value: 'Qh', confidence: 0.92, bbox_x: 600 },
    ];
    const container = renderToContainer(
      <DetectionReview
        detections={detections}
        imageUrl={null}
        mode="river"
        targetName="river"
        onConfirm={vi.fn()}
        onRetake={vi.fn()}
      />,
    );

    const labels = container.querySelectorAll('[data-testid^="card-position-"]');
    expect(labels.length).toBe(1);
    expect(labels[0].textContent).toBe('River');
  });

  it('does not show position labels for player mode', () => {
    const detections = [
      { detected_value: 'Ah', confidence: 0.99, bbox_x: 50 },
      { detected_value: 'Kd', confidence: 0.90, bbox_x: 300 },
    ];
    const container = renderToContainer(
      <DetectionReview
        detections={detections}
        imageUrl={null}
        mode="player"
        targetName="Alice"
        onConfirm={vi.fn()}
        onRetake={vi.fn()}
      />,
    );

    const labels = container.querySelectorAll('[data-testid^="card-position-"]');
    expect(labels.length).toBe(0);
  });
});
