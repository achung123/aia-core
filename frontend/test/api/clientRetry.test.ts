import { describe, it, expect, vi, afterEach } from 'vitest';

import { fetchGame, startHand } from '../../src/api/client.ts';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function okJson(body: unknown): Response {
  return { ok: true, json: () => Promise.resolve(body) } as Response;
}

describe('API client — network failures', () => {
  it('retries a read that failed before reaching the server', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(okJson({ game_id: 3 }));
    vi.stubGlobal('fetch', fetchMock);

    const pending = fetchGame(3);
    await vi.runAllTimersAsync();
    await expect(pending).resolves.toEqual({ game_id: 3 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('gives up on a read after three attempts', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetchMock);

    const pending = fetchGame(3);
    const outcome = expect(pending).rejects.toThrow('Failed to fetch');
    await vi.runAllTimersAsync();
    await outcome;
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('never retries a write — the first attempt may have landed', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(startHand(3)).rejects.toThrow('Failed to fetch');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not retry an error the server actually returned', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false, status: 404, text: () => Promise.resolve('not found'),
    } as Response);
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchGame(3)).rejects.toThrow('HTTP 404');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
