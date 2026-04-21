// T-016 — Per-seat billboarded nameplate with live stack tween.
//
// Renders, above each occupied seat, a small billboarded group showing the
// player's name + formatted stack amount. When the stack changes the
// numeric value tweens smoothly (~300ms, ease-out-cubic) from the old to
// the new value instead of snapping. The nameplate's Y-axis rotation
// tracks the active R3F camera so the (x, z) orientation always faces the
// viewer. Empty seats (no player or inactive) render nothing.
//
// Design notes:
//   - Pure helpers (`formatStackAmount`, `computeNameplateWorldPosition`,
//     `computeBillboardYRotation`) are exported so the billboard math and
//     stack formatting can be unit-tested without R3F / WebGL.
//   - The tween driver mirrors the DealerButton pattern: a state-backed
//     `displayedStack` re-renders on each tick so the value is observable
//     via the DOM under happy-dom.
//   - Billboarding is driven inside a `useFrame` read of
//     `state.camera.position`; under the test mock (which passes `{}`) the
//     callback is a no-op and the math is exercised via the pure helper.
//   - `useReducedMotion()` is honoured: stack updates snap instantly.
//
// Consumed by `<PokerTable>`; must be mounted inside an R3F `<Canvas>`.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';

import { seatAnchorLocalToWorld } from './tableLayout';
import { useReducedMotion } from '../state/useReducedMotion';
import { FOLDED_NAMEPLATE_OPACITY } from './SeatHighlight';
import {
  createTween,
  lerpNumber,
  type TweenHandle,
  type Vec3,
} from '../animations/tweens';

// ---------------------------------------------------------------------------
// Layout + animation constants
// ---------------------------------------------------------------------------

/** Duration of the stack-value tween when a seat's stack changes. */
export const NAMEPLATE_STACK_ANIMATION_MS = 300;

/** Vertical offset above the seat anchor (world units). */
export const NAMEPLATE_LOCAL_Y = 0.6;

/**
 * Width / height (world units) of the nameplate card. Sized so a 6-char
 * stack string remains legible down to a 360px-wide viewport (AC 3).
 */
export const NAMEPLATE_WIDTH = 0.8;
export const NAMEPLATE_HEIGHT = 0.28;

/**
 * Baseline font size (world units) for the player-name + stack text.
 * Exported so the layering tests can assert the value is large enough to
 * remain readable on a 360px viewport under the default camera preset.
 */
export const NAMEPLATE_FONT_SIZE = 0.09;

/** Baseline opacity of the nameplate card background (T-018: dims to `FOLDED_NAMEPLATE_OPACITY` when the seat is folded). */
export const NAMEPLATE_BG_OPACITY = 0.75;

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Format a stack amount as a USD string with thousands separators and no
 * fractional part (chips are whole units in the analytics pipeline; the
 * tween interpolates through floats but the rendered label always shows
 * an integer dollar amount).
 */
export function formatStackAmount(n: number): string {
  const rounded = Math.round(n);
  const sign = rounded < 0 ? '-' : '';
  const abs = Math.abs(rounded);
  const digits = abs.toString();
  const parts: string[] = [];
  for (let i = digits.length; i > 0; i -= 3) {
    parts.unshift(digits.slice(Math.max(0, i - 3), i));
  }
  return `${sign}$${parts.join(',')}`;
}

/**
 * World position of a seat's nameplate anchor. Sits directly above the
 * seat-local origin at `NAMEPLATE_LOCAL_Y`.
 */
export function computeNameplateWorldPosition(
  seatIndex: number,
  seatCount: number,
): Vec3 {
  return seatAnchorLocalToWorld(seatIndex, seatCount, [0, NAMEPLATE_LOCAL_Y, 0]);
}

/**
 * Compute the Y-axis rotation (radians) required so a group's local +Z
 * axis points toward `cameraPos` in the X/Z plane. Y coordinates are
 * ignored — the nameplate only rotates about the vertical axis so the
 * text stays upright while tracking the camera's azimuth.
 *
 * A rotation about Y by φ maps the local +Z axis (0, 0, 1) to the world
 * vector (sin φ, 0, cos φ). Matching the X/Z direction toward the camera
 * gives `φ = atan2(dx, dz)` where `(dx, dz) = (cam - obj)` in world XZ.
 *
 * When the camera is coincident with the object in XZ, the direction is
 * undefined and we return 0 so the nameplate keeps its prior orientation.
 */
export function computeBillboardYRotation(
  cameraPos: { x: number; z: number },
  objectPos: { x: number; z: number },
): number {
  const dx = cameraPos.x - objectPos.x;
  const dz = cameraPos.z - objectPos.z;
  if (dx === 0 && dz === 0) return 0;
  return Math.atan2(dx, dz);
}

// ---------------------------------------------------------------------------
// <Nameplate>
// ---------------------------------------------------------------------------

export interface NameplateProps {
  seatIndex: number;
  seatCount: number;
  /** Null / empty → the nameplate hides entirely (AC 4). */
  playerName: string | null;
  /** Current stack amount (the source-of-truth value we tween toward). */
  stack: number;
  /** Whether the seat is active; inactive seats hide the nameplate. */
  isActive?: boolean;
  /**
   * T-018 — whether the seated player has folded this hand. When `true`,
   * the nameplate card background dims to `FOLDED_NAMEPLATE_OPACITY` (AC 1).
   */
  folded?: boolean;
}

/**
 * Billboard rotation threshold (radians). A Y-axis rotation delta below
 * this epsilon is considered "settled" and skips the per-frame state
 * update so we don't thrash React. Exported so other components using
 * the same face-camera pattern can share the tunable (M4 follow-up).
 */
export const BILLBOARD_EPSILON = 1e-4;

/**
 * Scene-graph component rendering one seat's billboarded nameplate.
 * Returns `null` when the seat is empty (no player) or inactive — AC 4.
 */
/* eslint-disable react/no-unknown-property -- R3F JSX intrinsics */
export function Nameplate({
  seatIndex,
  seatCount,
  playerName,
  stack,
  isActive = true,
  folded = false,
}: NameplateProps) {
  const reducedMotion = useReducedMotion();

  const occupied = isActive && !!playerName && playerName.trim().length > 0;

  const worldPosition = useMemo<Vec3>(
    () => computeNameplateWorldPosition(seatIndex, seatCount),
    [seatIndex, seatCount],
  );

  const [displayedStack, setDisplayedStack] = useState<number>(stack);
  // Mirror of `displayedStack` kept in a ref so the stack-reconcile effect
  // can read the latest rendered value without re-running every frame.
  // Written only inside the tween callback and the reconcile effect —
  // never during render (satisfies `react-hooks/refs`).
  const displayedStackRef = useRef<number>(stack);

  const [rotationY, setRotationY] = useState<number>(0);

  const tweenRef = useRef<TweenHandle | null>(null);

  // Track previous `occupied` so we can detect the hidden→visible
  // transition. On that edge we snap `displayedStack` to the current
  // `stack` prop *before* the tween decision runs — otherwise a newly
  // repopulated seat (previous occupant left, new player joins with a
  // different stack) would briefly tween from the old player's stack
  // to the new one. See bug-card Cycle 16 MEDIUM M2.
  const prevOccupiedRef = useRef<boolean>(occupied);

  // Reconcile `stack` prop → tween whenever it changes.
  useEffect(() => {
    const wasOccupied = prevOccupiedRef.current;
    prevOccupiedRef.current = occupied;

    if (!occupied) {
      tweenRef.current?.cancel();
      tweenRef.current = null;
      if (displayedStackRef.current !== stack) {
        displayedStackRef.current = stack;
        // Keep the rendered value in lockstep with the source of truth
        // even while the seat is hidden — otherwise a repopulated seat
        // would briefly show the previous occupant's stack on remount.
        // eslint-disable-next-line react-hooks/set-state-in-effect -- sync on hidden→visible transition
        setDisplayedStack(stack);
      }
      return;
    }

    // Hidden→visible transition: the nameplate just came back on screen
    // (e.g. new player seated). Snap displayed value to the current
    // stack so the tween decision below early-returns and we do not
    // animate from a stale reference.
    if (!wasOccupied) {
      tweenRef.current?.cancel();
      tweenRef.current = null;
      if (displayedStackRef.current !== stack) {
        displayedStackRef.current = stack;
        setDisplayedStack(stack);
      }
      return;
    }

    const latestFrom = displayedStackRef.current;
    if (latestFrom === stack) return;
    tweenRef.current?.cancel();
    const tween = createTween<number>({
      from: latestFrom,
      to: stack,
      durationMs: NAMEPLATE_STACK_ANIMATION_MS,
      lerp: lerpNumber,
      onUpdate: (v) => {
        displayedStackRef.current = v;
        setDisplayedStack(v);
      },
      onComplete: () => {
        tweenRef.current = null;
      },
      reducedMotion,
    });
    if (!tween.done) {
      tweenRef.current = tween;
    }
  }, [stack, occupied, reducedMotion]);

  // Tick the stack tween every frame.
  useFrame((frameState: unknown, dt: number) => {
    tweenRef.current?.tick(dt * 1000);
    // Billboarding — rotate about Y so local +Z faces the camera.
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
      x: worldPosition[0],
      z: worldPosition[2],
    });
    setRotationY((prev) =>
      Math.abs(prev - target) < BILLBOARD_EPSILON ? prev : target,
    );
  });

  // Cancel on unmount.
  useEffect(() => {
    return () => {
      tweenRef.current?.cancel();
      tweenRef.current = null;
    };
  }, []);

  if (!occupied) return null;

  // Two-line label: name on top, formatted stack below. The rendered
  // (tween-driven) stack is what the viewer sees; the source-of-truth
  // prop value is mirrored on `group.userData.stack` for scene-graph
  // debugging / regression hooks (see `userData` below).
  const label = `${playerName}\n${formatStackAmount(displayedStack)}`;

  return (
    <group
      name={`nameplate-${seatIndex}`}
      position={worldPosition}
      rotation={[0, rotationY, 0]}
      userData={{
        seatIndex,
        playerName,
        stack,
        displayedStack,
        label,
        folded,
      }}
    >
      <mesh name="nameplate-card">
        <planeGeometry args={[NAMEPLATE_WIDTH, NAMEPLATE_HEIGHT]} />
        <meshBasicMaterial
          color="#0f172a"
          transparent
          opacity={folded ? FOLDED_NAMEPLATE_OPACITY : NAMEPLATE_BG_OPACITY}
        />
      </mesh>
      {/*
        Real WebGL text rasterization (bug aia-core-ovhb). drei `<Text>`
        wraps troika-three-text and renders SDF glyphs inside the R3F
        scene graph — no DOM overlay, no font asset required (uses
        troika's bundled default). Positioned a hair forward on +Z so it
        draws on top of the card background.
      */}
      <Text
        name="nameplate-text"
        position={[0, 0, 0.001]}
        fontSize={NAMEPLATE_FONT_SIZE}
        color="#f8fafc"
        anchorX="center"
        anchorY="middle"
        maxWidth={NAMEPLATE_WIDTH * 0.9}
        textAlign="center"
        lineHeight={1.15}
      >
        {label}
      </Text>
    </group>
  );
}
/* eslint-enable react/no-unknown-property */

// ---------------------------------------------------------------------------
// <Nameplates>
// ---------------------------------------------------------------------------

export interface NameplatesProps {
  seats: ReadonlyArray<{
    seatIndex: number;
    playerName: string | null;
    isActive: boolean;
    stack: number;
    /** T-018 — optional fold flag forwarded to `<Nameplate folded>` (AC 1). */
    folded?: boolean;
  }>;
  seatCount: number;
}

/** Convenience wrapper rendering one `<Nameplate>` per seat. */
export function Nameplates({ seats, seatCount }: NameplatesProps) {
  return (
    <group name="nameplates">
      {seats.map((seat) => (
        <Nameplate
          key={`nameplate-${seat.seatIndex}`}
          seatIndex={seat.seatIndex}
          seatCount={seatCount}
          playerName={seat.playerName}
          stack={seat.stack}
          isActive={seat.isActive}
          folded={seat.folded ?? false}
        />
      ))}
    </group>
  );
}

export default Nameplate;
