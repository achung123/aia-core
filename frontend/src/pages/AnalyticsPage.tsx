import type React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchLeaderboard } from '../api/client';
import type { LeaderboardEntry } from '../api/types';

export function AnalyticsPage() {
  const { data: leaderboard, isLoading, isError } = useQuery<LeaderboardEntry[], Error>({
    queryKey: ['leaderboard'],
    queryFn: fetchLeaderboard,
  });

  return (
    <div style={styles.page}>
      <h1 style={styles.heading}>📊 Analytics</h1>

      {/* Leaderboard Section */}
      <section style={styles.section}>
        <h2 style={styles.subheading}>Leaderboard</h2>
        {isLoading && (
          <div data-testid="leaderboard-loading" style={styles.skeleton} />
        )}
        {isError && (
          <div data-testid="leaderboard-error" style={{ color: '#ef4444' }}>
            Failed to load leaderboard.
          </div>
        )}
        {leaderboard && (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Rank</th>
                <th style={styles.th}>Player</th>
                <th style={styles.th}>Profit / Loss</th>
                <th style={styles.th}>Win Rate</th>
                <th style={styles.th}>Hands</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((entry) => (
                <tr key={entry.player_name} style={styles.row}>
                  <td style={styles.td}>{entry.rank}</td>
                  <td style={styles.td}>
                    <Link to={`/players/${entry.player_name}`} style={styles.playerLink}>
                      {entry.player_name}
                    </Link>
                  </td>
                  <td
                    data-testid={`profit-${entry.player_name}`}
                    style={{
                      ...styles.td,
                      color: entry.total_profit_loss >= 0 ? '#22c55e' : '#ef4444',
                      fontWeight: 600,
                    }}
                  >
                    {entry.total_profit_loss >= 0 ? '+' : ''}
                    {entry.total_profit_loss.toFixed(2)}
                  </td>
                  <td style={styles.td}>{(entry.win_rate * 100).toFixed(0)}%</td>
                  <td style={styles.td}>{entry.hands_played}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Navigation Cards */}
      <section style={styles.section}>
        <h2 style={styles.subheading}>Explore</h2>
        <div style={styles.cardGrid}>
          <Link to="/games" style={styles.card}>
            <span style={styles.cardEmoji}>🎰</span>
            <span style={styles.cardLabel}>Game Sessions</span>
            <span style={styles.cardDesc}>Browse game sessions and recaps</span>
          </Link>
          <Link to="/head-to-head" style={styles.card}>
            <span style={styles.cardEmoji}>⚔️</span>
            <span style={styles.cardLabel}>Head to Head</span>
            <span style={styles.cardDesc}>Compare two players</span>
          </Link>
          <Link to="/awards" style={styles.card}>
            <span style={styles.cardEmoji}>🏆</span>
            <span style={styles.cardLabel}>Awards</span>
            <span style={styles.cardDesc}>Superlative awards and trophies</span>
          </Link>
        </div>
      </section>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    padding: '1.5rem',
    maxWidth: 900,
    margin: '0 auto',
  },
  heading: {
    fontSize: '1.75rem',
    fontWeight: 700,
    color: '#fff',
    marginBottom: '1rem',
  },
  subheading: {
    fontSize: '1.25rem',
    fontWeight: 600,
    color: '#e2e8f0',
    marginBottom: '0.75rem',
  },
  section: {
    marginBottom: '2rem',
  },
  skeleton: {
    height: 80,
    borderRadius: 8,
    background: 'linear-gradient(90deg, #1e1b4b 25%, #252250 50%, #1e1b4b 75%)',
    animation: 'pulse 1.5s ease-in-out infinite',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    background: '#16171d',
    borderRadius: 12,
    overflow: 'hidden',
  },
  th: {
    textAlign: 'left' as const,
    padding: '0.75rem 1rem',
    color: '#94a3b8',
    fontSize: '0.8rem',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    borderBottom: '1px solid #333',
  },
  row: {
    borderBottom: '1px solid #222',
  },
  td: {
    padding: '0.65rem 1rem',
    color: '#e2e8f0',
    fontSize: '0.95rem',
  },
  playerLink: {
    color: '#818cf8',
    textDecoration: 'none',
    fontWeight: 500,
  },
  cardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: '1rem',
  },
  card: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '0.5rem',
    padding: '1.5rem 1rem',
    background: 'linear-gradient(135deg, #1e1b4b, #252250)',
    border: '1px solid #3730a3',
    borderRadius: '14px',
    textDecoration: 'none',
    color: '#f3f4f6',
    transition: 'transform 0.15s, box-shadow 0.15s',
  },
  cardEmoji: {
    fontSize: '2rem',
  },
  cardLabel: {
    fontSize: '1.1rem',
    fontWeight: 600,
  },
  cardDesc: {
    fontSize: '0.8rem',
    color: '#94a3b8',
    textAlign: 'center' as const,
  },
};
