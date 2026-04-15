/** @vitest-environment happy-dom */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../../src/api/client.ts', () => ({
  fetchSessions: vi.fn(),
}));

import { fetchSessions } from '../../src/api/client.ts';
import { GameListPage } from '../../src/pages/GameListPage';

const mockedFetchSessions = vi.mocked(fetchSessions);

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/games']}>
        <Routes>
          <Route path="/games" element={ui} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('GameListPage', () => {
  it('shows a loading skeleton while fetching', () => {
    mockedFetchSessions.mockReturnValue(new Promise(() => {})); // never resolves
    renderWithProviders(<GameListPage />);
    expect(screen.getByTestId('game-list-loading')).toBeTruthy();
  });

  it('renders a list of game sessions with date, player count, and hand count', async () => {
    mockedFetchSessions.mockResolvedValue([
      { game_id: 1, game_date: '2025-01-15', status: 'completed', player_count: 5, hand_count: 20, winners: ['Alice'] },
      { game_id: 2, game_date: '2025-02-10', status: 'in_progress', player_count: 3, hand_count: 8, winners: [] },
    ]);
    renderWithProviders(<GameListPage />);

    await waitFor(() => {
      expect(screen.getByText('2025-01-15')).toBeTruthy();
    });

    expect(screen.getByText(/5\s+players/)).toBeTruthy();
    expect(screen.getByText(/20\s+hands/)).toBeTruthy();
    expect(screen.getByText('2025-02-10')).toBeTruthy();
    expect(screen.getByText(/3\s+players/)).toBeTruthy();
    expect(screen.getByText(/8\s+hands/)).toBeTruthy();
  });

  it('each game row links to /games/:gameId/recap', async () => {
    mockedFetchSessions.mockResolvedValue([
      { game_id: 7, game_date: '2025-03-01', status: 'completed', player_count: 4, hand_count: 12, winners: ['Bob'] },
    ]);
    renderWithProviders(<GameListPage />);

    await waitFor(() => {
      expect(screen.getByText('2025-03-01')).toBeTruthy();
    });

    const link = screen.getByRole('link', { name: /2025-03-01/i });
    expect(link.getAttribute('href')).toBe('/games/7/recap');
  });

  it('shows an error message when the fetch fails', async () => {
    mockedFetchSessions.mockRejectedValue(new Error('Network error'));
    renderWithProviders(<GameListPage />);

    await waitFor(() => {
      expect(screen.getByTestId('game-list-error')).toBeTruthy();
    });
  });

  it('shows an empty state when no games exist', async () => {
    mockedFetchSessions.mockResolvedValue([]);
    renderWithProviders(<GameListPage />);

    await waitFor(() => {
      expect(screen.getByText(/no games/i)).toBeTruthy();
    });
  });
});
