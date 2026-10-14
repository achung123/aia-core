"""Live change stream for a game (server-sent events)."""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

from app.services.events import game_events

router = APIRouter(prefix='/games', tags=['events'])

# Shorter than the proxy's idle timeout, so the connection is never cut
# for being quiet.
HEARTBEAT_SECONDS = 15.0


def format_change(token: str) -> str:
    return f'event: change\ndata: {token}\n\n'


async def change_stream(
    game_id: int,
    request: Request | None = None,
    heartbeat_seconds: float = HEARTBEAT_SECONDS,
) -> AsyncIterator[str]:
    """Yield the current token, then a new one each time the game changes."""
    queue = game_events.subscribe(game_id)
    try:
        # Ask the browser to reconnect quickly, and say where things stand
        # now so a reconnecting screen can tell whether it missed anything.
        yield 'retry: 2000\n\n'
        yield format_change(game_events.token(game_id))
        while True:
            try:
                token = await asyncio.wait_for(queue.get(), timeout=heartbeat_seconds)
                yield format_change(token)
            except asyncio.TimeoutError:
                yield ': keep-alive\n\n'
            if request is not None and await request.is_disconnected():
                break
    finally:
        game_events.unsubscribe(game_id, queue)


@router.get('/{game_id}/events')
async def game_event_stream(game_id: int, request: Request) -> StreamingResponse:
    return StreamingResponse(
        change_stream(game_id, request),
        media_type='text/event-stream',
        headers={
            'Cache-Control': 'no-cache, no-transform',
            # Tell nginx not to buffer the stream
            'X-Accel-Buffering': 'no',
        },
    )


@router.get('/{game_id}/version')
def game_version(game_id: int) -> dict[str, str]:
    """The game's current change token, for clients that cannot stream."""
    return {'token': game_events.token(game_id)}
