import type React from 'react';
import type { GameStatsPlayerEntry } from '../api/types';
import { StatCard } from './StatCard';

export interface PlayerSummaryCardsProps {
  players: GameStatsPlayerEntry[];
}

function formatPL(value: number): string | null {
  if (value === 0) return null;
  if (value > 0) return `$${value.toFixed(2)}`;
  return `-$${Math.abs(value).toFixed(2)}`;
}

export function PlayerSummaryCards({ players }: PlayerSummaryCardsProps) {
  const maxPL = players.length > 0 ? Math.max(...players.map((p) => p.profit_loss)) : 0;
  const hasWinner = maxPL > 0;

  return (
    <div
      data-testid="player-summary-cards"
      style={styles.scrollContainer}
    >
      {players.map((player) => {
        const isWinner = hasWinner && player.profit_loss === maxPL;
        return (
          <div
            key={player.player_name}
            data-testid={`player-card-${player.player_name}`}
            style={{
              ...styles.card,
              ...(isWinner ? styles.winnerCard : {}),
            }}
          >
            <div style={styles.nameRow}>
              {isWinner && <span style={styles.trophy}>🏆</span>}
              <span style={styles.playerName}>{player.player_name}</span>
            </div>
            <div style={styles.statsGrid}>
              <StatCard label="Hands" value={player.hands_played} />
              <StatCard label="Wins" value={player.hands_won} />
              <StatCard label="Losses" value={player.hands_lost} />
              <StatCard label="Folds" value={player.hands_folded} />
              <StatCard label="Win Rate" value={`${player.win_rate}%`} />
              <StatCard
                label="P&L"
                value={formatPL(player.profit_loss)}
                trend={player.profit_loss > 0 ? 'up' : player.profit_loss < 0 ? 'down' : undefined}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  scrollContainer: {
    display: 'flex',
    flexDirection: 'row',
    gap: '12px',
    overflowX: 'auto',
    paddingBottom: '8px',
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '16px',
    background: '#111',
    borderRadius: '12px',
    border: '1px solid #333',
    minWidth: '260px',
    flexShrink: 0,
  },
  winnerCard: {
    borderColor: '#f59e0b',
    borderWidth: '2px',
  },
  nameRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  trophy: {
    fontSize: '1.25rem',
  },
  playerName: {
    fontSize: '1.125rem',
    fontWeight: 700,
    color: '#fff',
  },
  statsGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
  },
};
