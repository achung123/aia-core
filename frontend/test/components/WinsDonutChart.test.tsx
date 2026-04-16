/** @vitest-environment happy-dom */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { WinsDonutChart } from '../../src/components/WinsDonutChart';

afterEach(cleanup);

const LEADERBOARD = [
  { rank: 1, player_name: 'Alice', total_profit_loss: 250, win_rate: 65, hands_played: 40 },
  { rank: 2, player_name: 'Bob', total_profit_loss: -80, win_rate: 40, hands_played: 30 },
  { rank: 3, player_name: 'Charlie', total_profit_loss: 10, win_rate: 50, hands_played: 20 },
];

describe('WinsDonutChart', () => {
  it('renders the chart container when there are wins', () => {
    render(<WinsDonutChart leaderboard={LEADERBOARD} />);
    expect(screen.getByTestId('wins-donut-chart')).toBeTruthy();
  });

  it('shows summary with total wins and total hands', () => {
    render(<WinsDonutChart leaderboard={LEADERBOARD} />);
    // Alice: round(40*65/100)=26, Bob: round(30*40/100)=12, Charlie: round(20*50/100)=10 => 48 won of 90 total
    expect(screen.getByText('48 hands won of 90 total')).toBeTruthy();
  });

  it('total wins must be less than or equal to total hands', () => {
    render(<WinsDonutChart leaderboard={LEADERBOARD} />);
    const summary = screen.getByText(/hands won of .* total/);
    const match = summary.textContent!.match(/(\d+) hands won of (\d+) total/);
    expect(match).toBeTruthy();
    const wins = Number(match![1]);
    const total = Number(match![2]);
    expect(wins).toBeLessThanOrEqual(total);
  });

  it('shows empty state when all players have zero wins', () => {
    const empty = [
      { rank: 1, player_name: 'Alice', total_profit_loss: 0, win_rate: 0, hands_played: 5 },
    ];
    render(<WinsDonutChart leaderboard={empty} />);
    expect(screen.getByTestId('wins-donut-empty')).toBeTruthy();
    expect(screen.queryByTestId('wins-donut-chart')).toBeNull();
  });

  it('shows empty state for an empty leaderboard', () => {
    render(<WinsDonutChart leaderboard={[]} />);
    expect(screen.getByTestId('wins-donut-empty')).toBeTruthy();
  });
});
