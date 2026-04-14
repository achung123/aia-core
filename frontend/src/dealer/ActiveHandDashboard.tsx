import { useState, useEffect } from 'react';
import type { CommunityCards, Player } from '../stores/dealerStore.ts';
import { recordPlayerAction, fetchHands, fetchEquity } from '../api/client.ts';
import { TableView3D } from './TableView3D.tsx';
import { BlindTimer } from './BlindTimer.tsx';
import { StreetScrubber } from '../mobile/StreetScrubber.tsx';
import type { ActionEnum, StreetEnum, HandResponse, PlayerEquityEntry } from '../api/types';

const PHASE_ORDER: Record<string, number> = { preflop: 0, flop: 1, turn: 2, river: 3, showdown: 4 };

function isStreetPast(street: 'flop' | 'turn' | 'river', handPhase: string | undefined): boolean {
  if (!handPhase) return false;
  const phaseIdx = PHASE_ORDER[handPhase] ?? 0;
  const streetIdx = PHASE_ORDER[street] ?? 0;
  return phaseIdx > streetIdx;
}

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
  minimumBet?: number | null;
  minimumRaise?: number | null;
  pot?: number;
  streetComplete?: boolean;
  handPhase?: string;
  onActionConfirmed?: () => void;
  potContributions?: Record<string, number>;
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
  amountToCall = 0,
  minimumBet = null,
  minimumRaise = null,
  pot,
  streetComplete,
  handPhase,
  onActionConfirmed,
  potContributions,
}: ActiveHandDashboardProps) {
  const [isWide, setIsWide] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(min-width: 600px)').matches,
  );
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideAction, setOverrideAction] = useState<ActionEnum>('call');
  const [overrideAmount, setOverrideAmount] = useState('');
  const [overrideIsAllIn, setOverrideIsAllIn] = useState(false);
  const [betVerifyError, setBetVerifyError] = useState<string | null>(null);
  const [betVerifyLoading, setBetVerifyLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'tile' | '3d'>('tile');
  const [hands3D, setHands3D] = useState<HandResponse[]>([]);
  const [streetScrub3D, setStreetScrub3D] = useState<string>('Pre-Flop');
  const [equityEntries, setEquityEntries] = useState<PlayerEquityEntry[]>([]);

  useEffect(() => {
    const mql = window.matchMedia('(min-width: 600px)');
    const handler = (e: MediaQueryListEvent) => setIsWide(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  // Fetch equity when in 3D view mode and we have a hand
  useEffect(() => {
    if (viewMode !== '3d' || !gameId || !handNumber) {
      setEquityEntries([]);
      return;
    }
    fetchEquity(gameId, handNumber)
      .then((res) => setEquityEntries(res.equities))
      .catch(() => setEquityEntries([]));
  }, [viewMode, gameId, handNumber, community]);

  const boardCards = [
    community.flop1,
    community.flop2,
    community.flop3,
    community.turn,
    community.river,
  ];
  const availableActions = legalActions ?? [];

  function formatAmount(amount: number | null | undefined): string {
    return amount == null ? '' : amount.toFixed(2);
  }

  function defaultAmountForAction(action: ActionEnum, isAllIn: boolean): string {
    if (action === 'call') {
      return isAllIn ? '' : formatAmount(amountToCall);
    }
    if (action === 'bet') {
      return formatAmount(minimumBet);
    }
    if (action === 'raise') {
      return formatAmount(minimumRaise);
    }
    return '';
  }

  function setOverrideFormAction(action: ActionEnum, isAllIn = overrideIsAllIn) {
    setOverrideAction(action);
    setOverrideAmount(defaultAmountForAction(action, isAllIn));
  }

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
    const effectiveAmount = overrideAction === 'fold' || overrideAction === 'check'
      ? null
      : overrideAction === 'call' && !overrideIsAllIn
        ? amountToCall ?? 0
        : parsedAmount;

    if (
      !overrideIsAllIn
      && overrideAction === 'bet'
      && minimumBet !== null
      && (effectiveAmount === null || effectiveAmount < minimumBet)
    ) {
      setBetVerifyError(`Minimum bet is $${minimumBet.toFixed(2)}`);
      setBetVerifyLoading(false);
      return;
    }

    if (
      !overrideIsAllIn
      && overrideAction === 'raise'
      && minimumRaise !== null
      && (effectiveAmount === null || effectiveAmount < minimumRaise)
    ) {
      setBetVerifyError(`Minimum raise is $${minimumRaise.toFixed(2)}`);
      setBetVerifyLoading(false);
      return;
    }

    if ((overrideAction === 'call' && overrideIsAllIn) || overrideAction === 'bet' || overrideAction === 'raise') {
      if (effectiveAmount === null || Number.isNaN(effectiveAmount) || effectiveAmount <= 0) {
        setBetVerifyError('Enter a valid amount');
        setBetVerifyLoading(false);
        return;
      }
    }

    try {
      await recordPlayerAction(gameId, handNumber, currentPlayerName, {
        street: deriveStreet(),
        action: overrideAction,
        amount: effectiveAmount,
        ...(overrideIsAllIn ? { is_all_in: true } : {}),
      });
      setOverrideOpen(false);
      setOverrideAmount('');
      setOverrideIsAllIn(false);
      onActionConfirmed?.();
    } catch (err) {
      setBetVerifyError(err instanceof Error ? err.message : String(err));
    } finally {
      setBetVerifyLoading(false);
    }
  }

  return (
    <div style={isWide ? styles.containerWide : styles.container}>
      {viewMode === '3d' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <TableView3D hands={hands3D} />
          {hands3D.length > 0 && (
            <StreetScrubber
              currentStreet={streetScrub3D}
              handData={{
                flop: [hands3D[hands3D.length - 1].flop_1, hands3D[hands3D.length - 1].flop_2, hands3D[hands3D.length - 1].flop_3].filter(Boolean),
                turn: hands3D[hands3D.length - 1].turn,
                river: hands3D[hands3D.length - 1].river,
              }}
              onStreetChange={setStreetScrub3D}
            />
          )}
          {equityEntries.length > 0 && (
            <div data-testid="dealer-equity-row" style={{ display: 'flex', gap: 6, padding: '8px 12px', background: '#1a1a2e', borderRadius: '8px', overflowX: 'auto' }}>
              {equityEntries.map((e) => (
                <div key={e.player_name} style={{ minWidth: 70, padding: '6px 10px', borderRadius: 8, background: '#1e1b4b', border: '1px solid #312e81', textAlign: 'center', flexShrink: 0 }}>
                  <div style={{ color: '#c7d2fe', fontSize: 11, fontWeight: 600, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.player_name}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: e.equity >= 0.5 ? '#4ade80' : e.equity >= 0.25 ? '#facc15' : '#f87171' }}>
                    {(e.equity * 100).toFixed(1)}%
                  </div>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
            <button
              data-testid="view-toggle-btn"
              onClick={() => setViewMode('tile')}
              style={{ ...styles.viewToggleButton, flex: 1 }}
            >
              Tile View
            </button>
            {onBack && (
              <button data-testid="back-btn" onClick={onBack} style={{ ...styles.backButton, flex: 1, marginBottom: 0 }}>
                Back to Hands
              </button>
            )}
          </div>
        </div>
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
          <div data-testid="street-buttons" style={styles.streetRow}>
            <button
              data-testid="flop-tile"
              style={{
                ...styles.streetTile,
                ...((streetComplete === false && !community.flopRecorded) || isStreetPast('flop', handPhase) ? styles.streetTileDisabled : {}),
              }}
              onClick={() => !isStreetPast('flop', handPhase) && (streetComplete !== false || community.flopRecorded) && onTileSelect('flop')}
              disabled={(streetComplete === false && !community.flopRecorded) || isStreetPast('flop', handPhase)}
            >
              <span style={styles.tileName}>Flop</span>
              {community.flopRecorded && <span style={styles.check}>✅</span>}
            </button>
            <button
              data-testid="turn-tile"
              style={{
                ...styles.streetTile,
                ...((!community.flopRecorded || streetComplete === false || isStreetPast('turn', handPhase)) ? styles.streetTileDisabled : {}),
              }}
              onClick={() => community.flopRecorded && streetComplete !== false && !isStreetPast('turn', handPhase) && onTileSelect('turn')}
              disabled={!community.flopRecorded || streetComplete === false || isStreetPast('turn', handPhase)}
            >
              <span style={styles.tileName}>Turn</span>
              {community.turnRecorded && <span style={styles.check}>✅</span>}
            </button>
            <button
              data-testid="river-tile"
              style={{
                ...styles.streetTile,
                ...((!community.turnRecorded || streetComplete === false || isStreetPast('river', handPhase)) ? styles.streetTileDisabled : {}),
              }}
              onClick={() => community.turnRecorded && streetComplete !== false && !isStreetPast('river', handPhase) && onTileSelect('river')}
              disabled={!community.turnRecorded || streetComplete === false || isStreetPast('river', handPhase)}
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
                  {minimumBet !== null ? ` (min bet $${minimumBet.toFixed(2)})` : ''}
                  {minimumRaise !== null ? ` (min raise $${minimumRaise.toFixed(2)})` : ''}
                </span>
                <div style={styles.betVerifyBtnRow}>
                  <button
                    data-testid="record-action-btn"
                    style={styles.overrideBtn}
                    onClick={() => {
                      if (overrideOpen) {
                        setOverrideOpen(false);
                        return;
                      }
                      const initialAction = (availableActions[0] ?? 'fold') as ActionEnum;
                      setOverrideIsAllIn(false);
                      setOverrideOpen(true);
                      setOverrideFormAction(initialAction, false);
                    }}
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
                  onChange={(e) => setOverrideFormAction(e.target.value as ActionEnum)}
                  style={styles.overrideSelect}
                >
                  {availableActions.map((action) => (
                    <option key={action} value={action}>
                      {action[0].toUpperCase()}{action.slice(1)}
                    </option>
                  ))}
                </select>
                <input
                  data-testid="override-amount-input"
                  type="number"
                  placeholder={
                    overrideAction === 'raise'
                      ? `Min ${formatAmount(minimumRaise)}`
                      : overrideAction === 'bet'
                        ? `Min ${formatAmount(minimumBet)}`
                        : 'Amount'
                  }
                  value={overrideAction === 'call' && !overrideIsAllIn ? formatAmount(amountToCall) : overrideAmount}
                  onChange={(e) => setOverrideAmount(e.target.value)}
                  style={styles.overrideInput}
                  step="0.01"
                  min="0"
                  disabled={overrideAction === 'fold' || overrideAction === 'check' || (overrideAction === 'call' && !overrideIsAllIn)}
                />
                {(overrideAction === 'call' || overrideAction === 'bet' || overrideAction === 'raise') && (
                  <label style={styles.allInToggleLabel}>
                    <input
                      data-testid="override-all-in-toggle"
                      type="checkbox"
                      checked={overrideIsAllIn}
                      onChange={(e) => {
                        const nextIsAllIn = e.target.checked;
                        setOverrideIsAllIn(nextIsAllIn);
                        setOverrideAmount(defaultAmountForAction(overrideAction, nextIsAllIn));
                      }}
                    />
                    All in
                  </label>
                )}
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
            {players.filter((player) => player.status !== 'not_playing').map((player) => {
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
                  {potContributions && (potContributions[player.name] ?? 0) > 0 && (
                    <span data-testid={`pot-contrib-${player.name}`} style={styles.potContribBadge}>
                      ${potContributions[player.name].toFixed(2)}
                    </span>
                  )}
                  <div style={styles.statusCol}>
                    <span style={styles.statusText}>
                      {needsAction ? '⚠️ Decide outcome' : formatStatus(player.status, player.outcomeStreet)}
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
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
        <button
          data-testid="view-toggle-btn"
          onClick={() => {
            setViewMode('3d');
            fetchHands(gameId).then(setHands3D).catch(() => {});
          }}
          style={{ ...styles.viewToggleButton, flex: 1 }}
        >
          3D View
        </button>
        {onBack && (
          <button data-testid="back-btn" onClick={onBack} style={{ ...styles.backButton, flex: 1, marginBottom: 0 }}>
            Back to Hands
          </button>
        )}
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
    alignSelf: 'flex-end',
    padding: '0.35rem 0.75rem',
    minHeight: '34px',
    fontSize: '0.85rem',
    fontWeight: 600,
    border: '1px solid #4f46e5',
    borderRadius: '8px',
    background: '#eef2ff',
    color: '#4f46e5',
    cursor: 'pointer',
    marginBottom: '0.5rem',
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
  actionChip: {
    fontSize: '0.75rem',
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: '10px',
    background: '#e0e7ff',
    color: '#3730a3',
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
  },
  potContribBadge: {
    fontSize: '0.75rem',
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: '10px',
    background: '#dcfce7',
    color: '#166534',
    whiteSpace: 'nowrap',
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
  allInToggleLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    color: '#475569',
    fontSize: '0.85rem',
  },
};
