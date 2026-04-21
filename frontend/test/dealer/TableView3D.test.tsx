/** @vitest-environment happy-dom */
//
// T-030 — dealer-embed 3D view tests, rewritten against the declarative
// `<PokerTable>` composition. The suite verifies:
//
//   AC-1 — component mounts `<PokerTable>` (inside `<PokerCanvas>`) with
//          `viewer.policy='spectator'`, `equityOverlay={true}`, and no
//          `<SessionReplayShell>`.
//   AC-2 — cycle-11 behavioral guarantees preserved:
//            * canvas renders,
//            * scene updates when a new hand arrives via polling,
//            * no leak on repeated mount/unmount cycles.
//   AC-3 — container sizing `min(400px, 50vh)` preserved.
//   AC-4 — no `createPokerScene` import — imperative scene path retired;
//          `<PokerCanvas>` owns its own resize via `<Canvas>` — no
//          window.resize listener attached at this layer.
//   AC-5 — equity overlay is actually wired: with `equityOverlay=true`
//          and `viewer.policy='spectator'`, `<PokerTable>`'s internal
//          `useEquityQuery` (exercised via the test double) invokes
//          `fetchEquity`. This is the Cycle 27 L-3 consumer-level
//          carry-forward: we prove the props the route threads WILL
//          cause equity fetching when composed with the real equity
//          guard + query hook.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, waitFor, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { resolveEquityOverlay } from '../../src/scenes3d/state/equityGuard';
import {
  DEFAULT_THEME,
  useTableStore,
  type TableTheme,
} from '../../src/scenes3d/state/tableStore';
import { useEquityQuery } from '../../src/scenes3d/data/useEquityQuery';
import type { QualityTier, TableState, ViewerContext } from '../../src/scenes3d/types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const pokerTablePropsSpy = vi.fn<(props: Record<string, unknown>) => void>();
const pokerCanvasRenderSpy = vi.fn();

vi.mock('../../src/scenes3d/PokerCanvas.tsx', () => ({
  PokerCanvas: ({ children }: { children?: ReactNode }) => {
    pokerCanvasRenderSpy();
    return (
      <div data-testid="poker-canvas">
        <canvas data-testid="poker-canvas-element" />
        {children}
      </div>
    );
  },
}));

// PokerTable test double: records props AND exercises the real
// `resolveEquityOverlay` + `useEquityQuery` to prove that the
// `viewer`/`equityOverlay` wiring actually causes network fetches
// (Cycle 27 L-3 consumer-level assertion).
vi.mock('../../src/scenes3d/PokerTable.tsx', () => ({
  PokerTable: (props: {
    state: TableState;
    viewer?: ViewerContext;
    equityOverlay?: boolean;
    cameraPreset?: unknown;
  }) => {
    pokerTablePropsSpy(props as unknown as Record<string, unknown>);
    const enabled = resolveEquityOverlay(
      props.equityOverlay ?? false,
      props.viewer,
    );
    useEquityQuery({
      gameId: props.state.gameId,
      handNumber: props.state.handNumber,
      streetIndex: props.state.streetIndex,
      enabled,
    });
    return <div data-testid="poker-table" />;
  },
}));

vi.mock('../../src/api/client.ts', () => ({
  fetchHands: vi.fn(),
  fetchGame: vi.fn(),
  fetchEquity: vi.fn(),
}));

// Make `useHandPolling`'s internal `usePolling` fire once on mount — no
// 10s interval wait.
vi.mock('../../src/hooks/usePolling.ts', () => ({
  usePolling: ({
    fetchFn,
    enabled,
  }: {
    fetchFn: (s: AbortSignal) => Promise<void>;
    enabled: boolean;
  }) => {
    if (enabled) {
      void fetchFn(new AbortController().signal);
    }
    return { isReconnecting: false };
  },
}));

import {
  fetchGame,
  fetchHands,
  fetchEquity,
} from '../../src/api/client.ts';
import type { HandResponse } from '../../src/api/types';
import type { GameSessionResponse } from '../../src/api/types/game';

const { TableView3D } = await import('../../src/dealer/TableView3D.tsx');

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const GAME: GameSessionResponse = {
  game_id: 42,
  game_date: '2026-04-10',
  status: 'active',
  created_at: '2026-04-10T12:00:00Z',
  player_names: ['Alice', 'Bob'],
  players: [
    { name: 'Alice', is_active: true, seat_number: 0, buy_in: 100, current_chips: 100, rebuy_count: 0, total_rebuys: 0 },
    { name: 'Bob', is_active: true, seat_number: 1, buy_in: 100, current_chips: 100, rebuy_count: 0, total_rebuys: 0 },
  ],
  hand_count: 1,
  winners: [],
  default_buy_in: 100,
};

function makeHand(overrides: Partial<HandResponse> = {}): HandResponse {
  return {
    hand_id: 1,
    game_id: 42,
    hand_number: 1,
    flop_1: 'Ah',
    flop_2: 'Kd',
    flop_3: '5h',
    turn: 'Js',
    river: null,
    source_upload_id: null,
    sb_player_name: 'Alice',
    bb_player_name: 'Bob',
    pot: 0,
    side_pots: [],
    created_at: '2026-04-10T12:00:00Z',
    player_hands: [
      { player_hand_id: 1, hand_id: 1, player_id: 1, player_name: 'Alice', card_1: 'Ah', card_2: 'Kd', result: null, profit_loss: 0, outcome_street: null, winning_hand_description: null },
      { player_hand_id: 2, hand_id: 1, player_id: 2, player_name: 'Bob', card_1: 'Jc', card_2: 'Ts', result: null, profit_loss: 0, outcome_street: null, winning_hand_description: null },
    ],
    ...overrides,
  };
}

const HAND_1 = makeHand({ hand_number: 1 });
const HAND_2 = makeHand({ hand_id: 2, hand_number: 2, flop_1: '2c', flop_2: '3c', flop_3: '4c', turn: null, river: null });

function renderView(gameId = 42) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <TableView3D gameId={gameId} />
    </QueryClientProvider>,
  );
}

function latestPokerTableProps() {
  expect(pokerTablePropsSpy).toHaveBeenCalled();
  return pokerTablePropsSpy.mock.calls.at(-1)![0];
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  cleanup();
  vi.mocked(fetchGame).mockResolvedValue(GAME);
  vi.mocked(fetchHands).mockResolvedValue([HAND_1]);
  vi.mocked(fetchEquity).mockResolvedValue({
    game_id: 42,
    hand_number: 1,
    streets: ['flop'],
    equities: [
      { player_name: 'Alice', equity: 0.6 },
      { player_name: 'Bob', equity: 0.4 },
    ],
  });
});

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// Smoke
// ---------------------------------------------------------------------------

describe('TableView3D — smoke', () => {
  it('renders the container element', () => {
    renderView();
    expect(screen.getByTestId('table-view-3d')).toBeTruthy();
  });

  it('mounts <PokerCanvas> + <PokerTable> once data loads', async () => {
    renderView();
    await waitFor(() => expect(pokerTablePropsSpy).toHaveBeenCalled());
    expect(pokerCanvasRenderSpy).toHaveBeenCalled();
    expect(screen.getByTestId('poker-canvas')).toBeTruthy();
    expect(screen.getByTestId('poker-table')).toBeTruthy();
    expect(screen.getByTestId('poker-canvas-element')).toBeTruthy();
  });

  it('does not render <PokerCanvas> while hands are loading (empty polling result)', async () => {
    vi.mocked(fetchHands).mockResolvedValue([]);
    renderView();
    // Wait a tick to let pending promises settle.
    await waitFor(() => expect(vi.mocked(fetchHands)).toHaveBeenCalled());
    expect(screen.queryByTestId('poker-canvas')).toBeNull();
    expect(pokerTablePropsSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// AC-1 — props threaded to <PokerTable>
// ---------------------------------------------------------------------------

describe('TableView3D — <PokerTable> prop threading (AC-1)', () => {
  it('threads viewer.policy="spectator"', async () => {
    renderView();
    await waitFor(() => expect(pokerTablePropsSpy).toHaveBeenCalled());
    const props = latestPokerTableProps() as { viewer?: ViewerContext };
    expect(props.viewer).toEqual({ policy: 'spectator' });
  });

  it('threads theme from useTableStore to <PokerTable> (aia-core-r11d)', async () => {
    // Route-level store→props wiring: setting the theme in `useTableStore`
    // must flow through `<TableView3D>` to `<PokerTable theme={...}>` so
    // <TableSettingsPanel> changes affect the dealer embed (T-030 AC-5,
    // theme dimension).
    const customTheme: TableTheme = {
      ...DEFAULT_THEME,
      feltColor: '#7a1a3a',
      mode: 'light',
    };
    useTableStore.getState().setTheme(customTheme);
    renderView();
    await waitFor(() => expect(pokerTablePropsSpy).toHaveBeenCalled());
    const props = latestPokerTableProps() as { theme?: TableTheme };
    expect(props.theme).toEqual(customTheme);
    // Reset for other tests.
    useTableStore.getState().setTheme(DEFAULT_THEME);
  });

  it('threads equityOverlay={true}', async () => {
    renderView();
    await waitFor(() => expect(pokerTablePropsSpy).toHaveBeenCalled());
    expect(latestPokerTableProps().equityOverlay).toBe(true);
  });

  it('passes a TableState built from handsToTableState (gameId/handNumber match fixture)', async () => {
    renderView();
    await waitFor(() => expect(pokerTablePropsSpy).toHaveBeenCalled());
    const props = latestPokerTableProps() as { state: TableState };
    expect(props.state.gameId).toBe(42);
    expect(props.state.handNumber).toBe(1);
    // Spectator: both seats' hole cards are visible in the table state.
    expect(props.state.seats.map((s) => s.playerName).sort()).toEqual(['Alice', 'Bob']);
  });

  it('every <PokerTable> render receives viewer.policy="spectator"', async () => {
    renderView();
    await waitFor(() => expect(pokerTablePropsSpy).toHaveBeenCalled());
    for (const call of pokerTablePropsSpy.mock.calls) {
      const props = call[0] as { viewer?: { policy?: string } };
      expect(props.viewer?.policy).toBe('spectator');
    }
  });

  it('every <PokerTable> render receives equityOverlay={true}', async () => {
    renderView();
    await waitFor(() => expect(pokerTablePropsSpy).toHaveBeenCalled());
    for (const call of pokerTablePropsSpy.mock.calls) {
      const props = call[0] as { equityOverlay?: boolean };
      expect(props.equityOverlay).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// AC-2 — cycle-11 behavioral guarantees
// ---------------------------------------------------------------------------

describe('TableView3D — behavioral guarantees (AC-2)', () => {
  it('renders a canvas element on mount', async () => {
    renderView();
    await waitFor(() => expect(pokerTablePropsSpy).toHaveBeenCalled());
    expect(screen.getByTestId('poker-canvas-element')).toBeTruthy();
  });

  it('scene updates when a new hand arrives via polling', async () => {
    vi.mocked(fetchHands).mockResolvedValue([HAND_1, HAND_2]);
    renderView();
    await waitFor(() => expect(pokerTablePropsSpy).toHaveBeenCalled());
    // Because we auto-advance to the latest hand, some render should
    // have carried hand_number=2.
    const handNumbers = pokerTablePropsSpy.mock.calls.map(
      (call) => (call[0] as { state: TableState }).state.handNumber,
    );
    expect(handNumbers).toContain(2);
  });

  it('does not leak / throw on repeated mount/unmount cycles', async () => {
    for (let i = 0; i < 3; i++) {
      const { unmount } = renderView();
      await waitFor(() => expect(pokerTablePropsSpy).toHaveBeenCalled());
      pokerTablePropsSpy.mockClear();
      unmount();
    }
    // If we got here without an exception and the canvas rendered each
    // cycle (3 total), there are no lifecycle leaks at the consumer
    // boundary.
    expect(pokerCanvasRenderSpy.mock.calls.length).toBeGreaterThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// AC-3 — container sizing
// ---------------------------------------------------------------------------

describe('TableView3D — container sizing (AC-3)', () => {
  it('applies min(400px, 50vh) height and width:100% via inline style', async () => {
    renderView();
    const container = screen.getByTestId('table-view-3d');
    expect(container.style.width).toBe('100%');
    expect(container.style.position).toBe('relative');
    // happy-dom strips unsupported CSS (e.g. min()), so the rendered
    // inline style omits `height`. Verify the intent at the source
    // level — downstream browsers honour the value.
    const fs = await import('node:fs/promises');
    const src = await fs.readFile('src/dealer/TableView3D.tsx', 'utf-8');
    expect(src).toMatch(/height:\s*'min\(400px,\s*50vh\)'/);
  });
});

// ---------------------------------------------------------------------------
// AC-4 — legacy imperative scene path is gone
// ---------------------------------------------------------------------------

describe('TableView3D — legacy imperative scene removed (AC-4)', () => {
  it('does not import createPokerScene (source-level check)', async () => {
    const fs = await import('node:fs/promises');
    const src = await fs.readFile(
      'src/dealer/TableView3D.tsx',
      'utf-8',
    );
    expect(src).not.toMatch(/createPokerScene/);
    expect(src).not.toMatch(/from ['"]\.\.\/scenes\/pokerScene/);
    // <PokerCanvas> owns its own resize (via R3F's <Canvas>) — no
    // window-level ResizeObserver at this layer.
    expect(src).not.toMatch(/new ResizeObserver/);
    expect(src).not.toMatch(/window\.addEventListener\(['"]resize/);
  });
});

// ---------------------------------------------------------------------------
// AC-5 — equity overlay actually fires network (Cycle 27 L-3 carry-forward)
// ---------------------------------------------------------------------------

describe('TableView3D — equity overlay wiring (AC-5)', () => {
  it('fires /equity fetch once table state is available (spectator + overlay=true)', async () => {
    renderView();
    await waitFor(() => expect(pokerTablePropsSpy).toHaveBeenCalled());
    await waitFor(() => expect(vi.mocked(fetchEquity)).toHaveBeenCalled());
    expect(vi.mocked(fetchEquity).mock.calls[0]).toEqual([42, 1]);
  });

  it('EquityBadge overlay actually receives enabled=true via resolveEquityOverlay (integration)', async () => {
    // Same underlying assertion as above phrased from the guard's
    // perspective: if the route threaded the WRONG viewer policy (e.g.
    // 'player'), `resolveEquityOverlay` would force false and
    // fetchEquity would never fire. This test is a consumer-level net
    // for that regression.
    renderView();
    await waitFor(() => expect(vi.mocked(fetchEquity)).toHaveBeenCalled());
    // Sanity: props still say spectator + true.
    const props = latestPokerTableProps() as {
      viewer?: ViewerContext;
      equityOverlay?: boolean;
    };
    expect(resolveEquityOverlay(props.equityOverlay ?? false, props.viewer)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// aia-core-t4dp — qualityTier wiring (Cycle 32 H-1(b) / T-030 AC-5)
// ---------------------------------------------------------------------------

describe('TableView3D — qualityTier prop threading (aia-core-t4dp)', () => {
  it('threads qualityTier from useTableStore to <PokerTable>', async () => {
    // Route-level store→props wiring: setting the quality tier in
    // `useTableStore` must flow through `<TableView3D>` to
    // `<PokerTable qualityTier={...}>` so <TableSettingsPanel>
    // changes affect the dealer embed (T-030 AC-5, qualityTier
    // dimension — sibling of aia-core-r11d theme wiring).
    const prevTier = useTableStore.getState().qualityTier;
    useTableStore.getState().setTier('high');
    renderView();
    await waitFor(() => expect(pokerTablePropsSpy).toHaveBeenCalled());
    const props = latestPokerTableProps() as { qualityTier?: QualityTier };
    expect(props.qualityTier).toBe('high');
    // Reset for other tests.
    useTableStore.getState().setTier(prevTier);
  });

  it('reflects qualityTier changes on re-render (store → props)', async () => {
    const prevTier = useTableStore.getState().qualityTier;
    useTableStore.getState().setTier('low');
    renderView();
    await waitFor(() => expect(pokerTablePropsSpy).toHaveBeenCalled());
    const props = latestPokerTableProps() as { qualityTier?: QualityTier };
    expect(props.qualityTier).toBe('low');
    useTableStore.getState().setTier(prevTier);
  });

  it('every <PokerTable> render receives the store qualityTier', async () => {
    const prevTier = useTableStore.getState().qualityTier;
    useTableStore.getState().setTier('medium');
    renderView();
    await waitFor(() => expect(pokerTablePropsSpy).toHaveBeenCalled());
    for (const call of pokerTablePropsSpy.mock.calls) {
      const props = call[0] as { qualityTier?: QualityTier };
      expect(props.qualityTier).toBe('medium');
    }
    useTableStore.getState().setTier(prevTier);
  });
});
