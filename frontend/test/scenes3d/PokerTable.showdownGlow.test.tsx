/** @vitest-environment happy-dom */
//
// T-013 — Showdown reveal + winning-hand glow outline.
//
// Scene-level integration tests — asserts the four ACs at the
// `<PokerTable>` render surface (mirrors Cycle 27 / Cycle 29 rigor for
// T-018):
//
//   AC 1 — Folded opponent cards stay face-down at showdown.
//   AC 2 — Winning seat's cards render a theme-coloured outline mesh;
//          mucked / fold_then_win winners still get a seat ring glow.
//   AC 3 — Glow clears on handId change / phase change away from
//          'showdown' (observed through the scene graph).
//   AC 4 — Spectator policy reveals non-folded opponents at showdown.
//          (Policy is enforced by `canSee()`; this file re-asserts the
//          user-observable outcome at the scene level.)

import {
  describe,
  it,
  expect,
  afterEach,
  beforeAll,
  afterAll,
  vi,
} from 'vitest';
import { render, cleanup } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks — mirror PokerTable.seatHighlights.test.tsx.
// ---------------------------------------------------------------------------

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

const frameCallbacks: Array<(state: unknown, dt: number) => void> = [];
vi.mock('@react-three/fiber', () => ({
  useFrame: (cb: (state: unknown, dt: number) => void) => {
    frameCallbacks.push(cb);
  },
  Canvas: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

const R3F_TAG_WARNING =
  /is using incorrect casing|is unrecognized in this browser|React does not recognize the|Unknown event handler|Received .* for a non-boolean attribute/;
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
beforeAll(() => {
  consoleErrorSpy = vi
    .spyOn(console, 'error')
    .mockImplementation((msg: unknown, ...rest: unknown[]) => {
      if (typeof msg === 'string' && R3F_TAG_WARNING.test(msg)) return;
      console.warn('[unexpected console.error]', msg, ...rest);
    });
  consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterAll(() => {
  consoleErrorSpy.mockRestore();
  consoleWarnSpy.mockRestore();
});

import { PokerTable } from '../../src/scenes3d/PokerTable';
import { __getTestProbe as __getChipInstancesProbe } from '../../src/scenes3d/components/ChipInstances';
import type {
  SeatState,
  TableState,
  CardRef,
} from '../../src/scenes3d/types';

afterEach(() => {
  cleanup();
  frameCallbacks.length = 0;
  __getChipInstancesProbe().reset();
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

// ---------------------------------------------------------------------------
// AC 2 — Winning seat's cards render the theme-coloured outline mesh.
// ---------------------------------------------------------------------------

describe('<PokerTable> showdown glow — AC 2', () => {
  it('mounts card outlines + seat ring only for the winning seat at showdown', () => {
    const state = makeState({
      phase: 'showdown',
      streetIndex: 4,
      seats: [
        makeSeat(0, {
          result: 'won',
          holeCards: [card('Ah'), card('Kd')],
        }),
        makeSeat(1, {
          result: 'lost',
          holeCards: [card('Qs'), card('Jc')],
        }),
        makeSeat(2, { result: 'folded', folded: true }),
        ...Array.from({ length: 3 }, (_, i) => makeSeat(i + 3)),
      ],
      community: [
        card('2h'),
        card('3d'),
        card('4c'),
        card('5s'),
        card('6h'),
      ],
    });
    const { container } = render(<PokerTable state={state} />);
    // Exactly 2 card outlines + 1 seat ring on the winner.
    expect(
      container.querySelectorAll('mesh[name="showdown-card-outline"]').length,
    ).toBe(2);
    const rings = container.querySelectorAll('mesh[name="showdown-seat-ring"]');
    expect(rings.length).toBe(1);
    const winnerRing = container.querySelector(
      'group[name="showdown-seat-ring-0"]',
    );
    expect(winnerRing).not.toBeNull();
    // Non-winner seats must NOT carry the ring.
    expect(
      container.querySelector('group[name="showdown-seat-ring-1"]'),
    ).toBeNull();
  });

  it('mounts glows for every winner simultaneously in a split pot', () => {
    const state = makeState({
      phase: 'showdown',
      streetIndex: 4,
      seats: [
        makeSeat(0, {
          result: 'won',
          holeCards: [card('Ah'), card('Kd')],
        }),
        makeSeat(1, { result: 'lost', holeCards: [card('Qh'), card('Jd')] }),
        makeSeat(2, {
          result: 'won',
          holeCards: [card('As'), card('Kc')],
        }),
        ...Array.from({ length: 3 }, (_, i) => makeSeat(i + 3)),
      ],
    });
    const { container } = render(<PokerTable state={state} />);
    // 4 outlines total (2 per winner) + 2 rings.
    expect(
      container.querySelectorAll('mesh[name="showdown-card-outline"]').length,
    ).toBe(4);
    expect(
      container.querySelectorAll('mesh[name="showdown-seat-ring"]').length,
    ).toBe(2);
  });

  it('renders a seat ring but no card outlines for a mucked / fold_then_win winner', () => {
    // All-fold case — the single remaining player wins without reveal.
    const state = makeState({
      phase: 'showdown',
      streetIndex: 4,
      seats: [
        makeSeat(0, { result: 'won', holeCards: null }),
        makeSeat(1, { result: 'folded', folded: true }),
        ...Array.from({ length: 4 }, (_, i) => makeSeat(i + 2)),
      ],
    });
    const { container } = render(<PokerTable state={state} />);
    expect(
      container.querySelectorAll('mesh[name="showdown-card-outline"]').length,
    ).toBe(0);
    expect(
      container.querySelectorAll('mesh[name="showdown-seat-ring"]').length,
    ).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// AC 1 — Folded opponent cards stay face-down at showdown.
// AC 4 — Spectator policy reveals non-folded opponents at showdown.
// ---------------------------------------------------------------------------

describe('<PokerTable> showdown reveal — ACs 1 & 4', () => {
  it('reveals non-folded opponent hole cards as face-up at showdown under spectator policy', () => {
    const state = makeState({
      phase: 'showdown',
      streetIndex: 4,
      seats: [
        makeSeat(0, { holeCards: [card('Ah'), card('Kd')] }),
        makeSeat(1, { holeCards: [card('Qh'), card('Jd')] }),
        ...Array.from({ length: 4 }, (_, i) => makeSeat(i + 2, { isActive: false })),
      ],
    });
    const { container } = render(<PokerTable state={state} />);
    const faceUp = container.querySelectorAll('[data-testid="card-face-up"]');
    const faceDown = container.querySelectorAll(
      '[data-testid="card-face-down"]',
    );
    // 2 seats × 2 cards = 4 hole cards revealed; + 0 community cards
    // rendered (all null in fixture) — exactly 4 face-up. Zero face-down
    // hole cards for seats 0/1 because both are non-folded at showdown.
    expect(faceUp.length).toBe(4);
    expect(faceDown.length).toBe(0);
  });

  it('folded opponent cards are NOT rendered face-up at showdown', () => {
    const state = makeState({
      phase: 'showdown',
      streetIndex: 4,
      seats: [
        makeSeat(0, { holeCards: [card('Ah'), card('Kd')], result: 'won' }),
        // Folded seat — must not render face-up cards.
        makeSeat(1, {
          holeCards: [card('Qh'), card('Jd')],
          folded: true,
          result: 'folded',
        }),
        ...Array.from({ length: 4 }, (_, i) => makeSeat(i + 2, { isActive: false })),
      ],
    });
    const { container } = render(<PokerTable state={state} />);
    // The winning seat renders two face-up cards.
    const faceUp = container.querySelectorAll('[data-testid="card-face-up"]');
    expect(faceUp.length).toBe(2);
    // And the folded seat's cards are NOT face-up (they are gated out
    // entirely by `renderHole = isActive && !folded`).
    const seat1Cards = container.querySelectorAll(
      'group[name="seat-1"] [data-testid="card-face-up"]',
    );
    expect(seat1Cards.length).toBe(0);
    // Winning seat's glow outlines present (AC 2 smoke).
    expect(
      container.querySelectorAll('mesh[name="showdown-card-outline"]').length,
    ).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// AC 3 — Glow clears on handId change / phase change away from showdown.
// ---------------------------------------------------------------------------

describe('<PokerTable> showdown glow — AC 3 clearing', () => {
  it('clears outlines + ring when the phase leaves showdown (e.g. next hand preflop)', () => {
    const showdownState = makeState({
      phase: 'showdown',
      streetIndex: 4,
      seats: [
        makeSeat(0, {
          result: 'won',
          holeCards: [card('Ah'), card('Kd')],
        }),
        ...Array.from({ length: 5 }, (_, i) => makeSeat(i + 1)),
      ],
    });
    const { container, rerender } = render(
      <PokerTable state={showdownState} />,
    );
    expect(
      container.querySelectorAll('mesh[name="showdown-card-outline"]').length,
    ).toBe(2);

    const nextHand = makeState({
      handId: 11,
      handNumber: 2,
      phase: 'preflop',
      streetIndex: 0,
      seats: Array.from({ length: 6 }, (_, i) => makeSeat(i)),
    });
    rerender(<PokerTable state={nextHand} />);
    expect(
      container.querySelectorAll('mesh[name="showdown-card-outline"]').length,
    ).toBe(0);
    expect(
      container.querySelectorAll('mesh[name="showdown-seat-ring"]').length,
    ).toBe(0);
  });
});
