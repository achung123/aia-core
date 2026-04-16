import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from 'recharts';
import type { LeaderboardEntry } from '../api/types';

export interface WinsDonutChartProps {
  leaderboard: LeaderboardEntry[];
}

interface SlicePayload {
  name: string;
  value: number;
}

const COLORS = [
  '#8b5cf6', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#a855f7',
];

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: SlicePayload }[];
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const total = payload.reduce((s, p) => s + p.payload.value, 0) || 1;
  const pct = ((d.value / total) * 100).toFixed(1);
  return (
    <div style={tooltipStyle}>
      <p style={{ margin: 0, fontWeight: 600 }}>{d.name}</p>
      <p style={{ margin: 0 }}>Hands won: {d.value}</p>
      <p style={{ margin: 0 }}>{pct}%</p>
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

export function WinsDonutChart({ leaderboard }: WinsDonutChartProps) {
  const data = leaderboard.map((entry) => ({
    name: entry.player_name,
    value: Math.round(entry.hands_played * entry.win_rate / 100),
  }));

  const totalHands = leaderboard.reduce((s, e) => s + e.hands_played, 0);
  const totalWins = data.reduce((s, d) => s + d.value, 0);

  if (totalWins === 0) {
    return <p data-testid="wins-donut-empty">No hand data yet.</p>;
  }

  return (
    <div data-testid="wins-donut-chart">
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={100}
            paddingAngle={2}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
      <p style={summaryStyle}>
        {totalWins} hands won of {totalHands} total
      </p>
    </div>
  );
}

const summaryStyle: React.CSSProperties = {
  textAlign: 'center',
  color: '#94a3b8',
  fontSize: '0.85rem',
  marginTop: '0.25rem',
};
