"""Tests for T-016: Complete Game Session endpoint (PATCH /games/{game_id}/complete)."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, StaticPool
from sqlalchemy.orm import sessionmaker

from app.database.database_models import Base as LegacyBase
from app.database.models import Base as ModelsBase
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
    LegacyBase.metadata.create_all(bind=engine)
    ModelsBase.metadata.create_all(bind=engine)
    yield
    ModelsBase.metadata.drop_all(bind=engine)
    LegacyBase.metadata.drop_all(bind=engine)


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


class TestCompleteGameSession:
    """PATCH /games/{game_id}/complete — mark a game session as completed."""

    def test_complete_game_returns_200(self, client, created_game):
        game_id = created_game['game_id']
        response = client.patch(f'/games/{game_id}/complete')
        assert response.status_code == 200

    def test_complete_game_sets_status_to_completed(self, client, created_game):
        game_id = created_game['game_id']
        response = client.patch(f'/games/{game_id}/complete')
        assert response.json()['status'] == 'completed'

    def test_complete_game_returns_correct_game_id(self, client, created_game):
        game_id = created_game['game_id']
        response = client.patch(f'/games/{game_id}/complete')
        assert response.json()['game_id'] == game_id

    def test_complete_game_returns_game_date(self, client, created_game):
        game_id = created_game['game_id']
        response = client.patch(f'/games/{game_id}/complete')
        assert response.json()['game_date'] == '2026-03-11'

    def test_complete_game_returns_player_names(self, client, created_game):
        game_id = created_game['game_id']
        response = client.patch(f'/games/{game_id}/complete')
        assert set(response.json()['player_names']) == {'Adam', 'Gil'}

    def test_complete_game_returns_hand_count(self, client, created_game):
        game_id = created_game['game_id']
        response = client.patch(f'/games/{game_id}/complete')
        assert response.json()['hand_count'] == 0

    def test_complete_game_returns_created_at(self, client, created_game):
        game_id = created_game['game_id']
        response = client.patch(f'/games/{game_id}/complete')
        assert 'created_at' in response.json()

    def test_complete_game_persists_status(self, client, created_game):
        """GET after PATCH should reflect completed status."""
        game_id = created_game['game_id']
        client.patch(f'/games/{game_id}/complete')
        get_resp = client.get(f'/games/{game_id}')
        assert get_resp.json()['status'] == 'completed'

    def test_complete_game_404_for_nonexistent_id(self, client):
        response = client.patch('/games/99999/complete')
        assert response.status_code == 404

    def test_complete_game_404_detail_message(self, client):
        response = client.patch('/games/99999/complete')
        assert 'detail' in response.json()

    def test_complete_game_400_if_already_completed(self, client, created_game):
        game_id = created_game['game_id']
        # Complete once (should succeed)
        client.patch(f'/games/{game_id}/complete')
        # Complete again (should fail)
        response = client.patch(f'/games/{game_id}/complete')
        assert response.status_code == 400

    def test_complete_game_400_detail_message_if_already_completed(self, client, created_game):
        game_id = created_game['game_id']
        client.patch(f'/games/{game_id}/complete')
        response = client.patch(f'/games/{game_id}/complete')
        assert 'detail' in response.json()
