import type React from 'react';

export interface StatCardProps {
  label: string;
  value: string | number | null;
  trend?: 'up' | 'down' | 'neutral';
}

const TREND_INDICATORS: Record<string, { symbol: string; color: string }> = {
  up: { symbol: '▲', color: '#22c55e' },
  down: { symbol: '▼', color: '#ef4444' },
  neutral: { symbol: '●', color: '#9ca3af' },
};

export function StatCard({ label, value, trend }: StatCardProps) {
  const isEmptyValue = value === null || value === undefined;
  const isZero = value === 0;
  const isMuted = isEmptyValue || isZero;
  const displayValue = isEmptyValue ? '—' : String(value);

  return (
    <div style={styles.container}>
      <span style={styles.label}>{label}</span>
      <span style={isMuted ? styles.valueMuted : styles.value}>{displayValue}</span>
      {trend && (
        <span style={{ ...styles.trend, color: TREND_INDICATORS[trend].color }}>
          {TREND_INDICATORS[trend].symbol}
        </span>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'inline-flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '12px 16px',
    background: '#1a1a1a',
    borderRadius: '8px',
    border: '1px solid #333',
    minWidth: '100px',
    flex: '1 1 auto',
  },
  label: {
    fontSize: '0.75rem',
    color: '#9ca3af',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    marginBottom: '4px',
  },
  value: {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: '#fff',
    lineHeight: 1.2,
  },
  valueMuted: {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: '#9ca3af',
    lineHeight: 1.2,
  },
  trend: {
    fontSize: '0.7rem',
    marginTop: '4px',
  },
};
