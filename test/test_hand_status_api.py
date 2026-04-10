"""Tests for T-001: Hand status polling endpoint (GET /games/{game_id}/hands/{hand_number}/status)."""

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
    """Create a game session with three players; return the game_id."""
    resp = client.post(
        '/games',
        json={'game_date': '2026-04-09', 'player_names': ['Alice', 'Bob', 'Charlie']},
    )
    assert resp.status_code == 201
    return resp.json()['game_id']


@pytest.fixture
def empty_hand(client, game_with_players):
    """Create an empty hand (no player_hands); return (game_id, hand_number)."""
    resp = client.post(f'/games/{game_with_players}/hands', json={})
    assert resp.status_code == 201
    return game_with_players, resp.json()['hand_number']


class TestHandStatus404:
    """AC-3: Returns 404 for missing game or hand."""

    def test_missing_game_returns_404(self, client):
        resp = client.get('/games/9999/hands/1/status')
        assert resp.status_code == 404

    def test_missing_hand_returns_404(self, client, game_with_players):
        resp = client.get(f'/games/{game_with_players}/hands/999/status')
        assert resp.status_code == 404


class TestHandStatusIdle:
    """AC-2: No PlayerHand row → 'idle'."""

    def test_all_players_idle_when_no_player_hands(self, client, empty_hand):
        game_id, hand_number = empty_hand
        resp = client.get(f'/games/{game_id}/hands/{hand_number}/status')
        assert resp.status_code == 200
        data = resp.json()
        assert data['hand_number'] == hand_number
        assert data['community_recorded'] is False
        assert len(data['players']) == 3
        for p in data['players']:
            assert p['participation_status'] == 'idle'


class TestHandStatusPending:
    """AC-2: Row with null card_1 & null result → 'pending'."""

    def test_player_pending_when_added_without_cards(self, client, empty_hand):
        game_id, hand_number = empty_hand
        # Add a player to the hand without cards
        client.post(
            f'/games/{game_id}/hands/{hand_number}/players',
            json={'player_name': 'Alice'},
        )
        resp = client.get(f'/games/{game_id}/hands/{hand_number}/status')
        data = resp.json()
        alice = next(p for p in data['players'] if p['name'] == 'Alice')
        assert alice['participation_status'] == 'pending'
        # Others should still be idle
        bob = next(p for p in data['players'] if p['name'] == 'Bob')
        assert bob['participation_status'] == 'idle'


class TestHandStatusJoined:
    """AC-2: card_1 set & null result → 'joined'."""

    def test_player_joined_when_cards_set(self, client, empty_hand):
        game_id, hand_number = empty_hand
        # Add player then set hole cards
        client.post(
            f'/games/{game_id}/hands/{hand_number}/players',
            json={'player_name': 'Alice'},
        )
        client.patch(
            f'/games/{game_id}/hands/{hand_number}/players/Alice',
            json={
                'card_1': {'rank': 'A', 'suit': 'S'},
                'card_2': {'rank': 'K', 'suit': 'H'},
            },
        )
        resp = client.get(f'/games/{game_id}/hands/{hand_number}/status')
        data = resp.json()
        alice = next(p for p in data['players'] if p['name'] == 'Alice')
        assert alice['participation_status'] == 'joined'
        assert alice['card_1'] == 'AS'
        assert alice['card_2'] == 'KH'


class TestHandStatusFolded:
    """AC-2: result='folded' → 'folded'."""

    def test_player_folded(self, client, empty_hand):
        game_id, hand_number = empty_hand
        # Add player with cards, then set result to folded
        client.post(
            f'/games/{game_id}/hands/{hand_number}/players',
            json={
                'player_name': 'Alice',
                'card_1': {'rank': '7', 'suit': 'S'},
                'card_2': {'rank': '8', 'suit': 'S'},
            },
        )
        client.patch(
            f'/games/{game_id}/hands/{hand_number}/players/Alice/result',
            json={'result': 'folded', 'profit_loss': 0},
        )
        resp = client.get(f'/games/{game_id}/hands/{hand_number}/status')
        data = resp.json()
        alice = next(p for p in data['players'] if p['name'] == 'Alice')
        assert alice['participation_status'] == 'folded'


class TestHandStatusWonLost:
    """AC-2: result='won'/'lost' → as-is."""

    def test_player_won(self, client, empty_hand):
        game_id, hand_number = empty_hand
        client.post(
            f'/games/{game_id}/hands/{hand_number}/players',
            json={
                'player_name': 'Alice',
                'card_1': {'rank': '7', 'suit': 'S'},
                'card_2': {'rank': '8', 'suit': 'S'},
            },
        )
        client.patch(
            f'/games/{game_id}/hands/{hand_number}/players/Alice/result',
            json={'result': 'won', 'profit_loss': 50.0},
        )
        resp = client.get(f'/games/{game_id}/hands/{hand_number}/status')
        data = resp.json()
        alice = next(p for p in data['players'] if p['name'] == 'Alice')
        assert alice['participation_status'] == 'won'


class TestHandStatusCommunityRecorded:
    """AC-1: community_recorded is True when community cards are present."""

    def test_community_recorded_true_when_flop_present(self, client, game_with_players):
        resp = client.post(
            f'/games/{game_with_players}/hands',
            json={
                'flop_1': {'rank': 'A', 'suit': 'S'},
                'flop_2': {'rank': 'K', 'suit': 'H'},
                'flop_3': {'rank': '2', 'suit': 'D'},
            },
        )
        assert resp.status_code == 201
        hand_number = resp.json()['hand_number']
        resp = client.get(f'/games/{game_with_players}/hands/{hand_number}/status')
        data = resp.json()
        assert data['community_recorded'] is True

    def test_community_recorded_false_when_no_community_cards(self, client, empty_hand):
        game_id, hand_number = empty_hand
        resp = client.get(f'/games/{game_id}/hands/{hand_number}/status')
        data = resp.json()
        assert data['community_recorded'] is False
