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

interface FoldBehaviorChartProps {
  player1Name: string;
  player2Name: string;
  player1FoldRate: number;
  player2FoldRate: number;
}

export function FoldBehaviorChart({
  player1Name,
  player2Name,
  player1FoldRate,
  player2FoldRate,
}: FoldBehaviorChartProps) {
  const chartData = [
    { name: player1Name, foldRate: player1FoldRate },
    { name: player2Name, foldRate: player2FoldRate },
  ];

  return (
    <div data-testid="fold-behavior-chart" style={{ marginBottom: '1.5rem' }}>
      <h3>Fold Behavior</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} layout="horizontal">
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} />
          <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
          <Legend />
          <Bar dataKey="foldRate" name="Fold Rate (%)" fill="#3b82f6" />
          <Bar dataKey="foldRate" name="Fold Rate (%)" fill="#ef4444" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
