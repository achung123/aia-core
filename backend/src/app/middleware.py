import json
import logging
import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger('app.middleware')


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
