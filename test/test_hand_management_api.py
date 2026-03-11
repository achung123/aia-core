"""Tests for T-023: Hand Management endpoints — edge cases and integration.

Covers gaps not addressed by individual endpoint test files:
- Hand with turn but no river
- Duplicate card validation for turn/river
- Case-insensitive player lookups
- Result update edge cases (idempotency, player not in hand)
- Cross-endpoint integration (results reflected in get/list)
- Single-player hand
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import StaticPool, create_engine
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
    """Create a game session with Alice and Bob; return the game_id."""
    resp = client.post(
        '/games',
        json={'game_date': '2026-03-11', 'player_names': ['Alice', 'Bob']},
    )
    assert resp.status_code == 201
    return resp.json()['game_id']


# ── Payloads ────────────────────────────────────────────────────────────────


FLOP_ONLY_PAYLOAD = {
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

TURN_ONLY_PAYLOAD = {
    'flop_1': {'rank': 'A', 'suit': 'S'},
    'flop_2': {'rank': 'K', 'suit': 'H'},
    'flop_3': {'rank': '2', 'suit': 'D'},
    'turn': {'rank': 'Q', 'suit': 'C'},
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

FULL_BOARD_PAYLOAD = {
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


# ── Edge cases: Turn without river ──────────────────────────────────────────


class TestHandWithTurnNoRiver:
    """Edge case: hand recorded with turn but no river."""

    def test_create_hand_with_turn_no_river_returns_201(
        self, client, game_with_players
    ):
        resp = client.post(f'/games/{game_with_players}/hands', json=TURN_ONLY_PAYLOAD)
        assert resp.status_code == 201

    def test_create_hand_with_turn_no_river_stores_turn(
        self, client, game_with_players
    ):
        resp = client.post(f'/games/{game_with_players}/hands', json=TURN_ONLY_PAYLOAD)
        data = resp.json()
        assert data['turn'] == 'QC'
        assert data['river'] is None

    def test_get_hand_with_turn_no_river(self, client, game_with_players):
        resp = client.post(f'/games/{game_with_players}/hands', json=TURN_ONLY_PAYLOAD)
        hand_number = resp.json()['hand_number']
        get_resp = client.get(f'/games/{game_with_players}/hands/{hand_number}')
        assert get_resp.status_code == 200
        data = get_resp.json()
        assert data['turn'] == 'QC'
        assert data['river'] is None

    def test_list_hands_with_turn_no_river(self, client, game_with_players):
        client.post(f'/games/{game_with_players}/hands', json=TURN_ONLY_PAYLOAD)
        resp = client.get(f'/games/{game_with_players}/hands')
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]['turn'] == 'QC'
        assert data[0]['river'] is None


# ── Duplicate card validation: turn/river ────────────────────────────────────


class TestDuplicateCardsTurnRiver:
    """Duplicate card validation for turn and river cards."""

    def test_turn_duplicates_flop_returns_400(self, client, game_with_players):
        payload = {
            **FLOP_ONLY_PAYLOAD,
            'turn': {'rank': 'A', 'suit': 'S'},  # same as flop_1
        }
        resp = client.post(f'/games/{game_with_players}/hands', json=payload)
        assert resp.status_code == 400

    def test_river_duplicates_flop_returns_400(self, client, game_with_players):
        payload = {
            **FLOP_ONLY_PAYLOAD,
            'turn': {'rank': 'Q', 'suit': 'C'},
            'river': {'rank': 'K', 'suit': 'H'},  # same as flop_2
        }
        resp = client.post(f'/games/{game_with_players}/hands', json=payload)
        assert resp.status_code == 400

    def test_river_duplicates_turn_returns_400(self, client, game_with_players):
        payload = {
            **FLOP_ONLY_PAYLOAD,
            'turn': {'rank': 'Q', 'suit': 'C'},
            'river': {'rank': 'Q', 'suit': 'C'},  # same as turn
        }
        resp = client.post(f'/games/{game_with_players}/hands', json=payload)
        assert resp.status_code == 400

    def test_turn_duplicates_hole_card_returns_400(self, client, game_with_players):
        payload = {
            **FLOP_ONLY_PAYLOAD,
            'turn': {'rank': '7', 'suit': 'S'},  # same as Alice's card_1
        }
        resp = client.post(f'/games/{game_with_players}/hands', json=payload)
        assert resp.status_code == 400

    def test_river_duplicates_hole_card_returns_400(self, client, game_with_players):
        payload = {
            **FLOP_ONLY_PAYLOAD,
            'turn': {'rank': 'Q', 'suit': 'C'},
            'river': {'rank': '9', 'suit': 'H'},  # same as Bob's card_1
        }
        resp = client.post(f'/games/{game_with_players}/hands', json=payload)
        assert resp.status_code == 400

    def test_duplicate_turn_error_mentions_duplicate(self, client, game_with_players):
        payload = {
            **FLOP_ONLY_PAYLOAD,
            'turn': {'rank': 'A', 'suit': 'S'},  # same as flop_1
        }
        resp = client.post(f'/games/{game_with_players}/hands', json=payload)
        assert 'duplicate' in resp.json()['detail'].lower()


# ── Case-insensitive player lookup ──────────────────────────────────────────


class TestCaseInsensitivePlayerLookup:
    """Player name lookups are case-insensitive across endpoints."""

    def test_record_hand_case_insensitive_player_name(self, client, game_with_players):
        payload = {
            'flop_1': {'rank': 'A', 'suit': 'S'},
            'flop_2': {'rank': 'K', 'suit': 'H'},
            'flop_3': {'rank': '2', 'suit': 'D'},
            'player_entries': [
                {
                    'player_name': 'alice',  # lowercase
                    'card_1': {'rank': '7', 'suit': 'S'},
                    'card_2': {'rank': '8', 'suit': 'S'},
                },
                {
                    'player_name': 'BOB',  # uppercase
                    'card_1': {'rank': '9', 'suit': 'H'},
                    'card_2': {'rank': '10', 'suit': 'H'},
                },
            ],
        }
        resp = client.post(f'/games/{game_with_players}/hands', json=payload)
        assert resp.status_code == 201

    def test_record_results_case_insensitive_player_name(
        self, client, game_with_players
    ):
        client.post(f'/games/{game_with_players}/hands', json=FLOP_ONLY_PAYLOAD)
        resp = client.patch(
            f'/games/{game_with_players}/hands/1/results',
            json=[{'player_name': 'alice', 'result': 'win', 'profit_loss': 25.0}],
        )
        assert resp.status_code == 200
        alice = next(
            ph for ph in resp.json()['player_hands'] if ph['player_name'] == 'Alice'
        )
        assert alice['result'] == 'win'


# ── Single-player hand ─────────────────────────────────────────────────────


class TestSinglePlayerHand:
    """Edge case: hand with only one player."""

    def test_create_single_player_hand(self, client, game_with_players):
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
            ],
        }
        resp = client.post(f'/games/{game_with_players}/hands', json=payload)
        assert resp.status_code == 201
        assert len(resp.json()['player_hands']) == 1

    def test_get_single_player_hand(self, client, game_with_players):
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
            ],
        }
        client.post(f'/games/{game_with_players}/hands', json=payload)
        resp = client.get(f'/games/{game_with_players}/hands/1')
        assert resp.status_code == 200
        assert len(resp.json()['player_hands']) == 1


# ── Result update edge cases ────────────────────────────────────────────────


class TestRecordHandResultEdgeCases:
    """Edge cases for PATCH results endpoint."""

    def test_update_results_twice_idempotent(self, client, game_with_players):
        """Updating the same player's result twice should overwrite."""
        client.post(f'/games/{game_with_players}/hands', json=FLOP_ONLY_PAYLOAD)

        # First update
        client.patch(
            f'/games/{game_with_players}/hands/1/results',
            json=[{'player_name': 'Alice', 'result': 'win', 'profit_loss': 50.0}],
        )
        # Second update with different values
        resp = client.patch(
            f'/games/{game_with_players}/hands/1/results',
            json=[{'player_name': 'Alice', 'result': 'loss', 'profit_loss': -20.0}],
        )
        assert resp.status_code == 200
        alice = next(
            ph for ph in resp.json()['player_hands'] if ph['player_name'] == 'Alice'
        )
        assert alice['result'] == 'loss'
        assert alice['profit_loss'] == -20.0

    def test_update_result_zero_profit_loss(self, client, game_with_players):
        """A result with zero profit_loss is valid (e.g. split pot)."""
        client.post(f'/games/{game_with_players}/hands', json=FLOP_ONLY_PAYLOAD)
        resp = client.patch(
            f'/games/{game_with_players}/hands/1/results',
            json=[{'player_name': 'Alice', 'result': 'win', 'profit_loss': 0.0}],
        )
        assert resp.status_code == 200
        alice = next(
            ph for ph in resp.json()['player_hands'] if ph['player_name'] == 'Alice'
        )
        assert alice['profit_loss'] == 0.0

    def test_update_result_player_not_in_hand_returns_404(
        self, client, game_with_players
    ):
        """Player exists in game but wasn't dealt into this hand."""
        # Record hand with only Alice
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
            ],
        }
        client.post(f'/games/{game_with_players}/hands', json=payload)

        # Try to update Bob's result — he's in the game but not in this hand
        resp = client.patch(
            f'/games/{game_with_players}/hands/1/results',
            json=[{'player_name': 'Bob', 'result': 'win', 'profit_loss': 50.0}],
        )
        assert resp.status_code == 404

    def test_update_result_preserves_cards(self, client, game_with_players):
        """PATCH results should not alter community or hole cards."""
        client.post(f'/games/{game_with_players}/hands', json=FULL_BOARD_PAYLOAD)
        resp = client.patch(
            f'/games/{game_with_players}/hands/1/results',
            json=[
                {'player_name': 'Alice', 'result': 'win', 'profit_loss': 100.0},
                {'player_name': 'Bob', 'result': 'loss', 'profit_loss': -100.0},
            ],
        )
        body = resp.json()
        assert body['flop_1'] == 'AS'
        assert body['flop_2'] == 'KH'
        assert body['flop_3'] == '2D'
        assert body['turn'] == 'QC'
        assert body['river'] == 'JD'
        alice = next(ph for ph in body['player_hands'] if ph['player_name'] == 'Alice')
        assert alice['card_1'] == '7S'
        assert alice['card_2'] == '8S'


# ── Cross-endpoint integration ──────────────────────────────────────────────


class TestHandManagementIntegration:
    """Integration tests: data flows correctly across hand endpoints."""

    def test_results_visible_in_get_hand(self, client, game_with_players):
        """After PATCH results, GET hand reflects the updated results."""
        client.post(f'/games/{game_with_players}/hands', json=FLOP_ONLY_PAYLOAD)
        client.patch(
            f'/games/{game_with_players}/hands/1/results',
            json=[
                {'player_name': 'Alice', 'result': 'win', 'profit_loss': 75.0},
                {'player_name': 'Bob', 'result': 'loss', 'profit_loss': -75.0},
            ],
        )
        resp = client.get(f'/games/{game_with_players}/hands/1')
        assert resp.status_code == 200
        players = {ph['player_name']: ph for ph in resp.json()['player_hands']}
        assert players['Alice']['result'] == 'win'
        assert players['Alice']['profit_loss'] == 75.0
        assert players['Bob']['result'] == 'loss'
        assert players['Bob']['profit_loss'] == -75.0

    def test_results_visible_in_list_hands(self, client, game_with_players):
        """After PATCH results, GET hands list reflects the updated results."""
        client.post(f'/games/{game_with_players}/hands', json=FLOP_ONLY_PAYLOAD)
        client.patch(
            f'/games/{game_with_players}/hands/1/results',
            json=[
                {'player_name': 'Alice', 'result': 'win', 'profit_loss': 75.0},
            ],
        )
        resp = client.get(f'/games/{game_with_players}/hands')
        assert resp.status_code == 200
        hand = resp.json()[0]
        alice = next(ph for ph in hand['player_hands'] if ph['player_name'] == 'Alice')
        assert alice['result'] == 'win'
        assert alice['profit_loss'] == 75.0

    def test_multiple_hands_independent_numbering(self, client, game_with_players):
        """Hands numbering increments; each hand is independent."""
        resp1 = client.post(f'/games/{game_with_players}/hands', json=FLOP_ONLY_PAYLOAD)
        # Second hand with different cards
        payload2 = {
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
        resp2 = client.post(f'/games/{game_with_players}/hands', json=payload2)

        assert resp1.json()['hand_number'] == 1
        assert resp2.json()['hand_number'] == 2

        # Updating results on hand 1 doesn't affect hand 2
        client.patch(
            f'/games/{game_with_players}/hands/1/results',
            json=[{'player_name': 'Alice', 'result': 'win', 'profit_loss': 50.0}],
        )
        hand2 = client.get(f'/games/{game_with_players}/hands/2').json()
        alice_h2 = next(
            ph for ph in hand2['player_hands'] if ph['player_name'] == 'Alice'
        )
        assert alice_h2['result'] is None
        assert alice_h2['profit_loss'] is None

    def test_full_hand_lifecycle(self, client, game_with_players):
        """Create hand → get hand → record results → list hands."""
        # Create
        create_resp = client.post(
            f'/games/{game_with_players}/hands', json=FULL_BOARD_PAYLOAD
        )
        assert create_resp.status_code == 201
        hand_number = create_resp.json()['hand_number']

        # Get
        get_resp = client.get(f'/games/{game_with_players}/hands/{hand_number}')
        assert get_resp.status_code == 200
        assert get_resp.json()['hand_number'] == hand_number

        # Record results
        result_resp = client.patch(
            f'/games/{game_with_players}/hands/{hand_number}/results',
            json=[
                {'player_name': 'Alice', 'result': 'win', 'profit_loss': 100.0},
                {'player_name': 'Bob', 'result': 'loss', 'profit_loss': -100.0},
            ],
        )
        assert result_resp.status_code == 200

        # List and verify
        list_resp = client.get(f'/games/{game_with_players}/hands')
        assert list_resp.status_code == 200
        hands = list_resp.json()
        assert len(hands) == 1
        players = {ph['player_name']: ph for ph in hands[0]['player_hands']}
        assert players['Alice']['result'] == 'win'
        assert players['Bob']['result'] == 'loss'

    def test_hand_cards_reusable_across_hands(self, client, game_with_players):
        """The same cards can appear in different hands (validation is per-hand)."""
        client.post(f'/games/{game_with_players}/hands', json=FLOP_ONLY_PAYLOAD)
        # Same cards in a second hand is OK — duplicate validation is within a hand
        resp = client.post(f'/games/{game_with_players}/hands', json=FLOP_ONLY_PAYLOAD)
        assert resp.status_code == 201
