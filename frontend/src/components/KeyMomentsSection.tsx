import type React from 'react';
import type { GameHighlight } from '../api/types';

export interface KeyMomentsSectionProps {
  highlights: GameHighlight[];
  onHighlightClick?: (handNumber: number) => void;
}

const typeIcons: Record<string, string> = {
  most_action: '🔥',
  river_showdown: '🃏',
  streak_start: '🏆',
};

function getIcon(highlightType: string): string {
  return typeIcons[highlightType] ?? '⭐';
}

export function KeyMomentsSection({ highlights, onHighlightClick }: KeyMomentsSectionProps) {
  if (highlights.length === 0) {
    return null;
  }

  return (
    <section data-testid="key-moments-section" style={{ marginBottom: '1.5rem' }}>
      <h2>Key Moments</h2>
      <div data-testid="key-moments-chips" style={styles.chipContainer}>
        {highlights.slice(0, 5).map((h, i) => (
          <button
            key={i}
            data-testid={`highlight-chip-${i}`}
            onClick={() => onHighlightClick?.(h.hand_number)}
            style={styles.chip}
            type="button"
          >
            <span style={styles.icon}>{getIcon(h.highlight_type)}</span>
            <span style={styles.description}>{h.description}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  chipContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.5rem',
  },
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    padding: '0.4rem 0.75rem',
    borderRadius: 16,
    border: '1px solid #e2e8f0',
    background: '#f8fafc',
    cursor: 'pointer',
    fontSize: '0.85rem',
    lineHeight: 1.3,
    transition: 'background 0.15s, border-color 0.15s',
  },
  icon: {
    fontSize: '1rem',
    flexShrink: 0,
  },
  description: {
    color: '#334155',
  },
};
