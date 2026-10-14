// T-028 — Auto-degrade FPS monitor.
//
// Canonical source: `specs/table-3d-revamp-010/plan.md` § "Quality Tiers &
// Performance Budget" (the pseudocode block under "Auto-degrade"). The hook
// samples R3F's `useFrame` loop frame-by-frame, maintains a 2-second
// rolling window (120 samples), and drops the current tier one level when
// the window average stays below 30fps for 3 continuous seconds. Emits a
// toast on tier change via the tableStore tier-toast slice.
//
// Extensions over the plan.md pseudocode (all T-028 AC-driven):
//   - `manualOverride=true` (T-027) halts all auto-degrade for the session.
//   - Never auto-upgrades — downgrade-only avoids oscillation.
//   - Never degrades below `low` (floor); no-op silently at the floor.
//   - After a drop, requires ONE recovery frame (avg ≥ threshold) before the
//     counter resumes accumulating. Without this guard, residual sub-30fps
//     samples still in the rolling window immediately after a drop would
//     push the counter over 3s again a few frames later and fire a second
//     drop off the same bad stretch — violating T-028 AC-6 ("exactly ONE
//     tier drop" for the canonical 120 @ 20fps → 120 @ 60fps sequence).

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';

import { useTableStore } from './tableStore';
import { nextLowerTier } from './qualitySettings';

/** Rolling-window size in samples (≈ 2s @ 60fps). */
export const FPS_WINDOW_SAMPLES = 120;

/** Instantaneous-fps floor — below this the counter accumulates. */
export const FPS_DEGRADE_THRESHOLD = 30;

/** Milliseconds of sustained sub-threshold fps required before a tier drop. */
export const FPS_SUSTAINED_MS = 3000;

/** Canonical toast copy for auto-degrade (T-028 AC-3). */
export const TIER_TOAST_MESSAGE = 'Quality adjusted for smoother playback';

/**
 * R3F component wrapping `useFPSMonitor`. Mount inside the `<Canvas>` tree
 * so `useFrame` is available. Renders nothing.
 */
export function FPSMonitor(): null {
  useFPSMonitor();
  return null;
}

/**
 * The underlying hook. Prefer the `<FPSMonitor />` component for mounting;
 * this named export exists for direct use by consumers that already live
 * inside the Canvas tree.
 */
export function useFPSMonitor(): void {
  const samples = useRef<number[]>([]);
  const sustainedMs = useRef(0);
  const awaitingRecovery = useRef(false);

  useFrame((_, dtSec) => {
    // Guard against pathological dt values from paused tabs / hot reload.
    if (!(dtSec > 0) || !isFinite(dtSec)) return;

    const fps = 1 / dtSec;
    const w = samples.current;
    w.push(fps);
    if (w.length > FPS_WINDOW_SAMPLES) w.shift();

    const avg = w.reduce((a, b) => a + b, 0) / w.length;
    const dtMs = dtSec * 1000;

    // One recovery frame (avg ≥ threshold) must land between drops. This
    // swallows residual sub-30fps samples still in the rolling window right
    // after a drop; without it the counter would pile back over 3s within
    // a few frames and fire a second drop off the same bad stretch.
    if (awaitingRecovery.current) {
      if (avg >= FPS_DEGRADE_THRESHOLD) awaitingRecovery.current = false;
      return;
    }

    const store = useTableStore.getState();

    if (avg < FPS_DEGRADE_THRESHOLD && !store.manualOverride) {
      sustainedMs.current += dtMs;
      if (sustainedMs.current > FPS_SUSTAINED_MS) {
        const next = nextLowerTier(store.qualityTier);
        if (next !== store.qualityTier) {
          // Real tier change — apply + surface the toast.
          store.setTier(next);
          store.setTierToast(TIER_TOAST_MESSAGE);
        }
        // Whether we changed tier or no-op'd at the floor, reset the
        // counter and block further drops until one recovery frame lands.
        sustainedMs.current = 0;
        awaitingRecovery.current = true;
      }
    } else {
      sustainedMs.current = 0;
    }
  });
}
