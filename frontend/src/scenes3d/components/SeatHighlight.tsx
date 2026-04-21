// T-018 — Action highlights: fold dim, bet glow, turn pulse.
//
// Per-seat visual state driven by the public `TableState` contract:
//
//   • Folded seat → reduced opacity across seat pad + nameplate. The
//     opacity reduction itself is applied by `<Seat folded>` and
//     `<Nameplate folded>` so the fold-dim survives without any
//     scene-graph work from this module — T-018 owns the props; this
//     module owns the overlay meshes.
//   • Bet / raise → a soft, accent-coloured glow plane anchored on the
//     acting seat's nameplate. The glow appears when the seat's
//     `lastAction` transitions to `bet` or `raise` and auto-clears
//     `BET_GLOW_DURATION_MS` later; a fresh bet/raise refreshes the
//     window.
//   • `state.currentSeat` → a soft ring on the felt under that seat,
//     with an opacity oscillation driving the "pulse". Exactly one ring
//     at a time; it stops (unmounts) the moment `currentSeat` changes
//     or becomes `null`.
//
// Reduced motion (`prefers-reduced-motion: reduce`) honours AC 4:
//   • Pulse ring: still rendered (state-only coloring retained), but
//     opacity is a constant mid-range value — no oscillation.
//   • Bet glow: still rendered for the full `BET_GLOW_DURATION_MS`
//     window, but opacity is constant — no fade-out.
//
// Consumed by `<PokerTable>`; must be mounted inside an R3F `<Canvas>`.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';

import {
  seatAnchorLocalToWorld,
} from './tableLayout';
import {
  HOLE_CARD_SPREAD_X,
  HOLE_CARD_Y,
  HOLE_CARD_LOCAL_Z,
} from '../animations/DealAnimationDriver';
import {
  NAMEPLATE_LOCAL_Y,
  NAMEPLATE_WIDTH,
  NAMEPLATE_HEIGHT,
  BILLBOARD_EPSILON,
  computeBillboardYRotation,
} from './Nameplate';
import { useReducedMotion } from '../state/useReducedMotion';
import type { Vec3 } from '../animations/tweens';
import type { SeatState, TableState } from '../types';

// ---------------------------------------------------------------------------
// Layout + animation constants (exported for tests)
// ---------------------------------------------------------------------------

/** Seat-pad opacity applied when a seat is folded (AC 1). */
export const FOLDED_PAD_OPACITY = 0.3;
/** Nameplate background opacity when the seat is folded (AC 1). */
export const FOLDED_NAMEPLATE_OPACITY = 0.25;
/**
 * Per-seat committed-chip stack opacity when the seat is folded
 * (T-018 AC 1 / S-3.3 — completes Cycle 29 H-1). Mirrors
 * `FOLDED_PAD_OPACITY` since the chip stack is visually a sibling of
 * the seat pad in the same local frame; a different value for chip
 * geometry is not required — same dim level keeps the folded seat's
 * contribution visually subordinate to live contributors' stacks.
 */
export const FOLDED_CHIP_STACK_OPACITY = FOLDED_PAD_OPACITY;

/** Duration of the bet/raise glow on the nameplate (AC 2). */
export const BET_GLOW_DURATION_MS = 1500;
/** Bet-glow colour — amber accent, matches existing UI chip denominations. */
export const BET_GLOW_COLOR = '#facc15';
/** Bet-glow peak opacity (state-only under reduced motion; fades under full motion). */
export const BET_GLOW_MAX_OPACITY = 0.6;

/** Turn pulse ring colour — soft blue accent. */
export const TURN_PULSE_RING_COLOR = '#60a5fa';
/** One full pulse cycle per second. */
export const TURN_PULSE_FREQUENCY_HZ = 1;
export const TURN_PULSE_MIN_OPACITY = 0.25;
export const TURN_PULSE_MAX_OPACITY = 0.9;
/** Reduced-motion static opacity — midpoint of the oscillation. */
export const TURN_PULSE_REDUCED_MOTION_OPACITY =
  (TURN_PULSE_MIN_OPACITY + TURN_PULSE_MAX_OPACITY) / 2;

/** Inner / outer radius of the pulse ring (seat-relative, world units). */
export const TURN_PULSE_RING_INNER_R = 0.5;
export const TURN_PULSE_RING_OUTER_R = 0.62;

/** Height above the felt for the pulse ring so it draws on top. */
export const TURN_PULSE_RING_LOCAL_Y = 0.011;

/** Bet-glow plane size — slightly larger than the nameplate card. */
export const BET_GLOW_WIDTH = NAMEPLATE_WIDTH * 1.25;
export const BET_GLOW_HEIGHT = NAMEPLATE_HEIGHT * 1.6;

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Opacity for the turn-pulse ring at `elapsedMs` into its lifetime. A
 * cosine oscillator running at `TURN_PULSE_FREQUENCY_HZ` between
 * `TURN_PULSE_MIN_OPACITY` and `TURN_PULSE_MAX_OPACITY`. When reduced
 * motion is requested the opacity is pinned to
 * `TURN_PULSE_REDUCED_MOTION_OPACITY` (state-only coloring, per AC 4).
 */
export function pulseOpacity(elapsedMs: number, reducedMotion: boolean): number {
  if (reducedMotion) return TURN_PULSE_REDUCED_MOTION_OPACITY;
  const phase = (elapsedMs / 1000) * 2 * Math.PI * TURN_PULSE_FREQUENCY_HZ;
  // cos ∈ [-1, 1] → map to [min, max].
  const t = (1 - Math.cos(phase)) / 2; // 0..1
  return (
    TURN_PULSE_MIN_OPACITY +
    t * (TURN_PULSE_MAX_OPACITY - TURN_PULSE_MIN_OPACITY)
  );
}

/** World position of the turn-pulse ring (sits on the felt at the seat). */
export function turnPulseRingWorldPosition(
  seatIndex: number,
  seatCount: number,
): Vec3 {
  return seatAnchorLocalToWorld(seatIndex, seatCount, [
    0,
    TURN_PULSE_RING_LOCAL_Y,
    0,
  ]);
}

/** World position of the bet-glow plane (co-located with the nameplate). */
export function betGlowWorldPosition(
  seatIndex: number,
  seatCount: number,
): Vec3 {
  return seatAnchorLocalToWorld(seatIndex, seatCount, [
    0,
    NAMEPLATE_LOCAL_Y,
    0,
  ]);
}

/** True when the seat's last action on the current street is a bet/raise. */
export function isGlowAction(seat: SeatState): boolean {
  const a = seat.lastAction?.action;
  return a === 'bet' || a === 'raise';
}

/**
 * Stable identity for a seat's latest bet/raise — used to detect when a
 * fresh action has landed and the glow window should restart. Includes
 * hand and street so the same-action-across-streets case fires a new
 * window, and amount so a re-raise on the same street fires too.
 */
function glowKey(state: TableState, seat: SeatState): string | null {
  if (!isGlowAction(seat)) return null;
  const a = seat.lastAction!;
  return `${state.handId}:${state.streetIndex}:${seat.seatIndex}:${a.action}:${a.amount ?? 0}`;
}

// ---------------------------------------------------------------------------
// <TurnPulseRing>
// ---------------------------------------------------------------------------

export interface TurnPulseRingProps {
  seatIndex: number;
  seatCount: number;
}

/**
 * Soft accent ring rendered on the felt under the active seat. Opacity
 * oscillates via `pulseOpacity()`; under reduced motion it pins to a
 * static mid-range value.
 */
/* eslint-disable react/no-unknown-property -- R3F JSX intrinsics */
export function TurnPulseRing({ seatIndex, seatCount }: TurnPulseRingProps) {
  const reducedMotion = useReducedMotion();
  const position = useMemo<Vec3>(
    () => turnPulseRingWorldPosition(seatIndex, seatCount),
    [seatIndex, seatCount],
  );
  const elapsedRef = useRef(0);
  const [opacity, setOpacity] = useState<number>(() =>
    pulseOpacity(0, reducedMotion),
  );

  // Reset the oscillator whenever the seat changes so the new ring starts
  // at t=0 rather than jumping mid-phase.
  useEffect(() => {
    elapsedRef.current = 0;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset oscillator on seat / motion-pref change
    setOpacity(pulseOpacity(0, reducedMotion));
  }, [seatIndex, reducedMotion]);

  useFrame((_s, dt: number) => {
    if (reducedMotion) return;
    elapsedRef.current += dt * 1000;
    const next = pulseOpacity(elapsedRef.current, false);
    setOpacity((prev) => (Math.abs(prev - next) < 1e-4 ? prev : next));
  });

  return (
    <group
      name={`turn-pulse-ring-${seatIndex}`}
      position={position}
      userData={{ seatIndex, reducedMotion }}
    >
      <mesh name="turn-pulse-ring" rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry
          args={[TURN_PULSE_RING_INNER_R, TURN_PULSE_RING_OUTER_R, 48]}
        />
        <meshBasicMaterial
          color={TURN_PULSE_RING_COLOR}
          transparent
          opacity={opacity}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
/* eslint-enable react/no-unknown-property */

// ---------------------------------------------------------------------------
// <BetGlowOverlay>
// ---------------------------------------------------------------------------

export interface BetGlowOverlayProps {
  seatIndex: number;
  seatCount: number;
  /** True while the glow window is live; false (or unmount) clears it. */
  active: boolean;
}

/**
 * Accent plane rendered in front of a seat's nameplate for the duration
 * of a bet/raise glow window. Opacity is constant under reduced motion;
 * otherwise it fades linearly from `BET_GLOW_MAX_OPACITY` → 0 over the
 * remaining lifetime of the window. Rendering the mesh at all is gated
 * by `active` — when `<SeatHighlights>` times out the window it flips
 * `active` false and this component unmounts.
 *
 * Billboarding (Cycle 29 H-2): the glow plane shares the sibling
 * `<Nameplate>` billboard math — its Y-axis rotation is driven from the
 * active R3F camera via `computeBillboardYRotation`, so the plane always
 * faces the viewer on every seat of the ellipse rather than rendering
 * edge-on at the world +Z default. The helper is reused verbatim from
 * `Nameplate.tsx` so glow and nameplate stay locked to the same
 * orientation regardless of camera pose.
 */
/* eslint-disable react/no-unknown-property -- R3F JSX intrinsics */
export function BetGlowOverlay({
  seatIndex,
  seatCount,
  active,
}: BetGlowOverlayProps) {
  const reducedMotion = useReducedMotion();
  const position = useMemo<Vec3>(
    () => betGlowWorldPosition(seatIndex, seatCount),
    [seatIndex, seatCount],
  );

  const elapsedRef = useRef(0);
  const [opacity, setOpacity] = useState<number>(BET_GLOW_MAX_OPACITY);
  const [rotationY, setRotationY] = useState<number>(0);

  // Reset the fade whenever we transition into an active glow window.
  useEffect(() => {
    if (active) {
      elapsedRef.current = 0;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset fade timer on glow activation
      setOpacity(BET_GLOW_MAX_OPACITY);
    }
  }, [active, seatIndex]);

  useFrame((frameState: unknown, dt: number) => {
    // Opacity fade — gated by active + motion preference.
    if (active && !reducedMotion) {
      elapsedRef.current += dt * 1000;
      const t = Math.min(1, elapsedRef.current / BET_GLOW_DURATION_MS);
      const next = BET_GLOW_MAX_OPACITY * (1 - t);
      setOpacity((prev) => (Math.abs(prev - next) < 1e-4 ? prev : next));
    }

    // Billboard — mirrors Nameplate's useFrame driver so the glow tracks
    // the active camera. Runs whether or not the glow is fading so a
    // reduced-motion viewer still sees a front-facing plane.
    const fs = frameState as {
      camera?: { position?: { x: number; z: number } };
    };
    const camPos = fs?.camera?.position;
    if (
      !camPos ||
      typeof camPos.x !== 'number' ||
      typeof camPos.z !== 'number'
    ) {
      return;
    }
    const target = computeBillboardYRotation(camPos, {
      x: position[0],
      z: position[2],
    });
    setRotationY((prev) =>
      Math.abs(prev - target) < BILLBOARD_EPSILON ? prev : target,
    );
  });

  if (!active) return null;

  return (
    <group
      name={`bet-glow-${seatIndex}`}
      position={position}
      rotation={[0, rotationY, 0]}
      userData={{ seatIndex, reducedMotion }}
    >
      <mesh name="bet-glow">
        <planeGeometry args={[BET_GLOW_WIDTH, BET_GLOW_HEIGHT]} />
        <meshBasicMaterial
          color={BET_GLOW_COLOR}
          transparent
          opacity={reducedMotion ? BET_GLOW_MAX_OPACITY : opacity}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
/* eslint-enable react/no-unknown-property */

// ---------------------------------------------------------------------------
// <SeatHighlights> composer
// ---------------------------------------------------------------------------

export interface SeatHighlightsProps {
  state: TableState;
  seatCount: number;
}

/**
 * Scene-graph composer for T-018. Mounts the single `<TurnPulseRing>` at
 * `state.currentSeat` (AC 3 — exactly one at a time) and one
 * `<BetGlowOverlay>` per seat whose most recent action on the current
 * street is bet/raise (AC 2 — auto-clears after BET_GLOW_DURATION_MS).
 *
 * Glow-window lifecycle is managed here rather than inside
 * `<BetGlowOverlay>` so that a seat's glow does not flicker when React
 * reconciles the per-frame `TableState` — the keyed `glowKey()` fires a
 * single `setTimeout` per fresh bet/raise and the overlay stays mounted
 * for exactly that window.
 */
export function SeatHighlights({ state, seatCount }: SeatHighlightsProps) {
  // Map of seat index → current active glow key; used to drive per-seat
  // mount of <BetGlowOverlay active>. Cleared on timeout.
  const [activeGlowSeats, setActiveGlowSeats] = useState<Record<number, string>>(
    {},
  );
  // Latest key we've *scheduled* a timer for, per seat — so repeated
  // renders with the same action don't re-arm the timeout.
  const scheduledKeysRef = useRef<Record<number, string>>({});
  const timersRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  // Compute current keys for all seats (stable during a render).
  const keysBySeat: Record<number, string | null> = useMemo(() => {
    const out: Record<number, string | null> = {};
    for (const s of state.seats) out[s.seatIndex] = glowKey(state, s);
    return out;
  }, [state]);

  useEffect(() => {
    for (const s of state.seats) {
      const key = keysBySeat[s.seatIndex];
      const prev = scheduledKeysRef.current[s.seatIndex];
      if (key && key !== prev) {
        // New bet/raise — (re)schedule the window.
        scheduledKeysRef.current[s.seatIndex] = key;
        setActiveGlowSeats((cur) => ({ ...cur, [s.seatIndex]: key }));
        const existing = timersRef.current[s.seatIndex];
        if (existing != null) clearTimeout(existing);
        timersRef.current[s.seatIndex] = setTimeout(() => {
          setActiveGlowSeats((cur) => {
            // Only clear if we're still showing this exact key.
            if (cur[s.seatIndex] !== key) return cur;
            const { [s.seatIndex]: _drop, ...rest } = cur;
            void _drop;
            return rest;
          });
          delete timersRef.current[s.seatIndex];
        }, BET_GLOW_DURATION_MS);
      }
    }
    // We intentionally do NOT clear glow on key=null — once the action
    // is no longer the latest the timer alone clears the overlay.
  }, [keysBySeat, state.seats]);

  // Unmount: clear every pending timer.
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const id of Object.values(timers)) clearTimeout(id);
    };
  }, []);

  return (
    <group name="action-highlights">
      {state.currentSeat !== null && (
        <TurnPulseRing
          // Keyed by seat so the internal elapsed timer resets on change.
          key={`pulse-${state.currentSeat}`}
          seatIndex={state.currentSeat}
          seatCount={seatCount}
        />
      )}
      {state.seats.map((s) => (
        <BetGlowOverlay
          key={`glow-${s.seatIndex}`}
          seatIndex={s.seatIndex}
          seatCount={seatCount}
          active={activeGlowSeats[s.seatIndex] != null}
        />
      ))}
    </group>
  );
}

export default SeatHighlights;


// ---------------------------------------------------------------------------
// T-013 — Showdown reveal + winning-hand glow outline
// ---------------------------------------------------------------------------
//
// Triggered when `state.phase === 'showdown'` and at least one seat has
// `result === 'won'`. For every winner we render:
//
//   • A theme-coloured outline plane slightly larger than each revealed
//     hole card. Winners who mucked / won by fold with `holeCards: null`
//     contribute zero outline planes.
//   • A seat-level glow ring on the felt under the winner's pad. Always
//     rendered for every winner — so the all-fold / mucked case still
//     has a visible highlight target (AC 2, plan.md § Visibility Policy
//     fold_then_win edge).
//
// The glow window is `SHOWDOWN_GLOW_DURATION_MS` (3000ms). Clearing
// rules (AC 3):
//
//   • After the timer elapses, the overlay unmounts.
//   • On handId change (next hand dealt), the window key becomes a new
//     one; since it's null for the new hand, the overlay clears.
//   • On phase change away from 'showdown' (e.g. back to preflop for
//     the next hand), the window key becomes null and the overlay
//     clears immediately.
//
// Under `prefers-reduced-motion: reduce` (AC 4 reduced-motion arm) the
// fade-in / fade-out envelope is skipped and the opacity sits at
// `SHOWDOWN_GLOW_MAX_OPACITY` for the entire 3s window before snapping
// to 0.

/** Duration of the showdown glow window, ms (plan.md § Animation table). */
export const SHOWDOWN_GLOW_DURATION_MS = 3000;
/** Linear fade-in segment length, ms. */
export const SHOWDOWN_GLOW_FADE_IN_MS = 500;
/** Linear fade-out segment length, ms. */
export const SHOWDOWN_GLOW_FADE_OUT_MS = 500;
/** Peak opacity for both the card outline and the seat ring. */
export const SHOWDOWN_GLOW_MAX_OPACITY = 0.75;
/** Theme-accent colour — cyan tuned to sit between the bet-glow amber
 *  and the turn-pulse blue so simultaneous T-018 highlights remain
 *  visually distinguishable. */
export const SHOWDOWN_GLOW_COLOR = '#22d3ee';

/** Default hole-card plane size (mirrors `<Card>` DEFAULT_SIZE). */
const SHOWDOWN_CARD_WIDTH = 0.42;
const SHOWDOWN_CARD_HEIGHT = 0.58;
/** Outline padding beyond the card edge, world units. */
export const SHOWDOWN_CARD_OUTLINE_PADDING = 0.06;
export const SHOWDOWN_CARD_OUTLINE_WIDTH =
  SHOWDOWN_CARD_WIDTH + SHOWDOWN_CARD_OUTLINE_PADDING * 2;
export const SHOWDOWN_CARD_OUTLINE_HEIGHT =
  SHOWDOWN_CARD_HEIGHT + SHOWDOWN_CARD_OUTLINE_PADDING * 2;
/** Outline Y-offset above the felt (sits between the felt and the card). */
export const SHOWDOWN_CARD_OUTLINE_LOCAL_Y = HOLE_CARD_Y - 0.005;

/** Seat-ring inner / outer radii (world units, larger than the seat pad). */
export const SHOWDOWN_RING_INNER_R = 0.52;
export const SHOWDOWN_RING_OUTER_R = 0.7;
/** Seat-ring Y-offset above the felt. */
export const SHOWDOWN_RING_LOCAL_Y = 0.013;

/**
 * Piecewise-linear opacity envelope for the showdown glow. Returns 0
 * outside `[0, SHOWDOWN_GLOW_DURATION_MS)`, ramps up over the fade-in
 * window, holds at `SHOWDOWN_GLOW_MAX_OPACITY`, and ramps down over the
 * fade-out window. Under reduced motion the envelope collapses to a
 * constant peak value for the entire window.
 */
export function showdownGlowOpacity(
  elapsedMs: number,
  reducedMotion: boolean,
): number {
  if (elapsedMs <= 0) return reducedMotion ? SHOWDOWN_GLOW_MAX_OPACITY : 0;
  if (elapsedMs >= SHOWDOWN_GLOW_DURATION_MS) return 0;
  if (reducedMotion) return SHOWDOWN_GLOW_MAX_OPACITY;
  if (elapsedMs < SHOWDOWN_GLOW_FADE_IN_MS) {
    return (elapsedMs / SHOWDOWN_GLOW_FADE_IN_MS) * SHOWDOWN_GLOW_MAX_OPACITY;
  }
  const fadeOutStart =
    SHOWDOWN_GLOW_DURATION_MS - SHOWDOWN_GLOW_FADE_OUT_MS;
  if (elapsedMs <= fadeOutStart) return SHOWDOWN_GLOW_MAX_OPACITY;
  const t = (elapsedMs - fadeOutStart) / SHOWDOWN_GLOW_FADE_OUT_MS;
  return SHOWDOWN_GLOW_MAX_OPACITY * (1 - t);
}

/**
 * Seat indices of every winner at the current showdown. Empty outside
 * showdown; empty when no seat has `result === 'won'` (pre-resolution
 * frame). Split-pot returns all contributors.
 */
export function winningSeatIndices(state: TableState): number[] {
  if (state.phase !== 'showdown') return [];
  const out: number[] = [];
  for (const s of state.seats) {
    if (s.result === 'won') out.push(s.seatIndex);
  }
  return out;
}

/** Stable identity for the current glow window — null when no glow
 *  should be active. Keyed by handId + sorted winner list so that any
 *  winner change (or a new hand) restarts the window. */
function showdownGlowKey(state: TableState): string | null {
  const winners = winningSeatIndices(state);
  if (winners.length === 0) return null;
  const sorted = [...winners].sort((a, b) => a - b);
  return `${state.handId}:${sorted.join(',')}`;
}

export interface ShowdownGlowsProps {
  state: TableState;
  seatCount: number;
}

/**
 * Composer for the winning-hand glow overlay (T-013). Mounts the
 * per-winner outlines + seat ring when a showdown resolves, runs the
 * 3s fade envelope, and auto-clears on timeout / handId change /
 * phase change away from 'showdown'.
 */
/* eslint-disable react/no-unknown-property -- R3F JSX intrinsics */
export function ShowdownGlows({ state, seatCount }: ShowdownGlowsProps) {
  const reducedMotion = useReducedMotion();
  const currentKey = showdownGlowKey(state);

  // activeKey — the glow window currently rendering. Null when no
  // glow is active. Kept in state so timeout / state-change events
  // trigger a re-render. Initialised to null so the mount-time effect
  // owns the start-of-window bookkeeping (timer + startTime) uniformly
  // regardless of whether the first render carries a resolved winner.
  const [activeKey, setActiveKey] = useState<string | null>(null);
  // Impure clock reads are confined to effect / frame callbacks (the
  // react-hooks/purity rule forbids them during render). 0 is a
  // placeholder that is always overwritten before the first frame
  // reads it, since the key-change effect seeds `startTimeRef` the
  // instant it activates a window.
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Once a window has elapsed for a given key we mark it expired so the
  // key-change effect does not immediately re-arm a fresh 3s timer on
  // the next render (the timer callback flips `activeKey` → null, which
  // is a dep of the effect; without this guard the effect would loop).
  const expiredKeyRef = useRef<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  // Key-change effect: start / restart / clear the window.
  useEffect(() => {
    // Key cleared (null) — unmount the overlay and cancel any pending
    // timer.
    if (currentKey == null) {
      if (timerRef.current != null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      expiredKeyRef.current = null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- window cleared by external state change
      setActiveKey(null);
      return;
    }
    if (currentKey === activeKey) return;
    // Already expired for this key — the 3s window fired its clear; do
    // not re-arm. A new winner key (new hand / new winners) resets the
    // guard below.
    if (expiredKeyRef.current === currentKey) return;
    // New or changed key — (re)start the window.
    if (timerRef.current != null) clearTimeout(timerRef.current);
    expiredKeyRef.current = null;
    startTimeRef.current =
      typeof performance !== 'undefined' ? performance.now() : Date.now();
    setActiveKey(currentKey);
    setElapsedMs(0);
    timerRef.current = setTimeout(() => {
      expiredKeyRef.current = currentKey;
      setActiveKey((prev) => (prev === currentKey ? null : prev));
      timerRef.current = null;
    }, SHOWDOWN_GLOW_DURATION_MS);
  }, [currentKey, activeKey]);

  // Unmount cleanup.
  useEffect(() => {
    return () => {
      if (timerRef.current != null) clearTimeout(timerRef.current);
    };
  }, []);

  // Per-frame elapsed tracker — drives the fade envelope. Under
  // reduced motion we skip the frame-driven update; the pure helper
  // collapses to a constant peak so render stays stable.
  useFrame(() => {
    if (reducedMotion) return;
    if (activeKey == null) return;
    const now =
      typeof performance !== 'undefined' ? performance.now() : Date.now();
    const next = now - startTimeRef.current;
    setElapsedMs((prev) => (Math.abs(prev - next) < 1 ? prev : next));
  });

  // Hooks above this line run unconditionally every render. Winner
  // descriptors are memoised on the *current* state so they're ready
  // whenever `activeKey` is non-null; when the overlay is inactive we
  // still call the hook (with an empty winners list) to keep the
  // hook-call order stable across renders (React rules-of-hooks).
  const winners = useMemo(() => winningSeatIndices(state), [state]);
  const descriptors = useMemo(() => {
    return winners.map((seatIndex) => {
      const seat = state.seats.find((s) => s.seatIndex === seatIndex);
      return {
        seatIndex,
        holeCards: seat?.holeCards ?? null,
        ringPosition: seatAnchorLocalToWorld(seatIndex, seatCount, [
          0,
          SHOWDOWN_RING_LOCAL_Y,
          0,
        ]),
        holePositions: [0, 1].map((slot) =>
          seatAnchorLocalToWorld(seatIndex, seatCount, [
            slot === 0 ? -HOLE_CARD_SPREAD_X : HOLE_CARD_SPREAD_X,
            SHOWDOWN_CARD_OUTLINE_LOCAL_Y,
            HOLE_CARD_LOCAL_Z,
          ]),
        ),
      };
    });
  }, [winners, state.seats, seatCount]);

  const opacity = showdownGlowOpacity(elapsedMs, reducedMotion);

  // Always render the wrapper group so downstream tests / scene
  // introspection can detect the mount point. When inactive, no
  // children are emitted and the group is effectively invisible.
  const renderDescriptors = activeKey == null ? [] : descriptors;

  return (
    <group
      name="showdown-glows"
      userData={{ activeKey, reducedMotion, active: activeKey != null }}
    >
      {renderDescriptors.map((d) => (
        <group
          key={`showdown-winner-${d.seatIndex}`}
          name={`showdown-winner-${d.seatIndex}`}
        >
          <group
            name={`showdown-seat-ring-${d.seatIndex}`}
            position={d.ringPosition}
          >
            <mesh
              name="showdown-seat-ring"
              rotation={[-Math.PI / 2, 0, 0]}
            >
              <ringGeometry
                args={[SHOWDOWN_RING_INNER_R, SHOWDOWN_RING_OUTER_R, 48]}
              />
              <meshBasicMaterial
                color={SHOWDOWN_GLOW_COLOR}
                transparent
                opacity={opacity}
                depthWrite={false}
              />
            </mesh>
          </group>
          {d.holeCards
            ? d.holePositions.map((pos, slot) => (
                <group
                  key={`showdown-card-outline-${d.seatIndex}-${slot}`}
                  name={`showdown-card-outline-${d.seatIndex}-${slot}`}
                  position={pos}
                >
                  <mesh
                    name="showdown-card-outline"
                    rotation={[-Math.PI / 2, 0, 0]}
                  >
                    <planeGeometry
                      args={[
                        SHOWDOWN_CARD_OUTLINE_WIDTH,
                        SHOWDOWN_CARD_OUTLINE_HEIGHT,
                      ]}
                    />
                    <meshBasicMaterial
                      color={SHOWDOWN_GLOW_COLOR}
                      transparent
                      opacity={opacity}
                      depthWrite={false}
                    />
                  </mesh>
                </group>
              ))
            : null}
        </group>
      ))}
    </group>
  );
}
/* eslint-enable react/no-unknown-property */
