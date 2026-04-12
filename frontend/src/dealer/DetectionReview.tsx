import { useState } from 'react';
import { CardPicker } from './CardPicker.tsx';
import type { CardDetectionEntry } from '../api/types.ts';

const SUIT_MAP: Record<string, string> = { h: '♥', s: '♠', d: '♦', c: '♣' };
const SUIT_COLORS: Record<string, string> = { '♥': '#dc2626', '♠': '#1e293b', '♦': '#dc2626', '♣': '#1e293b' };

function formatCard(detectedValue: string): { rank: string; suit: string } {
  const suit = detectedValue.slice(-1).toLowerCase();
  const rank = detectedValue.slice(0, -1).toUpperCase();
  const symbol = SUIT_MAP[suit] || suit;
  return { rank, suit: symbol };
}

const POSITION_LABELS_FLOP = ['Flop', 'Flop', 'Flop'];

export type DetectionMode = 'flop' | 'turn' | 'river' | 'community' | 'player';

interface ModeConfig {
  maxCards: number;
  expectedMin: number;
  label: string | null;
}

const MODE_CONFIG: Record<DetectionMode, ModeConfig> = {
  flop: { maxCards: 3, expectedMin: 3, label: 'Flop (3 cards)' },
  turn: { maxCards: 1, expectedMin: 1, label: 'Turn (1 card)' },
  river: { maxCards: 1, expectedMin: 1, label: 'River (1 card)' },
  community: { maxCards: 5, expectedMin: 3, label: 'Community Cards' },
  player: { maxCards: 2, expectedMin: 2, label: null },
};

export interface DetectionReviewProps {
  detections: CardDetectionEntry[] | null;
  imageUrl: string | null;
  mode: DetectionMode;
  targetName: string;
  onConfirm: (targetName: string, cardValues: string[]) => void;
  onRetake: () => void;
}

export function DetectionReview({ detections, imageUrl, mode, targetName, onConfirm, onRetake }: DetectionReviewProps) {
  const allCards = detections || [];
  const config = MODE_CONFIG[mode] || MODE_CONFIG.player;
  const maxCards = config.maxCards;

  // No more bbox sorting — each street gets its own inference run
  const cards = allCards.slice(0, maxCards);

  const expectedMin = config.expectedMin;
  const countOk = cards.length >= expectedMin;

  const [corrections, setCorrections] = useState<Record<number, string>>({});
  const [pickerIndex, setPickerIndex] = useState<number | null>(null);

  function getCorrectedValue(index: number): string | undefined {
    return corrections[index] || cards[index]?.detected_value;
  }

  function handlePickerSelect(cardCode: string): void {
    if (pickerIndex !== null) {
      setCorrections((prev) => ({ ...prev, [pickerIndex]: cardCode }));
      setPickerIndex(null);
    }
  }

  function handleConfirm(): void {
    const cardValues = cards.map((d, i) => corrections[i] || d.detected_value);
    onConfirm(targetName, cardValues);
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.heading}>Review Detection</h2>
      <p style={styles.target}>{config.label || targetName}</p>

      {imageUrl && <img src={imageUrl} alt="Captured" style={styles.image} />}

      {!countOk && (
        <p style={styles.warning}>
          Expected {expectedMin} card{expectedMin > 1 ? 's' : ''}, detected {cards.length}
        </p>
      )}

      <div style={styles.cardRow}>
        {cards.map((d, i) => {
          const value = getCorrectedValue(i);
          const { rank, suit } = formatCard(value ?? '');
          const conf = Math.round(d.confidence * 100);
          const color = SUIT_COLORS[suit] || '#1e293b';
          const isCorrected = i in corrections;
          const labelStyle = isCorrected
            ? { ...styles.cardLabel, borderColor: '#ea580c' }
            : styles.cardLabel;
          const positionLabel = mode === 'flop' ? POSITION_LABELS_FLOP[i] : (mode === 'turn' ? 'Turn' : (mode === 'river' ? 'River' : null));
          return (
            <div key={i} style={labelStyle} onClick={() => setPickerIndex(i)}>
              {positionLabel && (
                <span data-testid={`card-position-${i}`} style={styles.positionLabel}>{positionLabel}</span>
              )}
              <span style={{ ...styles.cardText, color }}>{rank}{suit}</span>
              <span style={styles.confidence}>{isCorrected ? 'corrected' : `${conf}%`}</span>
            </div>
          );
        })}
      </div>

      {pickerIndex !== null && (
        <CardPicker
          onSelect={handlePickerSelect}
          onClose={() => setPickerIndex(null)}
        />
      )}

      <div style={styles.buttonRow}>
        <button style={styles.retakeButton} onClick={onRetake}>Retake</button>
        <button
          style={cards.length === 0 ? { ...styles.confirmButton, opacity: 0.5 } : styles.confirmButton}
          onClick={handleConfirm}
          disabled={cards.length === 0}
        >
          Confirm
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: '480px',
    margin: '0 auto',
    padding: '1rem',
  },
  heading: {
    fontSize: '1.4rem',
    marginBottom: '0.25rem',
  },
  target: {
    fontSize: '1rem',
    color: '#6b7280',
    marginBottom: '1rem',
  },
  image: {
    width: '100%',
    maxHeight: '300px',
    objectFit: 'contain' as const,
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    marginBottom: '1rem',
  },
  warning: {
    color: '#d97706',
    fontWeight: 'bold',
    fontSize: '0.9rem',
    marginBottom: '0.75rem',
  },
  cardRow: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '0.75rem',
    justifyContent: 'center',
    marginBottom: '1.5rem',
  },
  cardLabel: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    padding: '0.75rem 1rem',
    border: '2px solid #c7d2fe',
    borderRadius: '10px',
    background: '#f8fafc',
    minWidth: '64px',
    minHeight: '48px',
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
  },
  cardText: {
    fontSize: '1.5rem',
    fontWeight: 'bold',
    lineHeight: 1,
  },
  confidence: {
    fontSize: '0.75rem',
    color: '#6b7280',
    marginTop: '0.25rem',
  },
  positionLabel: {
    fontSize: '0.65rem',
    fontWeight: '700',
    color: '#4f46e5',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    marginBottom: '0.15rem',
  },
  buttonRow: {
    display: 'flex',
    gap: '0.75rem',
    justifyContent: 'center',
  },
  retakeButton: {
    padding: '0.75rem 1.5rem',
    minHeight: '48px',
    minWidth: '48px',
    fontSize: '1rem',
    fontWeight: 'bold',
    border: '2px solid #d1d5db',
    borderRadius: '8px',
    background: '#fff',
    color: '#374151',
    cursor: 'pointer',
  },
  confirmButton: {
    padding: '0.75rem 1.5rem',
    minHeight: '48px',
    minWidth: '48px',
    fontSize: '1rem',
    fontWeight: 'bold',
    border: 'none',
    borderRadius: '8px',
    background: '#4f46e5',
    color: '#fff',
    cursor: 'pointer',
  },
};
