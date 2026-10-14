import { type CSSProperties } from 'react';
import { theme } from '../theme';

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
    color: theme.text,
  },
  title: {
    fontSize: '2.5rem',
    fontWeight: 700,
    marginBottom: '0.5rem',
    color: theme.text,
  },
  subtitle: {
    fontSize: '1.1rem',
    color: theme.muted,
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
    background: theme.accentSurface,
    border: `1px solid ${theme.accentBorder}`,
    borderRadius: '14px',
    textDecoration: 'none',
    textAlign: 'center',
    color: theme.accentSoft,
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
    color: theme.accentSoft,
  },
  cardDesc: {
    fontSize: '0.82rem',
    color: theme.muted,
    lineHeight: 1.4,
  },
};
