import { useState, useEffect } from 'react';
import { fetchHands, startHand, completeGame, fetchGame, fetchGameStats, createRebuy } from '../api/client.ts';
import { QRCodeDisplay } from './QRCodeDisplay.tsx';
import { GamePlayerManagement } from './GamePlayerManagement.tsx';
import type { HandResponse, PlayerHandResponse, PlayerInfo, GameStatsPlayerEntry } from '../api/types.ts';

const resultColors: Record<string, string> = {
  won: '#16a34a',
  folded: '#dc2626',
  lost: '#ea580c',
};

interface ResultBadgeProps {
  ph: PlayerHandResponse;
}

function ResultBadge({ ph }: ResultBadgeProps) {
  if (!ph.result) return <span>{ph.player_name} </span>;
  const color = resultColors[ph.result] || '#6b7280';
  const icon = ph.result === 'won' ? '\ud83c\udfc6 ' : '';
  const street = ph.outcome_street ? ` (${ph.outcome_street})` : '';
  const handDesc = ph.winning_hand_description ? ` — ${ph.winning_hand_description}` : '';
  return (
    <span style={{ color, fontWeight: ph.result === 'won' ? 700 : 400, marginRight: '0.5rem' }}>
      {icon}{ph.player_name} {ph.result}{street}{handDesc}
    </span>
  );
}

export interface HandDashboardProps {
  gameId: number;
  players?: string[];
  onSelectHand: (handNumber: number) => void;
  onBack: () => void;
}

export function HandDashboard({ gameId, players: playerNames, onSelectHand, onBack }: HandDashboardProps) {
  const [hands, setHands] = useState<HandResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [ending, setEnding] = useState(false);
  const [selectedWinners, setSelectedWinners] = useState<string[]>([]);
  const [winnerError, setWinnerError] = useState<string | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [gamePlayers, setGamePlayers] = useState<PlayerInfo[]>([]);
  const [playerStats, setPlayerStats] = useState<GameStatsPlayerEntry[]>([]);
  const [rebuyingPlayer, setRebuyingPlayer] = useState<string | null>(null);
  const [rebuyError, setRebuyError] = useState<string | null>(null);

  useEffect(() => {
    fetchHands(gameId)
      .then((data) => setHands(data))
      .catch((err: Error) => setError(err.message || 'Failed to fetch hands'));
  }, [gameId]);

  function loadTotals() {
    fetchGame(gameId).then(data => setGamePlayers(data.players || [])).catch(() => {});
    fetchGameStats(gameId).then(data => setPlayerStats(data.player_stats || [])).catch(() => {});
  }

  useEffect(() => {
    loadTotals();
  }, [gameId]);

  if (error) {
    return (
      <div style={styles.container}>
        <div>{error}</div>
        <button data-testid="back-btn" onClick={onBack}>Back to Games</button>
      </div>
    );
  }

  if (hands === null) {
    return <div style={styles.container}>Loading</div>;
  }

  async function handleStartHand() {
    setStarting(true);
    setStartError(null);
    try {
      const result = await startHand(gameId);
      onSelectHand(result.hand_number);
    } catch (err) {
      setStartError((err as Error).message || 'Failed to start hand');
    } finally {
      setStarting(false);
    }
  }

  async function handleEndGame() {
    if (selectedWinners.length < 1 || selectedWinners.length > 2) {
      setWinnerError('Select 1 or 2 winners');
      return;
    }
    setWinnerError(null);
    setEnding(true);
    try {
      await completeGame(gameId, selectedWinners);
      setShowEndConfirm(false);
      onBack();
    } catch (err) {
      setError((err as Error).message || 'Failed to end game');
      setShowEndConfirm(false);
    } finally {
      setEnding(false);
    }
  }

  function toggleWinner(name: string) {
    setWinnerError(null);
    setSelectedWinners((prev) => {
      if (prev.includes(name)) return prev.filter((n) => n !== name);
      if (prev.length >= 2) return prev; // max 2
      return [...prev, name];
    });
  }

  async function handleRebuy(playerName: string, amount: number) {
    setRebuyingPlayer(playerName);
    setRebuyError(null);
    try {
      await createRebuy(gameId, playerName, { amount });
      loadTotals();
    } catch (err) {
      setRebuyError((err as Error).message || 'Rebuy failed');
    } finally {
      setRebuyingPlayer(null);
    }
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.heading}>{hands.length} Hands</h2>
      <button data-testid="back-btn" onClick={onBack} style={styles.backButton}>
        Back to Games
      </button>
      <GamePlayerManagement gameId={gameId} />
      {gamePlayers.length > 0 && (
        <div data-testid="player-totals" style={styles.playerTotals}>
          <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Player Totals</h3>
          {gamePlayers.map(player => {
            const stat = playerStats.find(s => s.player_name === player.name);
            const total = (player.buy_in ?? 0) + (player.total_rebuys ?? 0) + (stat?.profit_loss ?? 0);
            const canRebuy = total <= 0 && !!player.buy_in;
            const formatted = total < 0
              ? `-$${Math.abs(total).toFixed(2)}`
              : `$${total.toFixed(2)}`;
            return (
              <div key={player.name} style={styles.playerTotalRow}>
                <span>{player.name}</span>
                <span style={{ fontWeight: 600 }}>{formatted}</span>
                <button
                  data-testid={`rebuy-btn-${player.name}`}
                  disabled={!canRebuy || rebuyingPlayer === player.name}
                  style={{
                    ...styles.rebuyBtn,
                    opacity: canRebuy ? 1 : 0.4,
                    cursor: canRebuy ? 'pointer' : 'not-allowed',
                  }}
                  onClick={() => handleRebuy(player.name, player.buy_in ?? 0)}
                >
                  {rebuyingPlayer === player.name ? 'Rebuying…' : 'Rebuy'}
                </button>
              </div>
            );
          })}
          {rebuyError && (
            <div data-testid="rebuy-error" style={{ color: '#991b1b', fontSize: '0.85rem', marginTop: '0.5rem' }}>{rebuyError}</div>
          )}
        </div>
      )}
      <div data-testid="hand-list" style={styles.handList}>
          {hands.map((hand) => (
            <div
              key={hand.hand_number}
              data-testid="hand-row"
              onClick={() => onSelectHand(hand.hand_number)}
              style={styles.row}
            >
              <div>Hand #{hand.hand_number}</div>
              <div data-testid="result-badges" style={styles.resultBadges}>
                {hand.player_hands.map((ph) => (
                  <ResultBadge key={ph.player_hand_id} ph={ph} />
                ))}
              </div>
            </div>
          ))}
        </div>
      <button data-testid="start-hand-btn" onClick={handleStartHand} disabled={starting} style={styles.button}>
        {starting ? 'Starting…' : 'Start Hand'}
      </button>
      {startError && (
        <div data-testid="start-hand-error" style={styles.startError}>{startError}</div>
      )}
      <button
        data-testid="toggle-qr-btn"
        onClick={() => setShowQR((v) => !v)}
        style={styles.qrButton}
      >
        {showQR ? 'Hide QR' : 'Show QR'}
      </button>
      {showQR && (
        <QRCodeDisplay gameId={gameId} visible={true} />
      )}
      <button
        data-testid="end-game-btn"
        onClick={() => setShowEndConfirm(true)}
        style={styles.endGameButton}
      >
        End Game
      </button>

      {showEndConfirm && (
        <div data-testid="end-game-confirm" style={styles.dialogOverlay}>
          <div style={styles.dialog}>
            <p style={{ marginBottom: '0.5rem', fontWeight: 600 }}>Select the winner(s):</p>
            <p style={{ marginBottom: '0.75rem', fontSize: '0.85rem', color: '#6b7280' }}>Choose 1 or 2 players who won the game.</p>
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '0.5rem', marginBottom: '1rem' }}>
              {(playerNames || []).map((name) => {
                const selected = selectedWinners.includes(name);
                return (
                  <button
                    key={name}
                    data-testid={`winner-checkbox-${name}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem 0.75rem',
                      border: selected ? '2px solid #16a34a' : '2px solid #d1d5db',
                      borderRadius: '8px',
                      background: selected ? '#dcfce7' : '#fff',
                      cursor: 'pointer',
                      fontSize: '1rem',
                    }}
                    onClick={() => toggleWinner(name)}
                  >
                    {selected ? '✅' : '⬜'} {name}
                  </button>
                );
              })}
            </div>
            {winnerError && <div style={{ color: '#991b1b', marginBottom: '0.5rem', fontSize: '0.9rem' }}>{winnerError}</div>}
            {error && <div style={{ color: '#991b1b', marginBottom: '0.5rem' }}>{error}</div>}
            <div style={styles.dialogButtons}>
              <button data-testid="end-game-confirm-no" onClick={() => { setShowEndConfirm(false); setSelectedWinners([]); setWinnerError(null); }} disabled={ending}>
                Cancel
              </button>
              <button data-testid="end-game-confirm-yes" onClick={handleEndGame} disabled={ending}>
                {ending ? 'Ending…' : 'End Game'}
              </button>
            </div>
          </div>
        </div>
      )}
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
    marginBottom: '1rem',
  },
  backButton: {
    marginBottom: '0.75rem',
    padding: '0.5rem 1rem',
    fontSize: '0.95rem',
    cursor: 'pointer',
  },
  handList: {
    overflowY: 'auto',
  },
  row: {
    padding: '0.5rem',
    cursor: 'pointer',
    borderBottom: '1px solid #eee',
  },
  resultBadges: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.25rem',
  },
  button: {
    width: '100%',
    padding: '0.75rem',
    minHeight: '48px',
    fontSize: '1.1rem',
    fontWeight: 'bold',
    border: 'none',
    borderRadius: '8px',
    background: '#4f46e5',
    color: '#fff',
    cursor: 'pointer',
    marginTop: '1rem',
  },
  endGameButton: {
    width: '100%',
    padding: '0.75rem',
    minHeight: '48px',
    fontSize: '1.1rem',
    fontWeight: 'bold',
    border: 'none',
    borderRadius: '8px',
    background: '#dc2626',
    color: '#fff',
    cursor: 'pointer',
    marginTop: '0.5rem',
  },
  startError: {
    color: '#991b1b',
    fontSize: '0.9rem',
    marginTop: '0.5rem',
  },
  qrButton: {
    width: '100%',
    padding: '0.5rem',
    minHeight: '40px',
    fontSize: '0.95rem',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    background: '#f9fafb',
    cursor: 'pointer',
    marginTop: '0.5rem',
  },
  dialogOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 300,
  },
  dialog: {
    background: '#fff',
    borderRadius: '12px',
    padding: '1.5rem',
    maxWidth: '400px',
    width: '90%',
  },
  dialogButtons: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '0.5rem',
  },
  playerTotals: {
    marginBottom: '0.75rem',
    padding: '0.75rem',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    background: '#f9fafb',
  },
  playerTotalRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.5rem',
    padding: '0.25rem 0',
  },
  rebuyBtn: {
    padding: '0.25rem 0.75rem',
    fontSize: '0.85rem',
    border: '1px solid #6366f1',
    borderRadius: '6px',
    background: '#eef2ff',
    color: '#4f46e5',
  },
};
