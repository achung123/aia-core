import { useState, useEffect } from 'react';
import { fetchPlayers, createPlayer } from '../api/client.ts';
import type { PlayerResponse } from '../api/types';

export function PlayerManagement() {
  const [players, setPlayers] = useState<PlayerResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  useEffect(() => {
    fetchPlayers()
      .then(data => {
        setPlayers(data);
      })
      .catch(err => {
        setFetchError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);

    const name = nameInput.trim();
    if (!name) {
      setAddError('Player name cannot be empty.');
      return;
    }

    setSubmitting(true);
    try {
      const newPlayer = await createPlayer({ name });
      const playerName = newPlayer.name || name;
      setPlayers(prev => [...prev, { ...newPlayer, name: playerName }]);
      setNameInput('');
    } catch (err) {
      const msg =
        err instanceof Error && err.message.startsWith('HTTP 409')
          ? `Player "${name}" already exists.`
          : err instanceof Error
            ? err.message
            : String(err);
      setAddError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="player-management">
      <h2>Players</h2>

      {loading && <p>Loading players…</p>}

      {fetchError && (
        <p style={{ color: 'red' }}>Failed to load players: {fetchError}</p>
      )}

      {!loading && !fetchError && players.length === 0 && (
        <p>No players yet. Add a player below.</p>
      )}

      {!loading && !fetchError && players.length > 0 && (
        <table className="player-table">
          <thead>
            <tr>
              <th>Player</th>
            </tr>
          </thead>
          <tbody>
            {players.map(p => (
              <tr key={p.player_id}>
                <td>{p.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="new-player-form">
        <h3>New Player</h3>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Player name"
            name="playerName"
            value={nameInput}
            onChange={e => setNameInput(e.target.value)}
          />

          {addError && (
            <p className="inline-error" style={{ color: 'red' }}>
              {addError}
            </p>
          )}

          <button type="submit" disabled={submitting}>
            Submit
          </button>
        </form>
      </div>
    </div>
  );
}
