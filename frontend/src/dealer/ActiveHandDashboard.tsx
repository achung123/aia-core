import { useState, useEffect, useRef } from 'react';
import type { CommunityCards, Player } from '../stores/dealerStore.ts';
import { fetchHands, fetchEquity, type EquityStreet } from '../api/client.ts';
import { TableView3D } from './TableView3D.tsx';
import { BlindTimer } from './BlindTimer.tsx';
import { StreetScrubber, type Street } from '../mobile/StreetScrubber.tsx';
import type { HandResponse, PlayerEquityEntry } from '../api/types';
import { PlayingCard } from '../components/PlayingCard.tsx';
import { DealerOverrides } from './DealerOverrides.tsx';
import { useGameEvents } from '../hooks/useGameEvents.ts';
import { theme } from '../theme';

const BOARD_STREET = ['flop', 'flop', 'flop', 'turn', 'river'] as const;

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

function dealtPlayerNames(
  hand: HandResponse | undefined,
  players: Player[],
): string[] {
  const fromHand = hand?.player_hands
    .filter((ph) => ph.card_1 && ph.card_2)
    .map((ph) => ph.player_name) ?? [];
  const fromTiles = players
    .filter((player) => player.recorded || (player.card1 && player.card2))
    .map((player) => player.name);
  return Array.from(new Set([...fromHand, ...fromTiles]));
}

function equityStreetFromScrubber(street: Street): EquityStreet {
  switch (street) {
    case 'Flop':
      return 'flop';
    case 'Turn':
      return 'turn';
    case 'River':
      return 'river';
    case 'Showdown':
      return 'showdown';
    case 'Pre-Flop':
    default:
      return 'preflop';
  }
}

export interface ActiveHandDashboardProps {
  gameId: number;
  handNumber?: number;
  community: CommunityCards;
  players: Player[];
  sbPlayerName: string | null;
  bbPlayerName: string | null;
  onTileSelect: (target: string) => void;
  onStreetCapture?: (street: string) => void;
  onDirectOutcome?: (playerName: string) => void;
  onMarkNotPlaying?: (playerName: string) => void;
  canFinish?: boolean;
  onFinishHand?: () => void;
  onBack?: () => void;
  patchError?: string | null;
  // Betting info (read-only display)
  currentPlayerName?: string | null;
  legalActions?: string[];
  amountToCall?: number;
  minimumBet?: number | null;
  minimumRaise?: number | null;
  pot?: number;
  streetComplete?: boolean;
  handPhase?: string;
  potContributions?: Record<string, number>;
  /** Names of players who have put their whole stack in. */
  allInPlayers?: string[];
  // Dealer overrides
  playerChips?: Record<string, number | null>;
  actionIndex?: number;
  onOverride?: () => void;
}

/**
 * What to tell the dealer when betting on a street has finished and nobody
 * is left to act. That is the ordinary case after everyone checks or calls,
 * so it must not claim an all-in unless players really are all-in.
 */
export function describeBettingClosed(
  community: CommunityCards,
  players: Player[],
  allInPlayers: string[],
): string {
  const contenders = players.filter(
    (player) => player.status !== 'folded' && player.status !== 'not_playing',
  );
  const allIn = contenders.filter((player) => allInPlayers.includes(player.name));
  // Nobody can bet any more: everyone is all-in, or only one player still
  // has chips and has no one to bet against.
  const runningOut =
    contenders.length >= 2 && allIn.length >= 1 && contenders.length - allIn.length <= 1;
  const everyoneAllIn = runningOut && allIn.length === contenders.length;

  if (community.riverRecorded) {
    return runningOut
      ? 'Betting is closed — finish the hand'
      : 'Betting complete — finish the hand';
  }
  const next = !community.flopRecorded ? 'flop' : !community.turnRecorded ? 'turn' : 'river';
  if (everyoneAllIn) return `🃏 All players are all-in — deal the ${next}`;
  if (runningOut) {
    const count = allIn.length;
    return `🃏 ${count === 1 ? '1 player is' : `${count} players are`} all-in, no more betting — deal the ${next}`;
  }
  return `Betting complete — deal the ${next}`;
}

export function ActiveHandDashboard({
  gameId,
  handNumber,
  community,
  players,
  sbPlayerName,
  bbPlayerName,
  onTileSelect,
  onStreetCapture,
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
  potContributions,
  allInPlayers = [],
  playerChips,
  actionIndex = 0,
  onOverride,
}: ActiveHandDashboardProps) {
  const [isWide, setIsWide] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(min-width: 600px)').matches,
  );
  const [viewMode, setViewMode] = useState<'tile' | '3d'>('tile');
  const [hands3D, setHands3D] = useState<HandResponse[]>([]);
  const [streetScrub3D, setStreetScrub3D] = useState<Street>('Pre-Flop');
  const [equityEntries, setEquityEntries] = useState<PlayerEquityEntry[]>([]);
  const [equityEstimated, setEquityEstimated] = useState(false);

  // The street the hand has actually reached, from the cards on the board.
  // The 3D view follows it as cards are dealt, so the dealer sees the flop
  // appear without touching the scrubber. Scrubbing back to look at an
  // earlier street stops the following until they return to the latest.
  const liveStreet: Street = community.river
    ? 'River'
    : community.turn
      ? 'Turn'
      : community.flop1
        ? 'Flop'
        : 'Pre-Flop';
  const followingLiveRef = useRef(true);

  useEffect(() => {
    if (viewMode !== '3d') return;
    followingLiveRef.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStreetScrub3D(liveStreet);
    // Reset only when the hand or the view changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handNumber, viewMode]);

  useEffect(() => {
    if (viewMode !== '3d' || !followingLiveRef.current) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStreetScrub3D(liveStreet);
  }, [liveStreet, viewMode]);

  const handleStreetScrub = (street: string) => {
    followingLiveRef.current = street === liveStreet;
    setStreetScrub3D(street as Street);
  };

  useEffect(() => {
    const mql = window.matchMedia('(min-width: 600px)');
    const handler = (e: MediaQueryListEvent) => setIsWide(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  // Equity depends on who has folded and which cards are known, so it is
  // recomputed whenever the game changes — not only when this screen's own
  // copy of the board does.
  const [equityRefresh, setEquityRefresh] = useState(0);
  useGameEvents(viewMode === '3d' ? gameId : null, () => setEquityRefresh((n) => n + 1));

  // Fetch equity when in 3D view mode and we have a hand
  useEffect(() => {
    if (viewMode !== '3d' || !gameId || !handNumber) {
      setEquityEntries([]);
      return;
    }
    fetchEquity(gameId, handNumber, equityStreetFromScrubber(streetScrub3D))
      .then((res) => {
        setEquityEntries(res.equities);
        setEquityEstimated(res.method === 'monte_carlo');
      })
      .catch(() => setEquityEntries([]));
  }, [viewMode, gameId, handNumber, community, streetScrub3D, equityRefresh]);

  const boardCards = [
    community.flop1,
    community.flop2,
    community.flop3,
    community.turn,
    community.river,
  ];
  const latest3DHand = hands3D[hands3D.length - 1];
  const dealerEquityEntries = dealtPlayerNames(latest3DHand, players).map((playerName) => {
    const matched = equityEntries.find((entry) => entry.player_name === playerName);
    return {
      player_name: playerName,
      equity: matched?.equity ?? 0,
      win: matched?.win ?? null,
      tie: matched?.tie ?? null,
      winning_hand_description: matched?.winning_hand_description ?? null,
    };
  });

  return (
    <div style={isWide ? styles.containerWide : styles.container}>
      {viewMode === '3d' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: 0 }}>
          <TableView3D gameId={gameId} street={streetScrub3D} />
          {hands3D.length > 0 && (
            <StreetScrubber
              currentStreet={streetScrub3D}
              handData={{
                flop: [latest3DHand.flop_1, latest3DHand.flop_2, latest3DHand.flop_3].filter(Boolean),
                turn: latest3DHand.turn,
                river: latest3DHand.river,
              }}
              onStreetChange={handleStreetScrub}
            />
          )}
          {dealerEquityEntries.length > 0 && (
            <div data-testid="dealer-equity-row" style={{ display: 'flex', gap: 6, padding: '8px 12px', background: theme.surface, borderRadius: '8px', overflowX: 'auto' }}>
              {dealerEquityEntries.map((e) => (
                <div key={e.player_name} style={{ minWidth: 70, padding: '6px 10px', borderRadius: 8, background: theme.accentSurface, border: `1px solid ${theme.accentSurfaceStrong}`, textAlign: 'center', flexShrink: 0 }}>
                  <div style={{ color: theme.accentSoft, fontSize: 11, fontWeight: 600, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.player_name}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: e.equity >= 0.5 ? '#4ade80' : e.equity >= 0.25 ? '#facc15' : '#f87171' }}>
                    {equityEstimated ? '~' : ''}{(e.equity * 100).toFixed(1)}%
                  </div>
                  {e.win != null && e.tie != null && (
                    <div
                      data-testid={`equity-detail-${e.player_name}`}
                      style={{ fontSize: 10, color: theme.muted, marginTop: 2, whiteSpace: 'nowrap' }}
                    >
                      win {(e.win * 100).toFixed(0)}%{e.tie > 0.0005 ? ` · tie ${(e.tie * 100).toFixed(0)}%` : ''}
                    </div>
                  )}
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
            {boardCards.map((card, i) => {
              const recorded = i <= 2 ? community.flopRecorded : i === 3 ? community.turnRecorded : community.riverRecorded;
              return (
                <PlayingCard
                  key={i}
                  testId={`board-slot-${i}`}
                  code={card}
                  onClick={recorded ? () => onTileSelect(BOARD_STREET[i]) : undefined}
                />
              );
            })}
          </div>

          {/* Street Buttons */}
          <div data-testid="street-buttons" style={styles.streetRow}>
            <button
              data-testid="flop-tile"
              style={{
                ...styles.streetTile,
                ...(!community.flopRecorded && streetComplete === false ? styles.streetTileDisabled : {}),
              }}
              onClick={() => (onStreetCapture ?? onTileSelect)('flop')}
              disabled={!community.flopRecorded && streetComplete === false}
            >
              <span style={styles.tileName}>Flop</span>
              {community.flopRecorded && <span style={styles.check}>✓</span>}
            </button>
            <button
              data-testid="turn-tile"
              style={{
                ...styles.streetTile,
                ...(!community.flopRecorded || (!community.turnRecorded && streetComplete === false) ? styles.streetTileDisabled : {}),
              }}
              onClick={() => (onStreetCapture ?? onTileSelect)('turn')}
              disabled={!community.flopRecorded || (!community.turnRecorded && streetComplete === false)}
            >
              <span style={styles.tileName}>Turn</span>
              {community.turnRecorded && <span style={styles.check}>✓</span>}
            </button>
            <button
              data-testid="river-tile"
              style={{
                ...styles.streetTile,
                ...(!community.turnRecorded || (!community.riverRecorded && streetComplete === false) ? styles.streetTileDisabled : {}),
              }}
              onClick={() => (onStreetCapture ?? onTileSelect)('river')}
              disabled={!community.turnRecorded || (!community.riverRecorded && streetComplete === false)}
            >
              <span style={styles.tileName}>River</span>
              {community.riverRecorded && <span style={styles.check}>✓</span>}
            </button>
          </div>
        </div>

        {/* Bet Info Panel (read-only) */}
        {handNumber && (
          <div data-testid="bet-verify-panel" style={styles.betVerifyPanel}>
            <div style={styles.betVerifyHeader}>
              <span style={styles.betVerifyLabel}>
                {handPhase === 'awaiting_cards'
                  ? 'Waiting for cards…'
                  : currentPlayerName
                    ? `Turn: ${currentPlayerName}`
                    : streetComplete && handPhase !== 'showdown'
                      ? describeBettingClosed(community, players, allInPlayers)
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
              </div>
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
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
        <button
          data-testid="view-toggle-btn"
          onClick={() => {
            setStreetScrub3D(liveStreet);
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
      {onOverride && gameId != null && handNumber != null && (
        <DealerOverrides
          gameId={gameId}
          handNumber={handNumber}
          playerNames={players
            .filter((player) => player.status !== 'folded' && player.status !== 'not_playing')
            .map((player) => player.name)}
          playerChips={playerChips ?? {}}
          currentPlayerName={currentPlayerName ?? null}
          communityCardCount={boardCards.filter(Boolean).length}
          legalActions={legalActions ?? []}
          amountToCall={amountToCall}
          minimumBet={minimumBet}
          minimumRaise={minimumRaise}
          pot={pot ?? 0}
          handPhase={handPhase ?? 'preflop'}
          actionIndex={actionIndex}
          onChanged={onOverride}
        />
      )}
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
    border: `1px solid ${theme.accent}`,
    borderRadius: '8px',
    background: theme.accentTint,
    color: theme.accent,
    cursor: 'pointer',
    marginBottom: '0.5rem',
  },
  blindBarSticky: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '0.5rem 0.75rem',
    background: theme.accentSurface,
    color: theme.accentSoft,
    borderRadius: '8px',
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
    fontWeight: 600,
    border: `2px solid ${theme.accentBorder}`,
    borderRadius: '8px',
    background: theme.accentTint,
    color: theme.text,
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
  actionChip: {
    fontSize: '0.75rem',
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: '8px',
    background: theme.accentTint,
    color: theme.accentSoft,
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
  },
  potContribBadge: {
    fontSize: '0.75rem',
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: '8px',
    background: 'rgba(34, 197, 94, 0.14)',
    color: theme.successText,
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
    background: 'rgba(245, 158, 11, 0.14)',
    cursor: 'pointer',
  },
  sitOutButton: {
    padding: '0.2rem 0.5rem',
    fontSize: '0.75rem',
    border: `1px solid ${theme.borderStrong}`,
    borderRadius: '6px',
    background: theme.surface,
    cursor: 'pointer',
    color: theme.faint,
  },
  finishButton: {
    marginTop: '1rem',
    width: '100%',
    padding: '1rem',
    fontSize: '1.1rem',
    fontWeight: 600,
    border: 'none',
    borderRadius: '8px',
    background: theme.accent,
    color: '#fff',
    cursor: 'pointer',
  },
  toast: {
    marginTop: '0.75rem',
    padding: '0.75rem',
    background: 'rgba(220, 38, 38, 0.14)',
    color: theme.dangerText,
    border: '1px solid #fca5a5',
    borderRadius: '8px',
    fontSize: '0.85rem',
  },
  betVerifyPanel: {
    padding: '0.75rem',
    marginBottom: '0.75rem',
    border: `2px solid ${theme.accentBorder}`,
    borderRadius: '8px',
    background: theme.accentTint,
  },
  betVerifyHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.5rem',
  },
  betVerifyLabel: {
    fontWeight: 600,
    fontSize: '1rem',
    color: theme.text,
  },
  potBadge: {
    fontSize: '0.85rem',
    fontWeight: 600,
    color: theme.accent,
    background: theme.accentTint,
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
    color: theme.muted,
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
    background: 'rgba(245, 158, 11, 0.14)',
    color: theme.warningText,
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
    border: `1px solid ${theme.borderStrong}`,
    minHeight: '36px',
  },
  overrideInput: {
    padding: '0.4rem 0.5rem',
    fontSize: '0.9rem',
    borderRadius: '6px',
    border: `1px solid ${theme.borderStrong}`,
    width: '80px',
    minHeight: '36px',
  },
  allInToggleLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    color: theme.muted,
    fontSize: '0.85rem',
  },
};
