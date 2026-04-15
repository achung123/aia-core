/** @vitest-environment happy-dom */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { PlayerSessionTrend } from '../../src/api/types';

// Recharts relies on DOM measurements that don't exist in happy-dom.
// Mock recharts to render lightweight divs that let us assert data flow.
vi.mock('recharts', () => {
  const React = require('react');

  const ResponsiveContainer = ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  );

  const LineChart = ({ children, data }: { children: React.ReactNode; data: unknown[] }) => (
    <div data-testid="line-chart" data-count={data.length}>
      {children}
    </div>
  );

  const Line = (props: Record<string, unknown>) => (
    <div data-testid="line" data-datakey={props.dataKey} />
  );

  const XAxis = (props: Record<string, unknown>) => (
    <div data-testid="x-axis" data-datakey={props.dataKey} />
  );

  const YAxis = () => <div data-testid="y-axis" />;

  const Tooltip = ({ content }: { content?: React.ReactElement }) => (
    <div data-testid="tooltip">{content}</div>
  );

  const ReferenceLine = (props: Record<string, unknown>) => (
    <div data-testid="reference-line" data-y={props.y} />
  );

  const CartesianGrid = () => <div data-testid="cartesian-grid" />;

  return {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    ReferenceLine,
    CartesianGrid,
  };
});

import { WinRateTrendChart } from '../../src/components/WinRateTrendChart';

function makeTrend(overrides: Partial<PlayerSessionTrend> = {}): PlayerSessionTrend {
  return {
    game_id: 1,
    game_date: '2025-06-01',
    hands_played: 10,
    hands_won: 4,
    win_rate: 40,
    profit_loss: 100,
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
});

describe('WinRateTrendChart', () => {
  it('shows empty message when data is empty', () => {
    render(<WinRateTrendChart data={[]} />);
    expect(screen.getByTestId('trend-empty')).toBeTruthy();
    expect(screen.getByTestId('trend-empty').textContent).toContain('No session data');
  });

  it('renders chart with correct structure', () => {
    const data = [makeTrend({ win_rate: 40 }), makeTrend({ game_id: 2, win_rate: 60 })];
    render(<WinRateTrendChart data={data} />);

    expect(screen.getByTestId('trend-chart')).toBeTruthy();
    expect(screen.getByTestId('line-chart')).toBeTruthy();
    expect(screen.getByTestId('line-chart').getAttribute('data-count')).toBe('2');
  });

  it('renders XAxis keyed to game_date', () => {
    render(<WinRateTrendChart data={[makeTrend()]} />);
    expect(screen.getByTestId('x-axis').getAttribute('data-datakey')).toBe('game_date');
  });

  it('renders Line keyed to win_rate', () => {
    render(<WinRateTrendChart data={[makeTrend()]} />);
    expect(screen.getByTestId('line').getAttribute('data-datakey')).toBe('win_rate');
  });

  it('renders a ReferenceLine at the average win rate', () => {
    const data = [
      makeTrend({ win_rate: 30 }),
      makeTrend({ game_id: 2, win_rate: 50 }),
    ];
    render(<WinRateTrendChart data={data} />);
    const ref = screen.getByTestId('reference-line');
    expect(Number(ref.getAttribute('data-y'))).toBe(40);
  });

  it('enables horizontal scroll when data has more than 10 sessions', () => {
    const data = Array.from({ length: 12 }, (_, i) =>
      makeTrend({ game_id: i + 1, game_date: `2025-06-${String(i + 1).padStart(2, '0')}`, win_rate: 50 }),
    );
    render(<WinRateTrendChart data={data} />);
    expect(screen.getByTestId('trend-scroll-container')).toBeTruthy();
  });

  it('does not render scroll container for 10 or fewer sessions', () => {
    const data = Array.from({ length: 5 }, (_, i) =>
      makeTrend({ game_id: i + 1, win_rate: 50 }),
    );
    render(<WinRateTrendChart data={data} />);
    expect(screen.queryByTestId('trend-scroll-container')).toBeNull();
  });
});
