"""Tests for T-022: Record Hand Result endpoint (PATCH /games/{game_id}/hands/{hand_number}/results)."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import StaticPool, create_engine
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
def game_with_hand(client):
    """Create a game with Alice and Bob, record one hand, return (game_id, hand_number)."""
    game_resp = client.post(
        '/games',
        json={'game_date': '2026-03-11', 'player_names': ['Alice', 'Bob']},
    )
    assert game_resp.status_code == 201
    game_id = game_resp.json()['game_id']

    hand_resp = client.post(
        f'/games/{game_id}/hands',
        json={
            'flop_1': {'rank': 'A', 'suit': 'S'},
            'flop_2': {'rank': 'K', 'suit': 'H'},
            'flop_3': {'rank': '2', 'suit': 'D'},
            'player_entries': [
                {
                    'player_name': 'Alice',
                    'card_1': {'rank': '7', 'suit': 'S'},
                    'card_2': {'rank': '8', 'suit': 'S'},
                },
                {
                    'player_name': 'Bob',
                    'card_1': {'rank': '9', 'suit': 'H'},
                    'card_2': {'rank': '10', 'suit': 'H'},
                },
            ],
        },
    )
    assert hand_resp.status_code == 201
    hand_number = hand_resp.json()['hand_number']
    return game_id, hand_number


class TestRecordHandResultBasic:
    """AC-1: Updates result and profit_loss for specified players only."""

    def test_patch_results_returns_200(self, client, game_with_hand):
        game_id, hand_number = game_with_hand
        resp = client.patch(
            f'/games/{game_id}/hands/{hand_number}/results',
            json=[{'player_name': 'Alice', 'result': 'won', 'profit_loss': 50.0}],
        )
        assert resp.status_code == 200

    def test_patch_results_updates_specified_player(self, client, game_with_hand):
        game_id, hand_number = game_with_hand
        resp = client.patch(
            f'/games/{game_id}/hands/{hand_number}/results',
            json=[{'player_name': 'Alice', 'result': 'won', 'profit_loss': 50.0}],
        )
        assert resp.status_code == 200
        body = resp.json()
        alice_ph = next(
            ph for ph in body['player_hands'] if ph['player_name'] == 'Alice'
        )
        assert alice_ph['result'] == 'won'
        assert alice_ph['profit_loss'] == 50.0

    def test_patch_results_leaves_unspecified_player_untouched(
        self, client, game_with_hand
    ):
        """AC-2: Unspecified players keep their original result/profit_loss (None)."""
        game_id, hand_number = game_with_hand
        resp = client.patch(
            f'/games/{game_id}/hands/{hand_number}/results',
            json=[{'player_name': 'Alice', 'result': 'won', 'profit_loss': 50.0}],
        )
        assert resp.status_code == 200
        body = resp.json()
        bob_ph = next(ph for ph in body['player_hands'] if ph['player_name'] == 'Bob')
        assert bob_ph['result'] is None
        assert bob_ph['profit_loss'] is None

    def test_patch_results_updates_multiple_players(self, client, game_with_hand):
        game_id, hand_number = game_with_hand
        resp = client.patch(
            f'/games/{game_id}/hands/{hand_number}/results',
            json=[
                {'player_name': 'Alice', 'result': 'won', 'profit_loss': 50.0},
                {'player_name': 'Bob', 'result': 'lost', 'profit_loss': -50.0},
            ],
        )
        assert resp.status_code == 200
        body = resp.json()
        alice_ph = next(
            ph for ph in body['player_hands'] if ph['player_name'] == 'Alice'
        )
        bob_ph = next(ph for ph in body['player_hands'] if ph['player_name'] == 'Bob')
        assert alice_ph['result'] == 'won'
        assert alice_ph['profit_loss'] == 50.0
        assert bob_ph['result'] == 'lost'
        assert bob_ph['profit_loss'] == -50.0

    def test_patch_results_returns_full_hand_response(self, client, game_with_hand):
        game_id, hand_number = game_with_hand
        resp = client.patch(
            f'/games/{game_id}/hands/{hand_number}/results',
            json=[{'player_name': 'Alice', 'result': 'won', 'profit_loss': 10.0}],
        )
        body = resp.json()
        assert 'hand_id' in body
        assert 'game_id' in body
        assert 'hand_number' in body
        assert 'player_hands' in body


class TestRecordHandResult404:
    """AC-3: Returns 404 for nonexistent game, hand, or player."""

    def test_patch_nonexistent_game_returns_404(self, client, game_with_hand):
        _, hand_number = game_with_hand
        resp = client.patch(
            f'/games/9999/hands/{hand_number}/results',
            json=[{'player_name': 'Alice', 'result': 'won', 'profit_loss': 50.0}],
        )
        assert resp.status_code == 404

    def test_patch_nonexistent_hand_returns_404(self, client, game_with_hand):
        game_id, _ = game_with_hand
        resp = client.patch(
            f'/games/{game_id}/hands/9999/results',
            json=[{'player_name': 'Alice', 'result': 'won', 'profit_loss': 50.0}],
        )
        assert resp.status_code == 404

    def test_patch_nonexistent_player_returns_404(self, client, game_with_hand):
        game_id, hand_number = game_with_hand
        resp = client.patch(
            f'/games/{game_id}/hands/{hand_number}/results',
            json=[{'player_name': 'Charlie', 'result': 'won', 'profit_loss': 50.0}],
        )
        assert resp.status_code == 404
