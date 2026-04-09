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
  { game_id: 1, game_date: '2026-03-01', status: 'complete', player_count: 4, hand_count: 12, winners: ['Alice'] },
  { game_id: 2, game_date: '2026-04-05', status: 'active', player_count: 6, hand_count: 3, winners: [] },
  { game_id: 3, game_date: '2026-02-15', status: 'complete', player_count: 3, hand_count: 8, winners: ['Bob', 'Carol'] },
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

  it('renders games sorted by game_id descending', async () => {
    fetchSessions.mockResolvedValue(SESSIONS);
    const container = renderToContainer(
      <GameSelector onSelectGame={() => {}} onNewGame={() => {}} />
    );
    await vi.waitFor(() => {
      expect(container.textContent).toContain('2026-04-05');
    });

    const cards = container.querySelectorAll('[data-testid="game-card"]');
    expect(cards.length).toBe(3);
    // Sorted by game_id descending: 3, 2, 1
    expect(cards[0].textContent).toContain('#3');
    expect(cards[1].textContent).toContain('#2');
    expect(cards[2].textContent).toContain('#1');
  });

  it('displays game details (status, player count, hand count)', async () => {
    fetchSessions.mockResolvedValue(SESSIONS);
    const container = renderToContainer(
      <GameSelector onSelectGame={() => {}} onNewGame={() => {}} />
    );
    await vi.waitFor(() => {
      const cards = container.querySelectorAll('[data-testid="game-card"]');
      expect(cards.length).toBe(3);
    });

    const cards = container.querySelectorAll('[data-testid="game-card"]');
    // Cards sorted by game_id desc: 3, 2, 1
    // game_id=3 card (index 0)
    expect(cards[0].textContent).toContain('3');
    expect(cards[0].textContent).toContain('8');
    // game_id=2 active card (index 1)
    expect(cards[1].textContent).toContain('6');
    expect(cards[1].textContent).toContain('3');
  });

  it('active games have indigo accent style', async () => {
    fetchSessions.mockResolvedValue(SESSIONS);
    const container = renderToContainer(
      <GameSelector onSelectGame={() => {}} onNewGame={() => {}} />
    );
    await vi.waitFor(() => {
      const cards = container.querySelectorAll('[data-testid="game-card"]');
      expect(cards.length).toBe(3);
    });

    const cards = container.querySelectorAll('[data-testid="game-card"]');
    // Sorted by game_id desc: 3 (complete), 2 (active), 1 (complete)
    expect(cards[0].style.borderColor).not.toContain('indigo'); // game 3 complete
    expect(cards[1].style.borderColor).toContain('indigo');      // game 2 active
    expect(cards[2].style.borderColor).not.toContain('indigo'); // game 1 complete
  });

  it('calls onSelectGame when a game card is tapped', async () => {
    fetchSessions.mockResolvedValue(SESSIONS);
    const onSelectGame = vi.fn();
    const container = renderToContainer(
      <GameSelector onSelectGame={onSelectGame} onNewGame={() => {}} />
    );
    await vi.waitFor(() => {
      const cards = container.querySelectorAll('[data-testid="game-card"]');
      expect(cards.length).toBe(3);
    });

    const cards = container.querySelectorAll('[data-testid="game-card"]');
    // Sorted by game_id desc: 3, 2, 1 — tap game 2 (index 1)
    cards[1].click();
    expect(onSelectGame).toHaveBeenCalledWith(2);
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

  it('displays game_id on each game card', async () => {
    fetchSessions.mockResolvedValue(SESSIONS);
    const container = renderToContainer(
      <GameSelector onSelectGame={() => {}} onNewGame={() => {}} />
    );
    await vi.waitFor(() => {
      const cards = container.querySelectorAll('[data-testid="game-card"]');
      expect(cards.length).toBe(3);
    });

    const cards = container.querySelectorAll('[data-testid="game-card"]');
    // Sorted by game_id desc: 3, 2, 1
    expect(cards[0].textContent).toContain('#3');
    expect(cards[1].textContent).toContain('#2');
    expect(cards[2].textContent).toContain('#1');
  });

  it('shows winners on completed game cards', async () => {
    fetchSessions.mockResolvedValue(SESSIONS);
    const container = renderToContainer(
      <GameSelector onSelectGame={() => {}} onNewGame={() => {}} />
    );
    await vi.waitFor(() => {
      const cards = container.querySelectorAll('[data-testid="game-card"]');
      expect(cards.length).toBe(3);
    });

    const cards = container.querySelectorAll('[data-testid="game-card"]');
    // game_id=3 has winners Bob, Carol
    expect(cards[0].textContent).toContain('Bob');
    expect(cards[0].textContent).toContain('Carol');
    // game_id=1 has winner Alice
    expect(cards[2].textContent).toContain('Alice');
  });
});
