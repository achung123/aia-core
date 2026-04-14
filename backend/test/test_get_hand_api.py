"""Tests for T-020: Get Single Hand endpoint (GET /games/{game_id}/hands/{hand_number})."""

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
def game_with_players(client):
    """Create a game session with two players; return the game_id."""
    resp = client.post(
        '/games',
        json={'game_date': '2026-03-11', 'player_names': ['Alice', 'Bob']},
    )
    assert resp.status_code == 201
    return resp.json()['game_id']


HAND_PAYLOAD = {
    'flop_1': {'rank': 'A', 'suit': 'S'},
    'flop_2': {'rank': 'K', 'suit': 'H'},
    'flop_3': {'rank': '2', 'suit': 'D'},
    'turn': {'rank': '5', 'suit': 'C'},
    'river': {'rank': 'J', 'suit': 'D'},
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
}


@pytest.fixture
def recorded_hand(client, game_with_players):
    """Record a hand and return its response JSON."""
    resp = client.post(f'/games/{game_with_players}/hands', json=HAND_PAYLOAD)
    assert resp.status_code == 201
    return resp.json()


class TestGetSingleHand:
    """GET /games/{game_id}/hands/{hand_number} — retrieve a single hand."""

    def test_get_hand_returns_200(self, client, game_with_players, recorded_hand):
        game_id = game_with_players
        hand_number = recorded_hand['hand_number']
        response = client.get(f'/games/{game_id}/hands/{hand_number}')
        assert response.status_code == 200

    def test_get_hand_returns_correct_hand_number(
        self, client, game_with_players, recorded_hand
    ):
        game_id = game_with_players
        hand_number = recorded_hand['hand_number']
        response = client.get(f'/games/{game_id}/hands/{hand_number}')
        assert response.json()['hand_number'] == hand_number

    def test_get_hand_returns_correct_game_id(
        self, client, game_with_players, recorded_hand
    ):
        game_id = game_with_players
        hand_number = recorded_hand['hand_number']
        response = client.get(f'/games/{game_id}/hands/{hand_number}')
        assert response.json()['game_id'] == game_id

    def test_get_hand_returns_community_cards(
        self, client, game_with_players, recorded_hand
    ):
        game_id = game_with_players
        hand_number = recorded_hand['hand_number']
        response = client.get(f'/games/{game_id}/hands/{hand_number}')
        data = response.json()
        assert data['flop_1'] == 'AS'
        assert data['flop_2'] == 'KH'
        assert data['flop_3'] == '2D'
        assert data['turn'] == '5C'
        assert data['river'] == 'JD'

    def test_get_hand_returns_player_hands(
        self, client, game_with_players, recorded_hand
    ):
        game_id = game_with_players
        hand_number = recorded_hand['hand_number']
        response = client.get(f'/games/{game_id}/hands/{hand_number}')
        data = response.json()
        assert 'player_hands' in data
        assert len(data['player_hands']) == 2

    def test_get_hand_player_hands_contain_names(
        self, client, game_with_players, recorded_hand
    ):
        game_id = game_with_players
        hand_number = recorded_hand['hand_number']
        response = client.get(f'/games/{game_id}/hands/{hand_number}')
        names = {ph['player_name'] for ph in response.json()['player_hands']}
        assert names == {'Alice', 'Bob'}

    def test_get_hand_returns_hand_id(self, client, game_with_players, recorded_hand):
        game_id = game_with_players
        hand_number = recorded_hand['hand_number']
        response = client.get(f'/games/{game_id}/hands/{hand_number}')
        assert 'hand_id' in response.json()

    def test_get_hand_returns_created_at(
        self, client, game_with_players, recorded_hand
    ):
        game_id = game_with_players
        hand_number = recorded_hand['hand_number']
        response = client.get(f'/games/{game_id}/hands/{hand_number}')
        assert 'created_at' in response.json()

    def test_get_hand_404_for_nonexistent_game(self, client):
        response = client.get('/games/99999/hands/1')
        assert response.status_code == 404

    def test_get_hand_404_detail_for_nonexistent_game(self, client):
        response = client.get('/games/99999/hands/1')
        assert 'detail' in response.json()

    def test_get_hand_404_for_nonexistent_hand_number(self, client, game_with_players):
        response = client.get(f'/games/{game_with_players}/hands/99999')
        assert response.status_code == 404

    def test_get_hand_404_detail_for_nonexistent_hand_number(
        self, client, game_with_players
    ):
        response = client.get(f'/games/{game_with_players}/hands/99999')
        assert 'detail' in response.json()

    def test_get_hand_number_1_from_multiple_hands(self, client, game_with_players):
        """When multiple hands exist, correct hand is returned by hand_number."""
        game_id = game_with_players
        # First hand: flop_1 = AS
        hand1_payload = {
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
        }
        # Second hand: flop_1 = 3C (distinct)
        hand2_payload = {
            'flop_1': {'rank': '3', 'suit': 'C'},
            'flop_2': {'rank': '4', 'suit': 'C'},
            'flop_3': {'rank': '5', 'suit': 'C'},
            'player_entries': [
                {
                    'player_name': 'Alice',
                    'card_1': {'rank': '6', 'suit': 'C'},
                    'card_2': {'rank': 'Q', 'suit': 'D'},
                },
                {
                    'player_name': 'Bob',
                    'card_1': {'rank': 'J', 'suit': 'S'},
                    'card_2': {'rank': 'A', 'suit': 'D'},
                },
            ],
        }
        client.post(f'/games/{game_id}/hands', json=hand1_payload)
        client.post(f'/games/{game_id}/hands', json=hand2_payload)

        resp1 = client.get(f'/games/{game_id}/hands/1')
        resp2 = client.get(f'/games/{game_id}/hands/2')

        assert resp1.status_code == 200
        assert resp1.json()['flop_1'] == 'AS'
        assert resp2.status_code == 200
        assert resp2.json()['flop_1'] == '3C'
