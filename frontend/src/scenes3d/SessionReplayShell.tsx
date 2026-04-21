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
import { SessionScrubber } from '../components/SessionScrubber';
import { handsToTableState } from './data/handsToTableState';
import {
  REPLAY_SPEEDS,
  useTableStore,
  type ReplaySpeed,
  type StreetIdx,
} from './state/tableStore';
import { CHIP_SLIDE_DURATION_MS } from './animations/chipSlides';
import type { TableState, TableStatePhase, ViewerContext } from './types';

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
  initialHandIndex?: number;
  initialSpeed?: ReplaySpeed;
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
  initialHandIndex = 0,
  initialSpeed = 1,
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
    setReplayStreetIndex(0);
    setReplaySpeed(initialSpeed);
    setReplayPlaying(false);
    // initialHandIndex / initialSpeed / hands.length are read once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  const tableState: TableState | null = useMemo(() => {
    if (!currentHand) return null;
    const base = handsToTableState({
      game,
      hand: currentHand,
      viewer,
    });
    // Override phase + streetIndex so they track the replay slice even if
    // `hand` is terminal (playback is deterministic; `status` is never
    // fetched for playback).
    return {
      ...base,
      streetIndex,
      phase: phaseFromStreetIndex(streetIndex),
    };
  }, [game, currentHand, streetIndex, viewer]);

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
      <SessionScrubber
        handCount={Math.max(1, hands.length)}
        currentHand={Math.min(handIndex + 1, Math.max(1, hands.length))}
        onChange={onScrubHand}
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
                  fontWeight: active ? 700 : 400,
                  opacity: active ? 1 : 0.7,
                }}
              >
                {s}x
              </button>
            );
          })}
        </div>
      </div>
      <SessionReplayContext.Provider value={contextValue}>
        {children}
      </SessionReplayContext.Provider>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Inline styles — keep layout self-contained so the shell slots into any
// playback layout without importing shared CSS.
// ---------------------------------------------------------------------------

const MIN_TAP_TARGET_PX = 44;

const controlsStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: 8,
  background: '#111',
};

const playBtnStyle: CSSProperties = {
  minWidth: MIN_TAP_TARGET_PX,
  minHeight: MIN_TAP_TARGET_PX,
  cursor: 'pointer',
  fontWeight: 600,
  background: 'none',
  border: '1px solid #555',
  color: '#fff',
};

const speedGroupStyle: CSSProperties = {
  display: 'flex',
  gap: 4,
};

const speedBtnStyle: CSSProperties = {
  minWidth: MIN_TAP_TARGET_PX,
  minHeight: MIN_TAP_TARGET_PX,
  padding: '0 12px',
  cursor: 'pointer',
  background: 'none',
  border: '1px solid #555',
  color: '#fff',
};
