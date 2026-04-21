import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';

import {
  DealAnimationController,
  type DealTarget,
} from './DealAnimationController';
import type { DealLayout } from './dealCards';
import { useReducedMotion } from '../state/useReducedMotion';
import {
  seatAnchorLocalToWorld,
} from '../components/tableLayout';
import type { TableState } from '../types';
import type { Vec3 } from './tweens';

// ---------------------------------------------------------------------------
// Target registry
//
// The parent scene (`<PokerTable>`) attaches refs to the `<group>` wrappers
// around each animated card, keyed by the stable `DealEvent.key` — community
// cards use `community:<handId>:<slot>` and hole cards use
// `hole:<handId>:<seat>:<slot>`. The driver consults this registry when
// building tweens and writes world-space positions back through
// `worldToLocal` to stay correct regardless of the parent group's transform.
// ---------------------------------------------------------------------------

export type DealTargetRegistry = Map<string, THREE.Object3D>;

/**
 * React hook that returns a stable, mutable registry mapping
 * `DealEvent.key` → `THREE.Object3D`. Parents wire refs in via
 * `ref={registerDealTarget(registry, key)}`.
 */
export function useDealTargetRegistry(): React.MutableRefObject<DealTargetRegistry> {
  const ref = useRef<DealTargetRegistry>(new Map());
  return ref;
}

/**
 * Build a ref callback that registers the mounted `Object3D` under `key`
 * and cleans it up on unmount.
 */
export function registerDealTarget(
  registryRef: React.MutableRefObject<DealTargetRegistry>,
  key: string,
): (obj: THREE.Object3D | null) => void {
  return (obj) => {
    if (obj) {
      registryRef.current.set(key, obj);
    } else {
      registryRef.current.delete(key);
    }
  };
}

// ---------------------------------------------------------------------------
// Layout helpers
//
// Both the <PokerTable> scene and the driver need to agree on the world
// positions of community / hole card *targets*. Centralising the math here
// keeps render-time positioning and animation targets in lockstep.
// ---------------------------------------------------------------------------

/** Spacing between community card centers along X. Mirrors PokerTable. */
export const COMMUNITY_CARD_SPACING = 0.52;
export const COMMUNITY_START_X = -2 * COMMUNITY_CARD_SPACING;
export const COMMUNITY_CARD_Y = 0.02;

/** Seat-local hole-card offsets. Mirrors PokerTable. */
export const HOLE_CARD_SPREAD_X = 0.25;
export const HOLE_CARD_Y = 0.02;
export const HOLE_CARD_LOCAL_Z = 0.45;

export function communityTargetPosition(slot: number): Vec3 {
  return [COMMUNITY_START_X + slot * COMMUNITY_CARD_SPACING, COMMUNITY_CARD_Y, 0];
}

/**
 * World position of the `holeSlot`-th (0 = left, 1 = right) hole card for
 * the seat. Mirrors the `<PokerTable>` scene graph exactly:
 * `<Seat>` translates to `computeSeatPosition`, rotates by
 * `computeSeatRotationY`, and lifts its `seat-anchor` child by
 * `SEAT_PAD_THICKNESS`; the hole-card wrap then sits at the local offset
 * below. `seatAnchorLocalToWorld` encodes all three transforms so the
 * render-time world pose and this tween target stay in lockstep (Cycle 13
 * H-1 regression).
 */
export function holeTargetPosition(
  seatIndex: number,
  seatCount: number,
  holeSlot: 0 | 1,
): Vec3 {
  const lx = holeSlot === 0 ? -HOLE_CARD_SPREAD_X : HOLE_CARD_SPREAD_X;
  return seatAnchorLocalToWorld(seatIndex, seatCount, [
    lx,
    HOLE_CARD_Y,
    HOLE_CARD_LOCAL_Z,
  ]);
}

/** Default layout paired with the <PokerTable> render positions. */
export function buildPokerTableDealLayout(seatCount: number): DealLayout {
  return {
    communityPosition: (slot) => communityTargetPosition(slot),
    holePosition: (seatIndex, _count, holeSlot) =>
      holeTargetPosition(seatIndex, seatCount, holeSlot),
  };
}

// ---------------------------------------------------------------------------
// <DealAnimationDriver>
// ---------------------------------------------------------------------------

export interface DealAnimationDriverProps {
  state: TableState;
  layout: DealLayout;
  registry: React.MutableRefObject<DealTargetRegistry>;
}

/**
 * R3F driver that ties a `DealAnimationController` to a scene-graph
 * registry. Ticks active tweens from `useFrame` and mutates
 * `object.position` (world → parent-local conversion handled via
 * `parent.worldToLocal`) so per-frame motion never triggers a React
 * re-render.
 *
 * `state` identity changes drive `controller.sync`; the `useReducedMotion`
 * snapshot is read on every sync call (new tweens honour the current
 * preference).
 */
export function DealAnimationDriver({
  state,
  layout,
  registry,
}: DealAnimationDriverProps) {
  const reducedMotion = useReducedMotion();
  const reducedMotionRef = useRef(reducedMotion);
  reducedMotionRef.current = reducedMotion;

  const controller = useMemo(() => {
    return new DealAnimationController({
      getTarget: (key) => buildTarget(registry.current.get(key)),
      reducedMotion: () => reducedMotionRef.current,
    });
    // Registry ref object is stable; controller identity is fine for the
    // lifetime of this driver.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Memoize by [state, layout] identity so unchanged inputs don't re-sync.
  const syncInputs = useMemo(() => ({ state, layout }), [state, layout]);
  useEffect(() => {
    controller.sync(syncInputs.state, syncInputs.layout);
  }, [controller, syncInputs]);

  useEffect(() => {
    return () => {
      controller.reset();
    };
  }, [controller]);

  useFrame((_, dt) => {
    controller.tick(dt * 1000);
  });

  return null;
}

// ---------------------------------------------------------------------------
// Implementation details
// ---------------------------------------------------------------------------

/**
 * Wrap a `THREE.Object3D` as a `DealTarget`. World-space tween outputs are
 * converted to the object's parent-local frame before being written to
 * `object.position`, so it stays correct whether the group sits at the
 * scene root or nested inside a rotated `<Seat>`.
 *
 * Returns `null` when the ref target isn't a real `Object3D` (e.g. inside a
 * happy-dom test harness that renders R3F intrinsics as DOM elements) so
 * the driver silently skips tween writes for that key.
 *
 * Exported so integration tests can build the exact production adapter
 * around a real `THREE.Object3D` mirroring the `<PokerTable>` scene graph.
 */
export function buildTarget(obj: THREE.Object3D | undefined): DealTarget | null {
  if (!obj) return null;
  if (!obj.position || typeof obj.position.set !== 'function') return null;
  return {
    setPosition(x, y, z) {
      const parent = obj.parent;
      if (parent && typeof parent.worldToLocal === 'function') {
        // Use the object's own Vector3 to avoid allocating per-frame.
        obj.position.set(x, y, z);
        parent.worldToLocal(obj.position);
      } else {
        obj.position.set(x, y, z);
      }
    },
    setRotation(x, y, z) {
      obj.rotation.set(x, y, z);
    },
  };
}
