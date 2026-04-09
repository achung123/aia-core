import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { fetchSessions } from '../api/client.js';

export function GameSelector({ onSelectGame, onNewGame }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchSessions()
      .then(data => {
        const sorted = [...data].sort((a, b) =>
          b.game_date.localeCompare(a.game_date)
        );
        setSessions(sorted);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={styles.container}>
      <h2 style={styles.heading}>Games</h2>

      <button
        data-testid="new-game-btn"
        style={styles.newGameButton}
        onClick={onNewGame}
      >
        + New Game
      </button>

      {loading && <p style={styles.loading}>Loading games…</p>}
      {error && <p style={styles.error}>{error}</p>}

      {!loading && !error && sessions.length === 0 && (
        <p style={styles.empty}>No games yet. Start a new one!</p>
      )}

      <div style={styles.list}>
        {sessions.map(s => {
          const isActive = s.status === 'active';
          return (
            <button
              key={s.game_id}
              data-testid="game-card"
              style={{
                ...styles.card,
                ...(isActive ? styles.cardActive : styles.cardComplete),
              }}
              onClick={() => onSelectGame(s.game_id)}
            >
              <div style={styles.cardDate}>{s.game_date}</div>
              <div style={styles.cardDetails}>
                <span style={styles.badge}>
                  {isActive ? '● Active' : 'Complete'}
                </span>
                <span>{s.player_count} players</span>
                <span>{s.hand_count} hands</span>
              </div>
            </button>
          );
        })}
      </div>
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
    marginBottom: '0.75rem',
  },
  newGameButton: {
    width: '100%',
    padding: '14px',
    minHeight: '48px',
    fontSize: '1.1rem',
    fontWeight: 'bold',
    border: '2px dashed #6366f1',
    borderRadius: '12px',
    background: '#eef2ff',
    color: '#4338ca',
    cursor: 'pointer',
    marginBottom: '1rem',
    WebkitTapHighlightColor: 'transparent',
  },
  loading: {
    textAlign: 'center',
    color: '#6b7280',
    padding: '2rem 0',
  },
  error: {
    textAlign: 'center',
    color: '#dc2626',
    padding: '1rem 0',
  },
  empty: {
    textAlign: 'center',
    color: '#9ca3af',
    padding: '2rem 0',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
    padding: '1rem',
    borderRadius: '12px',
    border: '2px solid',
    cursor: 'pointer',
    textAlign: 'left',
    background: 'none',
    width: '100%',
    fontSize: '1rem',
    WebkitTapHighlightColor: 'transparent',
  },
  cardActive: {
    borderColor: 'indigo',
    background: '#eef2ff',
    color: '#312e81',
  },
  cardComplete: {
    borderColor: '#d1d5db',
    background: '#f9fafb',
    color: '#6b7280',
  },
  cardDate: {
    fontWeight: 'bold',
    fontSize: '1.1rem',
  },
  cardDetails: {
    display: 'flex',
    gap: '1rem',
    fontSize: '0.9rem',
  },
  badge: {
    fontWeight: 600,
  },
};
