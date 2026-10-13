"""Tests for T-014: Get Game Session endpoint (GET /games/{game_id})."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, StaticPool
from sqlalchemy.orm import sessionmaker

from app.database.models import Base
from app.database.session import get_db
from app.main import app

DATABASE_URL = 'sqlite:///:memory:'
engine = create_engine(
    DATABASE_URL, connect_args={'check_same_thread': False}, poolclass=StaticPool
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def created_game(client):
    """Create a game session and return its response JSON."""
    resp = client.post(
        '/games',
        json={'game_date': '2026-03-11', 'player_names': ['Adam', 'Gil']},
    )
    assert resp.status_code == 201
    return resp.json()


class TestGetGameSession:
    """GET /games/{game_id} — retrieve a single game session."""

    def test_get_game_returns_200(self, client, created_game):
        game_id = created_game['game_id']
        response = client.get(f'/games/{game_id}')
        assert response.status_code == 200

    def test_get_game_returns_correct_game_id(self, client, created_game):
        game_id = created_game['game_id']
        response = client.get(f'/games/{game_id}')
        assert response.json()['game_id'] == game_id

    def test_get_game_returns_correct_date(self, client, created_game):
        game_id = created_game['game_id']
        response = client.get(f'/games/{game_id}')
        assert response.json()['game_date'] == '2026-03-11'

    def test_get_game_returns_status(self, client, created_game):
        game_id = created_game['game_id']
        response = client.get(f'/games/{game_id}')
        assert response.json()['status'] == 'active'

    def test_get_game_returns_player_names(self, client, created_game):
        game_id = created_game['game_id']
        response = client.get(f'/games/{game_id}')
        assert set(response.json()['player_names']) == {'Adam', 'Gil'}

    def test_get_game_returns_hand_count(self, client, created_game):
        game_id = created_game['game_id']
        response = client.get(f'/games/{game_id}')
        assert response.json()['hand_count'] == 0

    def test_get_game_returns_created_at(self, client, created_game):
        game_id = created_game['game_id']
        response = client.get(f'/games/{game_id}')
        assert 'created_at' in response.json()

    def test_get_game_404_for_nonexistent_id(self, client):
        response = client.get('/games/99999')
        assert response.status_code == 404

    def test_get_game_404_detail_message(self, client):
        response = client.get('/games/99999')
        assert 'detail' in response.json()
