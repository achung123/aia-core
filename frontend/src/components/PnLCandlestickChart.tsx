import type React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
  Cell,
} from 'recharts';
import type { PlayerSessionTrend } from '../api/types';

export interface PnLCandlestickChartProps {
  data: PlayerSessionTrend[];
}

interface CandlePoint {
  date: string;
  open: number;
  close: number;
  range: [number, number];
  session_pl: number;
}

export function buildCandles(data: PlayerSessionTrend[]): CandlePoint[] {
  let cumulative = 0;
  return data.map((d) => {
    const open = cumulative;
    const close = cumulative + d.profit_loss;
    cumulative = close;
    return {
      date: d.game_date,
      open,
      close,
      range: [Math.min(open, close), Math.max(open, close)],
      session_pl: d.profit_loss,
    };
  });
}

/* Custom bar shape that renders a candlestick body */
function CandleShape(props: Record<string, unknown>) {
  const { x, y, width, height, payload } = props as {
    x: number;
    y: number;
    width: number;
    height: number;
    payload: CandlePoint;
  };
  const color = payload.session_pl >= 0 ? '#22c55e' : '#ef4444';
  const h = Math.max(Math.abs(height), 2);
  return <rect x={x} y={y} width={width} height={h} fill={color} rx={2} />;
}

interface CandleTooltipProps {
  active?: boolean;
  payload?: { payload: CandlePoint }[];
}

function CandleTooltip({ active, payload }: CandleTooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const sign = d.session_pl >= 0 ? '+' : '-';
  return (
    <div style={tooltipStyle}>
      <p style={{ margin: 0, fontWeight: 600 }}>{d.date}</p>
      <p style={{ margin: 0 }}>
        Session P&L: {sign}${Math.abs(d.session_pl).toFixed(2)}
      </p>
      <p style={{ margin: 0 }}>
        Cumulative: {d.close < 0 ? '-' : ''}${Math.abs(d.close).toFixed(2)}
      </p>
    </div>
  );
}

const tooltipStyle: React.CSSProperties = {
  background: '#1f2937',
  color: '#f9fafb',
  padding: '0.5rem 0.75rem',
  borderRadius: 6,
  fontSize: '0.85rem',
  border: '1px solid #374151',
};

export function PnLCandlestickChart({ data }: PnLCandlestickChartProps) {
  if (!data.length) {
    return (
      <div data-testid="pnl-candlestick-chart" style={{ color: '#6b7280', textAlign: 'center', padding: '1rem 0' }}>
        No session data
      </div>
    );
  }

  const candles = buildCandles(data);

  return (
    <div data-testid="pnl-candlestick-chart">
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={candles} margin={{ top: 10, right: 10, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2e303a" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: '#2e303a' }}
          />
          <YAxis
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => `$${v}`}
          />
          <Tooltip content={<CandleTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          <ReferenceLine y={0} stroke="#4b5563" strokeDasharray="3 3" />
          <Bar dataKey="range" shape={<CandleShape />} isAnimationActive={false}>
            {candles.map((c, i) => (
              <Cell key={i} fill={c.session_pl >= 0 ? '#22c55e' : '#ef4444'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
