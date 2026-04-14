"""Tests for T-011: Fold action auto-sets PlayerHand.result = 'folded'.

When a fold action is recorded via the action endpoint, the corresponding
PlayerHand row should automatically get result = 'folded'.
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


def _action_url(game_id, hand_number, player_name):
    return f'/games/{game_id}/hands/{hand_number}/players/{player_name}/actions'


def _hand_url(game_id, hand_number):
    return f'/games/{game_id}/hands/{hand_number}'


class TestFoldSetsResult:
    """AC-1: Recording { "action": "fold" } also sets PlayerHand.result = 'folded'."""

    def test_fold_sets_player_hand_result_to_folded(self, client, game_with_hand):
        game_id, hand_number = game_with_hand
        resp = client.post(
            _action_url(game_id, hand_number, 'Alice'),
            json={'street': 'preflop', 'action': 'fold'},
        )
        assert resp.status_code == 201

        # Verify via GET hand that Alice's result is 'folded'
        hand_resp = client.get(_hand_url(game_id, hand_number))
        assert hand_resp.status_code == 200
        player_hands = hand_resp.json()['player_hands']
        alice_ph = next(ph for ph in player_hands if ph['player_name'] == 'Alice')
        assert alice_ph['result'] == 'folded'


class TestGetHandShowsFolded:
    """AC-2: Subsequent GET of the hand shows the player as folded."""

    def test_get_hand_shows_folded_player(self, client, game_with_hand):
        game_id, hand_number = game_with_hand
        # Fold Alice
        client.post(
            _action_url(game_id, hand_number, 'Alice'),
            json={'street': 'flop', 'action': 'fold'},
        )

        hand_resp = client.get(_hand_url(game_id, hand_number))
        assert hand_resp.status_code == 200
        player_hands = hand_resp.json()['player_hands']
        alice_ph = next(ph for ph in player_hands if ph['player_name'] == 'Alice')
        bob_ph = next(ph for ph in player_hands if ph['player_name'] == 'Bob')
        assert alice_ph['result'] == 'folded'
        assert bob_ph['result'] == 'won'  # fold-to-one awards the pot


class TestAlreadyFoldedReturns400:
    """AC-3: Recording fold on an already-folded player returns 400."""

    def test_duplicate_fold_returns_400(self, client, game_with_hand):
        game_id, hand_number = game_with_hand
        # First fold succeeds
        resp1 = client.post(
            _action_url(game_id, hand_number, 'Alice'),
            json={'street': 'preflop', 'action': 'fold'},
        )
        assert resp1.status_code == 201

        # Second fold returns 400
        resp2 = client.post(
            _action_url(game_id, hand_number, 'Alice'),
            json={'street': 'preflop', 'action': 'fold'},
        )
        assert resp2.status_code == 400
        assert 'already folded' in resp2.json()['detail'].lower()


class TestNonFoldDoesNotModifyResult:
    """AC-4: Non-fold actions do not modify the result field."""

    @pytest.mark.parametrize('action_type', ['check', 'call', 'bet', 'raise'])
    def test_non_fold_action_leaves_result_none(
        self, client, game_with_hand, action_type
    ):
        game_id, hand_number = game_with_hand
        payload = {'street': 'preflop', 'action': action_type}
        if action_type in ('call', 'bet', 'raise'):
            payload['amount'] = 5.0

        resp = client.post(
            _action_url(game_id, hand_number, 'Alice'),
            json=payload,
        )
        assert resp.status_code == 201

        hand_resp = client.get(_hand_url(game_id, hand_number))
        player_hands = hand_resp.json()['player_hands']
        alice_ph = next(ph for ph in player_hands if ph['player_name'] == 'Alice')
        assert alice_ph['result'] is None
