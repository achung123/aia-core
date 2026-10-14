/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { CHANGE_COALESCE_MS, resetGameEventsForTest, subscribeToGame } from '../../src/api/gameEvents.ts';

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  url: string;
  closed = false;
  private handlers = new Map<string, ((event: MessageEvent<string>) => void)[]>();

  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, handler: (event: MessageEvent<string>) => void) {
    this.handlers.set(type, [...(this.handlers.get(type) ?? []), handler]);
  }

  close() {
    this.closed = true;
  }

  /** Simulate the server sending a change token. */
  send(token: string) {
    for (const handler of this.handlers.get('change') ?? []) {
      handler({ data: token } as MessageEvent<string>);
    }
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  FakeEventSource.instances = [];
  vi.stubGlobal('EventSource', FakeEventSource);
});

afterEach(() => {
  resetGameEventsForTest();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function flush() {
  vi.advanceTimersByTime(CHANGE_COALESCE_MS + 1);
}

describe('subscribeToGame', () => {
  it('opens one stream for the game', () => {
    subscribeToGame(7, vi.fn());
    expect(FakeEventSource.instances).toHaveLength(1);
    expect(FakeEventSource.instances[0].url).toMatch(/\/games\/7\/events$/);
  });

  it('shares a single stream between every listener on the same game', () => {
    subscribeToGame(7, vi.fn());
    subscribeToGame(7, vi.fn());
    subscribeToGame(7, vi.fn());
    expect(FakeEventSource.instances).toHaveLength(1);
  });

  it('does not call the listener for the first token, which only says where things stand', () => {
    const listener = vi.fn();
    subscribeToGame(7, listener);
    FakeEventSource.instances[0].send('boot-0');
    flush();
    expect(listener).not.toHaveBeenCalled();
  });

  it('calls every listener when the token changes', () => {
    const one = vi.fn();
    const two = vi.fn();
    subscribeToGame(7, one);
    subscribeToGame(7, two);
    const stream = FakeEventSource.instances[0];
    stream.send('boot-0');
    stream.send('boot-1');
    flush();
    expect(one).toHaveBeenCalledTimes(1);
    expect(two).toHaveBeenCalledTimes(1);
  });

  it('turns a burst of changes into a single refresh', () => {
    const listener = vi.fn();
    subscribeToGame(7, listener);
    const stream = FakeEventSource.instances[0];
    stream.send('boot-0');
    stream.send('boot-1');
    stream.send('boot-2');
    stream.send('boot-3');
    flush();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('ignores a repeat of the same token (a reconnect with nothing missed)', () => {
    const listener = vi.fn();
    subscribeToGame(7, listener);
    const stream = FakeEventSource.instances[0];
    stream.send('boot-4');
    stream.send('boot-4');
    flush();
    expect(listener).not.toHaveBeenCalled();
  });

  it('refreshes after a reconnect to a restarted server', () => {
    const listener = vi.fn();
    subscribeToGame(7, listener);
    const stream = FakeEventSource.instances[0];
    stream.send('boot-4');
    stream.send('otherboot-0');
    flush();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('keeps the stream open until the last listener leaves, then closes it', () => {
    const stopOne = subscribeToGame(7, vi.fn());
    const stopTwo = subscribeToGame(7, vi.fn());
    const stream = FakeEventSource.instances[0];
    stopOne();
    expect(stream.closed).toBe(false);
    stopTwo();
    expect(stream.closed).toBe(true);
    // A later subscription opens a fresh stream
    subscribeToGame(7, vi.fn());
    expect(FakeEventSource.instances).toHaveLength(2);
  });

  it('keeps games separate', () => {
    const seven = vi.fn();
    const eight = vi.fn();
    subscribeToGame(7, seven);
    subscribeToGame(8, eight);
    const [streamSeven] = FakeEventSource.instances;
    streamSeven.send('boot-0');
    streamSeven.send('boot-1');
    flush();
    expect(seven).toHaveBeenCalledTimes(1);
    expect(eight).not.toHaveBeenCalled();
  });

  it('one listener throwing does not stop the others', () => {
    const broken = vi.fn(() => {
      throw new Error('boom');
    });
    const healthy = vi.fn();
    subscribeToGame(7, broken);
    subscribeToGame(7, healthy);
    const stream = FakeEventSource.instances[0];
    stream.send('boot-0');
    stream.send('boot-1');
    flush();
    expect(healthy).toHaveBeenCalledTimes(1);
  });

  it('refreshes when the tab becomes visible again', () => {
    const listener = vi.fn();
    subscribeToGame(7, listener);
    document.dispatchEvent(new Event('visibilitychange'));
    flush();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('is a no-op where EventSource does not exist', () => {
    vi.stubGlobal('EventSource', undefined);
    const stop = subscribeToGame(7, vi.fn());
    expect(FakeEventSource.instances).toHaveLength(0);
    expect(() => stop()).not.toThrow();
  });
});
