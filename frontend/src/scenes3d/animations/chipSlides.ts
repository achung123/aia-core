// Chip-slide event computation for bet/call/raise animations (T-011).
//
// Pure, framework-free core: diffs two `TableState` snapshots and emits
// one `ChipSlideDelta` per seat whose `committedThisStreet` *increased*
// within the same hand + street. Folded seats and resets (hand change,
// street advance) are filtered out so only genuine bet/call/raise events
// produce motion.
//
// Mirrors the `dealCards.ts` split used by T-010: this module returns
// deterministic, test-friendly events; `ChipSlideController` + the R3F
// driver turn them into on-screen motion.

import type { TableState } from '../types';
import type { Vec3 } from './tweens';

/** Slide duration per spec S-2.2 / task T-011 ("over ~400ms"). */
export const CHIP_SLIDE_DURATION_MS = 400;

/**
 * Deterministic event describing one chip-slug flight from a seat's commit
 * stack to the pot. Keys are assigned by `ChipSlideController` using a
 * per-seat sequence counter; this pure module returns the shape of the
 * motion only.
 */
export interface ChipSlideDelta {
  seatIndex: number;
  handId: number;
  streetIndex: number;
  /** Chip amount committed in this single action (bet/call/raise). */
  delta: number;
  from: Vec3;
  to: Vec3;
  durationMs: number;
}

/**
 * Layout adapter: maps a seat index → world-space commit-chip origin and
 * the pot's world-space target. Kept as a strategy so tests can use trivial
 * coordinates and production can wire through `seatCommitChipWorldPosition`
 * + `POT_CHIP_POSITION`.
 */
export interface ChipSlideLayout {
  /** World position at which the seat's committed-chip stack sits. */
  seatOrigin: (seatIndex: number) => Vec3;
  /** World position of the pot chip cluster (the slide target). */
  potTarget: () => Vec3;
}

/**
 * Stable tween key. Sequence counters are scoped per (hand, street, seat)
 * so concurrent bets from multiple seats never share a key (AC 2) and a
 * seat re-betting within the same street produces a distinct key (so a
 * second-raise tween doesn't cancel the first).
 */
export function chipSlideKey(
  handId: number,
  streetIndex: number,
  seatIndex: number,
  sequence: number,
): string {
  return `chip:${handId}:${streetIndex}:${seatIndex}:${sequence}`;
}

/**
 * Diff `prev → next` and emit one event per seat whose
 * `committedThisStreet` *increased* within the same hand + street.
 *
 * Filters:
 *   - `prev === null`        → no events (controller is priming).
 *   - hand change            → no events (street resets + fresh deal, handled
 *                              via tween cancellation in the controller; we
 *                              don't want a hand-10 final-river commit to
 *                              fire a slide as hand-11 starts at 0).
 *   - streetIndex change     → no events (street resets committedThisStreet
 *                              to 0 by convention; that's a downstream drop,
 *                              not an action — and any residual in-flight
 *                              slides from the previous street finish
 *                              naturally).
 *   - `next` seat folded     → no event (AC 3: fold doesn't trigger chip
 *                              motion, even in the unlikely case where the
 *                              folded action also coincides with a positive
 *                              delta).
 *   - delta ≤ 0              → no event.
 *   - missing prev seat      → no event (seat newly added, likely mid-hand
 *                              edge case; treat as non-motion rather than
 *                              inventing a phantom bet origin).
 */
export function computeChipSlideDeltas(
  prev: TableState | null,
  next: TableState,
  layout: ChipSlideLayout,
): ChipSlideDelta[] {
  if (prev === null) return [];
  if (prev.handId !== next.handId) return [];
  if (prev.streetIndex !== next.streetIndex) return [];

  const potTarget = layout.potTarget();
  const out: ChipSlideDelta[] = [];

  const prevBySeat = new Map<number, number>();
  for (const s of prev.seats) {
    prevBySeat.set(s.seatIndex, s.committedThisStreet);
  }

  for (const seat of next.seats) {
    if (seat.folded) continue;
    const prevCommit = prevBySeat.get(seat.seatIndex);
    if (prevCommit === undefined) continue;
    const delta = seat.committedThisStreet - prevCommit;
    if (delta <= 0) continue;
    out.push({
      seatIndex: seat.seatIndex,
      handId: next.handId,
      streetIndex: next.streetIndex,
      delta,
      from: layout.seatOrigin(seat.seatIndex),
      to: potTarget,
      durationMs: CHIP_SLIDE_DURATION_MS,
    });
  }

  return out;
}
