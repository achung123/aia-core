export function PlayerGrid({ players, communityRecorded, onTileSelect, allRecorded, submitting, submitError, onSubmitHand }) {
  return (
    <div style={styles.container}>
      <h2 style={styles.heading}>Select a Player</h2>
      <div style={styles.grid}>
        <button
          style={styles.tile}
          onClick={() => onTileSelect('community')}
        >
          <span style={styles.tileName}>Table</span>
          {communityRecorded && <span style={styles.check}>✅</span>}
        </button>

        {players.map((p) => (
          <button
            key={p.name}
            style={styles.tile}
            onClick={() => onTileSelect(p.name)}
          >
            <span style={styles.tileName}>{p.name}</span>
            {p.recorded && <span style={styles.check}>✅</span>}
          </button>
        ))}
      </div>

      {submitError && <div style={styles.error}>{submitError}</div>}

      <button
        style={{
          ...styles.submitButton,
          ...((!allRecorded || submitting) ? styles.submitButtonDisabled : {}),
        }}
        disabled={!allRecorded || submitting}
        onClick={onSubmitHand}
      >
        {submitting ? 'Submitting…' : 'Submit Hand'}
      </button>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '480px',
    margin: '0 auto',
    padding: '1rem',
  },
  heading: {
    fontSize: '1.4rem',
    marginBottom: '1rem',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '0.75rem',
  },
  tile: {
    position: 'relative',
    minHeight: '80px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.1rem',
    fontWeight: 'bold',
    border: '2px solid #c7d2fe',
    borderRadius: '12px',
    background: '#eef2ff',
    color: '#312e81',
    cursor: 'pointer',
    padding: '1rem',
    WebkitTapHighlightColor: 'transparent',
  },
  tileName: {
    textAlign: 'center',
  },
  check: {
    position: 'absolute',
    top: '6px',
    right: '6px',
    fontSize: '1.2rem',
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
  submitButton: {
    marginTop: '1.5rem',
    width: '100%',
    padding: '0.875rem',
    minHeight: '48px',
    fontSize: '1.1rem',
    fontWeight: 'bold',
    border: 'none',
    borderRadius: '12px',
    background: '#4f46e5',
    color: '#fff',
    cursor: 'pointer',
  },
  submitButtonDisabled: {
    background: '#a5b4fc',
    cursor: 'not-allowed',
  },
};
