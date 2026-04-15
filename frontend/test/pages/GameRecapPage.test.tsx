/** @vitest-environment happy-dom */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../../src/api/client.ts', () => ({
  fetchGameStats: vi.fn(),
  fetchHands: vi.fn(),
  fetchAwards: vi.fn(),
  fetchGameHighlights: vi.fn(),
}));

import { fetchGameStats, fetchHands, fetchAwards, fetchGameHighlights } from '../../src/api/client.ts';
import { GameRecapPage } from '../../src/pages/GameRecapPage';

const mockedFetchGameStats = vi.mocked(fetchGameStats);
const mockedFetchHands = vi.mocked(fetchHands);
const mockedFetchAwards = vi.mocked(fetchAwards);
const mockedFetchGameHighlights = vi.mocked(fetchGameHighlights);

function renderWithProviders(gameId = '1') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/games/${gameId}/recap`]}>
        <Routes>
          <Route path="/games/:gameId/recap" element={<GameRecapPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('GameRecapPage', () => {
  it('shows a loading skeleton while data is fetching', () => {
    mockedFetchGameStats.mockReturnValue(new Promise(() => {}));
    mockedFetchHands.mockReturnValue(new Promise(() => {}));
    mockedFetchAwards.mockReturnValue(new Promise(() => {}));
    mockedFetchGameHighlights.mockReturnValue(new Promise(() => {}));
    renderWithProviders('5');
    expect(screen.getByTestId('recap-loading')).toBeTruthy();
  });

  it('renders summary, timeline, highlights, and awards sections after loading', async () => {
    mockedFetchGameStats.mockResolvedValue({
      game_id: 5,
      game_date: '2025-04-01',
      total_hands: 15,
      player_stats: [
        { player_name: 'Alice', hands_played: 15, hands_won: 5, hands_lost: 7, hands_folded: 3, win_rate: 33.3, profit_loss: 50 },
      ],
    });
    mockedFetchHands.mockResolvedValue([
      { hand_id: 1, game_id: 5, hand_number: 1, flop_1: null, flop_2: null, flop_3: null, turn: null, river: null, pot: 100, player_hands: [] },
    ]);
    mockedFetchAwards.mockResolvedValue([
      { award_name: 'Big Winner', emoji: '💰', description: 'Highest profit', winner_name: 'Alice', stat_value: 500, stat_label: 'chips' },
    ]);
    mockedFetchGameHighlights.mockResolvedValue([
      { hand_number: 1, highlight_type: 'most_action', description: 'Hand 1: 4 players saw action' },
    ]);

    renderWithProviders('5');

    await waitFor(() => {
      expect(screen.getByTestId('recap-summary')).toBeTruthy();
    });

    expect(screen.getByTestId('recap-timeline')).toBeTruthy();
    expect(screen.getByTestId('key-moments-section')).toBeTruthy();
    expect(screen.getByTestId('recap-awards')).toBeTruthy();
  });

  it('displays game date and total hands in summary', async () => {
    mockedFetchGameStats.mockResolvedValue({
      game_id: 3,
      game_date: '2025-06-15',
      total_hands: 22,
      player_stats: [],
    });
    mockedFetchHands.mockResolvedValue([]);
    mockedFetchAwards.mockResolvedValue([]);
    mockedFetchGameHighlights.mockResolvedValue([]);

    renderWithProviders('3');

    await waitFor(() => {
      expect(screen.getByText('2025-06-15')).toBeTruthy();
    });
    expect(screen.getByText(/22 hands/i)).toBeTruthy();
  });

  it('shows an error when game stats fail to load', async () => {
    mockedFetchGameStats.mockRejectedValue(new Error('Not found'));
    mockedFetchHands.mockResolvedValue([]);
    mockedFetchAwards.mockResolvedValue([]);
    mockedFetchGameHighlights.mockResolvedValue([]);

    renderWithProviders('999');

    await waitFor(() => {
      expect(screen.getByTestId('recap-error')).toBeTruthy();
    });
  });

  it('shows an error when hands query fails', async () => {
    mockedFetchGameStats.mockResolvedValue({
      game_id: 1,
      game_date: '2025-04-01',
      total_hands: 0,
      player_stats: [],
    });
    mockedFetchHands.mockRejectedValue(new Error('hands fetch failed'));
    mockedFetchAwards.mockResolvedValue([]);
    mockedFetchGameHighlights.mockResolvedValue([]);

    renderWithProviders('1');

    await waitFor(() => {
      expect(screen.getByTestId('recap-error')).toBeTruthy();
    });
  });

  it('shows an error when awards query fails', async () => {
    mockedFetchGameStats.mockResolvedValue({
      game_id: 1,
      game_date: '2025-04-01',
      total_hands: 0,
      player_stats: [],
    });
    mockedFetchHands.mockResolvedValue([]);
    mockedFetchAwards.mockRejectedValue(new Error('awards fetch failed'));
    mockedFetchGameHighlights.mockResolvedValue([]);

    renderWithProviders('1');

    await waitFor(() => {
      expect(screen.getByTestId('recap-error')).toBeTruthy();
    });
  });

  it('shows an error when highlights query fails', async () => {
    mockedFetchGameStats.mockResolvedValue({
      game_id: 1,
      game_date: '2025-04-01',
      total_hands: 0,
      player_stats: [],
    });
    mockedFetchHands.mockResolvedValue([]);
    mockedFetchAwards.mockResolvedValue([]);
    mockedFetchGameHighlights.mockRejectedValue(new Error('highlights fetch failed'));

    renderWithProviders('1');

    await waitFor(() => {
      expect(screen.getByTestId('recap-error')).toBeTruthy();
    });
  });

  it('renders player summary cards section when player_stats exist', async () => {
    mockedFetchGameStats.mockResolvedValue({
      game_id: 5,
      game_date: '2025-04-01',
      total_hands: 15,
      player_stats: [
        { player_name: 'Alice', hands_played: 15, hands_won: 8, hands_lost: 4, hands_folded: 3, win_rate: 53.33, profit_loss: 75 },
        { player_name: 'Bob', hands_played: 15, hands_won: 4, hands_lost: 8, hands_folded: 3, win_rate: 26.67, profit_loss: -30 },
      ],
    });
    mockedFetchHands.mockResolvedValue([]);
    mockedFetchAwards.mockResolvedValue([]);
    mockedFetchGameHighlights.mockResolvedValue([]);

    renderWithProviders('5');

    await waitFor(() => {
      expect(screen.getByTestId('recap-player-summaries')).toBeTruthy();
    });
    expect(screen.getByTestId('player-card-Alice')).toBeTruthy();
    expect(screen.getByTestId('player-card-Bob')).toBeTruthy();
  });

  it('does not render player summary section when player_stats is empty', async () => {
    mockedFetchGameStats.mockResolvedValue({
      game_id: 3,
      game_date: '2025-06-15',
      total_hands: 0,
      player_stats: [],
    });
    mockedFetchHands.mockResolvedValue([]);
    mockedFetchAwards.mockResolvedValue([]);
    mockedFetchGameHighlights.mockResolvedValue([]);

    renderWithProviders('3');

    await waitFor(() => {
      expect(screen.getByTestId('recap-summary')).toBeTruthy();
    });
    expect(screen.queryByTestId('recap-player-summaries')).toBeNull();
  });

  it('hides key moments section when highlights are empty', async () => {
    mockedFetchGameStats.mockResolvedValue({
      game_id: 3,
      game_date: '2025-06-15',
      total_hands: 0,
      player_stats: [],
    });
    mockedFetchHands.mockResolvedValue([]);
    mockedFetchAwards.mockResolvedValue([]);
    mockedFetchGameHighlights.mockResolvedValue([]);

    renderWithProviders('3');

    await waitFor(() => {
      expect(screen.getByTestId('recap-summary')).toBeTruthy();
    });
    expect(screen.queryByTestId('key-moments-section')).toBeNull();
  });

  it('renders highlight chips when highlights exist', async () => {
    mockedFetchGameStats.mockResolvedValue({
      game_id: 2,
      game_date: '2025-04-01',
      total_hands: 10,
      player_stats: [],
    });
    mockedFetchHands.mockResolvedValue([
      { hand_id: 1, game_id: 2, hand_number: 1, flop_1: null, flop_2: null, flop_3: null, turn: null, river: null, pot: 50, player_hands: [] },
      { hand_id: 2, game_id: 2, hand_number: 3, flop_1: null, flop_2: null, flop_3: null, turn: null, river: null, pot: 80, player_hands: [] },
    ]);
    mockedFetchAwards.mockResolvedValue([]);
    mockedFetchGameHighlights.mockResolvedValue([
      { hand_number: 1, highlight_type: 'most_action', description: 'Hand 1: 4 players saw action' },
      { hand_number: 3, highlight_type: 'river_showdown', description: 'Hand 3: 3 players reached the river' },
    ]);

    renderWithProviders('2');

    await waitFor(() => {
      expect(screen.getByTestId('key-moments-section')).toBeTruthy();
    });
    expect(screen.getByTestId('highlight-chip-0')).toBeTruthy();
    expect(screen.getByTestId('highlight-chip-1')).toBeTruthy();
  });

  it('highlights the game winner in player summary cards', async () => {
    mockedFetchGameStats.mockResolvedValue({
      game_id: 7,
      game_date: '2025-07-01',
      total_hands: 20,
      player_stats: [
        { player_name: 'Winner', hands_played: 20, hands_won: 12, hands_lost: 5, hands_folded: 3, win_rate: 60, profit_loss: 200 },
        { player_name: 'Loser', hands_played: 20, hands_won: 3, hands_lost: 12, hands_folded: 5, win_rate: 15, profit_loss: -50 },
      ],
    });
    mockedFetchHands.mockResolvedValue([]);
    mockedFetchAwards.mockResolvedValue([]);
    mockedFetchGameHighlights.mockResolvedValue([]);

    renderWithProviders('7');

    await waitFor(() => {
      expect(screen.getByTestId('player-card-Winner')).toBeTruthy();
    });
    expect(screen.getByTestId('player-card-Winner').textContent).toContain('🏆');
    expect(screen.getByTestId('player-card-Loser').textContent).not.toContain('🏆');
  });

  it('hides awards section when no awards are returned', async () => {
    mockedFetchGameStats.mockResolvedValue({
      game_id: 1,
      game_date: '2025-04-01',
      total_hands: 5,
      player_stats: [],
    });
    mockedFetchHands.mockResolvedValue([]);
    mockedFetchAwards.mockResolvedValue([]);
    mockedFetchGameHighlights.mockResolvedValue([]);

    renderWithProviders('1');

    await waitFor(() => {
      expect(screen.getByTestId('recap-summary')).toBeTruthy();
    });
    expect(screen.queryByTestId('recap-awards')).toBeNull();
  });

  it('renders up to 3 AwardCard components when awards exist', async () => {
    mockedFetchGameStats.mockResolvedValue({
      game_id: 2,
      game_date: '2025-04-01',
      total_hands: 10,
      player_stats: [],
    });
    mockedFetchHands.mockResolvedValue([]);
    mockedFetchAwards.mockResolvedValue([
      { award_name: 'Big Winner', emoji: '💰', description: 'Highest profit', winner_name: 'Alice', stat_value: 500, stat_label: 'chips' },
      { award_name: 'Hot Streak', emoji: '🔥', description: 'Most wins', winner_name: 'Bob', stat_value: 8, stat_label: 'wins' },
      { award_name: 'All In King', emoji: '👑', description: 'Most all-ins', winner_name: 'Charlie', stat_value: 5, stat_label: 'all-ins' },
      { award_name: 'Bluffer', emoji: '🃏', description: 'Most bluffs', winner_name: 'Dave', stat_value: 3, stat_label: 'bluffs' },
    ]);
    mockedFetchGameHighlights.mockResolvedValue([]);

    renderWithProviders('2');

    await waitFor(() => {
      expect(screen.getByTestId('recap-awards')).toBeTruthy();
    });
    // Only 3 cards rendered, not 4
    expect(screen.getByTestId('award-card-0')).toBeTruthy();
    expect(screen.getByTestId('award-card-1')).toBeTruthy();
    expect(screen.getByTestId('award-card-2')).toBeTruthy();
    expect(screen.queryByTestId('award-card-3')).toBeNull();
  });

  it('renders fewer than 3 AwardCards when fewer awards exist', async () => {
    mockedFetchGameStats.mockResolvedValue({
      game_id: 2,
      game_date: '2025-04-01',
      total_hands: 10,
      player_stats: [],
    });
    mockedFetchHands.mockResolvedValue([]);
    mockedFetchAwards.mockResolvedValue([
      { award_name: 'Big Winner', emoji: '💰', description: 'Highest profit', winner_name: 'Alice', stat_value: 500, stat_label: 'chips' },
    ]);
    mockedFetchGameHighlights.mockResolvedValue([]);

    renderWithProviders('2');

    await waitFor(() => {
      expect(screen.getByTestId('recap-awards')).toBeTruthy();
    });
    expect(screen.getByTestId('award-card-0')).toBeTruthy();
    expect(screen.queryByTestId('award-card-1')).toBeNull();
  });

  it('links each AwardCard to the player profile page', async () => {
    mockedFetchGameStats.mockResolvedValue({
      game_id: 2,
      game_date: '2025-04-01',
      total_hands: 10,
      player_stats: [],
    });
    mockedFetchHands.mockResolvedValue([]);
    mockedFetchAwards.mockResolvedValue([
      { award_name: 'Big Winner', emoji: '💰', description: 'Highest profit', winner_name: 'Alice', stat_value: 500, stat_label: 'chips' },
      { award_name: 'Hot Streak', emoji: '🔥', description: 'Most wins', winner_name: 'Bob', stat_value: 8, stat_label: 'wins' },
    ]);
    mockedFetchGameHighlights.mockResolvedValue([]);

    renderWithProviders('2');

    await waitFor(() => {
      expect(screen.getByTestId('recap-awards')).toBeTruthy();
    });

    const link0 = screen.getByTestId('award-card-0').closest('a');
    const link1 = screen.getByTestId('award-card-1').closest('a');
    expect(link0?.getAttribute('href')).toBe('/players/Alice');
    expect(link1?.getAttribute('href')).toBe('/players/Bob');
  });
});
