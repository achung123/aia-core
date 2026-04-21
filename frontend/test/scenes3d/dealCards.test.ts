import { describe, it, expect } from 'vitest';

import {
  DEAL_CARD_DURATION_MS,
  DEAL_HOLE_STAGGER_MS,
  DEAL_STREET_TOTAL_MS,
  DECK_POSITION,
  computeDealSequence,
  holeDealOrder,
  staggerStarts,
  type DealEvent,
  type DealLayout,
} from '../../src/scenes3d/animations/dealCards';
import type {
  CardRef,
  SeatState,
  TableState,
} from '../../src/scenes3d/types';
import type { Vec3 } from '../../src/scenes3d/animations/tweens';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function card(id: string): CardRef {
  const suit = id.slice(-1).toLowerCase() as CardRef['suit'];
  return { rank: id.slice(0, -1), suit, id };
}

function makeSeat(seatIndex: number, overrides: Partial<SeatState> = {}): SeatState {
  return {
    seatIndex,
    playerName: `P${seatIndex}`,
    isActive: true,
    stack: 100,
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
    handId: 10,
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

const layout: DealLayout = {
  communityPosition: (slot) => [slot * 0.5, 0, 0] as Vec3,
  holePosition: (seatIndex, _seatCount, holeSlot) =>
    [seatIndex, 0, holeSlot] as Vec3,
};

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

describe('staggerStarts', () => {
  it('returns [] for count 0', () => {
    expect(staggerStarts(0, 500, 120)).toEqual([]);
  });

  it('single card starts at 0', () => {
    expect(staggerStarts(1, 500, 120)).toEqual([0]);
  });

  it('distributes 3 flop cards so the last ends exactly at totalMs', () => {
    const starts = staggerStarts(3, DEAL_STREET_TOTAL_MS, DEAL_CARD_DURATION_MS);
    expect(starts.length).toBe(3);
    expect(starts[0]).toBe(0);
    const last = starts[starts.length - 1] + DEAL_CARD_DURATION_MS;
    expect(last).toBeCloseTo(DEAL_STREET_TOTAL_MS);
    // Strictly increasing.
    expect(starts[1]).toBeGreaterThan(starts[0]);
    expect(starts[2]).toBeGreaterThan(starts[1]);
  });

  it('clamps stride to non-negative when duration exceeds total', () => {
    const starts = staggerStarts(3, 100, 120);
    expect(starts).toEqual([0, 0, 0]);
  });
});

describe('holeDealOrder', () => {
  it('starts at (dealer+1) % count and wraps forward', () => {
    expect(holeDealOrder(0, [0, 1, 2, 3], 4)).toEqual([1, 2, 3, 0]);
    expect(holeDealOrder(2, [0, 1, 2, 3], 4)).toEqual([3, 0, 1, 2]);
  });

  it('skips inactive / folded seats', () => {
    expect(holeDealOrder(0, [0, 2], 4)).toEqual([2, 0]);
  });

  it('falls back to seat 0 when dealer is null', () => {
    expect(holeDealOrder(null, [0, 1, 2], 3)).toEqual([0, 1, 2]);
  });

  it('returns [] when there are no active seats', () => {
    expect(holeDealOrder(0, [], 4)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// computeDealSequence — hole deal
// ---------------------------------------------------------------------------

describe('computeDealSequence — hole deal', () => {
  it('deals hole cards to every active seat in dealer rotation order (2 passes)', () => {
    const next = makeState({ phase: 'preflop', dealerSeat: 0 });
    const events = computeDealSequence(null, next, layout);
    // 4 seats × 2 hole cards = 8 events.
    const holeEvents = events.filter((e) => e.kind === 'hole');
    expect(holeEvents.length).toBe(8);
    // Dealing order: seat 1, 2, 3, 0 (first card), then seat 1, 2, 3, 0 (second).
    const firstPass = holeEvents.filter((e) => e.slotIndex === 0);
    const secondPass = holeEvents.filter((e) => e.slotIndex === 1);
    expect(firstPass.map((e) => e.seatIndex)).toEqual([1, 2, 3, 0]);
    expect(secondPass.map((e) => e.seatIndex)).toEqual([1, 2, 3, 0]);
  });

  it('emits contiguous stagger starts for the hole deal', () => {
    const next = makeState({ phase: 'preflop', dealerSeat: 0 });
    const events = computeDealSequence(null, next, layout);
    const holeEvents = events.filter((e) => e.kind === 'hole');
    holeEvents.forEach((e, i) => {
      expect(e.startMs).toBe(i * DEAL_HOLE_STAGGER_MS);
      expect(e.durationMs).toBe(DEAL_CARD_DURATION_MS);
    });
  });

  it('omits folded and inactive seats from the hole deal', () => {
    const next = makeState({
      phase: 'preflop',
      dealerSeat: 0,
      seats: [
        makeSeat(0),
        makeSeat(1, { folded: true }),
        makeSeat(2, { isActive: false }),
        makeSeat(3),
      ],
    });
    const events = computeDealSequence(null, next, layout);
    const holeEvents = events.filter((e) => e.kind === 'hole');
    expect(holeEvents.length).toBe(4); // 2 active seats × 2 cards
    const seats = new Set(holeEvents.map((e) => e.seatIndex));
    expect(seats).toEqual(new Set([0, 3]));
  });

  it('fires again when handId changes (new hand)', () => {
    const prev = makeState({ handId: 10, phase: 'river', streetIndex: 3 });
    const next = makeState({ handId: 11, phase: 'preflop', streetIndex: 0 });
    const events = computeDealSequence(prev, next, layout);
    expect(events.some((e) => e.kind === 'hole')).toBe(true);
  });

  it('fires when transitioning awaiting_cards → preflop within the same hand', () => {
    const prev = makeState({ phase: 'awaiting_cards', streetIndex: 0 });
    const next = makeState({ phase: 'preflop', streetIndex: 0 });
    const events = computeDealSequence(prev, next, layout);
    expect(events.some((e) => e.kind === 'hole')).toBe(true);
  });

  it('does NOT re-fire hole deal when prev is already in preflop', () => {
    const prev = makeState({ phase: 'preflop', streetIndex: 0 });
    const next = makeState({ phase: 'preflop', streetIndex: 0 });
    const events = computeDealSequence(prev, next, layout);
    expect(events).toEqual([]);
  });

  it('uses the deck origin as the `from` for every hole event', () => {
    const next = makeState({ phase: 'preflop', dealerSeat: 0 });
    const events = computeDealSequence(null, next, layout);
    events
      .filter((e) => e.kind === 'hole')
      .forEach((e) => {
        expect(e.from).toEqual(DECK_POSITION);
      });
  });
});

// ---------------------------------------------------------------------------
// computeDealSequence — community deals
// ---------------------------------------------------------------------------

describe('computeDealSequence — community flop', () => {
  const prev = makeState({
    phase: 'preflop',
    streetIndex: 0,
    community: [null, null, null, null, null],
  });
  const nextFlop = makeState({
    phase: 'flop',
    streetIndex: 1,
    community: [card('Ah'), card('Kd'), card('Qc'), null, null],
  });

  it('emits three community events for preflop → flop', () => {
    const events = computeDealSequence(prev, nextFlop, layout);
    const community = events.filter((e) => e.kind === 'community');
    expect(community.map((e) => e.slotIndex)).toEqual([0, 1, 2]);
    expect(events.filter((e) => e.kind === 'hole')).toEqual([]);
  });

  it('flop deal finishes within DEAL_STREET_TOTAL_MS (AC 1)', () => {
    const events = computeDealSequence(prev, nextFlop, layout);
    const community = events.filter((e) => e.kind === 'community');
    const last = community[community.length - 1];
    expect(last.startMs + last.durationMs).toBeLessThanOrEqual(
      DEAL_STREET_TOTAL_MS + 0.0001,
    );
  });

  it('flop events are staggered sequentially', () => {
    const events = computeDealSequence(prev, nextFlop, layout);
    const community = events.filter((e) => e.kind === 'community');
    expect(community[0].startMs).toBe(0);
    expect(community[1].startMs).toBeGreaterThan(community[0].startMs);
    expect(community[2].startMs).toBeGreaterThan(community[1].startMs);
  });

  it('each community `to` matches the layout position for its slot', () => {
    const events = computeDealSequence(prev, nextFlop, layout);
    const community = events.filter((e) => e.kind === 'community');
    for (const ev of community) {
      expect(ev.to).toEqual(layout.communityPosition(ev.slotIndex));
    }
  });
});

describe('computeDealSequence — turn and river', () => {
  it('emits one event for flop → turn', () => {
    const prev = makeState({
      phase: 'flop',
      streetIndex: 1,
      community: [card('Ah'), card('Kd'), card('Qc'), null, null],
    });
    const next = makeState({
      phase: 'turn',
      streetIndex: 2,
      community: [card('Ah'), card('Kd'), card('Qc'), card('Jh'), null],
    });
    const events = computeDealSequence(prev, next, layout);
    expect(events.length).toBe(1);
    expect(events[0]).toMatchObject({ kind: 'community', slotIndex: 3 });
    expect(events[0].startMs).toBe(0);
  });

  it('emits one event for turn → river', () => {
    const prev = makeState({
      phase: 'turn',
      streetIndex: 2,
      community: [card('Ah'), card('Kd'), card('Qc'), card('Jh'), null],
    });
    const next = makeState({
      phase: 'river',
      streetIndex: 3,
      community: [
        card('Ah'),
        card('Kd'),
        card('Qc'),
        card('Jh'),
        card('Th'),
      ],
    });
    const events = computeDealSequence(prev, next, layout);
    expect(events.map((e) => e.slotIndex)).toEqual([4]);
  });

  it('accumulates slots when a street is skipped (flop → river)', () => {
    const prev = makeState({
      phase: 'flop',
      streetIndex: 1,
      community: [card('Ah'), card('Kd'), card('Qc'), null, null],
    });
    const next = makeState({
      phase: 'river',
      streetIndex: 3,
      community: [
        card('Ah'),
        card('Kd'),
        card('Qc'),
        card('Jh'),
        card('Th'),
      ],
    });
    const events = computeDealSequence(prev, next, layout);
    expect(events.map((e) => e.slotIndex)).toEqual([3, 4]);
  });

  it('does not re-deal slots already populated in prev (AC 4)', () => {
    // Same preflop → flop transition but flop_1 already showed up in prev.
    const prev = makeState({
      phase: 'preflop',
      streetIndex: 0,
      community: [card('Ah'), null, null, null, null],
    });
    const next = makeState({
      phase: 'flop',
      streetIndex: 1,
      community: [card('Ah'), card('Kd'), card('Qc'), null, null],
    });
    const events = computeDealSequence(prev, next, layout);
    const community = events.filter((e) => e.kind === 'community');
    expect(community.map((e) => e.slotIndex)).toEqual([1, 2]);
  });
});

// ---------------------------------------------------------------------------
// computeDealSequence — stability / no-op transitions (AC 4)
// ---------------------------------------------------------------------------

describe('computeDealSequence — stability', () => {
  it('returns [] when state is unchanged (identity transition)', () => {
    const state = makeState({ phase: 'flop', streetIndex: 1 });
    expect(computeDealSequence(state, state, layout)).toEqual([]);
  });

  it('returns [] on street regression (e.g., scrub backward)', () => {
    const prev = makeState({ phase: 'river', streetIndex: 3 });
    const next = makeState({ phase: 'flop', streetIndex: 1 });
    expect(computeDealSequence(prev, next, layout)).toEqual([]);
  });

  it('event keys are stable across repeated calls for the same transition (no stale meshes)', () => {
    const prev = makeState({ phase: 'preflop', streetIndex: 0 });
    const next = makeState({
      phase: 'flop',
      streetIndex: 1,
      community: [card('Ah'), card('Kd'), card('Qc'), null, null],
    });
    const a = computeDealSequence(prev, next, layout).map((e) => e.key);
    const b = computeDealSequence(prev, next, layout).map((e) => e.key);
    expect(a).toEqual(b);
    // All keys unique.
    expect(new Set(a).size).toBe(a.length);
  });

  it('rapid street toggles do not produce duplicate community events', () => {
    // Simulate: prev=flop, scrub to turn, scrub back to flop, forward to turn.
    // Each call returns exactly the events for its single transition.
    const flop = makeState({
      phase: 'flop',
      streetIndex: 1,
      community: [card('Ah'), card('Kd'), card('Qc'), null, null],
    });
    const turn = makeState({
      phase: 'turn',
      streetIndex: 2,
      community: [card('Ah'), card('Kd'), card('Qc'), card('Jh'), null],
    });
    const forward = computeDealSequence(flop, turn, layout);
    const backward = computeDealSequence(turn, flop, layout);
    const replay = computeDealSequence(flop, turn, layout);
    expect(forward.map((e) => e.key)).toEqual(replay.map((e) => e.key));
    expect(backward).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Reduced motion interop (AC 3)
// ---------------------------------------------------------------------------

describe('dealCards events × reducedMotion (AC 3)', () => {
  it('returns the same event list regardless of reduced-motion preference', () => {
    // computeDealSequence is pure; the reduced-motion decision is made by the
    // driver when feeding events into createTween({ reducedMotion: true }),
    // which causes each card to snap straight to `to`. Assert that a caller
    // applying that policy ends up positioned at every event's target.
    const prev = makeState({ phase: 'preflop', streetIndex: 0 });
    const next = makeState({
      phase: 'flop',
      streetIndex: 1,
      community: [card('Ah'), card('Kd'), card('Qc'), null, null],
    });
    const events: DealEvent[] = computeDealSequence(prev, next, layout);
    // Under reduced motion, drivers pass event.to directly to the card mesh.
    const finalPositions = events.map((e) => e.to);
    expect(finalPositions).toEqual([
      layout.communityPosition(0),
      layout.communityPosition(1),
      layout.communityPosition(2),
    ]);
  });
});
