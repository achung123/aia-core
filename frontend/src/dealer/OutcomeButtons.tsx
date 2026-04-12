import { useState } from 'react';
import type React from 'react';

export type OutcomeResult = 'won' | 'folded' | 'lost' | 'not_playing';
export type OutcomeStreet = 'preflop' | 'flop' | 'turn' | 'river';

export interface OutcomeButtonsProps {
  playerName: string;
  onSelect: (result: OutcomeResult, street: OutcomeStreet | null) => void;
  onCancel?: () => void;
  error?: string | null;
  submitting?: boolean;
}

export function OutcomeButtons({ playerName, onSelect, onCancel, error, submitting }: OutcomeButtonsProps) {
  const [selectedResult, setSelectedResult] = useState<OutcomeResult | null>(null);

  function handleStreetSelect(street: OutcomeStreet): void {
    onSelect(selectedResult!, street);
  }

  function handleNotPlaying(): void {
    onSelect('not_playing', null);
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.heading}>Outcome for {playerName}</h2>

      {!selectedResult && (
        <div style={styles.buttonGroup}>
          <button
            style={{ ...styles.button, backgroundColor: '#16a34a' }}
            disabled={submitting}
            onClick={() => setSelectedResult('won')}
          >
            Won
          </button>
          <button
            style={{ ...styles.button, backgroundColor: '#dc2626' }}
            disabled={submitting}
            onClick={() => setSelectedResult('folded')}
          >
            Folded
          </button>
          <button
            style={{ ...styles.button, backgroundColor: '#ea580c' }}
            disabled={submitting}
            onClick={() => setSelectedResult('lost')}
          >
            Lost
          </button>
          <button
            style={{ ...styles.button, backgroundColor: '#6b7280' }}
            disabled={submitting}
            onClick={handleNotPlaying}
          >
            Not Playing
          </button>
        </div>
      )}

      {selectedResult && (
        <div style={styles.buttonGroup}>
          <p style={styles.streetLabel}>When?</p>
          <button
            style={{ ...styles.button, backgroundColor: '#9333ea' }}
            disabled={submitting}
            onClick={() => handleStreetSelect('preflop')}
          >
            Pre-Flop
          </button>
          <button
            style={{ ...styles.button, backgroundColor: '#2563eb' }}
            disabled={submitting}
            onClick={() => handleStreetSelect('flop')}
          >
            Flop
          </button>
          <button
            style={{ ...styles.button, backgroundColor: '#7c3aed' }}
            disabled={submitting}
            onClick={() => handleStreetSelect('turn')}
          >
            Turn
          </button>
          <button
            style={{ ...styles.button, backgroundColor: '#0891b2' }}
            disabled={submitting}
            onClick={() => handleStreetSelect('river')}
          >
            River
          </button>
        </div>
      )}

      {error && <div style={styles.error}>{error}</div>}

      {onCancel && (
        <button style={styles.backButton} onClick={onCancel}>
          Back
        </button>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: '480px',
    margin: '0 auto',
    padding: '1rem',
    textAlign: 'center',
  },
  heading: {
    fontSize: '1.4rem',
    marginBottom: '1.5rem',
  },
  streetLabel: {
    fontSize: '1.1rem',
    fontWeight: '600',
    color: '#c084fc',
    margin: '0 0 0.25rem 0',
  },
  buttonGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  button: {
    padding: '1rem',
    minHeight: '56px',
    fontSize: '1.2rem',
    fontWeight: 'bold',
    color: '#fff',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
  },
  error: {
    marginTop: '1rem',
    padding: '0.75rem',
    background: 'rgba(239,68,68,0.15)',
    border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: '8px',
    color: '#f87171',
    fontSize: '0.9rem',
  },
  backButton: {
    marginTop: '1rem',
    padding: '0.75rem 1.5rem',
    fontSize: '1rem',
    background: '#1e1f2b',
    border: '1px solid #2e303a',
    borderRadius: '8px',
    cursor: 'pointer',
    color: '#e2e8f0',
  },
};
