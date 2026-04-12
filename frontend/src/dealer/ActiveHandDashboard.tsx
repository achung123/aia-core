import { useState, useEffect } from 'react';
import type { CommunityCards, Player } from '../stores/dealerStore.ts';
import { fetchBlinds } from '../api/client.ts';
import { isShowdownEnabled } from './showdownHelpers.ts';

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

export interface ActiveHandDashboardProps {
  gameId: number;
  community: CommunityCards;
  players: Player[];
  sbPlayerName: string | null;
  bbPlayerName: string | null;
  onTileSelect: (target: string) => void;
  onDirectOutcome?: (playerName: string) => void;
  onMarkNotPlaying?: (playerName: string) => void;
  canFinish?: boolean;
  onFinishHand?: () => void;
  onShowdown?: () => void;
  onBack?: () => void;
  patchError?: string | null;
}

export function ActiveHandDashboard({
  gameId,
  community,
  players,
  sbPlayerName,
  bbPlayerName,
  onTileSelect,
  onDirectOutcome,
  onMarkNotPlaying,
  canFinish,
  onFinishHand,
  onShowdown,
  onBack,
  patchError,
}: ActiveHandDashboardProps) {
  const [blinds, setBlinds] = useState<{ small_blind: number; big_blind: number } | null>(null);

  useEffect(() => {
    fetchBlinds(gameId)
      .then((data) => setBlinds({ small_blind: data.small_blind, big_blind: data.big_blind }))
      .catch(() => { /* ignore blind fetch errors */ });
  }, [gameId]);

  const boardCards = [
    community.flop1,
    community.flop2,
    community.flop3,
    community.turn,
    community.river,
  ];

  return (
    <div style={styles.container}>
      {/* Blind Info Bar */}
      <div data-testid="blind-info-bar" style={styles.blindBar}>
        <span style={styles.blindLevel}>
          {blinds ? `Blinds: $${blinds.small_blind.toFixed(2)} / $${blinds.big_blind.toFixed(2)}` : 'Blinds: –'}
        </span>
        <span style={styles.blindPlayers}>
          {sbPlayerName && <span>SB: {sbPlayerName}</span>}
          {sbPlayerName && bbPlayerName && <span style={styles.blindSeparator}> | </span>}
          {bbPlayerName && <span>BB: {bbPlayerName}</span>}
        </span>
      </div>

      {/* Community Board */}
      <div data-testid="community-board" style={styles.board}>
        {boardCards.map((card, i) => (
          <div key={i} data-testid={`board-slot-${i}`} style={{
            ...styles.boardSlot,
            ...(card ? styles.boardSlotFilled : {}),
          }}>
            {card || ''}
          </div>
        ))}
      </div>

      {/* Street Buttons */}
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
        <button
          data-testid="showdown-btn"
          style={{
            ...styles.streetTile,
            ...(isShowdownEnabled(community, players) ? {} : styles.streetTileDisabled),
          }}
          onClick={() => isShowdownEnabled(community, players) && onShowdown?.()}
          disabled={!isShowdownEnabled(community, players)}
        >
          <span style={styles.tileName}>Showdown</span>
        </button>
      </div>

      {/* Player Tiles */}
      <div data-testid="player-list" style={styles.playerList}>
        {players.map((p) => {
          const needsAction = p.status === 'handed_back';
          const showOutcomeBtn = onDirectOutcome && needsAction;
          const showSitOutBtn = onMarkNotPlaying && (p.status === 'playing' || p.status === 'idle');
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

      {patchError && (
        <div style={styles.toast}>{patchError}</div>
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
  blindBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.5rem 0.75rem',
    background: '#1e1b4b',
    color: '#e0e7ff',
    borderRadius: '10px',
    marginBottom: '0.75rem',
    fontSize: '0.9rem',
    fontWeight: 600,
  },
  blindLevel: {
    whiteSpace: 'nowrap',
  },
  blindPlayers: {
    fontSize: '0.8rem',
    opacity: 0.85,
  },
  blindSeparator: {
    opacity: 0.5,
  },
  board: {
    display: 'flex',
    gap: '0.4rem',
    justifyContent: 'center',
    marginBottom: '0.75rem',
  },
  boardSlot: {
    width: '52px',
    height: '72px',
    border: '2px dashed #c7d2fe',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.85rem',
    fontWeight: 700,
    color: '#312e81',
    background: '#f5f3ff',
  },
  boardSlotFilled: {
    border: '2px solid #6366f1',
    background: '#eef2ff',
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
    minHeight: '50px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.95rem',
    fontWeight: 'bold',
    border: '2px solid #c7d2fe',
    borderRadius: '12px',
    background: '#eef2ff',
    color: '#312e81',
    cursor: 'pointer',
    padding: '0.5rem 0.25rem',
    WebkitTapHighlightColor: 'transparent',
  },
  streetTileDisabled: {
    opacity: 0.4,
    cursor: 'default',
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
    top: '4px',
    right: '6px',
    fontSize: '0.9rem',
  },
  outcomeButton: {
    padding: '0.25rem 0.5rem',
    fontSize: '1.1rem',
    border: '1px solid #f59e0b',
    borderRadius: '8px',
    background: '#fef3c7',
    cursor: 'pointer',
  },
  sitOutButton: {
    padding: '0.2rem 0.5rem',
    fontSize: '0.75rem',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    background: '#f3f4f6',
    cursor: 'pointer',
    color: '#6b7280',
  },
  finishButton: {
    marginTop: '1rem',
    width: '100%',
    padding: '1rem',
    fontSize: '1.1rem',
    fontWeight: 'bold',
    border: 'none',
    borderRadius: '12px',
    background: '#4f46e5',
    color: '#fff',
    cursor: 'pointer',
  },
  toast: {
    marginTop: '0.75rem',
    padding: '0.75rem',
    background: '#fef2f2',
    color: '#991b1b',
    border: '1px solid #fca5a5',
    borderRadius: '8px',
    fontSize: '0.85rem',
  },
};
