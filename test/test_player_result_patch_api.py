"""Tests for T-004: Single-player result PATCH endpoint.

PATCH /games/{game_id}/hands/{hand_number}/players/{player_name}/result
Accepts { "result": "won"|"folded"|"lost", "profit_loss": float|null }
Returns updated PlayerHandResponse.
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
    """Create a game with Alice and Bob, record one hand, return (game_id, hand_number)."""
    game_resp = client.post(
        '/games',
        json={'game_date': '2026-04-09', 'player_names': ['Alice', 'Bob']},
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


def _url(game_id, hand_number, player_name):
    return f'/games/{game_id}/hands/{hand_number}/players/{player_name}/result'


class TestPlayerResultPatchSuccess:
    """AC-1: Endpoint exists and returns 200 with updated player hand."""

    def test_patch_result_returns_200(self, client, game_with_hand):
        game_id, hand_number = game_with_hand
        resp = client.patch(
            _url(game_id, hand_number, 'Alice'),
            json={'result': 'won', 'profit_loss': 50.0},
        )
        assert resp.status_code == 200

    def test_patch_result_returns_player_hand_response(self, client, game_with_hand):
        game_id, hand_number = game_with_hand
        resp = client.patch(
            _url(game_id, hand_number, 'Alice'),
            json={'result': 'won', 'profit_loss': 50.0},
        )
        body = resp.json()
        assert body['player_name'] == 'Alice'
        assert body['result'] == 'won'
        assert body['profit_loss'] == 50.0
        assert 'player_hand_id' in body
        assert 'hand_id' in body
        assert 'player_id' in body
        assert 'card_1' in body
        assert 'card_2' in body

    def test_patch_folded_result(self, client, game_with_hand):
        game_id, hand_number = game_with_hand
        resp = client.patch(
            _url(game_id, hand_number, 'Bob'),
            json={'result': 'folded', 'profit_loss': -10.0},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body['result'] == 'folded'
        assert body['profit_loss'] == -10.0

    def test_patch_lost_result(self, client, game_with_hand):
        game_id, hand_number = game_with_hand
        resp = client.patch(
            _url(game_id, hand_number, 'Alice'),
            json={'result': 'lost', 'profit_loss': -25.0},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body['result'] == 'lost'
        assert body['profit_loss'] == -25.0

    def test_patch_result_with_null_profit_loss(self, client, game_with_hand):
        game_id, hand_number = game_with_hand
        resp = client.patch(
            _url(game_id, hand_number, 'Alice'),
            json={'result': 'won', 'profit_loss': None},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body['result'] == 'won'
        assert body['profit_loss'] is None

    def test_patch_result_without_profit_loss_defaults_to_none(
        self, client, game_with_hand
    ):
        game_id, hand_number = game_with_hand
        resp = client.patch(
            _url(game_id, hand_number, 'Alice'),
            json={'result': 'won'},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body['result'] == 'won'
        assert body['profit_loss'] is None

    def test_patch_result_case_insensitive_player_name(self, client, game_with_hand):
        game_id, hand_number = game_with_hand
        resp = client.patch(
            _url(game_id, hand_number, 'alice'),
            json={'result': 'won', 'profit_loss': 30.0},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body['player_name'] == 'Alice'
        assert body['result'] == 'won'

    def test_patch_handed_back_result(self, client, game_with_hand):
        game_id, hand_number = game_with_hand
        resp = client.patch(
            _url(game_id, hand_number, 'Alice'),
            json={'result': 'handed_back'},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body['result'] == 'handed_back'


class TestPlayerResultPatchPersistence:
    """AC-2: result and profit_loss are persisted in the database."""

    def test_result_persisted_after_patch(self, client, game_with_hand):
        game_id, hand_number = game_with_hand
        client.patch(
            _url(game_id, hand_number, 'Alice'),
            json={'result': 'won', 'profit_loss': 100.0},
        )
        # Verify via GET
        get_resp = client.get(f'/games/{game_id}/hands/{hand_number}')
        assert get_resp.status_code == 200
        alice_ph = next(
            ph for ph in get_resp.json()['player_hands'] if ph['player_name'] == 'Alice'
        )
        assert alice_ph['result'] == 'won'
        assert alice_ph['profit_loss'] == 100.0

    def test_patch_does_not_affect_other_players(self, client, game_with_hand):
        game_id, hand_number = game_with_hand
        client.patch(
            _url(game_id, hand_number, 'Alice'),
            json={'result': 'won', 'profit_loss': 50.0},
        )
        get_resp = client.get(f'/games/{game_id}/hands/{hand_number}')
        bob_ph = next(
            ph for ph in get_resp.json()['player_hands'] if ph['player_name'] == 'Bob'
        )
        assert bob_ph['result'] is None
        assert bob_ph['profit_loss'] is None


class TestPlayerResultPatch404:
    """AC-3: Returns 404 if player is not in the hand."""

    def test_nonexistent_game_returns_404(self, client, game_with_hand):
        _, hand_number = game_with_hand
        resp = client.patch(
            _url(9999, hand_number, 'Alice'),
            json={'result': 'won', 'profit_loss': 10.0},
        )
        assert resp.status_code == 404
        assert 'Game session not found' in resp.json()['detail']

    def test_nonexistent_hand_returns_404(self, client, game_with_hand):
        game_id, _ = game_with_hand
        resp = client.patch(
            _url(game_id, 9999, 'Alice'),
            json={'result': 'won', 'profit_loss': 10.0},
        )
        assert resp.status_code == 404
        assert 'Hand not found' in resp.json()['detail']

    def test_nonexistent_player_returns_404(self, client, game_with_hand):
        game_id, hand_number = game_with_hand
        resp = client.patch(
            _url(game_id, hand_number, 'Nobody'),
            json={'result': 'won', 'profit_loss': 10.0},
        )
        assert resp.status_code == 404
        assert 'not found' in resp.json()['detail']

    def test_player_exists_but_not_in_hand(self, client, game_with_hand):
        """A player who exists in DB but wasn't added to this hand."""
        game_id, hand_number = game_with_hand
        # Create a new game with a new player
        game2_resp = client.post(
            '/games',
            json={'game_date': '2026-04-09', 'player_names': ['Charlie']},
        )
        assert game2_resp.status_code == 201
        # Charlie exists in DB but is not in the first game's hand
        resp = client.patch(
            _url(game_id, hand_number, 'Charlie'),
            json={'result': 'won', 'profit_loss': 10.0},
        )
        assert resp.status_code == 404
        assert 'not found in this hand' in resp.json()['detail']


class TestPlayerResultPatch422:
    """AC-4: Returns 422 if result is not a valid ResultEnum value."""

    def test_invalid_result_value_returns_422(self, client, game_with_hand):
        game_id, hand_number = game_with_hand
        resp = client.patch(
            _url(game_id, hand_number, 'Alice'),
            json={'result': 'invalid_value', 'profit_loss': 10.0},
        )
        assert resp.status_code == 422

    def test_missing_result_field_returns_422(self, client, game_with_hand):
        game_id, hand_number = game_with_hand
        resp = client.patch(
            _url(game_id, hand_number, 'Alice'),
            json={'profit_loss': 10.0},
        )
        assert resp.status_code == 422

    def test_empty_body_returns_422(self, client, game_with_hand):
        game_id, hand_number = game_with_hand
        resp = client.patch(
            _url(game_id, hand_number, 'Alice'),
            json={},
        )
        assert resp.status_code == 422


class TestPlayerResultPatchOutcomeStreet:
    """outcome_street records when the outcome happened (flop/turn/river)."""

    def test_patch_with_outcome_street_flop(self, client, game_with_hand):
        game_id, hand_number = game_with_hand
        resp = client.patch(
            _url(game_id, hand_number, 'Alice'),
            json={'result': 'folded', 'outcome_street': 'flop'},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body['result'] == 'folded'
        assert body['outcome_street'] == 'flop'

    def test_patch_with_outcome_street_turn(self, client, game_with_hand):
        game_id, hand_number = game_with_hand
        resp = client.patch(
            _url(game_id, hand_number, 'Alice'),
            json={'result': 'lost', 'outcome_street': 'turn'},
        )
        assert resp.status_code == 200
        assert resp.json()['outcome_street'] == 'turn'

    def test_patch_with_outcome_street_river(self, client, game_with_hand):
        game_id, hand_number = game_with_hand
        resp = client.patch(
            _url(game_id, hand_number, 'Alice'),
            json={'result': 'won', 'outcome_street': 'river'},
        )
        assert resp.status_code == 200
        assert resp.json()['outcome_street'] == 'river'

    def test_outcome_street_defaults_to_none(self, client, game_with_hand):
        game_id, hand_number = game_with_hand
        resp = client.patch(
            _url(game_id, hand_number, 'Alice'),
            json={'result': 'won'},
        )
        assert resp.status_code == 200
        assert resp.json()['outcome_street'] is None

    def test_outcome_street_persisted(self, client, game_with_hand):
        game_id, hand_number = game_with_hand
        client.patch(
            _url(game_id, hand_number, 'Alice'),
            json={'result': 'folded', 'outcome_street': 'flop'},
        )
        get_resp = client.get(f'/games/{game_id}/hands/{hand_number}')
        alice_ph = next(
            ph for ph in get_resp.json()['player_hands'] if ph['player_name'] == 'Alice'
        )
        assert alice_ph['outcome_street'] == 'flop'

    def test_preflop_outcome_street_accepted(self, client, game_with_hand):
        game_id, hand_number = game_with_hand
        resp = client.patch(
            _url(game_id, hand_number, 'Alice'),
            json={'result': 'won', 'outcome_street': 'preflop'},
        )
        assert resp.status_code == 200
        assert resp.json()['outcome_street'] == 'preflop'

    def test_invalid_outcome_street_returns_422(self, client, game_with_hand):
        game_id, hand_number = game_with_hand
        resp = client.patch(
            _url(game_id, hand_number, 'Alice'),
            json={'result': 'won', 'outcome_street': 'banana'},
        )
        assert resp.status_code == 422
