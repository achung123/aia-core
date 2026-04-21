import { describe, it, expect } from 'vitest';

import { ChipSlideController } from '../../src/scenes3d/animations/ChipSlideController';
import {
  CHIP_SLIDE_DURATION_MS,
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

const layout: ChipSlideLayout = {
  seatOrigin: (seatIndex) => [seatIndex, 0, 0] as Vec3,
  potTarget: () => [0, 0, -1] as Vec3,
};

// ---------------------------------------------------------------------------
// AC 1 — increase triggers slide
// ---------------------------------------------------------------------------

describe('ChipSlideController — AC 1 (increase triggers slide)', () => {
  it('spawns exactly one active tween when a seat bets', () => {
    const c = new ChipSlideController({ reducedMotion: () => false });
    c.sync(makeState(), layout);
    c.sync(
      makeState({
        seats: [
          makeSeat(0, { committedThisStreet: 50 }),
          makeSeat(1),
          makeSeat(2),
          makeSeat(3),
        ],
      }),
      layout,
    );
    expect(c.getActiveKeys().size).toBe(1);
    expect([...c.getActiveKeys()][0]).toBe('chip:42:0:0:1');
    expect(c.getInFlightAmountForSeat(0)).toBe(50);
    expect(c.getInFlightPotAmount()).toBe(50);
  });

  it('in-flight position starts at the seat origin and moves toward the pot', () => {
    const c = new ChipSlideController({ reducedMotion: () => false });
    c.sync(makeState(), layout);
    c.sync(
      makeState({
        seats: [
          makeSeat(0, { committedThisStreet: 50 }),
          makeSeat(1),
          makeSeat(2),
          makeSeat(3),
        ],
      }),
      layout,
    );
    const key = 'chip:42:0:0:1';
    // createTween emits onUpdate(from) synchronously on construction.
    const initial = c.getInFlightPosition(key)!;
    expect(initial).toEqual([0, 0, 0]);

    c.tick(CHIP_SLIDE_DURATION_MS / 2);
    const midFlight = c.getInFlightPosition(key)!;
    // X moves toward 0 (already 0), Z decreases toward −1.
    expect(midFlight[2]).toBeLessThan(0);
    expect(midFlight[2]).toBeGreaterThan(-1);
  });
});

// ---------------------------------------------------------------------------
// AC 2 — concurrent seats don't collide
// ---------------------------------------------------------------------------

describe('ChipSlideController — AC 2 (concurrent slides have distinct keys/origins)', () => {
  it('two seats betting at once produce two distinct tweens', () => {
    const c = new ChipSlideController({ reducedMotion: () => false });
    c.sync(makeState(), layout);
    c.sync(
      makeState({
        seats: [
          makeSeat(0, { committedThisStreet: 25 }),
          makeSeat(1, { committedThisStreet: 25 }),
          makeSeat(2),
          makeSeat(3),
        ],
      }),
      layout,
    );
    const keys = [...c.getActiveKeys()];
    expect(keys).toHaveLength(2);
    expect(keys).toContain('chip:42:0:0:1');
    expect(keys).toContain('chip:42:0:1:1');

    const p0 = c.getInFlightPosition('chip:42:0:0:1')!;
    const p1 = c.getInFlightPosition('chip:42:0:1:1')!;
    // Origins are distinct (seat 0 at x=0, seat 1 at x=1).
    expect(p0).not.toEqual(p1);
    expect(p0[0]).toBe(0);
    expect(p1[0]).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// AC 3 — fold does not trigger
// ---------------------------------------------------------------------------

describe('ChipSlideController — AC 3 (fold does not trigger)', () => {
  it('a fold-only transition emits no tween', () => {
    const c = new ChipSlideController({ reducedMotion: () => false });
    c.sync(makeState(), layout);
    c.sync(
      makeState({
        seats: [
          makeSeat(0, { folded: true }),
          makeSeat(1),
          makeSeat(2),
          makeSeat(3),
        ],
      }),
      layout,
    );
    expect(c.getActiveKeys().size).toBe(0);
    expect(c.getInFlightPotAmount()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// AC 4 — two seats fire simultaneously; both start and complete
// ---------------------------------------------------------------------------

describe('ChipSlideController — AC 4 (both start and complete)', () => {
  it('two concurrent slides both start and complete after one tick of the duration', () => {
    const started: string[] = [];
    const completed: string[] = [];
    const c = new ChipSlideController({
      reducedMotion: () => false,
      onSlideStart: (key) => started.push(key),
      onSlideComplete: (key) => completed.push(key),
    });
    c.sync(makeState(), layout);
    c.sync(
      makeState({
        seats: [
          makeSeat(0, { committedThisStreet: 25 }),
          makeSeat(1, { committedThisStreet: 30 }),
          makeSeat(2),
          makeSeat(3),
        ],
      }),
      layout,
    );
    expect(started.sort()).toEqual(['chip:42:0:0:1', 'chip:42:0:1:1']);
    expect(completed).toEqual([]);

    c.tick(CHIP_SLIDE_DURATION_MS + 1);
    expect(completed.sort()).toEqual(['chip:42:0:0:1', 'chip:42:0:1:1']);
    expect(c.getActiveKeys().size).toBe(0);
    expect(c.getInFlightPotAmount()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Reduced motion — synchronous completion
// ---------------------------------------------------------------------------

describe('ChipSlideController — reduced motion completes on sync', () => {
  it('new slides complete synchronously when reducedMotion is true', () => {
    const completed: string[] = [];
    const c = new ChipSlideController({
      reducedMotion: () => true,
      onSlideComplete: (key) => completed.push(key),
    });
    c.sync(makeState(), layout);
    c.sync(
      makeState({
        seats: [
          makeSeat(0, { committedThisStreet: 50 }),
          makeSeat(1),
          makeSeat(2),
          makeSeat(3),
        ],
      }),
      layout,
    );
    // Tween finished inside sync — no active key, completion fired already.
    expect(c.getActiveKeys().size).toBe(0);
    expect(completed).toEqual(['chip:42:0:0:1']);
    // Pot accounting reflects the arrival (amount removed from inFlight).
    expect(c.getInFlightPotAmount()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Sequence counters — same seat re-bets distinct
// ---------------------------------------------------------------------------

describe('ChipSlideController — sequence counters per seat', () => {
  it('a seat re-raising within the same street gets a new key', () => {
    const c = new ChipSlideController({ reducedMotion: () => false });
    c.sync(makeState(), layout);
    c.sync(
      makeState({
        seats: [
          makeSeat(0, { committedThisStreet: 25 }),
          makeSeat(1),
          makeSeat(2),
          makeSeat(3),
        ],
      }),
      layout,
    );
    c.sync(
      makeState({
        seats: [
          makeSeat(0, { committedThisStreet: 75 }),
          makeSeat(1),
          makeSeat(2),
          makeSeat(3),
        ],
      }),
      layout,
    );
    const keys = [...c.getActiveKeys()].sort();
    expect(keys).toEqual(['chip:42:0:0:1', 'chip:42:0:0:2']);
    // Total in-flight reflects both deltas (25 + 50).
    expect(c.getInFlightAmountForSeat(0)).toBe(75);
  });

  it('a street change resets the sequence counter', () => {
    const c = new ChipSlideController({ reducedMotion: () => false });
    c.sync(makeState(), layout);
    c.sync(
      makeState({
        seats: [
          makeSeat(0, { committedThisStreet: 50 }),
          makeSeat(1),
          makeSeat(2),
          makeSeat(3),
        ],
      }),
      layout,
    );
    // Street advances — committedThisStreet resets, no new slide emitted.
    c.sync(
      makeState({
        phase: 'flop',
        streetIndex: 1,
        seats: [0, 1, 2, 3].map((i) => makeSeat(i)),
      }),
      layout,
    );
    // Seat 0 bets again on the flop.
    c.sync(
      makeState({
        phase: 'flop',
        streetIndex: 1,
        seats: [
          makeSeat(0, { committedThisStreet: 20 }),
          makeSeat(1),
          makeSeat(2),
          makeSeat(3),
        ],
      }),
      layout,
    );
    // New scope → sequence starts at 1 again, keyed by street index.
    expect(c.getActiveKeys()).toContain('chip:42:1:0:1');
  });
});

// ---------------------------------------------------------------------------
// Cross-hand cancellation
// ---------------------------------------------------------------------------

describe('ChipSlideController — cross-hand cancellation', () => {
  it('cancels every in-flight slide when handId changes', () => {
    const c = new ChipSlideController({ reducedMotion: () => false });
    c.sync(makeState({ handId: 41 }), layout);
    c.sync(
      makeState({
        handId: 41,
        seats: [
          makeSeat(0, { committedThisStreet: 50 }),
          makeSeat(1),
          makeSeat(2),
          makeSeat(3),
        ],
      }),
      layout,
    );
    expect(c.getActiveKeys().size).toBe(1);
    // New hand — everything cancels.
    c.sync(makeState({ handId: 42 }), layout);
    expect(c.getActiveKeys().size).toBe(0);
    expect(c.getInFlightPotAmount()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// reset()
// ---------------------------------------------------------------------------

describe('ChipSlideController — reset()', () => {
  it('cancels every active tween and clears in-flight bookkeeping', () => {
    const completed: string[] = [];
    const c = new ChipSlideController({
      reducedMotion: () => false,
      onSlideComplete: (key) => completed.push(key),
    });
    c.sync(makeState(), layout);
    c.sync(
      makeState({
        seats: [
          makeSeat(0, { committedThisStreet: 50 }),
          makeSeat(1, { committedThisStreet: 50 }),
          makeSeat(2),
          makeSeat(3),
        ],
      }),
      layout,
    );
    expect(c.getActiveKeys().size).toBe(2);
    c.reset();
    expect(c.getActiveKeys().size).toBe(0);
    expect(c.getInFlightPotAmount()).toBe(0);
    // cancel() doesn't fire onComplete — bookkeeping only, no user-visible
    // pot growth on teardown.
    expect(completed).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// prev === next short-circuit
// ---------------------------------------------------------------------------

describe('ChipSlideController — unchanged state is a no-op', () => {
  it('re-syncing with the same state reference emits no additional slides', () => {
    const c = new ChipSlideController({ reducedMotion: () => false });
    c.sync(makeState(), layout);
    const next = makeState({
      seats: [
        makeSeat(0, { committedThisStreet: 50 }),
        makeSeat(1),
        makeSeat(2),
        makeSeat(3),
      ],
    });
    c.sync(next, layout);
    const first = [...c.getActiveKeys()];
    c.sync(next, layout); // identical reference
    const second = [...c.getActiveKeys()];
    expect(second).toEqual(first);
  });
});

// ---------------------------------------------------------------------------
// Cycle 19 M-3 — reduced-motion callback ordering
// ---------------------------------------------------------------------------

describe('ChipSlideController — onSlideStart fires before onSlideComplete', () => {
  it('under reducedMotion, start precedes complete in the same tick', () => {
    const events: Array<{ phase: 'start' | 'complete'; key: string }> = [];
    const c = new ChipSlideController({
      reducedMotion: () => true,
      onSlideStart: (key) => events.push({ phase: 'start', key }),
      onSlideComplete: (key) => events.push({ phase: 'complete', key }),
    });
    c.sync(makeState(), layout);
    c.sync(
      makeState({
        seats: [
          makeSeat(0, { committedThisStreet: 50 }),
          makeSeat(1),
          makeSeat(2),
          makeSeat(3),
        ],
      }),
      layout,
    );
    expect(events.map((e) => e.phase)).toEqual(['start', 'complete']);
    expect(events[0].key).toBe(events[1].key);
  });
});

// ---------------------------------------------------------------------------
// Cycle 19 M-2 — scope change cancels in-flight slides
// ---------------------------------------------------------------------------

describe('ChipSlideController — street change cancels in-flight slides', () => {
  it('clears in-flight state when streetIndex changes mid-slide', () => {
    const completed: string[] = [];
    const c = new ChipSlideController({
      reducedMotion: () => false,
      onSlideComplete: (key) => completed.push(key),
    });
    c.sync(makeState(), layout);
    c.sync(
      makeState({
        seats: [
          makeSeat(0, { committedThisStreet: 50 }),
          makeSeat(1),
          makeSeat(2),
          makeSeat(3),
        ],
      }),
      layout,
    );
    expect(c.getActiveKeys().size).toBe(1);
    expect(c.getInFlightPotAmount()).toBe(50);
    // Street transitions mid-flight — state.pot will absorb committed
    // on the consumer side, so we cancel the in-flight slug instead of
    // letting it double-count.
    c.sync(
      makeState({
        streetIndex: 1,
        seats: [makeSeat(0), makeSeat(1), makeSeat(2), makeSeat(3)],
      }),
      layout,
    );
    expect(c.getActiveKeys().size).toBe(0);
    expect(c.getInFlightPotAmount()).toBe(0);
    // cancel() doesn't fire onComplete — no phantom pot deposit.
    expect(completed).toEqual([]);
  });
});

