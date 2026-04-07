import importlib

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_cors_preflight_default_origin():
    response = client.options(
        '/',
        headers={
            'Origin': 'http://localhost:5173',
            'Access-Control-Request-Method': 'GET',
        },
    )
    assert (
        response.headers.get('access-control-allow-origin') == 'http://localhost:5173'
    )
    assert response.headers.get('access-control-allow-credentials') == 'true'


def test_cors_preflight_disallowed_origin():
    response = client.options(
        '/',
        headers={
            'Origin': 'http://evil.example.com',
            'Access-Control-Request-Method': 'GET',
        },
    )
    assert response.headers.get('access-control-allow-origin') is None


def test_cors_multi_origin_parsing(monkeypatch):
    import app.main as main_module

    monkeypatch.setenv('ALLOWED_ORIGINS', 'http://localhost:5173,http://localhost:3000')
    try:
        importlib.reload(main_module)
        assert main_module._allowed_origins == [
            'http://localhost:5173',
            'http://localhost:3000',
        ]
    finally:
        monkeypatch.delenv('ALLOWED_ORIGINS', raising=False)
        importlib.reload(main_module)


def test_cors_wildcard_origin_raises(monkeypatch):
    import app.main as main_module

    monkeypatch.setenv('ALLOWED_ORIGINS', '*')
    try:
        with pytest.raises(ValueError, match='ALLOWED_ORIGINS must not contain'):
            importlib.reload(main_module)
    finally:
        monkeypatch.delenv('ALLOWED_ORIGINS', raising=False)
        importlib.reload(main_module)
