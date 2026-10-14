// Pot-sweep event computation for T-012 (hand resolution).
//
// Pure, framework-free core: diffs two `TableState` snapshots and emits
// one `PotSweepDelta` per `won` seat the first time winners appear within
// a hand. For multi-winner split pots the pot is divided proportionally
// by positive `profitLoss` (falling back to equal shares if no positive
// profitLoss is available on any winner). A last-share fixup ensures the
// sum of shares equals the pot exactly, regardless of floating-point
// rounding.
//
// Mirrors the `chipSlides.ts` split used by T-011: this module returns
// deterministic, test-friendly events; `PotSweepController` + the R3F
// driver turn them into on-screen motion.

import type { TableState } from '../types';
import type { Vec3 } from './tweens';

/** Sweep duration per spec T-012 ("≤ 800ms"). 600ms feels brisk but readable. */
export const POT_SWEEP_DURATION_MS = 600;

/**
 * Deterministic event describing one pot-sweep flight from the pot
 * cluster to a winning seat. Keys are assigned by `PotSweepController`
 * per (hand, seat); this pure module returns the shape of the motion
 * only.
 */
export interface PotSweepDelta {
  seatIndex: number;
  handId: number;
  /** Dollar share of the pot this winner receives. */
  amount: number;
  from: Vec3;
  to: Vec3;
  durationMs: number;
}

/**
 * Layout adapter: maps a seat index → world-space target (where chips
 * land in a winner's stack area) and provides the pot's world-space
 * origin. Kept as a strategy so tests can use trivial coordinates and
 * production can wire through `seatCommitChipWorldPosition` +
 * `POT_CHIP_WORLD_POSITION`.
 */
export interface PotSweepLayout {
  /** World position of the winning seat's chip-stack landing point. */
  seatTarget: (seatIndex: number) => Vec3;
  /** World position of the pot chip cluster (the sweep origin). */
  potOrigin: () => Vec3;
}

/**
 * Stable tween key. One sweep per (hand, winningSeat) — there's no
 * sequence counter because a pot is swept exactly once per hand.
 */
export function potSweepKey(handId: number, seatIndex: number): string {
  return `pot-sweep:${handId}:${seatIndex}`;
}

/**
 * Diff `prev → next` and emit one event per winning seat the first time
 * winners appear within a hand.
 *
 * Filters:
 *   - `prev === null`                → no events (controller is priming).
 *   - hand change                    → no events (sweeps don't cross hands;
 *                                      cross-hand cancellation is handled
 *                                      by the controller).
 *   - `prev` already had winners     → no events (sweep already fired).
 *   - no `won` seats in `next`       → no events.
 *   - `next.pot <= 0`                → no events (nothing to sweep).
 *
 * Splitting:
 *   - Sum positive `profitLoss` values across winners.
 *   - If sum > 0: each winner's share = `(pl_i / sum) * pot`.
 *   - Otherwise: equal shares (`pot / winners.length`).
 *   - A last-share fixup assigns the residual to the final winner so the
 *     sum of shares equals `pot` exactly (no drift from float rounding).
 */
export function computePotSweepDeltas(
  prev: TableState | null,
  next: TableState,
  layout: PotSweepLayout,
): PotSweepDelta[] {
  if (prev === null) return [];
  if (prev.handId !== next.handId) return [];
  if (next.pot <= 0) return [];

  const prevWinners = prev.seats.some((s) => s.result === 'won');
  if (prevWinners) return [];

  const winners = next.seats.filter((s) => s.result === 'won');
  if (winners.length === 0) return [];

  const pot = next.pot;
  const positivePls = winners.map((w) => Math.max(0, w.profitLoss ?? 0));
  const plSum = positivePls.reduce((a, b) => a + b, 0);

  // Proportional-to-PL split only when *every* winner has a positive
  // clamped PL (`plSum > 0` is necessary but not sufficient — a zero or
  // negative PL alongside a positive co-winner would otherwise yield a
  // zero share for a `result === 'won'` seat; see H-1 / Cycle 35 M-4).
  // Otherwise fall back to equal shares so every declared winner always
  // receives a visible chip amount.
  const allPositive = positivePls.every((pl) => pl > 0);
  const shares: number[] = [];
  if (plSum > 0 && allPositive) {
    for (let i = 0; i < winners.length - 1; i++) {
      shares.push((positivePls[i] / plSum) * pot);
    }
  } else {
    const equal = pot / winners.length;
    for (let i = 0; i < winners.length - 1; i++) shares.push(equal);
  }
  // Last-share fixup: residual so sum === pot exactly.
  const assigned = shares.reduce((a, b) => a + b, 0);
  shares.push(pot - assigned);

  const origin = layout.potOrigin();
  return winners.map((w, i) => ({
    seatIndex: w.seatIndex,
    handId: next.handId,
    amount: shares[i],
    from: origin,
    to: layout.seatTarget(w.seatIndex),
    durationMs: POT_SWEEP_DURATION_MS,
  }));
}
