"""Tests for T-030: Add/Remove Player from Hand endpoints.

POST  /games/{game_id}/hands/{hand_number}/players
DELETE /games/{game_id}/hands/{hand_number}/players/{player_name}
"""

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
def game_with_hand(client):
    """Create a game with Alice and Bob recorded; hand has only Alice.

    Returns (game_id, hand_number, alice_cards, hand_community_cards).
    Charlie is NOT a game participant; Bob IS a participant but not in the hand.
    """
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
            ],
        },
    )
    assert hand_resp.status_code == 201
    return game_id, hand_resp.json()['hand_number']


# ---------------------------------------------------------------------------
# POST — Add player to hand
# ---------------------------------------------------------------------------


class TestAddPlayerToHand:
    """AC-1: Creates a PlayerHand with hole cards; validates no duplicate cards."""

    def test_add_player_returns_201_and_player_hand(self, client, game_with_hand):
        game_id, hand_number = game_with_hand
        resp = client.post(
            f'/games/{game_id}/hands/{hand_number}/players',
            json={
                'player_name': 'Bob',
                'card_1': {'rank': '9', 'suit': 'H'},
                'card_2': {'rank': '10', 'suit': 'H'},
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data['player_name'] == 'Bob'
        assert data['card_1'] == '9H'
        assert data['card_2'] == '10H'

    def test_add_player_persists_in_get_hand(self, client, game_with_hand):
        game_id, hand_number = game_with_hand
        client.post(
            f'/games/{game_id}/hands/{hand_number}/players',
            json={
                'player_name': 'Bob',
                'card_1': {'rank': '9', 'suit': 'H'},
                'card_2': {'rank': '10', 'suit': 'H'},
            },
        )
        get_resp = client.get(f'/games/{game_id}/hands/{hand_number}')
        assert get_resp.status_code == 200
        names = [ph['player_name'] for ph in get_resp.json()['player_hands']]
        assert 'Bob' in names

    def test_add_player_result_and_profit_loss_stored(self, client, game_with_hand):
        game_id, hand_number = game_with_hand
        resp = client.post(
            f'/games/{game_id}/hands/{hand_number}/players',
            json={
                'player_name': 'Bob',
                'card_1': {'rank': '9', 'suit': 'H'},
                'card_2': {'rank': '10', 'suit': 'H'},
                'result': 'win',
                'profit_loss': 25.0,
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data['result'] == 'win'
        assert data['profit_loss'] == 25.0

    def test_add_player_404_game_not_found(self, client):
        resp = client.post(
            '/games/9999/hands/1/players',
            json={
                'player_name': 'Bob',
                'card_1': {'rank': '9', 'suit': 'H'},
                'card_2': {'rank': '10', 'suit': 'H'},
            },
        )
        assert resp.status_code == 404

    def test_add_player_404_hand_not_found(self, client, game_with_hand):
        game_id, _ = game_with_hand
        resp = client.post(
            f'/games/{game_id}/hands/9999/players',
            json={
                'player_name': 'Bob',
                'card_1': {'rank': '9', 'suit': 'H'},
                'card_2': {'rank': '10', 'suit': 'H'},
            },
        )
        assert resp.status_code == 404

    def test_add_player_404_player_not_found(self, client, game_with_hand):
        game_id, hand_number = game_with_hand
        resp = client.post(
            f'/games/{game_id}/hands/{hand_number}/players',
            json={
                'player_name': 'Charlie',
                'card_1': {'rank': '9', 'suit': 'H'},
                'card_2': {'rank': '10', 'suit': 'H'},
            },
        )
        assert resp.status_code == 404

    def test_add_player_400_not_game_participant(self, client, game_with_hand):
        """Player exists globally but is not in this game session."""
        game_id, hand_number = game_with_hand
        # Create a player outside this game
        client.post('/players', json={'name': 'Eve'})
        resp = client.post(
            f'/games/{game_id}/hands/{hand_number}/players',
            json={
                'player_name': 'Eve',
                'card_1': {'rank': '9', 'suit': 'H'},
                'card_2': {'rank': '10', 'suit': 'H'},
            },
        )
        assert resp.status_code == 400

    def test_add_player_400_duplicate_player_in_hand(self, client, game_with_hand):
        """Adding a player already present in the hand returns 400."""
        game_id, hand_number = game_with_hand
        resp = client.post(
            f'/games/{game_id}/hands/{hand_number}/players',
            json={
                'player_name': 'Alice',
                'card_1': {'rank': '9', 'suit': 'H'},
                'card_2': {'rank': '10', 'suit': 'H'},
            },
        )
        assert resp.status_code == 400

    def test_add_player_400_duplicate_card(self, client, game_with_hand):
        """Hole cards that duplicate a community card return 400."""
        game_id, hand_number = game_with_hand
        # flop_1 is AS — try to add Bob with AS
        resp = client.post(
            f'/games/{game_id}/hands/{hand_number}/players',
            json={
                'player_name': 'Bob',
                'card_1': {'rank': 'A', 'suit': 'S'},
                'card_2': {'rank': '10', 'suit': 'H'},
            },
        )
        assert resp.status_code == 400

    def test_add_player_400_duplicate_card_vs_existing_hole_cards(
        self, client, game_with_hand
    ):
        """Hole cards that duplicate another player's hole cards return 400."""
        game_id, hand_number = game_with_hand
        # Alice has 7S and 8S — try to add Bob with 7S
        resp = client.post(
            f'/games/{game_id}/hands/{hand_number}/players',
            json={
                'player_name': 'Bob',
                'card_1': {'rank': '7', 'suit': 'S'},
                'card_2': {'rank': '10', 'suit': 'H'},
            },
        )
        assert resp.status_code == 400


# ---------------------------------------------------------------------------
# DELETE — Remove player from hand
# ---------------------------------------------------------------------------


class TestRemovePlayerFromHand:
    """AC-2: Removes the PlayerHand record."""

    def test_remove_player_returns_204(self, client, game_with_hand):
        game_id, hand_number = game_with_hand
        resp = client.delete(
            f'/games/{game_id}/hands/{hand_number}/players/Alice'
        )
        assert resp.status_code == 204

    def test_remove_player_no_longer_in_hand(self, client, game_with_hand):
        game_id, hand_number = game_with_hand
        client.delete(f'/games/{game_id}/hands/{hand_number}/players/Alice')
        get_resp = client.get(f'/games/{game_id}/hands/{hand_number}')
        names = [ph['player_name'] for ph in get_resp.json()['player_hands']]
        assert 'Alice' not in names

    def test_remove_player_404_game_not_found(self, client):
        resp = client.delete('/games/9999/hands/1/players/Alice')
        assert resp.status_code == 404

    def test_remove_player_404_hand_not_found(self, client, game_with_hand):
        game_id, _ = game_with_hand
        resp = client.delete(f'/games/{game_id}/hands/9999/players/Alice')
        assert resp.status_code == 404

    def test_remove_player_404_player_not_found(self, client, game_with_hand):
        game_id, hand_number = game_with_hand
        resp = client.delete(
            f'/games/{game_id}/hands/{hand_number}/players/Charlie'
        )
        assert resp.status_code == 404

    def test_remove_player_404_player_not_in_hand(self, client, game_with_hand):
        """Bob is a game participant but not recorded in this hand."""
        game_id, hand_number = game_with_hand
        resp = client.delete(
            f'/games/{game_id}/hands/{hand_number}/players/Bob'
        )
        assert resp.status_code == 404

    def test_remove_player_case_insensitive(self, client, game_with_hand):
        game_id, hand_number = game_with_hand
        resp = client.delete(
            f'/games/{game_id}/hands/{hand_number}/players/alice'
        )
        assert resp.status_code == 204
