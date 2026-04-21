/** @vitest-environment happy-dom */
//
// T-026 — Player-mode composition tests. Covers the four ACs of the
// player-mode composition on `<PokerTable>`:
//
//   AC 1 — zero `<EquityBadge>` and zero `/equity` fetches under
//          `viewer.policy === 'player'`, regardless of `equityOverlay`.
//   AC 2 — camera is locked to the viewer seat POV; the caller-supplied
//          `cameraPreset` is ignored in player mode.
//   AC 3 — nameplates + blind markers (TableMarkers) still render for
//          all seats under player mode.
//   AC 4 — the preset toolbar is hidden under `viewer.policy === 'player'`.
//   AC 5 — zero `/equity` network calls across a full player-mode hand
//          lifecycle (preflop → flop → turn → river → showdown).
//
// All assertions are observable through the public `<PokerTable>` render
// surface: the drei `<OrbitControls>` / `<PerspectiveCamera>` props (via
// a mock), the scene-graph DOM tree (via happy-dom), and the mocked
// `fetchEquity` client.

import {
  describe,
  it,
  expect,
  afterEach,
  beforeAll,
  afterAll,
  vi,
} from 'vitest';
import { render, cleanup, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Mocks — mirror the EquityBadge.test / PokerTable.test patterns.
// ---------------------------------------------------------------------------

const orbitPropsSpy = vi.fn<(props: Record<string, unknown>) => void>();
const cameraPropsSpy = vi.fn<(props: Record<string, unknown>) => void>();
vi.mock('@react-three/drei', () => ({
  Environment: (props: Record<string, unknown>) => (
    <div
      data-testid="mock-environment"
      data-preset={String(props.preset ?? '')}
      data-resolution={String(props.resolution ?? '')}
      data-background={String(props.background ?? '')}
    />
  ),

  OrbitControls: (props: Record<string, unknown>) => {
    orbitPropsSpy(props);
    return <div data-testid="mock-orbit-controls" />;
  },
  PerspectiveCamera: (props: Record<string, unknown>) => {
    cameraPropsSpy(props);
    return <div data-testid="mock-perspective-camera" />;
  },
  Text: (props: Record<string, unknown> & { children?: unknown }) => {
    const name = typeof props.name === 'string' ? props.name : 'drei-text';
    return (
      <div data-testid={name} data-text={String(props.children ?? '')} />
    );
  },
}));

vi.mock('@react-three/fiber', () => ({
  useFrame: () => {},
  Canvas: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

vi.mock('../../src/api/client', () => ({
  fetchEquity: vi.fn(),
}));

import { fetchEquity } from '../../src/api/client';
import { PokerTable } from '../../src/scenes3d/PokerTable';
import { CameraPresetToolbar } from '../../src/scenes3d/components/CameraPresetToolbar';
import {
  computeSeatPresetPose,
  computeSeatYawCenter,
  CAMERA_PRESETS,
} from '../../src/scenes3d/animations/cameraPresets';
import type {
  CardRef,
  SeatState,
  TableState,
  ViewerContext,
} from '../../src/scenes3d/types';

// happy-dom has no WebGL. Silence R3F "unknown element" warnings.
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

afterEach(() => {
  cleanup();
  orbitPropsSpy.mockClear();
  cameraPropsSpy.mockClear();
  consoleWarnSpy.mockClear();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

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
  const defaultHoleCards: [CardRef, CardRef] = [card('Ah'), card('Ks')];
  return {
    gameId: 7,
    handId: 100,
    handNumber: 12,
    phase: 'preflop',
    streetIndex: 0,
    community: [null, null, null, null, null],
    seats: Array.from({ length: 6 }, (_, i) =>
      makeSeat(i, { holeCards: defaultHoleCards }),
    ),
    pot: 0,
    sidePots: [],
    dealerSeat: 0,
    sbSeat: 1,
    bbSeat: 2,
    currentSeat: 3,
    ...overrides,
  };
}

function latestOrbitProps() {
  return orbitPropsSpy.mock.calls.at(-1)![0];
}
function latestCameraProps() {
  return cameraPropsSpy.mock.calls.at(-1)![0];
}

function wrapWithQueryClient() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

const PLAYER_SEAT_2: ViewerContext = { policy: 'player', seat: 2 };
const SPECTATOR: ViewerContext = { policy: 'spectator' };

function mockEquitiesForAllSeats(count = 6) {
  const equities = Array.from({ length: count }, (_, i) => ({
    player_name: `P${i}`,
    equity: 0.3,
    winning_hand_description: null,
  }));
  vi.mocked(fetchEquity).mockResolvedValue({ equities });
}

async function settle() {
  await new Promise((r) => setTimeout(r, 20));
}

// ---------------------------------------------------------------------------
// AC 2 — Camera lock to viewer seat POV
// ---------------------------------------------------------------------------

describe('<PokerTable> player-mode — camera lock (AC 2)', () => {
  it('locks camera to viewer seat POV pose when no cameraPreset is passed', () => {
    render(
      <PokerTable state={makeState()} viewer={PLAYER_SEAT_2} />,
    );
    const expected = computeSeatPresetPose(2, 6);
    expect(latestCameraProps().position).toEqual(expected.position);
    expect(latestOrbitProps().target).toEqual(expected.target);
  });

  it('forwards the seat-specific yaw center so ±30° clamp tracks the seat radial', () => {
    render(
      <PokerTable state={makeState()} viewer={PLAYER_SEAT_2} />,
    );
    const yaw = computeSeatYawCenter(2, 6);
    const props = latestOrbitProps();
    expect(props.minAzimuthAngle).toBeCloseTo(yaw - Math.PI / 6, 6);
    expect(props.maxAzimuthAngle).toBeCloseTo(yaw + Math.PI / 6, 6);
    // Seat-POV also disables pan, matches T-022 AC 2.
    expect(props.enablePan).toBe(false);
  });

  it('ignores a named cameraPreset ("topDown") under player policy', () => {
    render(
      <PokerTable
        state={makeState()}
        viewer={PLAYER_SEAT_2}
        cameraPreset="topDown"
      />,
    );
    const expected = computeSeatPresetPose(2, 6);
    // Camera is at seat POV, NOT at topDown.
    expect(latestCameraProps().position).toEqual(expected.position);
    expect(latestCameraProps().position).not.toEqual(
      CAMERA_PRESETS.topDown.position,
    );
  });

  it('ignores a named cameraPreset ("cinematic") under player policy', () => {
    render(
      <PokerTable
        state={makeState()}
        viewer={PLAYER_SEAT_2}
        cameraPreset="cinematic"
      />,
    );
    const expected = computeSeatPresetPose(2, 6);
    expect(latestCameraProps().position).toEqual(expected.position);
  });

  it('forces the viewer seat even when caller passes a different seat preset', () => {
    render(
      <PokerTable
        state={makeState()}
        viewer={PLAYER_SEAT_2}
        cameraPreset={{ kind: 'seat', seat: 5 }}
      />,
    );
    const expected = computeSeatPresetPose(2, 6);
    const other = computeSeatPresetPose(5, 6);
    expect(latestCameraProps().position).toEqual(expected.position);
    expect(latestCameraProps().position).not.toEqual(other.position);
  });

  it('resolves seat POV correctly for every seat index', () => {
    for (const seat of [0, 1, 2, 3, 4, 5]) {
      cleanup();
      orbitPropsSpy.mockClear();
      cameraPropsSpy.mockClear();
      render(
        <PokerTable
          state={makeState()}
          viewer={{ policy: 'player', seat }}
        />,
      );
      const expected = computeSeatPresetPose(seat, 6);
      expect(latestCameraProps().position).toEqual(expected.position);
      const yaw = computeSeatYawCenter(seat, 6);
      expect(latestOrbitProps().minAzimuthAngle).toBeCloseTo(
        yaw - Math.PI / 6,
        6,
      );
      expect(latestOrbitProps().maxAzimuthAngle).toBeCloseTo(
        yaw + Math.PI / 6,
        6,
      );
    }
  });

  it('spectator viewer still respects the cameraPreset prop (regression)', () => {
    render(
      <PokerTable
        state={makeState()}
        viewer={SPECTATOR}
        cameraPreset="topDown"
      />,
    );
    expect(latestCameraProps().position).toEqual(CAMERA_PRESETS.topDown.position);
  });

  it('falls back to default preset when player policy is passed without a seat', () => {
    render(
      <PokerTable
        state={makeState()}
        viewer={{ policy: 'player' }}
      />,
    );
    expect(latestCameraProps().position).toEqual(CAMERA_PRESETS.default.position);
  });
});

// ---------------------------------------------------------------------------
// AC 3 — Nameplates + blind markers still render in player mode
// ---------------------------------------------------------------------------

describe('<PokerTable> player-mode — nameplates & blind markers (AC 3)', () => {
  it('renders one nameplate per seat under player policy', () => {
    const { container } = render(
      <PokerTable state={makeState()} viewer={PLAYER_SEAT_2} />,
    );
    const nameplates = container.querySelectorAll('group[name="nameplates"] > *');
    // Nameplate component renders one subtree per seat.
    expect(nameplates.length).toBeGreaterThanOrEqual(6);
  });

  it('renders dealer button + SB + BB markers under player policy', () => {
    const { container } = render(
      <PokerTable state={makeState()} viewer={PLAYER_SEAT_2} />,
    );
    expect(container.querySelector('group[name="table-markers"]')).not.toBeNull();
    expect(container.querySelector('group[name="dealer-button"]')).not.toBeNull();
    expect(container.querySelector('group[name="small-blind-marker"]')).not.toBeNull();
    expect(container.querySelector('group[name="big-blind-marker"]')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC 1 — No equity overlay under player mode (scene-level assertion).
// Full fetch-count semantics are covered by EquityBadge.test.tsx; this
// keeps the AC verifiable from T-026's test surface.
// ---------------------------------------------------------------------------

describe('<PokerTable> player-mode — no equity overlay (AC 1)', () => {
  it('renders zero equity badges and fires zero fetches even with equityOverlay=true', async () => {
    mockEquitiesForAllSeats();
    const Wrapper = wrapWithQueryClient();
    const { container } = render(
      <Wrapper>
        <PokerTable
          state={makeState()}
          viewer={PLAYER_SEAT_2}
          equityOverlay={true}
        />
      </Wrapper>,
    );
    await settle();
    expect(fetchEquity).not.toHaveBeenCalled();
    expect(container.querySelector('group[name="equity-badges"]')).toBeNull();
    expect(
      container.querySelectorAll('[data-testid="equity-badge-text"]').length,
    ).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// AC 4 — Preset toolbar hidden under player policy
// ---------------------------------------------------------------------------

describe('<CameraPresetToolbar> player-mode lockout (T-026 AC 4)', () => {
  it('renders null when viewer.policy === "player"', () => {
    const { container } = render(
      <CameraPresetToolbar
        value="default"
        onChange={() => {}}
        viewer={PLAYER_SEAT_2}
      />,
    );
    expect(container.querySelector('[data-testid="camera-preset-toolbar"]')).toBeNull();
    // Render result is empty (no visible toolbar DOM).
    expect(container.textContent).toBe('');
  });
});

// ---------------------------------------------------------------------------
// AC 5 — Integration: zero /equity fetches across a full hand lifecycle
//        preflop → flop → turn → river → showdown.
// ---------------------------------------------------------------------------

describe('<PokerTable> player-mode — full hand lifecycle (AC 5)', () => {
  it('fires zero fetchEquity calls across all 5 phases with equityOverlay=true', async () => {
    mockEquitiesForAllSeats();
    const Wrapper = wrapWithQueryClient();
    const flop: [CardRef, CardRef, CardRef, null, null] = [
      card('2h'),
      card('7s'),
      card('Jd'),
      null,
      null,
    ];
    const turn: [CardRef, CardRef, CardRef, CardRef, null] = [
      card('2h'),
      card('7s'),
      card('Jd'),
      card('9c'),
      null,
    ];
    const river: [CardRef, CardRef, CardRef, CardRef, CardRef] = [
      card('2h'),
      card('7s'),
      card('Jd'),
      card('9c'),
      card('4d'),
    ];

    const phases: Array<Partial<TableState>> = [
      { phase: 'preflop', streetIndex: 0, community: [null, null, null, null, null] },
      { phase: 'flop', streetIndex: 1, community: flop },
      { phase: 'turn', streetIndex: 2, community: turn },
      { phase: 'river', streetIndex: 3, community: river },
      { phase: 'showdown', streetIndex: 4, community: river },
    ];

    const { rerender, container } = render(
      <Wrapper>
        <PokerTable
          state={makeState(phases[0])}
          viewer={PLAYER_SEAT_2}
          equityOverlay={true}
        />
      </Wrapper>,
    );

    for (const next of phases.slice(1)) {
      rerender(
        <Wrapper>
          <PokerTable
            state={makeState(next)}
            viewer={PLAYER_SEAT_2}
            equityOverlay={true}
          />
        </Wrapper>,
      );
      await settle();
    }

    // Must never have called the equity endpoint.
    expect(fetchEquity).not.toHaveBeenCalled();
    // Must never have rendered any equity badge.
    expect(container.querySelector('group[name="equity-badges"]')).toBeNull();
    // Sanity: we reached showdown with all 5 community cards rendered.
    await waitFor(() =>
      expect(
        container.querySelectorAll(
          'group[name="community-cards"] mesh[name="card"]',
        ).length,
      ).toBe(5),
    );
  });
});


// ---------------------------------------------------------------------------
// T-018 carry-forward (Cycle 27 M-1) — action highlights render under
// `viewer.policy === 'player'`. Cycle 27 closed `aia-core-olix` with AC 3
// PARTIAL because the highlights production surface hadn't landed yet.
// Now that T-018 ships, assert that fold-dim / bet-glow / turn-pulse are
// all observable under player policy (regression anchor).
// ---------------------------------------------------------------------------

import {
  BET_GLOW_DURATION_MS,
  FOLDED_PAD_OPACITY,
  FOLDED_NAMEPLATE_OPACITY,
} from '../../src/scenes3d/components/SeatHighlight';

function readOpacityAttr(el: Element | null): number {
  if (!el) throw new Error('readOpacityAttr: null element');
  return Number(el.getAttribute('opacity'));
}

describe('<PokerTable> player-mode — action highlights (T-018 / Cycle 27 M-1 carry-forward)', () => {
  it('AC 3 surfaces: fold-dim + bet-glow + turn-pulse all render under player policy', () => {
    const state: TableState = makeState({
      currentSeat: 3,
      seats: [
        makeSeat(0, {
          lastAction: { action: 'bet', amount: 10, street: 'preflop' },
        }),
        makeSeat(1, { folded: true }),
        makeSeat(2),
        makeSeat(3),
        makeSeat(4),
        makeSeat(5),
      ],
    });
    const { container } = render(
      <PokerTable state={state} viewer={PLAYER_SEAT_2} />,
    );

    // Fold-dim on seat 1 pad + nameplate.
    const foldedPad = container.querySelector(
      'group[name="seat-1"] mesh[name="seat-pad"] meshStandardMaterial',
    );
    expect(readOpacityAttr(foldedPad)).toBe(FOLDED_PAD_OPACITY);
    const foldedNameplate = container.querySelector(
      'group[name="nameplate-1"] mesh[name="nameplate-card"] meshBasicMaterial',
    );
    expect(readOpacityAttr(foldedNameplate)).toBe(FOLDED_NAMEPLATE_OPACITY);

    // Bet glow on seat 0.
    expect(container.querySelector('group[name="bet-glow-0"]')).not.toBeNull();

    // Single turn-pulse ring at currentSeat = 3.
    expect(
      container.querySelectorAll('mesh[name="turn-pulse-ring"]').length,
    ).toBe(1);
    expect(
      container.querySelector('group[name="turn-pulse-ring-3"]'),
    ).not.toBeNull();
  });

  it('bet-glow auto-clears after 1500ms under player policy', () => {
    vi.useFakeTimers();
    try {
      const state: TableState = makeState({
        seats: [
          makeSeat(0, {
            lastAction: { action: 'raise', amount: 20, street: 'preflop' },
          }),
          ...Array.from({ length: 5 }, (_, i) => makeSeat(i + 1)),
        ],
      });
      const { container } = render(
        <PokerTable state={state} viewer={PLAYER_SEAT_2} />,
      );
      expect(container.querySelector('group[name="bet-glow-0"]')).not.toBeNull();
      act(() => {
        vi.advanceTimersByTime(BET_GLOW_DURATION_MS + 50);
      });
      expect(container.querySelector('group[name="bet-glow-0"]')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('turn pulse follows currentSeat changes under player policy', () => {
    const { container, rerender } = render(
      <PokerTable
        state={makeState({ currentSeat: 1 })}
        viewer={PLAYER_SEAT_2}
      />,
    );
    expect(
      container.querySelector('group[name="turn-pulse-ring-1"]'),
    ).not.toBeNull();
    rerender(
      <PokerTable
        state={makeState({ currentSeat: 4 })}
        viewer={PLAYER_SEAT_2}
      />,
    );
    expect(container.querySelector('group[name="turn-pulse-ring-1"]')).toBeNull();
    expect(
      container.querySelector('group[name="turn-pulse-ring-4"]'),
    ).not.toBeNull();
    expect(
      container.querySelectorAll('mesh[name="turn-pulse-ring"]').length,
    ).toBe(1);
  });
});
