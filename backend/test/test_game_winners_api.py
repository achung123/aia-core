"""Tests for game winners support and reactivation endpoint."""

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
    resp = client.post(
        '/games',
        json={'game_date': '2026-03-11', 'player_names': ['Alice', 'Bob', 'Carol']},
    )
    assert resp.status_code == 201
    return resp.json()


class TestCompleteGameWithWinners:
    """PATCH /games/{game_id}/complete with winners payload."""

    def test_complete_with_one_winner(self, client, created_game):
        game_id = created_game['game_id']
        resp = client.patch(
            f'/games/{game_id}/complete',
            json={'winners': ['Alice']},
        )
        assert resp.status_code == 200
        assert resp.json()['winners'] == ['Alice']

    def test_complete_with_two_winners(self, client, created_game):
        game_id = created_game['game_id']
        resp = client.patch(
            f'/games/{game_id}/complete',
            json={'winners': ['Alice', 'Bob']},
        )
        assert resp.status_code == 200
        assert sorted(resp.json()['winners']) == ['Alice', 'Bob']

    def test_complete_without_winners_body_defaults_to_empty(
        self, client, created_game
    ):
        """Backwards compat: no body still works, winners defaults to empty."""
        game_id = created_game['game_id']
        resp = client.patch(f'/games/{game_id}/complete')
        assert resp.status_code == 200
        assert resp.json()['winners'] == []

    def test_complete_persists_winners_in_get(self, client, created_game):
        game_id = created_game['game_id']
        client.patch(
            f'/games/{game_id}/complete',
            json={'winners': ['Bob']},
        )
        get_resp = client.get(f'/games/{game_id}')
        assert get_resp.json()['winners'] == ['Bob']

    def test_complete_persists_winners_in_list(self, client, created_game):
        game_id = created_game['game_id']
        client.patch(
            f'/games/{game_id}/complete',
            json={'winners': ['Alice', 'Carol']},
        )
        list_resp = client.get('/games')
        game = next(g for g in list_resp.json() if g['game_id'] == game_id)
        assert sorted(game['winners']) == ['Alice', 'Carol']

    def test_active_game_has_empty_winners_in_list(self, client, created_game):
        game_id = created_game['game_id']
        list_resp = client.get('/games')
        game = next(g for g in list_resp.json() if g['game_id'] == game_id)
        assert game['winners'] == []

    def test_complete_rejects_more_than_two_winners(self, client, created_game):
        game_id = created_game['game_id']
        resp = client.patch(
            f'/games/{game_id}/complete',
            json={'winners': ['Alice', 'Bob', 'Carol']},
        )
        assert resp.status_code == 422


class TestReactivateGame:
    """PATCH /games/{game_id}/reactivate — set game back to active."""

    def test_reactivate_returns_200(self, client, created_game):
        game_id = created_game['game_id']
        client.patch(f'/games/{game_id}/complete', json={'winners': ['Alice']})
        resp = client.patch(f'/games/{game_id}/reactivate')
        assert resp.status_code == 200

    def test_reactivate_sets_status_to_active(self, client, created_game):
        game_id = created_game['game_id']
        client.patch(f'/games/{game_id}/complete', json={'winners': ['Alice']})
        resp = client.patch(f'/games/{game_id}/reactivate')
        assert resp.json()['status'] == 'active'

    def test_reactivate_clears_winners(self, client, created_game):
        game_id = created_game['game_id']
        client.patch(f'/games/{game_id}/complete', json={'winners': ['Alice']})
        resp = client.patch(f'/games/{game_id}/reactivate')
        assert resp.json()['winners'] == []

    def test_reactivate_404_for_nonexistent(self, client):
        resp = client.patch('/games/99999/reactivate')
        assert resp.status_code == 404

    def test_reactivate_400_if_already_active(self, client, created_game):
        game_id = created_game['game_id']
        resp = client.patch(f'/games/{game_id}/reactivate')
        assert resp.status_code == 400

    def test_reactivate_allows_re_completion(self, client, created_game):
        """After reactivation, game can be completed again with different winners."""
        game_id = created_game['game_id']
        client.patch(f'/games/{game_id}/complete', json={'winners': ['Alice']})
        client.patch(f'/games/{game_id}/reactivate')
        resp = client.patch(
            f'/games/{game_id}/complete',
            json={'winners': ['Bob', 'Carol']},
        )
        assert resp.status_code == 200
        assert sorted(resp.json()['winners']) == ['Bob', 'Carol']
