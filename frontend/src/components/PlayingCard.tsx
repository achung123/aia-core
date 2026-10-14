import type React from 'react';
import { theme } from '../theme';

const SUIT_MAP: Record<string, string> = { h: '♥', s: '♠', d: '♦', c: '♣' };
const SUIT_COLORS: Record<string, string> = { h: '#dc2626', s: theme.raised, d: '#dc2626', c: theme.raised };

function formatCard(code: string): { rank: string; suitSymbol: string; suitCode: string } {
  const suitCode = code.slice(-1).toLowerCase();
  const rank = code.slice(0, -1).toUpperCase();
  const suitSymbol = SUIT_MAP[suitCode] || suitCode;
  return { rank, suitSymbol, suitCode };
}

export interface PlayingCardProps {
  code: string | null;
  onClick?: () => void;
  testId?: string;
}

export function PlayingCard({ code, onClick, testId }: PlayingCardProps) {
  if (!code) {
    return (
      <button data-testid={testId} style={styles.emptyCard} onClick={onClick}>
        —
      </button>
    );
  }

  const { rank, suitSymbol, suitCode } = formatCard(code);
  const color = SUIT_COLORS[suitCode] || theme.raised;

  return (
    <button data-testid={testId} style={{ ...styles.card, color }} onClick={onClick}>
      <span style={styles.rank}>{rank}</span>
      <span style={styles.suit}>{suitSymbol}</span>
    </button>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    display: 'inline-flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '48px',
    minHeight: '64px',
    padding: '0.3rem 0.5rem',
    border: `2px solid ${theme.accentSoft}`,
    borderRadius: '8px',
    background: '#ffffff',
    cursor: 'pointer',
    fontWeight: 600,
    boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
  },
  rank: {
    fontSize: '1.1rem',
    lineHeight: 1,
  },
  suit: {
    fontSize: '1rem',
    lineHeight: 1,
    marginTop: '0.1rem',
  },
  emptyCard: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '48px',
    minHeight: '64px',
    padding: '0.3rem 0.5rem',
    border: `2px dashed ${theme.faint}`,
    borderRadius: '8px',
    background: 'transparent',
    color: theme.faint,
    cursor: 'pointer',
    fontSize: '1.2rem',
    fontWeight: 600,
  },
};
