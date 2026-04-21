/** @vitest-environment happy-dom */
//
// T-018 — Action highlights: fold dim, bet glow, turn pulse.
//
// Covers the four ACs of the action-highlights surface:
//
//   AC 1 — Folded seat dims all associated meshes (seat pad + nameplate).
//   AC 2 — Bet/raise glow on nameplate auto-clears after 1500ms.
//   AC 3 — Exactly one seat pulses (currentSeat); pulse stops on seat change.
//   AC 4 — `prefers-reduced-motion` disables pulse + glow animation but the
//          state-only coloring mesh is still emitted.
//
// Exercises the pure helpers and the composer (<SeatHighlights>) directly.
// Scene-level integration under <PokerTable> lives in
// PokerTable.seatHighlights.test.tsx.

import { describe, it, expect, afterEach, beforeAll, afterAll, vi } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';

// ---------------------------------------------------------------------------
// R3F mock — mirrors DealerButton.test.tsx. Each render registers a *new*
// useFrame callback (superseding the prior one) so state-backed rerenders
// inside the driver don't accumulate duplicate ticks.
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
  SeatHighlights,
  TurnPulseRing,
  BetGlowOverlay,
  FOLDED_PAD_OPACITY,
  FOLDED_NAMEPLATE_OPACITY,
  BET_GLOW_DURATION_MS,
  BET_GLOW_COLOR,
  TURN_PULSE_RING_COLOR,
  TURN_PULSE_FREQUENCY_HZ,
  TURN_PULSE_MIN_OPACITY,
  TURN_PULSE_MAX_OPACITY,
  pulseOpacity,
  turnPulseRingWorldPosition,
  betGlowWorldPosition,
} from '../../src/scenes3d/components/SeatHighlight';
import { Seat } from '../../src/scenes3d/components/Seat';
import {
  Nameplate,
  NAMEPLATE_LOCAL_Y,
  computeBillboardYRotation,
} from '../../src/scenes3d/components/Nameplate';
import {
  seatAnchorLocalToWorld,
  ACTIVE_SEAT_OPACITY,
} from '../../src/scenes3d/components/tableLayout';
import type {
  SeatState,
  TableState,
  CardRef,
} from '../../src/scenes3d/types';
import { REDUCED_MOTION_QUERY } from '../../src/scenes3d/state/useReducedMotion';

// ---------------------------------------------------------------------------
// Fixtures + helpers
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
void card;

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

function stepFrames(
  totalMs: number,
  stepMs = 16,
  frameState: unknown = {},
) {
  act(() => {
    let elapsed = 0;
    while (elapsed < totalMs) {
      const step = Math.min(stepMs, totalMs - elapsed);
      for (const cb of frameCallbacks) cb(frameState, step / 1000);
      elapsed += step;
    }
  });
}

function readOpacity(el: Element | null): number {
  if (!el) throw new Error('readOpacity: null element');
  const raw = el.getAttribute('opacity');
  if (raw === null) throw new Error('readOpacity: missing opacity attr');
  return Number(raw);
}

function readRotationY(el: Element): number {
  const raw = el.getAttribute('rotation');
  if (!raw) throw new Error('missing rotation attribute');
  return Number(raw.split(',')[1]);
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

describe('pulseOpacity', () => {
  it('oscillates between TURN_PULSE_MIN_OPACITY and TURN_PULSE_MAX_OPACITY over time', () => {
    const samples = [];
    for (let t = 0; t < 2000; t += 50) {
      samples.push(pulseOpacity(t, false));
    }
    const min = Math.min(...samples);
    const max = Math.max(...samples);
    expect(min).toBeGreaterThanOrEqual(TURN_PULSE_MIN_OPACITY - 1e-9);
    expect(max).toBeLessThanOrEqual(TURN_PULSE_MAX_OPACITY + 1e-9);
    // Exercises both halves of the oscillation.
    expect(max - min).toBeGreaterThan(0.2);
  });

  it('returns a constant mid-range opacity under reduced motion', () => {
    const a = pulseOpacity(0, true);
    const b = pulseOpacity(500, true);
    const c = pulseOpacity(1234, true);
    expect(a).toBe(b);
    expect(b).toBe(c);
    expect(a).toBeGreaterThan(0);
    expect(a).toBeLessThanOrEqual(TURN_PULSE_MAX_OPACITY);
  });

  it('has period 1 / TURN_PULSE_FREQUENCY_HZ seconds', () => {
    const periodMs = 1000 / TURN_PULSE_FREQUENCY_HZ;
    expect(pulseOpacity(0, false)).toBeCloseTo(
      pulseOpacity(periodMs, false),
      6,
    );
    expect(pulseOpacity(100, false)).toBeCloseTo(
      pulseOpacity(100 + periodMs, false),
      6,
    );
  });
});

describe('turnPulseRingWorldPosition', () => {
  it('sits at the seat anchor on the felt', () => {
    const pos = turnPulseRingWorldPosition(2, 6);
    // Lives at (0,0,0) in seat-anchor-local — directly under the seat.
    const expected = seatAnchorLocalToWorld(2, 6, [0, 0, 0]);
    expect(pos[0]).toBeCloseTo(expected[0], 5);
    expect(pos[2]).toBeCloseTo(expected[2], 5);
  });
});

describe('betGlowWorldPosition', () => {
  it('co-locates with the nameplate (lifted by NAMEPLATE_LOCAL_Y)', () => {
    const pos = betGlowWorldPosition(0, 6);
    const expected = seatAnchorLocalToWorld(0, 6, [0, NAMEPLATE_LOCAL_Y, 0]);
    expect(pos[0]).toBeCloseTo(expected[0], 5);
    expect(pos[1]).toBeCloseTo(expected[1], 5);
    expect(pos[2]).toBeCloseTo(expected[2], 5);
  });
});

// ---------------------------------------------------------------------------
// <Seat folded> — AC 1 surface (seat pad)
// ---------------------------------------------------------------------------

describe('<Seat folded> (AC 1)', () => {
  it('dims the seat-pad opacity when folded is true', () => {
    const { container } = render(
      <Seat
        seatIndex={0}
        seatCount={6}
        playerName="Alice"
        isActive
        folded
      />,
    );
    const mat = container.querySelector(
      'mesh[name="seat-pad"] meshStandardMaterial',
    );
    expect(mat).not.toBeNull();
    const op = readOpacity(mat);
    expect(op).toBe(FOLDED_PAD_OPACITY);
    expect(op).toBeLessThan(ACTIVE_SEAT_OPACITY);
  });

  it('keeps full opacity when folded is false', () => {
    const { container } = render(
      <Seat
        seatIndex={0}
        seatCount={6}
        playerName="Alice"
        isActive
        folded={false}
      />,
    );
    const mat = container.querySelector(
      'mesh[name="seat-pad"] meshStandardMaterial',
    );
    expect(readOpacity(mat)).toBe(ACTIVE_SEAT_OPACITY);
  });

  it('default folded=false does not regress existing behavior', () => {
    const { container } = render(
      <Seat seatIndex={0} seatCount={6} playerName="Alice" isActive />,
    );
    const mat = container.querySelector(
      'mesh[name="seat-pad"] meshStandardMaterial',
    );
    expect(readOpacity(mat)).toBe(ACTIVE_SEAT_OPACITY);
  });
});

// ---------------------------------------------------------------------------
// <Nameplate folded> — AC 1 surface (nameplate)
// ---------------------------------------------------------------------------

describe('<Nameplate folded> (AC 1)', () => {
  it('dims the nameplate-card opacity when folded is true', () => {
    const { container } = render(
      <Nameplate
        seatIndex={0}
        seatCount={6}
        playerName="Alice"
        stack={100}
        folded
      />,
    );
    const mat = container.querySelector(
      'mesh[name="nameplate-card"] meshBasicMaterial',
    );
    expect(mat).not.toBeNull();
    expect(readOpacity(mat)).toBe(FOLDED_NAMEPLATE_OPACITY);
  });

  it('keeps full opacity when folded is false', () => {
    const { container } = render(
      <Nameplate
        seatIndex={0}
        seatCount={6}
        playerName="Alice"
        stack={100}
        folded={false}
      />,
    );
    const mat = container.querySelector(
      'mesh[name="nameplate-card"] meshBasicMaterial',
    );
    // Baseline opacity remains whatever the component used before T-018.
    expect(readOpacity(mat)).toBeGreaterThan(FOLDED_NAMEPLATE_OPACITY);
  });
});

// ---------------------------------------------------------------------------
// <TurnPulseRing> — AC 3 + AC 4
// ---------------------------------------------------------------------------

describe('<TurnPulseRing>', () => {
  it('renders a single turn-pulse-ring mesh at the seat anchor', () => {
    const { container } = render(
      <TurnPulseRing seatIndex={2} seatCount={6} />,
    );
    const group = container.querySelector(
      'group[name="turn-pulse-ring-2"]',
    );
    expect(group).not.toBeNull();
    expect(container.querySelectorAll('mesh[name="turn-pulse-ring"]').length).toBe(1);
    const raw = group!.getAttribute('position')!;
    const pos = raw.split(',').map(Number);
    const expected = turnPulseRingWorldPosition(2, 6);
    expect(pos[0]).toBeCloseTo(expected[0], 5);
    expect(pos[2]).toBeCloseTo(expected[2], 5);
  });

  it('AC 3: animates opacity when motion is allowed', () => {
    installReducedMotion(false);
    const { container } = render(
      <TurnPulseRing seatIndex={0} seatCount={6} />,
    );
    const mat = () =>
      container.querySelector('mesh[name="turn-pulse-ring"] meshBasicMaterial')!;
    const o0 = readOpacity(mat());
    stepFrames(250); // quarter-period shift
    const o1 = readOpacity(mat());
    expect(o0).not.toBe(o1);
  });

  it('AC 4: opacity is constant under prefers-reduced-motion', () => {
    installReducedMotion(true);
    const { container } = render(
      <TurnPulseRing seatIndex={0} seatCount={6} />,
    );
    const mat = () =>
      container.querySelector('mesh[name="turn-pulse-ring"] meshBasicMaterial')!;
    const o0 = readOpacity(mat());
    stepFrames(500);
    const o1 = readOpacity(mat());
    expect(o1).toBe(o0);
  });

  it('emits the accent ring color', () => {
    const { container } = render(
      <TurnPulseRing seatIndex={0} seatCount={6} />,
    );
    const mat = container.querySelector(
      'mesh[name="turn-pulse-ring"] meshBasicMaterial',
    )!;
    expect(mat.getAttribute('color')).toBe(TURN_PULSE_RING_COLOR);
  });
});

// ---------------------------------------------------------------------------
// <BetGlowOverlay> — AC 2 + AC 4
// ---------------------------------------------------------------------------

describe('<BetGlowOverlay>', () => {
  it('renders nothing when active is false', () => {
    const { container } = render(
      <BetGlowOverlay seatIndex={0} seatCount={6} active={false} />,
    );
    expect(container.querySelector('group[name="bet-glow-0"]')).toBeNull();
  });

  it('renders a bet-glow mesh at the nameplate anchor when active', () => {
    const { container } = render(
      <BetGlowOverlay seatIndex={3} seatCount={6} active />,
    );
    const group = container.querySelector('group[name="bet-glow-3"]');
    expect(group).not.toBeNull();
    const mesh = container.querySelector('mesh[name="bet-glow"]');
    expect(mesh).not.toBeNull();
    const mat = container.querySelector(
      'mesh[name="bet-glow"] meshBasicMaterial',
    )!;
    expect(mat.getAttribute('color')).toBe(BET_GLOW_COLOR);
    const expected = betGlowWorldPosition(3, 6);
    const pos = group!.getAttribute('position')!.split(',').map(Number);
    expect(pos[0]).toBeCloseTo(expected[0], 5);
    expect(pos[1]).toBeCloseTo(expected[1], 5);
  });
});

// ---------------------------------------------------------------------------
// <BetGlowOverlay> billboard rotation (Cycle 29 H-2 / M-1(a))
//
// Closes the Cycle 29 H-2 regression: the glow plane must track the active
// camera so it always faces the viewer — matching the sibling <Nameplate>
// so the glow and nameplate stay visually aligned on every seat of the
// 6-seat ellipse. Mirrors the pattern used by Nameplate billboarding tests.
// ---------------------------------------------------------------------------

describe('<BetGlowOverlay> billboard rotation (H-2)', () => {
  it('rotates about Y on the next frame to face the camera', () => {
    const { container } = render(
      <BetGlowOverlay seatIndex={0} seatCount={6} active />,
    );
    const objPos = betGlowWorldPosition(0, 6);
    const camPos = { x: objPos[0] + 5, y: 2, z: objPos[2] };
    stepFrames(16, 16, { camera: { position: camPos } });
    const group = container.querySelector('group[name="bet-glow-0"]')!;
    const phi = readRotationY(group);
    const expected = computeBillboardYRotation(camPos, {
      x: objPos[0],
      z: objPos[2],
    });
    expect(phi).toBeCloseTo(expected, 4);
    // Sanity: the unrotated world-+Z plane would read phi === 0 here.
    expect(Math.abs(phi)).toBeGreaterThan(0);
  });

  it('re-orients when the camera moves across frames', () => {
    const { container } = render(
      <BetGlowOverlay seatIndex={0} seatCount={6} active />,
    );
    const objPos = betGlowWorldPosition(0, 6);
    stepFrames(16, 16, {
      camera: { position: { x: objPos[0] + 5, y: 2, z: objPos[2] } },
    });
    const phi1 = readRotationY(
      container.querySelector('group[name="bet-glow-0"]')!,
    );
    stepFrames(16, 16, {
      camera: { position: { x: objPos[0], y: 2, z: objPos[2] + 5 } },
    });
    const phi2 = readRotationY(
      container.querySelector('group[name="bet-glow-0"]')!,
    );
    expect(phi2).not.toBe(phi1);
    expect(phi2).toBeCloseTo(0, 4);
  });

  it('ignores frames with no camera (no crash, rotation unchanged)', () => {
    const { container } = render(
      <BetGlowOverlay seatIndex={0} seatCount={6} active />,
    );
    const before = readRotationY(
      container.querySelector('group[name="bet-glow-0"]')!,
    );
    expect(() => stepFrames(16, 16, {})).not.toThrow();
    const after = readRotationY(
      container.querySelector('group[name="bet-glow-0"]')!,
    );
    expect(after).toBe(before);
  });

  it('matches the sibling <Nameplate> rotation for the same camera position', () => {
    // Both components render at the same world anchor (nameplate co-location).
    // Feed both the same frame state and assert their rotations converge.
    const objPos = betGlowWorldPosition(0, 6);
    const camPos = { x: objPos[0] + 3, y: 2, z: objPos[2] + 2 };

    const glowRender = render(
      <BetGlowOverlay seatIndex={0} seatCount={6} active />,
    );
    stepFrames(16, 16, { camera: { position: camPos } });
    const phiGlow = readRotationY(
      glowRender.container.querySelector('group[name="bet-glow-0"]')!,
    );
    glowRender.unmount();
    frameCallbacks.length = 0;

    const nameplateRender = render(
      <Nameplate seatIndex={0} seatCount={6} playerName="P" stack={100} />,
    );
    stepFrames(16, 16, { camera: { position: camPos } });
    const phiName = readRotationY(
      nameplateRender.container.querySelector('group[name="nameplate-0"]')!,
    );
    expect(phiGlow).toBeCloseTo(phiName, 6);
  });
});

// ---------------------------------------------------------------------------
// <SeatHighlights> composer — AC 2, AC 3, AC 4
// ---------------------------------------------------------------------------

describe('<SeatHighlights> composer', () => {
  it('AC 3: renders exactly one turn-pulse ring at the currentSeat', () => {
    const state = makeState({ currentSeat: 4 });
    const { container } = render(
      <SeatHighlights state={state} seatCount={6} />,
    );
    const rings = container.querySelectorAll('mesh[name="turn-pulse-ring"]');
    expect(rings.length).toBe(1);
    expect(
      container.querySelector('group[name="turn-pulse-ring-4"]'),
    ).not.toBeNull();
  });

  it('AC 3: no pulse ring when currentSeat is null', () => {
    const state = makeState({ currentSeat: null });
    const { container } = render(
      <SeatHighlights state={state} seatCount={6} />,
    );
    expect(container.querySelectorAll('mesh[name="turn-pulse-ring"]').length).toBe(0);
  });

  it('AC 3: ring moves to new seat on currentSeat change; only one ring at a time', () => {
    const stateA = makeState({ currentSeat: 1 });
    const { container, rerender } = render(
      <SeatHighlights state={stateA} seatCount={6} />,
    );
    expect(
      container.querySelector('group[name="turn-pulse-ring-1"]'),
    ).not.toBeNull();
    rerender(
      <SeatHighlights state={makeState({ currentSeat: 4 })} seatCount={6} />,
    );
    expect(container.querySelector('group[name="turn-pulse-ring-1"]')).toBeNull();
    expect(
      container.querySelector('group[name="turn-pulse-ring-4"]'),
    ).not.toBeNull();
    expect(container.querySelectorAll('mesh[name="turn-pulse-ring"]').length).toBe(1);
  });

  it('AC 2: activates bet-glow for a seat whose lastAction is bet', () => {
    const state = makeState({
      seats: [
        makeSeat(0, {
          lastAction: { action: 'bet', amount: 10, street: 'preflop' },
        }),
        ...Array.from({ length: 5 }, (_, i) => makeSeat(i + 1)),
      ],
    });
    const { container } = render(
      <SeatHighlights state={state} seatCount={6} />,
    );
    expect(container.querySelector('group[name="bet-glow-0"]')).not.toBeNull();
    expect(container.querySelector('group[name="bet-glow-1"]')).toBeNull();
  });

  it('AC 2: activates bet-glow for raise', () => {
    const state = makeState({
      seats: [
        makeSeat(0, {
          lastAction: { action: 'raise', amount: 20, street: 'preflop' },
        }),
        ...Array.from({ length: 5 }, (_, i) => makeSeat(i + 1)),
      ],
    });
    const { container } = render(
      <SeatHighlights state={state} seatCount={6} />,
    );
    expect(container.querySelector('group[name="bet-glow-0"]')).not.toBeNull();
  });

  it('AC 2: does NOT glow for check / call / fold', () => {
    for (const action of ['check', 'call', 'fold'] as const) {
      cleanup();
      const state = makeState({
        seats: [
          makeSeat(0, {
            lastAction: { action, amount: 0, street: 'preflop' },
          }),
          ...Array.from({ length: 5 }, (_, i) => makeSeat(i + 1)),
        ],
      });
      const { container } = render(
        <SeatHighlights state={state} seatCount={6} />,
      );
      expect(container.querySelector('group[name="bet-glow-0"]')).toBeNull();
    }
  });

  it('AC 2: glow auto-clears 1500ms after the bet/raise lands', () => {
    vi.useFakeTimers();
    const state = makeState({
      seats: [
        makeSeat(0, {
          lastAction: { action: 'bet', amount: 10, street: 'preflop' },
        }),
        ...Array.from({ length: 5 }, (_, i) => makeSeat(i + 1)),
      ],
    });
    const { container } = render(
      <SeatHighlights state={state} seatCount={6} />,
    );
    expect(container.querySelector('group[name="bet-glow-0"]')).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(BET_GLOW_DURATION_MS + 50);
    });
    expect(container.querySelector('group[name="bet-glow-0"]')).toBeNull();
    vi.useRealTimers();
  });

  it('AC 2: a new bet/raise refreshes the glow window', () => {
    vi.useFakeTimers();
    const seat0Bet = makeSeat(0, {
      lastAction: { action: 'bet', amount: 10, street: 'preflop' },
    });
    const { container, rerender } = render(
      <SeatHighlights
        state={makeState({ seats: [seat0Bet, ...Array.from({ length: 5 }, (_, i) => makeSeat(i + 1))] })}
        seatCount={6}
      />,
    );
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    // Before auto-clear, a fresh raise on a new street restarts the timer.
    rerender(
      <SeatHighlights
        state={makeState({
          streetIndex: 1,
          phase: 'flop',
          seats: [
            makeSeat(0, {
              lastAction: { action: 'raise', amount: 20, street: 'flop' },
            }),
            ...Array.from({ length: 5 }, (_, i) => makeSeat(i + 1)),
          ],
        })}
        seatCount={6}
      />,
    );
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    // Glow still present at 1000ms into the *new* window.
    expect(container.querySelector('group[name="bet-glow-0"]')).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(BET_GLOW_DURATION_MS);
    });
    expect(container.querySelector('group[name="bet-glow-0"]')).toBeNull();
    vi.useRealTimers();
  });

  it('AC 4: glow mesh is still rendered under reduced motion (state-only coloring retained)', () => {
    installReducedMotion(true);
    const state = makeState({
      currentSeat: 2,
      seats: [
        makeSeat(0, {
          lastAction: { action: 'bet', amount: 10, street: 'preflop' },
        }),
        ...Array.from({ length: 5 }, (_, i) => makeSeat(i + 1)),
      ],
    });
    const { container } = render(
      <SeatHighlights state={state} seatCount={6} />,
    );
    // Glow surface present.
    expect(container.querySelector('group[name="bet-glow-0"]')).not.toBeNull();
    // Pulse ring surface present (static).
    expect(
      container.querySelector('group[name="turn-pulse-ring-2"]'),
    ).not.toBeNull();
  });
});
