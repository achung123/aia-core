/** @vitest-environment happy-dom */
import { describe, it, expect, afterEach, beforeAll, afterAll, vi } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';

// ---------------------------------------------------------------------------
// R3F mocks — <Canvas> and `useFrame` are swapped for DOM-friendly shims so
// the marker driver can be exercised under happy-dom without a real WebGL
// context. `frameCallbacks` captures registered callbacks so tests can step
// the animation clock deterministically (mirrors CameraPresetController.test).
// ---------------------------------------------------------------------------
const frameCallbacks: Array<(state: unknown, dt: number) => void> = [];
vi.mock('@react-three/fiber', () => ({
  useFrame: (cb: (state: unknown, dt: number) => void) => {
    // Mirror real R3F: each render registers a *new* callback, superseding
    // the previous one. Without this, every setPositions-induced re-render
    // accumulates a duplicate frame tick and the tween elapses N× faster.
    frameCallbacks.length = 0;
    frameCallbacks.push(cb);
  },
  Canvas: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

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
afterAll(() => consoleErrorSpy.mockRestore());

import {
  TableMarkers,
  DEALER_BUTTON_ANIMATION_MS,
  dealerButtonLocalOffset,
  dealerButtonWorldPosition,
  smallBlindWorldPosition,
  bigBlindWorldPosition,
  MARKER_LOCAL_Z,
  MARKER_HEIGHT_Y,
  DEALER_BUTTON_LOCAL_X,
} from '../../src/scenes3d/components/DealerButton';
import {
  seatAnchorLocalToWorld,
  computeSeatPosition,
} from '../../src/scenes3d/components/tableLayout';
import type { SeatState, TableState } from '../../src/scenes3d/types';

afterEach(() => {
  cleanup();
  frameCallbacks.length = 0;
});

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
    seats: Array.from({ length: 6 }, (_, i) => makeSeat(i)),
    pot: 0,
    sidePots: [],
    dealerSeat: 0,
    sbSeat: 1,
    bbSeat: 2,
    currentSeat: null,
    ...overrides,
  };
}

/** Advance all registered `useFrame` callbacks by `totalMs`. */
function stepFrames(totalMs: number, stepMs = 16) {
  act(() => {
    let elapsed = 0;
    while (elapsed < totalMs) {
      const step = Math.min(stepMs, totalMs - elapsed);
      for (const cb of frameCallbacks) cb({}, step / 1000);
      elapsed += step;
    }
  });
}

/** Parse a `group[name=...]` position attribute serialized by happy-dom. */
function readPosition(el: Element): [number, number, number] {
  const raw = el.getAttribute('position');
  if (!raw) throw new Error(`missing position attribute on ${el.outerHTML}`);
  const parts = raw.split(',').map(Number);
  return [parts[0], parts[1], parts[2]];
}

function findMarker(container: HTMLElement, name: string): Element | null {
  return container.querySelector(`group[name="${name}"]`);
}

// ---------------------------------------------------------------------------
// Pure position helpers
// ---------------------------------------------------------------------------

describe('dealerButtonLocalOffset', () => {
  it('returns zero X offset when sbSeat is null', () => {
    const off = dealerButtonLocalOffset(0, null, 6);
    expect(off[0]).toBe(0);
    expect(off[1]).toBe(MARKER_HEIGHT_Y);
    expect(off[2]).toBe(MARKER_LOCAL_Z);
  });

  it('offsets toward +X when SB is the next CCW seat (sb == dealer+1)', () => {
    const off = dealerButtonLocalOffset(0, 1, 6);
    expect(off[0]).toBe(DEALER_BUTTON_LOCAL_X);
  });

  it('offsets toward -X when SB is the next CW seat (sb == dealer-1)', () => {
    const off = dealerButtonLocalOffset(2, 1, 6);
    expect(off[0]).toBe(-DEALER_BUTTON_LOCAL_X);
  });

  it('offsets toward +X (default) when SB is non-adjacent', () => {
    const off = dealerButtonLocalOffset(0, 3, 6);
    expect(Math.abs(off[0])).toBe(DEALER_BUTTON_LOCAL_X);
  });
});

describe('world-position helpers', () => {
  it('dealerButtonWorldPosition returns null when dealerSeat is null', () => {
    expect(dealerButtonWorldPosition(makeState({ dealerSeat: null }), 6)).toBeNull();
  });

  it('smallBlindWorldPosition returns null when sbSeat is null', () => {
    expect(smallBlindWorldPosition(makeState({ sbSeat: null }), 6)).toBeNull();
  });

  it('bigBlindWorldPosition returns null when bbSeat is null', () => {
    expect(bigBlindWorldPosition(makeState({ bbSeat: null }), 6)).toBeNull();
  });

  it('SB marker sits at seat-local (0, MARKER_HEIGHT_Y, MARKER_LOCAL_Z) in world', () => {
    const state = makeState({ sbSeat: 3 });
    const pos = smallBlindWorldPosition(state, 6)!;
    const expected = seatAnchorLocalToWorld(3, 6, [0, MARKER_HEIGHT_Y, MARKER_LOCAL_Z]);
    expect(pos[0]).toBeCloseTo(expected[0], 6);
    expect(pos[1]).toBeCloseTo(expected[1], 6);
    expect(pos[2]).toBeCloseTo(expected[2], 6);
  });

  it('BB marker similarly sits at the seat anchor local offset in world', () => {
    const state = makeState({ bbSeat: 4 });
    const pos = bigBlindWorldPosition(state, 6)!;
    const expected = seatAnchorLocalToWorld(4, 6, [0, MARKER_HEIGHT_Y, MARKER_LOCAL_Z]);
    expect(pos).toEqual(expected);
  });

  it('AC 4: dealer button is closer to SB seat than the bare dealer seat center', () => {
    const seatCount = 6;
    const state = makeState({ dealerSeat: 0, sbSeat: 1 });
    const button = dealerButtonWorldPosition(state, seatCount)!;
    const dealerPos = computeSeatPosition(0, seatCount);
    const sbPos = computeSeatPosition(1, seatCount);
    const dist = (a: number[], b: number[]) =>
      Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    // The button sits between dealer and SB — and by offsetting toward SB
    // it must be closer to SB than the bare dealer-seat center is.
    expect(dist(button, sbPos)).toBeLessThan(dist(dealerPos, sbPos));
  });
});

// ---------------------------------------------------------------------------
// <TableMarkers> rendering + animation
// ---------------------------------------------------------------------------

describe('<TableMarkers>', () => {
  it('mounts without throwing', () => {
    expect(() =>
      render(<TableMarkers state={makeState()} seatCount={6} />),
    ).not.toThrow();
  });

  it('AC 1: renders dealer, SB, and BB markers at the correct world positions', () => {
    const state = makeState({ dealerSeat: 0, sbSeat: 1, bbSeat: 2 });
    const { container } = render(<TableMarkers state={state} seatCount={6} />);

    const dealerEl = findMarker(container, 'dealer-button')!;
    const sbEl = findMarker(container, 'small-blind-marker')!;
    const bbEl = findMarker(container, 'big-blind-marker')!;

    const expectedDealer = dealerButtonWorldPosition(state, 6)!;
    const expectedSb = smallBlindWorldPosition(state, 6)!;
    const expectedBb = bigBlindWorldPosition(state, 6)!;

    const dealerPos = readPosition(dealerEl);
    expect(dealerPos[0]).toBeCloseTo(expectedDealer[0], 6);
    expect(dealerPos[1]).toBeCloseTo(expectedDealer[1], 6);
    expect(dealerPos[2]).toBeCloseTo(expectedDealer[2], 6);
    expect(readPosition(sbEl)).toEqual(expectedSb);
    expect(readPosition(bbEl)).toEqual(expectedBb);
  });

  it('renders a marker group for each kind named `dealer-button`, `small-blind-marker`, `big-blind-marker`', () => {
    const { container } = render(<TableMarkers state={makeState()} seatCount={6} />);
    expect(findMarker(container, 'dealer-button')).not.toBeNull();
    expect(findMarker(container, 'small-blind-marker')).not.toBeNull();
    expect(findMarker(container, 'big-blind-marker')).not.toBeNull();
  });

  it('AC 3: does not render the SB marker when sbSeat is null', () => {
    const { container } = render(
      <TableMarkers state={makeState({ sbSeat: null })} seatCount={6} />,
    );
    expect(findMarker(container, 'small-blind-marker')).toBeNull();
    expect(findMarker(container, 'big-blind-marker')).not.toBeNull();
    expect(findMarker(container, 'dealer-button')).not.toBeNull();
  });

  it('AC 3: does not render the BB marker when bbSeat is null', () => {
    const { container } = render(
      <TableMarkers state={makeState({ bbSeat: null })} seatCount={6} />,
    );
    expect(findMarker(container, 'big-blind-marker')).toBeNull();
    expect(findMarker(container, 'small-blind-marker')).not.toBeNull();
    expect(findMarker(container, 'dealer-button')).not.toBeNull();
  });

  it('does not render the dealer button when dealerSeat is null', () => {
    const { container } = render(
      <TableMarkers state={makeState({ dealerSeat: null })} seatCount={6} />,
    );
    expect(findMarker(container, 'dealer-button')).toBeNull();
  });

  it('registers a useFrame callback on mount for the animation driver', () => {
    render(<TableMarkers state={makeState()} seatCount={6} />);
    expect(frameCallbacks.length).toBeGreaterThanOrEqual(1);
    // Safe to tick immediately (no in-flight tweens yet).
    expect(() => frameCallbacks[0]({}, 0.016)).not.toThrow();
  });

  // -------------------------------------------------------------------------
  // AC 2 — dealer rotation animates between seats over ~600ms
  // -------------------------------------------------------------------------

  it('AC 2: dealer rotation animates the button toward the new seat over ~600ms', () => {
    const seatCount = 6;
    const s1 = makeState({ handId: 10, dealerSeat: 0, sbSeat: 1, bbSeat: 2 });
    const s2 = makeState({
      handId: 11,
      handNumber: 2,
      dealerSeat: 1,
      sbSeat: 2,
      bbSeat: 3,
    });
    const { container, rerender } = render(
      <TableMarkers state={s1} seatCount={seatCount} />,
    );
    const startPos = readPosition(findMarker(container, 'dealer-button')!);
    const expectedStart = dealerButtonWorldPosition(s1, seatCount)!;
    expect(startPos[0]).toBeCloseTo(expectedStart[0], 6);

    rerender(<TableMarkers state={s2} seatCount={seatCount} />);

    // Immediately after rerender, animation has not advanced — position
    // should still equal the start value (tween.from) or be very close.
    const justAfter = readPosition(findMarker(container, 'dealer-button')!);
    expect(justAfter[0]).toBeCloseTo(startPos[0], 4);

    // Step halfway through the tween — position should be between the two
    // endpoints.
    stepFrames(DEALER_BUTTON_ANIMATION_MS / 2);
    const mid = readPosition(findMarker(container, 'dealer-button')!);
    const expectedEnd = dealerButtonWorldPosition(s2, seatCount)!;
    expect(mid).not.toEqual(startPos);
    expect(mid).not.toEqual(expectedEnd);

    // Finish the tween.
    stepFrames(DEALER_BUTTON_ANIMATION_MS);
    const end = readPosition(findMarker(container, 'dealer-button')!);
    expect(end[0]).toBeCloseTo(expectedEnd[0], 4);
    expect(end[1]).toBeCloseTo(expectedEnd[1], 4);
    expect(end[2]).toBeCloseTo(expectedEnd[2], 4);
  });

  it('AC 2: SB and BB markers also animate when they rotate', () => {
    const seatCount = 6;
    const s1 = makeState({ handId: 10, dealerSeat: 0, sbSeat: 1, bbSeat: 2 });
    const s2 = makeState({
      handId: 11,
      handNumber: 2,
      dealerSeat: 1,
      sbSeat: 2,
      bbSeat: 3,
    });
    const { container, rerender } = render(
      <TableMarkers state={s1} seatCount={seatCount} />,
    );
    const startSb = readPosition(findMarker(container, 'small-blind-marker')!);
    const startBb = readPosition(findMarker(container, 'big-blind-marker')!);

    rerender(<TableMarkers state={s2} seatCount={seatCount} />);
    stepFrames(DEALER_BUTTON_ANIMATION_MS);

    const endSb = readPosition(findMarker(container, 'small-blind-marker')!);
    const endBb = readPosition(findMarker(container, 'big-blind-marker')!);
    const expSb = smallBlindWorldPosition(s2, seatCount)!;
    const expBb = bigBlindWorldPosition(s2, seatCount)!;
    expect(endSb[0]).toBeCloseTo(expSb[0], 4);
    expect(endSb[2]).toBeCloseTo(expSb[2], 4);
    expect(endBb[0]).toBeCloseTo(expBb[0], 4);
    expect(endBb[2]).toBeCloseTo(expBb[2], 4);
    // And they did move (start != end).
    expect(endSb).not.toEqual(startSb);
    expect(endBb).not.toEqual(startBb);
  });

  it('re-renders with identical dealer/sb/bb state do not restart an animation', () => {
    const s1 = makeState({ dealerSeat: 0, sbSeat: 1, bbSeat: 2, pot: 0 });
    const s2 = makeState({ dealerSeat: 0, sbSeat: 1, bbSeat: 2, pot: 5 });
    const { container, rerender } = render(
      <TableMarkers state={s1} seatCount={6} />,
    );
    const before = readPosition(findMarker(container, 'dealer-button')!);
    rerender(<TableMarkers state={s2} seatCount={6} />);
    stepFrames(DEALER_BUTTON_ANIMATION_MS / 2);
    const after = readPosition(findMarker(container, 'dealer-button')!);
    // Unchanged — no tween spawned, so the button stays put.
    expect(after[0]).toBeCloseTo(before[0], 6);
    expect(after[2]).toBeCloseTo(before[2], 6);
  });

  it('marker group identity is stable across hand transitions (no remount)', () => {
    const s1 = makeState({ handId: 10, dealerSeat: 0, sbSeat: 1, bbSeat: 2 });
    const s2 = makeState({
      handId: 11,
      handNumber: 2,
      dealerSeat: 1,
      sbSeat: 2,
      bbSeat: 3,
    });
    const { container, rerender } = render(
      <TableMarkers state={s1} seatCount={6} />,
    );
    const before = findMarker(container, 'dealer-button');
    rerender(<TableMarkers state={s2} seatCount={6} />);
    const after = findMarker(container, 'dealer-button');
    // Same DOM node — React reused the group rather than unmount/remount.
    expect(after).toBe(before);
  });

  // -------------------------------------------------------------------------
  // Reduced motion — instant jump on transition
  // -------------------------------------------------------------------------

  it('snaps instantly to the new seat when prefers-reduced-motion is set', () => {
    // Stub matchMedia to report reduced motion.
    const orig = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;

    try {
      const seatCount = 6;
      const s1 = makeState({ handId: 10, dealerSeat: 0, sbSeat: 1, bbSeat: 2 });
      const s2 = makeState({
        handId: 11,
        handNumber: 2,
        dealerSeat: 1,
        sbSeat: 2,
        bbSeat: 3,
      });
      const { container, rerender } = render(
        <TableMarkers state={s1} seatCount={seatCount} />,
      );
      rerender(<TableMarkers state={s2} seatCount={seatCount} />);

      // No frames stepped — position must already equal the new target.
      const dealer = readPosition(findMarker(container, 'dealer-button')!);
      const expected = dealerButtonWorldPosition(s2, seatCount)!;
      expect(dealer[0]).toBeCloseTo(expected[0], 4);
      expect(dealer[2]).toBeCloseTo(expected[2], 4);
    } finally {
      window.matchMedia = orig;
    }
  });

  it('snaps instantly on first mount (no implicit entry tween)', () => {
    const state = makeState({ dealerSeat: 2, sbSeat: 3, bbSeat: 4 });
    const { container } = render(<TableMarkers state={state} seatCount={6} />);
    // No frames stepped — initial position matches target exactly.
    const dealer = readPosition(findMarker(container, 'dealer-button')!);
    const expected = dealerButtonWorldPosition(state, 6)!;
    expect(dealer).toEqual(expected);
  });

  it('snaps instantly when a previously-hidden marker appears', () => {
    const seatCount = 6;
    const s1 = makeState({ sbSeat: null });
    const s2 = makeState({ sbSeat: 3 });
    const { container, rerender } = render(
      <TableMarkers state={s1} seatCount={seatCount} />,
    );
    expect(findMarker(container, 'small-blind-marker')).toBeNull();
    rerender(<TableMarkers state={s2} seatCount={seatCount} />);
    // Appears at target with no animation — there's no "from" position.
    const sb = findMarker(container, 'small-blind-marker')!;
    const expected = smallBlindWorldPosition(s2, seatCount)!;
    expect(readPosition(sb)).toEqual(expected);
  });
});
