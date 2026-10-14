/** @vitest-environment happy-dom */
//
// T-032 — player-POV route tests, rewritten against the declarative
// `<PokerTable>` composition. The suite verifies:
//
//   AC-1 — route mounts `<PokerTable>` with `viewer.policy='player'`,
//          `viewer.seat=<viewerSeat>`, `equityOverlay={false}`, and no
//          `<SessionReplayShell>`.
//   AC-2 — legacy `handToPlayerCardData` + direct `isShowdown` are gone
//          (proven implicitly: the route no longer imports them; we
//          instead thread `viewer` through to `<PokerTable>` so
//          visibility flows via `canSee()` in `<Card.faceUp>`).
//   AC-4 — integration assertion: across preflop/flop/turn/river/
//          showdown, (b) zero `/equity` calls, (c) caller-supplied
//          `cameraPreset={ kind: 'seat', seat: viewerSeat }` — part (a)
//          (opponent cards not face-up) is enforced by `<PokerTable>`
//          itself (T-025/T-026 tests) and is verified here at the
//          consumer by assertion of the exact `viewer` prop threaded
//          through (Cycle 27 L-3 carry-forward).
//   AC-5 — the preset toolbar is not rendered by this route.
//
// The sister ESLint-rule AC (AC-3) is covered by
// `frontend/eslint-rules/no-equity-in-player.test.js`.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, fireEvent, waitFor, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Mocks — spy <PokerCanvas> + <PokerTable> so we can assert the exact
// props threaded through by the route without spinning up R3F.
// ---------------------------------------------------------------------------

const pokerTablePropsSpy = vi.fn<(props: Record<string, unknown>) => void>();
const pokerCanvasRenderSpy = vi.fn();

vi.mock('../../src/scenes3d/PokerCanvas.tsx', () => ({
  PokerCanvas: ({ children }: { children?: ReactNode }) => {
    pokerCanvasRenderSpy();
    return <div data-testid="poker-canvas">{children}</div>;
  },
}));

vi.mock('../../src/scenes3d/PokerTable.tsx', () => ({
  PokerTable: (props: Record<string, unknown>) => {
    pokerTablePropsSpy(props);
    return <div data-testid="poker-table" />;
  },
}));

// Mock API client — fetchEquity is listed even though the route never
// imports it; the spy exists so the "zero /equity calls" assertion is
// meaningful (a regression that accidentally wires equity fetching back
// in would be caught here too).
vi.mock('../../src/api/client.ts', () => ({
  fetchHands: vi.fn(),
  fetchGame: vi.fn(),
  fetchEquity: vi.fn(),
  fetchHandStatus: vi.fn(),
}));

// Mock usePolling so hand polling fires exactly once on mount — no 10s
// interval wait needed in tests.
vi.mock('../../src/hooks/usePolling.ts', () => ({
  usePolling: ({ fetchFn, enabled }: { fetchFn: (s: AbortSignal) => Promise<void>; enabled: boolean }) => {
    if (enabled) {
      void fetchFn(new AbortController().signal);
    }
    return { isReconnecting: false };
  },
}));

import { fetchHands, fetchGame, fetchEquity } from '../../src/api/client.ts';
import type { HandResponse } from '../../src/api/types';
import type { GameSessionResponse } from '../../src/api/types/game';

const { TableView } = await import('../../src/pages/TableView.tsx');

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const GAME: GameSessionResponse = {
  game_id: 5,
  game_date: '2026-04-10',
  status: 'active',
  created_at: '2026-04-10T12:00:00Z',
  player_names: ['Alice', 'Bob', 'Carol'],
  players: [
    { name: 'Alice', is_active: true, seat_number: 2, buy_in: 100, current_chips: 100, rebuy_count: 0, total_rebuys: 0 },
    { name: 'Bob', is_active: true, seat_number: 0, buy_in: 100, current_chips: 100, rebuy_count: 0, total_rebuys: 0 },
    { name: 'Carol', is_active: true, seat_number: 1, buy_in: 100, current_chips: 100, rebuy_count: 0, total_rebuys: 0 },
  ],
  hand_count: 1,
  winners: [],
  default_buy_in: 100,
};

function makeHand(overrides: Partial<HandResponse> = {}): HandResponse {
  return {
    hand_id: 1,
    game_id: 5,
    hand_number: 1,
    flop_1: null,
    flop_2: null,
    flop_3: null,
    turn: null,
    river: null,
    source_upload_id: null,
    sb_player_name: 'Bob',
    bb_player_name: 'Carol',
    pot: 0,
    side_pots: [],
    created_at: '2026-04-10T12:00:00Z',
    player_hands: [
      { player_hand_id: 1, hand_id: 1, player_id: 1, player_name: 'Alice', card_1: '2h', card_2: '3h', result: null, profit_loss: 0, outcome_street: null, winning_hand_description: null },
      { player_hand_id: 2, hand_id: 1, player_id: 2, player_name: 'Bob', card_1: '4d', card_2: '5d', result: null, profit_loss: 0, outcome_street: null, winning_hand_description: null },
      { player_hand_id: 3, hand_id: 1, player_id: 3, player_name: 'Carol', card_1: null, card_2: null, result: null, profit_loss: 0, outcome_street: null, winning_hand_description: null },
    ],
    ...overrides,
  };
}

const PREFLOP = makeHand();
const FLOP = makeHand({ flop_1: 'Ah', flop_2: 'Kd', flop_3: 'Qc' });
const TURN = makeHand({ flop_1: 'Ah', flop_2: 'Kd', flop_3: 'Qc', turn: 'Js' });
const RIVER = makeHand({ flop_1: 'Ah', flop_2: 'Kd', flop_3: 'Qc', turn: 'Js', river: 'Th' });
const SHOWDOWN = makeHand({
  flop_1: 'Ah', flop_2: 'Kd', flop_3: 'Qc', turn: 'Js', river: 'Th',
  player_hands: [
    { player_hand_id: 1, hand_id: 1, player_id: 1, player_name: 'Alice', card_1: '2h', card_2: '3h', result: 'won', profit_loss: 50, outcome_street: null, winning_hand_description: null },
    { player_hand_id: 2, hand_id: 1, player_id: 2, player_name: 'Bob', card_1: '4d', card_2: '5d', result: 'lost', profit_loss: -50, outcome_street: null, winning_hand_description: null },
    { player_hand_id: 3, hand_id: 1, player_id: 3, player_name: 'Carol', card_1: null, card_2: null, result: 'folded', profit_loss: 0, outcome_street: null, winning_hand_description: null },
  ],
});

function renderTableView(params = '?game=5&player=Alice') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/player/table${params}`]}>
        <Routes>
          <Route path="/player/table" element={<TableView />} />
          <Route path="/player" element={<div data-testid="player-app">Player App</div>} />
        </Routes>
      </MemoryRouter>
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
  vi.mocked(fetchHands).mockResolvedValue([PREFLOP]);
});

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// Route smoke + missing-param guards
// ---------------------------------------------------------------------------

describe('TableView — route smoke', () => {
  it('renders HUD bar and scrubber mount once data loads', async () => {
    renderTableView();
    await waitFor(() => expect(pokerTablePropsSpy).toHaveBeenCalled());
    expect(screen.getByTestId('hud-bar')).toBeTruthy();
    expect(screen.getByTestId('scrubber-mount')).toBeTruthy();
    expect(screen.getByTestId('canvas-area')).toBeTruthy();
  });

  it('uses flex column viewport', () => {
    const { container } = renderTableView();
    const viewport = container.firstElementChild as HTMLElement;
    expect(viewport.style.display).toBe('flex');
    expect(viewport.style.flexDirection).toBe('column');
  });

  it('shows Back to Hand button', async () => {
    renderTableView();
    await waitFor(() => expect(pokerTablePropsSpy).toHaveBeenCalled());
    const btn = screen.getByTestId('back-to-hand-btn');
    expect(btn.textContent).toContain('Back to Hand');
  });

  it('navigates back to /player on Back click', async () => {
    renderTableView();
    await waitFor(() => expect(pokerTablePropsSpy).toHaveBeenCalled());
    fireEvent.click(screen.getByTestId('back-to-hand-btn'));
    await waitFor(() => expect(screen.getByTestId('player-app')).toBeTruthy());
  });

  it('errors when game param is missing', () => {
    renderTableView('?player=Alice');
    expect(screen.getByText(/missing game/i)).toBeTruthy();
  });

  it('errors when player param is missing', () => {
    renderTableView('?game=5');
    expect(screen.getByText(/missing player/i)).toBeTruthy();
  });

  it('shows "No hands found" when the game has no hands', async () => {
    vi.mocked(fetchHands).mockResolvedValue([]);
    renderTableView();
    await waitFor(() => expect(screen.getByText(/no hands found/i)).toBeTruthy());
  });
});

// ---------------------------------------------------------------------------
// AC-1 — props threaded to <PokerTable>
// ---------------------------------------------------------------------------

describe('TableView — <PokerTable> prop threading (AC-1)', () => {
  it('mounts <PokerTable> inside <PokerCanvas>', async () => {
    renderTableView();
    await waitFor(() => expect(pokerTablePropsSpy).toHaveBeenCalled());
    expect(pokerCanvasRenderSpy).toHaveBeenCalled();
    expect(screen.getByTestId('poker-canvas')).toBeTruthy();
    expect(screen.getByTestId('poker-table')).toBeTruthy();
  });

  it('threads viewer.policy="player" and the correct viewer.seat', async () => {
    renderTableView('?game=5&player=Alice');
    await waitFor(() => expect(pokerTablePropsSpy).toHaveBeenCalled());
    const props = latestPokerTableProps();
    expect(props.viewer).toEqual({ policy: 'player', seat: 2 });
  });

  it('hard-forces equityOverlay={false}', async () => {
    renderTableView();
    await waitFor(() => expect(pokerTablePropsSpy).toHaveBeenCalled());
    expect(latestPokerTableProps().equityOverlay).toBe(false);
  });

  it('passes cameraPreset={ kind: "seat", seat: viewerSeat }', async () => {
    renderTableView('?game=5&player=Alice');
    await waitFor(() => expect(pokerTablePropsSpy).toHaveBeenCalled());
    expect(latestPokerTableProps().cameraPreset).toEqual({ kind: 'seat', seat: 2 });
  });

  it('passes a TableState built from handsToTableState with the viewer seat', async () => {
    renderTableView('?game=5&player=Alice');
    await waitFor(() => expect(pokerTablePropsSpy).toHaveBeenCalled());
    const props = latestPokerTableProps() as { state: { gameId: number; handNumber: number; seats: Array<{ seatIndex: number; playerName: string | null }> } };
    expect(props.state.gameId).toBe(5);
    expect(props.state.handNumber).toBe(1);
    // Alice sits at seat 2 — should be one of the seats in the table state.
    expect(props.state.seats.some((s) => s.playerName === 'Alice' && s.seatIndex === 2)).toBe(true);
  });

  it('uses a different viewer.seat for a different player param', async () => {
    renderTableView('?game=5&player=Bob');
    await waitFor(() => expect(pokerTablePropsSpy).toHaveBeenCalled());
    expect(latestPokerTableProps().viewer).toEqual({ policy: 'player', seat: 0 });
  });
});

// ---------------------------------------------------------------------------
// AC-2 — legacy imperative scene path is gone
// ---------------------------------------------------------------------------

describe('TableView — legacy imperative scene removed (AC-2)', () => {
  it('does not import createPokerScene (source-level check)', async () => {
    const fs = await import('node:fs/promises');
    const src = await fs.readFile(
      'src/pages/TableView.tsx',
      'utf-8',
    );
    expect(src).not.toMatch(/createPokerScene/);
    expect(src).not.toMatch(/handToPlayerCardData/);
    expect(src).not.toMatch(/from ['"]\.\.\/scenes\/showdown/);
  });
});

// ---------------------------------------------------------------------------
// AC-4 — consumer lockout (Cycle 27 L-3 carry-forward)
// ---------------------------------------------------------------------------

describe('TableView — consumer lockout integration (AC-4)', () => {
  it('fires zero /equity fetches across preflop → showdown lifecycle', async () => {
    const phases: HandResponse[][] = [[PREFLOP], [FLOP], [TURN], [RIVER], [SHOWDOWN]];
    for (const hands of phases) {
      vi.mocked(fetchHands).mockResolvedValue(hands);
      const { unmount } = renderTableView();
      await waitFor(() => expect(pokerTablePropsSpy).toHaveBeenCalled());
      unmount();
      pokerTablePropsSpy.mockClear();
    }
    expect(vi.mocked(fetchEquity)).not.toHaveBeenCalled();
  });

  it('every <PokerTable> render receives viewer.policy="player" (no spectator drift under polling)', async () => {
    renderTableView('?game=5&player=Alice');
    await waitFor(() => expect(pokerTablePropsSpy).toHaveBeenCalled());
    for (const call of pokerTablePropsSpy.mock.calls) {
      const props = call[0] as { viewer?: { policy?: string } };
      expect(props.viewer?.policy).toBe('player');
    }
  });

  it('every <PokerTable> render receives equityOverlay={false}', async () => {
    renderTableView('?game=5&player=Alice');
    await waitFor(() => expect(pokerTablePropsSpy).toHaveBeenCalled());
    for (const call of pokerTablePropsSpy.mock.calls) {
      const props = call[0] as { equityOverlay?: boolean };
      expect(props.equityOverlay).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// AC-5 — preset toolbar never mounted
// ---------------------------------------------------------------------------

describe('TableView — preset toolbar hidden (AC-5)', () => {
  it('does not render <CameraPresetToolbar> anywhere in the DOM', async () => {
    renderTableView();
    await waitFor(() => expect(pokerTablePropsSpy).toHaveBeenCalled());
    expect(screen.queryByTestId('camera-preset-toolbar')).toBeNull();
  });

  it('does not import CameraPresetToolbar in the route source', async () => {
    const fs = await import('node:fs/promises');
    const src = await fs.readFile(
      'src/pages/TableView.tsx',
      'utf-8',
    );
    expect(src).not.toMatch(/CameraPresetToolbar/);
  });
});

// ---------------------------------------------------------------------------
// Scrubber — keeps existing behaviour
// ---------------------------------------------------------------------------

describe('TableView — session scrubber', () => {
  const MULTI = [
    makeHand({ hand_id: 1, hand_number: 1 }),
    makeHand({ hand_id: 2, hand_number: 2, flop_1: '9s', flop_2: '8c', flop_3: '7h' }),
    makeHand({ hand_id: 3, hand_number: 3, flop_1: 'Ks', flop_2: 'Qs', flop_3: 'Js', turn: 'Ts', river: 'As' }),
  ];

  it('defaults to the latest hand', async () => {
    vi.mocked(fetchHands).mockResolvedValue(MULTI);
    renderTableView();
    await waitFor(() => expect(screen.getByTestId('session-label').textContent).toBe('Hand 3 / 3'));
  });

  it('changing the scrubber re-threads a new state into <PokerTable>', async () => {
    vi.mocked(fetchHands).mockResolvedValue(MULTI);
    renderTableView();
    await waitFor(() => expect(pokerTablePropsSpy).toHaveBeenCalled());
    pokerTablePropsSpy.mockClear();

    const slider = screen.getByTestId('session-slider');
    fireEvent.change(slider, { target: { value: '1' } });

    await waitFor(() => expect(pokerTablePropsSpy).toHaveBeenCalled());
    const props = latestPokerTableProps() as { state: { handNumber: number } };
    expect(props.state.handNumber).toBe(1);
  });
});
