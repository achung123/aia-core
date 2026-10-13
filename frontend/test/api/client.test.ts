import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchHandStatus,
  togglePlayerStatus,
  addPlayerToGame,
  startHand,
  recordPlayerAction,
  fetchBlinds,
  updateBlinds,
} from '../../src/../src/api/client.ts';

type MockFetch = ReturnType<typeof vi.fn>;

function mockOk(payload: unknown) {
  (fetch as MockFetch).mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve(payload),
  });
}

function mockError(status: number, text: string) {
  (fetch as MockFetch).mockResolvedValueOnce({
    ok: false,
    status,
    text: () => Promise.resolve(text),
  });
}

function lastCallUrl(): string {
  return (fetch as MockFetch).mock.calls[0][0];
}

function lastCallOptions(): RequestInit {
  return (fetch as MockFetch).mock.calls[0][1];
}

describe('fetchHandStatus', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('calls GET /games/{gameId}/hands/{handNumber}/status and returns JSON', async () => {
    const payload = { status: 'in_progress', hand_number: 3 };
    mockOk(payload);

    const result = await fetchHandStatus(7, 3);

    expect(fetch).toHaveBeenCalledOnce();
    expect(lastCallUrl()).toBe('/games/7/hands/3/status');
    expect(result).toEqual(payload);
  });

  it('throws on non-ok response', async () => {
    mockError(404, 'Not found');
    await expect(fetchHandStatus(1, 99)).rejects.toThrow('HTTP 404: Not found');
  });
});

describe('togglePlayerStatus', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('calls PATCH /games/{gameId}/players/{playerName}/status', async () => {
    const payload = { player_name: 'Alice', is_active: false };
    mockOk(payload);

    const result = await togglePlayerStatus(1, 'Alice', false);

    expect(fetch).toHaveBeenCalledOnce();
    expect(lastCallUrl()).toBe('/games/1/players/Alice/status');
    expect(lastCallOptions().method).toBe('PATCH');
    expect(JSON.parse(lastCallOptions().body as string)).toEqual({ is_active: false });
    expect(result).toEqual(payload);
  });

  it('encodes player name in URL', async () => {
    mockOk({ player_name: 'Bob Smith', is_active: true });

    await togglePlayerStatus(2, 'Bob Smith', true);

    expect(lastCallUrl()).toBe('/games/2/players/Bob%20Smith/status');
  });
});

describe('addPlayerToGame', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('calls POST /games/{gameId}/players', async () => {
    const payload = { player_name: 'Charlie', is_active: true, seat_number: 3 };
    mockOk(payload);

    const result = await addPlayerToGame(5, 'Charlie');

    expect(fetch).toHaveBeenCalledOnce();
    expect(lastCallUrl()).toBe('/games/5/players');
    expect(lastCallOptions().method).toBe('POST');
    expect(JSON.parse(lastCallOptions().body as string)).toEqual({ player_name: 'Charlie' });
    expect(result).toEqual(payload);
  });
});

describe('startHand', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('calls POST /games/{gameId}/hands/start', async () => {
    const payload = { hand_id: 10, game_id: 3, hand_number: 1 };
    mockOk(payload);

    const result = await startHand(3);

    expect(fetch).toHaveBeenCalledOnce();
    expect(lastCallUrl()).toBe('/games/3/hands/start');
    expect(lastCallOptions().method).toBe('POST');
    expect(result).toEqual(payload);
  });
});

describe('recordPlayerAction', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('calls POST /games/{gameId}/hands/{handNumber}/players/{playerName}/actions', async () => {
    const payload = { action_id: 1, player_hand_id: 5, street: 'preflop', action: 'raise', amount: 50, created_at: '2026-04-12T00:00:00' };
    mockOk(payload);

    const data = { street: 'preflop' as const, action: 'raise' as const, amount: 50 };
    const result = await recordPlayerAction(1, 2, 'Alice', data);

    expect(fetch).toHaveBeenCalledOnce();
    expect(lastCallUrl()).toBe('/games/1/hands/2/players/Alice/actions');
    expect(lastCallOptions().method).toBe('POST');
    expect(JSON.parse(lastCallOptions().body as string)).toEqual(data);
    expect(result).toEqual(payload);
  });

  it('encodes player name in URL', async () => {
    mockOk({ action_id: 2 });

    await recordPlayerAction(1, 1, 'Bob Smith', { street: 'flop' as const, action: 'check' as const });

    expect(lastCallUrl()).toBe('/games/1/hands/1/players/Bob%20Smith/actions');
  });
});

describe('fetchBlinds', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('calls GET /games/{gameId}/blinds', async () => {
    const payload = { small_blind: 1, big_blind: 2, blind_timer_minutes: 15, blind_timer_paused: false };
    mockOk(payload);

    const result = await fetchBlinds(4);

    expect(fetch).toHaveBeenCalledOnce();
    expect(lastCallUrl()).toBe('/games/4/blinds');
    expect(result).toEqual(payload);
  });
});

describe('updateBlinds', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('calls PATCH /games/{gameId}/blinds', async () => {
    const payload = { small_blind: 5, big_blind: 10, blind_timer_minutes: 20, blind_timer_paused: false };
    mockOk(payload);

    const data = { small_blind: 5, big_blind: 10 };
    const result = await updateBlinds(4, data);

    expect(fetch).toHaveBeenCalledOnce();
    expect(lastCallUrl()).toBe('/games/4/blinds');
    expect(lastCallOptions().method).toBe('PATCH');
    expect(JSON.parse(lastCallOptions().body as string)).toEqual(data);
    expect(result).toEqual(payload);
  });
});
