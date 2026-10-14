/** @vitest-environment happy-dom */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const subscriptions: { gameId: number; listener: () => void; stopped: boolean }[] = [];
vi.mock('../../src/api/gameEvents.ts', () => ({
  subscribeToGame: (gameId: number, listener: () => void) => {
    const entry = { gameId, listener, stopped: false };
    subscriptions.push(entry);
    return () => {
      entry.stopped = true;
    };
  },
}));

import { usePolling } from '../../src/hooks/usePolling.ts';

afterEach(() => {
  subscriptions.length = 0;
});

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('usePolling — refresh on game change', () => {
  it('fetches again as soon as the game changes, without waiting for the interval', async () => {
    const fetchFn = vi.fn(() => Promise.resolve());
    renderHook(() => usePolling({ intervalMs: 60_000, fetchFn, gameId: 5 }));
    await act(async () => {});
    expect(fetchFn).toHaveBeenCalledTimes(1);

    await act(async () => {
      subscriptions[0].listener();
    });
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(subscriptions[0].gameId).toBe(5);
  });

  it('does not subscribe without a game, or while disabled', () => {
    renderHook(() => usePolling({ intervalMs: 60_000, fetchFn: () => Promise.resolve() }));
    renderHook(() => usePolling({ intervalMs: 60_000, fetchFn: () => Promise.resolve(), gameId: 5, enabled: false }));
    expect(subscriptions).toHaveLength(0);
  });

  it('unsubscribes on unmount', () => {
    const { unmount } = renderHook(() => usePolling({ intervalMs: 60_000, fetchFn: () => Promise.resolve(), gameId: 5 }));
    unmount();
    expect(subscriptions[0].stopped).toBe(true);
  });

  it('never runs two fetches at once, and runs exactly one more for changes that arrived meanwhile', async () => {
    const first = deferred();
    const fetchFn = vi.fn<() => Promise<void>>()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValue(undefined);
    renderHook(() => usePolling({ intervalMs: 60_000, fetchFn, gameId: 5 }));
    await act(async () => {});
    expect(fetchFn).toHaveBeenCalledTimes(1);

    // Three changes arrive while the first fetch is still running
    await act(async () => {
      subscriptions[0].listener();
      subscriptions[0].listener();
      subscriptions[0].listener();
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);

    await act(async () => {
      first.resolve();
    });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});
