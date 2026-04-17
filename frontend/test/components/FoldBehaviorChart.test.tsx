/** @vitest-environment happy-dom */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

// Mock recharts the same way the project mocks it in other test files.
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
    <div data-testid="bar" data-datakey={props.dataKey} data-fill={props.fill} />
  );

  const XAxis = (props: Record<string, unknown>) => (
    <div data-testid="x-axis" data-datakey={props.dataKey} />
  );

  const YAxis = () => <div data-testid="y-axis" />;

  const Tooltip = () => <div data-testid="tooltip" />;

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

import { FoldBehaviorChart } from '../../src/components/FoldBehaviorChart';

afterEach(cleanup);

describe('FoldBehaviorChart', () => {
  it('renders a bar chart container', () => {
    render(
      <FoldBehaviorChart
        player1Name="Alice"
        player2Name="Bob"
        player1FoldRate={16.67}
        player2FoldRate={26.67}
      />,
    );
    expect(screen.getByTestId('fold-behavior-chart')).toBeTruthy();
    expect(screen.getByTestId('bar-chart')).toBeTruthy();
  });

  it('renders two bars for the two players', () => {
    render(
      <FoldBehaviorChart
        player1Name="Alice"
        player2Name="Bob"
        player1FoldRate={16.67}
        player2FoldRate={26.67}
      />,
    );
    const bars = screen.getAllByTestId('bar');
    expect(bars.length).toBe(2);
  });

  it('passes correct data to the chart (2 rows)', () => {
    render(
      <FoldBehaviorChart
        player1Name="Alice"
        player2Name="Bob"
        player1FoldRate={16.67}
        player2FoldRate={26.67}
      />,
    );
    const chart = screen.getByTestId('bar-chart');
    expect(chart.getAttribute('data-count')).toBe('2');
  });

  it('displays a heading', () => {
    render(
      <FoldBehaviorChart
        player1Name="Alice"
        player2Name="Bob"
        player1FoldRate={16.67}
        player2FoldRate={26.67}
      />,
    );
    expect(screen.getByText(/fold behavior/i)).toBeTruthy();
  });
});
