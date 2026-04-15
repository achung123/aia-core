import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from 'recharts';
import type { PlayerStatsResponse } from '../api/types';

interface OutcomeDonutChartsProps {
  stats: PlayerStatsResponse;
}

const OUTCOME_COLORS = ['#22c55e', '#ef4444', '#9ca3af'];
const STREET_COLORS = ['#3b82f6', '#f59e0b', '#8b5cf6'];

interface SlicePayload {
  name: string;
  value: number;
}

function DonutTooltip({
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
      <p style={{ margin: 0 }}>Count: {d.value}</p>
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

export function OutcomeDonutCharts({ stats }: OutcomeDonutChartsProps) {
  if (stats.total_hands_played === 0) {
    return <p data-testid="donut-empty">No hand data available for charts.</p>;
  }

  const outcomeData = [
    { name: 'Won', value: stats.hands_won },
    { name: 'Lost', value: stats.hands_lost },
    { name: 'Folded', value: stats.hands_folded },
  ];

  const streetData = [
    { name: 'Flop', value: stats.flop_pct },
    { name: 'Turn', value: stats.turn_pct },
    { name: 'River', value: stats.river_pct },
  ];

  return (
    <div data-testid="donut-charts" style={containerStyle}>
      <div style={chartBlock}>
        <h3 style={chartTitle}>Outcome Distribution</h3>
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={outcomeData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={90}
              paddingAngle={2}
            >
              {outcomeData.map((_, i) => (
                <Cell key={i} fill={OUTCOME_COLORS[i]} />
              ))}
            </Pie>
            <Tooltip content={<DonutTooltip />} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div style={chartBlock}>
        <h3 style={chartTitle}>Street Reach</h3>
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={streetData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={90}
              paddingAngle={2}
            >
              {streetData.map((_, i) => (
                <Cell key={i} fill={STREET_COLORS[i]} />
              ))}
            </Pie>
            <Tooltip content={<DonutTooltip />} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '1.5rem',
  justifyContent: 'center',
};

const chartBlock: React.CSSProperties = {
  flex: '1 1 260px',
  minWidth: 0,
  maxWidth: 360,
};

const chartTitle: React.CSSProperties = {
  fontSize: '0.95rem',
  fontWeight: 600,
  textAlign: 'center',
  marginBottom: '0.5rem',
  color: '#d1d5db',
};
