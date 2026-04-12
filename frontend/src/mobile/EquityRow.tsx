import type React from 'react';

export interface EquityRowProps {
  equityMap: Record<string, number> | null;
  loading?: boolean;
}

const styles: Record<string, React.CSSProperties> = {
  row: {
    display: 'flex',
    gap: '6px',
    padding: '8px 12px',
    background: '#1a1a2e',
    overflowX: 'auto',
    fontFamily: 'system-ui, sans-serif',
  },
  card: {
    minWidth: '80px',
    padding: '8px 12px',
    borderRadius: '8px',
    background: '#1e1b4b',
    border: '1px solid #312e81',
    textAlign: 'center',
    flexShrink: 0,
  },
  name: {
    color: '#c7d2fe',
    fontSize: '12px',
    fontWeight: 600,
    marginBottom: '4px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  equity: {
    fontSize: '16px',
    fontWeight: 700,
    fontFamily: 'system-ui, sans-serif',
  },
};

function equityColor(eq: number): string {
  if (eq >= 0.5) return '#4ade80'; // green
  if (eq >= 0.25) return '#facc15'; // yellow
  return '#f87171'; // red
}

export function EquityRow({ equityMap, loading }: EquityRowProps): React.ReactElement | null {
  if (loading) {
    return (
      <div data-testid="equity-row" style={styles.row}>
        <div data-testid="equity-loading" style={{ color: '#aaa', padding: '8px', textAlign: 'center', width: '100%', fontSize: '14px' }}>
          Loading equity…
        </div>
      </div>
    );
  }

  if (!equityMap || Object.keys(equityMap).length === 0) return null;

  const entries = Object.entries(equityMap);

  return (
    <div data-testid="equity-row" style={styles.row}>
      {entries.map(([name, eq]) => (
        <div key={name} data-testid="equity-card" style={styles.card}>
          <div style={styles.name}>{name}</div>
          <div style={{ ...styles.equity, color: equityColor(eq) }}>
            {(eq * 100).toFixed(1)}%
          </div>
        </div>
      ))}
    </div>
  );
}
