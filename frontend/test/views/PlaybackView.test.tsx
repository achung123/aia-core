/** @vitest-environment happy-dom */
//
// T-031 — Full-page playback route tests, rewritten against the declarative
// `<PokerCanvas>` + `<PokerTable>` + `<SessionReplayShell>` composition.
//
// AC-1 — No-gameId prompt screen renders with `data-testid=playback-game-selector`.
// AC-2 — With a gameId, `<SessionReplayShell>` wraps `<PokerCanvas>`/`<PokerTable>`.
// AC-3 — `viewer.policy='spectator'` threaded to `<PokerTable>`.
// AC-4 — `equityOverlay={true}` threaded to `<PokerTable>`.
// AC-5 — `theme` + `qualityTier` flow from `useTableStore` into `<PokerTable>`.
// AC-6 — `<QualityToast>` mounted at the route root (Cycle 42 M-1).
// AC-7 — Back button navigates to `/data`.
// AC-8 — Active games poll `fetchHands` every 10s; completed games do not.
// AC-9 — Source file does NOT import `calculateEquity` or `createPokerScene`.
// AC-10 — Source file does NOT import `../poker/evaluator` or `../scenes/pokerScene`.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import {
  DEFAULT_THEME,
  DEFAULT_REPLAY,
  useTableStore,
} from '../../src/scenes3d/state/tableStore';
import type {
  QualityTier,
  TableState,
  ViewerContext,
} from '../../src/scenes3d/types';
import type {
  GameSessionResponse,
  HandResponse,
} from '../../src/api/types/game';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const shellPropsSpy = vi.fn<(props: Record<string, unknown>) => void>();
const pokerTablePropsSpy = vi.fn<(props: Record<string, unknown>) => void>();
const pokerCanvasRenderSpy = vi.fn();
const qualityToastRenderSpy = vi.fn();

const FAKE_TABLE_STATE = {
  gameId: 7,
  handId: 101,
  handNumber: 1,
  phase: 'preflop' as const,
  streetIndex: 0 as 0,
  community: [null, null, null, null, null],
  seats: [],
  pot: 0,
  sidePots: [],
  dealerSeat: null,
  sbSeat: null,
  bbSeat: null,
  currentSeat: null,
} as unknown as TableState;

vi.mock('../../src/scenes3d/SessionReplayShell.tsx', () => {
  return {
    SessionReplayShell: (props: Record<string, unknown> & { children?: ReactNode }) => {
      shellPropsSpy(props);
      return <div data-testid="session-replay-shell">{props.children}</div>;
    },
    useSessionReplayContext: () => ({
      tableState: FAKE_TABLE_STATE,
      viewer: { policy: 'spectator' } as ViewerContext,
      gameId: 7,
      game: null,
      hand: null,
      handIndex: 0,
      streetIndex: 0,
      speed: 1,
      isPlaying: false,
    }),
  };
});

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

vi.mock('../../src/scenes3d/components/QualityToast.tsx', () => ({
  QualityToast: () => {
    qualityToastRenderSpy();
    return <div data-testid="quality-toast" />;
  },
}));

vi.mock('../../src/api/client.ts', () => ({
  fetchGame: vi.fn(),
  fetchHands: vi.fn(),
}));

import { fetchGame, fetchHands } from '../../src/api/client.ts';
const { PlaybackView } = await import('../../src/views/PlaybackView.tsx');

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const COMPLETED_GAME: GameSessionResponse = {
  game_id: 7,
  game_date: '2026-04-05',
  status: 'completed',
  created_at: '2026-04-05T12:00:00Z',
  player_names: ['Alice', 'Bob'],
  players: [
    { name: 'Alice', is_active: true, seat_number: 0, buy_in: 100, current_chips: 100, rebuy_count: 0, total_rebuys: 0 },
    { name: 'Bob', is_active: true, seat_number: 1, buy_in: 100, current_chips: 100, rebuy_count: 0, total_rebuys: 0 },
  ],
  hand_count: 1,
  winners: [],
  default_buy_in: 100,
};

const ACTIVE_GAME: GameSessionResponse = { ...COMPLETED_GAME, game_id: 10, status: 'active' };

const HAND: HandResponse = {
  hand_id: 1,
  game_id: 7,
  hand_number: 1,
  flop_1: 'Ah',
  flop_2: 'Kd',
  flop_3: 'Qc',
  turn: null,
  river: null,
  source_upload_id: null,
  sb_player_name: null,
  bb_player_name: null,
  pot: 0,
  side_pots: [],
  created_at: '2026-04-05T12:00:00Z',
  player_hands: [],
};

function renderAt(path: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/playback" element={<PlaybackView />} />
          <Route path="/data" element={<div data-testid="data-view">Game Sessions</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const resetStore = () =>
  useTableStore.setState({
    theme: { ...DEFAULT_THEME },
    replay: { ...DEFAULT_REPLAY },
    qualityTier: 'high',
    manualOverride: false,
    tierToast: null,
  });

beforeEach(() => {
  vi.clearAllMocks();
  resetStore();
  vi.mocked(fetchGame).mockResolvedValue(COMPLETED_GAME);
  vi.mocked(fetchHands).mockResolvedValue([HAND]);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// AC-1 — no-gameId prompt
// ---------------------------------------------------------------------------

describe('PlaybackView — no gameId', () => {
  it('renders the playback-game-selector prompt', () => {
    const { container } = renderAt('/playback');
    expect(container.querySelector('[data-testid="playback-game-selector"]')).toBeTruthy();
    expect(container.textContent).toContain('Game Sessions');
  });

  it('does NOT mount the canvas / shell when gameId is absent', () => {
    renderAt('/playback');
    expect(shellPropsSpy).not.toHaveBeenCalled();
    expect(pokerCanvasRenderSpy).not.toHaveBeenCalled();
    expect(pokerTablePropsSpy).not.toHaveBeenCalled();
  });

  it('does NOT fetch game or hands when gameId is absent', () => {
    renderAt('/playback');
    expect(vi.mocked(fetchGame)).not.toHaveBeenCalled();
    expect(vi.mocked(fetchHands)).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// AC-2 — SessionReplayShell + canvas composition
// ---------------------------------------------------------------------------

describe('PlaybackView — with gameId', () => {
  it('mounts <SessionReplayShell> wrapping <PokerCanvas>/<PokerTable>', async () => {
    const { container } = renderAt('/playback?gameId=7');
    await waitFor(() => expect(shellPropsSpy).toHaveBeenCalled());
    expect(container.querySelector('[data-testid="session-replay-shell"]')).toBeTruthy();
    await waitFor(() => expect(pokerTablePropsSpy).toHaveBeenCalled());
    expect(container.querySelector('[data-testid="poker-canvas"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="poker-table"]')).toBeTruthy();
  });

  it('threads gameId + game + hands into <SessionReplayShell>', async () => {
    renderAt('/playback?gameId=7');
    await waitFor(() => expect(shellPropsSpy).toHaveBeenCalled());
    const props = shellPropsSpy.mock.calls.at(-1)![0];
    expect(props.gameId).toBe(7);
    expect(props.game).toEqual(COMPLETED_GAME);
    expect(props.hands).toEqual([HAND]);
    expect(props.initialHandIndex).toBe(0);
    expect(props.initialSpeed).toBe(1);
    expect(props.viewer).toEqual({ policy: 'spectator' });
  });
});

// ---------------------------------------------------------------------------
// AC-3 / AC-4 — viewer + equityOverlay
// ---------------------------------------------------------------------------

describe('PlaybackView — <PokerTable> prop threading', () => {
  it('threads viewer.policy="spectator" to <PokerTable>', async () => {
    renderAt('/playback?gameId=7');
    await waitFor(() => expect(pokerTablePropsSpy).toHaveBeenCalled());
    const props = pokerTablePropsSpy.mock.calls.at(-1)![0] as {
      viewer?: ViewerContext;
    };
    expect(props.viewer).toEqual({ policy: 'spectator' });
  });

  it('threads equityOverlay={true}', async () => {
    renderAt('/playback?gameId=7');
    await waitFor(() => expect(pokerTablePropsSpy).toHaveBeenCalled());
    expect(pokerTablePropsSpy.mock.calls.at(-1)![0].equityOverlay).toBe(true);
  });

  it('threads theme from useTableStore into <PokerTable>', async () => {
    const customTheme = { ...DEFAULT_THEME, feltColor: '#7a1a3a' };
    useTableStore.getState().setTheme(customTheme);
    renderAt('/playback?gameId=7');
    await waitFor(() => expect(pokerTablePropsSpy).toHaveBeenCalled());
    expect(pokerTablePropsSpy.mock.calls.at(-1)![0].theme).toEqual(customTheme);
  });

  it('threads qualityTier from useTableStore into <PokerTable>', async () => {
    useTableStore.getState().setTier('low');
    renderAt('/playback?gameId=7');
    await waitFor(() => expect(pokerTablePropsSpy).toHaveBeenCalled());
    const props = pokerTablePropsSpy.mock.calls.at(-1)![0] as {
      qualityTier?: QualityTier;
    };
    expect(props.qualityTier).toBe('low');
  });
});

// ---------------------------------------------------------------------------
// AC-6 — QualityToast mount (closes Cycle 42 M-1 for playback)
// ---------------------------------------------------------------------------

describe('PlaybackView — <QualityToast> is mounted at the route root', () => {
  it('renders <QualityToast> alongside the canvas', async () => {
    const { container } = renderAt('/playback?gameId=7');
    await waitFor(() => expect(qualityToastRenderSpy).toHaveBeenCalled());
    expect(container.querySelector('[data-testid="quality-toast"]')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// AC-7 — back button
// ---------------------------------------------------------------------------

describe('PlaybackView — back button', () => {
  it('navigates to /data on click', async () => {
    const { container } = renderAt('/playback?gameId=7');
    const back = await waitFor(() => {
      const el = container.querySelector('[data-testid="back-button"]');
      if (!el) throw new Error('not yet');
      return el;
    });
    fireEvent.click(back);
    await waitFor(() => {
      expect(container.querySelector('[data-testid="data-view"]')).toBeTruthy();
    });
  });
});

// ---------------------------------------------------------------------------
// AC-8 — polling for active games
// ---------------------------------------------------------------------------

describe('PlaybackView — polling', () => {
  it('does NOT re-fetch hands for completed games', async () => {
    vi.useFakeTimers();
    vi.mocked(fetchGame).mockResolvedValue(COMPLETED_GAME);
    renderAt('/playback?gameId=7');
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(0);
    const before = vi.mocked(fetchHands).mock.calls.length;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(vi.mocked(fetchHands).mock.calls.length).toBe(before);
  });

  it('re-fetches hands every 10s for active games', async () => {
    vi.useFakeTimers();
    vi.mocked(fetchGame).mockResolvedValue(ACTIVE_GAME);
    vi.mocked(fetchHands).mockResolvedValue([HAND]);
    renderAt('/playback?gameId=10');
    // Flush initial fetches + mount.
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(0);
    const before = vi.mocked(fetchHands).mock.calls.length;
    expect(before).toBeGreaterThan(0);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(vi.mocked(fetchHands).mock.calls.length).toBeGreaterThan(before);
  });
});

// ---------------------------------------------------------------------------
// AC-9 / AC-10 — legacy imports removed
// ---------------------------------------------------------------------------

describe('PlaybackView — legacy imports eliminated (T-031 AC-5)', () => {
  const source = readFileSync(
    resolve(__dirname, '../../src/views/PlaybackView.tsx'),
    'utf8',
  );

  it('does not import the client-side equity evaluator', () => {
    expect(source).not.toMatch(/calculateEquity/);
    expect(source).not.toMatch(/poker\/evaluator/);
  });

  it('does not import the legacy imperative pokerScene module', () => {
    expect(source).not.toMatch(/createPokerScene/);
    expect(source).not.toMatch(/scenes\/pokerScene/);
  });
});
