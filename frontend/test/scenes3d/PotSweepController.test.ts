import { describe, it, expect } from 'vitest';

import { PotSweepController } from '../../src/scenes3d/animations/PotSweepController';
import {
  POT_SWEEP_DURATION_MS,
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

const layout: PotSweepLayout = {
  seatTarget: (seatIndex) => [seatIndex, 0, 0] as Vec3,
  potOrigin: () => [0, 0, -1] as Vec3,
};

function winnerState(
  pot: number,
  winners: Array<{ seat: number; pl: number }>,
): TableState {
  const winnerSet = new Set(winners.map((w) => w.seat));
  return makeState({
    pot,
    seats: [0, 1, 2, 3].map((i) => {
      const w = winners.find((x) => x.seat === i);
      if (w) return makeSeat(i, { result: 'won', profitLoss: w.pl });
      if (winnerSet.size > 0) return makeSeat(i, { result: 'lost' });
      return makeSeat(i);
    }),
  });
}

// ---------------------------------------------------------------------------
// AC 1 — single winner: one active tween, entire pot amount, from=pot to=seat
// ---------------------------------------------------------------------------

describe('PotSweepController — AC 1 (single winner)', () => {
  it('spawns exactly one tween carrying the whole pot', () => {
    const c = new PotSweepController({ reducedMotion: () => false });
    c.sync(makeState({ pot: 100 }), layout);
    c.sync(winnerState(100, [{ seat: 2, pl: 50 }]), layout);

    expect(c.getActiveKeys().size).toBe(1);
    expect(c.getInFlightPotOutflow()).toBe(100);
    expect(c.getInFlightForWinner(2)).toBe(100);
    const key = [...c.getActiveKeys()][0];
    expect(c.getInFlightPosition(key)).toEqual([0, 0, -1]);
  });
});

// ---------------------------------------------------------------------------
// AC 2 — split: two distinct tweens with proportional amounts, distinct
// keys/targets
// ---------------------------------------------------------------------------

describe('PotSweepController — AC 2 (split pot)', () => {
  it('spawns one tween per winner with distinct keys and amounts', () => {
    const c = new PotSweepController({ reducedMotion: () => false });
    c.sync(makeState({ pot: 120 }), layout);
    c.sync(
      winnerState(120, [
        { seat: 0, pl: 60 },
        { seat: 1, pl: 30 },
      ]),
      layout,
    );
    const keys = [...c.getActiveKeys()];
    expect(keys).toHaveLength(2);
    expect(new Set(keys).size).toBe(2);
    // Per-winner in-flight totals reflect proportional split.
    expect(c.getInFlightForWinner(0)).toBeCloseTo(80, 6);
    expect(c.getInFlightForWinner(1)).toBeCloseTo(40, 6);
    // Sum matches pot exactly.
    expect(c.getInFlightPotOutflow()).toBeCloseTo(120, 6);
  });
});

// ---------------------------------------------------------------------------
// AC 3 — after animation, pot shows zero (controller accounting)
// ---------------------------------------------------------------------------

describe('PotSweepController — AC 3 (pot drains to zero after completion)', () => {
  it('all tweens complete and in-flight outflow returns to zero', () => {
    const started: string[] = [];
    const completed: string[] = [];
    const c = new PotSweepController({
      reducedMotion: () => false,
      onSweepStart: (key) => started.push(key),
      onSweepComplete: (key) => completed.push(key),
    });
    c.sync(makeState({ pot: 60 }), layout);
    c.sync(
      winnerState(60, [
        { seat: 0, pl: 20 },
        { seat: 1, pl: 40 },
      ]),
      layout,
    );
    expect(started).toHaveLength(2);
    expect(completed).toEqual([]);
    c.tick(POT_SWEEP_DURATION_MS + 1);
    expect(completed.sort()).toEqual(started.sort());
    expect(c.getActiveKeys().size).toBe(0);
    expect(c.getInFlightPotOutflow()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// AC 4 — all-fold resolution
// ---------------------------------------------------------------------------

describe('PotSweepController — AC 4 (all-fold single winner)', () => {
  it('sweeps full pot to sole winner regardless of phase', () => {
    const c = new PotSweepController({ reducedMotion: () => false });
    c.sync(
      makeState({ phase: 'river', streetIndex: 3, pot: 25 }),
      layout,
    );
    c.sync(
      makeState({
        phase: 'river',
        streetIndex: 3,
        pot: 25,
        seats: [
          makeSeat(0, { result: 'won', profitLoss: 10 }),
          makeSeat(1, { result: 'folded' }),
          makeSeat(2, { result: 'folded' }),
          makeSeat(3, { result: 'folded' }),
        ],
      }),
      layout,
    );
    expect(c.getActiveKeys().size).toBe(1);
    expect(c.getInFlightForWinner(0)).toBe(25);
  });
});

// ---------------------------------------------------------------------------
// Reduced motion — synchronous completion
// ---------------------------------------------------------------------------

describe('PotSweepController — reduced motion completes on sync', () => {
  it('completes all sweeps synchronously when reducedMotion is true', () => {
    const completed: string[] = [];
    const c = new PotSweepController({
      reducedMotion: () => true,
      onSweepComplete: (key) => completed.push(key),
    });
    c.sync(makeState({ pot: 100 }), layout);
    c.sync(winnerState(100, [{ seat: 0, pl: 50 }]), layout);
    expect(c.getActiveKeys().size).toBe(0);
    expect(completed).toHaveLength(1);
    expect(c.getInFlightPotOutflow()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Cross-hand cancellation
// ---------------------------------------------------------------------------

describe('PotSweepController — cross-hand cancellation', () => {
  it('a hand change cancels any in-flight sweep without firing onSweepComplete', () => {
    const completed: string[] = [];
    const c = new PotSweepController({
      reducedMotion: () => false,
      onSweepComplete: (key) => completed.push(key),
    });
    c.sync(makeState({ pot: 100 }), layout);
    c.sync(winnerState(100, [{ seat: 0, pl: 50 }]), layout);
    expect(c.getActiveKeys().size).toBe(1);
    // New hand starts before sweep finishes.
    c.sync(
      makeState({ handId: 43, pot: 0, seats: [0, 1, 2, 3].map((i) => makeSeat(i)) }),
      layout,
    );
    expect(c.getActiveKeys().size).toBe(0);
    expect(c.getInFlightPotOutflow()).toBe(0);
    expect(completed).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Idempotence — doesn't re-spawn on repeated syncs
// ---------------------------------------------------------------------------

describe('PotSweepController — idempotent', () => {
  it('syncing the same winner state twice does not spawn a second sweep', () => {
    const c = new PotSweepController({ reducedMotion: () => false });
    c.sync(makeState({ pot: 100 }), layout);
    const next = winnerState(100, [{ seat: 0, pl: 50 }]);
    c.sync(next, layout);
    expect(c.getActiveKeys().size).toBe(1);
    c.sync(next, layout);
    expect(c.getActiveKeys().size).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// reset()
// ---------------------------------------------------------------------------

describe('PotSweepController — reset()', () => {
  it('cancels every in-flight sweep and forgets prev state', () => {
    const c = new PotSweepController({ reducedMotion: () => false });
    c.sync(makeState({ pot: 100 }), layout);
    c.sync(winnerState(100, [{ seat: 0, pl: 50 }]), layout);
    expect(c.getActiveKeys().size).toBe(1);
    c.reset();
    expect(c.getActiveKeys().size).toBe(0);
    expect(c.getInFlightPotOutflow()).toBe(0);
  });
});
