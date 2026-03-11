"""Tests for T-028: Edit Community Cards endpoint (PATCH /games/{game_id}/hands/{hand_number})."""

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


class TestEditCommunityCardsBasic:
    """AC-1: Updates community card columns on the Hand record."""

    def test_patch_returns_200(self, client, game_with_hand):
        game_id, hand_number = game_with_hand
        resp = client.patch(
            f'/games/{game_id}/hands/{hand_number}',
            json={
                'flop_1': {'rank': 'Q', 'suit': 'C'},
                'flop_2': {'rank': 'J', 'suit': 'D'},
                'flop_3': {'rank': '3', 'suit': 'H'},
            },
        )
        assert resp.status_code == 200

    def test_patch_updates_flop_cards(self, client, game_with_hand):
        game_id, hand_number = game_with_hand
        resp = client.patch(
            f'/games/{game_id}/hands/{hand_number}',
            json={
                'flop_1': {'rank': 'Q', 'suit': 'C'},
                'flop_2': {'rank': 'J', 'suit': 'D'},
                'flop_3': {'rank': '3', 'suit': 'H'},
            },
        )
        data = resp.json()
        assert data['flop_1'] == 'QC'
        assert data['flop_2'] == 'JD'
        assert data['flop_3'] == '3H'

    def test_patch_can_add_turn(self, client, game_with_hand):
        game_id, hand_number = game_with_hand
        resp = client.patch(
            f'/games/{game_id}/hands/{hand_number}',
            json={
                'flop_1': {'rank': 'A', 'suit': 'S'},
                'flop_2': {'rank': 'K', 'suit': 'H'},
                'flop_3': {'rank': '2', 'suit': 'D'},
                'turn': {'rank': '5', 'suit': 'C'},
            },
        )
        data = resp.json()
        assert data['turn'] == '5C'
        assert data['river'] is None

    def test_patch_can_add_turn_and_river(self, client, game_with_hand):
        game_id, hand_number = game_with_hand
        resp = client.patch(
            f'/games/{game_id}/hands/{hand_number}',
            json={
                'flop_1': {'rank': 'A', 'suit': 'S'},
                'flop_2': {'rank': 'K', 'suit': 'H'},
                'flop_3': {'rank': '2', 'suit': 'D'},
                'turn': {'rank': '5', 'suit': 'C'},
                'river': {'rank': '6', 'suit': 'D'},
            },
        )
        data = resp.json()
        assert data['turn'] == '5C'
        assert data['river'] == '6D'

    def test_patch_clears_turn_when_omitted(self, client, game_with_hand):
        """Omitting turn/river sets them to None on the updated hand."""
        game_id, hand_number = game_with_hand
        # First add a turn
        client.patch(
            f'/games/{game_id}/hands/{hand_number}',
            json={
                'flop_1': {'rank': 'A', 'suit': 'S'},
                'flop_2': {'rank': 'K', 'suit': 'H'},
                'flop_3': {'rank': '2', 'suit': 'D'},
                'turn': {'rank': '5', 'suit': 'C'},
            },
        )
        # Now remove it
        resp = client.patch(
            f'/games/{game_id}/hands/{hand_number}',
            json={
                'flop_1': {'rank': 'A', 'suit': 'S'},
                'flop_2': {'rank': 'K', 'suit': 'H'},
                'flop_3': {'rank': '2', 'suit': 'D'},
            },
        )
        data = resp.json()
        assert data['turn'] is None
        assert data['river'] is None

    def test_patch_preserves_hand_id_and_game_id(self, client, game_with_hand):
        game_id, hand_number = game_with_hand
        resp = client.patch(
            f'/games/{game_id}/hands/{hand_number}',
            json={
                'flop_1': {'rank': 'Q', 'suit': 'C'},
                'flop_2': {'rank': 'J', 'suit': 'D'},
                'flop_3': {'rank': '3', 'suit': 'H'},
            },
        )
        data = resp.json()
        assert data['game_id'] == game_id
        assert data['hand_number'] == hand_number


class TestEditCommunityCardsIncludesPlayerHands:
    """AC-3: Returns updated hand with all player entries."""

    def test_response_includes_player_hands(self, client, game_with_hand):
        game_id, hand_number = game_with_hand
        resp = client.patch(
            f'/games/{game_id}/hands/{hand_number}',
            json={
                'flop_1': {'rank': 'Q', 'suit': 'C'},
                'flop_2': {'rank': 'J', 'suit': 'D'},
                'flop_3': {'rank': '3', 'suit': 'H'},
            },
        )
        data = resp.json()
        assert 'player_hands' in data
        assert len(data['player_hands']) == 2

    def test_player_hands_retain_hole_cards(self, client, game_with_hand):
        game_id, hand_number = game_with_hand
        resp = client.patch(
            f'/games/{game_id}/hands/{hand_number}',
            json={
                'flop_1': {'rank': 'Q', 'suit': 'C'},
                'flop_2': {'rank': 'J', 'suit': 'D'},
                'flop_3': {'rank': '3', 'suit': 'H'},
            },
        )
        player_hands = resp.json()['player_hands']
        names = {ph['player_name'] for ph in player_hands}
        assert names == {'Alice', 'Bob'}
        alice = next(ph for ph in player_hands if ph['player_name'] == 'Alice')
        assert alice['card_1'] == '7S'
        assert alice['card_2'] == '8S'


class TestEditCommunityCardsDuplicateRejection:
    """AC-2: Rejects edits that introduce duplicate cards."""

    def test_duplicate_within_new_community_cards_rejected(
        self, client, game_with_hand
    ):
        """Duplicate among the new community cards themselves should return 400."""
        game_id, hand_number = game_with_hand
        resp = client.patch(
            f'/games/{game_id}/hands/{hand_number}',
            json={
                'flop_1': {'rank': 'Q', 'suit': 'C'},
                'flop_2': {'rank': 'Q', 'suit': 'C'},  # duplicate
                'flop_3': {'rank': '3', 'suit': 'H'},
            },
        )
        assert resp.status_code == 400

    def test_community_card_duplicate_of_player_hole_card_rejected(
        self, client, game_with_hand
    ):
        """A new community card that duplicates a player hole card should return 400."""
        game_id, hand_number = game_with_hand
        # Alice has 7S and 8S; Bob has 9H and 10H
        resp = client.patch(
            f'/games/{game_id}/hands/{hand_number}',
            json={
                'flop_1': {'rank': '7', 'suit': 'S'},  # duplicates Alice's card_1
                'flop_2': {'rank': 'J', 'suit': 'D'},
                'flop_3': {'rank': '3', 'suit': 'H'},
            },
        )
        assert resp.status_code == 400

    def test_turn_duplicate_of_hole_card_rejected(self, client, game_with_hand):
        game_id, hand_number = game_with_hand
        # Bob has 9H and 10H
        resp = client.patch(
            f'/games/{game_id}/hands/{hand_number}',
            json={
                'flop_1': {'rank': 'Q', 'suit': 'C'},
                'flop_2': {'rank': 'J', 'suit': 'D'},
                'flop_3': {'rank': '3', 'suit': 'H'},
                'turn': {'rank': '9', 'suit': 'H'},  # duplicates Bob's card_1
            },
        )
        assert resp.status_code == 400

    def test_valid_update_with_no_duplicates_succeeds(self, client, game_with_hand):
        game_id, hand_number = game_with_hand
        resp = client.patch(
            f'/games/{game_id}/hands/{hand_number}',
            json={
                'flop_1': {'rank': 'Q', 'suit': 'C'},
                'flop_2': {'rank': 'J', 'suit': 'D'},
                'flop_3': {'rank': '3', 'suit': 'H'},
                'turn': {'rank': '4', 'suit': 'C'},
                'river': {'rank': '5', 'suit': 'D'},
            },
        )
        assert resp.status_code == 200


class TestEditCommunityCardsNotFound:
    """404 behaviour for missing game or hand."""

    def test_unknown_game_returns_404(self, client):
        resp = client.patch(
            '/games/9999/hands/1',
            json={
                'flop_1': {'rank': 'A', 'suit': 'S'},
                'flop_2': {'rank': 'K', 'suit': 'H'},
                'flop_3': {'rank': '2', 'suit': 'D'},
            },
        )
        assert resp.status_code == 404

    def test_unknown_hand_returns_404(self, client, game_with_hand):
        game_id, _ = game_with_hand
        resp = client.patch(
            f'/games/{game_id}/hands/9999',
            json={
                'flop_1': {'rank': 'A', 'suit': 'S'},
                'flop_2': {'rank': 'K', 'suit': 'H'},
                'flop_3': {'rank': '2', 'suit': 'D'},
            },
        )
        assert resp.status_code == 404
