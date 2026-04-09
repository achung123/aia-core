import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchHandStatus } from './client.js';

describe('fetchHandStatus', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('calls GET /games/{gameId}/hands/{handNumber}/status and returns JSON', async () => {
    const payload = { status: 'in_progress', hand_number: 3 };
    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(payload),
    });

    const result = await fetchHandStatus(7, 3);

    expect(fetch).toHaveBeenCalledOnce();
    const [url] = fetch.mock.calls[0];
    expect(url).toBe('/games/7/hands/3/status');
    expect(result).toEqual(payload);
  });

  it('throws on non-ok response', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: () => Promise.resolve('Not found'),
    });

    await expect(fetchHandStatus(1, 99)).rejects.toThrow('HTTP 404: Not found');
  });
});
