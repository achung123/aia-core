"""Tests for T-029: Edit Player Hole Cards endpoint (PATCH /games/{game_id}/hands/{hand_number}/players/{player_name})."""

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
    """Create a game with one recorded hand; return (game_id, hand_number)."""
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
                {
                    'player_name': 'Bob',
                    'card_1': {'rank': '9', 'suit': 'H'},
                    'card_2': {'rank': '10', 'suit': 'H'},
                },
            ],
        },
    )
    assert hand_resp.status_code == 201
    return game_id, hand_resp.json()['hand_number']


class TestEditHoleCardsBasic:
    """AC-1: Updates card_1 and card_2 on the PlayerHand record."""

    def test_patch_returns_200(self, client, game_with_hand):
        game_id, hand_number = game_with_hand
        resp = client.patch(
            f'/games/{game_id}/hands/{hand_number}/players/Alice',
            json={
                'card_1': {'rank': 'Q', 'suit': 'C'},
                'card_2': {'rank': 'J', 'suit': 'D'},
            },
        )
        assert resp.status_code == 200

    def test_patch_updates_hole_cards(self, client, game_with_hand):
        game_id, hand_number = game_with_hand
        resp = client.patch(
            f'/games/{game_id}/hands/{hand_number}/players/Alice',
            json={
                'card_1': {'rank': 'Q', 'suit': 'C'},
                'card_2': {'rank': 'J', 'suit': 'D'},
            },
        )
        data = resp.json()
        assert data['card_1'] == 'QC'
        assert data['card_2'] == 'JD'

    def test_response_includes_player_info(self, client, game_with_hand):
        game_id, hand_number = game_with_hand
        resp = client.patch(
            f'/games/{game_id}/hands/{hand_number}/players/Alice',
            json={
                'card_1': {'rank': 'Q', 'suit': 'C'},
                'card_2': {'rank': 'J', 'suit': 'D'},
            },
        )
        data = resp.json()
        assert data['player_name'] == 'Alice'
        assert 'player_hand_id' in data
        assert 'hand_id' in data
        assert 'player_id' in data

    def test_patch_preserves_result_and_profit_loss(self, client, game_with_hand):
        """Card edit should not overwrite result or profit_loss fields."""
        game_id, hand_number = game_with_hand
        resp = client.patch(
            f'/games/{game_id}/hands/{hand_number}/players/Alice',
            json={
                'card_1': {'rank': 'Q', 'suit': 'C'},
                'card_2': {'rank': 'J', 'suit': 'D'},
            },
        )
        data = resp.json()
        # result and profit_loss were not set when recording the hand
        assert data['result'] is None
        assert data['profit_loss'] is None

    def test_patch_is_case_insensitive_for_player_name(self, client, game_with_hand):
        """Player name lookup should be case-insensitive."""
        game_id, hand_number = game_with_hand
        resp = client.patch(
            f'/games/{game_id}/hands/{hand_number}/players/alice',
            json={
                'card_1': {'rank': 'Q', 'suit': 'C'},
                'card_2': {'rank': 'J', 'suit': 'D'},
            },
        )
        assert resp.status_code == 200
        assert resp.json()['card_1'] == 'QC'

    def test_patch_only_updates_target_player(self, client, game_with_hand):
        """Editing Alice's cards should not affect Bob's hand entry."""
        game_id, hand_number = game_with_hand
        client.patch(
            f'/games/{game_id}/hands/{hand_number}/players/Alice',
            json={
                'card_1': {'rank': 'Q', 'suit': 'C'},
                'card_2': {'rank': 'J', 'suit': 'D'},
            },
        )
        hand_resp = client.get(f'/games/{game_id}/hands/{hand_number}')
        bob = next(
            ph for ph in hand_resp.json()['player_hands'] if ph['player_name'] == 'Bob'
        )
        assert bob['card_1'] == '9H'
        assert bob['card_2'] == '10H'


class TestEditHoleCardsDuplicateRejection:
    """AC-2: Rejects edits that introduce duplicates within the hand."""

    def test_duplicate_within_new_hole_cards_rejected(self, client, game_with_hand):
        """card_1 == card_2 for the same player should return 400."""
        game_id, hand_number = game_with_hand
        resp = client.patch(
            f'/games/{game_id}/hands/{hand_number}/players/Alice',
            json={
                'card_1': {'rank': 'Q', 'suit': 'C'},
                'card_2': {'rank': 'Q', 'suit': 'C'},  # duplicate
            },
        )
        assert resp.status_code == 400

    def test_hole_card_duplicate_of_community_card_rejected(
        self, client, game_with_hand
    ):
        """A new hole card that duplicates a community card should return 400."""
        game_id, hand_number = game_with_hand
        # Community cards: AS, KH, 2D
        resp = client.patch(
            f'/games/{game_id}/hands/{hand_number}/players/Alice',
            json={
                'card_1': {'rank': 'A', 'suit': 'S'},  # duplicates flop_1
                'card_2': {'rank': 'J', 'suit': 'D'},
            },
        )
        assert resp.status_code == 400

    def test_hole_card_duplicate_of_other_player_hole_card_rejected(
        self, client, game_with_hand
    ):
        """A new hole card that duplicates another player's hole card should return 400."""
        game_id, hand_number = game_with_hand
        # Bob has 9H and 10H
        resp = client.patch(
            f'/games/{game_id}/hands/{hand_number}/players/Alice',
            json={
                'card_1': {'rank': '9', 'suit': 'H'},  # duplicates Bob's card_1
                'card_2': {'rank': 'J', 'suit': 'D'},
            },
        )
        assert resp.status_code == 400

    def test_error_response_has_detail(self, client, game_with_hand):
        game_id, hand_number = game_with_hand
        resp = client.patch(
            f'/games/{game_id}/hands/{hand_number}/players/Alice',
            json={
                'card_1': {'rank': 'Q', 'suit': 'C'},
                'card_2': {'rank': 'Q', 'suit': 'C'},
            },
        )
        assert resp.status_code == 400
        assert 'detail' in resp.json()

    def test_valid_update_with_no_duplicates_succeeds(self, client, game_with_hand):
        game_id, hand_number = game_with_hand
        resp = client.patch(
            f'/games/{game_id}/hands/{hand_number}/players/Alice',
            json={
                'card_1': {'rank': 'Q', 'suit': 'C'},
                'card_2': {'rank': 'J', 'suit': 'D'},
            },
        )
        assert resp.status_code == 200


class TestEditHoleCardsPersistence:
    """Verify edits survive a subsequent GET."""

    def test_get_after_patch_returns_updated_cards(self, client, game_with_hand):
        game_id, hand_number = game_with_hand
        client.patch(
            f'/games/{game_id}/hands/{hand_number}/players/Alice',
            json={
                'card_1': {'rank': 'Q', 'suit': 'C'},
                'card_2': {'rank': 'J', 'suit': 'D'},
            },
        )
        get_resp = client.get(f'/games/{game_id}/hands/{hand_number}')
        assert get_resp.status_code == 200
        alice = next(
            ph for ph in get_resp.json()['player_hands'] if ph['player_name'] == 'Alice'
        )
        assert alice['card_1'] == 'QC'
        assert alice['card_2'] == 'JD'


class TestEditHoleCardsNotFound:
    """AC-3: 404 if player not found in that hand."""

    def test_unknown_game_returns_404(self, client):
        resp = client.patch(
            '/games/9999/hands/1/players/Alice',
            json={
                'card_1': {'rank': 'Q', 'suit': 'C'},
                'card_2': {'rank': 'J', 'suit': 'D'},
            },
        )
        assert resp.status_code == 404

    def test_unknown_hand_returns_404(self, client, game_with_hand):
        game_id, _ = game_with_hand
        resp = client.patch(
            f'/games/{game_id}/hands/9999/players/Alice',
            json={
                'card_1': {'rank': 'Q', 'suit': 'C'},
                'card_2': {'rank': 'J', 'suit': 'D'},
            },
        )
        assert resp.status_code == 404

    def test_unknown_player_returns_404(self, client, game_with_hand):
        game_id, hand_number = game_with_hand
        resp = client.patch(
            f'/games/{game_id}/hands/{hand_number}/players/Charlie',
            json={
                'card_1': {'rank': 'Q', 'suit': 'C'},
                'card_2': {'rank': 'J', 'suit': 'D'},
            },
        )
        assert resp.status_code == 404

    def test_player_not_in_hand_returns_404(self, client):
        """Player exists globally but is not part of this hand."""
        app.dependency_overrides[get_db] = override_get_db
        c = TestClient(app)

        # Create game with Alice and Bob
        game_resp = c.post(
            '/games',
            json={'game_date': '2026-03-11', 'player_names': ['Alice', 'Bob']},
        )
        game_id = game_resp.json()['game_id']

        # Create a second game with Charlie to ensure Charlie exists as a player
        c.post(
            '/games',
            json={'game_date': '2026-03-11', 'player_names': ['Charlie']},
        )

        # Record a hand for the first game without Charlie
        hand_resp = c.post(
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
        hand_number = hand_resp.json()['hand_number']

        # Try to edit Charlie's hole cards in a hand Charlie is not in
        resp = c.patch(
            f'/games/{game_id}/hands/{hand_number}/players/Charlie',
            json={
                'card_1': {'rank': 'Q', 'suit': 'C'},
                'card_2': {'rank': 'J', 'suit': 'D'},
            },
        )
        assert resp.status_code == 404
        app.dependency_overrides.clear()
