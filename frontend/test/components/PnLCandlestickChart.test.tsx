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

  const BarChart = ({ children, data }: { children: React.ReactNode; data: unknown[] }) => (
    <div data-testid="bar-chart" data-count={data.length}>
      {children}
    </div>
  );

  const Bar = ({ children, dataKey }: { children: React.ReactNode; dataKey: string }) => (
    <div data-testid="bar" data-datakey={dataKey}>
      {children}
    </div>
  );

  const Cell = (props: Record<string, unknown>) => (
    <div data-testid="cell" data-fill={props.fill} />
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
    BarChart,
    Bar,
    Cell,
    XAxis,
    YAxis,
    Tooltip,
    ReferenceLine,
    CartesianGrid,
  };
});

import { PnLCandlestickChart, buildCandles } from '../../src/components/PnLCandlestickChart';

afterEach(cleanup);

const TRENDS: PlayerSessionTrend[] = [
  { game_id: 1, game_date: '2026-03-01', hands_played: 10, hands_won: 6, win_rate: 60, profit_loss: 100 },
  { game_id: 2, game_date: '2026-03-08', hands_played: 8, hands_won: 2, win_rate: 25, profit_loss: -50 },
  { game_id: 3, game_date: '2026-03-15', hands_played: 12, hands_won: 7, win_rate: 58, profit_loss: 75 },
];

describe('buildCandles', () => {
  it('computes cumulative open/close per session', () => {
    const candles = buildCandles(TRENDS);
    // Session 1: open=0, close=100
    expect(candles[0]).toMatchObject({ open: 0, close: 100, session_pl: 100 });
    // Session 2: open=100, close=50
    expect(candles[1]).toMatchObject({ open: 100, close: 50, session_pl: -50 });
    // Session 3: open=50, close=125
    expect(candles[2]).toMatchObject({ open: 50, close: 125, session_pl: 75 });
  });

  it('sets range as [min, max] so recharts always gets positive height', () => {
    const candles = buildCandles(TRENDS);
    // Profitable session: open=0, close=100 → [0, 100]
    expect(candles[0].range).toEqual([0, 100]);
    // Losing session: open=100, close=50 → must be [50, 100], NOT [100, 50]
    expect(candles[1].range).toEqual([50, 100]);
    // Profitable session: open=50, close=125 → [50, 125]
    expect(candles[2].range).toEqual([50, 125]);
  });

  it('returns empty array for empty input', () => {
    expect(buildCandles([])).toEqual([]);
  });
});

describe('PnLCandlestickChart', () => {
  it('renders the chart container with testid', () => {
    render(<PnLCandlestickChart data={TRENDS} />);
    expect(screen.getByTestId('pnl-candlestick-chart')).toBeTruthy();
  });

  it('shows empty message when data is empty', () => {
    const { container } = render(<PnLCandlestickChart data={[]} />);
    expect(container.textContent).toContain('No session data');
  });

  it('renders BarChart with correct data count', () => {
    render(<PnLCandlestickChart data={TRENDS} />);
    expect(screen.getByTestId('bar-chart').getAttribute('data-count')).toBe('3');
  });

  it('renders Bar keyed to range', () => {
    render(<PnLCandlestickChart data={TRENDS} />);
    expect(screen.getByTestId('bar').getAttribute('data-datakey')).toBe('range');
  });

  it('renders green and red Cell fills for profit and loss', () => {
    render(<PnLCandlestickChart data={TRENDS} />);
    const cells = screen.getAllByTestId('cell');
    const fills = cells.map((c) => c.getAttribute('data-fill'));
    // Sessions: +100 (green), -50 (red), +75 (green)
    expect(fills).toEqual(['#22c55e', '#ef4444', '#22c55e']);
  });

  it('renders XAxis keyed to date', () => {
    render(<PnLCandlestickChart data={TRENDS} />);
    expect(screen.getByTestId('x-axis').getAttribute('data-datakey')).toBe('date');
  });

  it('renders a ReferenceLine at zero', () => {
    render(<PnLCandlestickChart data={TRENDS} />);
    expect(screen.getByTestId('reference-line').getAttribute('data-y')).toBe('0');
  });

  it('handles single-session data', () => {
    render(<PnLCandlestickChart data={[TRENDS[0]]} />);
    expect(screen.getByTestId('bar-chart').getAttribute('data-count')).toBe('1');
    const cells = screen.getAllByTestId('cell');
    expect(cells).toHaveLength(1);
    expect(cells[0].getAttribute('data-fill')).toBe('#22c55e');
  });
});
