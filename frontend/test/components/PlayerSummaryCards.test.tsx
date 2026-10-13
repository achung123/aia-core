/** @vitest-environment happy-dom */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { PlayerSummaryCards } from '../../src/components/PlayerSummaryCards';
import type { GameStatsPlayerEntry } from '../../src/api/types';

afterEach(() => cleanup());

const players: GameStatsPlayerEntry[] = [
  { player_name: 'Alice', hands_played: 20, hands_won: 10, hands_lost: 5, hands_folded: 5, win_rate: 50.0, profit_loss: 120.5 },
  { player_name: 'Bob', hands_played: 20, hands_won: 6, hands_lost: 8, hands_folded: 6, win_rate: 30.0, profit_loss: -40.0 },
  { player_name: 'Carol', hands_played: 20, hands_won: 4, hands_lost: 10, hands_folded: 6, win_rate: 20.0, profit_loss: 0 },
];

describe('PlayerSummaryCards', () => {
  it('renders a card for each player', () => {
    render(<PlayerSummaryCards players={players} />);
    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('Bob')).toBeTruthy();
    expect(screen.getByText('Carol')).toBeTruthy();
  });

  it('displays hands played, wins, losses, folds, and win rate per player', () => {
    render(<PlayerSummaryCards players={players} />);
    // Alice stats
    const aliceCard = screen.getByTestId('player-card-Alice');
    expect(aliceCard.textContent).toContain('20');  // hands played
    expect(aliceCard.textContent).toContain('10');  // wins
    expect(aliceCard.textContent).toContain('5');   // losses
    expect(aliceCard.textContent).toContain('50%'); // win rate
  });

  it('shows P&L value when > 0', () => {
    render(<PlayerSummaryCards players={players} />);
    const aliceCard = screen.getByTestId('player-card-Alice');
    expect(aliceCard.textContent).toContain('$120.50');
  });

  it('shows muted dash for P&L when zero', () => {
    render(<PlayerSummaryCards players={players} />);
    const carolCard = screen.getByTestId('player-card-Carol');
    expect(carolCard.textContent).toContain('—');
  });

  it('shows negative P&L value', () => {
    render(<PlayerSummaryCards players={players} />);
    const bobCard = screen.getByTestId('player-card-Bob');
    expect(bobCard.textContent).toContain('-$40.00');
  });

  it('highlights the game winner with a trophy icon', () => {
    render(<PlayerSummaryCards players={players} />);
    // Alice has highest profit_loss so she is the winner
    const aliceCard = screen.getByTestId('player-card-Alice');
    expect(aliceCard.textContent).toContain('🏆');
    // Bob should not have trophy
    const bobCard = screen.getByTestId('player-card-Bob');
    expect(bobCard.textContent).not.toContain('🏆');
  });

  it('highlights multiple winners when tied for highest P&L', () => {
    const tied: GameStatsPlayerEntry[] = [
      { player_name: 'X', hands_played: 10, hands_won: 5, hands_lost: 5, hands_folded: 0, win_rate: 50, profit_loss: 100 },
      { player_name: 'Y', hands_played: 10, hands_won: 5, hands_lost: 5, hands_folded: 0, win_rate: 50, profit_loss: 100 },
    ];
    render(<PlayerSummaryCards players={tied} />);
    expect(screen.getByTestId('player-card-X').textContent).toContain('🏆');
    expect(screen.getByTestId('player-card-Y').textContent).toContain('🏆');
  });

  it('does not highlight winner when all P&L are zero or negative', () => {
    const losers: GameStatsPlayerEntry[] = [
      { player_name: 'A', hands_played: 10, hands_won: 2, hands_lost: 8, hands_folded: 0, win_rate: 20, profit_loss: -50 },
      { player_name: 'B', hands_played: 10, hands_won: 3, hands_lost: 7, hands_folded: 0, win_rate: 30, profit_loss: 0 },
    ];
    render(<PlayerSummaryCards players={losers} />);
    expect(screen.getByTestId('player-card-A').textContent).not.toContain('🏆');
    expect(screen.getByTestId('player-card-B').textContent).not.toContain('🏆');
  });

  it('renders an empty state when no players', () => {
    render(<PlayerSummaryCards players={[]} />);
    expect(screen.getByTestId('player-summary-cards')).toBeTruthy();
  });

  it('renders a scrollable container', () => {
    const { container } = render(<PlayerSummaryCards players={players} />);
    const scrollContainer = screen.getByTestId('player-summary-cards');
    expect(scrollContainer.style.overflowX).toBe('auto');
  });

  it('applies gold border to winner card', () => {
    render(<PlayerSummaryCards players={players} />);
    const aliceCard = screen.getByTestId('player-card-Alice');
    expect(aliceCard.style.borderColor).toBe('#f59e0b');
  });
});
