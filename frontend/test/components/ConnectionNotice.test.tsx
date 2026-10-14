/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  closed = false;
  private handlers = new Map<string, ((event: unknown) => void)[]>();
  constructor(public url: string) {
    FakeEventSource.instances.push(this);
  }
  addEventListener(type: string, handler: (event: unknown) => void) {
    this.handlers.set(type, [...(this.handlers.get(type) ?? []), handler]);
  }
  close() {
    this.closed = true;
  }
  emit(type: string, data?: string) {
    for (const handler of this.handlers.get(type) ?? []) handler({ data });
  }
}

import { resetGameEventsForTest } from '../../src/api/gameEvents.ts';
import { ConnectionNotice } from '../../src/components/ConnectionNotice.tsx';

beforeEach(() => {
  FakeEventSource.instances = [];
  vi.stubGlobal('EventSource', FakeEventSource);
});

afterEach(() => {
  cleanup();
  resetGameEventsForTest();
  vi.unstubAllGlobals();
});

describe('ConnectionNotice', () => {
  it('stays out of the way while connecting and while connected', () => {
    render(<ConnectionNotice gameId={5} />);
    expect(screen.queryByTestId('connection-notice')).toBeNull();
    act(() => FakeEventSource.instances[0].emit('open'));
    expect(screen.queryByTestId('connection-notice')).toBeNull();
  });

  it('appears when the stream drops and clears when it comes back', () => {
    render(<ConnectionNotice gameId={5} />);
    const stream = FakeEventSource.instances[0];
    act(() => stream.emit('open'));

    act(() => stream.emit('error'));
    expect(screen.getByTestId('connection-notice').textContent).toContain('Reconnecting');

    act(() => stream.emit('open'));
    expect(screen.queryByTestId('connection-notice')).toBeNull();
  });

  it('shows nothing and opens no stream without a game', () => {
    render(<ConnectionNotice gameId={null} />);
    expect(FakeEventSource.instances).toHaveLength(0);
    expect(screen.queryByTestId('connection-notice')).toBeNull();
  });

  it('closes its stream when it goes away', () => {
    const { unmount } = render(<ConnectionNotice gameId={5} />);
    const stream = FakeEventSource.instances[0];
    unmount();
    expect(stream.closed).toBe(true);
  });
});
