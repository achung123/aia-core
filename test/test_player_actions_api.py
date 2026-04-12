"""Tests for T-009: Record player action endpoint.

POST /games/{game_id}/hands/{hand_number}/players/{player_name}/actions
Records a betting action for a player in a hand.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import StaticPool, create_engine
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
def game_with_hand(client):
    """Create a game with Alice and Bob, plus one hand with both players."""
    resp = client.post(
        '/games',
        json={'game_date': '2026-04-12', 'player_names': ['Alice', 'Bob']},
    )
    assert resp.status_code == 201
    game_id = resp.json()['game_id']

    resp = client.post(
        f'/games/{game_id}/hands',
        json={
            'player_entries': [
                {'player_name': 'Alice'},
                {'player_name': 'Bob'},
            ]
        },
    )
    assert resp.status_code == 201
    hand_number = resp.json()['hand_number']
    return game_id, hand_number


def _url(game_id, hand_number, player_name):
    return f'/games/{game_id}/hands/{hand_number}/players/{player_name}/actions'


# ── Happy Path: All action types ────────────────────────────────────────────


class TestRecordAction:
    def test_fold(self, client, game_with_hand):
        game_id, hand_number = game_with_hand
        resp = client.post(
            _url(game_id, hand_number, 'Alice'),
            json={'street': 'preflop', 'action': 'fold', 'amount': None},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data['street'] == 'preflop'
        assert data['action'] == 'fold'
        assert data['amount'] is None
        assert 'action_id' in data
        assert 'created_at' in data

    def test_check(self, client, game_with_hand):
        game_id, hand_number = game_with_hand
        resp = client.post(
            _url(game_id, hand_number, 'Alice'),
            json={'street': 'flop', 'action': 'check'},
        )
        assert resp.status_code == 201
        assert resp.json()['action'] == 'check'
        assert resp.json()['street'] == 'flop'

    def test_call(self, client, game_with_hand):
        game_id, hand_number = game_with_hand
        resp = client.post(
            _url(game_id, hand_number, 'Bob'),
            json={'street': 'turn', 'action': 'call', 'amount': 2.0},
        )
        assert resp.status_code == 201
        assert resp.json()['action'] == 'call'
        assert resp.json()['amount'] == 2.0

    def test_bet(self, client, game_with_hand):
        game_id, hand_number = game_with_hand
        resp = client.post(
            _url(game_id, hand_number, 'Alice'),
            json={'street': 'river', 'action': 'bet', 'amount': 5.50},
        )
        assert resp.status_code == 201
        assert resp.json()['action'] == 'bet'
        assert resp.json()['amount'] == 5.50
        assert resp.json()['street'] == 'river'

    def test_raise(self, client, game_with_hand):
        game_id, hand_number = game_with_hand
        resp = client.post(
            _url(game_id, hand_number, 'Bob'),
            json={'street': 'preflop', 'action': 'raise', 'amount': 10.0},
        )
        assert resp.status_code == 201
        assert resp.json()['action'] == 'raise'
        assert resp.json()['amount'] == 10.0

    def test_amount_defaults_to_none(self, client, game_with_hand):
        game_id, hand_number = game_with_hand
        resp = client.post(
            _url(game_id, hand_number, 'Alice'),
            json={'street': 'preflop', 'action': 'fold'},
        )
        assert resp.status_code == 201
        assert resp.json()['amount'] is None

    def test_response_includes_player_hand_id(self, client, game_with_hand):
        game_id, hand_number = game_with_hand
        resp = client.post(
            _url(game_id, hand_number, 'Alice'),
            json={'street': 'preflop', 'action': 'check'},
        )
        assert resp.status_code == 201
        assert isinstance(resp.json()['player_hand_id'], int)

    def test_multiple_actions_same_player(self, client, game_with_hand):
        """A player can record multiple actions in a hand."""
        game_id, hand_number = game_with_hand
        url = _url(game_id, hand_number, 'Alice')

        resp1 = client.post(
            url, json={'street': 'preflop', 'action': 'call', 'amount': 0.20}
        )
        resp2 = client.post(
            url, json={'street': 'flop', 'action': 'bet', 'amount': 1.0}
        )

        assert resp1.status_code == 201
        assert resp2.status_code == 201
        assert resp1.json()['action_id'] != resp2.json()['action_id']


# ── Validation errors ───────────────────────────────────────────────────────


class TestValidationErrors:
    def test_invalid_street(self, client, game_with_hand):
        game_id, hand_number = game_with_hand
        resp = client.post(
            _url(game_id, hand_number, 'Alice'),
            json={'street': 'showdown', 'action': 'fold'},
        )
        assert resp.status_code == 422

    def test_invalid_action(self, client, game_with_hand):
        game_id, hand_number = game_with_hand
        resp = client.post(
            _url(game_id, hand_number, 'Alice'),
            json={'street': 'preflop', 'action': 'allin'},
        )
        assert resp.status_code == 422

    def test_missing_street(self, client, game_with_hand):
        game_id, hand_number = game_with_hand
        resp = client.post(
            _url(game_id, hand_number, 'Alice'),
            json={'action': 'fold'},
        )
        assert resp.status_code == 422

    def test_missing_action(self, client, game_with_hand):
        game_id, hand_number = game_with_hand
        resp = client.post(
            _url(game_id, hand_number, 'Alice'),
            json={'street': 'preflop'},
        )
        assert resp.status_code == 422

    def test_empty_body(self, client, game_with_hand):
        game_id, hand_number = game_with_hand
        resp = client.post(
            _url(game_id, hand_number, 'Alice'),
            json={},
        )
        assert resp.status_code == 422


# ── 404 cases ───────────────────────────────────────────────────────────────


class TestNotFoundCases:
    def test_game_not_found(self, client):
        resp = client.post(
            _url(9999, 1, 'Alice'),
            json={'street': 'preflop', 'action': 'fold'},
        )
        assert resp.status_code == 404
        assert 'game' in resp.json()['detail'].lower()

    def test_hand_not_found(self, client, game_with_hand):
        game_id, _ = game_with_hand
        resp = client.post(
            _url(game_id, 999, 'Alice'),
            json={'street': 'preflop', 'action': 'fold'},
        )
        assert resp.status_code == 404
        assert 'hand' in resp.json()['detail'].lower()

    def test_player_not_in_hand(self, client):
        """Player exists in game but not in this hand."""
        # Create a game with Alice, Bob, and Charlie
        resp = client.post(
            '/games',
            json={
                'game_date': '2026-04-12',
                'player_names': ['Alice', 'Bob', 'Charlie'],
            },
        )
        assert resp.status_code == 201
        game_id = resp.json()['game_id']

        # Create a hand with only Alice and Bob
        resp = client.post(
            f'/games/{game_id}/hands',
            json={
                'player_entries': [
                    {'player_name': 'Alice'},
                    {'player_name': 'Bob'},
                ]
            },
        )
        assert resp.status_code == 201
        hand_number = resp.json()['hand_number']

        resp = client.post(
            _url(game_id, hand_number, 'Charlie'),
            json={'street': 'preflop', 'action': 'fold'},
        )
        assert resp.status_code == 404
        assert 'player' in resp.json()['detail'].lower()

    def test_player_not_found_at_all(self, client, game_with_hand):
        """Player doesn't exist in the system."""
        game_id, hand_number = game_with_hand
        resp = client.post(
            _url(game_id, hand_number, 'NonExistent'),
            json={'street': 'preflop', 'action': 'fold'},
        )
        assert resp.status_code == 404

    def test_case_insensitive_player_lookup(self, client, game_with_hand):
        """Player lookup should be case-insensitive."""
        game_id, hand_number = game_with_hand
        resp = client.post(
            _url(game_id, hand_number, 'alice'),
            json={'street': 'preflop', 'action': 'fold'},
        )
        assert resp.status_code == 201
