/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import {
  usePlayerTrends,
  useHeadToHead,
  useAwards,
  useGameHighlights,
  usePlayerStats,
  useGameStats,
} from '../../src/hooks/useAnalytics';

// Mock the API client
vi.mock('../../src/api/client', () => ({
  fetchPlayerTrends: vi.fn(),
  fetchHeadToHead: vi.fn(),
  fetchAwards: vi.fn(),
  fetchGameHighlights: vi.fn(),
  fetchPlayerStats: vi.fn(),
  fetchGameStats: vi.fn(),
}));

import {
  fetchPlayerTrends,
  fetchHeadToHead,
  fetchAwards,
  fetchGameHighlights,
  fetchPlayerStats,
  fetchGameStats,
} from '../../src/api/client';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('usePlayerTrends', () => {
  it('fetches trends for a player', async () => {
    const data = [{ game_id: 1, game_date: '2025-01-01', hands_played: 10, hands_won: 5, win_rate: 50, profit_loss: 100 }];
    vi.mocked(fetchPlayerTrends).mockResolvedValue(data);

    const { result } = renderHook(() => usePlayerTrends('Alice'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(data);
    expect(fetchPlayerTrends).toHaveBeenCalledWith('Alice');
  });

  it('does not fetch when name is empty', () => {
    const { result } = renderHook(() => usePlayerTrends(''), { wrapper: createWrapper() });
    expect(result.current.fetchStatus).toBe('idle');
    expect(fetchPlayerTrends).not.toHaveBeenCalled();
  });
});

describe('useHeadToHead', () => {
  it('fetches head-to-head data for two players', async () => {
    const data = {
      player1_name: 'Alice', player2_name: 'Bob',
      shared_hands_count: 5, showdown_count: 3,
      player1_showdown_wins: 2, player2_showdown_wins: 1,
      player1_fold_count: 1, player2_fold_count: 0,
      player1_fold_rate: 20, player2_fold_rate: 0,
      street_breakdown: [],
    };
    vi.mocked(fetchHeadToHead).mockResolvedValue(data);

    const { result } = renderHook(() => useHeadToHead('Alice', 'Bob'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(data);
    expect(fetchHeadToHead).toHaveBeenCalledWith('Alice', 'Bob');
  });

  it('does not fetch when either player is empty', () => {
    const { result } = renderHook(() => useHeadToHead('Alice', ''), { wrapper: createWrapper() });
    expect(result.current.fetchStatus).toBe('idle');
    expect(fetchHeadToHead).not.toHaveBeenCalled();
  });
});

describe('useAwards', () => {
  it('fetches awards without game_id', async () => {
    const data = [{ award_name: 'Iron Man', emoji: '🦾', description: 'Most hands', winner_name: 'Alice', stat_value: 50, stat_label: 'hands' }];
    vi.mocked(fetchAwards).mockResolvedValue(data);

    const { result } = renderHook(() => useAwards(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(data);
    expect(fetchAwards).toHaveBeenCalledWith(undefined);
  });

  it('fetches awards for a specific game', async () => {
    vi.mocked(fetchAwards).mockResolvedValue([]);

    const { result } = renderHook(() => useAwards(42), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchAwards).toHaveBeenCalledWith(42);
  });
});

describe('useGameHighlights', () => {
  it('fetches highlights for a game', async () => {
    const data = [{ hand_number: 1, highlight_type: 'big_win', description: 'Alice won big' }];
    vi.mocked(fetchGameHighlights).mockResolvedValue(data);

    const { result } = renderHook(() => useGameHighlights(7), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(data);
    expect(fetchGameHighlights).toHaveBeenCalledWith(7);
  });

  it('does not fetch when gameId is 0', () => {
    const { result } = renderHook(() => useGameHighlights(0), { wrapper: createWrapper() });
    expect(result.current.fetchStatus).toBe('idle');
    expect(fetchGameHighlights).not.toHaveBeenCalled();
  });
});

describe('usePlayerStats', () => {
  it('fetches player stats', async () => {
    const data = {
      player_name: 'Alice', total_hands_played: 100, hands_won: 40,
      hands_lost: 30, hands_folded: 30, win_rate: 40,
      total_profit_loss: 500, avg_profit_loss_per_hand: 5,
      avg_profit_loss_per_session: 50, flop_pct: 70, turn_pct: 50, river_pct: 30,
    };
    vi.mocked(fetchPlayerStats).mockResolvedValue(data);

    const { result } = renderHook(() => usePlayerStats('Alice'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(data);
    expect(fetchPlayerStats).toHaveBeenCalledWith('Alice');
  });

  it('does not fetch when name is empty', () => {
    const { result } = renderHook(() => usePlayerStats(''), { wrapper: createWrapper() });
    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('useGameStats', () => {
  it('fetches game stats', async () => {
    const data = { game_id: 1, game_date: '2025-01-01', total_hands: 20, player_stats: [] };
    vi.mocked(fetchGameStats).mockResolvedValue(data);

    const { result } = renderHook(() => useGameStats(1), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(data);
    expect(fetchGameStats).toHaveBeenCalledWith(1);
  });

  it('does not fetch when gameId is 0', () => {
    const { result } = renderHook(() => useGameStats(0), { wrapper: createWrapper() });
    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('error handling', () => {
  it('exposes error when fetch fails', async () => {
    vi.mocked(fetchPlayerTrends).mockRejectedValue(new Error('HTTP 500: Internal Server Error'));

    const { result } = renderHook(() => usePlayerTrends('Alice'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('HTTP 500: Internal Server Error');
  });
});

describe('loading state', () => {
  it('starts in loading state', () => {
    vi.mocked(fetchAwards).mockReturnValue(new Promise(() => {})); // never resolves
    const { result } = renderHook(() => useAwards(), { wrapper: createWrapper() });
    expect(result.current.isLoading).toBe(true);
  });
});
