"""Tests for aia-core-gilq: HandResponse must include sb_player_name/bb_player_name."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, StaticPool
from sqlalchemy.orm import sessionmaker

from app.database.models import Base, GamePlayer
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
def db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _create_game_and_start_hand(client, db):
    """Helper: create a game with 3 players, assign seats, start a hand via POST /hands/start."""
    resp = client.post(
        '/games',
        json={'game_date': '2026-04-12', 'player_names': ['Alice', 'Bob', 'Charlie']},
    )
    assert resp.status_code == 201
    game_id = resp.json()['game_id']

    # Assign seats for deterministic SB/BB
    gps = (
        db.query(GamePlayer)
        .filter(GamePlayer.game_id == game_id)
        .order_by(GamePlayer.player_id)
        .all()
    )
    for i, gp in enumerate(gps, start=1):
        gp.seat_number = i
    db.commit()

    start_resp = client.post(f'/games/{game_id}/hands/start')
    assert start_resp.status_code == 201
    start_data = start_resp.json()
    # Verify start endpoint sets names (baseline)
    assert start_data['sb_player_name'] is not None
    assert start_data['bb_player_name'] is not None
    return game_id, start_data


class TestGetHandSbBb:
    """GET /games/{game_id}/hands/{hand_number} must return sb_player_name/bb_player_name."""

    def test_get_hand_returns_sb_bb_names(self, client, db):
        game_id, start_data = _create_game_and_start_hand(client, db)
        hand_number = start_data['hand_number']

        resp = client.get(f'/games/{game_id}/hands/{hand_number}')
        assert resp.status_code == 200
        data = resp.json()
        assert data['sb_player_name'] == start_data['sb_player_name']
        assert data['bb_player_name'] == start_data['bb_player_name']


class TestListHandsSbBb:
    """GET /games/{game_id}/hands must return sb_player_name/bb_player_name for each hand."""

    def test_list_hands_returns_sb_bb_names(self, client, db):
        game_id, start_data = _create_game_and_start_hand(client, db)

        resp = client.get(f'/games/{game_id}/hands')
        assert resp.status_code == 200
        hands = resp.json()
        assert len(hands) >= 1
        assert hands[0]['sb_player_name'] == start_data['sb_player_name']
        assert hands[0]['bb_player_name'] == start_data['bb_player_name']


class TestEditCommunityCardsSbBb:
    """PATCH /games/{game_id}/hands/{hand_number} must return sb_player_name/bb_player_name."""

    def test_edit_community_cards_returns_sb_bb_names(self, client, db):
        game_id, start_data = _create_game_and_start_hand(client, db)
        hand_number = start_data['hand_number']

        resp = client.patch(
            f'/games/{game_id}/hands/{hand_number}',
            json={
                'flop_1': '2H',
                'flop_2': '3D',
                'flop_3': '4S',
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data['sb_player_name'] == start_data['sb_player_name']
        assert data['bb_player_name'] == start_data['bb_player_name']


class TestRecordHandSbBb:
    """POST /games/{game_id}/hands (record_hand) returns HandResponse — sb/bb should be None (no SB/BB set)."""

    def test_record_hand_returns_sb_bb_fields(self, client):
        resp = client.post(
            '/games',
            json={'game_date': '2026-04-12', 'player_names': ['Alice', 'Bob']},
        )
        game_id = resp.json()['game_id']

        resp = client.post(
            f'/games/{game_id}/hands',
            json={
                'player_entries': [
                    {'player_name': 'Alice', 'card_1': 'AH', 'card_2': 'KH'},
                    {'player_name': 'Bob', 'card_1': '2D', 'card_2': '3C'},
                ],
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        # record_hand doesn't set SB/BB, so both should be None but the fields must exist
        assert 'sb_player_name' in data
        assert 'bb_player_name' in data


class TestRecordHandResultsSbBb:
    """PATCH /games/{game_id}/hands/{hand_number}/results must return sb_player_name/bb_player_name."""

    def test_record_hand_results_returns_sb_bb_names(self, client, db):
        game_id, start_data = _create_game_and_start_hand(client, db)
        hand_number = start_data['hand_number']

        resp = client.patch(
            f'/games/{game_id}/hands/{hand_number}/results',
            json=[
                {'player_name': 'Alice', 'result': 'won', 'profit_loss': 10.0},
                {'player_name': 'Bob', 'result': 'lost', 'profit_loss': -5.0},
                {'player_name': 'Charlie', 'result': 'folded', 'profit_loss': -5.0},
            ],
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data['sb_player_name'] == start_data['sb_player_name']
        assert data['bb_player_name'] == start_data['bb_player_name']
