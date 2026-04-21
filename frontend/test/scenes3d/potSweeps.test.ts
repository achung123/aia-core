import { describe, it, expect } from 'vitest';

import {
  POT_SWEEP_DURATION_MS,
  computePotSweepDeltas,
  potSweepKey,
  type PotSweepLayout,
} from '../../src/scenes3d/animations/potSweeps';
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
    phase: 'showdown',
    streetIndex: 4,
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

/** Trivial layout: seat target = (seatIndex, 0, 0); pot at (0, 0, -1). */
const layout: PotSweepLayout = {
  seatTarget: (seatIndex) => [seatIndex, 0, 0] as Vec3,
  potOrigin: () => [0, 0, -1] as Vec3,
};

// ---------------------------------------------------------------------------
// Prime
// ---------------------------------------------------------------------------

describe('computePotSweepDeltas — prev null primes without events', () => {
  it('returns [] when prev is null', () => {
    const next = makeState({
      pot: 100,
      seats: [
        makeSeat(0, { result: 'won', profitLoss: 50 }),
        makeSeat(1),
        makeSeat(2),
        makeSeat(3),
      ],
    });
    expect(computePotSweepDeltas(null, next, layout)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// AC 1 — single winner sweep
// ---------------------------------------------------------------------------

describe('computePotSweepDeltas — AC 1 (single winner)', () => {
  it('emits one delta carrying the whole pot toward the winner', () => {
    const prev = makeState({ pot: 100 });
    const next = makeState({
      pot: 100,
      seats: [
        makeSeat(0, { result: 'won', profitLoss: 50, stack: 1050 }),
        makeSeat(1, { result: 'lost', profitLoss: -25 }),
        makeSeat(2, { result: 'lost', profitLoss: -25 }),
        makeSeat(3, { result: 'folded' }),
      ],
    });
    const events = computePotSweepDeltas(prev, next, layout);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      seatIndex: 0,
      handId: 42,
      amount: 100,
      durationMs: POT_SWEEP_DURATION_MS,
    });
    expect(events[0].from).toEqual([0, 0, -1]);
    expect(events[0].to).toEqual([0, 0, 0]);
  });

  it('duration is at most 800ms per spec', () => {
    expect(POT_SWEEP_DURATION_MS).toBeLessThanOrEqual(800);
  });
});

// ---------------------------------------------------------------------------
// AC 2 — split pot proportional to profit_loss
// ---------------------------------------------------------------------------

describe('computePotSweepDeltas — AC 2 (split pot)', () => {
  it('splits proportional to profitLoss shares', () => {
    const prev = makeState({ pot: 120 });
    const next = makeState({
      pot: 120,
      seats: [
        makeSeat(0, { result: 'won', profitLoss: 60 }),
        makeSeat(1, { result: 'won', profitLoss: 30 }),
        makeSeat(2, { result: 'lost', profitLoss: -45 }),
        makeSeat(3, { result: 'lost', profitLoss: -45 }),
      ],
    });
    const events = computePotSweepDeltas(prev, next, layout);
    expect(events).toHaveLength(2);
    const byIdx = new Map(events.map((e) => [e.seatIndex, e]));
    // seat0 share = 60 / 90 = 2/3 * 120 = 80
    // seat1 share = 30 / 90 = 1/3 * 120 = 40
    expect(byIdx.get(0)?.amount).toBeCloseTo(80, 6);
    expect(byIdx.get(1)?.amount).toBeCloseTo(40, 6);
    // Total of shares matches pot exactly (last-share fixup).
    const total = events.reduce((a, e) => a + e.amount, 0);
    expect(total).toBeCloseTo(120, 6);
  });

  it('last-share fixup ensures no rounding drift from pot total', () => {
    const prev = makeState({ pot: 100 });
    // Three winners with equal profitLoss → shares of 33.333…; last share
    // gets the residual so total === pot.
    const next = makeState({
      pot: 100,
      seats: [
        makeSeat(0, { result: 'won', profitLoss: 10 }),
        makeSeat(1, { result: 'won', profitLoss: 10 }),
        makeSeat(2, { result: 'won', profitLoss: 10 }),
        makeSeat(3, { result: 'folded' }),
      ],
    });
    const events = computePotSweepDeltas(prev, next, layout);
    const total = events.reduce((a, e) => a + e.amount, 0);
    expect(total).toBeCloseTo(100, 10);
  });

  it('falls back to equal shares if no positive profitLoss available', () => {
    const prev = makeState({ pot: 80 });
    const next = makeState({
      pot: 80,
      seats: [
        makeSeat(0, { result: 'won', profitLoss: null }),
        makeSeat(1, { result: 'won', profitLoss: null }),
        makeSeat(2, { result: 'lost' }),
        makeSeat(3, { result: 'lost' }),
      ],
    });
    const events = computePotSweepDeltas(prev, next, layout);
    expect(events).toHaveLength(2);
    const total = events.reduce((a, e) => a + e.amount, 0);
    expect(total).toBeCloseTo(80, 6);
    expect(events[0].amount).toBeCloseTo(40, 6);
  });
});

// ---------------------------------------------------------------------------
// H-1 / Cycle 35 M-4 regression — mixed-sign / non-positive profitLoss winners
//
// Every seat with `result === 'won'` must receive a non-zero visible share
// summing to `state.pot` exactly, even when a co-winner's clamped PL is
// ≤ 0 (realistic main-vs-side-pot scenarios or all-negative/zero edges).
// ---------------------------------------------------------------------------

describe('computePotSweepDeltas — H-1 mixed-sign profitLoss among winners', () => {
  it('mixed positive+negative: [+50, -10] splits pot so both winners get non-zero shares summing to pot', () => {
    const prev = makeState({ pot: 100 });
    const next = makeState({
      pot: 100,
      seats: [
        makeSeat(0, { result: 'won', profitLoss: 50 }),
        makeSeat(1, { result: 'won', profitLoss: -10 }),
        makeSeat(2, { result: 'lost' }),
        makeSeat(3, { result: 'folded' }),
      ],
    });
    const events = computePotSweepDeltas(prev, next, layout);
    expect(events).toHaveLength(2);
    for (const e of events) {
      expect(e.amount).toBeGreaterThan(0);
    }
    const total = events.reduce((a, e) => a + e.amount, 0);
    expect(total).toBeCloseTo(100, 6);
  });

  it('mixed positive+zero: [+40, 0] splits pot so both winners get non-zero shares summing to pot', () => {
    const prev = makeState({ pot: 80 });
    const next = makeState({
      pot: 80,
      seats: [
        makeSeat(0, { result: 'won', profitLoss: 40 }),
        makeSeat(1, { result: 'won', profitLoss: 0 }),
        makeSeat(2, { result: 'lost' }),
        makeSeat(3, { result: 'folded' }),
      ],
    });
    const events = computePotSweepDeltas(prev, next, layout);
    expect(events).toHaveLength(2);
    for (const e of events) {
      expect(e.amount).toBeGreaterThan(0);
    }
    const total = events.reduce((a, e) => a + e.amount, 0);
    expect(total).toBeCloseTo(80, 6);
  });

  it('three-way mixed: [+30, -5, +15] yields non-zero per winner summing to pot', () => {
    const prev = makeState({ pot: 150 });
    const next = makeState({
      pot: 150,
      seats: [
        makeSeat(0, { result: 'won', profitLoss: 30 }),
        makeSeat(1, { result: 'won', profitLoss: -5 }),
        makeSeat(2, { result: 'won', profitLoss: 15 }),
        makeSeat(3, { result: 'folded' }),
      ],
    });
    const events = computePotSweepDeltas(prev, next, layout);
    expect(events).toHaveLength(3);
    for (const e of events) {
      expect(e.amount).toBeGreaterThan(0);
    }
    const total = events.reduce((a, e) => a + e.amount, 0);
    expect(total).toBeCloseTo(150, 6);
  });

  it('all-zero profitLoss: falls back to equal shares (no winner gets zero)', () => {
    const prev = makeState({ pot: 90 });
    const next = makeState({
      pot: 90,
      seats: [
        makeSeat(0, { result: 'won', profitLoss: 0 }),
        makeSeat(1, { result: 'won', profitLoss: 0 }),
        makeSeat(2, { result: 'won', profitLoss: 0 }),
        makeSeat(3, { result: 'folded' }),
      ],
    });
    const events = computePotSweepDeltas(prev, next, layout);
    expect(events).toHaveLength(3);
    for (const e of events) {
      expect(e.amount).toBeGreaterThan(0);
      expect(e.amount).toBeCloseTo(30, 6);
    }
    const total = events.reduce((a, e) => a + e.amount, 0);
    expect(total).toBeCloseTo(90, 6);
  });

  it('all-negative profitLoss: falls back to equal shares (no winner gets zero)', () => {
    const prev = makeState({ pot: 60 });
    const next = makeState({
      pot: 60,
      seats: [
        makeSeat(0, { result: 'won', profitLoss: -10 }),
        makeSeat(1, { result: 'won', profitLoss: -20 }),
        makeSeat(2, { result: 'folded' }),
        makeSeat(3, { result: 'folded' }),
      ],
    });
    const events = computePotSweepDeltas(prev, next, layout);
    expect(events).toHaveLength(2);
    for (const e of events) {
      expect(e.amount).toBeGreaterThan(0);
      expect(e.amount).toBeCloseTo(30, 6);
    }
    const total = events.reduce((a, e) => a + e.amount, 0);
    expect(total).toBeCloseTo(60, 6);
  });
});

// ---------------------------------------------------------------------------
// AC 4 — all-fold resolution
// ---------------------------------------------------------------------------

describe('computePotSweepDeltas — AC 4 (all-fold)', () => {
  it('sweeps entire pot to the sole non-folded seat when result=won set', () => {
    const prev = makeState({
      phase: 'river',
      streetIndex: 3,
      pot: 30,
    });
    const next = makeState({
      // Note: all-fold resolution may *not* transition to "showdown";
      // trigger is result-based, not phase-based.
      phase: 'river',
      streetIndex: 3,
      pot: 30,
      seats: [
        makeSeat(0, { result: 'won', profitLoss: 15 }),
        makeSeat(1, { result: 'folded' }),
        makeSeat(2, { result: 'folded' }),
        makeSeat(3, { result: 'folded' }),
      ],
    });
    const events = computePotSweepDeltas(prev, next, layout);
    expect(events).toHaveLength(1);
    expect(events[0].seatIndex).toBe(0);
    expect(events[0].amount).toBeCloseTo(30, 6);
    expect(events[0].to).toEqual([0, 0, 0]);
  });
});

// ---------------------------------------------------------------------------
// Idempotence — fires at most once per hand
// ---------------------------------------------------------------------------

describe('computePotSweepDeltas — fires exactly once per hand', () => {
  it('emits nothing when prev already shows winners (already swept)', () => {
    const prev = makeState({
      pot: 100,
      seats: [
        makeSeat(0, { result: 'won', profitLoss: 50 }),
        makeSeat(1, { result: 'lost' }),
        makeSeat(2, { result: 'lost' }),
        makeSeat(3, { result: 'folded' }),
      ],
    });
    const next = makeState({
      pot: 100,
      seats: [
        makeSeat(0, { result: 'won', profitLoss: 50 }),
        makeSeat(1, { result: 'lost' }),
        makeSeat(2, { result: 'lost' }),
        makeSeat(3, { result: 'folded' }),
      ],
    });
    expect(computePotSweepDeltas(prev, next, layout)).toEqual([]);
  });

  it('emits nothing on a hand change (controller cancels cross-hand)', () => {
    const prev = makeState({
      handId: 41,
      pot: 50,
      seats: [
        makeSeat(0, { result: 'won', profitLoss: 25 }),
        makeSeat(1, { result: 'lost' }),
        makeSeat(2, { result: 'folded' }),
        makeSeat(3, { result: 'folded' }),
      ],
    });
    const next = makeState({
      handId: 42,
      pot: 100,
      seats: [
        makeSeat(0, { result: 'won', profitLoss: 50 }),
        makeSeat(1, { result: 'lost' }),
        makeSeat(2, { result: 'folded' }),
        makeSeat(3, { result: 'folded' }),
      ],
    });
    expect(computePotSweepDeltas(prev, next, layout)).toEqual([]);
  });

  it('emits nothing when no winners are marked', () => {
    const prev = makeState({ pot: 50 });
    const next = makeState({ pot: 50 });
    expect(computePotSweepDeltas(prev, next, layout)).toEqual([]);
  });

  it('emits nothing when pot is zero (nothing to sweep)', () => {
    const prev = makeState();
    const next = makeState({
      pot: 0,
      seats: [
        makeSeat(0, { result: 'won', profitLoss: 0 }),
        makeSeat(1, { result: 'lost' }),
        makeSeat(2, { result: 'folded' }),
        makeSeat(3, { result: 'folded' }),
      ],
    });
    expect(computePotSweepDeltas(prev, next, layout)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Key builder
// ---------------------------------------------------------------------------

describe('potSweepKey', () => {
  it('is stable for same (hand, seat)', () => {
    expect(potSweepKey(42, 0)).toBe(potSweepKey(42, 0));
  });
  it('is distinct across seats and hands', () => {
    expect(potSweepKey(42, 0)).not.toBe(potSweepKey(42, 1));
    expect(potSweepKey(42, 0)).not.toBe(potSweepKey(43, 0));
  });
});
