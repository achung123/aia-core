import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePlayerStats, usePlayerTrends } from '../hooks/useAnalytics';
import { PlayerSelector } from '../components/PlayerSelector';
import { StatCard } from '../components/StatCard';
import { WinRateTrendChart } from '../components/WinRateTrendChart';
import { OutcomeDonutCharts } from '../components/OutcomeDonutCharts';
import { SessionHistoryTable } from '../components/SessionHistoryTable';
import { PnLCandlestickChart } from '../components/PnLCandlestickChart';

export function PlayerProfilePage() {
  const { playerName } = useParams<{ playerName: string }>();
  const navigate = useNavigate();
  const name = decodeURIComponent(playerName ?? '');
  const { data: stats, isLoading, isError } = usePlayerStats(name);
  const { data: trends } = usePlayerTrends(name);

  useEffect(() => {
    if (name) {
      document.title = `${name} — Player Profile`;
    }
    return () => {
      document.title = '';
    };
  }, [name]);

  function handlePlayerSelect(selected: string) {
    navigate(`/players/${encodeURIComponent(selected)}`);
  }

  const fmtPct = (v: number | null | undefined) =>
    v === null || v === undefined ? null : `${v}%`;

  let content: React.ReactNode;
  if (isLoading) {
    content = (
      <div data-testid="profile-loading">
        <div style={{ height: '2rem', background: '#e0e0e0', borderRadius: 4, marginBottom: '1rem', width: '50%' }} />
        <div style={{ height: '4rem', background: '#e0e0e0', borderRadius: 4, marginBottom: '1rem' }} />
        <div style={{ height: '4rem', background: '#e0e0e0', borderRadius: 4, marginBottom: '1rem' }} />
      </div>
    );
  } else if (isError) {
    content = (
      <div data-testid="profile-error">
        <p>Failed to load stats for {name}.</p>
      </div>
    );
  } else {
    content = (
      <div data-testid="profile-stats">
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Overview</h2>
          <div style={styles.grid}>
            <StatCard label="Total Hands" value={stats?.total_hands_played ?? null} />
            <StatCard label="Hands Won" value={stats?.hands_won ?? null} />
            <StatCard label="Hands Lost" value={stats?.hands_lost ?? null} />
            <StatCard label="Hands Folded" value={stats?.hands_folded ?? null} />
            <StatCard label="Win Rate" value={fmtPct(stats?.win_rate)} />
            <StatCard
              label="P&L"
              value={stats ? (stats.total_profit_loss < 0 ? `-$${Math.abs(stats.total_profit_loss).toFixed(2)}` : `$${stats.total_profit_loss.toFixed(2)}`) : null}
              trend={
                stats
                  ? stats.total_profit_loss > 0
                    ? 'up'
                    : stats.total_profit_loss < 0
                      ? 'down'
                      : 'neutral'
                  : undefined
              }
            />
          </div>
        </section>

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Street Percentages</h2>
          <div style={styles.grid}>
            <StatCard label="Flop %" value={fmtPct(stats?.flop_pct)} />
            <StatCard label="Turn %" value={fmtPct(stats?.turn_pct)} />
            <StatCard label="River %" value={fmtPct(stats?.river_pct)} />
          </div>
        </section>

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Win Rate Trend</h2>
          <WinRateTrendChart data={trends ?? []} />
        </section>

        {stats && (
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Outcome Charts</h2>
            <OutcomeDonutCharts stats={stats} />
          </section>
        )}

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>P&L Candlestick</h2>
          <PnLCandlestickChart data={trends ?? []} />
        </section>
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Session History</h2>
          <SessionHistoryTable data={trends ?? []} />
        </section>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <h1 style={styles.heading}>{name}</h1>
      <div style={styles.selectorWrapper}>
        <PlayerSelector onSelect={handlePlayerSelect} value={name} placeholder="Switch player…" />
      </div>
      {content}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    padding: '1rem',
    maxWidth: '600px',
    margin: '0 auto',
  },
  heading: {
    fontSize: '1.5rem',
    fontWeight: 700,
    marginBottom: '0.75rem',
  },
  selectorWrapper: {
    marginBottom: '1.5rem',
  },
  section: {
    marginBottom: '1.5rem',
  },
  sectionTitle: {
    fontSize: '1rem',
    fontWeight: 600,
    marginBottom: '0.5rem',
    color: '#9ca3af',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: '0.75rem',
  },
};
