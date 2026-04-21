import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import type { TableStatePhase } from '../types';
import {
  useTableStore,
  type ReplaySpeed,
  type StreetIdx,
} from '../state/tableStore';

/**
 * Per-hand street scrubber with play/pause (T-023).
 *
 * Renders a horizontal 5-segment control (Preflop / Flop / Turn / River /
 * Showdown) with a play/pause button that auto-advances one street every
 * `msPerStreet / speed` ms. Two binding modes:
 *
 * - `bindToReplay={false}` (default) — **live modes** (dealer embed, player
 *   POV): local component state; `onStreetIndexChange` notifies the parent,
 *   which feeds the value back into `<PokerTable state.streetIndex>` to
 *   re-run deal/chip/reveal animations (AC 1, AC 5).
 *
 * - `bindToReplay={true}` — **playback mode**: reads and writes the Zustand
 *   `replay` slice so this control composes with `<SessionReplayShell>`'s
 *   cross-hand timeline (T-023b). `speed` comes from `replay.speed` and
 *   scales auto-advance (AC 2).
 *
 * Early-end hands clamp the scrubber's reachable max to
 * `streetIndexFromPhase(outcomeStreet)` (AC 3, e.g. `outcomeStreet='flop'`
 * → max=1). Each interactive button is at least 44×44pt (AC 4).
 */
export interface HandScrubberPanelProps {
  /**
   * When true, read/write the Zustand `replay` slice (`streetIndex`,
   * `isPlaying`, `speed`). Default `false` (uncontrolled local state).
   */
  bindToReplay?: boolean;
  /** Uncontrolled initial street index (ignored when `bindToReplay`). */
  initialStreetIndex?: StreetIdx;
  /** Ignored when `bindToReplay` — uses `replay.speed` instead. */
  speed?: ReplaySpeed;
  /** Base interval per street; default 1500ms. Scaled by `speed`. */
  msPerStreet?: number;
  /**
   * Hand outcome phase; the scrubber clamps its reachable max to the
   * corresponding street index. `undefined` → all 5 streets reachable.
   */
  outcomeStreet?: TableStatePhase;
  /** Fires whenever the effective street index changes (both modes). */
  onStreetIndexChange?: (i: StreetIdx) => void;
  /** Fires whenever the play/pause state changes (both modes). */
  onPlayingChange?: (isPlaying: boolean) => void;
  hidden?: boolean;
  className?: string;
  style?: CSSProperties;
}

const STREET_LABELS = ['Pre-Flop', 'Flop', 'Turn', 'River', 'Showdown'] as const;
const STREET_SLUGS = ['preflop', 'flop', 'turn', 'river', 'showdown'] as const;

/** AC 4 — 44×44pt minimum tap target (iOS HIG / Material). */
const MIN_TAP_TARGET_PX = 44;

/**
 * Maps a `TableStatePhase` to the corresponding street index. Exported so
 * consumers can compute `maxStreetIndex` the same way T-023b does.
 */
export function streetIndexFromOutcomePhase(
  phase: TableStatePhase | undefined,
): StreetIdx {
  switch (phase) {
    case 'flop':
      return 1;
    case 'turn':
      return 2;
    case 'river':
      return 3;
    case 'showdown':
      return 4;
    case 'preflop':
    case 'awaiting_cards':
      return 0;
    default:
      return 4;
  }
}

export function HandScrubberPanel({
  bindToReplay = false,
  initialStreetIndex = 0,
  speed: speedProp = 1,
  msPerStreet = 1500,
  outcomeStreet,
  onStreetIndexChange,
  onPlayingChange,
  hidden,
  className,
  style,
}: HandScrubberPanelProps) {
  // --- Bound state (replay slice) -----------------------------------------
  const replayStreet = useTableStore((s) => s.replay.streetIndex);
  const replayPlaying = useTableStore((s) => s.replay.isPlaying);
  const replaySpeed = useTableStore((s) => s.replay.speed);
  const setReplayStreetIndex = useTableStore((s) => s.setReplayStreetIndex);
  const setReplayPlaying = useTableStore((s) => s.setReplayPlaying);

  // --- Local state (live modes) -------------------------------------------
  const [localStreet, setLocalStreet] = useState<StreetIdx>(initialStreetIndex);
  const [localPlaying, setLocalPlaying] = useState<boolean>(false);

  const streetIndex: StreetIdx = bindToReplay ? replayStreet : localStreet;
  const isPlaying = bindToReplay ? replayPlaying : localPlaying;
  const effectiveSpeed: ReplaySpeed = bindToReplay ? replaySpeed : speedProp;

  const maxStreet = useMemo(
    () => streetIndexFromOutcomePhase(outcomeStreet),
    [outcomeStreet],
  );

  // AC 3 — if a new `outcomeStreet` reduces the max below the current
  // street, clamp down. Fire change callback so the parent's TableState
  // stays in sync.
  useEffect(() => {
    if (streetIndex > maxStreet) {
      if (bindToReplay) setReplayStreetIndex(maxStreet);
      else setLocalStreet(maxStreet);
      onStreetIndexChange?.(maxStreet);
    }
    // streetIndex intentionally excluded — we only want to react to
    // maxStreet shrinking, not to every user-driven street change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxStreet, bindToReplay]);

  // Commit streetIndex changes through a single setter so both modes share
  // the callback and clamp logic.
  const setStreet = useCallback(
    (next: StreetIdx) => {
      const clamped = Math.min(next, maxStreet) as StreetIdx;
      if (bindToReplay) setReplayStreetIndex(clamped);
      else setLocalStreet(clamped);
      onStreetIndexChange?.(clamped);
    },
    [bindToReplay, maxStreet, onStreetIndexChange, setReplayStreetIndex],
  );

  const setPlaying = useCallback(
    (b: boolean) => {
      if (bindToReplay) setReplayPlaying(b);
      else setLocalPlaying(b);
      onPlayingChange?.(b);
    },
    [bindToReplay, onPlayingChange, setReplayPlaying],
  );

  // --- Auto-advance timer (AC 2) ------------------------------------------
  // Refs so the interval callback always sees the latest values without
  // tearing down the timer on every render.
  const streetRef = useRef(streetIndex);
  streetRef.current = streetIndex;
  const maxRef = useRef(maxStreet);
  maxRef.current = maxStreet;

  useEffect(() => {
    if (!isPlaying) return;
    const periodMs = Math.max(1, msPerStreet / effectiveSpeed);
    const handle = setInterval(() => {
      const cur = streetRef.current;
      const lim = maxRef.current;
      if (cur >= lim) {
        setPlaying(false);
        return;
      }
      setStreet((cur + 1) as StreetIdx);
    }, periodMs);
    return () => clearInterval(handle);
  }, [isPlaying, effectiveSpeed, msPerStreet, setStreet, setPlaying]);

  if (hidden) return null;

  return (
    <section
      role="region"
      aria-label="Hand street scrubber"
      data-testid="hand-scrubber-panel"
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: 8,
        ...style,
      }}
    >
      <button
        type="button"
        aria-pressed={isPlaying}
        aria-label={isPlaying ? 'Pause' : 'Play'}
        data-testid="scrubber-play-toggle"
        data-playing={isPlaying ? 'true' : 'false'}
        onClick={() => setPlaying(!isPlaying)}
        style={{
          minWidth: MIN_TAP_TARGET_PX,
          minHeight: MIN_TAP_TARGET_PX,
          cursor: 'pointer',
          fontWeight: 600,
        }}
      >
        {isPlaying ? '❚❚' : '▶'}
      </button>
      <div
        role="group"
        aria-label="Street"
        data-testid="hand-scrubber-streets"
        style={{
          display: 'flex',
          gap: 4,
          flex: 1,
          touchAction: 'manipulation',
        }}
      >
        {STREET_LABELS.map((label, i) => {
          const idx = i as StreetIdx;
          const active = idx === streetIndex;
          const disabled = idx > maxStreet;
          return (
            <button
              key={label}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={label}
              disabled={disabled}
              data-testid={`scrubber-street-${STREET_SLUGS[i]}`}
              data-active={active ? 'true' : 'false'}
              data-disabled={disabled ? 'true' : 'false'}
              onClick={() => !disabled && setStreet(idx)}
              style={{
                minWidth: MIN_TAP_TARGET_PX,
                minHeight: MIN_TAP_TARGET_PX,
                padding: '0 12px',
                flex: 1,
                cursor: disabled ? 'default' : 'pointer',
                opacity: disabled ? 0.35 : 1,
                fontWeight: active ? 700 : 400,
                touchAction: 'manipulation',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default HandScrubberPanel;
