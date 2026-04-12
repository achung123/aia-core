import { useState, useEffect } from 'react';
import { fetchGame, togglePlayerStatus, addPlayerToGame } from '../api/client.ts';
import type { PlayerInfo } from '../api/types.ts';

export interface GamePlayerManagementProps {
  gameId: number;
}

export function GamePlayerManagement({ gameId }: GamePlayerManagementProps) {
  const [players, setPlayers] = useState<PlayerInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetchGame(gameId)
      .then((game) => {
        setPlayers(game.players || []);
      })
      .catch((err) => {
        setFetchError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [gameId]);

  async function handleToggle(player: PlayerInfo) {
    const newActive = !player.is_active;
    // Optimistic update
    setPlayers((prev) =>
      prev.map((p) => (p.name === player.name ? { ...p, is_active: newActive } : p)),
    );
    setActionError(null);
    try {
      await togglePlayerStatus(gameId, player.name, newActive);
    } catch (err) {
      // Revert on error
      setPlayers((prev) =>
        prev.map((p) => (p.name === player.name ? { ...p, is_active: player.is_active } : p)),
      );
      setActionError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleAdd() {
    const trimmed = nameInput.trim();
    if (!trimmed) {
      setActionError('Player name cannot be empty');
      return;
    }
    setActionError(null);
    setAdding(true);
    try {
      const result = await addPlayerToGame(gameId, trimmed);
      setPlayers((prev) => [
        ...prev,
        { name: result.player_name, is_active: result.is_active, seat_number: result.seat_number, buy_in: null },
      ]);
      setNameInput('');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setAdding(false);
    }
  }

  if (loading) {
    return <div style={styles.container}>Loading players…</div>;
  }

  if (fetchError) {
    return <div style={styles.container}><div style={styles.error}>{fetchError}</div></div>;
  }

  return (
    <div data-testid="game-player-management" style={styles.container}>
      <h3 style={styles.heading}>Players</h3>

      <div data-testid="player-list" style={styles.list}>
        {players.map((player) => (
          <div key={player.name} data-testid={`player-row-${player.name}`} style={styles.row}>
            <span style={player.is_active ? styles.nameActive : styles.nameInactive}>
              {player.name}
            </span>
            <label style={styles.toggleLabel}>
              <input
                type="checkbox"
                data-testid={`toggle-${player.name}`}
                checked={player.is_active}
                onChange={() => handleToggle(player)}
                style={styles.toggle}
              />
              {player.is_active ? 'Active' : 'Inactive'}
            </label>
          </div>
        ))}
      </div>

      {actionError && (
        <div data-testid="action-error" style={styles.error}>{actionError}</div>
      )}

      <div style={styles.addRow}>
        <input
          type="text"
          placeholder="Player name"
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
          style={styles.input}
        />
        <button
          data-testid="add-player-btn"
          onClick={handleAdd}
          disabled={adding}
          style={styles.addButton}
        >
          {adding ? 'Adding…' : 'Add Player'}
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '0.75rem 0',
  },
  heading: {
    fontSize: '1.1rem',
    fontWeight: 600,
    marginBottom: '0.5rem',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    marginBottom: '0.75rem',
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.5rem 0.75rem',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
  },
  nameActive: {
    fontWeight: 600,
  },
  nameInactive: {
    fontWeight: 400,
    color: '#9ca3af',
  },
  toggleLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    fontSize: '0.85rem',
    cursor: 'pointer',
  },
  toggle: {
    cursor: 'pointer',
  },
  error: {
    color: '#991b1b',
    fontSize: '0.9rem',
    marginBottom: '0.5rem',
  },
  addRow: {
    display: 'flex',
    gap: '0.5rem',
  },
  input: {
    flex: 1,
    padding: '0.5rem 0.75rem',
    fontSize: '1rem',
    borderRadius: '8px',
    border: '1px solid #d1d5db',
  },
  addButton: {
    padding: '0.5rem 1rem',
    fontSize: '0.95rem',
    fontWeight: 600,
    borderRadius: '8px',
    border: 'none',
    background: '#4f46e5',
    color: '#fff',
    cursor: 'pointer',
    minHeight: '44px',
  },
};
