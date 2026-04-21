import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';

import { PotSweepController } from './PotSweepController';
import type { PotSweepDelta, PotSweepLayout } from './potSweeps';
import { useReducedMotion } from '../state/useReducedMotion';
import {
  POT_CHIP_WORLD_POSITION,
  seatCommitChipWorldPosition,
} from '../components/tableLayout';
import type { TableState } from '../types';
import type { Vec3 } from './tweens';

// ---------------------------------------------------------------------------
// Layout helper
// ---------------------------------------------------------------------------

/**
 * Build the production pot-sweep layout:
 *   - pot origin: `POT_CHIP_WORLD_POSITION` (shared with chip-slide
 *     target so sweep leaves exactly where chips landed).
 *   - seat target: `seatCommitChipWorldPosition` — the seat's commit-chip
 *     area, which is empty at hand resolution (committedThisStreet has
 *     been flushed to pot by showdown) and sits in front of the seat.
 */
export function buildPokerTablePotSweepLayout(seatCount: number): PotSweepLayout {
  return {
    potOrigin: () => POT_CHIP_WORLD_POSITION as Vec3,
    seatTarget: (seatIndex) => seatCommitChipWorldPosition(seatIndex, seatCount),
  };
}

// ---------------------------------------------------------------------------
// <PotSweepDriver>
// ---------------------------------------------------------------------------

export interface PotSweepDriverProps {
  state: TableState;
  layout: PotSweepLayout;
  /**
   * Fires once per sweep start. Parent scenes use this to register a
   * flying chip-slug at the in-flight position.
   */
  onSweepStart?: (key: string, delta: PotSweepDelta) => void;
  /** Fires once per sweep completion. */
  onSweepComplete?: (key: string, delta: PotSweepDelta) => void;
  /**
   * Exposes the live controller instance so parent scenes can read
   * `getInFlightForWinner` / `getInFlightPotOutflow` / `getInFlightPosition`
   * without re-implementing the diff. Store in a `useRef` (StrictMode
   * safety — see ChipSlideDriver Cycle 19 L-2 notes).
   */
  onController?: (controller: PotSweepController) => void;
}

/**
 * R3F driver that ties a `PotSweepController` to the R3F clock. Ticks
 * active tweens from `useFrame`; `state` identity changes drive
 * `controller.sync`; `useReducedMotion` snapshot is read per sync so new
 * sweeps honour the current preference.
 */
export function PotSweepDriver({
  state,
  layout,
  onSweepStart,
  onSweepComplete,
  onController,
}: PotSweepDriverProps) {
  const reducedMotion = useReducedMotion();
  const reducedMotionRef = useRef(reducedMotion);
  const startRef = useRef(onSweepStart);
  const completeRef = useRef(onSweepComplete);
  useEffect(() => {
    reducedMotionRef.current = reducedMotion;
    startRef.current = onSweepStart;
    completeRef.current = onSweepComplete;
  });

  const controllerRef = useRef<PotSweepController | null>(null);
  const onControllerRef = useRef(onController);
  useEffect(() => {
    onControllerRef.current = onController;
  });

  useEffect(() => {
    const c = new PotSweepController({
      reducedMotion: () => reducedMotionRef.current,
      onSweepStart: (key, delta) => startRef.current?.(key, delta),
      onSweepComplete: (key, delta) => completeRef.current?.(key, delta),
    });
    controllerRef.current = c;
    onControllerRef.current?.(c);
    return () => {
      c.reset();
      controllerRef.current = null;
    };
  }, []);

  // Sync the controller whenever `state` or `layout` identity changes.
  useEffect(() => {
    controllerRef.current?.sync(state, layout);
  }, [state, layout]);

  useFrame((_, dt) => {
    controllerRef.current?.tick(dt * 1000);
  });

  return null;
}
