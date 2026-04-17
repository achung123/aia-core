import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
} from 'recharts';
import type { PlayerSessionTrend } from '../api/types';

interface WinRateTrendChartProps {
  data: PlayerSessionTrend[];
}

interface TooltipPayloadEntry {
  payload: PlayerSessionTrend;
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div data-testid="trend-tooltip" style={tooltipStyle}>
      <p style={{ margin: 0, fontWeight: 600 }}>{d.game_date}</p>
      <p style={{ margin: 0 }}>Hands played: {d.hands_played}</p>
      <p style={{ margin: 0 }}>Wins: {d.hands_won}</p>
      <p style={{ margin: 0 }}>Win rate: {d.win_rate}%</p>
    </div>
  );
}

const tooltipStyle: React.CSSProperties = {
  background: '#1f2937',
  color: '#f9fafb',
  padding: '0.5rem 0.75rem',
  borderRadius: 6,
  fontSize: '0.85rem',
  lineHeight: 1.5,
};

export function WinRateTrendChart({ data }: WinRateTrendChartProps) {
  if (!data.length) {
    return <p data-testid="trend-empty">No session data available.</p>;
  }

  const avgWinRate =
    data.reduce((sum, d) => sum + d.win_rate, 0) / data.length;

  const needsScroll = data.length > 10;
  const chartWidth = needsScroll ? data.length * 80 : undefined;

  const chart = (
    <div style={needsScroll ? { width: chartWidth, minWidth: '100%' } : undefined}>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 10, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="game_date" tick={{ fontSize: 12 }} />
          <YAxis domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine
            y={avgWinRate}
            stroke="#facc15"
            strokeDasharray="6 3"
            label={{ value: `Avg ${avgWinRate.toFixed(1)}%`, fill: '#facc15', fontSize: 12 }}
          />
          <Line
            type="monotone"
            dataKey="win_rate"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );

  return (
    <div data-testid="trend-chart">
      {needsScroll ? (
        <div data-testid="trend-scroll-container" style={{ overflowX: 'auto' }}>
          {chart}
        </div>
      ) : (
        chart
      )}
    </div>
  );
}
