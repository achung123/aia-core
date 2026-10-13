/** @vitest-environment happy-dom */
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../src/api/client.ts', () => ({
  fetchPlayers: vi.fn().mockResolvedValue([]),
  fetchGame: vi.fn(),
}));

import NavBar from '../src/NavBar';
import { fetchGame } from '../src/api/client';
import { useDealerStore } from '../src/stores/dealerStore';
import { usePlayerStore } from '../src/stores/playerStore';

beforeEach(() => {
  vi.mocked(fetchGame).mockReset();
});

afterEach(() => {
  cleanup();
  useDealerStore.getState().reset();
  usePlayerStore.getState().setPlayerName(null);
});

function renderNavBar() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/']}>
        <NavBar />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('NavBar active game validation', () => {
  it('shows "Game" (not active) when dealerStore has a gameId but game is completed', async () => {
    // Set up dealerStore with a game and playerStore with a matching player
    useDealerStore.getState().setGame({ gameId: 1, players: ['Alice'], gameDate: '2026-04-01' });
    usePlayerStore.getState().setPlayerName('Alice');

    // Backend says the game is completed
    vi.mocked(fetchGame).mockResolvedValue({
      game_id: 1,
      game_date: '2026-04-01',
      status: 'completed',
      created_at: '2026-04-01T00:00:00Z',
      player_names: ['Alice'],
      hand_count: 5,
      winners: ['Alice'],
    });

    renderNavBar();

    // Should eventually reset and show plain "Game"
    await waitFor(() => {
      expect(screen.getByText('Game')).toBeTruthy();
    });
    expect(screen.queryByText('Game (Active)')).toBeNull();
    expect(useDealerStore.getState().gameId).toBeNull();
  });

  it('shows "Game" when dealerStore has a gameId but game no longer exists (404)', async () => {
    useDealerStore.getState().setGame({ gameId: 999, players: ['Bob'], gameDate: '2026-04-01' });
    usePlayerStore.getState().setPlayerName('Bob');

    // Backend returns 404
    vi.mocked(fetchGame).mockRejectedValue(new Error('Not found'));

    renderNavBar();

    await waitFor(() => {
      expect(screen.getByText('Game')).toBeTruthy();
    });
    expect(screen.queryByText('Game (Active)')).toBeNull();
    expect(useDealerStore.getState().gameId).toBeNull();
  });

  it('keeps "Game (Active)" when the game is still active', async () => {
    useDealerStore.getState().setGame({ gameId: 1, players: ['Alice'], gameDate: '2026-04-01' });
    usePlayerStore.getState().setPlayerName('Alice');

    vi.mocked(fetchGame).mockResolvedValue({
      game_id: 1,
      game_date: '2026-04-01',
      status: 'active',
      created_at: '2026-04-01T00:00:00Z',
      player_names: ['Alice'],
      hand_count: 3,
      winners: [],
    });

    renderNavBar();

    await waitFor(() => {
      expect(fetchGame).toHaveBeenCalledWith(1);
    });

    // Should still show Game (Active)
    expect(screen.getByText('Game (Active)')).toBeTruthy();
    expect(useDealerStore.getState().gameId).toBe(1);
  });

  it('shows selected title alongside player name in profile label', () => {
    usePlayerStore.getState().setPlayerName('Alice');
    usePlayerStore.getState().setSelectedTitle('🦾 Iron Man');

    renderNavBar();

    const label = screen.getByText(/Alice/);
    expect(label.textContent).toContain('🦾 Iron Man');
  });

  it('shows only player name when no title is selected', () => {
    usePlayerStore.getState().setPlayerName('Alice');

    renderNavBar();

    const label = screen.getByText('Alice');
    expect(label.textContent).toBe('Alice');
  });
});
