import { useState } from 'react';
import type React from 'react';
import { PlayerActionButtons } from '../player/PlayerActionButtons.tsx';
import { setCurrentPlayer, setPlayerChips, undoLastAction } from '../api/client.ts';

export interface DealerOverridesProps {
  gameId: number;
  handNumber: number;
  /** Players still able to act (not folded, not sitting out). */
  playerNames: string[];
  playerChips: Record<string, number | null>;
  currentPlayerName: string | null;
  communityCardCount: number;
  legalActions: string[];
  amountToCall: number;
  minimumBet: number | null;
  minimumRaise: number | null;
  pot: number;
  handPhase: string;
  actionIndex: number;
  /** Called after any override so the dashboard can re-poll. */
  onChanged: () => void;
}

const BETTING_PHASES = ['preflop', 'flop', 'turn', 'river'];

export function DealerOverrides({
  gameId, handNumber, playerNames, playerChips, currentPlayerName, communityCardCount,
  legalActions, amountToCall, minimumBet, minimumRaise, pot, handPhase, actionIndex, onChanged,
}: DealerOverridesProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stackPlayer, setStackPlayer] = useState('');
  const [stackAmount, setStackAmount] = useState('');
  const [stackReason, setStackReason] = useState('');

  const betting = BETTING_PHASES.includes(handPhase);
  // Undo is possible once anything beyond the blinds has happened, including the fold that ended the hand
  const canUndo = actionIndex > 0 && (betting || handPhase === 'showdown');

  async function run(task: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await task();
      onChanged();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Override failed');
    } finally {
      setBusy(false);
    }
  }

  function handleUndo() {
    return run(() => undoLastAction(gameId, handNumber));
  }

  function handleGiveTurn(name: string) {
    if (!name) return;
    return run(() => setCurrentPlayer(gameId, handNumber, name));
  }

  function handleSetStack() {
    const amount = Number(stackAmount);
    if (!stackPlayer || stackAmount.trim() === '' || !Number.isFinite(amount) || amount < 0) {
      setError('Pick a player and enter a stack of 0 or more');
      return;
    }
    return run(async () => {
      await setPlayerChips(gameId, stackPlayer, { current_chips: amount, reason: stackReason.trim() || null });
      setStackAmount('');
      setStackReason('');
    });
  }

  return (
    <div data-testid="dealer-overrides" style={styles.panel}>
      <button
        data-testid="dealer-overrides-toggle"
        style={styles.toggle}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        Dealer overrides {open ? '▾' : '▸'}
      </button>

      {open && (
        <div style={styles.body}>
          {error && <p data-testid="dealer-overrides-error" style={styles.error}>{error}</p>}

          {betting && currentPlayerName && (
            <div style={styles.section}>
              <div style={styles.sectionTitle}>Act for {currentPlayerName}</div>
              <PlayerActionButtons
                // Fresh buttons for every turn, so one action never locks the next
                key={`${currentPlayerName}-${actionIndex}`}
                gameId={gameId}
                handNumber={handNumber}
                playerName={currentPlayerName}
                communityCardCount={communityCardCount}
                legalActions={legalActions}
                amountToCall={amountToCall}
                minimumBet={minimumBet}
                minimumRaise={minimumRaise}
                pot={pot}
                currentStack={playerChips[currentPlayerName] ?? null}
                expectedActionIndex={actionIndex}
                onActionConfirmed={onChanged}
              />
            </div>
          )}

          {betting && (
            <div style={styles.section}>
              <label style={styles.sectionTitle} htmlFor="dealer-give-turn">Give the turn to</label>
              <select
                id="dealer-give-turn"
                data-testid="dealer-give-turn"
                style={styles.input}
                disabled={busy}
                value=""
                onChange={(event) => handleGiveTurn(event.target.value)}
              >
                <option value="">Choose a player…</option>
                {playerNames.filter((name) => name !== currentPlayerName).map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
          )}

          <div style={styles.section}>
            <button
              data-testid="dealer-undo"
              style={styles.button}
              disabled={busy || !canUndo}
              onClick={handleUndo}
            >
              Undo last action
            </button>
          </div>

          <div style={styles.section}>
            <div style={styles.sectionTitle}>Correct a stack</div>
            <div style={styles.row}>
              <select
                data-testid="dealer-stack-player"
                aria-label="Player"
                style={styles.input}
                value={stackPlayer}
                onChange={(event) => setStackPlayer(event.target.value)}
              >
                <option value="">Player…</option>
                {Object.keys(playerChips).map((name) => (
                  <option key={name} value={name}>
                    {name}{playerChips[name] != null ? ` ($${playerChips[name]!.toFixed(2)})` : ''}
                  </option>
                ))}
              </select>
              <input
                data-testid="dealer-stack-amount"
                aria-label="New stack"
                style={styles.input}
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                placeholder="New stack"
                value={stackAmount}
                onChange={(event) => setStackAmount(event.target.value)}
              />
            </div>
            <input
              data-testid="dealer-stack-reason"
              aria-label="Reason"
              style={{ ...styles.input, width: '100%', marginTop: '0.4rem', boxSizing: 'border-box' }}
              placeholder="Reason (optional, kept in the log)"
              value={stackReason}
              onChange={(event) => setStackReason(event.target.value)}
            />
            <button
              data-testid="dealer-stack-save"
              style={{ ...styles.button, marginTop: '0.4rem' }}
              disabled={busy}
              onClick={handleSetStack}
            >
              Set stack
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    marginTop: '0.75rem',
    maxWidth: '100%',
    boxSizing: 'border-box',
    border: '1px solid #312e81',
    borderRadius: '8px',
    background: '#1e1b4b',
  },
  toggle: {
    width: '100%',
    minHeight: '44px',
    padding: '0.6rem 0.75rem',
    textAlign: 'left',
    fontWeight: 600,
    fontSize: '0.95rem',
    color: '#e0e7ff',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
  },
  body: { padding: '0 0.75rem 0.75rem' },
  section: { marginTop: '0.75rem' },
  sectionTitle: { display: 'block', fontWeight: 600, fontSize: '0.85rem', color: '#c7d2fe', marginBottom: '0.35rem' },
  row: { display: 'flex', gap: '0.4rem' },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: '44px',
    padding: '0.4rem 0.5rem',
    fontSize: '1rem',
    border: '1px solid #4338ca',
    borderRadius: '6px',
    background: '#0f172a',
    color: '#f1f5f9',
  },
  button: {
    width: '100%',
    boxSizing: 'border-box',
    minHeight: '44px',
    padding: '0.5rem 0.75rem',
    fontSize: '0.95rem',
    fontWeight: 600,
    border: '1px solid #6366f1',
    borderRadius: '6px',
    background: '#312e81',
    color: '#ffffff',
    cursor: 'pointer',
  },
  error: { color: '#fca5a5', fontSize: '0.9rem', margin: '0.5rem 0 0' },
};
