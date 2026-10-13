/** @vitest-environment happy-dom */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../../src/api/client.ts', () => ({
  fetchLeaderboard: vi.fn(),
}));

import { fetchLeaderboard } from '../../src/api/client.ts';
import { AnalyticsPage } from '../../src/pages/AnalyticsPage';

const mockedFetchLeaderboard = vi.mocked(fetchLeaderboard);

const LEADERBOARD = [
  { rank: 1, player_name: 'Alice', total_profit_loss: 250.5, win_rate: 65, hands_played: 40 },
  { rank: 2, player_name: 'Bob', total_profit_loss: -80, win_rate: 35, hands_played: 30 },
];

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/analytics']}>
        <Routes>
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/players/:playerName" element={<div data-testid="player-profile">Player Profile</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('AnalyticsPage', () => {
  it('renders the page heading', async () => {
    mockedFetchLeaderboard.mockResolvedValue(LEADERBOARD);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/analytics/i)).toBeTruthy();
    });
  });

  it('shows loading state for the leaderboard', () => {
    mockedFetchLeaderboard.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByTestId('leaderboard-loading')).toBeTruthy();
  });

  it('shows error state when leaderboard fetch fails', async () => {
    mockedFetchLeaderboard.mockRejectedValue(new Error('Network error'));
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('leaderboard-error')).toBeTruthy();
    });
  });

  it('renders leaderboard rows with rank, name, profit, win rate, and hands', async () => {
    mockedFetchLeaderboard.mockResolvedValue(LEADERBOARD);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeTruthy();
    });
    expect(screen.getByText('Bob')).toBeTruthy();
    expect(screen.getByText('40')).toBeTruthy();
    expect(screen.getByText('30')).toBeTruthy();
  });

  it('leaderboard rows link to player profiles', async () => {
    mockedFetchLeaderboard.mockResolvedValue(LEADERBOARD);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeTruthy();
    });
    const aliceLink = screen.getByRole('link', { name: /Alice/ });
    expect(aliceLink.getAttribute('href')).toBe('/players/Alice');
    const bobLink = screen.getByRole('link', { name: /Bob/ });
    expect(bobLink.getAttribute('href')).toBe('/players/Bob');
  });

  it('renders navigation cards for game sessions, head-to-head, and awards', async () => {
    mockedFetchLeaderboard.mockResolvedValue([]);
    renderPage();

    const gamesLink = await waitFor(() => screen.getByRole('link', { name: /game sessions/i }));
    expect(gamesLink.getAttribute('href')).toBe('/data');
    const h2hLink = screen.getByRole('link', { name: /head to head/i });
    expect(h2hLink.getAttribute('href')).toBe('/head-to-head');
    const awardsLink = screen.getByRole('link', { name: /awards.*superlative/i });
    expect(awardsLink.getAttribute('href')).toBe('/awards');
  });

  it('colors profit green and loss red', async () => {
    mockedFetchLeaderboard.mockResolvedValue(LEADERBOARD);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeTruthy();
    });
    const profitCell = screen.getByTestId('profit-Alice');
    expect(profitCell.style.color).toBe('#22c55e');
    const lossCell = screen.getByTestId('profit-Bob');
    expect(lossCell.style.color).toBe('#ef4444');
  });

  it('renders the wins donut chart alongside the leaderboard', async () => {
    mockedFetchLeaderboard.mockResolvedValue(LEADERBOARD);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Hands Won')).toBeTruthy();
    });
    expect(screen.getByTestId('wins-donut-chart')).toBeTruthy();
  });

  it('displays win rate as a percentage without double-multiplying', async () => {
    mockedFetchLeaderboard.mockResolvedValue(LEADERBOARD);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeTruthy();
    });
    // win_rate comes from backend as 65 (meaning 65%), should display "65%" not "6500%"
    expect(screen.getByText('65%')).toBeTruthy();
    expect(screen.getByText('35%')).toBeTruthy();
    expect(screen.queryByText('6500%')).toBeNull();
    expect(screen.queryByText('3500%')).toBeNull();
  });

  it('page container constrains width and clips horizontal overflow', async () => {
    mockedFetchLeaderboard.mockResolvedValue(LEADERBOARD);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeTruthy();
    });
    const page = screen.getByTestId('landing-page');
    expect(page.style.width).toBe('100%');
    expect(page.style.overflowX).toBe('hidden');
  });

  it('leaderboard table wrapper allows horizontal scrolling', async () => {
    mockedFetchLeaderboard.mockResolvedValue(LEADERBOARD);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeTruthy();
    });
    const wrapper = screen.getByTestId('leaderboard-table-wrap');
    expect(wrapper.style.overflowX).toBe('auto');
    // Must allow shrinking in flex context
    expect(wrapper.style.minWidth).toBe('0');
  });

  it('leaderboard profit/loss values include dollar signs', async () => {
    mockedFetchLeaderboard.mockResolvedValue(LEADERBOARD);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeTruthy();
    });
    const aliceProfit = screen.getByTestId('profit-Alice');
    expect(aliceProfit.textContent).toContain('$');
    expect(aliceProfit.textContent).toContain('250.50');
    const bobLoss = screen.getByTestId('profit-Bob');
    expect(bobLoss.textContent).toContain('$');
    expect(bobLoss.textContent).toContain('80.00');
  });
});
