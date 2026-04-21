/** @vitest-environment happy-dom */
import {
  describe,
  it,
  expect,
  afterEach,
  beforeAll,
  afterAll,
  vi,
} from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Mocks — R3F + drei, same pattern as Nameplate/PokerTable tests. `<Text>`
// becomes a plain div so we can read the label via `data-text`.
// ---------------------------------------------------------------------------
vi.mock('@react-three/fiber', () => ({
  useFrame: () => {},
  Canvas: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

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
    return (
      <div data-testid={name} data-text={String(props.children ?? '')} />
    );
  },
}));

// Stub the API client so we can observe fetch-count. MUST come before the
// module under test imports it.
vi.mock('../../src/api/client', () => ({
  fetchEquity: vi.fn(),
}));

import { fetchEquity } from '../../src/api/client';
import {
  EquityBadge,
  EquityBadges,
  formatEquityPercent,
  countSeatsWithHoleCards,
  computeEquityBadgeWorldPosition,
  EQUITY_BADGE_LOCAL_Y,
} from '../../src/scenes3d/components/EquityBadge';
import { PokerTable } from '../../src/scenes3d/PokerTable';
import type {
  CardRef,
  SeatState,
  TableState,
  ViewerContext,
} from '../../src/scenes3d/types';
import { seatAnchorLocalToWorld } from '../../src/scenes3d/components/tableLayout';

// ---------------------------------------------------------------------------
// happy-dom has no WebGL. Silence R3F "unknown element" warnings.
// ---------------------------------------------------------------------------
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
    phase: 'flop',
    streetIndex: 1,
    community: [card('2h'), card('7s'), card('Jd'), null, null],
    seats: [
      makeSeat(0, { holeCards: defaultHoleCards }),
      makeSeat(1, { holeCards: defaultHoleCards }),
      makeSeat(2, { holeCards: defaultHoleCards }),
      makeSeat(3),
      makeSeat(4),
      makeSeat(5),
    ],
    pot: 0,
    sidePots: [],
    dealerSeat: null,
    sbSeat: null,
    bbSeat: null,
    currentSeat: null,
    ...overrides,
  };
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

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

describe('formatEquityPercent', () => {
  it('formats 0..1 values as one-decimal percentages', () => {
    expect(formatEquityPercent(0)).toBe('0.0%');
    expect(formatEquityPercent(0.5)).toBe('50.0%');
    expect(formatEquityPercent(0.6234)).toBe('62.3%');
    expect(formatEquityPercent(1)).toBe('100.0%');
  });

  it('clamps out-of-range inputs', () => {
    expect(formatEquityPercent(-0.5)).toBe('0.0%');
    expect(formatEquityPercent(1.5)).toBe('100.0%');
  });

  it('returns a dash placeholder for non-finite inputs', () => {
    expect(formatEquityPercent(Number.NaN)).toBe('—');
    expect(formatEquityPercent(Number.POSITIVE_INFINITY)).toBe('—');
  });
});

describe('countSeatsWithHoleCards', () => {
  it('counts only seats where holeCards != null', () => {
    const state = makeState({
      seats: [
        makeSeat(0, { holeCards: [card('Ah'), card('Ks')] }),
        makeSeat(1, { holeCards: null }),
        makeSeat(2, { holeCards: [card('2c'), card('3d')] }),
      ],
    });
    expect(countSeatsWithHoleCards(state)).toBe(2);
  });
});

describe('computeEquityBadgeWorldPosition', () => {
  it('lifts the seat anchor by EQUITY_BADGE_LOCAL_Y', () => {
    const pos = computeEquityBadgeWorldPosition(0, 6);
    const expected = seatAnchorLocalToWorld(0, 6, [0, EQUITY_BADGE_LOCAL_Y, 0]);
    expect(pos).toEqual(expected);
  });
});

// ---------------------------------------------------------------------------
// <EquityBadge> dumb leaf
// ---------------------------------------------------------------------------

describe('<EquityBadge>', () => {
  it('renders a named group with the formatted percent label', () => {
    const { container } = render(<EquityBadge seatIndex={2} seatCount={6} equity={0.7} />);
    const group = container.querySelector('group[name="equity-badge-2"]');
    expect(group).not.toBeNull();
    const textEl = container.querySelector('[data-testid="equity-badge-text"]');
    expect(textEl?.getAttribute('data-text')).toBe('70.0%');
  });
});

// ---------------------------------------------------------------------------
// <EquityBadges> smart wrapper — triple-layer gate
// ---------------------------------------------------------------------------

const SPECTATOR: ViewerContext = { policy: 'spectator' };
const PLAYER: ViewerContext = { policy: 'player', seat: 0 };

async function settle() {
  // Yield so react-query can flush any async updates.
  await new Promise((r) => setTimeout(r, 20));
}

function mockEquitiesForAllSeats(count = 3) {
  const equities = Array.from({ length: count }, (_, i) => ({
    player_name: `P${i}`,
    equity: 0.3 + i * 0.1,
    winning_hand_description: null,
  }));
  vi.mocked(fetchEquity).mockResolvedValue({ equities });
}

describe('<EquityBadges> triple-layer gate', () => {
  it('does not fetch and renders nothing when equityOverlay=false (spectator)', async () => {
    const Wrapper = wrapWithQueryClient();
    mockEquitiesForAllSeats();
    const { container } = render(
      <Wrapper>
        <EquityBadges state={makeState()} viewer={SPECTATOR} equityOverlay={false} />
      </Wrapper>,
    );
    await settle();
    expect(fetchEquity).not.toHaveBeenCalled();
    expect(container.querySelector('group[name="equity-badges"]')).toBeNull();
  });

  it('fetches and renders badges when equityOverlay=true + spectator + ≥2 hole cards (AC 7b)', async () => {
    const Wrapper = wrapWithQueryClient();
    mockEquitiesForAllSeats();
    const { container } = render(
      <Wrapper>
        <EquityBadges state={makeState()} viewer={SPECTATOR} equityOverlay={true} />
      </Wrapper>,
    );
    await waitFor(() =>
      expect(container.querySelector('group[name="equity-badges"]')).not.toBeNull(),
    );
    expect(fetchEquity).toHaveBeenCalledTimes(1);
    expect(fetchEquity).toHaveBeenCalledWith(7, 12);
    // One badge per seat with hole cards that appears in the response.
    expect(container.querySelectorAll('[data-testid="equity-badge-text"]').length).toBe(3);
  });

  it('never fetches and never renders under player policy — even with equityOverlay=true (AC 2, AC 7a)', async () => {
    const Wrapper = wrapWithQueryClient();
    mockEquitiesForAllSeats();
    const { container } = render(
      <Wrapper>
        <EquityBadges state={makeState()} viewer={PLAYER} equityOverlay={true} />
      </Wrapper>,
    );
    await settle();
    expect(fetchEquity).not.toHaveBeenCalled();
    expect(container.querySelector('group[name="equity-badges"]')).toBeNull();
    expect(container.querySelectorAll('[data-testid="equity-badge-text"]').length).toBe(0);
  });

  it('hides badges when fewer than 2 seats have hole cards (AC 3)', async () => {
    const Wrapper = wrapWithQueryClient();
    mockEquitiesForAllSeats();
    // Only seat 0 has hole cards.
    const state = makeState({
      seats: [
        makeSeat(0, { holeCards: [card('Ah'), card('Ks')] }),
        makeSeat(1),
        makeSeat(2),
        makeSeat(3),
        makeSeat(4),
        makeSeat(5),
      ],
    });
    const { container } = render(
      <Wrapper>
        <EquityBadges state={state} viewer={SPECTATOR} equityOverlay={true} />
      </Wrapper>,
    );
    await settle();
    // Fetch is allowed (gate pure on overlay+policy), but render is blocked.
    expect(container.querySelector('group[name="equity-badges"]')).toBeNull();
  });

  it('silently hides on fetch failure — no error UI (AC 5)', async () => {
    const Wrapper = wrapWithQueryClient();
    vi.mocked(fetchEquity).mockRejectedValue(new Error('boom'));
    const { container } = render(
      <Wrapper>
        <EquityBadges state={makeState()} viewer={SPECTATOR} equityOverlay={true} />
      </Wrapper>,
    );
    await settle();
    // Fetcher ran but data never landed.
    expect(fetchEquity).toHaveBeenCalledTimes(1);
    expect(container.querySelector('group[name="equity-badges"]')).toBeNull();
    // No error DOM emitted.
    expect(container.textContent ?? '').not.toMatch(/error|fail/i);
  });

  it('re-fetches on street change (AC 4) — different query key', async () => {
    const Wrapper = wrapWithQueryClient();
    mockEquitiesForAllSeats();

    const { container, rerender } = render(
      <Wrapper>
        <EquityBadges
          state={makeState({ streetIndex: 1 })}
          viewer={SPECTATOR}
          equityOverlay={true}
        />
      </Wrapper>,
    );
    await waitFor(() =>
      expect(container.querySelector('group[name="equity-badges"]')).not.toBeNull(),
    );
    expect(fetchEquity).toHaveBeenCalledTimes(1);

    rerender(
      <Wrapper>
        <EquityBadges
          state={makeState({ streetIndex: 2 })}
          viewer={SPECTATOR}
          equityOverlay={true}
        />
      </Wrapper>,
    );
    await waitFor(() => expect(fetchEquity).toHaveBeenCalledTimes(2));
  });
});

// ---------------------------------------------------------------------------
// <PokerTable> integration — prop plumbing
// ---------------------------------------------------------------------------

describe('<PokerTable equityOverlay>', () => {
  it('defaults equityOverlay to false — no fetch on mount', async () => {
    const Wrapper = wrapWithQueryClient();
    mockEquitiesForAllSeats();
    render(
      <Wrapper>
        <PokerTable state={makeState()} viewer={SPECTATOR} />
      </Wrapper>,
    );
    await settle();
    expect(fetchEquity).not.toHaveBeenCalled();
  });

  it('spectator + equityOverlay=true renders badges inside the scene graph', async () => {
    const Wrapper = wrapWithQueryClient();
    mockEquitiesForAllSeats();
    const { container } = render(
      <Wrapper>
        <PokerTable state={makeState()} viewer={SPECTATOR} equityOverlay={true} />
      </Wrapper>,
    );
    await waitFor(() =>
      expect(container.querySelector('group[name="equity-badges"]')).not.toBeNull(),
    );
    expect(fetchEquity).toHaveBeenCalledTimes(1);
  });

  it('player policy + equityOverlay=true — zero fetches, zero badges (T-020 AC 2, AC 7a)', async () => {
    const Wrapper = wrapWithQueryClient();
    mockEquitiesForAllSeats();
    const { container } = render(
      <Wrapper>
        <PokerTable
          state={makeState()}
          viewer={PLAYER}
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
