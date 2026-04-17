import { useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchGameStats, fetchHands, fetchAwards, fetchGameHighlights } from '../api/client';
import type { GameStatsResponse, AwardEntry, GameHighlight, HandResponse } from '../api/types';
import { PlayerSummaryCards } from '../components/PlayerSummaryCards';
import { HandTimeline } from '../components/HandTimeline';
import { KeyMomentsSection } from '../components/KeyMomentsSection';
import { AwardCard } from '../components/AwardCard';

export function GameRecapPage() {
  const { gameId } = useParams<{ gameId: string }>();
  const id = Number(gameId);

  const statsQuery = useQuery<GameStatsResponse, Error>({
    queryKey: ['gameStats', id],
    queryFn: () => fetchGameStats(id),
    enabled: id > 0,
  });

  const handsQuery = useQuery<HandResponse[], Error>({
    queryKey: ['hands', id],
    queryFn: () => fetchHands(id),
    enabled: id > 0,
  });

  const awardsQuery = useQuery<AwardEntry[], Error>({
    queryKey: ['awards', id],
    queryFn: () => fetchAwards(id),
    enabled: id > 0,
  });

  const highlightsQuery = useQuery<GameHighlight[], Error>({
    queryKey: ['gameHighlights', id],
    queryFn: () => fetchGameHighlights(id),
    enabled: id > 0,
  });

  const isLoading = statsQuery.isLoading || handsQuery.isLoading || awardsQuery.isLoading || highlightsQuery.isLoading;
  const isError = statsQuery.isError || handsQuery.isError || awardsQuery.isError || highlightsQuery.isError;

  const scrollToHand = useCallback((handNumber: number) => {
    const el = document.querySelector(`[data-hand-number="${handNumber}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  if (isLoading) {
    return (
      <div data-testid="recap-loading" style={{ padding: '1rem' }}>
        <div style={{ height: '2rem', background: '#e0e0e0', borderRadius: 4, marginBottom: '1rem', width: '50%' }} />
        <div style={{ height: '6rem', background: '#e0e0e0', borderRadius: 4, marginBottom: '1rem' }} />
        <div style={{ height: '4rem', background: '#e0e0e0', borderRadius: 4, marginBottom: '1rem' }} />
        <div style={{ height: '4rem', background: '#e0e0e0', borderRadius: 4, marginBottom: '1rem' }} />
        <div style={{ height: '4rem', background: '#e0e0e0', borderRadius: 4 }} />
      </div>
    );
  }

  if (isError) {
    return <div data-testid="recap-error" style={{ padding: '1rem', color: 'red' }}>Failed to load game recap.</div>;
  }

  const stats = statsQuery.data;

  return (
    <div style={{ padding: '1rem', maxWidth: 600, margin: '0 auto', width: '100%', boxSizing: 'border-box' as const, overflowX: 'hidden' as const }}>
      {/* Summary */}
      <section data-testid="recap-summary" style={{ marginBottom: '1.5rem' }}>
        <h1>Game Recap</h1>
        {stats && (
          <>
            <div style={{ fontSize: '1.125rem', fontWeight: 'bold' }}>{stats.game_date}</div>
            <div style={{ color: '#666' }}>{stats.total_hands} hands &middot; {stats.player_stats.length} players</div>
          </>
        )}
      </section>

      {/* Player Summary Cards */}
      {stats && stats.player_stats.length > 0 && (
        <section data-testid="recap-player-summaries" style={{ marginBottom: '1.5rem' }}>
          <h2>Players</h2>
          <PlayerSummaryCards players={stats.player_stats} />
        </section>
      )}

      {/* Timeline */}
      <section data-testid="recap-timeline" style={{ marginBottom: '1.5rem' }}>
        <h2>Timeline</h2>
        {handsQuery.data && handsQuery.data.length > 0 ? (
          <HandTimeline hands={handsQuery.data} />
        ) : (
          <div style={{ color: '#999' }}>No hand data available.</div>
        )}
      </section>

      {/* Key Moments */}
      {highlightsQuery.data && highlightsQuery.data.length > 0 && (
        <KeyMomentsSection
          highlights={highlightsQuery.data}
          onHighlightClick={scrollToHand}
        />
      )}

      {/* Awards */}
      {awardsQuery.data && awardsQuery.data.length > 0 && (
        <section data-testid="recap-awards" style={{ marginBottom: '1.5rem' }}>
          <h2>Awards</h2>
          <div style={{ display: 'flex', gap: '12px', overflowX: 'auto' }}>
            {awardsQuery.data.slice(0, 3).map((a, i) => (
              <Link
                key={i}
                to={`/players/${a.winner_name}`}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div data-testid={`award-card-${i}`}>
                  <AwardCard
                    emoji={a.emoji}
                    awardName={a.award_name}
                    winnerName={a.winner_name}
                    statValue={a.stat_value}
                    statLabel={a.stat_label}
                  />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
