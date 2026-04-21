/** @vitest-environment happy-dom */
/**
 * Integration tests — `<PotSweepDriver>` wiring through the
 * `<PokerTable>` scene graph (T-012).
 *
 * Mirrors the observable shape of the existing chip-slide integration
 * tests: inspects the `<ChipInstances>` stack registry (via
 * `__getTestProbe`) to assert on per-stack amount and position without
 * requiring a WebGL-backed renderer. Advances animation time by driving
 * the R3F `useFrame` callbacks collected during render (same pattern as
 * `PokerTable.test.tsx`'s `driveAllFramesToCompletion`).
 *
 * Covers the four T-012 acceptance criteria plus:
 *   - Reduced-motion: sweep settles on the first rerender.
 *   - Chip-slide → pot-sweep coordination edge (bet mid-flight into
 *     showdown): no phantom seat or slug stacks.
 */
import { describe, it, expect, afterEach, beforeAll, afterAll, vi } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';

const R3F_TAG_WARNING =
  /is using incorrect casing|is unrecognized in this browser|React does not recognize the|Unknown event handler|Received .* for a non-boolean attribute/;
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
beforeAll(() => {
  consoleErrorSpy = vi
    .spyOn(console, 'error')
    .mockImplementation((msg: unknown, ...rest: unknown[]) => {
      if (typeof msg === 'string' && R3F_TAG_WARNING.test(msg)) return;
      console.warn('[unexpected console.error]', msg, ...rest);
    });
});
afterAll(() => {
  consoleErrorSpy.mockRestore();
});

// Mock drei so <CameraRig> mounts without an R3F context.
vi.mock('@react-three/drei', () => ({
  Environment: (props: Record<string, unknown>) => (
    <div
      data-testid="mock-environment"
      data-preset={String(props.preset ?? '')}
      data-resolution={String(props.resolution ?? '')}
      data-background={String(props.background ?? '')}
    />
  ),

  OrbitControls: () => <div data-testid="mock-orbit-controls" />,
  PerspectiveCamera: () => <div data-testid="mock-perspective-camera" />,
  Text: (props: Record<string, unknown> & { children?: unknown }) => {
    const name = typeof props.name === 'string' ? props.name : 'drei-text';
    return <div data-testid={name} data-text={String(props.children ?? '')} />;
  },
}));

// Mock R3F so useFrame doesn't require a <Canvas>.
const frameCallbacks: Array<(state: unknown, dt: number) => void> = [];
vi.mock('@react-three/fiber', () => ({
  useFrame: (cb: (state: unknown, dt: number) => void) => {
    frameCallbacks.push(cb);
  },
  Canvas: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

import { PokerTable } from '../../src/scenes3d/PokerTable';
import type {
  SeatState,
  TableState,
} from '../../src/scenes3d/types';
import { __getTestProbe } from '../../src/scenes3d/components/ChipInstances';
import {
  POT_CHIP_WORLD_POSITION,
  seatCommitChipWorldPosition,
} from '../../src/scenes3d/components/tableLayout';
import { REDUCED_MOTION_QUERY } from '../../src/scenes3d/state/useReducedMotion';

const originalMatchMedia = window.matchMedia;

function installReducedMotion(enabled: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (q: string) => ({
      matches: q === REDUCED_MOTION_QUERY ? enabled : false,
      media: q,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => true,
    }),
  });
}
function restoreMatchMedia() {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: originalMatchMedia,
  });
}

afterEach(() => {
  cleanup();
  __getTestProbe().reset();
  frameCallbacks.length = 0;
  restoreMatchMedia();
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SEAT_COUNT = 6;

function makeSeat(
  seatIndex: number,
  overrides: Partial<SeatState> = {},
): SeatState {
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
    seats: Array.from({ length: SEAT_COUNT }, (_, i) => makeSeat(i)),
    pot: 0,
    sidePots: [],
    dealerSeat: null,
    sbSeat: null,
    bbSeat: null,
    currentSeat: null,
    ...overrides,
  };
}

function findStackNear(
  stacks: Array<{ id: string; amount: number; position: [number, number, number] }>,
  target: [number, number, number],
  eps = 1e-6,
) {
  return stacks.find(
    (s) =>
      Math.abs(s.position[0] - target[0]) < eps &&
      Math.abs(s.position[1] - target[1]) < eps &&
      Math.abs(s.position[2] - target[2]) < eps,
  );
}

function driveAllFramesToCompletion() {
  // 800ms > POT_SWEEP_DURATION_MS (600) and > CHIP_SLIDE_DURATION_MS (400).
  act(() => {
    for (const cb of [...frameCallbacks]) {
      cb({}, 0.8);
    }
  });
}

// ---------------------------------------------------------------------------
// AC 1 — single winner
// ---------------------------------------------------------------------------

describe('<PokerTable> — pot sweep integration (T-012)', () => {
  it('AC 1: single winner — pot chips fly to winner, pot drains to 0', () => {
    // Start pre-showdown with a pot.
    const s0 = makeState({
      phase: 'river',
      streetIndex: 3,
      pot: 50,
    });
    const { rerender } = render(<PokerTable state={s0} />);

    // Confirm the pot stack is present at start.
    const startStacks = __getTestProbe().getStacks();
    expect(findStackNear(startStacks, POT_CHIP_WORLD_POSITION)!.amount).toBe(50);

    // Showdown: seat 2 wins the whole pot.
    const s1 = makeState({
      phase: 'showdown',
      streetIndex: 4,
      pot: 50,
      seats: [
        makeSeat(0, { result: 'lost', profitLoss: -10 }),
        makeSeat(1, { result: 'lost', profitLoss: -10 }),
        makeSeat(2, { result: 'won', profitLoss: 30, stack: 130 }),
        makeSeat(3, { result: 'folded' }),
        makeSeat(4, { result: 'folded' }),
        makeSeat(5, { result: 'folded' }),
      ],
    });
    rerender(<PokerTable state={s1} />);

    // Mid-flight: the pot stack has shrunk to 0 (50 - 50 in-flight),
    // and a flying slug carrying 50 is registered at the pot origin.
    const mid = __getTestProbe().getStacks();
    // The pot cluster position now hosts the flying slug (amount 50),
    // not the pot stack itself (which is at amount 0 and hidden).
    const potPositioned = mid.filter(
      (s) =>
        Math.abs(s.position[0] - POT_CHIP_WORLD_POSITION[0]) < 1e-6 &&
        Math.abs(s.position[1] - POT_CHIP_WORLD_POSITION[1]) < 1e-6 &&
        Math.abs(s.position[2] - POT_CHIP_WORLD_POSITION[2]) < 1e-6,
    );
    expect(potPositioned).toHaveLength(1);
    expect(potPositioned[0].amount).toBe(50);

    driveAllFramesToCompletion();

    const end = __getTestProbe().getStacks();
    // After sweep: pot cluster drained, slug gone, no seat stacks.
    expect(findStackNear(end, POT_CHIP_WORLD_POSITION)).toBeUndefined();
    expect(end).toHaveLength(0);
  });

  // -------------------------------------------------------------------
  // AC 2 — split pot
  // -------------------------------------------------------------------
  it('AC 2: split pot — two slugs with proportional amounts, pot drains', () => {
    const s0 = makeState({
      phase: 'river',
      streetIndex: 3,
      pot: 120,
    });
    const { rerender } = render(<PokerTable state={s0} />);

    const s1 = makeState({
      phase: 'showdown',
      streetIndex: 4,
      pot: 120,
      seats: [
        makeSeat(0, { result: 'won', profitLoss: 60 }),
        makeSeat(1, { result: 'won', profitLoss: 30 }),
        makeSeat(2, { result: 'lost', profitLoss: -45 }),
        makeSeat(3, { result: 'lost', profitLoss: -45 }),
        makeSeat(4, { result: 'folded' }),
        makeSeat(5, { result: 'folded' }),
      ],
    });
    rerender(<PokerTable state={s1} />);

    // Mid-flight: two slugs both at the pot origin (amounts 80 and 40).
    const mid = __getTestProbe().getStacks();
    const potPositioned = mid.filter(
      (s) =>
        Math.abs(s.position[0] - POT_CHIP_WORLD_POSITION[0]) < 1e-6 &&
        Math.abs(s.position[1] - POT_CHIP_WORLD_POSITION[1]) < 1e-6 &&
        Math.abs(s.position[2] - POT_CHIP_WORLD_POSITION[2]) < 1e-6,
    );
    // One of the co-located stacks is the hidden pot stack (amount 0,
    // which does not render because display <= 0 is filtered). So we
    // expect exactly 2 visible stacks at pot origin — the two slugs.
    expect(potPositioned).toHaveLength(2);
    const amounts = potPositioned.map((s) => s.amount).sort((a, b) => a - b);
    expect(amounts[0]).toBeCloseTo(40, 6);
    expect(amounts[1]).toBeCloseTo(80, 6);

    driveAllFramesToCompletion();

    const end = __getTestProbe().getStacks();
    // AC 3 — pot settles at 0.
    expect(findStackNear(end, POT_CHIP_WORLD_POSITION)).toBeUndefined();
  });

  // -------------------------------------------------------------------
  // AC 4 — all-fold resolution
  // -------------------------------------------------------------------
  it('AC 4: all-fold — pot sweeps to sole active (non-folded) seat', () => {
    const s0 = makeState({
      phase: 'preflop',
      streetIndex: 0,
      pot: 30,
    });
    const { rerender } = render(<PokerTable state={s0} />);

    // Seat 1 wins by fold — all others fold, pot awarded without showdown.
    const s1 = makeState({
      phase: 'preflop',
      streetIndex: 0,
      pot: 30,
      seats: [
        makeSeat(0, { result: 'folded' }),
        makeSeat(1, { result: 'won', profitLoss: 15 }),
        makeSeat(2, { result: 'folded' }),
        makeSeat(3, { result: 'folded' }),
        makeSeat(4, { result: 'folded' }),
        makeSeat(5, { result: 'folded' }),
      ],
    });
    rerender(<PokerTable state={s1} />);

    // Exactly one sweep slug was registered.
    const mid = __getTestProbe().getStacks();
    const potPositioned = mid.filter(
      (s) =>
        Math.abs(s.position[0] - POT_CHIP_WORLD_POSITION[0]) < 1e-6 &&
        Math.abs(s.position[1] - POT_CHIP_WORLD_POSITION[1]) < 1e-6 &&
        Math.abs(s.position[2] - POT_CHIP_WORLD_POSITION[2]) < 1e-6,
    );
    expect(potPositioned).toHaveLength(1);
    expect(potPositioned[0].amount).toBe(30);

    driveAllFramesToCompletion();

    const end = __getTestProbe().getStacks();
    expect(end).toHaveLength(0);
  });

  // -------------------------------------------------------------------
  // Reduced motion — AC 3 via instant settle
  // -------------------------------------------------------------------
  it('reduced motion: pot drains to 0 on the first rerender (no tween)', () => {
    installReducedMotion(true);
    const s0 = makeState({ phase: 'river', streetIndex: 3, pot: 50 });
    const { rerender } = render(<PokerTable state={s0} />);

    const s1 = makeState({
      phase: 'showdown',
      streetIndex: 4,
      pot: 50,
      seats: [
        makeSeat(0, { result: 'won', profitLoss: 30 }),
        makeSeat(1, { result: 'lost' }),
        makeSeat(2, { result: 'lost' }),
        makeSeat(3, { result: 'folded' }),
        makeSeat(4, { result: 'folded' }),
        makeSeat(5, { result: 'folded' }),
      ],
    });
    rerender(<PokerTable state={s1} />);

    // No frames driven — under reduced motion the pot must already be 0.
    const stacks = __getTestProbe().getStacks();
    expect(findStackNear(stacks, POT_CHIP_WORLD_POSITION)).toBeUndefined();
    // And no flying slug should linger.
    expect(stacks).toHaveLength(0);
  });

  // -------------------------------------------------------------------
  // Driver mount — useFrame count increases
  // -------------------------------------------------------------------
  it('mounts <PotSweepDriver> which registers its own useFrame callback', () => {
    render(<PokerTable state={makeState()} />);
    // DealAnimationDriver + ChipSlideDriver + PotSweepDriver.
    expect(frameCallbacks.length).toBeGreaterThanOrEqual(3);
  });

  // -------------------------------------------------------------------
  // Coordination with T-011 — chip-slide finishes at river, then
  // showdown arrives with winner. No phantom seat/slug stacks leak.
  // -------------------------------------------------------------------
  it('chip-slide at river → showdown sweep: no phantom stacks remain', () => {
    // Prime.
    const s0 = makeState({ phase: 'river', streetIndex: 3, pot: 40 });
    const { rerender } = render(<PokerTable state={s0} />);

    // River bet: seat 0 commits $10.
    const betting = makeState({
      phase: 'river',
      streetIndex: 3,
      pot: 40,
      seats: [
        makeSeat(0, { committedThisStreet: 10 }),
        ...Array.from({ length: SEAT_COUNT - 1 }, (_, i) => makeSeat(i + 1)),
      ],
    });
    rerender(<PokerTable state={betting} />);
    // In-flight chip slide is live.
    expect(__getTestProbe().getStacks().length).toBeGreaterThanOrEqual(2);

    // Transition straight to showdown (scope change cancels chip-slide
    // in-flight, backend has folded committed into the new pot=50).
    const show = makeState({
      phase: 'showdown',
      streetIndex: 4,
      pot: 50,
      seats: [
        makeSeat(0, { result: 'won', profitLoss: 30 }),
        makeSeat(1, { result: 'lost' }),
        makeSeat(2, { result: 'lost' }),
        makeSeat(3, { result: 'folded' }),
        makeSeat(4, { result: 'folded' }),
        makeSeat(5, { result: 'folded' }),
      ],
    });
    rerender(<PokerTable state={show} />);

    driveAllFramesToCompletion();

    const end = __getTestProbe().getStacks();
    // Pot is fully swept; no chip-slide leftovers at seat positions.
    for (const s of end) {
      // None of the seat committed-chip positions should host a stack.
      for (let i = 0; i < SEAT_COUNT; i++) {
        const seatPos = seatCommitChipWorldPosition(i, SEAT_COUNT);
        const atSeat =
          Math.abs(s.position[0] - seatPos[0]) < 1e-6 &&
          Math.abs(s.position[1] - seatPos[1]) < 1e-6 &&
          Math.abs(s.position[2] - seatPos[2]) < 1e-6;
        expect(atSeat).toBe(false);
      }
      // Amounts are non-negative.
      expect(s.amount).toBeGreaterThanOrEqual(0);
    }
    // Pot cluster drained.
    expect(findStackNear(end, POT_CHIP_WORLD_POSITION)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// H-2 regression (aia-core-xc33) — no full-pot flash on the first commit
// carrying the winner state.
// ---------------------------------------------------------------------------
//
// Before the fix, PokerTable's `potDisplay` was computed from a live
// controller-ref read. On the first render carrying `result === 'won'`,
// <PotSweepDriver>'s sync effect had not yet fired → in-flight outflow
// was 0 → potDisplay === state.pot. A second render (triggered by the
// effect's setActiveSweeps) then collapsed potDisplay to 0. The user
// saw a one-frame flash of the full pot ChipStack at POT_CHIP_WORLD_POSITION.
//
// After the fix, the very first commit carrying the winner state must
// already have potDisplay reflect the outflow — i.e. no plain pot-stack
// (non-slug) ChipStack at pot origin with amount === pre-sweep pot.
//
// We use React's Profiler to capture the stacks registry at every
// commit, then assert the invariant.

import { Profiler } from 'react';

describe('<PokerTable> — H-2 regression (aia-core-xc33) no full-pot flash', () => {
  it('first commit post-winner-state has no full-pot stack at pot origin', () => {
    type Snapshot = Array<{
      id: string;
      amount: number;
      position: [number, number, number];
    }>;
    const commits: Snapshot[] = [];
    const onRender = () => {
      commits.push(__getTestProbe().getStacks());
    };

    const s0 = makeState({ phase: 'river', streetIndex: 3, pot: 50 });
    const { rerender } = render(
      <Profiler id="pot-sweep-flash" onRender={onRender}>
        <PokerTable state={s0} />
      </Profiler>,
    );

    // Baseline commits: pot stack at origin with amount=50.
    const baseline = commits[commits.length - 1];
    const baselinePotStack = findStackNear(baseline, POT_CHIP_WORLD_POSITION);
    expect(baselinePotStack?.amount).toBe(50);
    // Snapshot the pot stack's stable id so we can assert it's torn
    // down (or its amount is not 50) on any post-transition commit.
    const potStackIdBefore = baselinePotStack!.id;

    const commitsBefore = commits.length;

    const s1 = makeState({
      phase: 'showdown',
      streetIndex: 4,
      pot: 50,
      seats: [
        makeSeat(0, { result: 'lost', profitLoss: -10 }),
        makeSeat(1, { result: 'lost', profitLoss: -10 }),
        makeSeat(2, { result: 'won', profitLoss: 30, stack: 130 }),
        makeSeat(3, { result: 'folded' }),
        makeSeat(4, { result: 'folded' }),
        makeSeat(5, { result: 'folded' }),
      ],
    });
    rerender(
      <Profiler id="pot-sweep-flash" onRender={onRender}>
        <PokerTable state={s1} />
      </Profiler>,
    );

    // There must be at least one post-transition commit.
    const postCommits = commits.slice(commitsBefore);
    expect(postCommits.length).toBeGreaterThan(0);

    // Invariant: on every committed frame after the winner state is
    // applied, the pre-sweep pot ChipStack must never render at its
    // pre-sweep amount. Either:
    //   (a) the pot stack has unmounted (its stable id is gone), or
    //   (b) its amount is 0 (potDisplay computation already reflected
    //       the outflow on this same commit).
    // A slug ChipStack may appear at the pot origin — that has a
    // different stable id from the pot stack and is allowed.
    for (const [idx, snap] of postCommits.entries()) {
      const potStackStill = snap.find((s) => s.id === potStackIdBefore);
      if (potStackStill) {
        expect(
          potStackStill.amount,
          `commit #${idx} after winner state: pot stack (id=${potStackIdBefore}) still registered at amount=${potStackStill.amount}; expected unmounted or 0 — this is the H-2 flash.`,
        ).toBe(0);
      }
    }
  });
});
