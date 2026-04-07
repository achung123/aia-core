"""Tests for T-021: List Hands in Game endpoint (GET /games/{game_id}/hands)."""

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
def game_with_players(client):
    """Create a game session with two players; return the game_id."""
    resp = client.post(
        '/games',
        json={'game_date': '2026-03-11', 'player_names': ['Alice', 'Bob']},
    )
    assert resp.status_code == 201
    return resp.json()['game_id']


HAND_PAYLOAD_1 = {
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

HAND_PAYLOAD_2 = {
    'flop_1': {'rank': '3', 'suit': 'C'},
    'flop_2': {'rank': '4', 'suit': 'D'},
    'flop_3': {'rank': '5', 'suit': 'H'},
    'player_entries': [
        {
            'player_name': 'Alice',
            'card_1': {'rank': '6', 'suit': 'C'},
            'card_2': {'rank': '7', 'suit': 'C'},
        },
        {
            'player_name': 'Bob',
            'card_1': {'rank': '8', 'suit': 'D'},
            'card_2': {'rank': '9', 'suit': 'D'},
        },
    ],
}


class TestListHandsInGame:
    """GET /games/{game_id}/hands — list all hands in a game session."""

    def test_list_hands_returns_200(self, client, game_with_players):
        response = client.get(f'/games/{game_with_players}/hands')
        assert response.status_code == 200

    def test_list_hands_returns_empty_list_when_no_hands(
        self, client, game_with_players
    ):
        response = client.get(f'/games/{game_with_players}/hands')
        assert response.json() == []

    def test_list_hands_returns_404_for_unknown_game(self, client):
        response = client.get('/games/9999/hands')
        assert response.status_code == 404

    def test_list_hands_404_detail(self, client):
        response = client.get('/games/9999/hands')
        assert 'not found' in response.json()['detail'].lower()

    def test_list_hands_returns_single_hand(self, client, game_with_players):
        client.post(f'/games/{game_with_players}/hands', json=HAND_PAYLOAD_1)
        response = client.get(f'/games/{game_with_players}/hands')
        assert len(response.json()) == 1

    def test_list_hands_returns_all_hands(self, client, game_with_players):
        client.post(f'/games/{game_with_players}/hands', json=HAND_PAYLOAD_1)
        client.post(f'/games/{game_with_players}/hands', json=HAND_PAYLOAD_2)
        response = client.get(f'/games/{game_with_players}/hands')
        assert len(response.json()) == 2

    def test_list_hands_ordered_by_hand_number_ascending(
        self, client, game_with_players
    ):
        client.post(f'/games/{game_with_players}/hands', json=HAND_PAYLOAD_1)
        client.post(f'/games/{game_with_players}/hands', json=HAND_PAYLOAD_2)
        data = client.get(f'/games/{game_with_players}/hands').json()
        hand_numbers = [h['hand_number'] for h in data]
        assert hand_numbers == sorted(hand_numbers)

    def test_list_hands_first_hand_number_is_1(self, client, game_with_players):
        client.post(f'/games/{game_with_players}/hands', json=HAND_PAYLOAD_1)
        data = client.get(f'/games/{game_with_players}/hands').json()
        assert data[0]['hand_number'] == 1

    def test_list_hands_includes_game_id(self, client, game_with_players):
        client.post(f'/games/{game_with_players}/hands', json=HAND_PAYLOAD_1)
        data = client.get(f'/games/{game_with_players}/hands').json()
        assert data[0]['game_id'] == game_with_players

    def test_list_hands_includes_community_cards(self, client, game_with_players):
        client.post(f'/games/{game_with_players}/hands', json=HAND_PAYLOAD_1)
        data = client.get(f'/games/{game_with_players}/hands').json()
        hand = data[0]
        assert hand['flop_1'] == 'AS'
        assert hand['flop_2'] == 'KH'
        assert hand['flop_3'] == '2D'
        assert hand['turn'] == '5C'
        assert hand['river'] == 'JD'

    def test_list_hands_includes_player_hands(self, client, game_with_players):
        client.post(f'/games/{game_with_players}/hands', json=HAND_PAYLOAD_1)
        data = client.get(f'/games/{game_with_players}/hands').json()
        assert len(data[0]['player_hands']) == 2

    def test_list_hands_only_returns_hands_for_given_game(
        self, client, game_with_players
    ):
        # Create a second game
        resp2 = client.post(
            '/games',
            json={'game_date': '2026-03-12', 'player_names': ['Carol', 'Dan']},
        )
        game2_id = resp2.json()['game_id']
        second_game_hand = {
            'flop_1': {'rank': 'Q', 'suit': 'S'},
            'flop_2': {'rank': 'J', 'suit': 'H'},
            'flop_3': {'rank': '10', 'suit': 'D'},
            'player_entries': [
                {
                    'player_name': 'Carol',
                    'card_1': {'rank': '2', 'suit': 'C'},
                    'card_2': {'rank': '3', 'suit': 'C'},
                },
                {
                    'player_name': 'Dan',
                    'card_1': {'rank': '4', 'suit': 'H'},
                    'card_2': {'rank': '5', 'suit': 'H'},
                },
            ],
        }
        client.post(f'/games/{game_with_players}/hands', json=HAND_PAYLOAD_1)
        client.post(f'/games/{game2_id}/hands', json=second_game_hand)

        data = client.get(f'/games/{game_with_players}/hands').json()
        assert len(data) == 1
        assert data[0]['game_id'] == game_with_players
