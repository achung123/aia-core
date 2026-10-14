"""Change notifications — tell every open screen the moment a game changes.

Each game has a version that goes up whenever anything about it is written.
Screens hold one long-lived connection per game (`GET /games/{id}/events`)
and re-fetch when the version moves, instead of waiting for their next poll.

The hub lives in memory, which is correct for the single-process server this
app runs as. A multi-worker deployment would need a shared broker; polling
remains in place as the fallback either way.
"""

from __future__ import annotations

import asyncio
import threading
import uuid


class GameEventHub:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._versions: dict[int, int] = {}
        self._subscribers: dict[
            int, set[tuple[asyncio.AbstractEventLoop, asyncio.Queue[str]]]
        ] = {}
        # Changes on every restart, so a screen that reconnects to a
        # restarted server sees a different token and refreshes.
        self._boot_id = uuid.uuid4().hex[:8]

    def token(self, game_id: int) -> str:
        """Opaque marker for the game's current state; compare for equality."""
        with self._lock:
            return f'{self._boot_id}-{self._versions.get(game_id, 0)}'

    def publish(self, game_id: int) -> str:
        """Record that the game changed and wake everyone watching it.

        Safe to call from any thread (request handlers run in a thread pool).
        """
        with self._lock:
            version = self._versions.get(game_id, 0) + 1
            self._versions[game_id] = version
            token = f'{self._boot_id}-{version}'
            subscribers = list(self._subscribers.get(game_id, ()))
        for loop, queue in subscribers:
            try:
                loop.call_soon_threadsafe(_offer_latest, queue, token)
            except RuntimeError:
                # The subscriber's event loop has closed; it will be dropped
                # when its stream ends.
                pass
        return token

    def subscribe(self, game_id: int) -> asyncio.Queue[str]:
        """Register the calling coroutine's interest. Must run in its loop."""
        queue: asyncio.Queue[str] = asyncio.Queue(maxsize=1)
        entry = (asyncio.get_running_loop(), queue)
        with self._lock:
            self._subscribers.setdefault(game_id, set()).add(entry)
        return queue

    def unsubscribe(self, game_id: int, queue: asyncio.Queue[str]) -> None:
        with self._lock:
            subscribers = self._subscribers.get(game_id)
            if not subscribers:
                return
            for entry in list(subscribers):
                if entry[1] is queue:
                    subscribers.discard(entry)
            if not subscribers:
                del self._subscribers[game_id]

    def subscriber_count(self, game_id: int) -> int:
        with self._lock:
            return len(self._subscribers.get(game_id, ()))


def _offer_latest(queue: asyncio.Queue[str], token: str) -> None:
    """Keep only the newest token: a slow reader needs the latest, not all."""
    while not queue.empty():
        try:
            queue.get_nowait()
        except asyncio.QueueEmpty:
            break
    queue.put_nowait(token)


game_events = GameEventHub()
