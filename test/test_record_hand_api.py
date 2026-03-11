"""Tests for T-018: Record New Hand endpoint (POST /games/{game_id}/hands)."""

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


HAND_PAYLOAD = {
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


class TestRecordHandBasic:
    """AC-1: Creates Hand and PlayerHand records with correct FKs."""

    def test_record_hand_returns_201(self, client, game_with_players):
        resp = client.post(f'/games/{game_with_players}/hands', json=HAND_PAYLOAD)
        assert resp.status_code == 201

    def test_record_hand_returns_hand_id(self, client, game_with_players):
        resp = client.post(f'/games/{game_with_players}/hands', json=HAND_PAYLOAD)
        data = resp.json()
        assert 'hand_id' in data
        assert isinstance(data['hand_id'], int)
        assert data['hand_id'] > 0

    def test_record_hand_returns_game_id(self, client, game_with_players):
        resp = client.post(f'/games/{game_with_players}/hands', json=HAND_PAYLOAD)
        data = resp.json()
        assert data['game_id'] == game_with_players

    def test_record_hand_returns_community_cards(self, client, game_with_players):
        resp = client.post(f'/games/{game_with_players}/hands', json=HAND_PAYLOAD)
        data = resp.json()
        assert data['flop_1'] == 'AS'
        assert data['flop_2'] == 'KH'
        assert data['flop_3'] == '2D'
        assert data['turn'] is None
        assert data['river'] is None

    def test_record_hand_with_turn_and_river(self, client, game_with_players):
        payload = {
            **HAND_PAYLOAD,
            'turn': {'rank': 'Q', 'suit': 'C'},
            'river': {'rank': 'J', 'suit': 'D'},
        }
        resp = client.post(f'/games/{game_with_players}/hands', json=payload)
        data = resp.json()
        assert data['turn'] == 'QC'
        assert data['river'] == 'JD'

    def test_record_hand_returns_player_hands(self, client, game_with_players):
        resp = client.post(f'/games/{game_with_players}/hands', json=HAND_PAYLOAD)
        data = resp.json()
        assert 'player_hands' in data
        assert len(data['player_hands']) == 2

    def test_record_hand_player_hands_have_correct_fields(
        self, client, game_with_players
    ):
        resp = client.post(f'/games/{game_with_players}/hands', json=HAND_PAYLOAD)
        player_hand = resp.json()['player_hands'][0]
        assert 'player_hand_id' in player_hand
        assert 'hand_id' in player_hand
        assert 'player_id' in player_hand
        assert 'player_name' in player_hand
        assert 'card_1' in player_hand
        assert 'card_2' in player_hand

    def test_record_hand_player_hand_cards_stored_as_strings(
        self, client, game_with_players
    ):
        resp = client.post(f'/games/{game_with_players}/hands', json=HAND_PAYLOAD)
        player_hands = {
            ph['player_name']: ph for ph in resp.json()['player_hands']
        }
        assert player_hands['Alice']['card_1'] == '7S'
        assert player_hands['Alice']['card_2'] == '8S'
        assert player_hands['Bob']['card_1'] == '9H'
        assert player_hands['Bob']['card_2'] == '10H'

    def test_record_hand_with_result_and_profit_loss(self, client, game_with_players):
        payload = {
            **HAND_PAYLOAD,
            'player_entries': [
                {
                    'player_name': 'Alice',
                    'card_1': {'rank': '7', 'suit': 'S'},
                    'card_2': {'rank': '8', 'suit': 'S'},
                    'result': 'win',
                    'profit_loss': 50.0,
                },
                {
                    'player_name': 'Bob',
                    'card_1': {'rank': '9', 'suit': 'H'},
                    'card_2': {'rank': '10', 'suit': 'H'},
                    'result': 'loss',
                    'profit_loss': -50.0,
                },
            ],
        }
        resp = client.post(f'/games/{game_with_players}/hands', json=payload)
        assert resp.status_code == 201
        player_hands = {
            ph['player_name']: ph for ph in resp.json()['player_hands']
        }
        assert player_hands['Alice']['result'] == 'win'
        assert player_hands['Alice']['profit_loss'] == 50.0
        assert player_hands['Bob']['result'] == 'loss'
        assert player_hands['Bob']['profit_loss'] == -50.0

    def test_record_hand_creates_db_records(self, client, game_with_players):
        """Hand and PlayerHand records are persisted to the database."""
        from app.database.models import Hand, PlayerHand

        resp = client.post(f'/games/{game_with_players}/hands', json=HAND_PAYLOAD)
        hand_id = resp.json()['hand_id']

        db = SessionLocal()
        try:
            hand = db.query(Hand).filter(Hand.hand_id == hand_id).first()
            assert hand is not None
            assert hand.game_id == game_with_players

            phs = (
                db.query(PlayerHand).filter(PlayerHand.hand_id == hand_id).all()
            )
            assert len(phs) == 2
        finally:
            db.close()


class TestHandNumberAutoIncrement:
    """AC-2: hand_number auto-increments (max existing + 1 for the game)."""

    def test_first_hand_number_is_1(self, client, game_with_players):
        resp = client.post(f'/games/{game_with_players}/hands', json=HAND_PAYLOAD)
        assert resp.json()['hand_number'] == 1

    def test_second_hand_number_is_2(self, client, game_with_players):
        client.post(f'/games/{game_with_players}/hands', json=HAND_PAYLOAD)

        payload2 = {
            **HAND_PAYLOAD,
            'flop_1': {'rank': '3', 'suit': 'C'},
            'flop_2': {'rank': '4', 'suit': 'C'},
            'flop_3': {'rank': '5', 'suit': 'C'},
        }
        resp = client.post(f'/games/{game_with_players}/hands', json=payload2)
        assert resp.json()['hand_number'] == 2

    def test_hand_numbers_are_per_game(self, client):
        """hand_number sequences are independent for each game."""
        game1 = client.post(
            '/games',
            json={'game_date': '2026-03-11', 'player_names': ['Alice', 'Bob']},
        ).json()['game_id']
        game2 = client.post(
            '/games',
            json={'game_date': '2026-03-12', 'player_names': ['Alice', 'Bob']},
        ).json()['game_id']

        r1 = client.post(f'/games/{game1}/hands', json=HAND_PAYLOAD)
        r2 = client.post(f'/games/{game2}/hands', json=HAND_PAYLOAD)
        assert r1.json()['hand_number'] == 1
        assert r2.json()['hand_number'] == 1


class TestRecordHandValidation:
    """Error handling and validation cases."""

    def test_record_hand_invalid_game_returns_404(self, client):
        resp = client.post('/games/99999/hands', json=HAND_PAYLOAD)
        assert resp.status_code == 404

    def test_record_hand_invalid_game_error_message(self, client):
        resp = client.post('/games/99999/hands', json=HAND_PAYLOAD)
        assert 'not found' in resp.json()['detail'].lower()

    def test_record_hand_unknown_player_returns_404(self, client, game_with_players):
        payload = {
            **HAND_PAYLOAD,
            'player_entries': [
                {
                    'player_name': 'NonExistentPlayer',
                    'card_1': {'rank': '7', 'suit': 'S'},
                    'card_2': {'rank': '8', 'suit': 'S'},
                },
            ],
        }
        resp = client.post(f'/games/{game_with_players}/hands', json=payload)
        assert resp.status_code == 404

    def test_record_hand_player_not_in_game_returns_400(self, client, game_with_players):
        """A player that exists in the DB but is not in this game gets 400."""
        # Create a player not in the game
        client.post('/players', json={'name': 'Charlie'})

        payload = {
            **HAND_PAYLOAD,
            'player_entries': [
                {
                    'player_name': 'Charlie',
                    'card_1': {'rank': '7', 'suit': 'S'},
                    'card_2': {'rank': '8', 'suit': 'S'},
                },
            ],
        }
        resp = client.post(f'/games/{game_with_players}/hands', json=payload)
        assert resp.status_code == 400

    def test_record_hand_empty_player_entries_returns_422(
        self, client, game_with_players
    ):
        payload = {**HAND_PAYLOAD, 'player_entries': []}
        resp = client.post(f'/games/{game_with_players}/hands', json=payload)
        assert resp.status_code == 422


class TestDuplicateCardValidation:
    """AC-3: Duplicate cards within a single hand are rejected."""

    def test_duplicate_community_cards_returns_400(self, client, game_with_players):
        """flop_1 == flop_2 should be rejected with 400."""
        payload = {
            **HAND_PAYLOAD,
            'flop_1': {'rank': 'A', 'suit': 'S'},
            'flop_2': {'rank': 'A', 'suit': 'S'},  # duplicate of flop_1
            'flop_3': {'rank': '2', 'suit': 'D'},
        }
        resp = client.post(f'/games/{game_with_players}/hands', json=payload)
        assert resp.status_code == 400

    def test_duplicate_player_hole_cards_returns_400(self, client, game_with_players):
        """Alice and Bob both holding AS should be rejected with 400."""
        payload = {
            **HAND_PAYLOAD,
            'player_entries': [
                {
                    'player_name': 'Alice',
                    'card_1': {'rank': 'A', 'suit': 'S'},
                    'card_2': {'rank': 'K', 'suit': 'H'},
                },
                {
                    'player_name': 'Bob',
                    'card_1': {'rank': 'A', 'suit': 'S'},  # duplicate of Alice's card_1
                    'card_2': {'rank': '2', 'suit': 'D'},
                },
            ],
        }
        resp = client.post(f'/games/{game_with_players}/hands', json=payload)
        assert resp.status_code == 400

    def test_player_hole_card_duplicates_community_card_returns_400(
        self, client, game_with_players
    ):
        """A player holding a community card should be rejected with 400."""
        payload = {
            'flop_1': {'rank': 'A', 'suit': 'S'},
            'flop_2': {'rank': 'K', 'suit': 'H'},
            'flop_3': {'rank': '2', 'suit': 'D'},
            'player_entries': [
                {
                    'player_name': 'Alice',
                    'card_1': {'rank': 'A', 'suit': 'S'},  # duplicate of flop_1
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
        assert resp.status_code == 400

    def test_duplicate_error_message_mentions_duplicate(
        self, client, game_with_players
    ):
        """Error response should contain a meaningful message."""
        payload = {
            **HAND_PAYLOAD,
            'flop_1': {'rank': 'A', 'suit': 'S'},
            'flop_2': {'rank': 'A', 'suit': 'S'},
            'flop_3': {'rank': '2', 'suit': 'D'},
        }
        resp = client.post(f'/games/{game_with_players}/hands', json=payload)
        assert 'duplicate' in resp.json()['detail'].lower()

    def test_no_duplicate_cards_accepted(self, client, game_with_players):
        """A hand with all unique cards (including turn/river) succeeds."""
        payload = {
            'flop_1': {'rank': 'A', 'suit': 'S'},
            'flop_2': {'rank': 'K', 'suit': 'H'},
            'flop_3': {'rank': '2', 'suit': 'D'},
            'turn': {'rank': 'Q', 'suit': 'C'},
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
        resp = client.post(f'/games/{game_with_players}/hands', json=payload)
        assert resp.status_code == 201
