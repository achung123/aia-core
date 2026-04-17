"""Tests for aia-core-5wiv: Start-all hand endpoint with SB/BB rotation."""

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


def _create_game(client, player_names):
    """Create a game and assign seat numbers to all players."""
    resp = client.post(
        '/games',
        json={'game_date': '2026-04-12', 'player_names': player_names},
    )
    assert resp.status_code == 201
    game_id = resp.json()['game_id']
    return game_id


def _assign_seats(db, game_id):
    """Assign sequential seat numbers to all game players (for deterministic ordering)."""
    gps = (
        db.query(GamePlayer)
        .filter(GamePlayer.game_id == game_id)
        .order_by(GamePlayer.player_id)
        .all()
    )
    for i, gp in enumerate(gps, start=1):
        gp.seat_number = i
    db.commit()


class TestStartHandCreation:
    """AC-1: Creates hand with next hand_number, creates PlayerHand for each active GamePlayer."""

    def test_returns_201(self, client, db):
        game_id = _create_game(client, ['Alice', 'Bob', 'Charlie'])
        _assign_seats(db, game_id)
        resp = client.post(f'/games/{game_id}/hands/start')
        assert resp.status_code == 201

    def test_creates_hand_number_1(self, client, db):
        game_id = _create_game(client, ['Alice', 'Bob', 'Charlie'])
        _assign_seats(db, game_id)
        resp = client.post(f'/games/{game_id}/hands/start')
        assert resp.json()['hand_number'] == 1

    def test_creates_player_hands_for_all_active(self, client, db):
        game_id = _create_game(client, ['Alice', 'Bob', 'Charlie'])
        _assign_seats(db, game_id)
        resp = client.post(f'/games/{game_id}/hands/start')
        data = resp.json()
        assert len(data['player_hands']) == 3
        names = {ph['player_name'] for ph in data['player_hands']}
        assert names == {'Alice', 'Bob', 'Charlie'}

    def test_increments_hand_number(self, client, db):
        game_id = _create_game(client, ['Alice', 'Bob', 'Charlie'])
        _assign_seats(db, game_id)
        resp1 = client.post(f'/games/{game_id}/hands/start')
        assert resp1.json()['hand_number'] == 1
        resp2 = client.post(f'/games/{game_id}/hands/start')
        assert resp2.json()['hand_number'] == 2
        resp3 = client.post(f'/games/{game_id}/hands/start')
        assert resp3.json()['hand_number'] == 3

    def test_player_hands_have_null_cards(self, client, db):
        game_id = _create_game(client, ['Alice', 'Bob'])
        _assign_seats(db, game_id)
        resp = client.post(f'/games/{game_id}/hands/start')
        for ph in resp.json()['player_hands']:
            assert ph['card_1'] is None
            assert ph['card_2'] is None


class TestStartHandSBBBFirstHand:
    """AC-2: SB/BB assigned — first hand uses first two active players by seat."""

    def test_first_hand_sb_is_first_by_seat(self, client, db):
        game_id = _create_game(client, ['Alice', 'Bob', 'Charlie'])
        _assign_seats(db, game_id)
        resp = client.post(f'/games/{game_id}/hands/start')
        data = resp.json()
        assert data['sb_player_name'] == 'Alice'

    def test_first_hand_bb_is_second_by_seat(self, client, db):
        game_id = _create_game(client, ['Alice', 'Bob', 'Charlie'])
        _assign_seats(db, game_id)
        resp = client.post(f'/games/{game_id}/hands/start')
        data = resp.json()
        assert data['bb_player_name'] == 'Bob'


class TestStartHandSBBBRotation:
    """AC-2: SB/BB rotate through active players on subsequent hands."""

    def test_second_hand_sb_advances(self, client, db):
        game_id = _create_game(client, ['Alice', 'Bob', 'Charlie'])
        _assign_seats(db, game_id)
        client.post(f'/games/{game_id}/hands/start')
        resp = client.post(f'/games/{game_id}/hands/start')
        data = resp.json()
        assert data['sb_player_name'] == 'Bob'
        assert data['bb_player_name'] == 'Charlie'

    def test_third_hand_sb_advances_again(self, client, db):
        game_id = _create_game(client, ['Alice', 'Bob', 'Charlie'])
        _assign_seats(db, game_id)
        client.post(f'/games/{game_id}/hands/start')
        client.post(f'/games/{game_id}/hands/start')
        resp = client.post(f'/games/{game_id}/hands/start')
        data = resp.json()
        assert data['sb_player_name'] == 'Charlie'
        assert data['bb_player_name'] == 'Alice'

    def test_rotation_wraps_around(self, client, db):
        game_id = _create_game(client, ['Alice', 'Bob', 'Charlie'])
        _assign_seats(db, game_id)
        # Hands 1-3
        for _ in range(3):
            client.post(f'/games/{game_id}/hands/start')
        # Hand 4 should wrap back
        resp = client.post(f'/games/{game_id}/hands/start')
        data = resp.json()
        assert data['sb_player_name'] == 'Alice'
        assert data['bb_player_name'] == 'Bob'

    def test_heads_up_rotation(self, client, db):
        game_id = _create_game(client, ['Alice', 'Bob'])
        _assign_seats(db, game_id)
        resp1 = client.post(f'/games/{game_id}/hands/start')
        assert resp1.json()['sb_player_name'] == 'Alice'
        assert resp1.json()['bb_player_name'] == 'Bob'
        resp2 = client.post(f'/games/{game_id}/hands/start')
        assert resp2.json()['sb_player_name'] == 'Bob'
        assert resp2.json()['bb_player_name'] == 'Alice'
        resp3 = client.post(f'/games/{game_id}/hands/start')
        assert resp3.json()['sb_player_name'] == 'Alice'
        assert resp3.json()['bb_player_name'] == 'Bob'


class TestStartHandInactivePlayers:
    """AC-2/4: Inactive players excluded from hand and rotation."""

    def test_inactive_player_excluded_from_player_hands(self, client, db):
        game_id = _create_game(client, ['Alice', 'Bob', 'Charlie', 'Dave'])
        _assign_seats(db, game_id)
        client.patch(
            f'/games/{game_id}/players/Charlie/status',
            json={'is_active': False},
        )
        resp = client.post(f'/games/{game_id}/hands/start')
        data = resp.json()
        names = {ph['player_name'] for ph in data['player_hands']}
        assert 'Charlie' not in names
        assert len(data['player_hands']) == 3

    def test_inactive_player_skipped_in_rotation(self, client, db):
        game_id = _create_game(client, ['Alice', 'Bob', 'Charlie', 'Dave'])
        _assign_seats(db, game_id)
        # Hand 1: SB=Alice, BB=Bob (all active)
        resp1 = client.post(f'/games/{game_id}/hands/start')
        assert resp1.json()['sb_player_name'] == 'Alice'
        assert resp1.json()['bb_player_name'] == 'Bob'
        # Make Bob inactive before hand 2
        client.patch(
            f'/games/{game_id}/players/Bob/status',
            json={'is_active': False},
        )
        # Hand 2: SB was Alice (prev), rotate forward.
        # Active sorted: Alice(1), Charlie(3), Dave(4)
        # Prev SB was Alice at idx 0, so new SB = idx 1 = Charlie
        resp2 = client.post(f'/games/{game_id}/hands/start')
        assert resp2.json()['sb_player_name'] == 'Charlie'
        assert resp2.json()['bb_player_name'] == 'Dave'

    def test_prev_sb_became_inactive_rotation_continues(self, client, db):
        """When prev SB is no longer active, rotation finds next by seat."""
        game_id = _create_game(client, ['Alice', 'Bob', 'Charlie', 'Dave'])
        _assign_seats(db, game_id)
        # Hand 1: SB=Alice, BB=Bob
        client.post(f'/games/{game_id}/hands/start')
        # Make Alice (prev SB) inactive
        client.patch(
            f'/games/{game_id}/players/Alice/status',
            json={'is_active': False},
        )
        # Hand 2: Prev SB was Alice (seat 1, now inactive).
        # Active sorted: Bob(2), Charlie(3), Dave(4)
        # Advance from Alice's seat → next active is Bob, so SB=Bob, BB=Charlie
        resp2 = client.post(f'/games/{game_id}/hands/start')
        assert resp2.json()['sb_player_name'] == 'Bob'
        assert resp2.json()['bb_player_name'] == 'Charlie'


class TestStartHandResponse:
    """AC-3: Response is HandResponse with sb_player_name, bb_player_name, and all player entries."""

    def test_response_has_sb_player_name(self, client, db):
        game_id = _create_game(client, ['Alice', 'Bob'])
        _assign_seats(db, game_id)
        resp = client.post(f'/games/{game_id}/hands/start')
        assert 'sb_player_name' in resp.json()
        assert resp.json()['sb_player_name'] is not None

    def test_response_has_bb_player_name(self, client, db):
        game_id = _create_game(client, ['Alice', 'Bob'])
        _assign_seats(db, game_id)
        resp = client.post(f'/games/{game_id}/hands/start')
        assert 'bb_player_name' in resp.json()
        assert resp.json()['bb_player_name'] is not None

    def test_response_has_hand_fields(self, client, db):
        game_id = _create_game(client, ['Alice', 'Bob'])
        _assign_seats(db, game_id)
        resp = client.post(f'/games/{game_id}/hands/start')
        data = resp.json()
        assert 'hand_id' in data
        assert 'game_id' in data
        assert 'hand_number' in data
        assert 'player_hands' in data
        assert 'created_at' in data

    def test_response_community_cards_null(self, client, db):
        game_id = _create_game(client, ['Alice', 'Bob'])
        _assign_seats(db, game_id)
        resp = client.post(f'/games/{game_id}/hands/start')
        data = resp.json()
        assert data['flop_1'] is None
        assert data['flop_2'] is None
        assert data['flop_3'] is None
        assert data['turn'] is None
        assert data['river'] is None


class TestStartHandErrorCases:
    """AC-4: Returns 400 if < 2 active players; 404 if game not found."""

    def test_game_not_found_returns_404(self, client):
        resp = client.post('/games/999/hands/start')
        assert resp.status_code == 404

    def test_one_active_player_returns_400(self, client, db):
        game_id = _create_game(client, ['Alice', 'Bob'])
        _assign_seats(db, game_id)
        client.patch(
            f'/games/{game_id}/players/Bob/status',
            json={'is_active': False},
        )
        resp = client.post(f'/games/{game_id}/hands/start')
        assert resp.status_code == 400

    def test_zero_active_players_returns_400(self, client, db):
        game_id = _create_game(client, ['Alice', 'Bob'])
        _assign_seats(db, game_id)
        client.patch(
            f'/games/{game_id}/players/Alice/status',
            json={'is_active': False},
        )
        client.patch(
            f'/games/{game_id}/players/Bob/status',
            json={'is_active': False},
        )
        resp = client.post(f'/games/{game_id}/hands/start')
        assert resp.status_code == 400

    def test_error_message_for_too_few_players(self, client, db):
        game_id = _create_game(client, ['Alice', 'Bob'])
        _assign_seats(db, game_id)
        client.patch(
            f'/games/{game_id}/players/Bob/status',
            json={'is_active': False},
        )
        resp = client.post(f'/games/{game_id}/hands/start')
        assert 'active players' in resp.json()['detail'].lower()


class TestStartHandWithNullSeatNumbers:
    """Edge case: players without seat_number should still be ordered deterministically."""

    def test_null_seats_fallback_to_player_id_order(self, client):
        """Players from create_game have null seat_number; should use player_id order."""
        game_id = _create_game(client, ['Alice', 'Bob', 'Charlie'])
        # Don't assign seats — they'll be null
        resp = client.post(f'/games/{game_id}/hands/start')
        assert resp.status_code == 201
        data = resp.json()
        # Should still assign SB/BB based on deterministic order
        assert data['sb_player_name'] is not None
        assert data['bb_player_name'] is not None
        assert data['sb_player_name'] != data['bb_player_name']
