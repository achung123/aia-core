"""Tests for per-street community card endpoints.

PATCH /games/{game_id}/hands/{hand_number}/flop  — sets 3 flop cards
PATCH /games/{game_id}/hands/{hand_number}/turn  — sets 1 turn card (requires flop)
PATCH /games/{game_id}/hands/{hand_number}/river — sets 1 river card (requires turn)
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
def game_with_empty_hand(client):
    """Create a game with an empty hand (no community cards)."""
    game_resp = client.post(
        '/games',
        json={'game_date': '2026-04-10', 'player_names': ['Alice', 'Bob']},
    )
    assert game_resp.status_code == 201
    game_id = game_resp.json()['game_id']

    hand_resp = client.post(
        f'/games/{game_id}/hands',
        json={
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
    return game_id, hand_resp.json()['hand_number']


class TestFlopEndpoint:
    """PATCH /games/{game_id}/hands/{hand_number}/flop"""

    def test_set_flop_returns_200(self, client, game_with_empty_hand):
        game_id, hand_number = game_with_empty_hand
        resp = client.patch(
            f'/games/{game_id}/hands/{hand_number}/flop',
            json={
                'flop_1': {'rank': 'A', 'suit': 'S'},
                'flop_2': {'rank': 'K', 'suit': 'H'},
                'flop_3': {'rank': 'Q', 'suit': 'D'},
            },
        )
        assert resp.status_code == 200

    def test_set_flop_updates_hand(self, client, game_with_empty_hand):
        game_id, hand_number = game_with_empty_hand
        client.patch(
            f'/games/{game_id}/hands/{hand_number}/flop',
            json={
                'flop_1': {'rank': 'A', 'suit': 'S'},
                'flop_2': {'rank': 'K', 'suit': 'H'},
                'flop_3': {'rank': 'Q', 'suit': 'D'},
            },
        )
        hand = client.get(f'/games/{game_id}/hands/{hand_number}').json()
        assert hand['flop_1'] == 'AS'
        assert hand['flop_2'] == 'KH'
        assert hand['flop_3'] == 'QD'

    def test_set_flop_does_not_touch_turn_river(self, client, game_with_empty_hand):
        game_id, hand_number = game_with_empty_hand
        client.patch(
            f'/games/{game_id}/hands/{hand_number}/flop',
            json={
                'flop_1': {'rank': 'A', 'suit': 'S'},
                'flop_2': {'rank': 'K', 'suit': 'H'},
                'flop_3': {'rank': 'Q', 'suit': 'D'},
            },
        )
        hand = client.get(f'/games/{game_id}/hands/{hand_number}').json()
        assert hand['turn'] is None
        assert hand['river'] is None

    def test_set_flop_rejects_duplicate_cards(self, client, game_with_empty_hand):
        game_id, hand_number = game_with_empty_hand
        resp = client.patch(
            f'/games/{game_id}/hands/{hand_number}/flop',
            json={
                'flop_1': {'rank': '7', 'suit': 'S'},  # same as Alice's card_1
                'flop_2': {'rank': 'K', 'suit': 'H'},
                'flop_3': {'rank': 'Q', 'suit': 'D'},
            },
        )
        assert resp.status_code == 400

    def test_set_flop_404_bad_game(self, client, game_with_empty_hand):
        _, hand_number = game_with_empty_hand
        resp = client.patch(
            f'/games/9999/hands/{hand_number}/flop',
            json={
                'flop_1': {'rank': 'A', 'suit': 'S'},
                'flop_2': {'rank': 'K', 'suit': 'H'},
                'flop_3': {'rank': 'Q', 'suit': 'D'},
            },
        )
        assert resp.status_code == 404

    def test_set_flop_404_bad_hand(self, client, game_with_empty_hand):
        game_id, _ = game_with_empty_hand
        resp = client.patch(
            f'/games/{game_id}/hands/999/flop',
            json={
                'flop_1': {'rank': 'A', 'suit': 'S'},
                'flop_2': {'rank': 'K', 'suit': 'H'},
                'flop_3': {'rank': 'Q', 'suit': 'D'},
            },
        )
        assert resp.status_code == 404

    def test_set_flop_returns_hand_response(self, client, game_with_empty_hand):
        game_id, hand_number = game_with_empty_hand
        resp = client.patch(
            f'/games/{game_id}/hands/{hand_number}/flop',
            json={
                'flop_1': {'rank': 'A', 'suit': 'S'},
                'flop_2': {'rank': 'K', 'suit': 'H'},
                'flop_3': {'rank': 'Q', 'suit': 'D'},
            },
        )
        data = resp.json()
        assert data['flop_1'] == 'AS'
        assert data['flop_2'] == 'KH'
        assert data['flop_3'] == 'QD'
        assert 'player_hands' in data


class TestTurnEndpoint:
    """PATCH /games/{game_id}/hands/{hand_number}/turn"""

    def test_set_turn_requires_flop(self, client, game_with_empty_hand):
        """Turn cannot be set without flop."""
        game_id, hand_number = game_with_empty_hand
        resp = client.patch(
            f'/games/{game_id}/hands/{hand_number}/turn',
            json={'turn': {'rank': 'J', 'suit': 'C'}},
        )
        assert resp.status_code == 400
        assert 'flop' in resp.json()['detail'].lower()

    def test_set_turn_succeeds_with_flop(self, client, game_with_empty_hand):
        game_id, hand_number = game_with_empty_hand
        # Set flop first
        client.patch(
            f'/games/{game_id}/hands/{hand_number}/flop',
            json={
                'flop_1': {'rank': 'A', 'suit': 'S'},
                'flop_2': {'rank': 'K', 'suit': 'H'},
                'flop_3': {'rank': 'Q', 'suit': 'D'},
            },
        )
        resp = client.patch(
            f'/games/{game_id}/hands/{hand_number}/turn',
            json={'turn': {'rank': 'J', 'suit': 'C'}},
        )
        assert resp.status_code == 200

    def test_set_turn_updates_hand(self, client, game_with_empty_hand):
        game_id, hand_number = game_with_empty_hand
        client.patch(
            f'/games/{game_id}/hands/{hand_number}/flop',
            json={
                'flop_1': {'rank': 'A', 'suit': 'S'},
                'flop_2': {'rank': 'K', 'suit': 'H'},
                'flop_3': {'rank': 'Q', 'suit': 'D'},
            },
        )
        client.patch(
            f'/games/{game_id}/hands/{hand_number}/turn',
            json={'turn': {'rank': 'J', 'suit': 'C'}},
        )
        hand = client.get(f'/games/{game_id}/hands/{hand_number}').json()
        assert hand['turn'] == 'JC'

    def test_set_turn_does_not_clear_flop(self, client, game_with_empty_hand):
        game_id, hand_number = game_with_empty_hand
        client.patch(
            f'/games/{game_id}/hands/{hand_number}/flop',
            json={
                'flop_1': {'rank': 'A', 'suit': 'S'},
                'flop_2': {'rank': 'K', 'suit': 'H'},
                'flop_3': {'rank': 'Q', 'suit': 'D'},
            },
        )
        client.patch(
            f'/games/{game_id}/hands/{hand_number}/turn',
            json={'turn': {'rank': 'J', 'suit': 'C'}},
        )
        hand = client.get(f'/games/{game_id}/hands/{hand_number}').json()
        assert hand['flop_1'] == 'AS'
        assert hand['flop_2'] == 'KH'
        assert hand['flop_3'] == 'QD'

    def test_set_turn_rejects_duplicate_with_flop(self, client, game_with_empty_hand):
        game_id, hand_number = game_with_empty_hand
        client.patch(
            f'/games/{game_id}/hands/{hand_number}/flop',
            json={
                'flop_1': {'rank': 'A', 'suit': 'S'},
                'flop_2': {'rank': 'K', 'suit': 'H'},
                'flop_3': {'rank': 'Q', 'suit': 'D'},
            },
        )
        resp = client.patch(
            f'/games/{game_id}/hands/{hand_number}/turn',
            json={'turn': {'rank': 'A', 'suit': 'S'}},  # duplicate with flop_1
        )
        assert resp.status_code == 400


class TestRiverEndpoint:
    """PATCH /games/{game_id}/hands/{hand_number}/river"""

    def test_set_river_requires_turn(self, client, game_with_empty_hand):
        """River cannot be set without turn."""
        game_id, hand_number = game_with_empty_hand
        # Set flop but not turn
        client.patch(
            f'/games/{game_id}/hands/{hand_number}/flop',
            json={
                'flop_1': {'rank': 'A', 'suit': 'S'},
                'flop_2': {'rank': 'K', 'suit': 'H'},
                'flop_3': {'rank': 'Q', 'suit': 'D'},
            },
        )
        resp = client.patch(
            f'/games/{game_id}/hands/{hand_number}/river',
            json={'river': {'rank': '2', 'suit': 'C'}},
        )
        assert resp.status_code == 400
        assert 'turn' in resp.json()['detail'].lower()

    def test_set_river_requires_flop(self, client, game_with_empty_hand):
        """River cannot be set without flop either."""
        game_id, hand_number = game_with_empty_hand
        resp = client.patch(
            f'/games/{game_id}/hands/{hand_number}/river',
            json={'river': {'rank': '2', 'suit': 'C'}},
        )
        assert resp.status_code == 400

    def test_set_river_succeeds_with_flop_and_turn(self, client, game_with_empty_hand):
        game_id, hand_number = game_with_empty_hand
        client.patch(
            f'/games/{game_id}/hands/{hand_number}/flop',
            json={
                'flop_1': {'rank': 'A', 'suit': 'S'},
                'flop_2': {'rank': 'K', 'suit': 'H'},
                'flop_3': {'rank': 'Q', 'suit': 'D'},
            },
        )
        client.patch(
            f'/games/{game_id}/hands/{hand_number}/turn',
            json={'turn': {'rank': 'J', 'suit': 'C'}},
        )
        resp = client.patch(
            f'/games/{game_id}/hands/{hand_number}/river',
            json={'river': {'rank': '2', 'suit': 'C'}},
        )
        assert resp.status_code == 200

    def test_set_river_updates_hand(self, client, game_with_empty_hand):
        game_id, hand_number = game_with_empty_hand
        client.patch(
            f'/games/{game_id}/hands/{hand_number}/flop',
            json={
                'flop_1': {'rank': 'A', 'suit': 'S'},
                'flop_2': {'rank': 'K', 'suit': 'H'},
                'flop_3': {'rank': 'Q', 'suit': 'D'},
            },
        )
        client.patch(
            f'/games/{game_id}/hands/{hand_number}/turn',
            json={'turn': {'rank': 'J', 'suit': 'C'}},
        )
        client.patch(
            f'/games/{game_id}/hands/{hand_number}/river',
            json={'river': {'rank': '2', 'suit': 'C'}},
        )
        hand = client.get(f'/games/{game_id}/hands/{hand_number}').json()
        assert hand['river'] == '2C'

    def test_set_river_preserves_flop_and_turn(self, client, game_with_empty_hand):
        game_id, hand_number = game_with_empty_hand
        client.patch(
            f'/games/{game_id}/hands/{hand_number}/flop',
            json={
                'flop_1': {'rank': 'A', 'suit': 'S'},
                'flop_2': {'rank': 'K', 'suit': 'H'},
                'flop_3': {'rank': 'Q', 'suit': 'D'},
            },
        )
        client.patch(
            f'/games/{game_id}/hands/{hand_number}/turn',
            json={'turn': {'rank': 'J', 'suit': 'C'}},
        )
        client.patch(
            f'/games/{game_id}/hands/{hand_number}/river',
            json={'river': {'rank': '2', 'suit': 'C'}},
        )
        hand = client.get(f'/games/{game_id}/hands/{hand_number}').json()
        assert hand['flop_1'] == 'AS'
        assert hand['turn'] == 'JC'
