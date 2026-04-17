import { type CSSProperties } from 'react';

export function LandingPage() {
  return (
    <div data-testid="landing-page" style={styles.container}>
      <h1 style={styles.title}>All In Analytics</h1>
      <p style={styles.subtitle}>Poker session tracking &amp; analysis</p>
      <div style={styles.links}>
        <a href="#/analytics" style={styles.card} data-testid="nav-analytics">
          <div style={styles.cardIcon}>📈</div>
          <div style={styles.cardTitle}>Analytics</div>
          <div style={styles.cardDesc}>Leaderboard &amp; player stats</div>
        </a>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
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
