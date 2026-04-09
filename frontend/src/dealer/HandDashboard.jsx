import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { fetchHands, createHand } from '../api/client.js';

export function HandDashboard({ gameId, onSelectHand, onBack }) {
  const [hands, setHands] = useState(null);
  const [error, setError] = useState(null);

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
                <span key={ph.player_hand_id}>
                  {ph.player_name}{ph.result ? ` ${ph.result}` : ''}{' '}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <button data-testid="new-hand-btn" onClick={handleNewHand} style={styles.button}>
        New Hand
      </button>
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
};
