// Card deal + flip animation sequencer for the scenes3d engine.
//
// T-010 ships the pure, framework-free event computation:
//   - `computeDealSequence(prev, next, layout)` converts a `TableState`
//     transition into the list of card-deal tweens that should fire.
//   - Hole-cards are dealt one-at-a-time around the table in dealer rotation
//     order; community cards are staggered to fit within 500 ms per street.
//   - When the caller has `reducedMotion === true`, events are still
//     returned but drivers should pass `reducedMotion: true` to
//     `createTween` so each card snaps to its final position.
//
// Full `<PokerTable>` integration (per-card refs driven via `useFrame`)
// is deferred to a follow-up: T-010 provides the deterministic core that
// higher-level components will consume. See plan.md § Animation Engine.

import type { TableState, TableStatePhase } from '../types';
import type { Vec3 } from './tweens';

/** Per-card flight duration (ms). */
export const DEAL_CARD_DURATION_MS = 120;

/** Budget for a full community-deal street (flop/turn/river). */
export const DEAL_STREET_TOTAL_MS = 500;

/** Per-card stagger for hole dealing (one card per seat per tick). */
export const DEAL_HOLE_STAGGER_MS = 80;

/** World-space "deck" origin that cards fly from. */
export const DECK_POSITION: Vec3 = [0, 0.35, 0];

export type DealEventKind = 'community' | 'hole';

export interface DealEvent {
  kind: DealEventKind;
  /**
   * For `kind === 'community'`: community slot index 0..4
   * ([flop1, flop2, flop3, turn, river]).
   * For `kind === 'hole'`: hole-card slot (0 = first dealt, 1 = second).
   */
  slotIndex: number;
  /** Seat index — required and defined for `kind === 'hole'`. */
  seatIndex?: number;
  from: Vec3;
  to: Vec3;
  startMs: number;
  durationMs: number;
  /**
   * Stable tween identity. Drivers should reuse or cancel an in-flight tween
   * whose `key` matches a new event's key, preventing stale animations
   * across rapid street / hand churn (AC 4).
   */
  key: string;
}

export interface DealLayout {
  /** Resolve the world position of community card slot `slot` (0..4). */
  communityPosition: (slot: number) => Vec3;
  /** Resolve the world position of hole card `holeSlot` for the given seat. */
  holePosition: (
    seatIndex: number,
    seatCount: number,
    holeSlot: 0 | 1,
  ) => Vec3;
  /** Override the default deck origin (rare — tests use this). */
  deckPosition?: Vec3;
}

/** Community slot indices newly revealed on entry to each phase. */
const STREET_SLOTS: Record<TableStatePhase, number[]> = {
  awaiting_cards: [],
  preflop: [],
  flop: [0, 1, 2],
  turn: [3],
  river: [4],
  showdown: [],
};

const PHASE_STREET_INDEX: Record<
  'flop' | 'turn' | 'river',
  TableState['streetIndex']
> = {
  flop: 1,
  turn: 2,
  river: 3,
};

/**
 * Distribute `count` card-deal starts across `totalMs` such that the final
 * card's tween ends exactly at `totalMs`. Returns the start time for each
 * card in order.
 */
export function staggerStarts(
  count: number,
  totalMs: number,
  durationMs: number,
): number[] {
  if (count <= 0) return [];
  if (count === 1) return [0];
  const stride = Math.max(0, (totalMs - durationMs) / (count - 1));
  return Array.from({ length: count }, (_, i) => i * stride);
}

/**
 * Seat indices in dealing order: start at `(dealerSeat + 1) % seatCount`
 * (SB is first to receive a card) and walk forward around the table,
 * skipping inactive / folded seats.
 */
export function holeDealOrder(
  dealerSeat: number | null,
  activeSeatIndices: Iterable<number>,
  seatCount: number,
): number[] {
  if (seatCount <= 0) return [];
  const active = new Set(activeSeatIndices);
  if (active.size === 0) return [];
  const start = dealerSeat == null ? 0 : (dealerSeat + 1) % seatCount;
  const ordered: number[] = [];
  for (let i = 0; i < seatCount; i++) {
    const idx = (start + i) % seatCount;
    if (active.has(idx)) ordered.push(idx);
  }
  return ordered;
}

/**
 * Compute the deal events triggered by a `prev → next` TableState transition.
 *
 *   - `prev == null` or `prev.handId !== next.handId` on entry to preflop
 *     triggers a full hole-card deal for every active, non-folded seat in
 *     dealer rotation order (two passes: first card, then second).
 *   - A `streetIndex` increase that crosses a community-reveal street
 *     (flop/turn/river) emits events for the newly revealed community
 *     slots whose entry in `next.community` is populated. Skipped streets
 *     (e.g., 1 → 3) have their slots accumulated.
 *   - Street regressions, phase-only churn, or unchanged transitions
 *     return `[]` — the primary guarantee behind AC 4 (no stale deals).
 */
export function computeDealSequence(
  prev: TableState | null,
  next: TableState,
  layout: DealLayout,
): DealEvent[] {
  const events: DealEvent[] = [];
  const from = layout.deckPosition ?? DECK_POSITION;
  const seatCount = next.seats.length;

  const isNewHand = prev === null || prev.handId !== next.handId;

  // --- Hole deal ------------------------------------------------------
  const enteringPreflop =
    next.phase === 'preflop' &&
    (prev === null ||
      prev.handId !== next.handId ||
      prev.phase === 'awaiting_cards');

  if (enteringPreflop) {
    const activeSeats = next.seats
      .filter((s) => s.isActive && !s.folded)
      .map((s) => s.seatIndex);
    const order = holeDealOrder(next.dealerSeat, activeSeats, seatCount);

    let tick = 0;
    for (const holeSlot of [0, 1] as const) {
      for (const seatIndex of order) {
        events.push({
          kind: 'hole',
          slotIndex: holeSlot,
          seatIndex,
          from,
          to: layout.holePosition(seatIndex, seatCount, holeSlot),
          startMs: tick * DEAL_HOLE_STAGGER_MS,
          durationMs: DEAL_CARD_DURATION_MS,
          key: `hole:${next.handId}:${seatIndex}:${holeSlot}`,
        });
        tick += 1;
      }
    }
  }

  // --- Community deals -----------------------------------------------
  if (!isNewHand && prev !== null && next.streetIndex > prev.streetIndex) {
    const slots: number[] = [];
    for (const phase of ['flop', 'turn', 'river'] as const) {
      const phaseStreet = PHASE_STREET_INDEX[phase];
      if (phaseStreet > prev.streetIndex && phaseStreet <= next.streetIndex) {
        slots.push(...STREET_SLOTS[phase]);
      }
    }
    const revealed = slots.filter(
      (slot) =>
        next.community[slot] != null && (prev.community[slot] ?? null) == null,
    );
    const starts = staggerStarts(
      revealed.length,
      DEAL_STREET_TOTAL_MS,
      DEAL_CARD_DURATION_MS,
    );
    revealed.forEach((slot, i) => {
      events.push({
        kind: 'community',
        slotIndex: slot,
        from,
        to: layout.communityPosition(slot),
        startMs: starts[i],
        durationMs: DEAL_CARD_DURATION_MS,
        key: `community:${next.handId}:${slot}`,
      });
    });
  }

  return events;
}
