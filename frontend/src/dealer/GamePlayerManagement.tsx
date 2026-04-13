import { useState, useEffect } from 'react';
import { fetchGame, togglePlayerStatus, addPlayerToGame, assignPlayerSeat, createRebuy } from '../api/client.ts';
import type { PlayerInfo } from '../api/types.ts';
import { SeatPicker } from '../components/SeatPicker.tsx';
import type { SeatData } from '../components/SeatPicker.tsx';

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
  const [reassigningPlayer, setReassigningPlayer] = useState<string | null>(null);
  const [rebuyPlayer, setRebuyPlayer] = useState<string | null>(null);
  const [rebuyAmount, setRebuyAmount] = useState('');
  const [rebuyLoading, setRebuyLoading] = useState(false);
  const [defaultBuyIn, setDefaultBuyIn] = useState<number | null>(null);

  useEffect(() => {
    fetchGame(gameId)
      .then((game) => {
        setPlayers(game.players || []);
        setDefaultBuyIn(game.default_buy_in ?? null);
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

  async function handleReassignSeat(seatNumber: number) {
    if (!reassigningPlayer) return;
    setActionError(null);
    try {
      const result = await assignPlayerSeat(gameId, reassigningPlayer, { seat_number: seatNumber });
      setPlayers((prev) =>
        prev.map((p) => (p.name === result.name ? { ...p, seat_number: result.seat_number } : p)),
      );
      setReassigningPlayer(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setActionError(message);
    }
  }

  function seatDataFromPlayers(): SeatData[] {
    return players
      .filter((p) => p.seat_number !== null)
      .map((p) => ({ seatNumber: p.seat_number!, playerName: p.name }));
  }

  async function handleRebuy() {
    if (!rebuyPlayer) return;
    const amount = parseFloat(rebuyAmount);
    if (!amount || amount <= 0) {
      setActionError('Rebuy amount must be greater than 0');
      return;
    }
    setActionError(null);
    setRebuyLoading(true);
    try {
      await createRebuy(gameId, rebuyPlayer, { amount });
      // Refresh player list to show updated rebuy stats
      const game = await fetchGame(gameId);
      setPlayers(game.players || []);
      setRebuyPlayer(null);
      setRebuyAmount('');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setRebuyLoading(false);
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
            {player.buy_in != null && (
              <span data-testid={`buy-in-${player.name}`} style={styles.buyInBadge}>
                ${player.buy_in.toFixed(2)}
              </span>
            )}
            <span data-testid={`seat-number-${player.name}`} style={styles.seatBadge}>
              {player.seat_number !== null ? `Seat ${player.seat_number}` : '–'}
            </span>
            <button
              data-testid={`rebuy-btn-${player.name}`}
              style={styles.reassignBtn}
              onClick={() => setRebuyPlayer(rebuyPlayer === player.name ? null : player.name)}
            >
              Rebuy
            </button>
            <button
              data-testid={`reassign-btn-${player.name}`}
              style={styles.reassignBtn}
              onClick={() => setReassigningPlayer(reassigningPlayer === player.name ? null : player.name)}
            >
              Reassign Seat
            </button>
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

      {rebuyPlayer && (
        <div data-testid="rebuy-panel" style={styles.reassignPanel}>
          <p style={styles.reassignLabel}>Rebuy for {rebuyPlayer}</p>
          <div style={styles.addRow}>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder={defaultBuyIn ? `$${defaultBuyIn.toFixed(2)}` : 'Amount'}
              value={rebuyAmount}
              onChange={(e) => setRebuyAmount(e.target.value)}
              data-testid="rebuy-amount-input"
              style={styles.input}
            />
            <button
              data-testid="rebuy-confirm-btn"
              onClick={handleRebuy}
              disabled={rebuyLoading}
              style={styles.addButton}
            >
              {rebuyLoading ? 'Processing…' : 'Confirm Rebuy'}
            </button>
          </div>
        </div>
      )}

      {reassigningPlayer && (
        <div data-testid="seat-reassign-panel" style={styles.reassignPanel}>
          <p style={styles.reassignLabel}>Reassign seat for {reassigningPlayer}</p>
          <SeatPicker
            seats={seatDataFromPlayers()}
            currentPlayerSeat={players.find((p) => p.name === reassigningPlayer)?.seat_number ?? null}
            onSelect={handleReassignSeat}
            onSkip={() => setReassigningPlayer(null)}
          />
        </div>
      )}

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
  seatBadge: {
    fontSize: '0.8rem',
    color: '#6b7280',
    minWidth: '55px',
    textAlign: 'center' as const,
  },
  buyInBadge: {
    fontSize: '0.8rem',
    color: '#4ade80',
    fontWeight: 600,
    minWidth: '55px',
    textAlign: 'center' as const,
  },
  reassignBtn: {
    padding: '0.2rem 0.5rem',
    fontSize: '0.75rem',
    border: '1px solid #c7d2fe',
    borderRadius: '6px',
    background: '#eef2ff',
    cursor: 'pointer',
    color: '#4f46e5',
    fontWeight: 600,
  },
  reassignPanel: {
    padding: '0.75rem',
    marginBottom: '0.75rem',
    border: '1px solid #c7d2fe',
    borderRadius: '8px',
    background: '#f5f3ff',
  },
  reassignLabel: {
    fontSize: '0.9rem',
    fontWeight: 600,
    marginBottom: '0.25rem',
    color: '#312e81',
  },
};
