/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePolling } from './usePolling.ts';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('usePolling', () => {
  it('calls fetchFn immediately on mount', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ value: 1 });

    renderHook(() => usePolling({ intervalMs: 3000, fetchFn }));
    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchFn).toHaveBeenCalledTimes(1);
    // signal is passed
    expect(fetchFn).toHaveBeenCalledWith(expect.any(AbortSignal));
  });

  it('calls fetchFn again after interval', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ value: 1 });

    renderHook(() => usePolling({ intervalMs: 5000, fetchFn }));
    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchFn).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(5000);
      await Promise.resolve();
    });

    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('passes AbortSignal to fetchFn', async () => {
    const fetchFn = vi.fn().mockResolvedValue(null);
    renderHook(() => usePolling({ intervalMs: 3000, fetchFn }));
    await act(async () => {
      await Promise.resolve();
    });

    const signal = fetchFn.mock.calls[0][0];
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(signal.aborted).toBe(false);
  });

  it('aborts signal on unmount', async () => {
    const fetchFn = vi.fn().mockResolvedValue(null);
    const { unmount } = renderHook(() => usePolling({ intervalMs: 3000, fetchFn }));
    await act(async () => {
      await Promise.resolve();
    });

    const signal = fetchFn.mock.calls[0][0] as AbortSignal;
    unmount();
    expect(signal.aborted).toBe(true);
  });

  it('sets isReconnecting on transient error, clears on success', async () => {
    let callCount = 0;
    const fetchFn = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve('ok');
      if (callCount === 2) return Promise.reject(new Error('network'));
      return Promise.resolve('recovered');
    });

    const { result } = renderHook(() => usePolling({ intervalMs: 1000, fetchFn }));
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.isReconnecting).toBe(false);

    // Second call fails
    await act(async () => {
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.isReconnecting).toBe(true);

    // Third call succeeds
    await act(async () => {
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.isReconnecting).toBe(false);
  });

  it('does not set isReconnecting for AbortError', async () => {
    const abortError = new DOMException('The operation was aborted.', 'AbortError');
    const fetchFn = vi.fn()
      .mockResolvedValueOnce('ok')
      .mockRejectedValueOnce(abortError);

    const { result } = renderHook(() => usePolling({ intervalMs: 1000, fetchFn }));
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.isReconnecting).toBe(false);
  });

  it('stops polling when enabled is false', async () => {
    const fetchFn = vi.fn().mockResolvedValue('ok');

    const { rerender } = renderHook(
      ({ enabled }) => usePolling({ intervalMs: 1000, fetchFn, enabled }),
      { initialProps: { enabled: false } },
    );

    await act(async () => {
      vi.advanceTimersByTime(5000);
      await Promise.resolve();
    });

    expect(fetchFn).not.toHaveBeenCalled();

    // Enable polling
    rerender({ enabled: true });
    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('clears interval on unmount', async () => {
    const fetchFn = vi.fn().mockResolvedValue('ok');

    const { unmount } = renderHook(() => usePolling({ intervalMs: 2000, fetchFn }));
    await act(async () => {
      await Promise.resolve();
    });

    unmount();

    await act(async () => {
      vi.advanceTimersByTime(10000);
      await Promise.resolve();
    });

    // Only the initial call before unmount
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('restarts polling when intervalMs changes', async () => {
    const fetchFn = vi.fn().mockResolvedValue('ok');

    const { rerender } = renderHook(
      ({ interval }) => usePolling({ intervalMs: interval, fetchFn }),
      { initialProps: { interval: 3000 } },
    );
    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchFn).toHaveBeenCalledTimes(1);

    // Change interval — should restart and call immediately
    rerender({ interval: 5000 });
    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});
