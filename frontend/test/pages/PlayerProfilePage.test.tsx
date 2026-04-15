/** @vitest-environment happy-dom */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../../src/api/client.ts', () => ({
  fetchPlayerStats: vi.fn(),
  fetchPlayers: vi.fn(),
  fetchPlayerTrends: vi.fn(),
}));

vi.mock('recharts', () => {
  const React = require('react');
  return {
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Line: () => <div />,
    XAxis: () => <div />,
    YAxis: () => <div />,
    Tooltip: () => <div />,
    ReferenceLine: () => <div />,
    CartesianGrid: () => <div />,
    PieChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Pie: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Cell: () => <div />,
    Legend: () => <div />,
  };
});

import { fetchPlayerStats, fetchPlayers, fetchPlayerTrends } from '../../src/api/client.ts';
import { PlayerProfilePage } from '../../src/pages/PlayerProfilePage';

const mockedFetchPlayerStats = vi.mocked(fetchPlayerStats);
const mockedFetchPlayers = vi.mocked(fetchPlayers);
const mockedFetchPlayerTrends = vi.mocked(fetchPlayerTrends);

function renderWithProviders(playerName = 'Alice') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/players/${playerName}`]}>
        <Routes>
          <Route path="/players/:playerName" element={<PlayerProfilePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const FULL_STATS = {
  player_name: 'Alice',
  total_hands_played: 50,
  hands_won: 20,
  hands_lost: 18,
  hands_folded: 12,
  win_rate: 40.0,
  total_profit_loss: 350,
  avg_profit_loss_per_hand: 7.0,
  avg_profit_loss_per_session: 175.0,
  flop_pct: 60.0,
  turn_pct: 45.0,
  river_pct: 30.0,
};

const ZERO_STATS = {
  player_name: 'Newbie',
  total_hands_played: 0,
  hands_won: 0,
  hands_lost: 0,
  hands_folded: 0,
  win_rate: 0,
  total_profit_loss: 0,
  avg_profit_loss_per_hand: 0,
  avg_profit_loss_per_session: 0,
  flop_pct: 0,
  turn_pct: 0,
  river_pct: 0,
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  document.title = '';
});

describe('PlayerProfilePage', () => {
  // Default: trends returns empty so existing tests don't break
  beforeEach(() => {
    mockedFetchPlayerTrends.mockResolvedValue([]);
  });

  it('shows loading state while stats are fetching', () => {
    mockedFetchPlayers.mockResolvedValue([]);
    mockedFetchPlayerStats.mockReturnValue(new Promise(() => {}));
    renderWithProviders('Alice');
    expect(screen.getByTestId('profile-loading')).toBeTruthy();
  });

  it('renders player stats after loading', async () => {
    mockedFetchPlayers.mockResolvedValue([]);
    mockedFetchPlayerStats.mockResolvedValue(FULL_STATS);
    renderWithProviders('Alice');

    await waitFor(() => {
      expect(screen.getByTestId('profile-stats')).toBeTruthy();
    });

    expect(screen.getByText('50')).toBeTruthy();
    expect(screen.getByText('20')).toBeTruthy();
    expect(screen.getByText('18')).toBeTruthy();
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText('40%')).toBeTruthy();
    expect(screen.getByText('350')).toBeTruthy();
  });

  it('renders street percentages', async () => {
    mockedFetchPlayers.mockResolvedValue([]);
    mockedFetchPlayerStats.mockResolvedValue(FULL_STATS);
    renderWithProviders('Alice');

    await waitFor(() => {
      expect(screen.getByTestId('profile-stats')).toBeTruthy();
    });

    expect(screen.getByText('60%')).toBeTruthy();
    expect(screen.getByText('45%')).toBeTruthy();
    expect(screen.getByText('30%')).toBeTruthy();
  });

  it('handles zero stats gracefully', async () => {
    mockedFetchPlayers.mockResolvedValue([]);
    mockedFetchPlayerStats.mockResolvedValue(ZERO_STATS);
    renderWithProviders('Newbie');

    await waitFor(() => {
      expect(screen.getByTestId('profile-stats')).toBeTruthy();
    });

    // StatCard renders 0 as muted but still shows it — "0" should appear multiple times
    const zeros = screen.getAllByText('0');
    expect(zeros.length).toBeGreaterThanOrEqual(1);

    // Win rate and street percentages are all zero
    const zeroPcts = screen.getAllByText('0%');
    expect(zeroPcts.length).toBeGreaterThanOrEqual(1);
  });

  it('shows error state when fetch fails', async () => {
    mockedFetchPlayers.mockResolvedValue([]);
    mockedFetchPlayerStats.mockRejectedValue(new Error('Not found'));
    renderWithProviders('Unknown');

    await waitFor(() => {
      expect(screen.getByTestId('profile-error')).toBeTruthy();
    });
  });

  it('updates document title with player name', async () => {
    mockedFetchPlayers.mockResolvedValue([]);
    mockedFetchPlayerStats.mockResolvedValue(FULL_STATS);
    renderWithProviders('Alice');

    await waitFor(() => {
      expect(document.title).toContain('Alice');
    });
  });

  it('renders a PlayerSelector', () => {
    mockedFetchPlayers.mockResolvedValue([]);
    mockedFetchPlayerStats.mockReturnValue(new Promise(() => {}));
    renderWithProviders('Alice');

    expect(screen.getByRole('combobox')).toBeTruthy();
  });

  it('displays the player name as page heading', async () => {
    mockedFetchPlayers.mockResolvedValue([]);
    mockedFetchPlayerStats.mockResolvedValue(FULL_STATS);
    renderWithProviders('Alice');

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toBeTruthy();
    });
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Alice');
  });

  it('renders Win Rate Trend section with chart', async () => {
    mockedFetchPlayers.mockResolvedValue([]);
    mockedFetchPlayerStats.mockResolvedValue(FULL_STATS);
    mockedFetchPlayerTrends.mockResolvedValue([
      { game_id: 1, game_date: '2025-06-01', hands_played: 10, hands_won: 4, win_rate: 40, profit_loss: 100 },
      { game_id: 2, game_date: '2025-06-08', hands_played: 8, hands_won: 5, win_rate: 62.5, profit_loss: 200 },
    ]);
    renderWithProviders('Alice');

    await waitFor(() => {
      expect(screen.getByTestId('profile-stats')).toBeTruthy();
    });

    expect(screen.getByText('Win Rate Trend')).toBeTruthy();
  });
});
