import { useState, useEffect } from 'react';
import { fetchHands, startHand, completeGame, fetchGame, assignPlayerSeat } from '../api/client.ts';
import { QRCodeDisplay } from './QRCodeDisplay.tsx';
import { GamePlayerManagement } from './GamePlayerManagement.tsx';
import { SeatPicker } from '../components/SeatPicker.tsx';
import type { HandResponse, PlayerHandResponse, PlayerInfo } from '../api/types.ts';

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
  const [seatPlayers, setSeatPlayers] = useState<PlayerInfo[]>([]);
  const [showSeatManager, setShowSeatManager] = useState(false);
  const [seatReassigning, setSeatReassigning] = useState<string | null>(null);
  const [seatError, setSeatError] = useState<string | null>(null);

  useEffect(() => {
    fetchGame(gameId)
      .then((game) => setSeatPlayers(game.players || []))
      .catch(() => {});
  }, [gameId]);

  useEffect(() => {
    fetchHands(gameId)
      .then((data) => setHands(data))
      .catch((err: Error) => setError(err.message || 'Failed to fetch hands'));
  }, [gameId]);

  if (error) {
    return (
      <div style={styles.container}>
        <div>{error}</div>
        <button data-testid="back-btn" onClick={onBack} style={{ ...styles.backButton, width: '100%', textAlign: 'center' as const }}>Back to Games</button>
      </div>
    );
  }

  if (hands === null) {
    return <div style={styles.container}>Loading</div>;
  }

  // Guard: check if the most recent hand is incomplete
  const sortedHands = [...hands].sort((a, b) => b.hand_number - a.hand_number);
  const lastHand = sortedHands[0] ?? null;
  const lastHandIncomplete = lastHand !== null &&
    lastHand.player_hands.length > 0 &&
    lastHand.player_hands.some((ph) => ph.result === null);

  // Guard: check if there are at least 2 active players (only when player data loaded)
  const activePlayerCount = seatPlayers.filter((p) => p.is_active).length;
  const tooFewPlayers = seatPlayers.length > 0 && activePlayerCount < 2;

  const startHandDisabled = starting || lastHandIncomplete || tooFewPlayers;

  const warnings: string[] = [];
  if (lastHandIncomplete) warnings.push('Complete the current hand before starting a new one');
  if (tooFewPlayers) warnings.push('Need at least 2 active players to start a hand');

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



  return (
    <div style={styles.container}>
      <h2 style={styles.heading}>{hands.length} Hands</h2>
      <button data-testid="back-btn" onClick={onBack} style={{ ...styles.backButton, width: '100%', textAlign: 'center' as const }}>
        Back to Games
      </button>
      <GamePlayerManagement gameId={gameId} />

      <div data-testid="hand-list" style={styles.handList}>
          {hands.map((hand) => (
            <div
              key={hand.hand_number}
              data-testid="hand-row"
              onClick={() => onSelectHand(hand.hand_number)}
              style={styles.row}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Hand #{hand.hand_number}</span>
                {(hand.pot ?? 0) > 0 && (
                  <span data-testid={`pot-${hand.hand_number}`} style={{ color: '#facc15', fontWeight: 600, fontSize: '0.85rem' }}>
                    Pot: ${hand.pot.toFixed(2)}
                  </span>
                )}
              </div>
              <div data-testid="result-badges" style={styles.resultBadges}>
                {hand.player_hands.map((ph) => (
                  <ResultBadge key={ph.player_hand_id} ph={ph} />
                ))}
              </div>
            </div>
          ))}
        </div>
      <button data-testid="start-hand-btn" onClick={handleStartHand} disabled={startHandDisabled} style={{
        ...styles.button,
        ...(startHandDisabled && !starting ? styles.buttonDisabled : {}),
      }}>
        {starting ? 'Starting…' : 'Start Hand'}
      </button>
      {warnings.length > 0 && (
        <div data-testid="start-hand-warning" style={styles.startWarning}>
          {warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
        </div>
      )}
      {startError && (
        <div data-testid="start-hand-error" style={styles.startError}>{startError}</div>
      )}
      <button
        data-testid="manage-seats-btn"
        style={styles.seatButton}
        onClick={() => { setShowSeatManager(!showSeatManager); setSeatReassigning(null); }}
      >
        {showSeatManager ? 'Close Seat Manager' : 'Manage Seats'}
      </button>
      {showSeatManager && !seatReassigning && (
        <div data-testid="seat-manager-panel" style={styles.seatPanel}>
          <p style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem', color: '#312e81' }}>Select a player to assign a seat</p>
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '0.5rem', marginBottom: '0.5rem' }}>
            {seatPlayers.filter((p) => p.is_active).map((p) => (
              <button
                key={p.name}
                data-testid={`seat-assign-player-${p.name}`}
                style={styles.seatPlayerBtn}
                onClick={() => setSeatReassigning(p.name)}
              >
                {p.name} {p.seat_number !== null ? `(Seat ${p.seat_number})` : '(No seat)'}
              </button>
            ))}
          </div>
        </div>
      )}
      {seatReassigning && (
        <div data-testid="seat-reassign-panel" style={styles.seatPanel}>
          <p style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.25rem', color: '#312e81' }}>Assign seat for {seatReassigning}</p>
          <SeatPicker
            seats={seatPlayers.filter((p) => p.seat_number !== null).map((p) => ({ seatNumber: p.seat_number!, playerName: p.name }))}
            currentPlayerSeat={seatPlayers.find((p) => p.name === seatReassigning)?.seat_number ?? null}
            onSelect={async (seatNumber) => {
              setSeatError(null);
              const occupant = seatPlayers.find((p) => p.seat_number === seatNumber && p.name !== seatReassigning);
              const isSwap = !!occupant;
              try {
                const result = await assignPlayerSeat(gameId, seatReassigning!, { seat_number: seatNumber }, isSwap);
                const oldSeat = seatPlayers.find((p) => p.name === seatReassigning)?.seat_number ?? null;
                setSeatPlayers((prev) =>
                  prev.map((p) => {
                    if (p.name === result.name) return { ...p, seat_number: result.seat_number };
                    if (isSwap && occupant && p.name === occupant.name) return { ...p, seat_number: oldSeat };
                    return p;
                  }),
                );
                setSeatReassigning(null);
              } catch (err) {
                setSeatError(err instanceof Error ? err.message : String(err));
              }
            }}
            onSkip={() => setSeatReassigning(null)}
            allowSwap
          />
          {seatError && <div style={{ color: '#991b1b', fontSize: '0.85rem', marginTop: '0.25rem' }}>{seatError}</div>}
        </div>
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
  buttonDisabled: {
    background: '#9ca3af',
    cursor: 'not-allowed',
  },
  startWarning: {
    color: '#92400e',
    background: '#fef3c7',
    border: '1px solid #fbbf24',
    borderRadius: '8px',
    padding: '0.5rem 0.75rem',
    fontSize: '0.85rem',
    marginTop: '0.5rem',
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
  seatButton: {
    width: '100%',
    padding: '0.5rem',
    minHeight: '40px',
    fontSize: '0.95rem',
    fontWeight: 600,
    border: '1px solid #c7d2fe',
    borderRadius: '8px',
    background: '#eef2ff',
    color: '#4f46e5',
    cursor: 'pointer',
    marginTop: '0.5rem',
  },
  seatPanel: {
    padding: '0.75rem',
    marginTop: '0.5rem',
    border: '1px solid #c7d2fe',
    borderRadius: '8px',
    background: '#f5f3ff',
  },
  seatPlayerBtn: {
    padding: '0.4rem 0.75rem',
    fontSize: '0.85rem',
    fontWeight: 600,
    border: '1px solid #c7d2fe',
    borderRadius: '8px',
    background: '#fff',
    cursor: 'pointer',
    color: '#4f46e5',
  },
};
