import type { CommunityCards, Player, GameMode } from '../stores/dealerStore.ts';

const statusColors: Record<string, string> = {
  playing: '#ffffff',
  won: '#bbf7d0',
  folded: '#fecaca',
  lost: '#fed7aa',
  not_playing: '#e5e7eb',
  pending: '#fef08a',
  joined: '#bbf7d0',
  handed_back: '#fef08a',
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
  gameMode?: GameMode;
  canFinish?: boolean;
  onFinishHand?: () => void;
  onBack?: () => void;
}

export function PlayerGrid({ players, community, onTileSelect, onDirectOutcome, onMarkNotPlaying, gameMode, canFinish, onFinishHand, onBack }: PlayerGridProps) {
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
          {community.flopRecorded && <span style={styles.check}>✅</span>}
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
          {community.turnRecorded && <span style={styles.check}>✅</span>}
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
          {community.riverRecorded && <span style={styles.check}>✅</span>}
        </button>
      </div>

      <div data-testid="player-list" style={styles.playerList}>
        {players.map((p) => {
          const needsAction = gameMode === 'participation' && p.status === 'handed_back';
          const showOutcomeBtn = onDirectOutcome && (gameMode !== 'participation' || needsAction);
          const showSitOutBtn = onMarkNotPlaying && gameMode === 'participation' && (p.status === 'playing' || p.status === 'idle');
          return (
            <div
              key={p.name}
              data-testid={`player-row-${p.name}`}
              style={{
                ...styles.playerRow,
                backgroundColor: statusColors[p.status] || '#ffffff',
                ...(needsAction ? { borderColor: '#f59e0b', boxShadow: '0 0 0 2px #fbbf24' } : {}),
              }}
            >
              <button
                data-testid={`player-tile-${p.name}`}
                style={styles.playerNameCol}
                onClick={() => onTileSelect(p.name)}
              >
                <span style={styles.tileName}>{p.name}</span>
                {p.recorded && <span style={styles.inlineCheck}>✅</span>}
              </button>
              <div style={styles.statusCol}>
                <span style={styles.statusText}>
                  {needsAction ? '⚠️ Decide outcome' : formatStatus(p.status, p.outcomeStreet)}
                </span>
                {showOutcomeBtn && (
                  <button
                    data-testid={`outcome-btn-${p.name}`}
                    style={styles.outcomeButton}
                    onClick={() => onDirectOutcome(p.name)}
                  >
                    📋
                  </button>
                )}
                {showSitOutBtn && (
                  <button
                    data-testid={`sitout-btn-${p.name}`}
                    style={styles.sitOutButton}
                    onClick={() => onMarkNotPlaying(p.name)}
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
    fontWeight: 'bold',
    border: '2px solid #c7d2fe',
    borderRadius: '12px',
    background: '#eef2ff',
    color: '#312e81',
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
    fontWeight: 'bold',
    border: '2px solid #c7d2fe',
    borderRadius: '12px',
    background: '#eef2ff',
    color: '#312e81',
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
    border: '2px solid #c7d2fe',
    borderRadius: '12px',
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
    fontWeight: 'bold',
    border: 'none',
    background: 'transparent',
    color: '#312e81',
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
    color: '#555',
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
    background: '#e0e7ff',
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
    fontWeight: 'bold',
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
    border: '1px solid #9ca3af',
    borderRadius: '6px',
    background: '#e5e7eb',
    color: '#374151',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    WebkitTapHighlightColor: 'transparent',
  },
};
