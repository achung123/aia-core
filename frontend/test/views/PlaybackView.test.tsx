/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// Mock API client
vi.mock('../../src/api/client.ts', () => ({
  fetchSessions: vi.fn(),
  fetchHands: vi.fn(),
}));

// Mock client-side equity calculator
vi.mock('../../src/poker/evaluator.ts', () => ({
  calculateEquity: vi.fn(() => []),
}));

// Mock poker scene — no WebGL in happy-dom
vi.mock('../../src/scenes/pokerScene.ts', () => ({
  createPokerScene: vi.fn(() => ({
    scene: {},
    camera: {
      position: { set: vi.fn() },
      lookAt: vi.fn(),
      updateProjectionMatrix: vi.fn(),
      aspect: 1,
    },
    renderer: { domElement: document.createElement('canvas'), setSize: vi.fn() },
    seatPositions: [],
    chipStacks: { updateChipStacks: vi.fn(), dispose: vi.fn() },
    holeCards: { initHand: vi.fn(), goToShowdown: vi.fn(), dispose: vi.fn() },
    communityCards: null,
    controls: { addEventListener: vi.fn(), removeEventListener: vi.fn(), saveState: vi.fn() },
    dispose: vi.fn(),
    update: vi.fn(),
  })),
}));

import { fetchSessions, fetchHands } from '../../src/api/client.ts';
import { calculateEquity } from '../../src/poker/evaluator.ts';
import { createPokerScene } from '../../src/scenes/pokerScene.ts';
import type { GameSessionListItem, HandResponse } from '../../src/api/types';
import { PlaybackView } from '../../src/../src/views/PlaybackView.tsx';

function renderToContainer(element: React.ReactElement) {
  const { container } = render(element);
  return container;
}

const SESSIONS: GameSessionListItem[] = [
  { game_id: 1, game_date: '2026-02-15', status: 'completed', hand_count: 8, player_count: 3, winners: [] },
  { game_id: 2, game_date: '2026-04-05', status: 'completed', hand_count: 3, player_count: 6, winners: [] },
  { game_id: 3, game_date: '2026-03-01', status: 'completed', hand_count: 12, player_count: 4, winners: [] },
];

const ACTIVE_SESSIONS: GameSessionListItem[] = [
  { game_id: 10, game_date: '2026-04-13', status: 'active', hand_count: 5, player_count: 4, winners: [] },
  ...SESSIONS,
];

const HANDS: HandResponse[] = [
  {
    hand_id: 1,
    game_id: 2,
    hand_number: 1,
    flop_1: 'Ah',
    flop_2: 'Kd',
    flop_3: 'Qc',
    turn: 'Js',
    river: 'Tc',
    source_upload_id: null,
    sb_player_name: null,
    bb_player_name: null,
    pot: 0,
    side_pots: [],
    created_at: '2026-04-05T12:00:00Z',
    player_hands: [
      { player_hand_id: 1, hand_id: 1, player_id: 1, player_name: 'Alice', card_1: '2h', card_2: '3h', result: 'won', profit_loss: 50, outcome_street: null, winning_hand_description: null },
      { player_hand_id: 2, hand_id: 1, player_id: 2, player_name: 'Bob', card_1: '4d', card_2: '5d', result: 'lost', profit_loss: -50, outcome_street: null, winning_hand_description: null },
    ],
  },
];

function renderWithGameId(gameId: number) {
  return renderToContainer(
    <MemoryRouter initialEntries={[`/playback?gameId=${gameId}`]}>
      <Routes>
        <Route path="/playback" element={<PlaybackView />} />
        <Route path="/data" element={<div data-testid="data-view">Game Sessions</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('PlaybackView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
    vi.mocked(fetchSessions).mockResolvedValue(SESSIONS);
    vi.mocked(fetchHands).mockResolvedValue(HANDS);
    vi.mocked(calculateEquity).mockReturnValue([
      { equity: 0.6 },
      { equity: 0.4 },
    ]);
  });

  /* ── No-game-selected screen ─────────────────────────────── */

  it('shows prompt screen when no gameId param is provided', async () => {
    const container = renderToContainer(<MemoryRouter><PlaybackView /></MemoryRouter>);
    await waitFor(() => {
      const selector = container.querySelector('[data-testid="playback-game-selector"]');
      expect(selector).toBeTruthy();
      expect(selector!.textContent).toContain('Game Sessions');
    });
  });

  it('shows loading state initially', () => {
    vi.mocked(fetchSessions).mockReturnValue(new Promise(() => {}));
    const container = renderToContainer(<MemoryRouter><PlaybackView /></MemoryRouter>);
    const selector = container.querySelector('[data-testid="playback-game-selector"]');
    expect(selector!.textContent).toContain('Loading');
  });

  it('shows error when fetchSessions fails', async () => {
    vi.mocked(fetchSessions).mockRejectedValue(new Error('Network error'));
    const container = renderToContainer(<MemoryRouter><PlaybackView /></MemoryRouter>);
    await waitFor(() => {
      expect(container.textContent).toContain('Network error');
    });
  });

  it('has no sidebar', () => {
    const container = renderToContainer(<MemoryRouter><PlaybackView /></MemoryRouter>);
    const sidebar = container.querySelector('#session-panel');
    expect(sidebar).toBeNull();
  });

  /* ── Game selection via URL param ────────────────────────── */

  it('auto-selects game from gameId URL param', async () => {
    renderWithGameId(2);
    await waitFor(() => {
      expect(fetchHands).toHaveBeenCalledWith(2);
    });
  });

  it('initializes scene after game selection via URL param', async () => {
    vi.mocked(createPokerScene).mockClear();
    renderWithGameId(2);
    await waitFor(() => {
      expect(vi.mocked(createPokerScene)).toHaveBeenCalled();
    });
  });

  it('shows canvas in playback mode', async () => {
    const container = renderWithGameId(2);
    await waitFor(() => {
      expect(container.querySelector('[data-testid="mobile-canvas"]')).toBeTruthy();
    });
  });

  /* ── Playback controls ──────────────────────────────────── */

  it('shows back button when a game is selected', async () => {
    const container = renderWithGameId(2);
    await waitFor(() => {
      expect(container.querySelector('[data-testid="back-button"]')).toBeTruthy();
    });
  });

  it('back button navigates to Game Sessions page', async () => {
    const container = renderWithGameId(2);
    await waitFor(() => {
      expect(container.querySelector('[data-testid="back-button"]')).toBeTruthy();
    });
    fireEvent.click(container.querySelector('[data-testid="back-button"]')!);
    await waitFor(() => {
      expect(container.querySelector('[data-testid="data-view"]')).toBeTruthy();
    });
  });

  it('shows session scrubber after game loads', async () => {
    const container = renderWithGameId(2);
    await waitFor(() => {
      expect(container.querySelector('[data-testid="session-scrubber"]')).toBeTruthy();
    });
  });

  it('shows street scrubber after game loads', async () => {
    const container = renderWithGameId(2);
    await waitFor(() => {
      expect(container.querySelector('[data-testid="street-scrubber"]')).toBeTruthy();
    });
  });

  it('session scrubber shows correct hand count', async () => {
    const container = renderWithGameId(2);
    await waitFor(() => {
      const label = container.querySelector('[data-testid="session-label"]');
      expect(label!.textContent).toBe('Hand 1 / 1');
    });
  });

  it('has a mount point for scrubber controls', async () => {
    const container = renderWithGameId(2);
    await waitFor(() => {
      const scrubber = container.querySelector('[data-testid="scrubber-mount"]');
      expect(scrubber).toBeTruthy();
    });
  });

  /* ── Equity ─────────────────────────────────────────────── */

  it('calls calculateEquity after game loads with 2+ players', async () => {
    renderWithGameId(2);
    await waitFor(() => {
      expect(calculateEquity).toHaveBeenCalled();
    });
  });

  it('shows equity row after game loads with 2+ players', async () => {
    const container = renderWithGameId(2);
    await waitFor(() => {
      expect(container.querySelector('[data-testid="equity-row"]')).toBeTruthy();
    });
  });

  it('hides equity row when calculateEquity throws', async () => {
    vi.mocked(calculateEquity).mockImplementation(() => { throw new Error('eval error'); });
    const container = renderWithGameId(2);
    await waitFor(() => {
      expect(fetchHands).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(container.querySelector('[data-testid="equity-row"]')).toBeNull();
    });
  });

  it('recalculates equity when hand index changes', async () => {
    const multiHands: HandResponse[] = [
      { ...HANDS[0], hand_id: 1, hand_number: 1 },
      { ...HANDS[0], hand_id: 2, hand_number: 2 },
    ];
    vi.mocked(fetchHands).mockResolvedValue(multiHands);
    const container = renderWithGameId(2);
    await waitFor(() => {
      expect(calculateEquity).toHaveBeenCalled();
    });

    const callsBefore = vi.mocked(calculateEquity).mock.calls.length;

    const nextBtn = container.querySelector('[data-testid="session-next"]');
    if (nextBtn) {
      fireEvent.click(nextBtn);
      await waitFor(() => {
        expect(vi.mocked(calculateEquity).mock.calls.length).toBeGreaterThan(callsBefore);
      });
    }
  });

  /* ── Layout ─────────────────────────────────────────────── */

  it('playback uses flex column layout', async () => {
    const container = renderWithGameId(2);
    await waitFor(() => {
      const wrapper = container.querySelector('[data-testid="mobile-canvas"]') as HTMLElement;
      expect(wrapper).toBeTruthy();
      expect(wrapper.style.display).toBe('flex');
      expect(wrapper.style.flexDirection).toBe('column');
    });
  });

  it('canvas area has overflow hidden and flex:1', async () => {
    const container = renderWithGameId(2);
    await waitFor(() => {
      const canvasArea = container.querySelector('[data-testid="canvas-area"]') as HTMLElement;
      expect(canvasArea).toBeTruthy();
      expect(canvasArea.style.overflow).toBe('hidden');
      expect(canvasArea.style.flex).toContain('1');
    });
  });

  it('scrubber mount is not position:absolute', async () => {
    const container = renderWithGameId(2);
    await waitFor(() => {
      const scrubberMount = container.querySelector('[data-testid="scrubber-mount"]') as HTMLElement;
      expect(scrubberMount).toBeTruthy();
      expect(scrubberMount.style.position).not.toBe('absolute');
    });
  });

  /* ── Polling for active games ───────────────────────────── */

  describe('polling', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('polls for new hands every 10s when game is active', async () => {
      vi.mocked(fetchSessions).mockResolvedValue(ACTIVE_SESSIONS);

      renderToContainer(
        <MemoryRouter initialEntries={['/playback?gameId=10']}>
          <PlaybackView />
        </MemoryRouter>
      );

      // Flush fetchSessions + selectGame promises
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(0);
      expect(fetchHands).toHaveBeenCalledWith(10);

      const callCount = vi.mocked(fetchHands).mock.calls.length;

      // Advance 10 seconds — should trigger a poll
      await vi.advanceTimersByTimeAsync(10_000);

      expect(vi.mocked(fetchHands).mock.calls.length).toBeGreaterThan(callCount);
    });

    it('does not poll for completed games', async () => {
      renderToContainer(
        <MemoryRouter initialEntries={['/playback?gameId=2']}>
          <PlaybackView />
        </MemoryRouter>
      );

      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(0);
      expect(fetchHands).toHaveBeenCalledWith(2);

      const callCount = vi.mocked(fetchHands).mock.calls.length;

      // Advance 10 seconds — should NOT trigger a poll
      await vi.advanceTimersByTimeAsync(10_000);

      expect(vi.mocked(fetchHands).mock.calls.length).toBe(callCount);
    });

    it('stops polling when navigating back', async () => {
      vi.mocked(fetchSessions).mockResolvedValue(ACTIVE_SESSIONS);

      const container = renderToContainer(
        <MemoryRouter initialEntries={['/playback?gameId=10']}>
          <Routes>
            <Route path="/playback" element={<PlaybackView />} />
            <Route path="/data" element={<div data-testid="data-view">Game Sessions</div>} />
          </Routes>
        </MemoryRouter>
      );

      // Flush fetchSessions + useEffect auto-select + fetchHands
      await vi.advanceTimersByTimeAsync(10);
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(0);
      expect(fetchHands).toHaveBeenCalledWith(10);

      // Wait for back button to appear
      await vi.advanceTimersByTimeAsync(0);
      const backBtn = container.querySelector('[data-testid="back-button"]');
      expect(backBtn).toBeTruthy();

      // Go back — should navigate to /data
      fireEvent.click(backBtn!);
      await vi.advanceTimersByTimeAsync(0);
      expect(container.querySelector('[data-testid="data-view"]')).toBeTruthy();

      const callCount = vi.mocked(fetchHands).mock.calls.length;

      // Advance 10 seconds — should NOT trigger a poll
      await vi.advanceTimersByTimeAsync(10_000);

      expect(vi.mocked(fetchHands).mock.calls.length).toBe(callCount);
    });

    it('polling appends new hands to cached list', async () => {
      vi.mocked(fetchSessions).mockResolvedValue(ACTIVE_SESSIONS);

      const hand1 = { ...HANDS[0], hand_id: 1, hand_number: 1, game_id: 10 };
      const hand2 = { ...HANDS[0], hand_id: 2, hand_number: 2, game_id: 10 };

      // First load returns 1 hand
      vi.mocked(fetchHands).mockResolvedValueOnce([hand1]);

      const container = renderToContainer(
        <MemoryRouter initialEntries={['/playback?gameId=10']}>
          <PlaybackView />
        </MemoryRouter>
      );

      // Flush fetchSessions + auto-select + fetchHands
      await vi.advanceTimersByTimeAsync(10);
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(0);

      const label = container.querySelector('[data-testid="session-label"]');
      expect(label).toBeTruthy();
      expect(label!.textContent).toBe('Hand 1 / 1');

      // Poll returns 2 hands
      vi.mocked(fetchHands).mockResolvedValueOnce([hand1, hand2]);
      await vi.advanceTimersByTimeAsync(10_000);

      expect(container.querySelector('[data-testid="session-label"]')!.textContent).toBe('Hand 1 / 2');
    });
  });
});
