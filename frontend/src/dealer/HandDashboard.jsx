import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { fetchHands, createHand, completeGame } from '../api/client.js';
import { QRCodeDisplay } from './QRCodeDisplay.jsx';

const resultColors = {
  won: '#16a34a',
  folded: '#dc2626',
  lost: '#ea580c',
};

function ResultBadge({ ph }) {
  if (!ph.result) return <span>{ph.player_name} </span>;
  const color = resultColors[ph.result] || '#6b7280';
  const icon = ph.result === 'won' ? '\ud83c\udfc6 ' : '';
  const street = ph.outcome_street ? ` (${ph.outcome_street})` : '';
  return (
    <span style={{ color, fontWeight: ph.result === 'won' ? 700 : 400, marginRight: '0.5rem' }}>
      {icon}{ph.player_name} {ph.result}{street}
    </span>
  );
}

export function HandDashboard({ gameId, players: playerNames, onSelectHand, onBack }) {
  const [hands, setHands] = useState(null);
  const [error, setError] = useState(null);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [ending, setEnding] = useState(false);
  const [selectedWinners, setSelectedWinners] = useState([]);
  const [winnerError, setWinnerError] = useState(null);
  const [showQR, setShowQR] = useState(false);

  useEffect(() => {
    fetchHands(gameId)
      .then((data) => setHands(data))
      .catch((err) => setError(err.message || 'Failed to fetch hands'));
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

  async function handleNewHand() {
    try {
      const result = await createHand(gameId, {});
      onSelectHand(result.hand_number);
    } catch (err) {
      setError(err.message || 'Failed to create hand');
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
      setError(err.message || 'Failed to end game');
      setShowEndConfirm(false);
    } finally {
      setEnding(false);
    }
  }

  function toggleWinner(name) {
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
      <button data-testid="back-btn" onClick={onBack} style={styles.backButton}>
        Back to Games
      </button>
      <div data-testid="hand-list" style={styles.handList}>
        {hands.map((hand) => (
          <div
            key={hand.hand_number}
            data-testid="hand-row"
            onClick={() => onSelectHand(hand.hand_number)}
            style={styles.row}
          >
            <div>Hand #{hand.hand_number}</div>
            <div>
              {hand.player_hands.map((ph) => (
                <ResultBadge key={ph.player_hand_id} ph={ph} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <button data-testid="new-hand-btn" onClick={handleNewHand} style={styles.button}>
        New Hand
      </button>
      <button
        data-testid="toggle-qr-btn"
        onClick={() => setShowQR((v) => !v)}
        style={styles.qrButton}
      >
        {showQR ? 'Hide QR' : 'Show QR'}
      </button>
      <QRCodeDisplay gameId={gameId} visible={showQR} />
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
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

const styles = {
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
};
