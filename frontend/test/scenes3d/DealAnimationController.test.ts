import { describe, it, expect } from 'vitest';

import {
  DealAnimationController,
  shouldCancel,
  type DealTarget,
} from '../../src/scenes3d/animations/DealAnimationController';
import {
  DEAL_CARD_DURATION_MS,
  DEAL_HOLE_STAGGER_MS,
  DEAL_STREET_TOTAL_MS,
  DECK_POSITION,
  type DealLayout,
} from '../../src/scenes3d/animations/dealCards';
import type {
  CardRef,
  SeatState,
  TableState,
} from '../../src/scenes3d/types';
import type { Vec3 } from '../../src/scenes3d/animations/tweens';

// ---------------------------------------------------------------------------
// Test doubles
// ---------------------------------------------------------------------------

/** Simple mutable target that records the last position the controller wrote. */
class StubTarget implements DealTarget {
  position: Vec3 = [Number.NaN, Number.NaN, Number.NaN];
  rotation: Vec3 = [0, 0, 0];
  writes = 0;
  setPosition(x: number, y: number, z: number): void {
    this.position = [x, y, z];
    this.writes += 1;
  }
  setRotation(x: number, y: number, z: number): void {
    this.rotation = [x, y, z];
  }
}

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

// Deterministic layout with easily-asserted coordinates:
//   community slot S → (S, 0, 0)
//   hole (seat, slot) → (seat + 10, 0.02, slot)
const layout: DealLayout = {
  communityPosition: (slot) => [slot, 0, 0] as Vec3,
  holePosition: (seatIndex, _count, holeSlot) =>
    [seatIndex + 10, 0.02, holeSlot] as Vec3,
};

/** Convenience: build a target registry map with a StubTarget per key. */
class Registry {
  readonly map = new Map<string, StubTarget>();
  get(key: string): StubTarget | null {
    let t = this.map.get(key);
    if (!t) {
      t = new StubTarget();
      this.map.set(key, t);
    }
    return t;
  }
}

// ---------------------------------------------------------------------------
// AC 1 — sequential flop reveal, all 3 cards land within 500 ms
// ---------------------------------------------------------------------------

describe('DealAnimationController — AC 1 (flop reveal ≤500ms)', () => {
  it('mid-animation (250ms) cards have moved from DECK_POSITION toward targets', () => {
    const reg = new Registry();
    const c = new DealAnimationController({
      getTarget: (k) => reg.get(k),
      reducedMotion: () => false,
    });
    // Seed: awaiting_cards (no hole deal in progress). Using 'preflop'
    // here would spawn a hole-deal sequence (isNewHand=true +
    // enteringPreflop=true) that correctly survives the same-hand flop
    // transition under the H-2 fix, which is outside this test's scope.
    const prev = makeState({ phase: 'awaiting_cards', streetIndex: 0 });
    c.sync(prev, layout); // primes controller
    const next = makeState({
      phase: 'flop',
      streetIndex: 1,
      community: [card('Ah'), card('Kd'), card('2c'), null, null],
    });
    c.sync(next, layout);

    // After 250ms (half of the 500ms budget) every slot has been written
    // at least once (createTween emits onUpdate(from) synchronously) and no
    // slot is sitting above the deck. By construction of staggerStarts(3,
    // 500, 120) → delays [0, 190, 380], card 0 is already done, card 1 is
    // mid-flight, card 2 is still waiting at DECK_POSITION.
    c.tick(250);

    for (let slot = 0; slot < 3; slot++) {
      const t = reg.get(`community:10:${slot}`)!;
      expect(t.writes).toBeGreaterThan(0);
      // Y is monotonically non-increasing from DECK_POSITION.y to 0.
      expect(t.position[1]).toBeLessThanOrEqual(DECK_POSITION[1] + 1e-9);
      expect(t.position[1]).toBeGreaterThanOrEqual(0);
    }
    // At least one card is genuinely mid-flight (strictly between deck and
    // target on the Y axis).
    const midFlight = [0, 1, 2].some((slot) => {
      const y = reg.get(`community:10:${slot}`)!.position[1];
      return y > 0 && y < DECK_POSITION[1];
    });
    expect(midFlight).toBe(true);
  });

  it('after 500ms all three flop cards are at their final positions', () => {
    const reg = new Registry();
    const c = new DealAnimationController({
      getTarget: (k) => reg.get(k),
      reducedMotion: () => false,
    });
    // See neighbouring test re: awaiting_cards prime.
    c.sync(makeState({ phase: 'awaiting_cards', streetIndex: 0 }), layout);
    c.sync(
      makeState({
        phase: 'flop',
        streetIndex: 1,
        community: [card('Ah'), card('Kd'), card('2c'), null, null],
      }),
      layout,
    );

    // Drive for the full street budget + one card duration of slack. The
    // final card's tween ends exactly at DEAL_STREET_TOTAL_MS by construction.
    c.tick(DEAL_STREET_TOTAL_MS + 1);

    for (let slot = 0; slot < 3; slot++) {
      const t = reg.get(`community:10:${slot}`)!;
      expect(t.position).toEqual([slot, 0, 0]);
    }
    // No active tweens remain.
    expect(c.getActiveKeys().size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// AC 2 — hole deal tween starts follow holeDealOrder
// ---------------------------------------------------------------------------

describe('DealAnimationController — AC 2 (hole deal order)', () => {
  it('starts tweens for hole cards in dealer-rotation order', () => {
    const reg = new Registry();
    const startOrder: string[] = [];
    const c = new DealAnimationController({
      getTarget: (k) => {
        const t = reg.get(k);
        return t;
      },
      reducedMotion: () => false,
      onTweenStart: (key) => startOrder.push(key),
    });
    const next = makeState({
      phase: 'preflop',
      streetIndex: 0,
      dealerSeat: 0,
    });
    c.sync(null, layout); // seed with null prev still allowed
    c.sync(next, layout);

    // Expected dealer-rotation order: seat 1,2,3,0 for slot 0 then slot 0→1.
    expect(startOrder.slice(0, 4)).toEqual([
      'hole:10:1:0',
      'hole:10:2:0',
      'hole:10:3:0',
      'hole:10:0:0',
    ]);
    expect(startOrder.slice(4, 8)).toEqual([
      'hole:10:1:1',
      'hole:10:2:1',
      'hole:10:3:1',
      'hole:10:0:1',
    ]);
  });
});

// ---------------------------------------------------------------------------
// AC 3 — reduced motion: cards teleport to targets within first frame
// ---------------------------------------------------------------------------

describe('DealAnimationController — AC 3 (reduced motion)', () => {
  it('reduced-motion cards snap to their target on the first tick', () => {
    const reg = new Registry();
    const c = new DealAnimationController({
      getTarget: (k) => reg.get(k),
      reducedMotion: () => true,
    });
    c.sync(makeState({ phase: 'preflop', streetIndex: 0 }), layout);
    c.sync(
      makeState({
        phase: 'flop',
        streetIndex: 1,
        community: [card('Ah'), card('Kd'), card('2c'), null, null],
      }),
      layout,
    );

    // Reduced-motion tweens complete synchronously on construction.
    for (let slot = 0; slot < 3; slot++) {
      const t = reg.get(`community:10:${slot}`)!;
      expect(t.position).toEqual([slot, 0, 0]);
    }
    expect(c.getActiveKeys().size).toBe(0);

    // Further ticks are a no-op.
    c.tick(1000);
    for (let slot = 0; slot < 3; slot++) {
      const t = reg.get(`community:10:${slot}`)!;
      expect(t.position).toEqual([slot, 0, 0]);
    }
  });
});

// ---------------------------------------------------------------------------
// AC 4 — rapid state toggles cancel stale tweens
// ---------------------------------------------------------------------------

describe('DealAnimationController — AC 4 (cancel on absent key)', () => {
  it('cancels in-flight tweens whose key is absent from the new event set', () => {
    const reg = new Registry();
    const c = new DealAnimationController({
      getTarget: (k) => reg.get(k),
      reducedMotion: () => false,
    });
    c.sync(makeState({ handId: 10, phase: 'preflop', streetIndex: 0 }), layout);
    // Start hole + flop deal for hand 10.
    c.sync(
      makeState({
        handId: 10,
        phase: 'flop',
        streetIndex: 1,
        community: [card('Ah'), card('Kd'), card('2c'), null, null],
      }),
      layout,
    );
    const midKeys = c.getActiveKeys();
    expect(midKeys.has('community:10:0')).toBe(true);

    // Tick a little so tweens are genuinely mid-flight.
    c.tick(50);

    // Abruptly transition to a new hand preflop → this computes a fresh
    // hole-deal event set with handId=11 keys. The hand-10 community tweens
    // must be cancelled.
    c.sync(
      makeState({ handId: 11, phase: 'preflop', streetIndex: 0, dealerSeat: 0 }),
      layout,
    );

    const afterKeys = c.getActiveKeys();
    for (const key of midKeys) {
      expect(afterKeys.has(key)).toBe(false);
    }
    // New hand hole-deal tweens registered.
    expect(afterKeys.size).toBeGreaterThan(0);
    for (const k of afterKeys) {
      expect(k.startsWith('hole:11:')).toBe(true);
    }
  });

  it('no-op when state identity is unchanged (memoized by [prev, next])', () => {
    const reg = new Registry();
    let targetLookups = 0;
    const c = new DealAnimationController({
      getTarget: (k) => {
        targetLookups += 1;
        return reg.get(k);
      },
      reducedMotion: () => false,
    });
    const s = makeState({ phase: 'preflop', streetIndex: 0, dealerSeat: 0 });
    c.sync(null, layout);
    c.sync(s, layout);
    const firstLookupCount = targetLookups;

    c.sync(s, layout);
    c.sync(s, layout);
    // Identity-equivalent sync must not register new tweens or re-look-up
    // targets (guards the Cycle 12 LOW #6 re-animation concern).
    expect(targetLookups).toBe(firstLookupCount);
  });
});

// ---------------------------------------------------------------------------
// Timing sanity — hole stagger and durations match T-010 constants
// ---------------------------------------------------------------------------

describe('DealAnimationController — timing sanity', () => {
  it('hole cards deal at DEAL_HOLE_STAGGER_MS intervals', () => {
    const reg = new Registry();
    const c = new DealAnimationController({
      getTarget: (k) => reg.get(k),
      reducedMotion: () => false,
    });
    c.sync(null, layout);
    c.sync(makeState({ phase: 'preflop', streetIndex: 0, dealerSeat: 0 }), layout);

    // At t=0 the first hole card's tween has emitted an `onUpdate(from)`
    // for every event (so it sits at DECK_POSITION). None has completed yet.
    // Advance by one stagger tick (80ms): the FIRST hole card should still
    // be in flight; some later hole cards have not yet started moving.
    c.tick(DEAL_HOLE_STAGGER_MS);
    const k0 = reg.get('hole:10:1:0')!;
    const k1 = reg.get('hole:10:2:0')!;
    expect(k0.writes).toBeGreaterThan(1); // from + at least one progress
    // k1 starts 80ms after k0; at exactly stagger time it should be at
    // elapsed=0 past its own delay (just about to move) — position still
    // near DECK_POSITION y.
    expect(k1.position[1]).toBeCloseTo(DECK_POSITION[1], 1);

    // Drive out the rest of the deal — final card tween must complete.
    c.tick(8 * DEAL_HOLE_STAGGER_MS + DEAL_CARD_DURATION_MS);
    expect(c.getActiveKeys().size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Cycle 13 H-2 — shouldCancel predicate + same-hand preservation
// ---------------------------------------------------------------------------

describe('shouldCancel — cross-hand vs same-hand cancellation predicate', () => {
  it('cancels every in-flight tween on a cross-hand transition', () => {
    const newKeys = new Set(['hole:11:1:0', 'hole:11:2:0']);
    expect(shouldCancel('hole:10:1:0', newKeys, 10, 11)).toBe(true);
    expect(shouldCancel('community:10:0', newKeys, 10, 11)).toBe(true);
  });

  it('keeps a same-hand tween whose key is absent from the new event set', () => {
    // preflop hole tweens in-flight; flop delta emits community keys only.
    const newKeys = new Set([
      'community:10:0',
      'community:10:1',
      'community:10:2',
    ]);
    expect(shouldCancel('hole:10:1:0', newKeys, 10, 10)).toBe(false);
    expect(shouldCancel('hole:10:2:1', newKeys, 10, 10)).toBe(false);
  });

  it('cancels a same-hand tween whose key IS in the new event set (intentional re-deal)', () => {
    const newKeys = new Set(['hole:10:1:0']);
    expect(shouldCancel('hole:10:1:0', newKeys, 10, 10)).toBe(true);
  });

  it('is a no-op for the priming sync (prevHandId === null)', () => {
    expect(shouldCancel('hole:10:1:0', new Set(), null, 10)).toBe(false);
  });
});

describe('DealAnimationController — H-2 same-hand preflop→flop preserves hole tweens', () => {
  it('does not cancel mid-flight hole tweens when community cards are dealt', () => {
    const reg = new Registry();
    const c = new DealAnimationController({
      getTarget: (k) => reg.get(k),
      reducedMotion: () => false,
    });
    const handId = 42;
    c.sync(null, layout);
    c.sync(
      makeState({ handId, phase: 'preflop', streetIndex: 0, dealerSeat: 0 }),
      layout,
    );
    c.tick(200); // mid-flight hole deal

    const holeKeysBefore = Array.from(c.getActiveKeys()).filter((k) =>
      k.startsWith('hole:'),
    );
    expect(holeKeysBefore.length).toBeGreaterThan(0);

    // Same-hand transition: preflop → flop. Delta emits community events
    // only; the H-2 fix must keep in-flight hole tweens alive.
    c.sync(
      makeState({
        handId,
        phase: 'flop',
        streetIndex: 1,
        community: [card('Ah'), card('Kd'), card('2c'), null, null],
      }),
      layout,
    );

    const afterKeys = c.getActiveKeys();
    for (const k of holeKeysBefore) {
      expect(afterKeys.has(k)).toBe(true);
    }
    // Community tweens also spawned.
    const communityAfter = Array.from(afterKeys).filter((k) =>
      k.startsWith('community:'),
    );
    expect(communityAfter.length).toBeGreaterThan(0);
  });

  it('supersedes: a same-hand re-deal of the same slot replaces the old tween', () => {
    const reg = new Registry();
    const starts: string[] = [];
    const c = new DealAnimationController({
      getTarget: (k) => reg.get(k),
      reducedMotion: () => false,
      onTweenStart: (k) => starts.push(k),
    });
    const handId = 7;
    // awaiting_cards → preflop spawns hole tweens for hand 7.
    c.sync(
      makeState({ handId, phase: 'awaiting_cards', streetIndex: 0 }),
      layout,
    );
    c.sync(
      makeState({
        handId,
        phase: 'preflop',
        streetIndex: 0,
        dealerSeat: 0,
      }),
      layout,
    );
    c.tick(10);
    const startsAfterFirst = starts.length;
    expect(c.getActiveKeys().has('hole:7:1:0')).toBe(true);

    // Re-enter preflop (same hand, same dealer). computeDealSequence's
    // `enteringPreflop` branch fires again, re-emitting every hole key.
    // Per the H-2 predicate, same-hand tweens whose key IS in the new
    // event set must be cancelled and replaced — new tween for the same
    // key supersedes the old one.
    c.sync(
      makeState({ handId, phase: 'awaiting_cards', streetIndex: 0 }),
      layout,
    );
    c.sync(
      makeState({
        handId,
        phase: 'preflop',
        streetIndex: 0,
        dealerSeat: 0,
      }),
      layout,
    );

    expect(starts.length).toBeGreaterThan(startsAfterFirst);
    const redealStarts = starts.slice(startsAfterFirst);
    expect(redealStarts).toContain('hole:7:1:0');
    expect(c.getActiveKeys().has('hole:7:1:0')).toBe(true);
  });
});
