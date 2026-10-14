// Live change notifications for a game.
//
// The server streams a token that changes whenever anything about a game is
// written (`GET /games/{id}/events`, server-sent events). Screens subscribe
// here and re-fetch when it moves, so a bet placed on one phone shows up on
// every other screen at once instead of on their next poll.
//
// One connection per game is shared by everything on the page. Browsers
// allow only about six connections to a host over HTTP/1.1, so a stream per
// component would starve the ordinary requests.
//
// This is a nudge, not a data channel: listeners are told "something
// changed" and fetch through the normal API. Polling stays in place
// underneath, so a dropped stream degrades to the old behaviour.

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

/** Several writes in quick succession (saving a hand) become one refresh. */
export const CHANGE_COALESCE_MS = 100;

type Listener = () => void;

export type ConnectionState = 'connecting' | 'open' | 'reconnecting';

interface Channel {
  source: EventSource;
  listeners: Set<Listener>;
  lastToken: string | null;
  timer: ReturnType<typeof setTimeout> | null;
  state: ConnectionState;
  stateListeners: Set<(state: ConnectionState) => void>;
}

function setState(channel: Channel, state: ConnectionState): void {
  if (channel.state === state) return;
  channel.state = state;
  for (const listener of [...channel.stateListeners]) {
    try {
      listener(state);
    } catch {
      // A listener failing must not affect the connection
    }
  }
}

const channels = new Map<number, Channel>();
let wakeListenersInstalled = false;

function notify(channel: Channel): void {
  if (channel.timer !== null) return;
  channel.timer = setTimeout(() => {
    channel.timer = null;
    for (const listener of [...channel.listeners]) {
      try {
        listener();
      } catch {
        // One screen's refresh failing must not stop the others
      }
    }
  }, CHANGE_COALESCE_MS);
}

function notifyAll(): void {
  for (const channel of channels.values()) notify(channel);
}

/**
 * A phone that was asleep, or a laptop that changed Wi-Fi, may have missed
 * changes while its stream was down. Refresh as soon as it is back rather
 * than waiting for the stream to reconnect.
 */
function installWakeListeners(): void {
  if (wakeListenersInstalled || typeof window === 'undefined') return;
  wakeListenersInstalled = true;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') notifyAll();
  });
  window.addEventListener('online', notifyAll);
}

function openChannel(gameId: number): Channel {
  const source = new EventSource(`${BASE_URL}/games/${gameId}/events`);
  const channel: Channel = {
    source,
    listeners: new Set(),
    lastToken: null,
    timer: null,
    state: 'connecting',
    stateListeners: new Set(),
  };
  source.addEventListener('open', () => setState(channel, 'open'));
  source.addEventListener('change', (event) => {
    const token = (event as MessageEvent<string>).data;
    const previous = channel.lastToken;
    channel.lastToken = token;
    // The first token only says where things stand; callers have already
    // fetched. After that — including the first token after a reconnect —
    // a different token means something was missed.
    if (previous !== null && previous !== token) notify(channel);
  });
  // EventSource reconnects by itself; this only records that it is trying.
  source.addEventListener('error', () => setState(channel, 'reconnecting'));
  return channel;
}

/**
 * Call `listener` whenever the game changes. Returns an unsubscribe
 * function. A no-op where the browser has no EventSource.
 */
export function subscribeToGame(gameId: number, listener: Listener): () => void {
  if (typeof EventSource === 'undefined') return () => {};
  installWakeListeners();

  let channel = channels.get(gameId);
  if (!channel) {
    channel = openChannel(gameId);
    channels.set(gameId, channel);
  }
  channel.listeners.add(listener);
  const subscribed = channel;

  return () => {
    subscribed.listeners.delete(listener);
    if (subscribed.listeners.size > 0) return;
    if (subscribed.timer !== null) clearTimeout(subscribed.timer);
    subscribed.source.close();
    if (channels.get(gameId) === subscribed) channels.delete(gameId);
  };
}

/**
 * Follow the connection's state for a game (the stream it is subscribed to).
 * The callback receives the current state immediately. Opening the watcher
 * keeps the stream open for as long as it is held.
 */
export function watchConnection(
  gameId: number,
  onState: (state: ConnectionState) => void,
): () => void {
  if (typeof EventSource === 'undefined') {
    onState('connecting');
    return () => {};
  }
  const stopListening = subscribeToGame(gameId, () => {});
  const channel = channels.get(gameId);
  if (!channel) return stopListening;
  channel.stateListeners.add(onState);
  onState(channel.state);
  return () => {
    channel.stateListeners.delete(onState);
    stopListening();
  };
}

/** Test hook: close every stream and forget all subscriptions. */
export function resetGameEventsForTest(): void {
  for (const channel of channels.values()) {
    if (channel.timer !== null) clearTimeout(channel.timer);
    channel.source.close();
  }
  channels.clear();
}
