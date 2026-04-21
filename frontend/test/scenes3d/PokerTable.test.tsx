/** @vitest-environment happy-dom */
import { StrictMode } from 'react';
import { describe, it, expect, afterEach, beforeAll, afterAll, vi } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';

// happy-dom has no WebGL. Silence R3F "unknown element" warnings so real
// failures still surface.
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

// Mock drei so <CameraRig> mounts without an R3F context. Captures the
// props forwarded to <OrbitControls> / <PerspectiveCamera> for assertions.
const orbitPropsSpy = vi.fn<(props: Record<string, unknown>) => void>();
const cameraPropsSpy = vi.fn<(props: Record<string, unknown>) => void>();
vi.mock('@react-three/drei', () => ({
  OrbitControls: (props: Record<string, unknown>) => {
    orbitPropsSpy(props);
    return <div data-testid="mock-orbit-controls" />;
  },
  PerspectiveCamera: (props: Record<string, unknown>) => {
    cameraPropsSpy(props);
    return <div data-testid="mock-perspective-camera" />;
  },
  Environment: (props: Record<string, unknown>) => (
    <div
      data-testid="mock-environment"
      data-preset={String(props.preset ?? '')}
      data-resolution={String(props.resolution ?? '')}
      data-background={String(props.background ?? '')}
    />
  ),
  // <Nameplate> uses drei <Text> for real WebGL text rasterization
  // (bug aia-core-ovhb). happy-dom has no WebGL, so we shim it to a
  // plain div carrying the rendered label via `data-text`.
  Text: (props: Record<string, unknown> & { children?: unknown }) => {
    const name = typeof props.name === 'string' ? props.name : 'drei-text';
    return (
      <div
        data-testid={name}
        data-text={String(props.children ?? '')}
      />
    );
  },
}));

// Mock R3F so <DealAnimationDriver>'s useFrame doesn't require a <Canvas>.
// Captures the registered frame callback so tests can assert the driver
// has actually mounted (guards against silent regressions in the bug fix
// for aia-core-ji66 — deal-animation driver wiring into <PokerTable>).
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
  CardRef,
} from '../../src/scenes3d/types';
import {
  __getTestProbe,
  DENOMINATIONS,
  chipCountsFor,
} from '../../src/scenes3d/components/ChipInstances';
import {
  POT_CHIP_WORLD_POSITION,
  seatCommitChipWorldPosition,
} from '../../src/scenes3d/components/tableLayout';
import { computeSeatYawCenter } from '../../src/scenes3d/animations/cameraPresets';
import { QUALITY_TIER_SETTINGS } from '../../src/scenes3d/state/qualitySettings';

afterEach(() => {
  cleanup();
  orbitPropsSpy.mockClear();
  cameraPropsSpy.mockClear();
  __getTestProbe().reset();
  frameCallbacks.length = 0;
});

// ---------------------------------------------------------------------------
// Fixture helpers
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
    dealerSeat: null,
    sbSeat: null,
    bbSeat: null,
    currentSeat: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// <PokerTable> — scene composition
// ---------------------------------------------------------------------------

describe('<PokerTable>', () => {
  it('mounts without throwing', () => {
    expect(() => render(<PokerTable state={makeState()} />)).not.toThrow();
  });

  it('renders a single <Table> (felt + rail) and a named scene root', () => {
    const { container } = render(<PokerTable state={makeState()} />);
    expect(container.querySelector('group[name="poker-table-scene"]')).not.toBeNull();
    expect(container.querySelector('group[name="table"]')).not.toBeNull();
    expect(container.querySelector('mesh[name="table-felt"]')).not.toBeNull();
    expect(container.querySelector('mesh[name="table-rail"]')).not.toBeNull();
  });

  it('forwards theme.feltColor / theme.railColor to <Table>', () => {
    const { container } = render(
      <PokerTable
        state={makeState()}
        theme={{ feltColor: '#abcdef', railColor: '#112233' }}
      />,
    );
    const felt = container.querySelector('mesh[name="table-felt"]');
    const rail = container.querySelector('mesh[name="table-rail"]');
    // The props are forwarded onto <meshStandardMaterial color="..."> which
    // appears as a child element — both meshes render with the supplied color.
    expect(felt!.innerHTML).toContain('abcdef');
    expect(rail!.innerHTML).toContain('112233');
  });

  it('renders one <Seat> group per seat in state.seats', () => {
    const { container } = render(
      <PokerTable state={makeState({ seats: Array.from({ length: 9 }, (_, i) => makeSeat(i)) })} />,
    );
    const seatGroups = container.querySelectorAll(
      'group[name^="seat-"]:not([name="seat-anchor"])',
    );
    // Excludes the outer <group name="seats"> container (no hyphen match for index).
    expect(seatGroups).toHaveLength(9);
  });

  // -------------------------------------------------------------------------
  // Community cards
  // -------------------------------------------------------------------------

  it('renders only revealed (non-null) community cards, face-up', () => {
    const state = makeState({
      phase: 'turn',
      streetIndex: 2,
      community: [card('Ah'), card('Kd'), card('2c'), card('7s'), null],
    });
    const { container } = render(<PokerTable state={state} />);
    const community = container.querySelector('group[name="community-cards"]')!;
    const cards = community.querySelectorAll('mesh[name="card"]');
    expect(cards).toHaveLength(4);
    // All face-up
    for (const c of cards) {
      expect(c.getAttribute('data-face-up')).toBe('true');
    }
    // Ids in order
    const ids = Array.from(cards).map((c) => c.getAttribute('data-card-id'));
    expect(ids).toEqual(['Ah', 'Kd', '2c', '7s']);
  });

  it('renders zero community cards preflop (all slots null)', () => {
    const { container } = render(<PokerTable state={makeState()} />);
    const community = container.querySelector('group[name="community-cards"]')!;
    expect(community.querySelectorAll('mesh[name="card"]')).toHaveLength(0);
  });

  it('renders all 5 community cards at showdown', () => {
    const state = makeState({
      phase: 'showdown',
      streetIndex: 4,
      community: [card('Ah'), card('Kd'), card('2c'), card('7s'), card('9h')],
    });
    const { container } = render(<PokerTable state={state} />);
    expect(
      container.querySelectorAll('group[name="community-cards"] mesh[name="card"]'),
    ).toHaveLength(5);
  });

  // -------------------------------------------------------------------------
  // Hole cards (placeholder — T-024 will refine visibility)
  // -------------------------------------------------------------------------

  it('renders 2 face-down hole-card placeholders per active non-folded seat', () => {
    const state = makeState({
      seats: [
        makeSeat(0), // active, not folded → 2 cards
        makeSeat(1, { folded: true }), // folded → 0 cards
        makeSeat(2, { isActive: false, playerName: null }), // empty → 0 cards
        makeSeat(3), // active → 2 cards
      ],
    });
    const { container } = render(<PokerTable state={state} />);
    const holeGroups = container.querySelectorAll('group[name="hole-cards"]');
    expect(holeGroups).toHaveLength(2);
    const cards = container.querySelectorAll(
      'group[name="hole-cards"] mesh[name="card"]',
    );
    expect(cards).toHaveLength(4);
    // All face-down placeholders — T-024 flips the viewer's own seat up.
    for (const c of cards) {
      expect(c.getAttribute('data-face-up')).toBe('false');
      expect(c.getAttribute('data-card-id')).toBe('back');
    }
  });

  it('does not render hole cards for folded or empty seats', () => {
    const state = makeState({
      seats: [
        makeSeat(0, { folded: true }),
        makeSeat(1, { isActive: false, playerName: null }),
      ],
    });
    const { container } = render(<PokerTable state={state} />);
    expect(container.querySelectorAll('group[name="hole-cards"]')).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // Chip stacks — pot + per-seat committed
  // -------------------------------------------------------------------------

  it('renders a pot chip stack sized to state.pot', () => {
    const state = makeState({ pot: 5 });
    render(<PokerTable state={state} />);
    const meshes = __getTestProbe().getMeshes();
    // $5 pot → 5 Black chips, nothing else.
    expect(meshes.Black.count).toBe(5);
    expect(meshes.Green.count).toBe(0);
    expect(meshes.Red.count).toBe(0);
    expect(meshes.White.count).toBe(0);
  });

  it('omits the pot chip stack when state.pot === 0', () => {
    render(<PokerTable state={makeState()} />);
    const meshes = __getTestProbe().getMeshes();
    for (const denom of DENOMINATIONS) {
      expect(meshes[denom.name].count).toBe(0);
    }
  });

  it('aggregates pot + per-seat committedThisStreet chip counts', () => {
    // Pot=$3, seat0 committed $1, seat1 committed $2
    const state = makeState({
      pot: 3,
      seats: [
        makeSeat(0, { committedThisStreet: 1 }),
        makeSeat(1, { committedThisStreet: 2 }),
        makeSeat(2),
      ],
    });
    render(<PokerTable state={state} />);
    const meshes = __getTestProbe().getMeshes();
    // Black: 3 (pot) + 1 (seat0) + 2 (seat1) = 6
    expect(meshes.Black.count).toBe(6);
  });

  it('does not register a chip stack for seats with committedThisStreet = 0', () => {
    const state = makeState({
      pot: 0,
      seats: [makeSeat(0, { committedThisStreet: 0 })],
    });
    render(<PokerTable state={state} />);
    const meshes = __getTestProbe().getMeshes();
    for (const denom of DENOMINATIONS) {
      expect(meshes[denom.name].count).toBe(0);
    }
  });

  // -------------------------------------------------------------------------
  // AC 2: state prop changes re-render without remounting
  // -------------------------------------------------------------------------

  it('updates on state prop change without recreating the ChipInstances meshes', () => {
    const s1 = makeState({ pot: 2 });
    const { rerender } = render(<PokerTable state={s1} />);
    const meshesBefore = __getTestProbe().getMeshes();
    const blackBefore = meshesBefore.Black;
    expect(blackBefore.count).toBe(2);

    const s2 = makeState({ pot: 7 });
    rerender(<PokerTable state={s2} />);

    const meshesAfter = __getTestProbe().getMeshes();
    // Same InstancedMesh identity — no reallocation across the state change.
    expect(meshesAfter.Black).toBe(blackBefore);
    expect(meshesAfter.Black.count).toBe(7);
  });

  it('updates community cards when state.community changes', () => {
    const preflop = makeState();
    const { container, rerender } = render(<PokerTable state={preflop} />);
    expect(
      container.querySelectorAll('group[name="community-cards"] mesh[name="card"]'),
    ).toHaveLength(0);

    const flop = makeState({
      phase: 'flop',
      streetIndex: 1,
      community: [card('Ah'), card('Kd'), card('2c'), null, null],
    });
    rerender(<PokerTable state={flop} />);
    expect(
      container.querySelectorAll('group[name="community-cards"] mesh[name="card"]'),
    ).toHaveLength(3);
  });

  // -------------------------------------------------------------------------
  // Viewer / CameraRig wiring
  // -------------------------------------------------------------------------

  it('wires viewer.policy="spectator" through to CameraRig (free yaw)', () => {
    render(<PokerTable state={makeState()} viewer={{ policy: 'spectator' }} />);
    expect(orbitPropsSpy).toHaveBeenCalled();
    const props = orbitPropsSpy.mock.calls.at(-1)![0];
    expect(props.minAzimuthAngle).toBe(-Infinity);
    expect(props.maxAzimuthAngle).toBe(Infinity);
    expect(props.enablePan).toBe(true);
  });

  it('wires viewer.policy="player" through to CameraRig (seat-POV lock, pan off)', () => {
    // T-026 — player-mode camera is locked to the viewer seat POV, so the
    // ±30° yaw clamp is centered on the seat's world radial rather than
    // world-yaw 0. Assert via the seat-specific `computeSeatYawCenter`.
    render(
      <PokerTable
        state={makeState()}
        viewer={{ policy: 'player', seat: 2 }}
      />,
    );
    const props = orbitPropsSpy.mock.calls.at(-1)![0];
    const yaw = computeSeatYawCenter(2, 6);
    expect(props.minAzimuthAngle).toBeCloseTo(yaw - Math.PI / 6, 6);
    expect(props.maxAzimuthAngle).toBeCloseTo(yaw + Math.PI / 6, 6);
    expect(props.enablePan).toBe(false);
  });

  // -------------------------------------------------------------------------
  // onReady lifecycle
  // -------------------------------------------------------------------------

  it('fires onReady exactly once on mount', () => {
    const onReady = vi.fn();
    const { rerender } = render(
      <PokerTable state={makeState()} onReady={onReady} />,
    );
    expect(onReady).toHaveBeenCalledTimes(1);
    rerender(<PokerTable state={makeState({ pot: 5 })} onReady={onReady} />);
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it('fires onReady exactly once under React StrictMode (dev double-mount)', () => {
    // StrictMode in development intentionally runs effects
    // mount → cleanup → mount to surface unsafe side effects. A ref sentinel
    // in <PokerTable> must dedupe so onReady fires at most once per instance.
    const onReady = vi.fn();
    render(
      <StrictMode>
        <PokerTable state={makeState()} onReady={onReady} />
      </StrictMode>,
    );
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // DealAnimationDriver wiring (aia-core-ji66 — T-010 AC verification guard)
  // -------------------------------------------------------------------------

  it('mounts <DealAnimationDriver> which registers a useFrame callback', () => {
    // Observable animation for the T-010 ACs is verified end-to-end in
    // test/scenes3d/DealAnimationDriver.integration.test.tsx against real
    // THREE.Object3D targets. This assertion guards the wiring contract:
    // if <PokerTable> ever stops mounting the driver, the integration
    // coverage would become dead code.
    render(<PokerTable state={makeState()} />);
    expect(frameCallbacks.length).toBeGreaterThanOrEqual(1);
    // The registered callback must be safe to invoke even when the rig has
    // nothing to animate (fresh mount, no state transition yet).
    expect(() => frameCallbacks[0]({}, 0.016)).not.toThrow();
  });

  // -------------------------------------------------------------------------
  // Parity counts (AC 3)
  // -------------------------------------------------------------------------

  it('parity: 9-seat hand at flop with pot + 3 committed seats', () => {
    const state = makeState({
      phase: 'flop',
      streetIndex: 1,
      community: [card('Ah'), card('Kd'), card('2c'), null, null],
      pot: 5,
      seats: [
        makeSeat(0, { committedThisStreet: 1 }),
        makeSeat(1, { committedThisStreet: 2 }),
        makeSeat(2, { committedThisStreet: 0, folded: true }),
        makeSeat(3, { committedThisStreet: 2 }),
        makeSeat(4, { isActive: false, playerName: null }),
        makeSeat(5),
        makeSeat(6),
        makeSeat(7),
        makeSeat(8),
      ],
    });
    const { container } = render(<PokerTable state={state} />);

    // 9 seat pads
    expect(
      container.querySelectorAll('group[name^="seat-"]:not([name="seat-anchor"])'),
    ).toHaveLength(9);
    // 3 revealed community cards
    expect(
      container.querySelectorAll('group[name="community-cards"] mesh[name="card"]'),
    ).toHaveLength(3);
    // active & not-folded seats: 0,1,3,5,6,7,8 → 7 seats × 2 = 14 hole cards
    expect(
      container.querySelectorAll('group[name="hole-cards"] mesh[name="card"]'),
    ).toHaveLength(14);
    // Chip decomposition: pot=$5 + 1+2+2 committed = $10 → 10 Black chips
    const meshes = __getTestProbe().getMeshes();
    const expected = chipCountsFor(10, 20);
    expect(meshes.Black.count).toBe(expected.Black);
    expect(meshes.Green.count).toBe(expected.Green);
    expect(meshes.Red.count).toBe(expected.Red);
    expect(meshes.White.count).toBe(expected.White);
  });
});

// ---------------------------------------------------------------------------
// T-025 — visibility policy routed through <Card faceUp>
// ---------------------------------------------------------------------------

describe('<PokerTable> — T-025 hole-card visibility policy', () => {
  function holeCardsOfSeat(container: HTMLElement, seatIndex: number) {
    const seat = container.querySelector(
      `group[name="seat-${seatIndex}"]`,
    ) as HTMLElement | null;
    return seat
      ? Array.from(seat.querySelectorAll('group[name="hole-cards"] mesh[name="card"]'))
      : [];
  }
  const hc = (id: string): CardRef => card(id);

  it('AC 3: own hole cards always render face-up under player policy', () => {
    const state = makeState({
      phase: 'preflop',
      seats: [
        makeSeat(0, { holeCards: [hc('Ah'), hc('Kd')] }),
        makeSeat(1, { holeCards: [hc('2c'), hc('3c')] }),
      ],
    });
    const { container } = render(
      <PokerTable state={state} viewer={{ policy: 'player', seat: 0 }} />,
    );
    const own = holeCardsOfSeat(container, 0);
    expect(own).toHaveLength(2);
    for (const c of own) {
      expect(c.getAttribute('data-face-up')).toBe('true');
      expect(c.getAttribute('data-testid')).toBe('card-face-up');
    }
    const ids = own.map((c) => c.getAttribute('data-card-id'));
    expect(ids).toEqual(['Ah', 'Kd']);
  });

  it('AC 1 & 4: opponent hole cards render face-down pre-showdown under player policy', () => {
    const state = makeState({
      phase: 'preflop',
      seats: [
        makeSeat(0, { holeCards: [hc('Ah'), hc('Kd')] }),
        makeSeat(1, { holeCards: [hc('2c'), hc('3c')] }),
        makeSeat(2, { holeCards: [hc('7s'), hc('7h')] }),
      ],
    });
    const { container } = render(
      <PokerTable state={state} viewer={{ policy: 'player', seat: 0 }} />,
    );
    // AC 4: no opponent card has faceUp=true pre-showdown.
    for (const seatIndex of [1, 2]) {
      const cards = holeCardsOfSeat(container, seatIndex);
      expect(cards).toHaveLength(2);
      for (const c of cards) {
        expect(c.getAttribute('data-face-up')).toBe('false');
        expect(c.getAttribute('data-card-id')).toBe('back');
      }
    }
  });

  it('AC 1: folded opponent hole cards never render face-up (even at showdown)', () => {
    // Folded seats currently do not render hole cards at all (T-009 behavior),
    // which trivially satisfies AC 1. Guard the invariant against regressions:
    // if we ever do render folded-seat hole cards, they must remain face-down.
    const state = makeState({
      phase: 'showdown',
      streetIndex: 4,
      seats: [
        makeSeat(0, { holeCards: [hc('Ah'), hc('Kd')] }),
        makeSeat(1, { folded: true, holeCards: [hc('2c'), hc('3c')] }),
      ],
    });
    const { container } = render(
      <PokerTable state={state} viewer={{ policy: 'player', seat: 0 }} />,
    );
    const all = container.querySelectorAll(
      'group[name="hole-cards"] mesh[name="card"]',
    );
    for (const c of all) {
      const ownerSeatGroup = c.closest('group[name^="seat-"]') as HTMLElement | null;
      if (ownerSeatGroup?.getAttribute('name') === 'seat-1') {
        expect(c.getAttribute('data-face-up')).toBe('false');
      }
    }
  });

  it('AC 2: non-folded opponents reveal at showdown under player policy', () => {
    const state = makeState({
      phase: 'showdown',
      streetIndex: 4,
      seats: [
        makeSeat(0, { holeCards: [hc('Ah'), hc('Kd')] }),
        makeSeat(1, { holeCards: [hc('2c'), hc('3c')] }),
      ],
    });
    const { container } = render(
      <PokerTable state={state} viewer={{ policy: 'player', seat: 0 }} />,
    );
    const opp = holeCardsOfSeat(container, 1);
    expect(opp).toHaveLength(2);
    const ids = opp.map((c) => c.getAttribute('data-card-id'));
    expect(ids).toEqual(['2c', '3c']);
    for (const c of opp) {
      expect(c.getAttribute('data-face-up')).toBe('true');
      expect(c.getAttribute('data-testid')).toBe('card-face-up');
    }
  });

  it('spectator policy: all hole cards face-down pre-showdown', () => {
    const state = makeState({
      phase: 'turn',
      streetIndex: 2,
      seats: [
        makeSeat(0, { holeCards: [hc('Ah'), hc('Kd')] }),
        makeSeat(1, { holeCards: [hc('2c'), hc('3c')] }),
      ],
    });
    const { container } = render(
      <PokerTable state={state} viewer={{ policy: 'spectator' }} />,
    );
    const cards = container.querySelectorAll(
      'group[name="hole-cards"] mesh[name="card"]',
    );
    for (const c of cards) {
      expect(c.getAttribute('data-face-up')).toBe('false');
    }
  });

  it('spectator policy: non-folded seats reveal at showdown', () => {
    const state = makeState({
      phase: 'showdown',
      streetIndex: 4,
      seats: [
        makeSeat(0, { holeCards: [hc('Ah'), hc('Kd')] }),
        makeSeat(1, { holeCards: [hc('2c'), hc('3c')] }),
      ],
    });
    const { container } = render(
      <PokerTable state={state} viewer={{ policy: 'spectator' }} />,
    );
    const cards = container.querySelectorAll(
      'group[name="hole-cards"] mesh[name="card"]',
    );
    expect(cards).toHaveLength(4);
    for (const c of cards) {
      expect(c.getAttribute('data-face-up')).toBe('true');
    }
  });

  it('default viewer (prop omitted) behaves as spectator', () => {
    // Pre-showdown → all face-down.
    const pre = makeState({
      phase: 'flop',
      streetIndex: 1,
      seats: [makeSeat(0, { holeCards: [hc('Ah'), hc('Kd')] })],
    });
    const { container: preC, unmount } = render(<PokerTable state={pre} />);
    const preCards = preC.querySelectorAll(
      'group[name="hole-cards"] mesh[name="card"]',
    );
    for (const c of preCards) {
      expect(c.getAttribute('data-face-up')).toBe('false');
    }
    unmount();

    // Showdown → revealed (spectator default).
    const sd = makeState({
      phase: 'showdown',
      streetIndex: 4,
      seats: [makeSeat(0, { holeCards: [hc('Ah'), hc('Kd')] })],
    });
    const { container: sdC } = render(<PokerTable state={sd} />);
    const sdCards = sdC.querySelectorAll(
      'group[name="hole-cards"] mesh[name="card"]',
    );
    expect(sdCards).toHaveLength(2);
    for (const c of sdCards) {
      expect(c.getAttribute('data-face-up')).toBe('true');
    }
  });

  it('renders face-down back when own seat has no holeCards payload yet', () => {
    // Mid-deal: faceUp resolves true for viewer's own seat, but the payload
    // hasn't populated holeCards yet — <Card> must still render the back.
    const state = makeState({
      phase: 'preflop',
      seats: [makeSeat(0, { holeCards: null })],
    });
    const { container } = render(
      <PokerTable state={state} viewer={{ policy: 'player', seat: 0 }} />,
    );
    const own = holeCardsOfSeat(container, 0);
    expect(own).toHaveLength(2);
    for (const c of own) {
      // faceUp is true (policy allows it), but id resolves to null → back face.
      expect(c.getAttribute('data-face-up')).toBe('true');
      expect(c.getAttribute('data-card-id')).toBe('back');
    }
  });
});

// ---------------------------------------------------------------------------
// Chip-slide integration (BUG-CYCLE19-01 — T-011 observable ACs in-canvas)
// ---------------------------------------------------------------------------

describe('<PokerTable> — chip-slide integration', () => {
  const SEAT_COUNT = 6;

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
    // 500ms > 400ms CHIP_SLIDE_DURATION_MS → all tweens complete.
    // Wrap in act() so React state updates triggered by onSlideComplete
    // callbacks are flushed before assertions.
    act(() => {
      for (const cb of [...frameCallbacks]) {
        cb({}, 0.5);
      }
    });
  }

  it('AC 1: seat ChipStack shrinks within one frame of a bet action', () => {
    const s0 = makeState({ pot: 3 });
    const { rerender } = render(<PokerTable state={s0} />);

    const s1 = makeState({
      pot: 3,
      seats: [
        makeSeat(0, { committedThisStreet: 10 }),
        ...Array.from({ length: SEAT_COUNT - 1 }, (_, i) => makeSeat(i + 1)),
      ],
    });
    rerender(<PokerTable state={s1} />);

    // After the rerender: driver has synced, slide started, seat0's
    // committed-chip ChipStack is hidden (display = 10 - 10 - 0 = 0),
    // a flying-slug ChipStack has been registered (amount = 10).
    const stacks = __getTestProbe().getStacks();
    const seat0Pos = seatCommitChipWorldPosition(0, SEAT_COUNT);
    // Seat0's committed stack at the commit position is hidden...
    const seat0Stacks = stacks.filter(
      (s) =>
        Math.abs(s.position[0] - seat0Pos[0]) < 1e-6 &&
        Math.abs(s.position[1] - seat0Pos[1]) < 1e-6 &&
        Math.abs(s.position[2] - seat0Pos[2]) < 1e-6,
    );
    // ...but the flying slug starts at the same seat0 position (tween
    // `from`), carrying the same 10 chips. So exactly one stack at the
    // seat0 position, amount = 10 (the slug, not the committed stack).
    expect(seat0Stacks).toHaveLength(1);
    expect(seat0Stacks[0].amount).toBe(10);

    // Pot stack has not yet grown: state.pot + deposited(0) = 3.
    const potStack = findStackNear(stacks, POT_CHIP_WORLD_POSITION);
    expect(potStack).toBeDefined();
    expect(potStack!.amount).toBe(3);

    // No spurious extra stacks (no committed stack + slug stack both at seat).
    // 1 pot + 1 slug = 2 total for this bet-in-flight scenario.
    expect(stacks).toHaveLength(2);
  });

  it('AC 2: pot ChipStack grows to state.pot + delta after tween completes', () => {
    const s0 = makeState({ pot: 3 });
    const { rerender } = render(<PokerTable state={s0} />);

    const s1 = makeState({
      pot: 3,
      seats: [
        makeSeat(0, { committedThisStreet: 10 }),
        ...Array.from({ length: SEAT_COUNT - 1 }, (_, i) => makeSeat(i + 1)),
      ],
    });
    rerender(<PokerTable state={s1} />);

    driveAllFramesToCompletion();

    const stacks = __getTestProbe().getStacks();
    // Pot grew by 10 → pot_display = 3 + 10 = 13. Slug gone. Seat0
    // committed stack stays hidden because deposited(0)=10 absorbs it.
    const potStack = findStackNear(stacks, POT_CHIP_WORLD_POSITION);
    expect(potStack).toBeDefined();
    expect(potStack!.amount).toBe(13);

    const seat0Pos = seatCommitChipWorldPosition(0, SEAT_COUNT);
    const seat0Stack = findStackNear(stacks, seat0Pos);
    expect(seat0Stack).toBeUndefined();

    // Total chips visible: only the pot stack (13 Black chips).
    expect(stacks).toHaveLength(1);
    expect(__getTestProbe().getMeshes().Black.count).toBe(13);
  });

  it('AC 4: two concurrent seat bets — both shrink + both arrive at pot', () => {
    const s0 = makeState({ pot: 3 });
    const { rerender } = render(<PokerTable state={s0} />);

    const s1 = makeState({
      pot: 3,
      seats: [
        makeSeat(0, { committedThisStreet: 10 }),
        makeSeat(1, { committedThisStreet: 5 }),
        ...Array.from({ length: SEAT_COUNT - 2 }, (_, i) => makeSeat(i + 2)),
      ],
    });
    rerender(<PokerTable state={s1} />);

    // Before frames advance: two flying slugs, pot unchanged, both seat
    // committed stacks hidden. 1 pot + 2 slugs = 3.
    const midStacks = __getTestProbe().getStacks();
    expect(midStacks).toHaveLength(3);
    expect(findStackNear(midStacks, POT_CHIP_WORLD_POSITION)!.amount).toBe(3);

    driveAllFramesToCompletion();

    const stacks = __getTestProbe().getStacks();
    // Pot = 3 + 10 + 5 = 18. No slugs. No seat committed stacks visible.
    expect(stacks).toHaveLength(1);
    expect(findStackNear(stacks, POT_CHIP_WORLD_POSITION)!.amount).toBe(18);
  });

  it('AC 3: fold does not trigger a slide', () => {
    // Prime: seat0 committed $10 on preflop (no slide — first render, prev=null).
    const s0 = makeState({
      pot: 3,
      seats: [
        makeSeat(0, { committedThisStreet: 10 }),
        makeSeat(1, { committedThisStreet: 5 }),
        ...Array.from({ length: SEAT_COUNT - 2 }, (_, i) => makeSeat(i + 2)),
      ],
    });
    const { rerender } = render(<PokerTable state={s0} />);
    // Seat1 folds on the same street — committedThisStreet stays 5,
    // `folded` flips to true. No slide should fire.
    const s1 = makeState({
      pot: 3,
      seats: [
        makeSeat(0, { committedThisStreet: 10 }),
        makeSeat(1, { committedThisStreet: 5, folded: true }),
        ...Array.from({ length: SEAT_COUNT - 2 }, (_, i) => makeSeat(i + 2)),
      ],
    });
    rerender(<PokerTable state={s1} />);

    const stacks = __getTestProbe().getStacks();
    // No slug was registered → pot=3, seat0=10, seat1=5 (fold doesn't
    // clear `committedThisStreet`; it persists until the street ends).
    // 1 pot + 1 seat0 + 1 seat1 = 3 stacks.
    expect(stacks).toHaveLength(3);
    expect(findStackNear(stacks, POT_CHIP_WORLD_POSITION)!.amount).toBe(3);
    expect(
      findStackNear(stacks, seatCommitChipWorldPosition(0, SEAT_COUNT))!.amount,
    ).toBe(10);
    expect(
      findStackNear(stacks, seatCommitChipWorldPosition(1, SEAT_COUNT))!.amount,
    ).toBe(5);
  });

  it('street transition clears in-flight slide without negative seat displays', () => {
    // Bet fires; before frames advance, street transitions (mid-flight edge).
    const s0 = makeState({ pot: 3 });
    const { rerender } = render(<PokerTable state={s0} />);

    const betting = makeState({
      pot: 3,
      seats: [
        makeSeat(0, { committedThisStreet: 10 }),
        ...Array.from({ length: SEAT_COUNT - 1 }, (_, i) => makeSeat(i + 1)),
      ],
    });
    rerender(<PokerTable state={betting} />);

    // Confirm slide is in flight (1 pot + 1 slug).
    expect(__getTestProbe().getStacks()).toHaveLength(2);

    // Street ends: `state.pot` absorbs the $10 commit, committedThisStreet
    // resets to 0, streetIndex advances to 1.
    const flop = makeState({
      pot: 13,
      streetIndex: 1,
      phase: 'flop',
      seats: Array.from({ length: SEAT_COUNT }, (_, i) => makeSeat(i)),
    });
    rerender(<PokerTable state={flop} />);

    const stacks = __getTestProbe().getStacks();
    // Only the pot stack remains; no seat stacks (all committed=0); no
    // slug (controller canceled on scope change).
    expect(stacks).toHaveLength(1);
    const potStack = findStackNear(stacks, POT_CHIP_WORLD_POSITION);
    expect(potStack!.amount).toBe(13);
    // Crucially: no ChipStack has a negative amount or is registered at
    // a seat position (which would indicate the render consumer computed
    // a negative `committedThisStreet - inFlight`).
    for (const s of stacks) {
      expect(s.amount).toBeGreaterThanOrEqual(0);
    }
  });

  it('mounts <ChipSlideDriver> which registers its own useFrame callback', () => {
    render(<PokerTable state={makeState()} />);
    // At minimum: DealAnimationDriver + ChipSlideDriver. The chip-slide
    // slug components only mount when there are active slides, so the
    // count of >= 2 verifies both top-level drivers are wired.
    expect(frameCallbacks.length).toBeGreaterThanOrEqual(2);
  });
});


// ---------------------------------------------------------------------------
// T-014 — PBR lighting + env map wiring on <PokerTable>
// ---------------------------------------------------------------------------

describe('<PokerTable> — T-014 PBR lighting + env map', () => {
  it('renders the key directional light with a stable name', () => {
    const { container } = render(<PokerTable state={makeState()} />);
    const keyLight = container.querySelector('directionalLight[name="key-light"]');
    expect(keyLight).not.toBeNull();
  });

  it('AC-4: on qualityTier="medium" the key light omits shadow-map sizing (shadows off)', () => {
    const { container } = render(
      <PokerTable state={makeState()} qualityTier="medium" />,
    );
    const keyLight = container.querySelector(
      'directionalLight[name="key-light"]',
    )!;
    // React drops boolean `castShadow={false}` on unknown intrinsics. The
    // production code mirrors that signal by only emitting the hyphenated
    // `shadow-mapSize-*` R3F shortcuts when shadows are enabled, so their
    // absence here is the AC-4 observable.
    expect(keyLight.hasAttribute('shadow-mapSize-width')).toBe(false);
    expect(keyLight.hasAttribute('shadow-mapsize-width')).toBe(false);
  });

  it('AC-4: on qualityTier="high" the key light casts shadows (shadow-map props emitted)', () => {
    const { container } = render(
      <PokerTable state={makeState()} qualityTier="high" />,
    );
    const keyLight = container.querySelector(
      'directionalLight[name="key-light"]',
    )!;
    const size =
      keyLight.getAttribute('shadow-mapsize-width') ??
      keyLight.getAttribute('shadow-mapSize-width');
    expect(size).not.toBeNull();
    expect(Number(size)).toBeGreaterThanOrEqual(512);
  });

  it('AC-4: qualityTier="low" omits the env map entirely', () => {
    const { container } = render(
      <PokerTable state={makeState()} qualityTier="low" />,
    );
    expect(container.querySelector('[data-testid="mock-environment"]')).toBeNull();
  });

  it('AC-4: qualityTier="medium" attaches a baked env map at the canonical resolution (T-038: reads from QUALITY_TIER_SETTINGS)', () => {
    const { container } = render(
      <PokerTable state={makeState()} qualityTier="medium" />,
    );
    const env = container.querySelector('[data-testid="mock-environment"]');
    expect(env).not.toBeNull();
    // T-038 Item-2 (Cycle 39 L-2): the live render must read from
    // QUALITY_TIER_SETTINGS[tier].envMap.resolution — NO inline literal
    // on the call site. plan.md § Quality Tiers: Medium = 256² baked.
    const res = Number(env!.getAttribute('data-resolution'));
    expect(res).toBe(QUALITY_TIER_SETTINGS.medium.envMap.resolution);
    expect(res).toBe(256);
    // Env map must not render as skybox (visual background owned by theme).
    expect(env!.getAttribute('data-background')).toBe('false');
  });

  it('AC-4: qualityTier="high" uses the drei preset default (no explicit resolution) per plan.md (T-038: closes Cycle 38 M-1 drift)', () => {
    const { container } = render(
      <PokerTable state={makeState()} qualityTier="high" />,
    );
    const env = container.querySelector('[data-testid="mock-environment"]');
    expect(env).not.toBeNull();
    // QUALITY_TIER_SETTINGS.high.envMap.resolution === null → caller does
    // NOT pass a resolution prop → drei preset default wins. Mock stringifies
    // `undefined` to '', so an empty data-resolution is the observable.
    expect(QUALITY_TIER_SETTINGS.high.envMap.resolution).toBeNull();
    expect(env!.getAttribute('data-resolution')).toBe('');
    expect(env!.getAttribute('data-background')).toBe('false');
  });

  it('forwards qualityTier to <Table> so felt/rail materials still render', () => {
    const { container } = render(
      <PokerTable state={makeState()} qualityTier="low" />,
    );
    expect(
      container.querySelector(
        'mesh[name="table-felt"] meshstandardmaterial[name="felt-pbr"]',
      ),
    ).not.toBeNull();
    expect(
      container.querySelector(
        'mesh[name="table-rail"] meshstandardmaterial[name="rail-pbr"]',
      ),
    ).not.toBeNull();
  });
});
