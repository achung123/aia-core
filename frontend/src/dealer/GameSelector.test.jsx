/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'preact';
import { GameSelector } from './GameSelector.jsx';

// Mock fetchSessions
vi.mock('../api/client.js', () => ({
  fetchSessions: vi.fn(),
}));

import { fetchSessions } from '../api/client.js';

function renderToContainer(vnode) {
  const container = document.createElement('div');
  render(vnode, container);
  return container;
}

const SESSIONS = [
  { game_id: 1, game_date: '2026-03-01', status: 'complete', player_count: 4, hand_count: 12 },
  { game_id: 2, game_date: '2026-04-05', status: 'active', player_count: 6, hand_count: 3 },
  { game_id: 3, game_date: '2026-02-15', status: 'complete', player_count: 3, hand_count: 8 },
];

describe('GameSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    fetchSessions.mockReturnValue(new Promise(() => {})); // never resolves
    const container = renderToContainer(
      <GameSelector onSelectGame={() => {}} onNewGame={() => {}} />
    );
    expect(container.textContent).toContain('Loading');
  });

  it('renders games sorted by date descending', async () => {
    fetchSessions.mockResolvedValue(SESSIONS);
    const container = renderToContainer(
      <GameSelector onSelectGame={() => {}} onNewGame={() => {}} />
    );
    // Wait for effect to resolve
    await vi.waitFor(() => {
      expect(container.textContent).toContain('2026-04-05');
    });

    const cards = container.querySelectorAll('[data-testid="game-card"]');
    expect(cards.length).toBe(3);
    // First card should be most recent (2026-04-05)
    expect(cards[0].textContent).toContain('2026-04-05');
    // Second should be 2026-03-01
    expect(cards[1].textContent).toContain('2026-03-01');
    // Third should be 2026-02-15
    expect(cards[2].textContent).toContain('2026-02-15');
  });

  it('displays game details (status, player count, hand count)', async () => {
    fetchSessions.mockResolvedValue(SESSIONS);
    const container = renderToContainer(
      <GameSelector onSelectGame={() => {}} onNewGame={() => {}} />
    );
    await vi.waitFor(() => {
      expect(container.textContent).toContain('2026-04-05');
    });

    const cards = container.querySelectorAll('[data-testid="game-card"]');
    // Active game card
    expect(cards[0].textContent).toContain('6');
    expect(cards[0].textContent).toContain('3');
    // Complete game card
    expect(cards[1].textContent).toContain('4');
    expect(cards[1].textContent).toContain('12');
  });

  it('active games have indigo accent style', async () => {
    fetchSessions.mockResolvedValue(SESSIONS);
    const container = renderToContainer(
      <GameSelector onSelectGame={() => {}} onNewGame={() => {}} />
    );
    await vi.waitFor(() => {
      expect(container.textContent).toContain('2026-04-05');
    });

    const cards = container.querySelectorAll('[data-testid="game-card"]');
    // First card is active — should have indigo border
    expect(cards[0].style.borderColor).toContain('indigo');
    // Second card is complete — should NOT have indigo border
    expect(cards[1].style.borderColor).not.toContain('indigo');
  });

  it('calls onSelectGame when a game card is tapped', async () => {
    fetchSessions.mockResolvedValue(SESSIONS);
    const onSelectGame = vi.fn();
    const container = renderToContainer(
      <GameSelector onSelectGame={onSelectGame} onNewGame={() => {}} />
    );
    await vi.waitFor(() => {
      expect(container.textContent).toContain('2026-04-05');
    });

    const cards = container.querySelectorAll('[data-testid="game-card"]');
    cards[0].click();
    expect(onSelectGame).toHaveBeenCalledWith(2); // game_id of the active game
  });

  it('renders a New Game button that calls onNewGame', async () => {
    fetchSessions.mockResolvedValue(SESSIONS);
    const onNewGame = vi.fn();
    const container = renderToContainer(
      <GameSelector onSelectGame={() => {}} onNewGame={onNewGame} />
    );
    await vi.waitFor(() => {
      expect(container.textContent).toContain('2026-04-05');
    });

    const newGameBtn = container.querySelector('[data-testid="new-game-btn"]');
    expect(newGameBtn).toBeTruthy();
    expect(newGameBtn.textContent).toContain('New Game');
    newGameBtn.click();
    expect(onNewGame).toHaveBeenCalled();
  });

  it('shows error state when fetch fails', async () => {
    fetchSessions.mockRejectedValue(new Error('Network error'));
    const container = renderToContainer(
      <GameSelector onSelectGame={() => {}} onNewGame={() => {}} />
    );
    await vi.waitFor(() => {
      expect(container.textContent).toContain('Network error');
    });
  });

  it('shows New Game button even during loading', () => {
    fetchSessions.mockReturnValue(new Promise(() => {}));
    const onNewGame = vi.fn();
    const container = renderToContainer(
      <GameSelector onSelectGame={() => {}} onNewGame={onNewGame} />
    );
    const newGameBtn = container.querySelector('[data-testid="new-game-btn"]');
    expect(newGameBtn).toBeTruthy();
    newGameBtn.click();
    expect(onNewGame).toHaveBeenCalled();
  });
});
