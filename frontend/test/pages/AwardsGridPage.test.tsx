/** @vitest-environment happy-dom */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../../src/api/client.ts', () => ({
  fetchAwards: vi.fn(),
  fetchSessions: vi.fn(),
}));

import { fetchAwards, fetchSessions } from '../../src/api/client.ts';
import { AwardsGridPage } from '../../src/pages/AwardsGridPage';

const mockedFetchAwards = vi.mocked(fetchAwards);
const mockedFetchSessions = vi.mocked(fetchSessions);

const AWARDS = [
  {
    award_name: 'Big Stack',
    emoji: '💰',
    description: 'Largest chip stack',
    winner_name: 'Alice',
    stat_value: 5000,
    stat_label: 'chips',
  },
  {
    award_name: 'Shark',
    emoji: '🦈',
    description: 'Most hands won',
    winner_name: 'Bob',
    stat_value: 12,
    stat_label: 'wins',
  },
];

const SESSIONS = [
  { game_id: 1, game_date: '2025-01-01', status: 'completed', player_count: 4, hand_count: 20, winners: ['Alice'] },
  { game_id: 2, game_date: '2025-01-15', status: 'completed', player_count: 6, hand_count: 35, winners: ['Bob'] },
];

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/awards']}>
        <Routes>
          <Route path="/awards" element={<AwardsGridPage />} />
          <Route path="/players/:playerName" element={<div data-testid="player-profile">Player Profile</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockedFetchSessions.mockResolvedValue(SESSIONS);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('AwardsGridPage', () => {
  it('shows loading state initially', () => {
    mockedFetchAwards.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByTestId('awards-loading')).toBeTruthy();
  });

  it('shows error state on fetch failure', async () => {
    mockedFetchAwards.mockRejectedValue(new Error('Network error'));
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('awards-error')).toBeTruthy();
    });
  });

  it('renders award cards from global awards', async () => {
    mockedFetchAwards.mockResolvedValue(AWARDS);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Big Stack')).toBeTruthy();
      expect(screen.getByText('Shark')).toBeTruthy();
    });
    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('Bob')).toBeTruthy();
    expect(screen.getByText('💰')).toBeTruthy();
    expect(screen.getByText('🦈')).toBeTruthy();
    // Default is global — fetchAwards called without gameId
    expect(mockedFetchAwards).toHaveBeenCalledWith(undefined);
  });

  it('filters by game when a game is selected', async () => {
    mockedFetchAwards.mockResolvedValue(AWARDS);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Big Stack')).toBeTruthy();
    });
    // Select a specific game
    const select = screen.getByTestId('game-filter-select') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: '1' } });
    await waitFor(() => {
      expect(mockedFetchAwards).toHaveBeenCalledWith(1);
    });
  });

  it('clicking a card navigates to player profile', async () => {
    mockedFetchAwards.mockResolvedValue(AWARDS);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeTruthy();
    });
    // Click the first award card (Alice)
    const aliceCard = screen.getByText('Alice').closest('a');
    expect(aliceCard).toBeTruthy();
    fireEvent.click(aliceCard!);
    await waitFor(() => {
      expect(screen.getByTestId('player-profile')).toBeTruthy();
    });
  });

  it('shows empty state when no awards returned', async () => {
    mockedFetchAwards.mockResolvedValue([]);
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('awards-empty')).toBeTruthy();
    });
  });

  it('switching back to global resets the game filter', async () => {
    mockedFetchAwards.mockResolvedValue(AWARDS);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Big Stack')).toBeTruthy();
    });
    const select = screen.getByTestId('game-filter-select') as HTMLSelectElement;
    // Select game 2
    fireEvent.change(select, { target: { value: '2' } });
    await waitFor(() => {
      expect(mockedFetchAwards).toHaveBeenCalledWith(2);
    });
    // Switch back to global
    fireEvent.change(select, { target: { value: '' } });
    await waitFor(() => {
      expect(mockedFetchAwards).toHaveBeenCalledWith(undefined);
    });
  });

  it('renders the awards grid with responsive columns', async () => {
    mockedFetchAwards.mockResolvedValue(AWARDS);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Big Stack')).toBeTruthy();
    });
    const grid = screen.getByTestId('awards-grid');
    // Grid should use auto-fill with a min size so it wraps on narrow screens
    expect(grid.style.gridTemplateColumns).toContain('auto-fill');
  });

  it('constrains the page width to prevent horizontal overflow', async () => {
    mockedFetchAwards.mockResolvedValue(AWARDS);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Big Stack')).toBeTruthy();
    });
    const page = screen.getByTestId('awards-grid').parentElement!;
    expect(page.style.width).toBe('100%');
    expect(page.style.overflowX).toBe('hidden');
  });
});
