import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';

import { ChipSlideController } from './ChipSlideController';
import type { ChipSlideDelta, ChipSlideLayout } from './chipSlides';
import { useReducedMotion } from '../state/useReducedMotion';
import {
  POT_CHIP_WORLD_POSITION,
  seatCommitChipWorldPosition,
} from '../components/tableLayout';
import type { TableState } from '../types';
import type { Vec3 } from './tweens';

// ---------------------------------------------------------------------------
// Layout helpers
// ---------------------------------------------------------------------------

/**
 * Re-export of `POT_CHIP_WORLD_POSITION` from `tableLayout.ts` kept for
 * backwards-compatibility with T-011 callers. New consumers should import
 * directly from `components/tableLayout`. (Cycle 19 L-1 hoist.)
 */
export { POT_CHIP_WORLD_POSITION } from '../components/tableLayout';

/**
 * Build the production chip-slide layout:
 *   - seat origin: `seatCommitChipWorldPosition` (shared with
 *     `<PokerTable>` so the slide starts exactly where the committed chips
 *     are rendered).
 *   - pot target:  `POT_CHIP_WORLD_POSITION`.
 */
export function buildPokerTableChipSlideLayout(seatCount: number): ChipSlideLayout {
  return {
    seatOrigin: (seatIndex) => seatCommitChipWorldPosition(seatIndex, seatCount),
    potTarget: () => POT_CHIP_WORLD_POSITION as Vec3,
  };
}

// ---------------------------------------------------------------------------
// <ChipSlideDriver>
// ---------------------------------------------------------------------------

export interface ChipSlideDriverProps {
  state: TableState;
  layout: ChipSlideLayout;
  /**
   * Fires once per slide start. Parent scenes use this to drive the
   * flying chip-slug render layer. The `delta` payload exposes
   * `seatIndex`, `amount` (as `delta.delta`), `from`, `to` — enough for
   * the parent to register a per-slide `<ChipStack>` without querying
   * the controller directly.
   */
  onSlideStart?: (key: string, delta: ChipSlideDelta) => void;
  /** Fires once per slide completion (pot-growth bookkeeping). */
  onSlideComplete?: (key: string, delta: ChipSlideDelta) => void;
  /**
   * Exposes the live controller instance so parent scenes can read
   * `getInFlightAmountForSeat` / `getInFlightPotAmount` /
   * `getInFlightPosition` without re-implementing the diff. Called
   * exactly once on mount; the instance identity is stable for the
   * lifetime of the driver.
   *
   * **StrictMode note (Cycle 19 L-2):** under React 18 development
   * StrictMode, the driver mounts → cleans up → mounts, so `onController`
   * fires twice with *different* controller instances — the first is the
   * torn-down copy. Parent handlers that stash the controller in
   * `useState` will end up with a stale reference to the unmounted
   * instance. Store in a `useRef` instead so the latest `onController`
   * call simply overwrites the prior ref value.
   */
  onController?: (controller: ChipSlideController) => void;
}

/**
 * R3F driver that ties a `ChipSlideController` to the R3F clock. Ticks
 * active tweens from `useFrame`; `state` identity changes drive
 * `controller.sync`; `useReducedMotion` snapshot is read per sync so new
 * slides honour the current preference.
 */
export function ChipSlideDriver({
  state,
  layout,
  onSlideStart,
  onSlideComplete,
  onController,
}: ChipSlideDriverProps) {
  const reducedMotion = useReducedMotion();
  const reducedMotionRef = useRef(reducedMotion);
  const startRef = useRef(onSlideStart);
  const completeRef = useRef(onSlideComplete);
  useEffect(() => {
    reducedMotionRef.current = reducedMotion;
    startRef.current = onSlideStart;
    completeRef.current = onSlideComplete;
  });

  // The controller is constructed inside a mount-only `useEffect` so the
  // `react-hooks/refs` rule never sees ref access in the render path. The
  // instance is published via `controllerRef` (never read from render —
  // only `useFrame` and subsequent `useEffect`s touch it) and via the
  // parent's `onController` callback.
  const controllerRef = useRef<ChipSlideController | null>(null);
  const onControllerRef = useRef(onController);
  useEffect(() => {
    onControllerRef.current = onController;
  });

  useEffect(() => {
    const c = new ChipSlideController({
      reducedMotion: () => reducedMotionRef.current,
      onSlideStart: (key, delta) => startRef.current?.(key, delta),
      onSlideComplete: (key, delta) => completeRef.current?.(key, delta),
    });
    controllerRef.current = c;
    onControllerRef.current?.(c);
    return () => {
      c.reset();
      controllerRef.current = null;
    };
  }, []);

  // Sync the controller whenever `state` or `layout` identity changes.
  // Runs after the mount-only effect above (React effect ordering), so
  // `controllerRef.current` is populated by the first call — except on the
  // very first render's layout pass, which is why we null-guard.
  useEffect(() => {
    controllerRef.current?.sync(state, layout);
  }, [state, layout]);

  useFrame((_, dt) => {
    controllerRef.current?.tick(dt * 1000);
  });

  return null;
}

