import { useState, useEffect } from 'react';
import type { CommunityCards, Player } from '../stores/dealerStore.ts';
import { recordPlayerAction, fetchHands } from '../api/client.ts';
import { TableView3D } from './TableView3D.tsx';
import { BlindTimer } from './BlindTimer.tsx';
import type { ActionEnum, StreetEnum, HandResponse } from '../api/types.ts';

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
  handNumber?: number;
  community: CommunityCards;
  players: Player[];
  sbPlayerName: string | null;
  bbPlayerName: string | null;
  onTileSelect: (target: string) => void;
  onDirectOutcome?: (playerName: string) => void;
  onMarkNotPlaying?: (playerName: string) => void;
  canFinish?: boolean;
  onFinishHand?: () => void;
  onBack?: () => void;
  patchError?: string | null;
  // Betting verification
  currentPlayerName?: string | null;
  legalActions?: string[];
  amountToCall?: number;
  pot?: number;
  streetComplete?: boolean;
  handPhase?: string;
  onActionConfirmed?: () => void;
}

export function ActiveHandDashboard({
  gameId,
  handNumber,
  community,
  players,
  sbPlayerName,
  bbPlayerName,
  onTileSelect,
  onDirectOutcome,
  onMarkNotPlaying,
  canFinish,
  onFinishHand,
  onBack,
  patchError,
  currentPlayerName,
  legalActions,
  amountToCall,
  pot,
  streetComplete,
  handPhase,
  onActionConfirmed,
}: ActiveHandDashboardProps) {
  const [isWide, setIsWide] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(min-width: 600px)').matches,
  );
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideAction, setOverrideAction] = useState<ActionEnum>('call');
  const [overrideAmount, setOverrideAmount] = useState('');
  const [betVerifyError, setBetVerifyError] = useState<string | null>(null);
  const [betVerifyLoading, setBetVerifyLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'tile' | '3d'>('tile');
  const [hands3D, setHands3D] = useState<HandResponse[]>([]);

  useEffect(() => {
    const mql = window.matchMedia('(min-width: 600px)');
    const handler = (e: MediaQueryListEvent) => setIsWide(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  const boardCards = [
    community.flop1,
    community.flop2,
    community.flop3,
    community.turn,
    community.river,
  ];

  function deriveStreet(): StreetEnum {
    if (community.riverRecorded) return 'river';
    if (community.turnRecorded) return 'turn';
    if (community.flopRecorded) return 'flop';
    return 'preflop';
  }

  async function handleOverrideSubmit() {
    if (!handNumber || !currentPlayerName) return;
    setBetVerifyLoading(true);
    setBetVerifyError(null);
    const parsedAmount = overrideAmount ? parseFloat(overrideAmount) : null;
    try {
      await recordPlayerAction(gameId, handNumber, currentPlayerName, {
        street: deriveStreet(),
        action: overrideAction,
        amount: parsedAmount,
      });
      setOverrideOpen(false);
      setOverrideAmount('');
      onActionConfirmed?.();
    } catch (err) {
      setBetVerifyError(err instanceof Error ? err.message : String(err));
    } finally {
      setBetVerifyLoading(false);
    }
  }

  return (
    <div style={isWide ? styles.containerWide : styles.container}>
      {/* 3D View Toggle */}
      <button
        data-testid="view-toggle-btn"
        onClick={() => {
          setViewMode((v) => {
            const next = v === 'tile' ? '3d' : 'tile';
            if (next === '3d') {
              fetchHands(gameId).then(setHands3D).catch(() => {});
            }
            return next;
          });
        }}
        style={styles.viewToggleButton}
      >
        {viewMode === 'tile' ? '3D View' : 'Tile View'}
      </button>

      {viewMode === '3d' ? (
        <TableView3D hands={hands3D} />
      ) : (
      <>
      {/* Blind Info Bar */}
      <div data-testid="blind-info-bar" style={styles.blindBarSticky}>
        <BlindTimer gameId={gameId} />
        <span style={styles.blindPlayers}>
          {sbPlayerName && <span>SB: {sbPlayerName}</span>}
          {sbPlayerName && bbPlayerName && <span style={styles.blindSeparator}> | </span>}
          {bbPlayerName && <span>BB: {bbPlayerName}</span>}
        </span>
      </div>

      <div data-testid="active-hand-layout" style={isWide ? styles.splitLayout : styles.stackedLayout}>
        {/* Board Panel — community cards + street buttons */}
        <div data-testid="board-panel" style={isWide ? styles.panelScroll : styles.panelStack}>
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
              style={{
                ...styles.streetTile,
                ...(streetComplete === false && !community.flopRecorded ? styles.streetTileDisabled : {}),
              }}
              onClick={() => (streetComplete !== false || community.flopRecorded) && onTileSelect('flop')}
              disabled={streetComplete === false && !community.flopRecorded}
            >
              <span style={styles.tileName}>Flop</span>
              {community.flopRecorded && <span style={styles.check}>✅</span>}
            </button>
            <button
              data-testid="turn-tile"
              style={{
                ...styles.streetTile,
                ...(community.flopRecorded && streetComplete !== false ? {} : styles.streetTileDisabled),
              }}
              onClick={() => community.flopRecorded && streetComplete !== false && onTileSelect('turn')}
              disabled={!community.flopRecorded || streetComplete === false}
            >
              <span style={styles.tileName}>Turn</span>
              {community.turnRecorded && <span style={styles.check}>✅</span>}
            </button>
            <button
              data-testid="river-tile"
              style={{
                ...styles.streetTile,
                ...(community.turnRecorded && streetComplete !== false ? {} : styles.streetTileDisabled),
              }}
              onClick={() => community.turnRecorded && streetComplete !== false && onTileSelect('river')}
              disabled={!community.turnRecorded || streetComplete === false}
            >
              <span style={styles.tileName}>River</span>
              {community.riverRecorded && <span style={styles.check}>✅</span>}
            </button>
          </div>
        </div>

        {/* Bet Verification Panel */}
        {handNumber && (
          <div data-testid="bet-verify-panel" style={styles.betVerifyPanel}>
            <div style={styles.betVerifyHeader}>
              <span style={styles.betVerifyLabel}>
                {handPhase === 'awaiting_cards'
                  ? 'Waiting for cards…'
                  : currentPlayerName
                    ? `Turn: ${currentPlayerName}`
                    : 'Waiting for turn…'}
              </span>
              {pot !== undefined && pot > 0 && (
                <span data-testid="pot-display" style={styles.potBadge}>Pot: ${pot.toFixed(2)}</span>
              )}
            </div>
            {currentPlayerName && legalActions && legalActions.length > 0 && (
              <div style={styles.betVerifyActions}>
                <span data-testid="legal-actions-display" style={styles.legalActionsText}>
                  Legal: {legalActions.join(', ')}
                  {amountToCall ? ` ($${amountToCall.toFixed(2)} to call)` : ''}
                </span>
                <div style={styles.betVerifyBtnRow}>
                  <button
                    data-testid="record-action-btn"
                    style={styles.overrideBtn}
                    onClick={() => setOverrideOpen(!overrideOpen)}
                    disabled={betVerifyLoading}
                  >
                    Record Action
                  </button>
                </div>
              </div>
            )}
            {overrideOpen && currentPlayerName && (
              <div data-testid="override-form" style={styles.overrideForm}>
                <select
                  data-testid="override-action-select"
                  value={overrideAction}
                  onChange={(e) => setOverrideAction(e.target.value as ActionEnum)}
                  style={styles.overrideSelect}
                >
                  <option value="fold">Fold</option>
                  <option value="check">Check</option>
                  <option value="call">Call</option>
                  <option value="bet">Bet</option>
                  <option value="raise">Raise</option>
                </select>
                <input
                  data-testid="override-amount-input"
                  type="number"
                  placeholder="Amount"
                  value={overrideAmount}
                  onChange={(e) => setOverrideAmount(e.target.value)}
                  style={styles.overrideInput}
                  step="0.01"
                  min="0"
                />
                <button
                  data-testid="override-submit-btn"
                  style={styles.confirmBtn}
                  onClick={handleOverrideSubmit}
                  disabled={betVerifyLoading}
                >
                  Submit
                </button>
              </div>
            )}
            {betVerifyError && (
              <div data-testid="bet-verify-error" style={styles.toast}>{betVerifyError}</div>
            )}
          </div>
        )}

        {/* Player Panel — player tiles + finish button */}
        <div data-testid="player-panel" style={isWide ? styles.panelScroll : styles.panelStack}>
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
        </div>
      </div>

      {patchError && (
        <div style={styles.toast}>{patchError}</div>
      )}
      </>
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
  containerWide: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    maxWidth: '600px',
    margin: '0 auto',
    padding: '1rem',
  },
  viewToggleButton: {
    width: '100%',
    padding: '0.5rem',
    minHeight: '40px',
    fontSize: '0.95rem',
    fontWeight: 600,
    border: '1px solid #4f46e5',
    borderRadius: '8px',
    background: '#eef2ff',
    color: '#4f46e5',
    cursor: 'pointer',
    marginBottom: '0.75rem',
  },
  blindBarSticky: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '0.5rem 0.75rem',
    background: '#1e1b4b',
    color: '#e0e7ff',
    borderRadius: '10px',
    marginBottom: '0.75rem',
    fontSize: '0.9rem',
    fontWeight: 600,
    position: 'sticky',
    top: 0,
    zIndex: 10,
  },
  splitLayout: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
  },
  stackedLayout: {
    display: 'flex',
    flexDirection: 'column',
  },
  panelScroll: {
    flex: 1,
    overflowY: 'auto',
    minHeight: 0,
    padding: '0.25rem 0',
  },
  panelStack: {
    padding: '0.25rem 0',
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
  betVerifyPanel: {
    padding: '0.75rem',
    marginBottom: '0.75rem',
    border: '2px solid #c7d2fe',
    borderRadius: '12px',
    background: '#f5f3ff',
  },
  betVerifyHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.5rem',
  },
  betVerifyLabel: {
    fontWeight: 700,
    fontSize: '1rem',
    color: '#312e81',
  },
  potBadge: {
    fontSize: '0.85rem',
    fontWeight: 600,
    color: '#4f46e5',
    background: '#eef2ff',
    padding: '0.2rem 0.5rem',
    borderRadius: '6px',
  },
  betVerifyActions: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem',
  },
  legalActionsText: {
    fontSize: '0.85rem',
    color: '#555',
  },
  betVerifyBtnRow: {
    display: 'flex',
    gap: '0.5rem',
  },
  confirmBtn: {
    padding: '0.5rem 1rem',
    fontSize: '0.9rem',
    fontWeight: 600,
    borderRadius: '8px',
    border: 'none',
    background: '#16a34a',
    color: '#fff',
    cursor: 'pointer',
    minHeight: '40px',
  },
  overrideBtn: {
    padding: '0.5rem 1rem',
    fontSize: '0.9rem',
    fontWeight: 600,
    borderRadius: '8px',
    border: '1px solid #f59e0b',
    background: '#fef3c7',
    color: '#92400e',
    cursor: 'pointer',
    minHeight: '40px',
  },
  overrideForm: {
    display: 'flex',
    gap: '0.5rem',
    marginTop: '0.5rem',
    alignItems: 'center',
    flexWrap: 'wrap' as const,
  },
  overrideSelect: {
    padding: '0.4rem 0.5rem',
    fontSize: '0.9rem',
    borderRadius: '6px',
    border: '1px solid #d1d5db',
    minHeight: '36px',
  },
  overrideInput: {
    padding: '0.4rem 0.5rem',
    fontSize: '0.9rem',
    borderRadius: '6px',
    border: '1px solid #d1d5db',
    width: '80px',
    minHeight: '36px',
  },
};
