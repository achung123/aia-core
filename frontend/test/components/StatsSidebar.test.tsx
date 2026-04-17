/** @vitest-environment happy-dom */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { StatsSidebar } from '../../src/../src/components/StatsSidebar.tsx';

afterEach(() => cleanup());

const HANDS = [
  {
    pot: 50,
    player_hands: [
      { player_name: 'Alice', profit_loss: 30 },
      { player_name: 'Bob', profit_loss: -20 },
    ],
  },
  {
    pot: 80,
    player_hands: [
      { player_name: 'Alice', profit_loss: -15 },
      { player_name: 'Bob', profit_loss: 25 },
    ],
  },
];

describe('StatsSidebar', () => {
  it('renders the Stats heading', () => {
    render(<StatsSidebar hands={HANDS} currentHandIndex={1} />);
    expect(screen.getByText('Stats')).toBeInTheDocument();
  });

  it('displays Player and P/L column headers', () => {
    render(<StatsSidebar hands={HANDS} currentHandIndex={1} />);
    expect(screen.getByText('Player')).toBeInTheDocument();
    expect(screen.getByText('P/L')).toBeInTheDocument();
  });

  it('shows player totals for the given hand index slice', () => {
    render(<StatsSidebar hands={HANDS} currentHandIndex={1} />);
    // After hand 1: Alice +30, Bob -20
    expect(screen.getByText('+$30.00')).toBeInTheDocument();
    expect(screen.getByText('-$20.00')).toBeInTheDocument();
  });

  it('accumulates P/L across multiple hands', () => {
    render(<StatsSidebar hands={HANDS} currentHandIndex={2} />);
    // After hand 2: Alice +30-15=+15, Bob -20+25=+5
    expect(screen.getByText('+$15.00')).toBeInTheDocument();
    expect(screen.getByText('+$5.00')).toBeInTheDocument();
  });

  it('shows hands completed count', () => {
    render(<StatsSidebar hands={HANDS} currentHandIndex={2} />);
    expect(screen.getByText('Hands: 2')).toBeInTheDocument();
  });

  it('shows total pot', () => {
    render(<StatsSidebar hands={HANDS} currentHandIndex={2} />);
    expect(screen.getByText('Total pot: $130.00')).toBeInTheDocument();
  });

  it('shows dash for null profit_loss', () => {
    const hands = [
      { pot: 20, player_hands: [{ player_name: 'Charlie', profit_loss: null }] },
    ];
    render(<StatsSidebar hands={hands} currentHandIndex={1} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('sorts players by P/L descending', () => {
    render(<StatsSidebar hands={HANDS} currentHandIndex={1} />);
    const rows = screen.getAllByRole('row');
    // row 0 = header, row 1 = Alice (+30), row 2 = Bob (-20), row 3 = summary
    const firstPlayerCell = rows[1].querySelectorAll('td')[0];
    expect(firstPlayerCell.textContent).toBe('Alice');
  });
});
