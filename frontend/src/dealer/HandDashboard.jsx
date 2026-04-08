import { h } from 'preact';

export function HandDashboard({ gameDate, players, handCount, onStartHand }) {
  const buttonText = handCount === 0 ? 'Enter First Hand' : 'Add New Hand';

  return (
    <div style={styles.container}>
      <h2 style={styles.heading}>Hand Dashboard</h2>

      <div style={styles.info}>
        <span style={styles.label}>Date:</span>{' '}
        <span>{gameDate}</span>
      </div>

      <div style={styles.info}>
        <span style={styles.label}>Players:</span>
        <div style={styles.chipContainer}>
          {players.map(name => (
            <span key={name} style={styles.chip}>{name}</span>
          ))}
        </div>
      </div>

      <div style={styles.counter}>
        Hands recorded: {handCount}
      </div>

      <button style={styles.button} onClick={onStartHand}>
        {buttonText}
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
  info: {
    marginBottom: '0.75rem',
    fontSize: '1rem',
  },
  label: {
    fontWeight: 'bold',
  },
  chipContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.4rem',
    marginTop: '0.25rem',
  },
  chip: {
    display: 'inline-block',
    padding: '0.25rem 0.6rem',
    borderRadius: '12px',
    background: '#e0e7ff',
    fontSize: '0.9rem',
  },
  counter: {
    fontSize: '1.1rem',
    fontWeight: 'bold',
    margin: '1rem 0',
  },
  button: {
    width: '100%',
    padding: '0.75rem',
    minHeight: '48px',
    fontSize: '1.1rem',
    fontWeight: 'bold',
    border: 'none',
    borderRadius: '8px',
    background: '#4f46e5',
    color: '#fff',
    cursor: 'pointer',
  },
};
