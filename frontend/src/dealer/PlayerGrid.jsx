const statusColors = {
  playing: '#ffffff',
  won: '#bbf7d0',
  folded: '#fecaca',
  lost: '#fed7aa',
  not_playing: '#e5e7eb',
  pending: '#fef08a',
  joined: '#bbf7d0',
  handed_back: '#fef08a',
};

function formatStatus(status, outcomeStreet) {
  if (status === 'not_playing') return 'not playing';
  if (status === 'handed_back') return 'handed back';
  if (outcomeStreet) return `${status} on ${outcomeStreet}`;
  return status;
}

export function PlayerGrid({ players, communityRecorded, onTileSelect, onDirectOutcome, canFinish, onFinishHand, onBack }) {
  return (
    <div style={styles.container}>
      <h2 style={styles.heading}>Select a Player</h2>
      {onBack && (
        <button data-testid="back-btn" onClick={onBack} style={styles.backButton}>
          Back to Hands
        </button>
      )}

      <button
        data-testid="table-tile"
        style={styles.tableTile}
        onClick={() => onTileSelect('community')}
      >
        <span style={styles.tileName}>Table</span>
        {communityRecorded && <span style={styles.check}>✅</span>}
      </button>

      <div data-testid="player-list" style={styles.playerList}>
        {players.map((p) => (
          <div
            key={p.name}
            data-testid={`player-row-${p.name}`}
            style={{ ...styles.playerRow, backgroundColor: statusColors[p.status] || '#ffffff' }}
          >
            <button
              data-testid={`player-tile-${p.name}`}
              style={styles.playerNameCol}
              onClick={() => onTileSelect(p.name)}
            >
              <span style={styles.tileName}>{p.name}</span>
              {p.recorded && <span style={styles.inlineCheck}>✅</span>}
            </button>
            <div style={styles.statusCol}>
              <span style={styles.statusText}>{formatStatus(p.status, p.outcomeStreet)}</span>
              {onDirectOutcome && (
                <button
                  data-testid={`outcome-btn-${p.name}`}
                  style={styles.outcomeButton}
                  onClick={() => onDirectOutcome(p.name)}
                >
                  📋
                </button>
              )}
            </div>
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
  backButton: {
    marginBottom: '0.75rem',
    padding: '0.5rem 1rem',
    fontSize: '0.95rem',
    cursor: 'pointer',
  },
  tableTile: {
    position: 'relative',
    width: '100%',
    minHeight: '60px',
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
    padding: '0.75rem 1rem',
    marginBottom: '0.75rem',
    WebkitTapHighlightColor: 'transparent',
  },
  playerList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  playerRow: {
    display: 'flex',
    alignItems: 'center',
    border: '2px solid #c7d2fe',
    borderRadius: '12px',
    overflow: 'hidden',
    minHeight: '56px',
  },
  playerNameCol: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1rem',
    fontSize: '1.1rem',
    fontWeight: 'bold',
    border: 'none',
    background: 'transparent',
    color: '#312e81',
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
    minHeight: '48px',
  },
  statusCol: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 1rem',
    minWidth: '80px',
    justifyContent: 'flex-end',
  },
  tileName: {
    textAlign: 'center',
  },
  statusText: {
    fontSize: '0.85rem',
    fontWeight: '600',
    color: '#555',
    textTransform: 'capitalize',
  },
  inlineCheck: {
    fontSize: '1rem',
  },
  check: {
    position: 'absolute',
    top: '6px',
    right: '6px',
    fontSize: '1.2rem',
  },
  outcomeButton: {
    width: '32px',
    height: '32px',
    fontSize: '0.9rem',
    border: 'none',
    borderRadius: '6px',
    background: '#e0e7ff',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    WebkitTapHighlightColor: 'transparent',
  },
  finishButton: {
    width: '100%',
    padding: '0.75rem',
    minHeight: '48px',
    fontSize: '1.1rem',
    fontWeight: 'bold',
    border: 'none',
    borderRadius: '8px',
    background: '#16a34a',
    color: '#fff',
    cursor: 'pointer',
    marginTop: '1rem',
  },
};
