import { useState, useEffect } from 'react';
import { fetchPlayers, createSession } from '../api/client.ts';
import type { GameSessionResponse, PlayerResponse } from '../api/types';

export interface SessionFormProps {
  onSessionCreated: (session: GameSessionResponse) => void;
}

function todayStr(): string {
  const today = new Date();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return `${today.getFullYear()}-${mm}-${dd}`;
}

type PlayerLoadState =
  | { status: 'loading' }
  | { status: 'loaded'; players: PlayerResponse[] }
  | { status: 'error'; message: string };

export function SessionForm({ onSessionCreated }: SessionFormProps) {
  const [date, setDate] = useState(todayStr);
  const [playerState, setPlayerState] = useState<PlayerLoadState>({ status: 'loading' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPlayers()
      .then(players => {
        setPlayerState({ status: 'loaded', players });
      })
      .catch(err => {
        setPlayerState({ status: 'error', message: err.message });
      });
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = e.currentTarget;
    const select = form.elements.namedItem('players') as HTMLSelectElement;
    const selectedNames = Array.from(select.selectedOptions).map(opt => opt.value);

    setSubmitting(true);
    try {
      const session = await createSession({
        game_date: date,
        player_names: selectedNames,
      });
      form.reset();
      setDate(todayStr());
      onSessionCreated(session);
    } catch (err) {
      const message =
        err instanceof Error && err.message.startsWith('HTTP 409')
          ? 'A session for this date already exists'
          : err instanceof Error
            ? err.message
            : String(err);
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="session-form">
      <h2>New Session</h2>
      <form onSubmit={handleSubmit}>
        <label htmlFor="session-date-input">Date</label>
        <input
          type="date"
          id="session-date-input"
          name="gameDate"
          required
          value={date}
          onChange={e => setDate(e.target.value)}
        />

        <label htmlFor="session-players-select">Players</label>
        <select id="session-players-select" name="players" multiple>
          {playerState.status === 'loading' && (
            <option disabled>Loading players…</option>
          )}
          {playerState.status === 'error' && (
            <option disabled>Failed to load players: {playerState.message}</option>
          )}
          {playerState.status === 'loaded' && playerState.players.length === 0 && (
            <option disabled>No players found</option>
          )}
          {playerState.status === 'loaded' &&
            playerState.players.map(player => (
              <option key={player.player_id} value={player.name}>
                {player.name}
              </option>
            ))}
        </select>

        {error && (
          <p className="inline-error" style={{ color: 'red' }}>
            {error}
          </p>
        )}

        <button type="submit" disabled={submitting}>
          Submit
        </button>
      </form>
    </div>
  );
}
