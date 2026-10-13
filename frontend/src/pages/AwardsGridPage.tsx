import type React from 'react';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAwards } from '../hooks/useAnalytics';
import { AwardCard } from '../components/AwardCard';
import { fetchSessions } from '../api/client';
import type { GameSessionListItem } from '../api/types';

export function AwardsGridPage() {
  const [selectedGameId, setSelectedGameId] = useState<number | undefined>(undefined);
  const { data: awards, isLoading, isError } = useAwards(selectedGameId);
  const { data: games } = useQuery<GameSessionListItem[], Error>({
    queryKey: ['gameSessions'],
    queryFn: fetchSessions,
  });

  if (isLoading) {
    return (
      <div data-testid="awards-loading" style={styles.page}>
        <div style={styles.skeleton} />
        <div style={{ ...styles.skeleton, width: '40%' }} />
      </div>
    );
  }

  if (isError) {
    return (
      <div data-testid="awards-error" style={styles.page}>
        <p style={{ color: '#ef4444' }}>Failed to load awards.</p>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <h1 style={styles.heading}>🏆 Awards</h1>

      <select
        data-testid="game-filter-select"
        value={selectedGameId ?? ''}
        onChange={(e) => {
          const val = e.target.value;
          setSelectedGameId(val ? Number(val) : undefined);
        }}
        style={styles.select}
      >
        <option value="">All Games (Global)</option>
        {games?.map((g) => (
          <option key={g.game_id} value={g.game_id}>
            {g.game_date} — {g.player_count} players
          </option>
        ))}
      </select>

      {awards && awards.length === 0 ? (
        <div data-testid="awards-empty" style={styles.empty}>
          No awards yet.
        </div>
      ) : (
        <div data-testid="awards-grid" style={styles.grid}>
          {awards?.map((award) => (
            <Link
              key={award.award_name}
              to={`/players/${award.winner_name}`}
              style={styles.cardLink}
            >
              <AwardCard
                emoji={award.emoji}
                awardName={award.award_name}
                winnerName={award.winner_name}
                statValue={award.stat_value}
                statLabel={award.stat_label}
              />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    padding: '1.5rem',
    maxWidth: 900,
    margin: '0 auto',
    width: '100%',
    boxSizing: 'border-box' as const,
    overflowX: 'hidden' as const,
  },
  heading: {
    fontSize: '1.75rem',
    fontWeight: 700,
    color: '#fff',
    marginBottom: '1rem',
  },
  select: {
    display: 'block',
    marginBottom: '1.5rem',
    padding: '0.5rem 0.75rem',
    borderRadius: 8,
    border: '1px solid #444',
    background: '#1a1a1a',
    color: '#fff',
    fontSize: '0.9rem',
    width: '100%',
    maxWidth: 320,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: '1rem',
  },
  cardLink: {
    textDecoration: 'none',
    color: 'inherit',
    display: 'block',
  },
  empty: {
    color: '#9ca3af',
    textAlign: 'center',
    padding: '3rem 1rem',
    fontSize: '1rem',
  },
  skeleton: {
    height: '1.5rem',
    background: '#333',
    borderRadius: 4,
    marginBottom: '0.75rem',
    width: '60%',
  },
};
