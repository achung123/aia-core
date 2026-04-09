const statusColors = {
  playing: '#ffffff',
  won: '#bbf7d0',
  folded: '#fecaca',
  lost: '#fed7aa',
};

export function PlayerGrid({ players, communityRecorded, onTileSelect, onDirectOutcome, canFinish, onFinishHand }) {
  return (
    <div style={styles.container}>
      <h2 style={styles.heading}>Select a Player</h2>
      <div style={styles.grid}>
        <button
          data-testid="table-tile"
          style={styles.tile}
          onClick={() => onTileSelect('community')}
        >
          <span style={styles.tileName}>Table</span>
          {communityRecorded && <span style={styles.check}>✅</span>}
        </button>

        {players.map((p) => (
          <div key={p.name} style={styles.tileWrapper}>
            <button
              data-testid={`player-tile-${p.name}`}
              style={{ ...styles.tile, backgroundColor: statusColors[p.status] || '#ffffff' }}
              onClick={() => onTileSelect(p.name)}
            >
              <span style={styles.tileName}>{p.name}</span>
              <span style={styles.statusText}>{p.status}</span>
              {p.recorded && <span style={styles.check}>✅</span>}
            </button>
            {onDirectOutcome && p.status === 'playing' && (
              <button
                data-testid={`outcome-btn-${p.name}`}
                style={styles.outcomeButton}
                onClick={() => onDirectOutcome(p.name)}
              >
                📋
              </button>
            )}
          </div>
        ))}
      </div>

      {canFinish && (
        <button
          style={styles.finishButton}
          onClick={onFinishHand}
        >
          Finish Hand
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
    flexDirection: 'column',
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
  statusText: {
    fontSize: '0.8rem',
    fontWeight: 'normal',
    marginTop: '0.25rem',
    color: '#555',
  },
  check: {
    position: 'absolute',
    top: '6px',
    right: '6px',
    fontSize: '1.2rem',
  },
  tileWrapper: {
    position: 'relative',
  },
  outcomeButton: {
    position: 'absolute',
    bottom: '4px',
    right: '4px',
    width: '28px',
    height: '28px',
    fontSize: '0.9rem',
    border: 'none',
    borderRadius: '6px',
    background: '#e0e7ff',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    zIndex: 1,
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
  finishButton: {
    marginTop: '1.5rem',
    width: '100%',
    padding: '0.875rem',
    minHeight: '48px',
    fontSize: '1.1rem',
    fontWeight: 'bold',
    border: 'none',
    borderRadius: '12px',
    background: '#16a34a',
    color: '#fff',
    cursor: 'pointer',
  },
};
