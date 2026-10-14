import type React from 'react';
import { isValidCard } from './cardUtils';
import { theme } from '../theme';

const SUIT_MAP: Record<string, string> = { H: '♥', D: '♦', C: '♣', S: '♠' };
const SUIT_COLORS: Record<string, string> = { H: '#dc2626', D: '#dc2626', C: theme.raised, S: theme.raised };

export interface CardIconProps {
  card: string | null | undefined;
}

export function CardIcon({ card }: CardIconProps) {
  if (card == null) return null;

  if (!card || !isValidCard(card)) {
    return <span style={styles.placeholder}>?</span>;
  }

  const upper = card.trim().toUpperCase();
  const suitCode = upper.slice(-1);
  const rank = upper.slice(0, -1);
  const suitSymbol = SUIT_MAP[suitCode] || suitCode;
  const color = SUIT_COLORS[suitCode] || theme.raised;

  return (
    <span style={{ ...styles.card, color }}>
      {rank}{suitSymbol}
    </span>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.85rem',
    fontWeight: 600,
    padding: '0.1rem 0.3rem',
    borderRadius: '4px',
    border: `1px solid ${theme.text}`,
    background: '#ffffff',
    lineHeight: 1,
  },
  placeholder: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.85rem',
    fontWeight: 600,
    padding: '0.1rem 0.3rem',
    borderRadius: '4px',
    border: `1px dashed ${theme.muted}`,
    background: theme.text,
    color: theme.muted,
    lineHeight: 1,
  },
};
