// T-019 — Dealer button + SB / BB markers.
//
// Renders three small disc meshes on top of the felt that track the
// current dealer / small-blind / big-blind seats, and tween to their new
// positions when the dealer rotates on a hand transition (~600ms,
// ease-out-cubic — same spec as the camera preset transitions).
//
// Scope:
//   - Pure position helpers (`dealerButtonLocalOffset`,
//     `dealerButtonWorldPosition`, `smallBlindWorldPosition`,
//     `bigBlindWorldPosition`) are exported for direct unit testing so the
//     math stays independent of React / R3F.
//   - `<TableMarkers>` is the scene-graph composer: three `<group>`s —
//     `dealer-button`, `small-blind-marker`, `big-blind-marker` — each
//     positioned via React state mirrored from an in-flight `TweenHandle`
//     (mirrors `<CameraPresetController>` so the animation is observable
//     in happy-dom tests via the group's `position` attribute).
//   - `useReducedMotion()` is honoured: when the user prefers reduced
//     motion the tween resolves synchronously so markers snap to the new
//     seat without an intermediate animation.
//
// Consumed by `<PokerTable>` — the component is a pure R3F scene-graph
// composition and must be mounted inside an R3F `<Canvas>`.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';

import { seatAnchorLocalToWorld } from './tableLayout';
import { useReducedMotion } from '../state/useReducedMotion';
import { createTween, lerpVec3, type TweenHandle, type Vec3 } from '../animations/tweens';
import type { TableState } from '../types';

// ---------------------------------------------------------------------------
// Layout constants (exported for tests + downstream consumers)
// ---------------------------------------------------------------------------

/** Duration of the dealer/SB/BB tween when the button rotates. */
export const DEALER_BUTTON_ANIMATION_MS = 600;

/** Seat-local inward offset (+Z points toward table center). */
export const MARKER_LOCAL_Z = 0.9;

/** Y offset above the felt so markers are visible over the table surface. */
export const MARKER_HEIGHT_Y = 0.08;

/**
 * Dealer button's seat-local +X offset. Places the button *toward* the
 * small-blind seat so it sits to the right of SB per poker convention
 * (T-019 AC 4). Sign is chosen per-seat by `dealerButtonLocalOffset`
 * based on which side of the dealer the SB sits.
 */
export const DEALER_BUTTON_LOCAL_X = 0.25;

/** Visible radius of the marker disc (matches a standard poker chip puck). */
export const MARKER_RADIUS = 0.16;
export const MARKER_THICKNESS = 0.04;

// ---------------------------------------------------------------------------
// Pure position helpers
// ---------------------------------------------------------------------------

/**
 * Dealer-button offset expressed in the dealer seat's anchor-local frame.
 *
 * Seat-local `+X` maps to the tangent-CCW world direction (toward the seat
 * with the next-higher seatIndex). When the SB sits at `dealer + 1 mod N`,
 * the button is offset in `+X` so it lies between dealer and SB; when the
 * SB sits at `dealer - 1 mod N`, we flip to `-X`. Non-adjacent SB seats
 * (which only happen in degenerate / transitional states) default to `+X`
 * so the button still has the conventional visual offset.
 *
 * When `sbSeat` is `null` the button sits centered on the dealer seat
 * anchor with zero X offset.
 */
export function dealerButtonLocalOffset(
  dealerSeat: number,
  sbSeat: number | null,
  seatCount: number,
): Vec3 {
  if (sbSeat === null) {
    return [0, MARKER_HEIGHT_Y, MARKER_LOCAL_Z];
  }
  const ccwDiff = (((sbSeat - dealerSeat) % seatCount) + seatCount) % seatCount;
  // ccwDiff === 1   → SB is the next seat CCW (+X tangent)
  // ccwDiff === N-1 → SB is the next seat CW  (-X tangent)
  // otherwise        → non-adjacent; default to +X (conventional direction).
  const sign = ccwDiff === seatCount - 1 ? -1 : 1;
  return [sign * DEALER_BUTTON_LOCAL_X, MARKER_HEIGHT_Y, MARKER_LOCAL_Z];
}

/** World position of the dealer button, or `null` when no dealer seat. */
export function dealerButtonWorldPosition(
  state: TableState,
  seatCount: number,
): Vec3 | null {
  if (state.dealerSeat === null) return null;
  const offset = dealerButtonLocalOffset(state.dealerSeat, state.sbSeat, seatCount);
  return seatAnchorLocalToWorld(state.dealerSeat, seatCount, offset);
}

/** World position of the SB marker, or `null` when `sbSeat === null`. */
export function smallBlindWorldPosition(
  state: TableState,
  seatCount: number,
): Vec3 | null {
  if (state.sbSeat === null) return null;
  return seatAnchorLocalToWorld(state.sbSeat, seatCount, [
    0,
    MARKER_HEIGHT_Y,
    MARKER_LOCAL_Z,
  ]);
}

/** World position of the BB marker, or `null` when `bbSeat === null`. */
export function bigBlindWorldPosition(
  state: TableState,
  seatCount: number,
): Vec3 | null {
  if (state.bbSeat === null) return null;
  return seatAnchorLocalToWorld(state.bbSeat, seatCount, [
    0,
    MARKER_HEIGHT_Y,
    MARKER_LOCAL_Z,
  ]);
}

// ---------------------------------------------------------------------------
// <TableMarkers>
// ---------------------------------------------------------------------------

export interface TableMarkersProps {
  state: TableState;
  seatCount: number;
}

type MarkerKind = 'dealer' | 'sb' | 'bb';
const MARKER_KINDS: readonly MarkerKind[] = ['dealer', 'sb', 'bb'] as const;

function targetFor(
  kind: MarkerKind,
  state: TableState,
  seatCount: number,
): Vec3 | null {
  switch (kind) {
    case 'dealer':
      return dealerButtonWorldPosition(state, seatCount);
    case 'sb':
      return smallBlindWorldPosition(state, seatCount);
    case 'bb':
      return bigBlindWorldPosition(state, seatCount);
  }
}

function vecEq(a: Vec3, b: Vec3): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

/**
 * Scene-graph component rendering the three table markers with a
 * tween-on-rotation animation driver. Must be mounted under an R3F
 * `<Canvas>` (via `<PokerTable>`).
 */
/* eslint-disable react/no-unknown-property -- R3F JSX intrinsics */
export function TableMarkers({ state, seatCount }: TableMarkersProps) {
  const reducedMotion = useReducedMotion();
  const reducedMotionRef = useRef(reducedMotion);
  reducedMotionRef.current = reducedMotion;

  // Visible rendered position per marker — mirrored into React state so
  // each tween tick re-renders the `<group position={...}>` and the new
  // pose is observable both on canvas and in happy-dom tests.
  const initialPositions = useMemo(() => {
    return {
      dealer: targetFor('dealer', state, seatCount),
      sb: targetFor('sb', state, seatCount),
      bb: targetFor('bb', state, seatCount),
    };
    // Seed once; subsequent updates flow through the tween driver below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [positions, setPositions] = useState<Record<MarkerKind, Vec3 | null>>(
    initialPositions,
  );

  // Latest-rendered positions mirrored into a ref so the reconcile effect
  // can diff the previous `from` without re-subscribing whenever
  // `positions` updates (which would restart tweens mid-flight).
  const positionsRef = useRef(positions);
  positionsRef.current = positions;

  // In-flight tween handles, one per marker kind.
  const tweensRef = useRef<Partial<Record<MarkerKind, TweenHandle>>>({});

  // Reconcile desired targets → tweens whenever the relevant slice of
  // state changes. We key the effect on the three seat indices so
  // unrelated state churn (pot, community cards, ...) doesn't thrash.
  useEffect(() => {
    for (const kind of MARKER_KINDS) {
      const next = targetFor(kind, state, seatCount);
      const current = positionsRef.current[kind];

      // Marker disappearing — cancel any in-flight tween and hide.
      if (next === null) {
        tweensRef.current[kind]?.cancel();
        delete tweensRef.current[kind];
        if (current !== null) {
          setPositions((p) => ({ ...p, [kind]: null }));
        }
        continue;
      }

      // Marker appearing from hidden — snap to target, no tween.
      if (current === null) {
        tweensRef.current[kind]?.cancel();
        delete tweensRef.current[kind];
        setPositions((p) => ({ ...p, [kind]: next }));
        continue;
      }

      // No movement required — skip.
      if (vecEq(current, next)) continue;

      // Movement — cancel any prior tween and spawn a fresh one from the
      // current rendered position to the new target. Reduced-motion
      // resolves synchronously inside `createTween` (onUpdate + onComplete
      // fire before the constructor returns).
      tweensRef.current[kind]?.cancel();
      const from: Vec3 = [current[0], current[1], current[2]];
      const tween = createTween<Vec3>({
        from,
        to: next,
        durationMs: DEALER_BUTTON_ANIMATION_MS,
        lerp: lerpVec3,
        onUpdate: (v) => {
          setPositions((p) => ({ ...p, [kind]: [v[0], v[1], v[2]] }));
        },
        onComplete: () => {
          delete tweensRef.current[kind];
        },
        reducedMotion: reducedMotionRef.current,
      });
      if (!tween.done) {
        tweensRef.current[kind] = tween;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seat slots only
  }, [state.dealerSeat, state.sbSeat, state.bbSeat, seatCount]);

  // Tick active tweens every frame.
  useFrame((_, dt) => {
    const dtMs = dt * 1000;
    for (const kind of MARKER_KINDS) {
      tweensRef.current[kind]?.tick(dtMs);
    }
  });

  // Cancel everything on unmount.
  useEffect(() => {
    const tweens = tweensRef.current;
    return () => {
      for (const kind of MARKER_KINDS) {
        tweens[kind]?.cancel();
      }
    };
  }, []);

  return (
    <group name="table-markers">
      {positions.dealer ? (
        <group
          key="dealer-button"
          name="dealer-button"
          position={positions.dealer}
        >
          <mesh name="dealer-button-disc">
            <cylinderGeometry
              args={[MARKER_RADIUS, MARKER_RADIUS, MARKER_THICKNESS, 24]}
            />
            <meshStandardMaterial color="#f5f5f5" roughness={0.4} />
          </mesh>
        </group>
      ) : null}

      {positions.sb ? (
        <group
          key="small-blind-marker"
          name="small-blind-marker"
          position={positions.sb}
        >
          <mesh name="small-blind-disc">
            <cylinderGeometry
              args={[
                MARKER_RADIUS * 0.7,
                MARKER_RADIUS * 0.7,
                MARKER_THICKNESS,
                24,
              ]}
            />
            <meshStandardMaterial color="#3a7bd5" roughness={0.4} />
          </mesh>
        </group>
      ) : null}

      {positions.bb ? (
        <group
          key="big-blind-marker"
          name="big-blind-marker"
          position={positions.bb}
        >
          <mesh name="big-blind-disc">
            <cylinderGeometry
              args={[
                MARKER_RADIUS * 0.7,
                MARKER_RADIUS * 0.7,
                MARKER_THICKNESS,
                24,
              ]}
            />
            <meshStandardMaterial color="#d54848" roughness={0.4} />
          </mesh>
        </group>
      ) : null}
    </group>
  );
}
/* eslint-enable react/no-unknown-property */

export default TableMarkers;
