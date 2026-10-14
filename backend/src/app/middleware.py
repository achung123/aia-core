import json
import logging
import re
import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.services.events import game_events

logger = logging.getLogger('app.middleware')

_GAME_PATH = re.compile(r'^/games/(\d+)(?:/|$)')
_READ_ONLY_METHODS = {'GET', 'HEAD', 'OPTIONS'}


class GameChangeNotifier:
    """Announce a game change after every successful write to it.

    Hooking this in one place means no endpoint can forget to notify: any
    non-read request under `/games/{id}` that succeeds wakes every screen
    watching that game. Written as a plain ASGI middleware so it does not sit
    in the path of the long-lived event stream's body.
    """

    def __init__(self, app) -> None:
        self.app = app

    async def __call__(self, scope, receive, send) -> None:
        if scope['type'] != 'http' or scope['method'] in _READ_ONLY_METHODS:
            await self.app(scope, receive, send)
            return
        match = _GAME_PATH.match(scope['path'])
        if match is None:
            await self.app(scope, receive, send)
            return

        status = 500

        async def capture_status(message) -> None:
            nonlocal status
            if message['type'] == 'http.response.start':
                status = message['status']
            await send(message)

        await self.app(scope, receive, capture_status)
        if status < 400:
            game_events.publish(int(match.group(1)))


class RequestIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = str(uuid.uuid4())
        start_time = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            elapsed_ms = (time.perf_counter() - start_time) * 1000
            log_data = json.dumps(
                {
                    'request_id': request_id,
                    'method': request.method,
                    'path': request.url.path,
                    'status_code': 500,
                    'duration_ms': round(elapsed_ms, 2),
                }
            )
            logger.error(log_data, exc_info=True)
            response = Response(content='Internal Server Error', status_code=500)
            response.headers['X-Request-Id'] = request_id
            response.headers['X-Response-Time-Ms'] = f'{elapsed_ms:.2f}'
            return response
        elapsed_ms = (time.perf_counter() - start_time) * 1000
        response.headers['X-Request-Id'] = request_id
        response.headers['X-Response-Time-Ms'] = f'{elapsed_ms:.2f}'

        log_data = json.dumps(
            {
                'request_id': request_id,
                'method': request.method,
                'path': request.url.path,
                'status_code': response.status_code,
                'duration_ms': round(elapsed_ms, 2),
            }
        )

        status = response.status_code
        if status >= 500:
            logger.error(log_data)
        elif status >= 400:
            logger.warning(log_data)
        else:
            logger.info(log_data)

        return response
