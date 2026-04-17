/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock the API client
vi.mock('../../src/api/client.ts', () => ({
  fetchHands: vi.fn(),
}));

// Mock usePolling to give us control over when polling fires
vi.mock('../../src/../src/hooks/usePolling.ts', () => {
  // Store the latest fetchFn so tests can trigger polls manually
  let latestFetchFn: ((signal: AbortSignal) => Promise<unknown>) | null = null;
  let latestEnabled: boolean | undefined;
  return {
    usePolling: vi.fn(({ fetchFn, enabled }: { fetchFn: (signal: AbortSignal) => Promise<unknown>; enabled?: boolean }) => {
      latestFetchFn = fetchFn;
      latestEnabled = enabled;
      return { isReconnecting: false };
    }),
    // Test helpers
    __getLatestFetchFn: () => latestFetchFn,
    __getLatestEnabled: () => latestEnabled,
  };
});

import { fetchHands } from '../../src/api/client.ts';
import { usePolling } from '../../src/../src/hooks/usePolling.ts';
import type { HandResponse } from '../../src/api/types';

const { useHandPolling } = await import('../../src/hooks/useHandPolling.ts');

function makeHand(overrides: Partial<HandResponse> = {}): HandResponse {
  return {
    hand_id: 1,
    game_id: 5,
    hand_number: 1,
    flop_1: null,
    flop_2: null,
    flop_3: null,
    turn: null,
    river: null,
    source_upload_id: null,
    sb_player_name: null,
    bb_player_name: null,
    created_at: '2026-04-10T12:00:00Z',
    player_hands: [],
    ...overrides,
  };
}

describe('useHandPolling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes gameId and 10000ms interval to usePolling', () => {
    renderHook(() => useHandPolling({ gameId: 5, currentHandIndex: 0 }));

    expect(usePolling).toHaveBeenCalledWith(
      expect.objectContaining({
        intervalMs: 10000,
        enabled: true,
      }),
    );
  });

  it('disables polling when gameId is null', () => {
    renderHook(() => useHandPolling({ gameId: null, currentHandIndex: 0 }));

    expect(usePolling).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false,
      }),
    );
  });

  it('returns empty hands array initially', () => {
    const { result } = renderHook(() => useHandPolling({ gameId: 5, currentHandIndex: 0 }));

    expect(result.current.hands).toEqual([]);
  });

  it('updates hands when poll returns data', async () => {
    const hand1 = makeHand({ hand_id: 1, hand_number: 1 });
    vi.mocked(fetchHands).mockResolvedValue([hand1]);

    const { result } = renderHook(() => useHandPolling({ gameId: 5, currentHandIndex: 0 }));

    // Simulate polling by calling the fetchFn that was passed to usePolling
    const fetchFn = vi.mocked(usePolling).mock.calls[0][0].fetchFn;
    await act(async () => {
      await fetchFn(new AbortController().signal);
    });

    expect(result.current.hands).toEqual([hand1]);
  });

  it('sorts hands by hand_number ascending', async () => {
    const hand2 = makeHand({ hand_id: 2, hand_number: 2 });
    const hand1 = makeHand({ hand_id: 1, hand_number: 1 });
    vi.mocked(fetchHands).mockResolvedValue([hand2, hand1]);

    const { result } = renderHook(() => useHandPolling({ gameId: 5, currentHandIndex: 0 }));

    const fetchFn = vi.mocked(usePolling).mock.calls[0][0].fetchFn;
    await act(async () => {
      await fetchFn(new AbortController().signal);
    });

    expect(result.current.hands[0].hand_number).toBe(1);
    expect(result.current.hands[1].hand_number).toBe(2);
  });

  it('sets newHandAvailable when new hand appears and user is NOT on latest', async () => {
    const hand1 = makeHand({ hand_id: 1, hand_number: 1 });
    const hand2 = makeHand({ hand_id: 2, hand_number: 2 });
    const hand3 = makeHand({ hand_id: 3, hand_number: 3 });
    vi.mocked(fetchHands).mockResolvedValue([hand1, hand2]);

    // User is viewing hand index 0 (scrubbing an older hand, NOT on latest)
    const { result } = renderHook(() =>
      useHandPolling({ gameId: 5, currentHandIndex: 0 }),
    );

    // First poll - loads 2 hands
    const fetchFn1 = vi.mocked(usePolling).mock.calls[0][0].fetchFn;
    await act(async () => {
      await fetchFn1(new AbortController().signal);
    });

    expect(result.current.newHandAvailable).toBe(false);

    // New hand arrives; user is still on index 0 (NOT on latest which was index 1)
    vi.mocked(fetchHands).mockResolvedValue([hand1, hand2, hand3]);
    const fetchFn2 = vi.mocked(usePolling).mock.calls.at(-1)![0].fetchFn;
    await act(async () => {
      await fetchFn2(new AbortController().signal);
    });

    expect(result.current.newHandAvailable).toBe(true);
  });

  it('auto-advances when new hand appears and user IS on latest', async () => {
    const hand1 = makeHand({ hand_id: 1, hand_number: 1 });
    const hand2 = makeHand({ hand_id: 2, hand_number: 2 });
    vi.mocked(fetchHands).mockResolvedValue([hand1]);

    const onAutoAdvance = vi.fn();
    const { result } = renderHook(() =>
      useHandPolling({ gameId: 5, currentHandIndex: 0, onAutoAdvance }),
    );

    // First poll
    const fetchFn1 = vi.mocked(usePolling).mock.calls[0][0].fetchFn;
    await act(async () => {
      await fetchFn1(new AbortController().signal);
    });

    // User is on index 0 (latest, since there's only 1 hand)
    // Now 2 hands arrive — user was on latest, should auto-advance
    vi.mocked(fetchHands).mockResolvedValue([hand1, hand2]);
    const fetchFn2 = vi.mocked(usePolling).mock.calls.at(-1)![0].fetchFn;
    await act(async () => {
      await fetchFn2(new AbortController().signal);
    });

    expect(onAutoAdvance).toHaveBeenCalledWith(1); // new index
    expect(result.current.newHandAvailable).toBe(false);
  });

  it('clears newHandAvailable when dismissNewHand is called', async () => {
    const hand1 = makeHand({ hand_id: 1, hand_number: 1 });
    const hand2 = makeHand({ hand_id: 2, hand_number: 2 });
    const hand3 = makeHand({ hand_id: 3, hand_number: 3 });
    vi.mocked(fetchHands).mockResolvedValue([hand1, hand2]);

    // User is on index 0 (NOT on latest)
    const { result } = renderHook(() =>
      useHandPolling({ gameId: 5, currentHandIndex: 0 }),
    );

    // Load initial hands
    const fetchFn1 = vi.mocked(usePolling).mock.calls[0][0].fetchFn;
    await act(async () => {
      await fetchFn1(new AbortController().signal);
    });

    // New hand arrives, user not on latest
    vi.mocked(fetchHands).mockResolvedValue([hand1, hand2, hand3]);
    const fetchFn2 = vi.mocked(usePolling).mock.calls.at(-1)![0].fetchFn;
    await act(async () => {
      await fetchFn2(new AbortController().signal);
    });

    expect(result.current.newHandAvailable).toBe(true);

    // Dismiss
    act(() => {
      result.current.dismissNewHand();
    });

    expect(result.current.newHandAvailable).toBe(false);
  });

  it('detects community card changes on the current hand', async () => {
    const hand1 = makeHand({ hand_id: 1, hand_number: 1, flop_1: null, flop_2: null, flop_3: null });
    vi.mocked(fetchHands).mockResolvedValue([hand1]);

    const { result } = renderHook(() =>
      useHandPolling({ gameId: 5, currentHandIndex: 0 }),
    );

    // First poll
    const fetchFn1 = vi.mocked(usePolling).mock.calls[0][0].fetchFn;
    await act(async () => {
      await fetchFn1(new AbortController().signal);
    });

    // Community cards get updated
    const hand1Updated = makeHand({ hand_id: 1, hand_number: 1, flop_1: 'Ah', flop_2: 'Kd', flop_3: 'Qc' });
    vi.mocked(fetchHands).mockResolvedValue([hand1Updated]);
    const fetchFn2 = vi.mocked(usePolling).mock.calls.at(-1)![0].fetchFn;
    await act(async () => {
      await fetchFn2(new AbortController().signal);
    });

    // The hand data should be updated with community cards
    expect(result.current.hands[0].flop_1).toBe('Ah');
    expect(result.current.hands[0].flop_2).toBe('Kd');
    expect(result.current.hands[0].flop_3).toBe('Qc');
  });

  it('exposes isReconnecting from usePolling', () => {
    vi.mocked(usePolling).mockReturnValueOnce({ isReconnecting: true });

    const { result } = renderHook(() => useHandPolling({ gameId: 5, currentHandIndex: 0 }));

    expect(result.current.isReconnecting).toBe(true);
  });

  it('passes signal to fetchHands', async () => {
    vi.mocked(fetchHands).mockResolvedValue([]);

    renderHook(() => useHandPolling({ gameId: 5, currentHandIndex: 0 }));

    const fetchFn = vi.mocked(usePolling).mock.calls[0][0].fetchFn;
    const signal = new AbortController().signal;
    await act(async () => {
      await fetchFn(signal);
    });

    expect(fetchHands).toHaveBeenCalledWith(5, { signal });
  });
});
