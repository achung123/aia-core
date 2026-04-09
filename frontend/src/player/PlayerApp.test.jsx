/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from 'preact';
import { PlayerApp } from './PlayerApp.jsx';

vi.mock('../api/client.js', () => ({
  fetchSessions: vi.fn(),
  fetchGame: vi.fn(),
}));

import { fetchSessions, fetchGame } from '../api/client.js';

function renderToContainer(vnode) {
  const container = document.createElement('div');
  render(vnode, container);
  return container;
}

const SESSIONS = [
  { game_id: 1, game_date: '2026-03-01', status: 'complete', player_count: 4, hand_count: 12, winners: ['Alice'] },
  { game_id: 2, game_date: '2026-04-05', status: 'active', player_count: 6, hand_count: 3, winners: [] },
  { game_id: 3, game_date: '2026-04-06', status: 'active', player_count: 5, hand_count: 1, winners: null },
  { game_id: 4, game_date: '2026-02-15', status: 'complete', player_count: 3, hand_count: 8, winners: ['Bob'] },
];

describe('PlayerApp', () => {
  let originalHash;

  beforeEach(() => {
    vi.clearAllMocks();
    originalHash = window.location.hash;
    window.location.hash = '';
  });

  afterEach(() => {
    window.location.hash = originalHash;
  });

  it('shows loading state initially', () => {
    fetchSessions.mockReturnValue(new Promise(() => {}));
    const container = renderToContainer(<PlayerApp />);
    expect(container.textContent).toContain('Loading');
  });

  it('renders only active games (no completed games)', async () => {
    fetchSessions.mockResolvedValue(SESSIONS);
    const container = renderToContainer(<PlayerApp />);
    await vi.waitFor(() => {
      expect(container.querySelectorAll('[data-testid="game-card"]').length).toBe(2);
    });

    const cards = container.querySelectorAll('[data-testid="game-card"]');
    // Only active games: id=3 and id=2
    expect(cards[0].textContent).toContain('#3');
    expect(cards[1].textContent).toContain('#2');
    // Completed games should not appear
    expect(container.textContent).not.toContain('#1');
    expect(container.textContent).not.toContain('#4');
  });

  it('sorts active games by game_id descending', async () => {
    fetchSessions.mockResolvedValue(SESSIONS);
    const container = renderToContainer(<PlayerApp />);
    await vi.waitFor(() => {
      expect(container.querySelectorAll('[data-testid="game-card"]').length).toBe(2);
    });

    const cards = container.querySelectorAll('[data-testid="game-card"]');
    expect(cards[0].textContent).toContain('#3');
    expect(cards[1].textContent).toContain('#2');
  });

  it('selecting a game transitions to name picker step', async () => {
    fetchSessions.mockResolvedValue(SESSIONS);
    fetchGame.mockResolvedValue({ game_id: 3, player_names: ['Alice', 'Bob'] });
    const container = renderToContainer(<PlayerApp />);
    await vi.waitFor(() => {
      expect(container.querySelectorAll('[data-testid="game-card"]').length).toBe(2);
    });

    const cards = container.querySelectorAll('[data-testid="game-card"]');
    cards[0].click();

    await vi.waitFor(() => {
      // After clicking, should no longer show game cards
      expect(container.querySelectorAll('[data-testid="game-card"]').length).toBe(0);
      // Should show game id selected context
      expect(container.textContent).toContain('Game #3');
    });
  });

  it('auto-selects game from ?game= URL param and skips picker', async () => {
    window.location.hash = '#/player?game=2';
    fetchSessions.mockResolvedValue(SESSIONS);
    fetchGame.mockResolvedValue({ game_id: 2, player_names: ['Dan', 'Eve'] });
    const container = renderToContainer(<PlayerApp />);
    await vi.waitFor(() => {
      // Should not show game cards — auto-selected
      expect(container.querySelectorAll('[data-testid="game-card"]').length).toBe(0);
      expect(container.textContent).toContain('Game #2');
    });
  });

  it('shows error when ?game= references an invalid game', async () => {
    window.location.hash = '#/player?game=999';
    fetchSessions.mockResolvedValue(SESSIONS);
    const container = renderToContainer(<PlayerApp />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain('not found');
    });
  });

  it('shows error when fetchSessions fails', async () => {
    fetchSessions.mockRejectedValue(new Error('Network error'));
    const container = renderToContainer(<PlayerApp />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain('Network error');
    });
  });

  it('shows empty message when no active games', async () => {
    fetchSessions.mockResolvedValue([
      { game_id: 1, game_date: '2026-03-01', status: 'complete', player_count: 4, hand_count: 12, winners: ['Alice'] },
    ]);
    const container = renderToContainer(<PlayerApp />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain('No active games');
    });
  });

  it('displays game date and player count on cards', async () => {
    fetchSessions.mockResolvedValue(SESSIONS);
    const container = renderToContainer(<PlayerApp />);
    await vi.waitFor(() => {
      expect(container.querySelectorAll('[data-testid="game-card"]').length).toBe(2);
    });

    const cards = container.querySelectorAll('[data-testid="game-card"]');
    expect(cards[0].textContent).toContain('2026-04-06');
    expect(cards[0].textContent).toContain('5 players');
    expect(cards[1].textContent).toContain('2026-04-05');
    expect(cards[1].textContent).toContain('6 players');
  });
});

const GAME_DETAIL = {
  game_id: 3,
  game_date: '2026-04-06',
  status: 'active',
  player_names: ['Alice', 'Bob', 'Charlie'],
  hand_count: 1,
  winners: [],
};

describe('PlayerApp — name picker', () => {
  let originalHash;

  beforeEach(() => {
    vi.clearAllMocks();
    originalHash = window.location.hash;
    window.location.hash = '';
  });

  afterEach(() => {
    window.location.hash = originalHash;
  });

  it('fetches game details and shows player names as buttons', async () => {
    fetchSessions.mockResolvedValue(SESSIONS);
    fetchGame.mockResolvedValue(GAME_DETAIL);
    const container = renderToContainer(<PlayerApp />);
    await vi.waitFor(() => {
      expect(container.querySelectorAll('[data-testid="game-card"]').length).toBe(2);
    });

    container.querySelectorAll('[data-testid="game-card"]')[0].click();

    await vi.waitFor(() => {
      const playerBtns = container.querySelectorAll('[data-testid="player-name-btn"]');
      expect(playerBtns.length).toBe(3);
      expect(playerBtns[0].textContent).toContain('Alice');
      expect(playerBtns[1].textContent).toContain('Bob');
      expect(playerBtns[2].textContent).toContain('Charlie');
    });
  });

  it('shows loading while fetching players', async () => {
    fetchSessions.mockResolvedValue(SESSIONS);
    fetchGame.mockReturnValue(new Promise(() => {}));
    const container = renderToContainer(<PlayerApp />);
    await vi.waitFor(() => {
      expect(container.querySelectorAll('[data-testid="game-card"]').length).toBe(2);
    });

    container.querySelectorAll('[data-testid="game-card"]')[0].click();

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Loading players');
    });
  });

  it('shows message when game has no players', async () => {
    fetchSessions.mockResolvedValue(SESSIONS);
    fetchGame.mockResolvedValue({ ...GAME_DETAIL, player_names: [] });
    const container = renderToContainer(<PlayerApp />);
    await vi.waitFor(() => {
      expect(container.querySelectorAll('[data-testid="game-card"]').length).toBe(2);
    });

    container.querySelectorAll('[data-testid="game-card"]')[0].click();

    await vi.waitFor(() => {
      expect(container.textContent).toContain('No players');
    });
  });

  it('selecting a name transitions to playing step with welcome message', async () => {
    fetchSessions.mockResolvedValue(SESSIONS);
    fetchGame.mockResolvedValue(GAME_DETAIL);
    const container = renderToContainer(<PlayerApp />);
    await vi.waitFor(() => {
      expect(container.querySelectorAll('[data-testid="game-card"]').length).toBe(2);
    });

    container.querySelectorAll('[data-testid="game-card"]')[0].click();

    await vi.waitFor(() => {
      expect(container.querySelectorAll('[data-testid="player-name-btn"]').length).toBe(3);
    });

    container.querySelectorAll('[data-testid="player-name-btn"]')[1].click();

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Bob');
      expect(container.textContent).toContain('Waiting for hand');
    });
  });

  it('Change Player button returns to name picker', async () => {
    fetchSessions.mockResolvedValue(SESSIONS);
    fetchGame.mockResolvedValue(GAME_DETAIL);
    const container = renderToContainer(<PlayerApp />);
    await vi.waitFor(() => {
      expect(container.querySelectorAll('[data-testid="game-card"]').length).toBe(2);
    });

    container.querySelectorAll('[data-testid="game-card"]')[0].click();

    await vi.waitFor(() => {
      expect(container.querySelectorAll('[data-testid="player-name-btn"]').length).toBe(3);
    });

    container.querySelectorAll('[data-testid="player-name-btn"]')[0].click();

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Alice');
    });

    container.querySelector('[data-testid="change-player-btn"]').click();

    await vi.waitFor(() => {
      expect(container.querySelectorAll('[data-testid="player-name-btn"]').length).toBe(3);
    });
  });

  it('auto-selected game via URL also fetches players', async () => {
    window.location.hash = '#/player?game=2';
    fetchSessions.mockResolvedValue(SESSIONS);
    fetchGame.mockResolvedValue({
      ...GAME_DETAIL,
      game_id: 2,
      player_names: ['Dan', 'Eve'],
    });
    const container = renderToContainer(<PlayerApp />);

    await vi.waitFor(() => {
      const playerBtns = container.querySelectorAll('[data-testid="player-name-btn"]');
      expect(playerBtns.length).toBe(2);
      expect(playerBtns[0].textContent).toContain('Dan');
      expect(playerBtns[1].textContent).toContain('Eve');
    });
  });
});
