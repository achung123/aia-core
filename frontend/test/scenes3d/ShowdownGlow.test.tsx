/** @vitest-environment happy-dom */
//
// T-013 — Showdown reveal + winning-hand glow outline.
//
// Covers the four ACs of the showdown-glow surface (plan.md § Animation
// Primitives — "Showdown glow: 3s fade-in/hold/fade-out, triggered
// phase→showdown"):
//
//   AC 1 — Folded opponent cards stay face-down at showdown.
//          (Covered upstream by <PokerTable>'s `renderHole = isActive &&
//          !folded` gate + `canSee()`; asserted at scene level in
//          PokerTable.showdownGlow.test.tsx.)
//   AC 2 — Winning seat's cards render a theme-coloured outline mesh;
//          each non-folded winner also gets a seat ring (covers the
//          all-fold / mucked case where the winner has no revealed
//          holeCards).
//   AC 3 — Glow clears automatically after SHOWDOWN_GLOW_DURATION_MS
//          (3000ms) OR on the next street/hand (phase change away from
//          'showdown', or handId change).
//   AC 4 — Spectator policy reveals non-folded opponents at showdown
//          (already enforced by `canSee()`; re-asserted at scene level
//          in the integration file).
//
// Plus a reduced-motion assertion: under prefers-reduced-motion: reduce,
// the glow skips the fade-in / fade-out envelope and renders at the
// constant peak opacity for the 3s window.

import {
  describe,
  it,
  expect,
  afterEach,
  beforeAll,
  afterAll,
  vi,
} from 'vitest';
import { render, cleanup, act } from '@testing-library/react';

// ---------------------------------------------------------------------------
// R3F mock — mirrors SeatHighlight.test.tsx.
// ---------------------------------------------------------------------------
const frameCallbacks: Array<(state: unknown, dt: number) => void> = [];
vi.mock('@react-three/fiber', () => ({
  useFrame: (cb: (state: unknown, dt: number) => void) => {
    frameCallbacks.length = 0;
    frameCallbacks.push(cb);
  },
  Canvas: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@react-three/drei', () => ({
  Text: (props: Record<string, unknown> & { children?: unknown }) => {
    const name = typeof props.name === 'string' ? props.name : 'drei-text';
    return <div data-testid={name} data-text={String(props.children ?? '')} />;
  },
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
  ShowdownGlows,
  winningSeatIndices,
  showdownGlowOpacity,
  SHOWDOWN_GLOW_DURATION_MS,
  SHOWDOWN_GLOW_FADE_IN_MS,
  SHOWDOWN_GLOW_FADE_OUT_MS,
  SHOWDOWN_GLOW_MAX_OPACITY,
  SHOWDOWN_GLOW_COLOR,
} from '../../src/scenes3d/components/SeatHighlight';
import type {
  SeatState,
  TableState,
  CardRef,
} from '../../src/scenes3d/types';
import { REDUCED_MOTION_QUERY } from '../../src/scenes3d/state/useReducedMotion';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

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
  frameCallbacks.length = 0;
  restoreMatchMedia();
  vi.useRealTimers();
});

function card(id: string): CardRef {
  const suit = id.slice(-1).toLowerCase() as CardRef['suit'];
  return { rank: id.slice(0, -1), suit, id };
}

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

function readOpacity(el: Element | null): number {
  if (!el) throw new Error('readOpacity: null element');
  const raw = el.getAttribute('opacity');
  if (raw === null) throw new Error('readOpacity: missing opacity attr');
  return Number(raw);
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

describe('showdownGlowOpacity', () => {
  it('returns 0 at t=0', () => {
    expect(showdownGlowOpacity(0, false)).toBe(0);
  });
  it('returns 0 at or after duration', () => {
    expect(showdownGlowOpacity(SHOWDOWN_GLOW_DURATION_MS, false)).toBe(0);
    expect(showdownGlowOpacity(SHOWDOWN_GLOW_DURATION_MS + 500, false)).toBe(0);
  });
  it('ramps linearly during fade-in', () => {
    const half = SHOWDOWN_GLOW_FADE_IN_MS / 2;
    const v = showdownGlowOpacity(half, false);
    expect(v).toBeGreaterThan(0);
    expect(v).toBeLessThan(SHOWDOWN_GLOW_MAX_OPACITY);
    expect(v).toBeCloseTo(SHOWDOWN_GLOW_MAX_OPACITY / 2, 5);
  });
  it('sits at MAX_OPACITY during the hold plateau', () => {
    const mid = SHOWDOWN_GLOW_DURATION_MS / 2;
    expect(showdownGlowOpacity(mid, false)).toBeCloseTo(
      SHOWDOWN_GLOW_MAX_OPACITY,
      5,
    );
  });
  it('ramps back down during fade-out', () => {
    const fadeOutStart =
      SHOWDOWN_GLOW_DURATION_MS - SHOWDOWN_GLOW_FADE_OUT_MS;
    const half = fadeOutStart + SHOWDOWN_GLOW_FADE_OUT_MS / 2;
    const v = showdownGlowOpacity(half, false);
    expect(v).toBeGreaterThan(0);
    expect(v).toBeLessThan(SHOWDOWN_GLOW_MAX_OPACITY);
    expect(v).toBeCloseTo(SHOWDOWN_GLOW_MAX_OPACITY / 2, 5);
  });
  it('pins to MAX_OPACITY for the full window under reduced motion', () => {
    expect(showdownGlowOpacity(0, true)).toBe(SHOWDOWN_GLOW_MAX_OPACITY);
    expect(showdownGlowOpacity(1000, true)).toBe(SHOWDOWN_GLOW_MAX_OPACITY);
    expect(showdownGlowOpacity(2999, true)).toBe(SHOWDOWN_GLOW_MAX_OPACITY);
  });
  it('reduced motion still clears past duration', () => {
    expect(
      showdownGlowOpacity(SHOWDOWN_GLOW_DURATION_MS, true),
    ).toBe(0);
  });
});

describe('winningSeatIndices', () => {
  it('returns [] when phase !== showdown', () => {
    const s = makeState({
      phase: 'river',
      seats: [makeSeat(0, { result: 'won' }), makeSeat(1)],
    });
    expect(winningSeatIndices(s)).toEqual([]);
  });
  it('returns [] when no seat has result=won at showdown', () => {
    const s = makeState({
      phase: 'showdown',
      seats: [
        makeSeat(0, { result: 'lost' }),
        makeSeat(1, { result: 'folded' }),
      ],
    });
    expect(winningSeatIndices(s)).toEqual([]);
  });
  it('returns all winners at showdown (split pot)', () => {
    const s = makeState({
      phase: 'showdown',
      seats: [
        makeSeat(0, { result: 'won' }),
        makeSeat(1, { result: 'lost' }),
        makeSeat(2, { result: 'won' }),
        makeSeat(3, { result: 'folded' }),
      ],
    });
    expect(winningSeatIndices(s).sort()).toEqual([0, 2]);
  });
});

// ---------------------------------------------------------------------------
// <ShowdownGlows> composer
// ---------------------------------------------------------------------------

describe('<ShowdownGlows>', () => {
  it('renders nothing when phase !== showdown', () => {
    const s = makeState({
      phase: 'river',
      seats: [makeSeat(0, { result: 'won', holeCards: [card('Ah'), card('Kd')] })],
    });
    const { container } = render(<ShowdownGlows state={s} seatCount={6} />);
    expect(container.querySelector('group[name="showdown-glows"]')).not.toBeNull();
    expect(container.querySelectorAll('mesh[name="showdown-card-outline"]').length).toBe(0);
    expect(container.querySelectorAll('mesh[name="showdown-seat-ring"]').length).toBe(0);
  });

  it('renders nothing when no seat has result=won at showdown', () => {
    const s = makeState({ phase: 'showdown' });
    const { container } = render(<ShowdownGlows state={s} seatCount={6} />);
    expect(container.querySelectorAll('mesh[name="showdown-card-outline"]').length).toBe(0);
    expect(container.querySelectorAll('mesh[name="showdown-seat-ring"]').length).toBe(0);
  });

  it('renders 2 card outlines + 1 seat ring for a single winner with revealed holeCards', () => {
    const s = makeState({
      phase: 'showdown',
      seats: [
        makeSeat(0, { result: 'won', holeCards: [card('Ah'), card('Kd')] }),
        makeSeat(1, { result: 'lost' }),
      ],
    });
    const { container } = render(<ShowdownGlows state={s} seatCount={6} />);
    expect(container.querySelectorAll('mesh[name="showdown-card-outline"]').length).toBe(2);
    expect(container.querySelectorAll('mesh[name="showdown-seat-ring"]').length).toBe(1);
    const ring = container.querySelector('group[name="showdown-seat-ring-0"]');
    expect(ring).not.toBeNull();
  });

  it('renders a seat ring but zero card outlines for a mucked / fold_then_win winner', () => {
    const s = makeState({
      phase: 'showdown',
      seats: [
        // Winner who mucked / no revealed cards (holeCards: null)
        makeSeat(0, { result: 'won', holeCards: null }),
        makeSeat(1, { result: 'folded' }),
      ],
    });
    const { container } = render(<ShowdownGlows state={s} seatCount={6} />);
    expect(container.querySelectorAll('mesh[name="showdown-card-outline"]').length).toBe(0);
    expect(container.querySelectorAll('mesh[name="showdown-seat-ring"]').length).toBe(1);
  });

  it('renders glows for every winner in a split pot simultaneously', () => {
    const s = makeState({
      phase: 'showdown',
      seats: [
        makeSeat(0, { result: 'won', holeCards: [card('Ah'), card('Kd')] }),
        makeSeat(1, { result: 'lost' }),
        makeSeat(2, { result: 'won', holeCards: [card('As'), card('Kc')] }),
        makeSeat(3, { result: 'folded' }),
      ],
    });
    const { container } = render(<ShowdownGlows state={s} seatCount={6} />);
    expect(container.querySelectorAll('mesh[name="showdown-card-outline"]').length).toBe(4);
    expect(container.querySelectorAll('mesh[name="showdown-seat-ring"]').length).toBe(2);
    expect(container.querySelector('group[name="showdown-seat-ring-0"]')).not.toBeNull();
    expect(container.querySelector('group[name="showdown-seat-ring-2"]')).not.toBeNull();
  });

  it('uses the showdown glow colour on both the card outline and the seat ring', () => {
    const s = makeState({
      phase: 'showdown',
      seats: [
        makeSeat(0, { result: 'won', holeCards: [card('Ah'), card('Kd')] }),
      ],
    });
    const { container } = render(<ShowdownGlows state={s} seatCount={6} />);
    const outlineMat = container.querySelector(
      'mesh[name="showdown-card-outline"] meshBasicMaterial',
    );
    const ringMat = container.querySelector(
      'mesh[name="showdown-seat-ring"] meshBasicMaterial',
    );
    expect(outlineMat?.getAttribute('color')).toBe(SHOWDOWN_GLOW_COLOR);
    expect(ringMat?.getAttribute('color')).toBe(SHOWDOWN_GLOW_COLOR);
  });

  it('clears after SHOWDOWN_GLOW_DURATION_MS (AC 3)', () => {
    vi.useFakeTimers();
    const s = makeState({
      phase: 'showdown',
      seats: [
        makeSeat(0, { result: 'won', holeCards: [card('Ah'), card('Kd')] }),
      ],
    });
    const { container } = render(<ShowdownGlows state={s} seatCount={6} />);
    expect(container.querySelectorAll('mesh[name="showdown-card-outline"]').length).toBe(2);
    act(() => {
      vi.advanceTimersByTime(SHOWDOWN_GLOW_DURATION_MS + 50);
    });
    expect(container.querySelectorAll('mesh[name="showdown-card-outline"]').length).toBe(0);
    expect(container.querySelectorAll('mesh[name="showdown-seat-ring"]').length).toBe(0);
  });

  it('clears immediately on next hand (handId change) (AC 3)', () => {
    const winnerState = makeState({
      phase: 'showdown',
      seats: [
        makeSeat(0, { result: 'won', holeCards: [card('Ah'), card('Kd')] }),
      ],
    });
    const { container, rerender } = render(
      <ShowdownGlows state={winnerState} seatCount={6} />,
    );
    expect(container.querySelectorAll('mesh[name="showdown-card-outline"]').length).toBe(2);
    // Next hand dealt — handId bumps, phase returns to preflop/awaiting_cards.
    const nextHand = makeState({
      handId: 11,
      phase: 'preflop',
      seats: [makeSeat(0)],
    });
    rerender(<ShowdownGlows state={nextHand} seatCount={6} />);
    expect(container.querySelectorAll('mesh[name="showdown-card-outline"]').length).toBe(0);
    expect(container.querySelectorAll('mesh[name="showdown-seat-ring"]').length).toBe(0);
  });

  it('clears immediately on phase change away from showdown (AC 3)', () => {
    const winnerState = makeState({
      phase: 'showdown',
      seats: [
        makeSeat(0, { result: 'won', holeCards: [card('Ah'), card('Kd')] }),
      ],
    });
    const { container, rerender } = render(
      <ShowdownGlows state={winnerState} seatCount={6} />,
    );
    expect(container.querySelectorAll('mesh[name="showdown-card-outline"]').length).toBe(2);
    const backToRiver = { ...winnerState, phase: 'river' as const };
    rerender(<ShowdownGlows state={backToRiver} seatCount={6} />);
    expect(container.querySelectorAll('mesh[name="showdown-card-outline"]').length).toBe(0);
  });

  it('honours reduced motion: constant peak opacity for the whole window', () => {
    installReducedMotion(true);
    const s = makeState({
      phase: 'showdown',
      seats: [
        makeSeat(0, { result: 'won', holeCards: [card('Ah'), card('Kd')] }),
      ],
    });
    const { container } = render(<ShowdownGlows state={s} seatCount={6} />);
    const outlineMat = container.querySelector(
      'mesh[name="showdown-card-outline"] meshBasicMaterial',
    );
    // At t=0 under full motion this would be 0; under reduced motion it
    // jumps to peak immediately.
    expect(readOpacity(outlineMat)).toBe(SHOWDOWN_GLOW_MAX_OPACITY);
  });
});
