/** @vitest-environment happy-dom */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

vi.mock('../../../src/api/client', () => ({
  fetchEquity: vi.fn(),
}));

import { fetchEquity } from '../../../src/api/client';
import {
  useEquityQuery,
  buildEquityQueryKey,
  EQUITY_QUERY_KEY,
} from '../../../src/scenes3d/data/useEquityQuery';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('buildEquityQueryKey', () => {
  it('is stable for the same gameId/handNumber/streetIndex tuple', () => {
    expect(buildEquityQueryKey(1, 2, 0)).toEqual([EQUITY_QUERY_KEY, 1, 2, 0]);
    expect(buildEquityQueryKey(1, 2, 0)).toEqual(buildEquityQueryKey(1, 2, 0));
  });

  it('differs when streetIndex changes (so react-query refetches on street advance)', () => {
    expect(buildEquityQueryKey(1, 2, 0)).not.toEqual(
      buildEquityQueryKey(1, 2, 1),
    );
  });
});

describe('useEquityQuery', () => {
  it('does not call fetchEquity when enabled=false', async () => {
    const { result } = renderHook(
      () =>
        useEquityQuery({
          gameId: 1,
          handNumber: 2,
          streetIndex: 0,
          enabled: false,
        }),
      { wrapper: createWrapper() },
    );
    // Give react-query a chance to run any scheduled work.
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchEquity).not.toHaveBeenCalled();
    expect(result.current.data).toBeUndefined();
  });

  it('fetches exactly once when enabled=true', async () => {
    vi.mocked(fetchEquity).mockResolvedValue({
      equities: [
        { player_name: 'Alice', equity: 0.62, winning_hand_description: null },
      ],
    });
    const { result } = renderHook(
      () =>
        useEquityQuery({
          gameId: 42,
          handNumber: 3,
          streetIndex: 1,
          enabled: true,
        }),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchEquity).toHaveBeenCalledTimes(1);
    expect(fetchEquity).toHaveBeenCalledWith(42, 3, 'flop');
    expect(result.current.data?.equities[0].equity).toBeCloseTo(0.62, 4);
  });

  it('exposes the error state without retrying on fetch failure (AC 5)', async () => {
    vi.mocked(fetchEquity).mockRejectedValue(new Error('nope'));
    const { result } = renderHook(
      () =>
        useEquityQuery({
          gameId: 1,
          handNumber: 1,
          streetIndex: 0,
          enabled: true,
        }),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(fetchEquity).toHaveBeenCalledTimes(1);
    expect(result.current.data).toBeUndefined();
  });
});
