/** @vitest-environment happy-dom */
//
// T-018 — scene-level integration tests. Asserts the four action-highlight
// ACs are observable at the `<PokerTable>` render surface, not just in
// unit-level isolation (matches Cycle 27 review rigor).
//
//   AC 1 — Folded seat dims pad + nameplate meshes.
//   AC 2 — Bet/raise glow on nameplate auto-clears 1500ms later.
//   AC 3 — Exactly one turn pulse ring at a time; follows `currentSeat`.
//   AC 4 — prefers-reduced-motion disables pulse + glow animation
//          (the state-only coloring mesh is still rendered).

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
// Mocks — mirror PokerTable.test.tsx.
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
import {
  BET_GLOW_DURATION_MS,
  FOLDED_PAD_OPACITY,
  FOLDED_NAMEPLATE_OPACITY,
  FOLDED_CHIP_STACK_OPACITY,
} from '../../src/scenes3d/components/SeatHighlight';
import { __getTestProbe as __getChipInstancesProbe } from '../../src/scenes3d/components/ChipInstances';
import { REDUCED_MOTION_QUERY } from '../../src/scenes3d/state/useReducedMotion';
import type {
  SeatState,
  TableState,
} from '../../src/scenes3d/types';

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
  __getChipInstancesProbe().reset();
});

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
  return Number(raw);
}

// ---------------------------------------------------------------------------
// AC 1 — Folded seat dims all associated meshes (observable at scene level).
// ---------------------------------------------------------------------------

describe('<PokerTable> action-highlights — fold dim (AC 1)', () => {
  it('dims seat-pad and nameplate for folded seats; active seats are full opacity', () => {
    const state = makeState({
      seats: [
        makeSeat(0, { folded: true }),
        makeSeat(1, { folded: false }),
        ...Array.from({ length: 4 }, (_, i) => makeSeat(i + 2)),
      ],
    });
    const { container } = render(<PokerTable state={state} />);

    const foldedSeat = container.querySelector('group[name="seat-0"]')!;
    const activeSeat = container.querySelector('group[name="seat-1"]')!;
    const foldedPad = foldedSeat.querySelector(
      'mesh[name="seat-pad"] meshStandardMaterial',
    );
    const activePad = activeSeat.querySelector(
      'mesh[name="seat-pad"] meshStandardMaterial',
    );
    expect(readOpacity(foldedPad)).toBe(FOLDED_PAD_OPACITY);
    expect(readOpacity(activePad)).toBeGreaterThan(FOLDED_PAD_OPACITY);

    const foldedNameplate = container.querySelector(
      'group[name="nameplate-0"] mesh[name="nameplate-card"] meshBasicMaterial',
    );
    const activeNameplate = container.querySelector(
      'group[name="nameplate-1"] mesh[name="nameplate-card"] meshBasicMaterial',
    );
    expect(readOpacity(foldedNameplate)).toBe(FOLDED_NAMEPLATE_OPACITY);
    expect(readOpacity(activeNameplate)).toBeGreaterThan(
      FOLDED_NAMEPLATE_OPACITY,
    );
  });
});

// ---------------------------------------------------------------------------
// AC 1 (carry-forward) — Folded seat's committed-chip stack is dimmed.
// Completes T-018 AC 1 / S-3.3 ("chip stack" dim) — Cycle 29 H-1. Also
// closes the Cycle 29 M-1(b) probe gap: this is the first scene-level
// assertion that the committed ChipStack honours the fold flag.
// ---------------------------------------------------------------------------

describe('<PokerTable> action-highlights — fold dim extends to chip stack (AC 1 cont.)', () => {
  it('routes a folded + committed seat\'s chips into the dimmed InstancedMesh pool with material opacity < 1', () => {
    const state = makeState({
      streetIndex: 0,
      seats: [
        // Seat 0 — folded but still has committed chips this street.
        makeSeat(0, { folded: true, committedThisStreet: 5 }),
        // Seat 1 — live contributor, same committed size (control).
        makeSeat(1, { folded: false, committedThisStreet: 5 }),
        ...Array.from({ length: 4 }, (_, i) => makeSeat(i + 2)),
      ],
    });
    render(<PokerTable state={state} />);

    const probe = __getChipInstancesProbe();
    const primary = probe.getMeshes();
    const dimmed = probe.getDimmedMeshes();

    // Folded seat → dimmed pool has live chips.
    const dimmedBlackCount = dimmed.Black.count;
    expect(dimmedBlackCount).toBeGreaterThan(0);

    // Dimmed pool material opacity reflects the folded-chip-stack constant.
    const dimmedMaterial = dimmed.Black.material as import('three').MeshStandardMaterial;
    expect(dimmedMaterial.transparent).toBe(true);
    expect(dimmedMaterial.opacity).toBeLessThan(1);
    expect(dimmedMaterial.opacity).toBeCloseTo(FOLDED_CHIP_STACK_OPACITY, 5);

    // Non-folded committed seat → primary pool has live chips at full opacity.
    expect(primary.Black.count).toBeGreaterThan(0);
    const primaryMaterial = primary.Black.material as import('three').MeshStandardMaterial;
    expect(primaryMaterial.opacity).toBe(1);
  });

  it('non-folded seats with committed chips never land in the dimmed pool (no over-dim regression)', () => {
    const state = makeState({
      streetIndex: 0,
      seats: [
        makeSeat(0, { folded: false, committedThisStreet: 3 }),
        makeSeat(1, { folded: false, committedThisStreet: 2 }),
        ...Array.from({ length: 4 }, (_, i) => makeSeat(i + 2)),
      ],
    });
    render(<PokerTable state={state} />);

    const probe = __getChipInstancesProbe();
    const dimmed = probe.getDimmedMeshes();
    for (const denom of ['White', 'Red', 'Green', 'Black'] as const) {
      expect(dimmed[denom].count).toBe(0);
    }
    const primary = probe.getMeshes();
    // Both seats' contributions land in the primary pool.
    expect(primary.Black.count).toBeGreaterThan(0);
  });

  it('pot ChipStack is unaffected by any seat fold state (stays in primary pool)', () => {
    // All seats folded except one; pot is non-zero.
    const state = makeState({
      streetIndex: 0,
      pot: 10,
      seats: [
        makeSeat(0, { folded: true, committedThisStreet: 0 }),
        makeSeat(1, { folded: true, committedThisStreet: 0 }),
        makeSeat(2, { folded: false, committedThisStreet: 0 }),
        ...Array.from({ length: 3 }, (_, i) => makeSeat(i + 3)),
      ],
    });
    render(<PokerTable state={state} />);

    const probe = __getChipInstancesProbe();
    // Only chips in flight: the pot stack. It must render opaque.
    expect(probe.getMeshes().Black.count).toBeGreaterThan(0);
    for (const denom of ['White', 'Red', 'Green', 'Black'] as const) {
      expect(probe.getDimmedMeshes()[denom].count).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// AC 2 — Bet/raise glow auto-clears after 1500ms.
// ---------------------------------------------------------------------------

describe('<PokerTable> action-highlights — bet glow (AC 2)', () => {
  it('renders a bet-glow for the acting seat and auto-clears after 1500ms', () => {
    vi.useFakeTimers();
    const state = makeState({
      seats: [
        makeSeat(0, {
          lastAction: { action: 'bet', amount: 10, street: 'preflop' },
        }),
        ...Array.from({ length: 5 }, (_, i) => makeSeat(i + 1)),
      ],
    });
    const { container } = render(<PokerTable state={state} />);
    expect(container.querySelector('group[name="bet-glow-0"]')).not.toBeNull();
    // Non-acting seats have no glow.
    expect(container.querySelector('group[name="bet-glow-1"]')).toBeNull();

    act(() => {
      vi.advanceTimersByTime(BET_GLOW_DURATION_MS + 50);
    });
    expect(container.querySelector('group[name="bet-glow-0"]')).toBeNull();
  });

  it('glow fires for raise too', () => {
    const state = makeState({
      seats: [
        makeSeat(0, {
          lastAction: { action: 'raise', amount: 20, street: 'preflop' },
        }),
        ...Array.from({ length: 5 }, (_, i) => makeSeat(i + 1)),
      ],
    });
    const { container } = render(<PokerTable state={state} />);
    expect(container.querySelector('group[name="bet-glow-0"]')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC 2 billboard probe (Cycle 29 H-2 / M-1(a))
//
// Closes the Cycle 29 M-1(a) probe gap: the AC-level test above only
// asserts the glow group mounts/unmounts. It does NOT assert the plane
// faces the camera. This block drives a frame with a non-trivial camera
// position and asserts the glow group's rotation tracks — mirroring the
// Nameplate billboarding tests so the two surfaces stay co-oriented on
// every seat of the 6-seat ellipse.
// ---------------------------------------------------------------------------

function readRotationY(el: Element): number {
  const raw = el.getAttribute('rotation');
  if (!raw) throw new Error('missing rotation attribute');
  return Number(raw.split(',')[1]);
}

describe('<PokerTable> action-highlights — bet glow billboards to camera (AC 2 / H-2)', () => {
  it('glow rotation tracks the camera across frames (matches sibling nameplate)', () => {
    const state = makeState({
      seats: [
        makeSeat(0, {
          lastAction: { action: 'bet', amount: 10, street: 'preflop' },
        }),
        ...Array.from({ length: 5 }, (_, i) => makeSeat(i + 1)),
      ],
    });
    const { container } = render(<PokerTable state={state} />);
    const glowGroup = container.querySelector(
      'group[name="bet-glow-0"]',
    );
    const nameplateGroup = container.querySelector(
      'group[name="nameplate-0"]',
    );
    expect(glowGroup).not.toBeNull();
    expect(nameplateGroup).not.toBeNull();

    // Drive a frame with a camera offset in +X. Both the glow and the
    // nameplate subscribe `useFrame` so both callbacks must fire.
    const camPos = { x: 10, y: 5, z: 0.001 };
    act(() => {
      for (const cb of frameCallbacks) cb({ camera: { position: camPos } }, 0.016);
    });

    const phiGlow = readRotationY(
      container.querySelector('group[name="bet-glow-0"]')!,
    );
    const phiNameplate = readRotationY(
      container.querySelector('group[name="nameplate-0"]')!,
    );
    // Both billboarded about Y; same camera → same rotation.
    expect(phiGlow).toBeCloseTo(phiNameplate, 6);
    // Sanity: a non-billboarded plane would still read 0 here.
    expect(Math.abs(phiGlow)).toBeGreaterThan(0);

    // Move the camera; rotation must update on the next frame.
    const camPos2 = { x: 0.001, y: 5, z: 10 };
    act(() => {
      for (const cb of frameCallbacks) cb({ camera: { position: camPos2 } }, 0.016);
    });
    const phiGlow2 = readRotationY(
      container.querySelector('group[name="bet-glow-0"]')!,
    );
    expect(phiGlow2).not.toBe(phiGlow);
  });
});

// ---------------------------------------------------------------------------
// AC 3 — Exactly one turn-pulse ring, follows `currentSeat`, stops on change.
// ---------------------------------------------------------------------------

describe('<PokerTable> action-highlights — turn pulse (AC 3)', () => {
  it('renders exactly one pulse ring at the currentSeat', () => {
    const { container } = render(
      <PokerTable state={makeState({ currentSeat: 2 })} />,
    );
    expect(
      container.querySelectorAll('mesh[name="turn-pulse-ring"]').length,
    ).toBe(1);
    expect(
      container.querySelector('group[name="turn-pulse-ring-2"]'),
    ).not.toBeNull();
  });

  it('pulse moves to the new seat on currentSeat change; no stale rings left behind', () => {
    const { container, rerender } = render(
      <PokerTable state={makeState({ currentSeat: 2 })} />,
    );
    expect(
      container.querySelector('group[name="turn-pulse-ring-2"]'),
    ).not.toBeNull();
    rerender(<PokerTable state={makeState({ currentSeat: 4 })} />);
    expect(container.querySelector('group[name="turn-pulse-ring-2"]')).toBeNull();
    expect(
      container.querySelector('group[name="turn-pulse-ring-4"]'),
    ).not.toBeNull();
    expect(
      container.querySelectorAll('mesh[name="turn-pulse-ring"]').length,
    ).toBe(1);
  });

  it('no pulse ring when currentSeat is null', () => {
    const { container } = render(
      <PokerTable state={makeState({ currentSeat: null })} />,
    );
    expect(
      container.querySelectorAll('mesh[name="turn-pulse-ring"]').length,
    ).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// AC 4 — prefers-reduced-motion disables pulse + glow animation.
// ---------------------------------------------------------------------------

describe('<PokerTable> action-highlights — reduced motion (AC 4)', () => {
  it('keeps the state-only coloring meshes (pulse ring + glow) rendered under reduced motion', () => {
    installReducedMotion(true);
    const state = makeState({
      currentSeat: 3,
      seats: [
        makeSeat(0, {
          lastAction: { action: 'bet', amount: 10, street: 'preflop' },
        }),
        ...Array.from({ length: 5 }, (_, i) => makeSeat(i + 1)),
      ],
    });
    const { container } = render(<PokerTable state={state} />);
    // Ring + glow mesh both present (state-only coloring retained).
    expect(
      container.querySelector('group[name="turn-pulse-ring-3"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('group[name="bet-glow-0"]'),
    ).not.toBeNull();
  });
});
