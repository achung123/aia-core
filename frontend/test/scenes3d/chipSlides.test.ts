import { describe, it, expect } from 'vitest';

import {
  CHIP_SLIDE_DURATION_MS,
  chipSlideKey,
  computeChipSlideDeltas,
  type ChipSlideLayout,
} from '../../src/scenes3d/animations/chipSlides';
import type {
  SeatState,
  TableState,
} from '../../src/scenes3d/types';
import type { Vec3 } from '../../src/scenes3d/animations/tweens';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeSeat(seatIndex: number, overrides: Partial<SeatState> = {}): SeatState {
  return {
    seatIndex,
    playerName: `P${seatIndex}`,
    isActive: true,
    stack: 1000,
    committedThisStreet: 0,
    committedTotal: 0,
    lastAction: null,
    holeCards: null,
    folded: false,
    result: null,
    profitLoss: null,
    winningHand: null,
    ...overrides,
  };
}

function makeState(overrides: Partial<TableState> = {}): TableState {
  return {
    gameId: 1,
    handId: 42,
    handNumber: 1,
    phase: 'preflop',
    streetIndex: 0,
    community: [null, null, null, null, null],
    seats: [0, 1, 2, 3].map((i) => makeSeat(i)),
    pot: 0,
    sidePots: [],
    dealerSeat: 0,
    sbSeat: 1,
    bbSeat: 2,
    currentSeat: null,
    ...overrides,
  };
}

/**
 * Trivial deterministic layout: seat origin = (seatIndex, 0, 0); pot at
 * (0, 0, -1). Keeps asserted coordinates hand-checkable.
 */
const layout: ChipSlideLayout = {
  seatOrigin: (seatIndex) => [seatIndex, 0, 0] as Vec3,
  potTarget: () => [0, 0, -1] as Vec3,
};

// ---------------------------------------------------------------------------
// computeChipSlideDeltas
// ---------------------------------------------------------------------------

describe('computeChipSlideDeltas — prev null primes without events', () => {
  it('returns [] when prev is null', () => {
    const next = makeState();
    expect(computeChipSlideDeltas(null, next, layout)).toEqual([]);
  });
});

describe('computeChipSlideDeltas — AC 1 (increase triggers slide)', () => {
  it('emits one event per seat whose committedThisStreet increased', () => {
    const prev = makeState();
    const next = makeState({
      seats: [
        makeSeat(0, { committedThisStreet: 50 }),
        makeSeat(1),
        makeSeat(2),
        makeSeat(3),
      ],
    });
    const events = computeChipSlideDeltas(prev, next, layout);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      seatIndex: 0,
      handId: 42,
      streetIndex: 0,
      delta: 50,
      durationMs: CHIP_SLIDE_DURATION_MS,
    });
    expect(events[0].from).toEqual([0, 0, 0]);
    expect(events[0].to).toEqual([0, 0, -1]);
  });

  it('delta reflects only the incremental increase (call over call)', () => {
    const prev = makeState({
      seats: [
        makeSeat(0, { committedThisStreet: 20 }),
        makeSeat(1),
        makeSeat(2),
        makeSeat(3),
      ],
    });
    const next = makeState({
      seats: [
        makeSeat(0, { committedThisStreet: 70 }),
        makeSeat(1),
        makeSeat(2),
        makeSeat(3),
      ],
    });
    const events = computeChipSlideDeltas(prev, next, layout);
    expect(events).toHaveLength(1);
    expect(events[0].delta).toBe(50);
  });
});

describe('computeChipSlideDeltas — AC 2 (concurrent seats yield distinct events)', () => {
  it('emits one event per seat with distinct origins', () => {
    const prev = makeState();
    const next = makeState({
      seats: [
        makeSeat(0, { committedThisStreet: 25 }),
        makeSeat(1, { committedThisStreet: 25 }),
        makeSeat(2),
        makeSeat(3),
      ],
    });
    const events = computeChipSlideDeltas(prev, next, layout);
    expect(events).toHaveLength(2);
    const byIdx = new Map(events.map((e) => [e.seatIndex, e]));
    expect(byIdx.get(0)?.from).toEqual([0, 0, 0]);
    expect(byIdx.get(1)?.from).toEqual([1, 0, 0]);
    expect(byIdx.get(0)?.to).toEqual([0, 0, -1]);
    expect(byIdx.get(1)?.to).toEqual([0, 0, -1]);
  });
});

describe('computeChipSlideDeltas — AC 3 (fold does not trigger)', () => {
  it('skips a folded seat even if committedThisStreet appears to grow', () => {
    // Contrived: committedThisStreet nominally up but seat folded in next.
    // Realistic poker never increments committed on a fold, but guard
    // explicitly anyway per AC 3.
    const prev = makeState();
    const next = makeState({
      seats: [
        makeSeat(0, { committedThisStreet: 100, folded: true }),
        makeSeat(1),
        makeSeat(2),
        makeSeat(3),
      ],
    });
    expect(computeChipSlideDeltas(prev, next, layout)).toEqual([]);
  });

  it('a pure fold (no committed change) emits nothing', () => {
    const prev = makeState({
      seats: [
        makeSeat(0, { committedThisStreet: 50 }),
        makeSeat(1),
        makeSeat(2),
        makeSeat(3),
      ],
    });
    const next = makeState({
      seats: [
        makeSeat(0, { committedThisStreet: 50, folded: true }),
        makeSeat(1),
        makeSeat(2),
        makeSeat(3),
      ],
    });
    expect(computeChipSlideDeltas(prev, next, layout)).toEqual([]);
  });
});

describe('computeChipSlideDeltas — resets do not emit', () => {
  it('hand change emits nothing', () => {
    const prev = makeState({
      handId: 41,
      seats: [
        makeSeat(0, { committedThisStreet: 50 }),
        makeSeat(1),
        makeSeat(2),
        makeSeat(3),
      ],
    });
    const next = makeState({
      handId: 42,
      seats: [
        makeSeat(0, { committedThisStreet: 10 }),
        makeSeat(1),
        makeSeat(2),
        makeSeat(3),
      ],
    });
    expect(computeChipSlideDeltas(prev, next, layout)).toEqual([]);
  });

  it('street transition (preflop→flop) emits nothing', () => {
    const prev = makeState({
      streetIndex: 0,
      phase: 'preflop',
      seats: [
        makeSeat(0, { committedThisStreet: 50 }),
        makeSeat(1, { committedThisStreet: 50 }),
        makeSeat(2, { committedThisStreet: 50 }),
        makeSeat(3, { committedThisStreet: 50 }),
      ],
    });
    const next = makeState({
      streetIndex: 1,
      phase: 'flop',
      seats: [0, 1, 2, 3].map((i) => makeSeat(i)), // all reset to 0
    });
    expect(computeChipSlideDeltas(prev, next, layout)).toEqual([]);
  });

  it('a decrease inside the same street (cleanup / edit) emits nothing', () => {
    const prev = makeState({
      seats: [
        makeSeat(0, { committedThisStreet: 50 }),
        makeSeat(1),
        makeSeat(2),
        makeSeat(3),
      ],
    });
    const next = makeState({
      seats: [
        makeSeat(0, { committedThisStreet: 40 }),
        makeSeat(1),
        makeSeat(2),
        makeSeat(3),
      ],
    });
    expect(computeChipSlideDeltas(prev, next, layout)).toEqual([]);
  });
});

describe('computeChipSlideDeltas — seat present in next but absent from prev', () => {
  // Documented branch (Cycle 19 L-3): a seat that appears in `next.seats`
  // but had no entry in `prev.seats` is treated as non-motion — the
  // sequencer returns no event rather than inventing a phantom bet origin.
  it('emits nothing when a seat is newly added mid-hand', () => {
    const prev = makeState({ seats: [makeSeat(0)] });
    const next = makeState({
      seats: [makeSeat(0), makeSeat(1, { committedThisStreet: 50 })],
    });
    expect(computeChipSlideDeltas(prev, next, layout)).toEqual([]);
  });
});

describe('chipSlideKey', () => {
  it('builds a stable key format', () => {
    expect(chipSlideKey(42, 1, 3, 2)).toBe('chip:42:1:3:2');
  });
});
