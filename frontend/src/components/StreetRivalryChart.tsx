import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import type { StreetBreakdown } from '../api/types';

interface StreetRivalryChartProps {
  player1Name: string;
  player2Name: string;
  streetBreakdown: StreetBreakdown[];
}

interface TooltipPayloadEntry {
  name: string;
  value: number;
  color: string;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
}) {
  if (!active || !payload || !payload.length) return null;

  const total = payload.reduce((sum, entry) => sum + entry.value, 0);

  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #ccc',
        borderRadius: 4,
        padding: '8px 12px',
        fontSize: '0.875rem',
      }}
    >
      <p style={{ margin: 0, fontWeight: 600 }}>{label}</p>
      <p style={{ margin: '4px 0 0', color: '#666' }}>Hands: {total}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ margin: '2px 0 0', color: entry.color }}>
          {entry.name}: {entry.value}
        </p>
      ))}
    </div>
  );
}

export function StreetRivalryChart({
  player1Name,
  player2Name,
  streetBreakdown,
}: StreetRivalryChartProps) {
  const chartData = streetBreakdown.map((sb) => ({
    street: sb.street,
    player1Wins: sb.player1_wins,
    player2Wins: sb.player2_wins,
  }));

  return (
    <div data-testid="street-rivalry-chart" style={{ marginBottom: '1.5rem' }}>
      <h3>Street Rivalry</h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="street" />
          <YAxis allowDecimals={false} />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Bar dataKey="player1Wins" name={`${player1Name} Wins`} stackId="wins" fill="#3b82f6" />
          <Bar dataKey="player2Wins" name={`${player2Name} Wins`} stackId="wins" fill="#ef4444" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
