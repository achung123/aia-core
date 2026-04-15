/** @vitest-environment happy-dom */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

// Mock recharts — mirrors the pattern used in FoldBehaviorChart tests.
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

  const Bar = (props: Record<string, unknown>) => (
    <div data-testid="bar" data-datakey={props.dataKey} data-fill={props.fill} data-name={props.name} data-stackid={props.stackId} />
  );

  const XAxis = (props: Record<string, unknown>) => (
    <div data-testid="x-axis" data-datakey={props.dataKey} />
  );

  const YAxis = () => <div data-testid="y-axis" />;

  const Tooltip = (props: Record<string, unknown>) => (
    <div data-testid="tooltip" data-has-content={props.content ? 'true' : 'false'} />
  );

  const Legend = () => <div data-testid="legend" />;

  const CartesianGrid = () => <div data-testid="cartesian-grid" />;

  return {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    Legend,
    CartesianGrid,
  };
});

import { StreetRivalryChart } from '../../src/components/StreetRivalryChart';

afterEach(cleanup);

const sampleBreakdown = [
  { street: 'Pre-Flop', hands_ended: 5, player1_wins: 3, player2_wins: 2 },
  { street: 'Flop', hands_ended: 8, player1_wins: 4, player2_wins: 4 },
  { street: 'Turn', hands_ended: 3, player1_wins: 1, player2_wins: 2 },
  { street: 'River', hands_ended: 10, player1_wins: 6, player2_wins: 4 },
];

describe('StreetRivalryChart', () => {
  it('renders the chart container with correct test id', () => {
    render(
      <StreetRivalryChart
        player1Name="Alice"
        player2Name="Bob"
        streetBreakdown={sampleBreakdown}
      />,
    );
    expect(screen.getByTestId('street-rivalry-chart')).toBeTruthy();
  });

  it('renders a stacked bar chart with correct data count', () => {
    render(
      <StreetRivalryChart
        player1Name="Alice"
        player2Name="Bob"
        streetBreakdown={sampleBreakdown}
      />,
    );
    const chart = screen.getByTestId('bar-chart');
    expect(chart.getAttribute('data-count')).toBe('4');
  });

  it('renders two stacked bars (one per player)', () => {
    render(
      <StreetRivalryChart
        player1Name="Alice"
        player2Name="Bob"
        streetBreakdown={sampleBreakdown}
      />,
    );
    const bars = screen.getAllByTestId('bar');
    expect(bars.length).toBe(2);
    // Both bars should share the same stackId for stacking
    expect(bars[0].getAttribute('data-stackid')).toBe('wins');
    expect(bars[1].getAttribute('data-stackid')).toBe('wins');
  });

  it('labels bars with player names', () => {
    render(
      <StreetRivalryChart
        player1Name="Alice"
        player2Name="Bob"
        streetBreakdown={sampleBreakdown}
      />,
    );
    const bars = screen.getAllByTestId('bar');
    expect(bars[0].getAttribute('data-name')).toBe('Alice Wins');
    expect(bars[1].getAttribute('data-name')).toBe('Bob Wins');
  });

  it('uses street as X-axis dataKey', () => {
    render(
      <StreetRivalryChart
        player1Name="Alice"
        player2Name="Bob"
        streetBreakdown={sampleBreakdown}
      />,
    );
    const xAxis = screen.getByTestId('x-axis');
    expect(xAxis.getAttribute('data-datakey')).toBe('street');
  });

  it('renders a heading', () => {
    render(
      <StreetRivalryChart
        player1Name="Alice"
        player2Name="Bob"
        streetBreakdown={sampleBreakdown}
      />,
    );
    expect(screen.getByText(/street rivalry/i)).toBeTruthy();
  });

  it('includes a custom tooltip', () => {
    render(
      <StreetRivalryChart
        player1Name="Alice"
        player2Name="Bob"
        streetBreakdown={sampleBreakdown}
      />,
    );
    expect(screen.getByTestId('tooltip')).toBeTruthy();
  });

  it('renders responsive container for mobile readability', () => {
    render(
      <StreetRivalryChart
        player1Name="Alice"
        player2Name="Bob"
        streetBreakdown={sampleBreakdown}
      />,
    );
    expect(screen.getByTestId('responsive-container')).toBeTruthy();
  });
});
