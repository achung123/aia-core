import type React from 'react';

export interface AwardCardProps {
  emoji: string;
  awardName: string;
  winnerName: string;
  statValue: string | number | null;
  statLabel: string;
}

const DOLLAR_LABELS = new Set(['profit', 'loss']);

function fmtValue(value: string | number | null, label: string): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'number' && DOLLAR_LABELS.has(label)) {
    return value < 0
      ? `-$${Math.abs(value).toFixed(2)}`
      : `$${value.toFixed(2)}`;
  }
  return String(value);
}

export function AwardCard({ emoji, awardName, winnerName, statValue, statLabel }: AwardCardProps) {
  const isEmptyValue = statValue === null || statValue === undefined;
  const isZero = statValue === 0;
  const isMuted = isEmptyValue || isZero;
  const displayValue = fmtValue(statValue, statLabel);

  return (
    <div style={styles.container}>
      <span style={styles.emoji}>{emoji}</span>
      <span style={styles.awardName}>{awardName}</span>
      <span style={styles.winnerName}>{winnerName}</span>
      <div style={styles.statRow}>
        <span style={isMuted ? styles.statValueMuted : styles.statValue}>{displayValue}</span>
        <span style={styles.statLabel}>{statLabel}</span>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px 12px',
    background: '#1a1a1a',
    borderRadius: '12px',
    border: '1px solid #333',
    textAlign: 'center',
    height: '100%',
    boxSizing: 'border-box',
  },
  emoji: {
    fontSize: '2rem',
    lineHeight: 1.2,
    marginBottom: '8px',
  },
  awardName: {
    fontSize: '0.85rem',
    fontWeight: 600,
    color: '#fff',
    marginBottom: '4px',
  },
  winnerName: {
    fontSize: '0.8rem',
    color: '#facc15',
    fontWeight: 500,
    marginBottom: '8px',
  },
  statRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '4px',
  },
  statValue: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#fff',
  },
  statValueMuted: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#9ca3af',
  },
  statLabel: {
    fontSize: '0.7rem',
    color: '#9ca3af',
  },
};
