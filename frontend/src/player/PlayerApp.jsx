import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { fetchSessions, fetchGame } from '../api/client.js';

function parseGameIdFromHash() {
  const hash = window.location.hash || '';
  const match = hash.match(/[?&]game=(\d+)/);
  return match ? Number(match[1]) : null;
}

export function PlayerApp() {
  const [step, setStep] = useState('gameSelect');
  const [gameId, setGameId] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [players, setPlayers] = useState([]);
  const [playersLoading, setPlayersLoading] = useState(false);
  const [playerName, setPlayerName] = useState(null);

  function loadPlayers(id) {
    setPlayersLoading(true);
    fetchGame(id)
      .then(data => setPlayers(data.player_names || []))
      .catch(err => setError(err.message))
      .finally(() => setPlayersLoading(false));
  }

  useEffect(() => {
    const urlGameId = parseGameIdFromHash();

    fetchSessions()
      .then(data => {
        const active = data.filter(s => s.status === 'active');
        const sorted = [...active].sort((a, b) => b.game_id - a.game_id);
        setSessions(sorted);

        if (urlGameId !== null) {
          const found = sorted.find(s => s.game_id === urlGameId);
          if (found) {
            setGameId(urlGameId);
            setStep('namePick');
            loadPlayers(urlGameId);
          } else {
            setError(`Game #${urlGameId} not found or not active`);
          }
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  function handleSelectGame(id) {
    setGameId(id);
    setStep('namePick');
    loadPlayers(id);
  }

  function handleSelectPlayer(name) {
    setPlayerName(name);
    setStep('playing');
  }

  function handleChangePlayer() {
    setPlayerName(null);
    setStep('namePick');
  }

  if (step === 'playing') {
    return (
      <div style={styles.container}>
        <h1>Player Mode</h1>
        <p>Game #{gameId}</p>
        <h2 style={styles.heading}>{playerName}</h2>
        <p>Waiting for hand…</p>
        <button
          data-testid="change-player-btn"
          style={styles.changeBtn}
          onClick={handleChangePlayer}
        >
          Change Player
        </button>
      </div>
    );
  }

  if (step === 'namePick') {
    return (
      <div style={styles.container}>
        <h1>Player Mode</h1>
        <p>Game #{gameId}</p>
        <h2 style={styles.heading}>Select Your Name</h2>

        {playersLoading && <p>Loading players…</p>}
        {error && <p style={styles.error}>{error}</p>}

        {!playersLoading && !error && players.length === 0 && (
          <p>No players in this game.</p>
        )}

        <div style={styles.list}>
          {players.map(name => (
            <button
              key={name}
              data-testid="player-name-btn"
              style={styles.card}
              onClick={() => handleSelectPlayer(name)}
            >
              {name}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h1>Player Mode</h1>
      <h2 style={styles.heading}>Select a Game</h2>

      {loading && <p>Loading games…</p>}
      {error && <p style={styles.error}>{error}</p>}

      {!loading && !error && sessions.length === 0 && (
        <p>No active games available.</p>
      )}

      <div style={styles.list}>
        {sessions.map(s => (
          <button
            key={s.game_id}
            data-testid="game-card"
            style={styles.card}
            onClick={() => handleSelectGame(s.game_id)}
          >
            <div style={styles.cardDate}>
              {s.game_date} <span style={styles.gameId}>#{s.game_id}</span>
            </div>
            <div style={styles.cardDetails}>
              <span>{s.player_count} players</span>
              <span>{s.hand_count} hands</span>
            </div>
          </button>
        ))}
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
  error: {
    color: '#dc2626',
    padding: '1rem 0',
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
    border: '2px solid indigo',
    background: '#eef2ff',
    color: '#312e81',
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
    fontSize: '1rem',
    WebkitTapHighlightColor: 'transparent',
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
    gap: '1rem',
    fontSize: '0.9rem',
  },
  changeBtn: {
    marginTop: '1rem',
    padding: '0.5rem 1rem',
    borderRadius: '8px',
    border: '1px solid #6b7280',
    background: '#f3f4f6',
    color: '#374151',
    cursor: 'pointer',
    fontSize: '0.9rem',
  },
};
