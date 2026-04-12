/** @vitest-environment happy-dom */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ResultOverlay } from './ResultOverlay.tsx';

afterEach(() => cleanup());

const HAND_DATA = {
  player_hands: [
    {
      player_name: 'Alice',
      hole_cards: [
        { rank: 'A', suit: 'H' },
        { rank: 'K', suit: 'S' },
      ],
      result: 'win',
      profit_loss: 50,
    },
    {
      player_name: 'Bob',
      hole_cards: [
        { rank: '10', suit: 'D' },
        { rank: '9', suit: 'C' },
      ],
      result: 'loss',
      profit_loss: -30,
    },
  ],
};

describe('ResultOverlay', () => {
  it('renders nothing when not visible', () => {
    const { container } = render(
      <ResultOverlay handData={HAND_DATA} visible={false} onDismiss={() => {}} />,
    );
    expect(container.querySelector('.result-overlay')).toBeNull();
  });

  it('renders overlay when visible', () => {
    render(<ResultOverlay handData={HAND_DATA} visible={true} onDismiss={() => {}} />);
    expect(screen.getByText('Showdown Results')).toBeInTheDocument();
  });

  it('displays player names', () => {
    render(<ResultOverlay handData={HAND_DATA} visible={true} onDismiss={() => {}} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('displays formatted hole cards', () => {
    render(<ResultOverlay handData={HAND_DATA} visible={true} onDismiss={() => {}} />);
    expect(screen.getByText('A♥')).toBeInTheDocument();
    expect(screen.getByText('K♠')).toBeInTheDocument();
  });

  it('displays player results', () => {
    render(<ResultOverlay handData={HAND_DATA} visible={true} onDismiss={() => {}} />);
    expect(screen.getByText('win')).toBeInTheDocument();
    expect(screen.getByText('loss')).toBeInTheDocument();
  });

  it('displays formatted P/L values', () => {
    render(<ResultOverlay handData={HAND_DATA} visible={true} onDismiss={() => {}} />);
    expect(screen.getByText('+$50.00')).toBeInTheDocument();
    expect(screen.getByText('-$30.00')).toBeInTheDocument();
  });

  it('highlights winner row', () => {
    render(<ResultOverlay handData={HAND_DATA} visible={true} onDismiss={() => {}} />);
    const rows = screen.getAllByRole('row');
    // row 0 = header, row 1 = Alice (winner)
    expect(rows[1].style.background).toBe('#b8860b');
    expect(rows[1].style.fontWeight).toBe('bold');
  });

  it('calls onDismiss when dismiss button is clicked', () => {
    const spy = vi.fn();
    render(<ResultOverlay handData={HAND_DATA} visible={true} onDismiss={spy} />);
    fireEvent.click(screen.getByText('✕ Dismiss'));
    expect(spy).toHaveBeenCalled();
  });

  it('shows dash for missing hole cards', () => {
    const data = {
      player_hands: [
        { player_name: 'Charlie', hole_cards: [], result: null, profit_loss: null },
      ],
    };
    render(<ResultOverlay handData={data} visible={true} onDismiss={() => {}} />);
    // cards cell and result cell and P/L cell should show dashes
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });

  it('handles null handData gracefully', () => {
    render(<ResultOverlay handData={null} visible={true} onDismiss={() => {}} />);
    expect(screen.getByText('Showdown Results')).toBeInTheDocument();
  });
});
