/** @vitest-environment happy-dom */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../../src/api/client.ts', () => ({
  fetchHeadToHead: vi.fn(),
  fetchPlayers: vi.fn(),
}));

import { fetchHeadToHead, fetchPlayers } from '../../src/api/client.ts';
import { HeadToHeadPage } from '../../src/pages/HeadToHeadPage';

const mockedFetchHeadToHead = vi.mocked(fetchHeadToHead);
const mockedFetchPlayers = vi.mocked(fetchPlayers);

const PLAYERS = [
  { player_id: 1, name: 'Alice' },
  { player_id: 2, name: 'Bob' },
  { player_id: 3, name: 'Charlie' },
];

const H2H_DATA = {
  player1_name: 'Alice',
  player2_name: 'Bob',
  shared_hands_count: 30,
  showdown_count: 10,
  player1_showdown_wins: 6,
  player2_showdown_wins: 4,
  player1_fold_count: 5,
  player2_fold_count: 8,
  player1_fold_rate: 16.67,
  player2_fold_rate: 26.67,
  street_breakdown: [],
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/head-to-head']}>
        <Routes>
          <Route path="/head-to-head" element={<HeadToHeadPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  localStorage.clear();
});

describe('HeadToHeadPage', () => {
  it('shows placeholder when no players are selected', () => {
    mockedFetchPlayers.mockResolvedValue(PLAYERS);
    renderPage();
    expect(screen.getByTestId('h2h-placeholder')).toBeTruthy();
    expect(screen.getByText(/Select two players/i)).toBeTruthy();
  });

  it('renders two player selector inputs', () => {
    mockedFetchPlayers.mockResolvedValue(PLAYERS);
    renderPage();
    const combos = screen.getAllByRole('combobox');
    expect(combos.length).toBe(2);
  });

  it('renders a swap button', () => {
    mockedFetchPlayers.mockResolvedValue(PLAYERS);
    renderPage();
    expect(screen.getByTestId('h2h-swap-btn')).toBeTruthy();
  });

  it('fetches head-to-head data when both players are selected', async () => {
    mockedFetchPlayers.mockResolvedValue(PLAYERS);
    mockedFetchHeadToHead.mockResolvedValue(H2H_DATA);
    renderPage();

    // Select player 1
    const [input1, input2] = screen.getAllByRole('combobox');
    fireEvent.focus(input1);
    fireEvent.change(input1, { target: { value: 'Alice' } });
    await waitFor(() => screen.getAllByRole('option'));
    fireEvent.click(screen.getAllByRole('option')[0]);

    // Select player 2
    fireEvent.focus(input2);
    fireEvent.change(input2, { target: { value: 'Bob' } });
    await waitFor(() => screen.getAllByRole('option'));
    fireEvent.click(screen.getAllByRole('option')[0]);

    await waitFor(() => {
      expect(mockedFetchHeadToHead).toHaveBeenCalledWith('Alice', 'Bob');
    });

    await waitFor(() => {
      expect(screen.getByTestId('h2h-results')).toBeTruthy();
    });
  });

  it('swap button reverses the two selections', async () => {
    mockedFetchPlayers.mockResolvedValue(PLAYERS);
    mockedFetchHeadToHead.mockResolvedValue(H2H_DATA);
    renderPage();

    // Select player 1
    const [input1, input2] = screen.getAllByRole('combobox');
    fireEvent.focus(input1);
    fireEvent.change(input1, { target: { value: 'Alice' } });
    await waitFor(() => screen.getAllByRole('option'));
    fireEvent.click(screen.getAllByRole('option')[0]);

    // Select player 2
    fireEvent.focus(input2);
    fireEvent.change(input2, { target: { value: 'Bob' } });
    await waitFor(() => screen.getAllByRole('option'));
    fireEvent.click(screen.getAllByRole('option')[0]);

    // Swap
    fireEvent.click(screen.getByTestId('h2h-swap-btn'));

    const [updated1, updated2] = screen.getAllByRole('combobox');
    expect((updated1 as HTMLInputElement).value).toBe('Bob');
    expect((updated2 as HTMLInputElement).value).toBe('Alice');
  });

  it('stores recent pairs in localStorage', async () => {
    mockedFetchPlayers.mockResolvedValue(PLAYERS);
    mockedFetchHeadToHead.mockResolvedValue(H2H_DATA);
    renderPage();

    // Select both players
    const [input1, input2] = screen.getAllByRole('combobox');
    fireEvent.focus(input1);
    fireEvent.change(input1, { target: { value: 'Alice' } });
    await waitFor(() => screen.getAllByRole('option'));
    fireEvent.click(screen.getAllByRole('option')[0]);

    fireEvent.focus(input2);
    fireEvent.change(input2, { target: { value: 'Bob' } });
    await waitFor(() => screen.getAllByRole('option'));
    fireEvent.click(screen.getAllByRole('option')[0]);

    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem('h2h-recent-pairs') ?? '[]');
      expect(stored.length).toBeGreaterThan(0);
      expect(stored[0]).toEqual(['Alice', 'Bob']);
    });
  });

  it('renders quick-pick buttons from localStorage', () => {
    localStorage.setItem('h2h-recent-pairs', JSON.stringify([['Alice', 'Bob']]));
    mockedFetchPlayers.mockResolvedValue(PLAYERS);
    renderPage();
    expect(screen.getByTestId('h2h-recent-pairs')).toBeTruthy();
    expect(screen.getByText('Alice vs Bob')).toBeTruthy();
  });

  it('quick-pick button loads the pair into selectors', async () => {
    localStorage.setItem('h2h-recent-pairs', JSON.stringify([['Alice', 'Bob']]));
    mockedFetchPlayers.mockResolvedValue(PLAYERS);
    mockedFetchHeadToHead.mockResolvedValue(H2H_DATA);
    renderPage();

    fireEvent.click(screen.getByText('Alice vs Bob'));

    const [input1, input2] = screen.getAllByRole('combobox');
    expect((input1 as HTMLInputElement).value).toBe('Alice');
    expect((input2 as HTMLInputElement).value).toBe('Bob');

    await waitFor(() => {
      expect(mockedFetchHeadToHead).toHaveBeenCalledWith('Alice', 'Bob');
    });
  });

  it('shows placeholder when only one player is selected', async () => {
    mockedFetchPlayers.mockResolvedValue(PLAYERS);
    renderPage();

    const [input1] = screen.getAllByRole('combobox');
    fireEvent.focus(input1);
    fireEvent.change(input1, { target: { value: 'Alice' } });
    await waitFor(() => screen.getAllByRole('option'));
    fireEvent.click(screen.getAllByRole('option')[0]);

    expect(screen.getByTestId('h2h-placeholder')).toBeTruthy();
    expect(mockedFetchHeadToHead).not.toHaveBeenCalled();
  });
});
