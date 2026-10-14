import type { CommunityCards, Player } from '../stores/dealerStore.ts';
import { theme } from '../theme';

const statusColors: Record<string, string> = {
  playing: '#ffffff',
  won: 'rgba(34, 197, 94, 0.18)',
  folded: 'rgba(220, 38, 38, 0.2)',
  lost: 'rgba(234, 88, 12, 0.18)',
  not_playing: theme.textSecondary,
  pending: 'rgba(250, 204, 21, 0.14)',
  joined: 'rgba(34, 197, 94, 0.18)',
  handed_back: 'rgba(250, 204, 21, 0.14)',
};

function formatStatus(status: string, outcomeStreet: string | null): string {
  if (status === 'not_playing') return 'not playing';
  if (status === 'handed_back') return 'handed back';
  if (status === 'idle') return 'playing';
  if (outcomeStreet) return `${status} on ${outcomeStreet}`;
  return status;
}

export interface PlayerGridProps {
  players: Player[];
  community: CommunityCards;
  onTileSelect: (target: string) => void;
  onDirectOutcome?: (playerName: string) => void;
  onMarkNotPlaying?: (playerName: string) => void;
  canFinish?: boolean;
  onFinishHand?: () => void;
  onBack?: () => void;
}

export function PlayerGrid({ players, community, onTileSelect, onDirectOutcome, onMarkNotPlaying, canFinish, onFinishHand, onBack }: PlayerGridProps) {
  return (
    <div style={styles.container}>
      <h2 style={styles.heading}>Select a Player</h2>
      {onBack && (
        <button data-testid="back-btn" onClick={onBack} style={styles.backButton}>
          Back to Hands
        </button>
      )}

      <div data-testid="street-buttons" style={styles.streetRow}>
        <button
          data-testid="flop-tile"
          style={styles.streetTile}
          onClick={() => onTileSelect('flop')}
        >
          <span style={styles.tileName}>Flop</span>
          {community.flopRecorded && <span style={styles.check}>✓</span>}
        </button>
        <button
          data-testid="turn-tile"
          style={{
            ...styles.streetTile,
            ...(community.flopRecorded ? {} : styles.streetTileDisabled),
          }}
          onClick={() => community.flopRecorded && onTileSelect('turn')}
          disabled={!community.flopRecorded}
        >
          <span style={styles.tileName}>Turn</span>
          {community.turnRecorded && <span style={styles.check}>✓</span>}
        </button>
        <button
          data-testid="river-tile"
          style={{
            ...styles.streetTile,
            ...(community.turnRecorded ? {} : styles.streetTileDisabled),
          }}
          onClick={() => community.turnRecorded && onTileSelect('river')}
          disabled={!community.turnRecorded}
        >
          <span style={styles.tileName}>River</span>
          {community.riverRecorded && <span style={styles.check}>✓</span>}
        </button>
      </div>

      <div data-testid="player-list" style={styles.playerList}>
        {players.map((player) => {
          const needsAction = player.status === 'handed_back';
          const showOutcomeBtn = onDirectOutcome && needsAction;
          const showSitOutBtn = onMarkNotPlaying && (player.status === 'playing' || player.status === 'idle');
          return (
            <div
              key={player.name}
              data-testid={`player-row-${player.name}`}
              style={{
                ...styles.playerRow,
                backgroundColor: statusColors[player.status] || '#ffffff',
                ...(needsAction ? { borderColor: '#f59e0b', boxShadow: '0 0 0 2px #fbbf24' } : {}),
              }}
            >
              <button
                data-testid={`player-tile-${player.name}`}
                style={styles.playerNameCol}
                onClick={() => onTileSelect(player.name)}
              >
                <span style={styles.tileName}>{player.name}</span>
              </button>
              <div style={styles.statusCol}>
                <span style={styles.statusText}>
                  {needsAction ? 'Decide outcome' : formatStatus(player.status, player.outcomeStreet)}
                </span>
                {showOutcomeBtn && (
                  <button
                    data-testid={`outcome-btn-${player.name}`}
                    style={styles.outcomeButton}
                    onClick={() => onDirectOutcome(player.name)}
                  >
                    📋
                  </button>
                )}
                {showSitOutBtn && (
                  <button
                    data-testid={`sitout-btn-${player.name}`}
                    style={styles.sitOutButton}
                    onClick={() => onMarkNotPlaying(player.name)}
                  >
                    Sit Out
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {canFinish && (
        <button
          style={styles.finishButton}
          onClick={onFinishHand}
        >
          Finish Hand
        </button>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
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
  streetRow: {
    display: 'flex',
    gap: '0.5rem',
    marginBottom: '0.75rem',
  },
  streetTile: {
    position: 'relative',
    flex: 1,
    minHeight: '60px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.1rem',
    fontWeight: 600,
    border: `2px solid ${theme.accentBorder}`,
    borderRadius: '8px',
    background: theme.accentTint,
    color: theme.text,
    cursor: 'pointer',
    padding: '0.75rem 0.5rem',
    WebkitTapHighlightColor: 'transparent',
  },
  streetTileDisabled: {
    opacity: 0.4,
    cursor: 'default',
  },
  tableTile: {
    position: 'relative',
    width: '100%',
    minHeight: '60px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.1rem',
    fontWeight: 600,
    border: `2px solid ${theme.accentBorder}`,
    borderRadius: '8px',
    background: theme.accentTint,
    color: theme.text,
    cursor: 'pointer',
    padding: '0.75rem 1rem',
    marginBottom: '0.75rem',
    WebkitTapHighlightColor: 'transparent',
  },
  playerList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  playerRow: {
    display: 'flex',
    alignItems: 'center',
    border: `2px solid ${theme.accentBorder}`,
    borderRadius: '8px',
    overflow: 'hidden',
    minHeight: '56px',
  },
  playerNameCol: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1rem',
    fontSize: '1.1rem',
    fontWeight: 600,
    border: 'none',
    background: 'transparent',
    color: theme.text,
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
    minHeight: '48px',
  },
  statusCol: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 1rem',
    minWidth: '80px',
    justifyContent: 'flex-end',
  },
  tileName: {
    textAlign: 'center' as const,
  },
  statusText: {
    fontSize: '0.85rem',
    fontWeight: '600',
    color: theme.muted,
    textTransform: 'capitalize',
  },
  inlineCheck: {
    fontSize: '1rem',
  },
  check: {
    position: 'absolute',
    top: '6px',
    right: '6px',
    fontSize: '1.2rem',
  },
  outcomeButton: {
    width: '32px',
    height: '32px',
    fontSize: '0.9rem',
    border: 'none',
    borderRadius: '6px',
    background: theme.accentTint,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    WebkitTapHighlightColor: 'transparent',
  },
  finishButton: {
    width: '100%',
    padding: '0.75rem',
    minHeight: '48px',
    fontSize: '1.1rem',
    fontWeight: 600,
    border: 'none',
    borderRadius: '8px',
    background: '#16a34a',
    color: '#fff',
    cursor: 'pointer',
    marginTop: '1rem',
  },
  sitOutButton: {
    padding: '0.25rem 0.6rem',
    fontSize: '0.75rem',
    fontWeight: '600',
    border: `1px solid ${theme.muted}`,
    borderRadius: '6px',
    background: theme.raisedHover,
    color: theme.textSecondary,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    WebkitTapHighlightColor: 'transparent',
  },
};
