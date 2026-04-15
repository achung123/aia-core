/** @vitest-environment happy-dom */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { PlayerStatsResponse } from '../../src/api/types';

// Mock recharts — same pattern as WinRateTrendChart tests
vi.mock('recharts', () => {
  const React = require('react');

  const ResponsiveContainer = ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  );

  const PieChart = ({ children }: { children: React.ReactNode }) => (
    <div data-testid="pie-chart">{children}</div>
  );

  const Pie = ({
    data,
    dataKey,
    nameKey,
    children,
  }: {
    data: { name: string; value: number }[];
    dataKey: string;
    nameKey: string;
    children?: React.ReactNode;
  }) => (
    <div
      data-testid="pie"
      data-datakey={dataKey}
      data-namekey={nameKey}
      data-items={JSON.stringify(data)}
    >
      {children}
    </div>
  );

  const Cell = ({ fill }: { fill: string }) => (
    <div data-testid="cell" data-fill={fill} />
  );

  const Tooltip = () => <div data-testid="tooltip" />;

  const Legend = () => <div data-testid="legend" />;

  return {
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Tooltip,
    Legend,
  };
});

import { OutcomeDonutCharts } from '../../src/components/OutcomeDonutCharts';

function makeStats(overrides: Partial<PlayerStatsResponse> = {}): PlayerStatsResponse {
  return {
    player_name: 'Alice',
    total_hands_played: 50,
    hands_won: 20,
    hands_lost: 18,
    hands_folded: 12,
    win_rate: 40.0,
    total_profit_loss: 350,
    avg_profit_loss_per_hand: 7.0,
    avg_profit_loss_per_session: 175.0,
    flop_pct: 60.0,
    turn_pct: 45.0,
    river_pct: 30.0,
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
});

describe('OutcomeDonutCharts', () => {
  it('renders two pie charts', () => {
    render(<OutcomeDonutCharts stats={makeStats()} />);
    const pies = screen.getAllByTestId('pie');
    expect(pies.length).toBe(2);
  });

  it('renders outcome distribution with won/lost/folded data', () => {
    render(<OutcomeDonutCharts stats={makeStats()} />);
    const pies = screen.getAllByTestId('pie');
    const outcomeData = JSON.parse(pies[0].getAttribute('data-items')!);
    expect(outcomeData).toEqual([
      { name: 'Won', value: 20 },
      { name: 'Lost', value: 18 },
      { name: 'Folded', value: 12 },
    ]);
  });

  it('renders street reach distribution with flop/turn/river data', () => {
    render(<OutcomeDonutCharts stats={makeStats()} />);
    const pies = screen.getAllByTestId('pie');
    const streetData = JSON.parse(pies[1].getAttribute('data-items')!);
    expect(streetData).toEqual([
      { name: 'Flop', value: 60.0 },
      { name: 'Turn', value: 45.0 },
      { name: 'River', value: 30.0 },
    ]);
  });

  it('renders outcome cells with correct colors (green, red, grey)', () => {
    render(<OutcomeDonutCharts stats={makeStats()} />);
    const cells = screen.getAllByTestId('cell');
    const fills = cells.map((c) => c.getAttribute('data-fill'));
    // First 3 cells are outcome: green, red, grey
    expect(fills[0]).toBe('#22c55e');
    expect(fills[1]).toBe('#ef4444');
    expect(fills[2]).toBe('#9ca3af');
  });

  it('renders tooltips for both charts', () => {
    render(<OutcomeDonutCharts stats={makeStats()} />);
    const tooltips = screen.getAllByTestId('tooltip');
    expect(tooltips.length).toBe(2);
  });

  it('renders legends for both charts', () => {
    render(<OutcomeDonutCharts stats={makeStats()} />);
    const legends = screen.getAllByTestId('legend');
    expect(legends.length).toBe(2);
  });

  it('renders section titles', () => {
    render(<OutcomeDonutCharts stats={makeStats()} />);
    expect(screen.getByText('Outcome Distribution')).toBeTruthy();
    expect(screen.getByText('Street Reach')).toBeTruthy();
  });

  it('shows empty message when total_hands_played is 0', () => {
    render(<OutcomeDonutCharts stats={makeStats({ total_hands_played: 0, hands_won: 0, hands_lost: 0, hands_folded: 0 })} />);
    expect(screen.getByTestId('donut-empty')).toBeTruthy();
    expect(screen.queryByTestId('pie')).toBeNull();
  });

  it('uses value dataKey and name nameKey on Pie elements', () => {
    render(<OutcomeDonutCharts stats={makeStats()} />);
    const pies = screen.getAllByTestId('pie');
    expect(pies[0].getAttribute('data-datakey')).toBe('value');
    expect(pies[0].getAttribute('data-namekey')).toBe('name');
    expect(pies[1].getAttribute('data-datakey')).toBe('value');
    expect(pies[1].getAttribute('data-namekey')).toBe('name');
  });
});
