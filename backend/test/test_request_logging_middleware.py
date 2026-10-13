import json
from unittest.mock import MagicMock, patch

import pytest
from starlette.responses import JSONResponse

from app.main import app


# Test-only routes that deterministically produce 5xx responses
@app.get('/test-middleware-500')
async def _return_500():
    return JSONResponse(status_code=500, content={'error': 'deliberate'})


@app.get('/test-middleware-raise')
async def _raise_unhandled():
    raise RuntimeError('deliberate boom')


@pytest.fixture()
def mock_mw_logger():
    """Mock the app.middleware logger to capture log calls."""
    with patch('app.middleware.logger') as mock_logger:
        mock_logger.info = MagicMock()
        mock_logger.warning = MagicMock()
        mock_logger.error = MagicMock()
        yield mock_logger


def test_request_logs_at_info_level(client, mock_mw_logger):
    client.get('/')
    assert mock_mw_logger.info.call_count == 1
    assert mock_mw_logger.warning.call_count == 0
    assert mock_mw_logger.error.call_count == 0


def test_log_contains_required_fields(client, mock_mw_logger):
    client.get('/')
    log_data = json.loads(mock_mw_logger.info.call_args[0][0])
    assert 'request_id' in log_data
    assert 'method' in log_data
    assert 'path' in log_data
    assert 'status_code' in log_data
    assert 'duration_ms' in log_data


def test_log_has_correct_method_and_path(client, mock_mw_logger):
    client.get('/')
    log_data = json.loads(mock_mw_logger.info.call_args[0][0])
    assert log_data['method'] == 'GET'
    assert log_data['path'] == '/'


def test_log_request_id_matches_response_header(client, mock_mw_logger):
    response = client.get('/')
    log_data = json.loads(mock_mw_logger.info.call_args[0][0])
    assert log_data['request_id'] == response.headers['x-request-id']


def test_log_status_code_is_integer(client, mock_mw_logger):
    client.get('/')
    log_data = json.loads(mock_mw_logger.info.call_args[0][0])
    assert log_data['status_code'] == 200
    assert isinstance(log_data['status_code'], int)


def test_log_duration_ms_is_positive_float(client, mock_mw_logger):
    client.get('/')
    log_data = json.loads(mock_mw_logger.info.call_args[0][0])
    assert isinstance(log_data['duration_ms'], float)
    assert log_data['duration_ms'] >= 0


def test_4xx_logs_at_warning_level(client, mock_mw_logger):
    client.get('/nonexistent-endpoint-that-does-not-exist')
    assert mock_mw_logger.warning.call_count == 1
    assert mock_mw_logger.info.call_count == 0


def test_5xx_logs_at_error_level(client, mock_mw_logger):
    """5xx responses should log at ERROR level."""
    client.get('/test-middleware-500')
    assert mock_mw_logger.error.call_count == 1
    log_data = json.loads(mock_mw_logger.error.call_args[0][0])
    assert log_data['status_code'] == 500
    assert mock_mw_logger.info.call_count == 0
    assert mock_mw_logger.warning.call_count == 0


def test_unhandled_exception_logs_at_error_level(client, mock_mw_logger):
    """Unhandled exceptions in call_next should be caught, logged at ERROR, and return 500."""
    response = client.get('/test-middleware-raise')
    assert response.status_code == 500
    assert mock_mw_logger.error.call_count == 1
    log_data = json.loads(mock_mw_logger.error.call_args[0][0])
    assert log_data['status_code'] == 500


def test_log_format_is_valid_json(client, mock_mw_logger):
    client.get('/')
    raw = mock_mw_logger.info.call_args[0][0]
    data = json.loads(raw)
    assert isinstance(data, dict)
