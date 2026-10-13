"""Tests for T-002: Make HandCreate fields optional — empty-body hand creation."""

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


class TestEmptyBodyHandCreation:
    """AC-1: POST /games/{game_id}/hands with {} body returns 201."""

    def test_empty_body_returns_201(self, client, game_with_players):
        resp = client.post(f'/games/{game_with_players}/hands', json={})
        assert resp.status_code == 201

    def test_empty_body_hand_has_null_community_cards(self, client, game_with_players):
        resp = client.post(f'/games/{game_with_players}/hands', json={})
        data = resp.json()
        assert data['flop_1'] is None
        assert data['flop_2'] is None
        assert data['flop_3'] is None
        assert data['turn'] is None
        assert data['river'] is None

    def test_empty_body_hand_has_empty_player_hands(self, client, game_with_players):
        resp = client.post(f'/games/{game_with_players}/hands', json={})
        data = resp.json()
        assert data['player_hands'] == []

    def test_empty_body_hand_gets_hand_number(self, client, game_with_players):
        resp = client.post(f'/games/{game_with_players}/hands', json={})
        data = resp.json()
        assert data['hand_number'] == 1

    def test_empty_body_sequential_hand_numbers(self, client, game_with_players):
        resp1 = client.post(f'/games/{game_with_players}/hands', json={})
        resp2 = client.post(f'/games/{game_with_players}/hands', json={})
        assert resp1.json()['hand_number'] == 1
        assert resp2.json()['hand_number'] == 2


class TestEmptyThenFullPayloadSequence:
    """AC-3: Empty hand followed by full-payload hand — both succeed."""

    def test_empty_then_full_payload_both_succeed(self, client, game_with_players):
        empty_resp = client.post(f'/games/{game_with_players}/hands', json={})
        assert empty_resp.status_code == 201
        assert empty_resp.json()['hand_number'] == 1

        full_payload = {
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
        }
        full_resp = client.post(f'/games/{game_with_players}/hands', json=full_payload)
        assert full_resp.status_code == 201
        full_data = full_resp.json()
        assert full_data['hand_number'] == 2
        assert full_data['flop_1'] == 'AS'
        assert len(full_data['player_hands']) == 1


class TestFullPayloadBackwardsCompatible:
    """AC-2: POST /games/{game_id}/hands with full payload still returns 201."""

    def test_full_payload_still_works(self, client, game_with_players):
        payload = {
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
        resp = client.post(f'/games/{game_with_players}/hands', json=payload)
        assert resp.status_code == 201
        data = resp.json()
        assert data['flop_1'] == 'AS'
        assert data['flop_2'] == 'KH'
        assert data['flop_3'] == '2D'
        assert len(data['player_hands']) == 2

    def test_partial_community_cards(self, client, game_with_players):
        """Only flop provided, no turn/river, no players."""
        payload = {
            'flop_1': {'rank': 'A', 'suit': 'S'},
            'flop_2': {'rank': 'K', 'suit': 'H'},
            'flop_3': {'rank': '2', 'suit': 'D'},
        }
        resp = client.post(f'/games/{game_with_players}/hands', json=payload)
        assert resp.status_code == 201
        data = resp.json()
        assert data['flop_1'] == 'AS'
        assert data['flop_2'] == 'KH'
        assert data['flop_3'] == '2D'
        assert data['turn'] is None
        assert data['river'] is None
        assert data['player_hands'] == []
