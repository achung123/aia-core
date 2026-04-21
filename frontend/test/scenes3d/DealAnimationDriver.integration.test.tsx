/**
 * Integration test — `<DealAnimationDriver>` wiring through the
 * `<PokerTable>` scene graph.
 *
 * This suite mirrors the production composition:
 *
 *     useDealTargetRegistry()          <-- same hook PokerTable uses
 *       + registerDealTarget(key)      <-- same ref callback factory
 *       + buildPokerTableDealLayout()  <-- same community / hole layout
 *       + buildTarget(Object3D)        <-- same Object3D adapter
 *
 * but replaces the React + `useFrame` wrapper with direct calls on a bare
 * `DealAnimationController`. Real `THREE.Object3D` groups are arranged to
 * mirror `<PokerTable>`'s hierarchy (community cards at the scene root;
 * hole cards nested under a Y-rotated seat group), so `parent.worldToLocal`
 * runs and assertions can be made against each card's final world
 * position.
 *
 * Bug: aia-core-ji66 — wire deal animations into <Card> so T-010's four
 * observable ACs are met on canvas. See
 * `docs/agent/reviews/cycle-12-aia-core-c8xh-2026-04-18.md`.
 */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';

import {
  DealAnimationController,
  type DealTarget,
} from '../../src/scenes3d/animations/DealAnimationController';
import {
  buildPokerTableDealLayout,
  buildTarget,
  communityTargetPosition,
  holeTargetPosition,
  registerDealTarget,
  type DealTargetRegistry,
} from '../../src/scenes3d/animations/DealAnimationDriver';
import {
  DEAL_CARD_DURATION_MS,
  DEAL_HOLE_STAGGER_MS,
  DEAL_STREET_TOTAL_MS,
  DECK_POSITION,
} from '../../src/scenes3d/animations/dealCards';
import {
  computeSeatPosition,
  computeSeatRotationY,
  SEAT_PAD_THICKNESS,
} from '../../src/scenes3d/components/tableLayout';
import type {
  CardRef,
  SeatState,
  TableState,
} from '../../src/scenes3d/types';

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
    seats: Array.from({ length: 4 }, (_, i) => makeSeat(i)),
    pot: 0,
    sidePots: [],
    dealerSeat: 0,
    sbSeat: 1,
    bbSeat: 2,
    currentSeat: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Scene-graph rig — mirrors <PokerTable>
// ---------------------------------------------------------------------------

interface Rig {
  scene: THREE.Scene;
  /** The registry populated by `registerDealTarget` ref callbacks. */
  registry: { current: DealTargetRegistry };
  /** Wrap one `registerDealTarget` → Object3D pairing just like React refs. */
  mountCommunityCard: (handId: number, slot: number) => THREE.Group;
  mountHoleCard: (handId: number, seatIndex: number, holeSlot: 0 | 1) => THREE.Group;
  /** Tear down every registered ref (for AC 4 stale-mesh assertions). */
  unmountAll: () => void;
}

function buildRig(seatCount: number): Rig {
  const scene = new THREE.Scene();
  scene.name = 'poker-table-scene';
  const communityRoot = new THREE.Group();
  communityRoot.name = 'community-cards';
  scene.add(communityRoot);
  const seatsRoot = new THREE.Group();
  seatsRoot.name = 'seats';
  scene.add(seatsRoot);

  // Build seat groups exactly like <Seat> does: translated to the seat's
  // world position, rotated about Y by `computeSeatRotationY`, with a
  // `seat-anchor` child group lifted by `SEAT_PAD_THICKNESS` so children
  // rest atop the pad (matches frontend/src/scenes3d/components/Seat.tsx).
  const seatAnchors = new Map<number, THREE.Group>();
  for (let i = 0; i < seatCount; i++) {
    const g = new THREE.Group();
    g.name = `seat-${i}`;
    const [sx, sy, sz] = computeSeatPosition(i, seatCount);
    g.position.set(sx, sy, sz);
    g.rotation.y = computeSeatRotationY(i, seatCount);
    const anchor = new THREE.Group();
    anchor.name = 'seat-anchor';
    anchor.position.set(0, SEAT_PAD_THICKNESS, 0);
    g.add(anchor);
    // Ensure worldToLocal sees fresh matrices.
    g.updateMatrixWorld(true);
    seatsRoot.add(g);
    seatAnchors.set(i, anchor);
  }

  const registryMap: DealTargetRegistry = new Map();
  const registry = { current: registryMap };
  const mounted: Array<() => void> = [];

  const mountCommunityCard = (handId: number, slot: number): THREE.Group => {
    const g = new THREE.Group();
    g.name = `community-card-wrap-${slot}`;
    const [x, y, z] = communityTargetPosition(slot);
    g.position.set(x, y, z);
    communityRoot.add(g);
    g.updateMatrixWorld(true);
    const cb = registerDealTarget(registry, `community:${handId}:${slot}`);
    cb(g);
    mounted.push(() => {
      cb(null);
      communityRoot.remove(g);
    });
    return g;
  };

  const mountHoleCard = (
    handId: number,
    seatIndex: number,
    holeSlot: 0 | 1,
  ): THREE.Group => {
    const anchor = seatAnchors.get(seatIndex)!;
    const g = new THREE.Group();
    g.name = `hole-card-wrap-${holeSlot}`;
    const [x, y, z] = holeTargetPosition(seatIndex, seatCount, holeSlot);
    // Local offset mirrors <PokerTable>: the hole-card wrap is a child of
    // the seat-anchor group (which is itself at +SEAT_PAD_THICKNESS under
    // the rotated seat group), so setting the local position to the raw
    // (±HOLE_CARD_SPREAD_X, HOLE_CARD_Y, HOLE_CARD_LOCAL_Z) placement
    // should land exactly at `holeTargetPosition` in world space.
    g.position.set(holeSlot === 0 ? -0.25 : 0.25, 0.02, 0.45);
    anchor.add(g);
    g.updateMatrixWorld(true);
    // Sanity: the seat-local placement must match the layout helper's
    // world position within float tolerance.
    const world = new THREE.Vector3();
    g.getWorldPosition(world);
    expect(world.x).toBeCloseTo(x, 6);
    expect(world.y).toBeCloseTo(y, 6);
    expect(world.z).toBeCloseTo(z, 6);
    const cb = registerDealTarget(registry, `hole:${handId}:${seatIndex}:${holeSlot}`);
    cb(g);
    mounted.push(() => {
      cb(null);
      anchor.remove(g);
    });
    return g;
  };

  return {
    scene,
    registry,
    mountCommunityCard,
    mountHoleCard,
    unmountAll: () => {
      for (const tear of mounted) tear();
      mounted.length = 0;
    },
  };
}

function worldPosition(obj: THREE.Object3D): [number, number, number] {
  obj.updateMatrixWorld(true);
  const v = new THREE.Vector3();
  obj.getWorldPosition(v);
  return [v.x, v.y, v.z];
}

function makeController(
  rig: Rig,
  reducedMotion: boolean,
  onTweenStart?: (key: string) => void,
): DealAnimationController {
  return new DealAnimationController({
    getTarget: (key): DealTarget | null =>
      buildTarget(rig.registry.current.get(key)),
    reducedMotion: () => reducedMotion,
    onTweenStart: onTweenStart ? (key) => onTweenStart(key) : undefined,
  });
}

// ---------------------------------------------------------------------------
// AC 1 — sequential flop reveal in ≤500ms through the real scene graph
// ---------------------------------------------------------------------------

describe('DealAnimationDriver (integration) — AC 1 flop reveal ≤500ms', () => {
  const handId = 10;
  const seatCount = 4;
  const layout = buildPokerTableDealLayout(seatCount);

  function primeFlop(rig: Rig): DealAnimationController {
    const c = makeController(rig, false);
    c.sync(makeState({ handId, phase: 'preflop', streetIndex: 0 }), layout);
    // Mount community groups *before* the flop sync so their refs are in
    // the registry when the driver builds tweens (mirrors <PokerTable>'s
    // conditional render on non-null community slots).
    rig.mountCommunityCard(handId, 0);
    rig.mountCommunityCard(handId, 1);
    rig.mountCommunityCard(handId, 2);
    c.sync(
      makeState({
        handId,
        phase: 'flop',
        streetIndex: 1,
        community: [card('Ah'), card('Kd'), card('2c'), null, null],
      }),
      layout,
    );
    return c;
  }

  it('mid-animation (250ms) cards have moved from DECK_POSITION toward targets', () => {
    const rig = buildRig(seatCount);
    const c = primeFlop(rig);
    const card0 = rig.registry.current.get(`community:${handId}:0`)! as THREE.Group;
    const card1 = rig.registry.current.get(`community:${handId}:1`)! as THREE.Group;
    const card2 = rig.registry.current.get(`community:${handId}:2`)! as THREE.Group;

    c.tick(250);

    // Every slot has been written (first onUpdate fires at start).
    for (const g of [card0, card1, card2]) {
      const wy = worldPosition(g)[1];
      // Y monotonically descends from DECK_POSITION.y → 0.
      expect(wy).toBeLessThanOrEqual(DECK_POSITION[1] + 1e-9);
      expect(wy).toBeGreaterThanOrEqual(-1e-9);
    }
    // At least one card is genuinely mid-flight.
    const midFlight = [card0, card1, card2].some((g) => {
      const wy = worldPosition(g)[1];
      return wy > 1e-6 && wy < DECK_POSITION[1] - 1e-6;
    });
    expect(midFlight).toBe(true);
  });

  it('after 500ms all three flop cards sit at communityTargetPosition()', () => {
    const rig = buildRig(seatCount);
    const c = primeFlop(rig);
    c.tick(DEAL_STREET_TOTAL_MS + 1);

    for (let slot = 0; slot < 3; slot++) {
      const g = rig.registry.current.get(`community:${handId}:${slot}`)! as THREE.Group;
      const wp = worldPosition(g);
      const [tx, ty, tz] = communityTargetPosition(slot);
      expect(wp[0]).toBeCloseTo(tx, 6);
      expect(wp[1]).toBeCloseTo(ty, 6);
      expect(wp[2]).toBeCloseTo(tz, 6);
    }
    expect(c.getActiveKeys().size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// AC 2 — hole-deal tween order follows holeDealOrder(dealer, active, count)
// ---------------------------------------------------------------------------

describe('DealAnimationDriver (integration) — AC 2 hole deal order', () => {
  it('starts hole tweens in dealer-rotation order for a 4-seat table', () => {
    const seatCount = 4;
    const handId = 10;
    const rig = buildRig(seatCount);
    // Mount all 8 hole-card groups (2 per active seat).
    for (let s = 0; s < seatCount; s++) {
      rig.mountHoleCard(handId, s, 0);
      rig.mountHoleCard(handId, s, 1);
    }
    const order: string[] = [];
    const c = makeController(rig, false, (k) => order.push(k));

    c.sync(null, buildPokerTableDealLayout(seatCount));
    c.sync(
      makeState({ handId, phase: 'preflop', streetIndex: 0, dealerSeat: 0 }),
      buildPokerTableDealLayout(seatCount),
    );

    // SB-first (dealer+1), then walk forward; slot 0 fully before slot 1.
    expect(order.slice(0, 4)).toEqual([
      `hole:${handId}:1:0`,
      `hole:${handId}:2:0`,
      `hole:${handId}:3:0`,
      `hole:${handId}:0:0`,
    ]);
    expect(order.slice(4, 8)).toEqual([
      `hole:${handId}:1:1`,
      `hole:${handId}:2:1`,
      `hole:${handId}:3:1`,
      `hole:${handId}:0:1`,
    ]);
  });

  it('respects DEAL_HOLE_STAGGER_MS between successive hole cards', () => {
    const seatCount = 4;
    const handId = 10;
    const rig = buildRig(seatCount);
    for (let s = 0; s < seatCount; s++) {
      rig.mountHoleCard(handId, s, 0);
      rig.mountHoleCard(handId, s, 1);
    }
    const c = makeController(rig, false);
    c.sync(null, buildPokerTableDealLayout(seatCount));
    c.sync(
      makeState({ handId, phase: 'preflop', streetIndex: 0, dealerSeat: 0 }),
      buildPokerTableDealLayout(seatCount),
    );

    // At exactly one stagger tick, the first hole card (seat 1, slot 0) is
    // mid-flight; the last in its pass (seat 0, slot 0) has not yet started.
    c.tick(DEAL_HOLE_STAGGER_MS);
    const first = rig.registry.current.get(`hole:${handId}:1:0`)! as THREE.Group;
    const last = rig.registry.current.get(`hole:${handId}:0:0`)! as THREE.Group;
    const fy = worldPosition(first)[1];
    const ly = worldPosition(last)[1];
    // First card has descended toward 0.02.
    expect(fy).toBeLessThan(DECK_POSITION[1]);
    // Last card in its pass has barely moved (still near DECK y).
    expect(ly).toBeCloseTo(DECK_POSITION[1], 1);

    // Drive the remainder of the deal — everything lands.
    c.tick(10 * DEAL_HOLE_STAGGER_MS + DEAL_CARD_DURATION_MS);
    expect(c.getActiveKeys().size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// AC 3 — reduced-motion: cards snap to targets on the first tick
// ---------------------------------------------------------------------------

describe('DealAnimationDriver (integration) — AC 3 reduced motion', () => {
  it('community cards teleport to target in the first frame (0 ticks needed)', () => {
    const seatCount = 4;
    const handId = 10;
    const rig = buildRig(seatCount);
    rig.mountCommunityCard(handId, 0);
    rig.mountCommunityCard(handId, 1);
    rig.mountCommunityCard(handId, 2);
    const c = makeController(rig, /* reducedMotion */ true);
    c.sync(makeState({ handId, phase: 'preflop', streetIndex: 0 }), buildPokerTableDealLayout(seatCount));
    c.sync(
      makeState({
        handId,
        phase: 'flop',
        streetIndex: 1,
        community: [card('Ah'), card('Kd'), card('2c'), null, null],
      }),
      buildPokerTableDealLayout(seatCount),
    );

    // Reduced-motion tweens complete synchronously on construction — before
    // any useFrame tick has run.
    for (let slot = 0; slot < 3; slot++) {
      const g = rig.registry.current.get(`community:${handId}:${slot}`)! as THREE.Group;
      const wp = worldPosition(g);
      const target = communityTargetPosition(slot);
      expect(wp[0]).toBeCloseTo(target[0], 6);
      expect(wp[1]).toBeCloseTo(target[1], 6);
      expect(wp[2]).toBeCloseTo(target[2], 6);
    }
    expect(c.getActiveKeys().size).toBe(0);

    // Extra ticks are no-ops — positions don't change.
    const before = worldPosition(
      rig.registry.current.get(`community:${handId}:1`)! as THREE.Group,
    );
    c.tick(1000);
    const after = worldPosition(
      rig.registry.current.get(`community:${handId}:1`)! as THREE.Group,
    );
    expect(after).toEqual(before);
  });

  it('hole cards teleport to target in reduced motion, at the correct seat-rotated world position', () => {
    const seatCount = 6;
    const handId = 10;
    const rig = buildRig(seatCount);
    for (let s = 0; s < seatCount; s++) {
      rig.mountHoleCard(handId, s, 0);
      rig.mountHoleCard(handId, s, 1);
    }
    const c = makeController(rig, true);
    c.sync(null, buildPokerTableDealLayout(seatCount));
    c.sync(
      makeState({
        handId,
        phase: 'preflop',
        streetIndex: 0,
        dealerSeat: 0,
        seats: Array.from({ length: seatCount }, (_, i) => makeSeat(i)),
      }),
      buildPokerTableDealLayout(seatCount),
    );

    for (let s = 0; s < seatCount; s++) {
      for (const holeSlot of [0, 1] as const) {
        const g = rig.registry.current.get(`hole:${handId}:${s}:${holeSlot}`)! as THREE.Group;
        const wp = worldPosition(g);
        const target = holeTargetPosition(s, seatCount, holeSlot);
        expect(wp[0]).toBeCloseTo(target[0], 5);
        expect(wp[1]).toBeCloseTo(target[1], 5);
        expect(wp[2]).toBeCloseTo(target[2], 5);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// AC 4 — rapid state toggles cancel stale tweens, mesh refs stable
// ---------------------------------------------------------------------------

describe('DealAnimationDriver (integration) — AC 4 rapid toggle / stale meshes', () => {
  it('cancels in-flight tweens from a previous hand when a new hand starts', () => {
    const seatCount = 4;
    const rig = buildRig(seatCount);
    const layout = buildPokerTableDealLayout(seatCount);
    const c = makeController(rig, false);

    // Hand 10: start flop deal.
    rig.mountCommunityCard(10, 0);
    rig.mountCommunityCard(10, 1);
    rig.mountCommunityCard(10, 2);
    c.sync(makeState({ handId: 10, phase: 'preflop', streetIndex: 0 }), layout);
    c.sync(
      makeState({
        handId: 10,
        phase: 'flop',
        streetIndex: 1,
        community: [card('Ah'), card('Kd'), card('2c'), null, null],
      }),
      layout,
    );
    c.tick(50);
    const staleKeys = c.getActiveKeys();
    expect(staleKeys.has('community:10:0')).toBe(true);
    // Snapshot the hand-10 community card 0's mid-flight world position.
    const h10card0 = rig.registry.current.get('community:10:0')! as THREE.Group;
    const midFlightY = worldPosition(h10card0)[1];
    expect(midFlightY).toBeGreaterThan(0);
    expect(midFlightY).toBeLessThan(DECK_POSITION[1]);

    // Abrupt hand rollover: hand 11 preflop. Old keys absent from new event
    // set → their tweens must be cancelled. Mount new hand's hole targets
    // *before* the sync so new tweens can register.
    for (let s = 0; s < seatCount; s++) {
      rig.mountHoleCard(11, s, 0);
      rig.mountHoleCard(11, s, 1);
    }
    c.sync(
      makeState({
        handId: 11,
        phase: 'preflop',
        streetIndex: 0,
        dealerSeat: 0,
      }),
      layout,
    );

    // Old community:10:* tweens are gone from the active set.
    const afterKeys = c.getActiveKeys();
    for (const key of staleKeys) {
      expect(afterKeys.has(key)).toBe(false);
    }
    // New hole tweens are active.
    expect(afterKeys.size).toBeGreaterThan(0);
    for (const k of afterKeys) expect(k.startsWith('hole:11:')).toBe(true);

    // The stale community-10 card's world position doesn't change on
    // subsequent ticks (no zombie tween writing to it).
    const frozen = worldPosition(h10card0);
    c.tick(500);
    expect(worldPosition(h10card0)).toEqual(frozen);
  });

  it('mesh refs stay stable across identity-equal syncs (no re-registration)', () => {
    const seatCount = 4;
    const rig = buildRig(seatCount);
    const layout = buildPokerTableDealLayout(seatCount);
    const c = makeController(rig, false);

    rig.mountCommunityCard(10, 0);
    const g = rig.registry.current.get('community:10:0')!;
    const uuidBefore = g.uuid;
    c.sync(makeState({ handId: 10, phase: 'preflop', streetIndex: 0 }), layout);
    const state = makeState({
      handId: 10,
      phase: 'flop',
      streetIndex: 1,
      community: [card('Ah'), null, null, null, null],
    });
    c.sync(state, layout);
    // Identical state ref → memoized no-op sync.
    c.sync(state, layout);
    c.sync(state, layout);

    const gAfter = rig.registry.current.get('community:10:0')!;
    expect(gAfter.uuid).toBe(uuidBefore);
    expect(gAfter).toBe(g);
  });

  it('unmounting a card ref while its tween is in-flight does not throw', () => {
    const seatCount = 4;
    const rig = buildRig(seatCount);
    const layout = buildPokerTableDealLayout(seatCount);
    const c = makeController(rig, false);

    rig.mountCommunityCard(10, 0);
    rig.mountCommunityCard(10, 1);
    rig.mountCommunityCard(10, 2);
    c.sync(makeState({ handId: 10, phase: 'preflop', streetIndex: 0 }), layout);
    c.sync(
      makeState({
        handId: 10,
        phase: 'flop',
        streetIndex: 1,
        community: [card('Ah'), card('Kd'), card('2c'), null, null],
      }),
      layout,
    );
    c.tick(100);
    // Simulate hand reset unmounting all card refs mid-flight.
    rig.unmountAll();
    expect(() => c.tick(1000)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Cycle 13 H-1 — hole-card render pose parity with tween target
// ---------------------------------------------------------------------------

describe('DealAnimationDriver (integration) — H-1 hole-card render/target parity', () => {
  it.each([2, 4, 6, 9, 10])(
    'for every seat at seatCount=%i, render-time world pose === reduced-motion tween target',
    (seatCount) => {
      const handId = 10;
      const rig = buildRig(seatCount);
      for (let s = 0; s < seatCount; s++) {
        rig.mountHoleCard(handId, s, 0);
        rig.mountHoleCard(handId, s, 1);
      }

      // Snapshot mount-time (render-pose) world positions before any tween
      // runs. These are the exact poses <PokerTable> would render a hole
      // card at if no animation were in flight.
      const renderPose = new Map<string, [number, number, number]>();
      for (let s = 0; s < seatCount; s++) {
        for (const slot of [0, 1] as const) {
          const key = `hole:${handId}:${s}:${slot}`;
          renderPose.set(key, worldPosition(
            rig.registry.current.get(key)! as THREE.Group,
          ));
        }
      }

      // Reduced-motion: tween snaps to target on construction, so after
      // sync the world pose must equal the tween target — which must in
      // turn equal the render-time pose we just captured.
      const c = makeController(rig, /* reducedMotion */ true);
      const layout = buildPokerTableDealLayout(seatCount);
      c.sync(null, layout);
      c.sync(
        makeState({
          handId,
          phase: 'preflop',
          streetIndex: 0,
          dealerSeat: 0,
          seats: Array.from({ length: seatCount }, (_, i) => makeSeat(i)),
        }),
        layout,
      );

      for (let s = 0; s < seatCount; s++) {
        for (const slot of [0, 1] as const) {
          const key = `hole:${handId}:${s}:${slot}`;
          const after = worldPosition(
            rig.registry.current.get(key)! as THREE.Group,
          );
          const before = renderPose.get(key)!;
          // Exact equality (modulo IEEE-754 rounding): the tween target
          // must match the render pose to the full precision of the
          // shared helper. If this test fails with small but non-trivial
          // deltas, seatAnchorLocalToWorld and the scene graph have
          // drifted apart.
          expect(after[0]).toBeCloseTo(before[0], 10);
          expect(after[1]).toBeCloseTo(before[1], 10);
          expect(after[2]).toBeCloseTo(before[2], 10);
          // And absolute Y must include SEAT_PAD_THICKNESS (guards
          // against a regression where the helper drops the pad lift).
          expect(after[1]).toBeGreaterThan(0.03);
        }
      }
    },
  );
});

// ---------------------------------------------------------------------------
// Cycle 13 H-2 — same-hand transitions preserve in-flight hole tweens
// ---------------------------------------------------------------------------

describe('DealAnimationDriver (integration) — H-2 same-hand preserves hole tweens', () => {
  it('mid-flight hole deal survives preflop→flop and still lands on target', () => {
    const seatCount = 4;
    const handId = 42;
    const rig = buildRig(seatCount);
    const layout = buildPokerTableDealLayout(seatCount);
    const c = makeController(rig, false);

    // Mount hole-card refs up front; mount community refs before flop sync.
    for (let s = 0; s < seatCount; s++) {
      rig.mountHoleCard(handId, s, 0);
      rig.mountHoleCard(handId, s, 1);
    }

    // Kick off preflop hole deal.
    c.sync(null, layout);
    c.sync(
      makeState({
        handId,
        phase: 'preflop',
        streetIndex: 0,
        dealerSeat: 0,
      }),
      layout,
    );
    // Advance to mid-flight (200ms into the ~640ms hole-deal sequence).
    c.tick(200);
    const midKeys = c.getActiveKeys();
    const holeKeys = Array.from(midKeys).filter((k) => k.startsWith('hole:'));
    expect(holeKeys.length).toBeGreaterThan(0);

    // Transition to flop *of the same hand*. Only community events emit —
    // hole keys are absent from the delta. Prior to the H-2 fix, every
    // still-flying hole tween was cancelled here, stranding the cards.
    rig.mountCommunityCard(handId, 0);
    rig.mountCommunityCard(handId, 1);
    rig.mountCommunityCard(handId, 2);
    c.sync(
      makeState({
        handId,
        phase: 'flop',
        streetIndex: 1,
        community: [card('Ah'), card('Kd'), card('2c'), null, null],
      }),
      layout,
    );

    // Hole tweens must still be active post-sync.
    const afterSync = c.getActiveKeys();
    for (const k of holeKeys) {
      expect(afterSync.has(k)).toBe(true);
    }

    // Drive to completion — hole cards must reach their correct world
    // target (depends on the H-1 fix for the target to actually match
    // the render pose).
    c.tick(DEAL_STREET_TOTAL_MS + 8 * DEAL_HOLE_STAGGER_MS + DEAL_CARD_DURATION_MS);
    expect(c.getActiveKeys().size).toBe(0);

    for (let s = 0; s < seatCount; s++) {
      for (const slot of [0, 1] as const) {
        const g = rig.registry.current.get(`hole:${handId}:${s}:${slot}`)! as THREE.Group;
        const wp = worldPosition(g);
        const target = holeTargetPosition(s, seatCount, slot);
        expect(wp[0]).toBeCloseTo(target[0], 6);
        expect(wp[1]).toBeCloseTo(target[1], 6);
        expect(wp[2]).toBeCloseTo(target[2], 6);
      }
    }
  });
});
