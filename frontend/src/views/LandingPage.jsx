import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';

const DEALER_STATE_KEY = 'aia_dealer_state';

function hasActiveDealerGame() {
  try {
    const raw = sessionStorage.getItem(DEALER_STATE_KEY);
    if (!raw) return false;
    const saved = JSON.parse(raw);
    return !!(saved && saved.gameId && saved.currentStep && saved.currentStep !== 'gameSelector');
  } catch { return false; }
}

export function LandingPage() {
  const [gameActive, setGameActive] = useState(hasActiveDealerGame());

  useEffect(() => {
    function check() { setGameActive(hasActiveDealerGame()); }
    window.addEventListener('storage', check);
    document.addEventListener('visibilitychange', check);
    return () => {
      window.removeEventListener('storage', check);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);

  return (
    <div data-testid="landing-page" style={styles.container}>
      <h1 style={styles.title}>All In Analytics</h1>
      <p style={styles.subtitle}>Poker session tracking & analysis</p>
      <div style={styles.links}>
        <a
          href={gameActive ? undefined : '#/playback'}
          style={{ ...styles.card, ...(gameActive ? styles.cardDisabled : {}) }}
          data-testid="nav-playback"
          onClick={gameActive ? (e) => e.preventDefault() : undefined}
        >
          <div style={styles.cardIcon}>🎬</div>
          <div style={styles.cardTitle}>Playback</div>
          <div style={styles.cardDesc}>{gameActive ? 'Locked — game in progress' : 'Review recorded sessions'}</div>
        </a>
        <a href="#/dealer" style={styles.card} data-testid="nav-dealer">
          <div style={styles.cardIcon}>🃏</div>
          <div style={styles.cardTitle}>Dealer</div>
          <div style={styles.cardDesc}>Run a live game</div>
        </a>
        <a href="#/player" style={styles.card} data-testid="nav-player">
          <div style={styles.cardIcon}>👤</div>
          <div style={styles.cardTitle}>Player</div>
          <div style={styles.cardDesc}>Join a session</div>
        </a>
        <a href="#/data" style={styles.card} data-testid="nav-data">
          <div style={styles.cardIcon}>📊</div>
          <div style={styles.cardTitle}>Data</div>
          <div style={styles.cardDesc}>Import & export</div>
        </a>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '80vh',
    padding: '2rem',
    fontFamily: 'system-ui, sans-serif',
    color: '#e2e8f0',
  },
  title: {
    fontSize: '2.5rem',
    fontWeight: 700,
    marginBottom: '0.5rem',
    color: '#f1f5f9',
  },
  subtitle: {
    fontSize: '1.1rem',
    color: '#94a3b8',
    marginBottom: '2.5rem',
  },
  links: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: '1rem',
    width: '100%',
    maxWidth: '640px',
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '1.75rem 1.25rem',
    background: 'linear-gradient(135deg, #1e1b4b, #252250)',
    border: '1px solid #3730a3',
    borderRadius: '14px',
    textDecoration: 'none',
    textAlign: 'center',
    color: '#c7d2fe',
    transition: 'transform 0.15s, box-shadow 0.15s, border-color 0.15s',
    cursor: 'pointer',
  },
  cardDisabled: {
    opacity: 0.35,
    cursor: 'not-allowed',
    filter: 'grayscale(0.6)',
    pointerEvents: 'auto',
  },
  cardIcon: {
    fontSize: '2rem',
    marginBottom: '0.5rem',
  },
  cardTitle: {
    fontSize: '1.15rem',
    fontWeight: 600,
    marginBottom: '0.25rem',
    color: '#e0e7ff',
  },
  cardDesc: {
    fontSize: '0.82rem',
    color: '#94a3b8',
    lineHeight: 1.4,
  },
};
