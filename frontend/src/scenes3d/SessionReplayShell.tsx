// T-023b — <SessionReplayShell> cross-hand timeline + speed controls.
//
// Playback-only wrapper that drives the `replay` slice in `useTableStore`:
// hand index, per-hand street index, speed, and isPlaying. Composes with the
// per-hand `<HandScrubberPanel>` (T-023, Cycle 23) via the same slice — this
// shell owns the *cross-hand* layer (which hand we're on + inter-hand auto-
// advance pause), while HandScrubberPanel owns street-level scrubbing.
//
// Mount contract: only inside `frontend/src/views/PlaybackView.tsx`. A dev-
// only warning (not a hard error, per tasks.md AC 6) fires when mounted on
// a non-playback route; tests opt out via the vitest `MODE === 'test'` check.

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type ReactNode,
} from 'react';

import type { GameSessionResponse, HandResponse } from '../api/types/game';
import type { HandActionResponse } from '../api/types/dealer';
import { SessionScrubber } from '../components/SessionScrubber';
import {
  ACTIVE_CONTROL_BUTTON_STYLE,
  CONTROL_BUTTON_STYLE,
  HandScrubberPanel,
  streetIndexFromOutcomePhase,
} from './components/HandScrubberPanel';
import { handsToTableState } from './data/handsToTableState';
import {
  REPLAY_SPEEDS,
  useTableStore,
  type ReplaySpeed,
  type StreetIdx,
} from './state/tableStore';
import { CHIP_SLIDE_DURATION_MS } from './animations/chipSlides';
import type { TableState, TableStatePhase, ViewerContext } from './types';
import { theme } from '../theme';

// ---------------------------------------------------------------------------
// Timing constants (plan.md § "Public API — <SessionReplayShell>")
// ---------------------------------------------------------------------------

/** Base per-street tick. Scaled by `1 / speed`. Matches HandScrubberPanel. */
export const MS_PER_STREET = 1500;

/** Inter-hand pause when auto-advancing across hands. Scaled by `1 / speed`. */
export const MS_INTER_HAND = 1000;

// ---------------------------------------------------------------------------
// Phase ↔ streetIndex mapping
// ---------------------------------------------------------------------------

const PHASE_BY_STREET: Record<StreetIdx, TableStatePhase> = {
  0: 'preflop',
  1: 'flop',
  2: 'turn',
  3: 'river',
  4: 'showdown',
};

/** Inverse of `streetIndexFromPhase`; exported so T-030 / T-031 can reuse. */
export function phaseFromStreetIndex(i: StreetIdx): TableStatePhase {
  return PHASE_BY_STREET[i];
}

function outcomePhaseForResolvedHand(hand: HandResponse): TableStatePhase {
  if (hand.player_hands.some((ph) => ph.result === 'won')) return 'showdown';
  if (hand.river) return 'river';
  if (hand.turn) return 'turn';
  if (hand.flop_1) return 'flop';
  return 'preflop';
}

function clampCommunityToStreet(
  community: TableState['community'],
  streetIndex: StreetIdx,
): TableState['community'] {
  return community.map((card, slot) => {
    const minStreet = slot <= 2 ? 1 : slot === 3 ? 2 : 3;
    return streetIndex >= minStreet ? card : null;
  });
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export interface SessionReplayContextValue {
  /** Derived TableState for the current (handIndex, streetIndex); null when hands=[]. */
  tableState: TableState | null;
  viewer: ViewerContext;
  gameId: number;
  game: GameSessionResponse;
  hand: HandResponse | null;
  handIndex: number;
  streetIndex: StreetIdx;
  speed: ReplaySpeed;
  isPlaying: boolean;
  /** The game is still being played (new hands and cards can arrive). */
  live: boolean;
  /** Viewing the newest hand at the newest street, and following it. */
  atLiveEdge: boolean;
}

const SessionReplayContext = createContext<SessionReplayContextValue | null>(
  null,
);

/** Hook for children of `<SessionReplayShell>`; throws if mounted outside. */
export function useSessionReplayContext(): SessionReplayContextValue {
  const v = useContext(SessionReplayContext);
  if (v === null) {
    throw new Error(
      'useSessionReplayContext must be used inside <SessionReplayShell>',
    );
  }
  return v;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SessionReplayShellProps {
  gameId: number;
  /**
   * Game session for the replay. Required alongside `hands` so children can
   * derive a full `TableState` via `handsToTableState`. The plan.md §
   * "Public API" sketch lists only `gameId + hands`; we surface `game` here
   * because derived TableState needs the seat map. T-031 (PlaybackView
   * migration) will fetch the game once on route mount and forward it down.
   */
  game: GameSessionResponse;
  /** All hands of the session, in hand_number order. */
  hands: HandResponse[];
  /**
   * Optional per-hand action lists keyed by `hand_id`. When provided,
   * actions for the current hand are threaded into `handsToTableState`
   * so per-seat committed-this-street chip stacks and accurate
   * `lastAction` amounts render. Omitted hands fall back to the
   * zero-committed / last-action-only derivation.
   */
  actionsByHandId?: Record<number, HandActionResponse[]>;
  initialHandIndex?: number;
  initialSpeed?: ReplaySpeed;
  /**
   * The game is in progress. The replay then follows it: it opens on the
   * newest street of the newest hand, and while the viewer is sitting at
   * that edge it moves along as new cards and hands arrive. Scrubbing away
   * stops the following until the viewer jumps back to live.
   */
  live?: boolean;
  /** Viewer policy exposed to children via context. Default spectator. */
  viewer?: ViewerContext;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

const DEFAULT_VIEWER: ViewerContext = { policy: 'spectator' };

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SessionReplayShell({
  gameId,
  game,
  hands,
  actionsByHandId,
  initialHandIndex = 0,
  initialSpeed = 1,
  live = false,
  viewer = DEFAULT_VIEWER,
  className,
  style,
  children,
}: SessionReplayShellProps) {
  // --- Replay slice subscriptions ----------------------------------------
  const handIndex = useTableStore((s) => s.replay.handIndex);
  const streetIndex = useTableStore((s) => s.replay.streetIndex);
  const isPlaying = useTableStore((s) => s.replay.isPlaying);
  const speed = useTableStore((s) => s.replay.speed);
  const setReplayHandIndex = useTableStore((s) => s.setReplayHandIndex);
  const setReplayStreetIndex = useTableStore((s) => s.setReplayStreetIndex);
  const setReplayPlaying = useTableStore((s) => s.setReplayPlaying);
  const setReplaySpeed = useTableStore((s) => s.setReplaySpeed);

  // --- One-shot seed from initial props ----------------------------------
  // Runs once on mount. Clamps `initialHandIndex` into bounds. Does NOT
  // reset state on subsequent re-renders — AC 3 (pause/resume) depends on
  // the store being the single source of truth past first mount.
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;
    const max = Math.max(0, hands.length - 1);
    const clamped = Math.min(Math.max(0, initialHandIndex), max);
    setReplayHandIndex(clamped);
    // A live game opens at its newest street so the cards already dealt
    // are on the table; a finished one replays from the start.
    const openingStreet =
      live && clamped === max && hands[clamped]
        ? streetIndexFromOutcomePhase(outcomePhaseForResolvedHand(hands[clamped]))
        : 0;
    setReplayStreetIndex(openingStreet);
    setReplaySpeed(initialSpeed);
    setReplayPlaying(false);
    // initialHandIndex / initialSpeed / hands.length are read once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Follow a live game --------------------------------------------------
  // The newest hand and how far it has got. When either moves and the viewer
  // was sitting exactly at the previous edge, carry them to the new one.
  // A viewer who scrubbed away is left alone.
  const lastIndex = hands.length - 1;
  const lastHand: HandResponse | null = hands[lastIndex] ?? null;
  const latestStreet: StreetIdx = lastHand
    ? streetIndexFromOutcomePhase(outcomePhaseForResolvedHand(lastHand))
    : 0;
  const edgeRef = useRef<{ last: number; street: StreetIdx } | null>(null);
  useEffect(() => {
    const previous = edgeRef.current;
    edgeRef.current = { last: lastIndex, street: latestStreet };
    if (!live || previous === null || lastIndex < 0) return;
    if (previous.last === lastIndex && previous.street === latestStreet) return;
    const state = useTableStore.getState().replay;
    const wasAtEdge =
      state.handIndex === previous.last && state.streetIndex === previous.street;
    if (!wasAtEdge) return;
    setReplayHandIndex(lastIndex);
    setReplayStreetIndex(latestStreet);
    // Only a change in what has arrived should move the viewer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, lastIndex, latestStreet]);

  const atLiveEdge = live && handIndex === lastIndex && streetIndex === latestStreet;
  const jumpToLive = () => {
    if (lastIndex < 0) return;
    setReplayPlaying(false);
    setReplayHandIndex(lastIndex);
    setReplayStreetIndex(latestStreet);
  };

  // --- Dev-only off-route warning (AC 6) ---------------------------------
  useEffect(() => {
    const env = import.meta.env as
      | { DEV?: boolean; MODE?: string }
      | undefined;
    if (!env?.DEV) return;
    if (env.MODE === 'test') return;
    if (typeof window === 'undefined') return;
    if (window.location.hash.startsWith('#/playback')) return;
    console.warn(
      '<SessionReplayShell> should only be mounted inside PlaybackView (route #/playback).',
    );
  }, []);

  // --- Clamp handIndex if `hands` shrinks --------------------------------
  useEffect(() => {
    if (hands.length === 0) return;
    if (handIndex > hands.length - 1) {
      setReplayHandIndex(hands.length - 1);
    }
  }, [hands.length, handIndex, setReplayHandIndex]);

  // --- Auto-advance state machine (AC 2) ---------------------------------
  // One setTimeout per (handIndex, streetIndex) tick. On street < 4 we tick
  // after MS_PER_STREET / speed; at showdown we pause MS_INTER_HAND / speed
  // before advancing to the next hand (or halting at last hand).
  useEffect(() => {
    if (!isPlaying) return;
    if (hands.length === 0) return;
    if (streetIndex < 4) {
      // Cycle 44 M-1: floor the per-street cadence at CHIP_SLIDE_DURATION_MS
      // so the 4× speed (1500/4 = 375ms) never ticks mid chip-slide (400ms).
      const ms = Math.max(CHIP_SLIDE_DURATION_MS, MS_PER_STREET / speed);
      const t = setTimeout(() => {
        setReplayStreetIndex((streetIndex + 1) as StreetIdx);
      }, ms);
      return () => clearTimeout(t);
    }
    // At showdown: inter-hand pause, then next hand or halt.
    const ms = Math.max(1, MS_INTER_HAND / speed);
    const t = setTimeout(() => {
      if (handIndex < hands.length - 1) {
        setReplayHandIndex(handIndex + 1);
        setReplayStreetIndex(0);
      } else {
        setReplayPlaying(false);
      }
    }, ms);
    return () => clearTimeout(t);
  }, [
    isPlaying,
    streetIndex,
    handIndex,
    speed,
    hands.length,
    setReplayStreetIndex,
    setReplayHandIndex,
    setReplayPlaying,
  ]);

  // --- Derived TableState ------------------------------------------------
  const currentHand: HandResponse | null = hands[handIndex] ?? null;
  // Outcome phase — the latest street the hand actually reached. Used to
  // clamp the per-hand street scrubber so the user can't scrub past the
  // last played street. Independent of the scrubbed `streetIndex`.
  const outcomePhase: TableStatePhase | undefined = useMemo(() => {
    if (!currentHand) return undefined;
    return outcomePhaseForResolvedHand(currentHand);
  }, [currentHand]);
  const tableState: TableState | null = useMemo(() => {
    if (!currentHand) return null;
    const actions = actionsByHandId?.[currentHand.hand_id];
    const base = handsToTableState({
      game,
      hand: currentHand,
      actions,
      viewer,
    });
    // Override phase + streetIndex so they track the replay slice even if
    // `hand` is terminal (playback is deterministic; `status` is never
    // fetched for playback).
    return {
      ...base,
      streetIndex,
      phase: phaseFromStreetIndex(streetIndex),
      community: clampCommunityToStreet(base.community, streetIndex),
    };
  }, [game, currentHand, actionsByHandId, streetIndex, viewer]);

  const contextValue = useMemo<SessionReplayContextValue>(
    () => ({
      tableState,
      viewer,
      gameId,
      game,
      hand: currentHand,
      handIndex,
      streetIndex,
      speed,
      isPlaying,
      live,
      atLiveEdge,
    }),
    [
      tableState,
      viewer,
      gameId,
      game,
      currentHand,
      handIndex,
      streetIndex,
      speed,
      isPlaying,
      live,
      atLiveEdge,
    ],
  );

  // --- Handlers ----------------------------------------------------------
  const onScrubHand = (oneBased: number) => {
    setReplayHandIndex(oneBased - 1);
    setReplayStreetIndex(0);
  };
  const togglePlaying = () => setReplayPlaying(!isPlaying);
  const onSpeedClick = (s: ReplaySpeed) => setReplaySpeed(s);

  return (
    <section
      data-testid="session-replay-shell"
      role="region"
      aria-label="Session replay"
      className={className}
      style={style}
    >
      <SessionReplayContext.Provider value={contextValue}>
        {children}
      </SessionReplayContext.Provider>
      <div
        data-testid="session-hand-summary"
        style={summaryStyle}
        aria-live="polite"
      >
        <span style={summaryHandStyle}>Hand {currentHand?.hand_number ?? '—'}</span>
        <span>{summarizeHand(currentHand)}</span>
      </div>
      <SessionScrubber
        handCount={Math.max(1, hands.length)}
        currentHand={Math.min(handIndex + 1, Math.max(1, hands.length))}
        onChange={onScrubHand}
      />
      {/* Per-hand street scrubber — binds to the same `replay` slice as this
          shell. Clamps reachable streets to how far the current hand got
          (folded preflop → only preflop reachable). Play/pause lives in the
          controls row below, so this one is hidden. */}
      <HandScrubberPanel
        bindToReplay
        disableAutoAdvance
        showPlayToggle={false}
        outcomeStreet={outcomePhase}
        style={streetScrubberStyle}
      />
      <div
        role="group"
        aria-label="Playback controls"
        data-testid="session-replay-controls"
        style={controlsStyle}
      >
        <button
          type="button"
          data-testid="session-replay-play"
          aria-pressed={isPlaying}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          onClick={togglePlaying}
          style={playBtnStyle}
        >
          {isPlaying ? '❚❚' : '▶'}
        </button>
        <div
          role="radiogroup"
          aria-label="Playback speed"
          data-testid="session-replay-speeds"
          style={speedGroupStyle}
        >
          {REPLAY_SPEEDS.map((s) => {
            const active = s === speed;
            return (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={active}
                data-testid={`session-replay-speed-${s}x`}
                data-active={active ? 'true' : 'false'}
                onClick={() => onSpeedClick(s)}
                style={{
                  ...speedBtnStyle,
                  fontWeight: active ? 700 : 500,
                  ...(active ? ACTIVE_CONTROL_BUTTON_STYLE : {}),
                }}
              >
                {s}x
              </button>
            );
          })}
        </div>
        {live && (
          atLiveEdge ? (
            <span data-testid="session-live-indicator" style={liveOnStyle}>
              <span aria-hidden style={liveDotStyle} /> LIVE
            </span>
          ) : (
            <button
              type="button"
              data-testid="session-jump-live"
              onClick={jumpToLive}
              style={liveJumpStyle}
            >
              Jump to live
            </button>
          )
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Inline styles — keep layout self-contained so the shell slots into any
// playback layout without importing shared CSS.
// ---------------------------------------------------------------------------

const MIN_TAP_TARGET_PX = 44;

/** One line describing a hand: its pot and who took it. */
export function summarizeHand(hand: HandResponse | null): string {
  if (!hand) return 'No hand recorded';
  const winners = hand.player_hands.filter((ph) => ph.result === 'won');
  const pot = hand.pot > 0 ? `Pot $${hand.pot.toFixed(2)}` : null;
  const parts: string[] = [];
  if (pot) parts.push(pot);
  if (winners.length > 0) {
    const names = winners.map((ph) => ph.player_name).join(', ');
    const how = winners.length === 1 ? winners[0].winning_hand_description : null;
    parts.push(`${names} won${how ? ` with ${how}` : ''}`);
  } else if (hand.player_hands.some((ph) => ph.result === 'folded')) {
    parts.push('Folded round');
  } else {
    parts.push('In progress');
  }
  return parts.join(' · ');
}

const summaryStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  gap: 10,
  padding: '8px 12px 0',
  background: theme.bg,
  color: theme.accentSoft,
  fontSize: 'clamp(12px, 3.2vw, 14px)',
  minHeight: 22,
  overflow: 'hidden',
  whiteSpace: 'nowrap',
  textOverflow: 'ellipsis',
};

const summaryHandStyle: CSSProperties = { fontWeight: 700, color: theme.text };

const liveOnStyle: CSSProperties = {
  marginLeft: 'auto',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '0 12px',
  minHeight: MIN_TAP_TARGET_PX,
  color: '#86efac',
  fontWeight: 700,
  fontSize: 13,
  letterSpacing: '0.08em',
};

const liveDotStyle: CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: '50%',
  background: '#22c55e',
  boxShadow: '0 0 0 3px rgba(34,197,94,0.25)',
};

const liveJumpStyle: CSSProperties = {
  marginLeft: 'auto',
  minHeight: MIN_TAP_TARGET_PX,
  padding: '0 14px',
  cursor: 'pointer',
  fontWeight: 700,
  ...CONTROL_BUTTON_STYLE,
  background: '#14532d',
  borderColor: '#22c55e',
  color: '#dcfce7',
};

const controlsStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '4px 8px 8px',
  background: theme.bg,
};

const playBtnStyle: CSSProperties = {
  minWidth: MIN_TAP_TARGET_PX,
  minHeight: MIN_TAP_TARGET_PX,
  cursor: 'pointer',
  fontWeight: 600,
  ...CONTROL_BUTTON_STYLE,
};

const speedGroupStyle: CSSProperties = {
  display: 'flex',
  gap: 4,
  minWidth: 0,
};
const streetScrubberStyle: CSSProperties = {
  background: theme.bg,
  borderTop: `1px solid ${theme.accentSurface}`,
  color: '#fff',
};
const speedBtnStyle: CSSProperties = {
  minWidth: MIN_TAP_TARGET_PX,
  minHeight: MIN_TAP_TARGET_PX,
  padding: '0 12px',
  cursor: 'pointer',
  ...CONTROL_BUTTON_STYLE,
};
