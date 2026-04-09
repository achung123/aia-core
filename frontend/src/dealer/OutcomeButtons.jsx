import { useState } from 'preact/hooks';

export function OutcomeButtons({ playerName, onSelect, onCancel, error, submitting }) {
  const [selectedResult, setSelectedResult] = useState(null);

  function handleStreetSelect(street) {
    onSelect(selectedResult, street);
  }

  function handleNotPlaying() {
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

const styles = {
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
    color: '#374151',
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
    background: '#fef2f2',
    border: '1px solid #fca5a5',
    borderRadius: '8px',
    color: '#991b1b',
    fontSize: '0.9rem',
  },
  backButton: {
    marginTop: '1rem',
    padding: '0.75rem 1.5rem',
    fontSize: '1rem',
    background: '#e5e7eb',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
  },
};
