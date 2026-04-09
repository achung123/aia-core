export function OutcomeButtons({ playerName, onSelect, onCancel, error, submitting }) {
  return (
    <div style={styles.container}>
      <h2 style={styles.heading}>Outcome for {playerName}</h2>

      <div style={styles.buttonGroup}>
        <button
          style={{ ...styles.button, backgroundColor: '#16a34a' }}
          disabled={submitting}
          onClick={() => onSelect('won')}
        >
          Won
        </button>
        <button
          style={{ ...styles.button, backgroundColor: '#dc2626' }}
          disabled={submitting}
          onClick={() => onSelect('folded')}
        >
          Folded
        </button>
        <button
          style={{ ...styles.button, backgroundColor: '#ea580c' }}
          disabled={submitting}
          onClick={() => onSelect('lost')}
        >
          Lost
        </button>
      </div>

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
