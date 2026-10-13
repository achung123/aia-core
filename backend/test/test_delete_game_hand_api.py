"""Tests for DELETE /games/{id} and DELETE /games/{id}/hands/{num}."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, StaticPool
from sqlalchemy.orm import sessionmaker

from app.database.models import Base, Hand, HandState, PlayerHand, PlayerHandAction
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


def _seed_game(client: TestClient, date: str = '2026-01-01', players=None):
    """Create a game session and return the JSON response."""
    if players is None:
        players = ['Alice', 'Bob']
    resp = client.post('/games', json={'game_date': date, 'player_names': players})
    assert resp.status_code == 201
    return resp.json()


def _seed_hand(client: TestClient, game_id: int):
    """Create a hand in the given game and return the JSON response."""
    resp = client.post(
        f'/games/{game_id}/hands',
        json={
            'flop_1': {'rank': 'A', 'suit': 'H'},
            'flop_2': {'rank': 'K', 'suit': 'D'},
            'flop_3': {'rank': 'Q', 'suit': 'C'},
            'player_entries': [
                {
                    'player_name': 'Alice',
                    'card_1': {'rank': '2', 'suit': 'H'},
                    'card_2': {'rank': '3', 'suit': 'H'},
                    'result': 'won',
                    'profit_loss': 10,
                },
                {
                    'player_name': 'Bob',
                    'card_1': {'rank': '4', 'suit': 'S'},
                    'card_2': {'rank': '5', 'suit': 'S'},
                    'result': 'lost',
                    'profit_loss': -10,
                },
            ],
        },
    )
    assert resp.status_code == 201
    return resp.json()


class TestDeleteHand:
    def test_delete_hand_returns_204(self, client):
        game = _seed_game(client)
        _seed_hand(client, game['game_id'])
        resp = client.delete(f'/games/{game["game_id"]}/hands/1')
        assert resp.status_code == 204

    def test_delete_hand_removes_hand_from_list(self, client):
        game = _seed_game(client)
        _seed_hand(client, game['game_id'])
        client.delete(f'/games/{game["game_id"]}/hands/1')
        hands = client.get(f'/games/{game["game_id"]}/hands').json()
        assert len(hands) == 0

    def test_delete_hand_removes_player_hands(self, client):
        game = _seed_game(client)
        _seed_hand(client, game['game_id'])
        client.delete(f'/games/{game["game_id"]}/hands/1')
        # Fetching the deleted hand should 404
        resp = client.get(f'/games/{game["game_id"]}/hands/1')
        assert resp.status_code == 404

    def test_delete_hand_404_nonexistent_game(self, client):
        resp = client.delete('/games/999/hands/1')
        assert resp.status_code == 404

    def test_delete_hand_404_nonexistent_hand(self, client):
        game = _seed_game(client)
        resp = client.delete(f'/games/{game["game_id"]}/hands/999')
        assert resp.status_code == 404

    def test_delete_hand_cascades_hand_state(self, client):
        """Deleting a hand with a HandState row must not 500."""
        game = _seed_game(client)
        _seed_hand(client, game['game_id'])
        db = next(override_get_db())
        hand = db.query(Hand).first()
        db.add(HandState(hand_id=hand.hand_id, phase='preflop'))
        db.commit()
        resp = client.delete(f'/games/{game["game_id"]}/hands/1')
        assert resp.status_code == 204
        assert db.query(HandState).count() == 0

    def test_delete_hand_cascades_player_hand_actions(self, client):
        """Deleting a hand with PlayerHandAction rows must not 500."""
        game = _seed_game(client)
        _seed_hand(client, game['game_id'])
        db = next(override_get_db())
        ph = db.query(PlayerHand).first()
        db.add(
            PlayerHandAction(
                player_hand_id=ph.player_hand_id,
                street='preflop',
                action='call',
                amount=0.20,
            )
        )
        db.commit()
        resp = client.delete(f'/games/{game["game_id"]}/hands/1')
        assert resp.status_code == 204
        assert db.query(PlayerHandAction).count() == 0


class TestDeleteGame:
    def test_delete_game_returns_204(self, client):
        game = _seed_game(client)
        resp = client.delete(f'/games/{game["game_id"]}')
        assert resp.status_code == 204

    def test_delete_game_removes_from_list(self, client):
        game = _seed_game(client)
        client.delete(f'/games/{game["game_id"]}')
        games = client.get('/games').json()
        assert all(g['game_id'] != game['game_id'] for g in games)

    def test_delete_game_cascades_hands(self, client):
        game = _seed_game(client)
        _seed_hand(client, game['game_id'])
        client.delete(f'/games/{game["game_id"]}')
        # Game should be gone
        resp = client.get(f'/games/{game["game_id"]}')
        assert resp.status_code == 404

    def test_delete_game_404_nonexistent(self, client):
        resp = client.delete('/games/999')
        assert resp.status_code == 404

    def test_delete_game_cascades_hand_states(self, client):
        """Deleting a game with HandState rows must not 500."""
        game = _seed_game(client)
        _seed_hand(client, game['game_id'])
        # Insert a HandState row for the hand (simulates dealer flow)
        db = next(override_get_db())
        hand = db.query(Hand).first()
        db.add(HandState(hand_id=hand.hand_id, phase='preflop'))
        db.commit()
        resp = client.delete(f'/games/{game["game_id"]}')
        assert resp.status_code == 204
        assert db.query(HandState).count() == 0

    def test_delete_game_cascades_player_hand_actions(self, client):
        """Deleting a game with PlayerHandAction rows must not 500."""
        game = _seed_game(client)
        _seed_hand(client, game['game_id'])
        db = next(override_get_db())
        ph = db.query(PlayerHand).first()
        db.add(
            PlayerHandAction(
                player_hand_id=ph.player_hand_id,
                street='preflop',
                action='call',
                amount=0.20,
            )
        )
        db.commit()
        resp = client.delete(f'/games/{game["game_id"]}')
        assert resp.status_code == 204
        assert db.query(PlayerHandAction).count() == 0
