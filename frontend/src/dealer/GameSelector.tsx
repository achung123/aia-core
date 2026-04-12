import { useState, useEffect } from 'react';
import { fetchSessions } from '../api/client.ts';
import type { GameSessionListItem } from '../api/types.ts';

export interface GameSelectorProps {
  onSelectGame: (gameId: number) => void;
  onNewGame: () => void;
}

export function GameSelector({ onSelectGame, onNewGame }: GameSelectorProps) {
  const [sessions, setSessions] = useState<GameSessionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSessions()
      .then(data => {
        const sorted = [...data].sort((a, b) => b.game_id - a.game_id);
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
              <div style={styles.cardDate}>{s.game_date} <span style={styles.gameId}>#{s.game_id}</span></div>
              <div data-testid="card-details" style={styles.cardDetails}>
                <span style={styles.badge}>
                  {isActive ? '● Active' : 'Complete'}
                </span>
                <span>{s.player_count} players</span>
                <span>{s.hand_count} hands</span>
              </div>
              {s.winners && s.winners.length > 0 && (
                <div style={styles.winnersRow}>
                  🏆 {s.winners.join(', ')}
                </div>
              )}
            </button>
          );
        })}
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
  gameId: {
    fontWeight: 'normal',
    fontSize: '0.85rem',
    color: '#6b7280',
  },
  cardDetails: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '1rem',
    fontSize: '0.9rem',
  },
  badge: {
    fontWeight: 600,
  },
  winnersRow: {
    fontSize: '0.85rem',
    fontWeight: 600,
    color: '#16a34a',
  },
};
