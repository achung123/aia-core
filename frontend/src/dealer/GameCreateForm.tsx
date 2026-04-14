import { useState, useEffect } from 'react';
import { fetchPlayers, createPlayer, createSession } from '../api/client.ts';
import type { PlayerResponse } from '../api/types';

export interface GameCreateFormProps {
  onGameCreated: (gameId: number, playerNames: string[], gameDate: string) => void;
}

function todayStr(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function GameCreateForm({ onGameCreated }: GameCreateFormProps) {
  const [date, setDate] = useState(todayStr);
  const [buyInAmount, setBuyInAmount] = useState('25');
  const [players, setPlayers] = useState<PlayerResponse[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [addingPlayer, setAddingPlayer] = useState(false);
  const [addPlayerError, setAddPlayerError] = useState<string | null>(null);

  useEffect(() => {
    fetchPlayers()
      .then(data => setPlayers(data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  function togglePlayer(name: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  async function handleAddPlayer(e: React.MouseEvent) {
    e.preventDefault();
    const trimmed = newPlayerName.trim();
    if (!trimmed) return;
    setAddPlayerError(null);
    setAddingPlayer(true);
    try {
      const player = await createPlayer({ name: trimmed });
      setPlayers(prev => [...prev, player]);
      setSelected(prev => new Set([...prev, player.name]));
      setNewPlayerName('');
    } catch (err) {
      if (err instanceof Error && err.message.includes('409')) {
        setAddPlayerError('A player with that name already exists.');
      } else {
        setAddPlayerError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setAddingPlayer(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const parsedBuyIn = buyInAmount.trim() ? parseFloat(buyInAmount) : undefined;
      const result = await createSession({
        game_date: date,
        player_names: [...selected],
        default_buy_in: parsedBuyIn && parsedBuyIn > 0 ? parsedBuyIn : undefined,
      });
      onGameCreated(result.game_id, result.player_names, result.game_date);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = selected.size >= 2 && !submitting;

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <h2 style={styles.heading}>New Game</h2>

      <label style={styles.label}>
        Date
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          style={styles.dateInput}
        />
      </label>

      <label style={styles.label}>
        Buy-in Amount
        <input
          type="number"
          min="0"
          step="0.01"
          placeholder="e.g. 20.00"
          value={buyInAmount}
          onChange={e => setBuyInAmount(e.target.value)}
          data-testid="buy-in-input"
          style={styles.dateInput}
        />
      </label>

      <fieldset style={styles.fieldset}>
        <legend style={styles.legend}>Players (select at least 2)</legend>
        {loading && <p>Loading players…</p>}
        <div style={styles.chipContainer}>
          {players.map(p => {
            const active = selected.has(p.name);
            return (
              <button
                key={p.player_id}
                type="button"
                onClick={() => togglePlayer(p.name)}
                style={{
                  ...styles.chip,
                  ...(active ? styles.chipActive : {}),
                }}
              >
                {p.name}
              </button>
            );
          })}
        </div>
        <div style={styles.addPlayerRow}>
          <input
            type="text"
            placeholder="New player name"
            value={newPlayerName}
            onChange={e => { setNewPlayerName(e.target.value); setAddPlayerError(null); }}
            style={styles.addPlayerInput}
          />
          <button
            type="button"
            onClick={handleAddPlayer}
            disabled={addingPlayer || !newPlayerName.trim()}
            style={{
              ...styles.addPlayerBtn,
              ...(addingPlayer || !newPlayerName.trim() ? styles.submitDisabled : {}),
            }}
          >
            {addingPlayer ? 'Adding…' : 'Add'}
          </button>
        </div>
        {addPlayerError && <p style={styles.addPlayerError}>{addPlayerError}</p>}
      </fieldset>

      {error && <p style={styles.error}>{error}</p>}

      <button type="submit" disabled={!canSubmit} style={{
        ...styles.submit,
        ...(canSubmit ? {} : styles.submitDisabled),
      }}>
        {submitting ? 'Creating…' : 'Create Game'}
      </button>
    </form>
  );
}

const styles: Record<string, React.CSSProperties> = {
  form: {
    maxWidth: '480px',
    margin: '0 auto',
    padding: '16px',
  },
  heading: {
    marginTop: 0,
  },
  label: {
    display: 'block',
    marginBottom: '16px',
    fontWeight: 500,
  },
  dateInput: {
    display: 'block',
    marginTop: '4px',
    padding: '8px',
    minHeight: '48px',
    fontSize: '16px',
    borderRadius: '6px',
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text-h)',
    width: '100%',
    boxSizing: 'border-box',
  },
  fieldset: {
    border: '1px solid var(--border)',
    borderRadius: '8px',
    padding: '12px',
    marginBottom: '16px',
  },
  legend: {
    fontWeight: 500,
    padding: '0 4px',
  },
  chipContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    marginTop: '8px',
  },
  chip: {
    padding: '10px 16px',
    minHeight: '48px',
    borderRadius: '20px',
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text-h)',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'background 0.15s, border-color 0.15s',
    WebkitTapHighlightColor: 'transparent',
  },
  chipActive: {
    background: 'var(--accent-bg)',
    borderColor: 'var(--accent-border)',
    color: 'var(--accent)',
    fontWeight: 600,
  },
  error: {
    color: '#ef4444',
    background: 'rgba(239,68,68,0.1)',
    padding: '8px 12px',
    borderRadius: '6px',
    marginBottom: '12px',
  },
  submit: {
    width: '100%',
    padding: '12px',
    minHeight: '48px',
    fontSize: '16px',
    fontWeight: 600,
    borderRadius: '8px',
    border: 'none',
    background: 'var(--accent)',
    color: '#fff',
    cursor: 'pointer',
  },
  submitDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  addPlayerRow: {
    display: 'flex',
    gap: '8px',
    marginTop: '12px',
  },
  addPlayerInput: {
    flex: 1,
    padding: '8px',
    minHeight: '48px',
    fontSize: '16px',
    borderRadius: '6px',
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text-h)',
    boxSizing: 'border-box' as const,
  },
  addPlayerBtn: {
    padding: '8px 16px',
    minHeight: '48px',
    minWidth: '48px',
    fontSize: '14px',
    fontWeight: 600,
    borderRadius: '6px',
    border: 'none',
    background: 'var(--accent)',
    color: '#fff',
    cursor: 'pointer',
  },
  addPlayerError: {
    color: '#ef4444',
    fontSize: '13px',
    marginTop: '6px',
    marginBottom: 0,
  },
};
