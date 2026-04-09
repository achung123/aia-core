"""Regression tests for None-handling bugs in hands.py.

Bug 1 (aia-core-hnfr): record_hand() stores literal "None" string for null cards
Bug 2 (aia-core-slhq): edit_community_cards() passes None hole cards to duplicate validator
Bug 3 (aia-core-ulji): edit_player_hole_cards() passes None other-player cards to validator
Bug 4 (aia-core-cdap): HoleCardsUpdate card fields still required (should be optional)
"""

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
    """Create a game with Alice and Bob."""
    resp = client.post(
        '/games',
        json={'game_date': '2026-04-09', 'player_names': ['Alice', 'Bob']},
    )
    assert resp.status_code == 201
    return resp.json()['game_id']


class TestBug1RecordHandNoneCards:
    """aia-core-hnfr: record_hand() must store SQL NULL, not string 'None'."""

    def test_record_hand_with_null_cards_stores_null_not_string(
        self, client, game_with_players
    ):
        """Player entries with null cards should persist as NULL, not 'None'."""
        game_id = game_with_players
        resp = client.post(
            f'/games/{game_id}/hands',
            json={
                'player_entries': [
                    {'player_name': 'Alice'},
                    {'player_name': 'Bob'},
                ],
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        # Both players have no cards — should be null, not "None"
        for ph in data['player_hands']:
            assert ph['card_1'] is None, (
                f"card_1 should be None, got {ph['card_1']!r}"
            )
            assert ph['card_2'] is None, (
                f"card_2 should be None, got {ph['card_2']!r}"
            )

    def test_record_hand_mixed_null_and_real_cards(self, client, game_with_players):
        """One player with cards, one without — no duplicate error, nulls stored."""
        game_id = game_with_players
        resp = client.post(
            f'/games/{game_id}/hands',
            json={
                'player_entries': [
                    {
                        'player_name': 'Alice',
                        'card_1': {'rank': 'A', 'suit': 'S'},
                        'card_2': {'rank': 'K', 'suit': 'H'},
                    },
                    {'player_name': 'Bob'},
                ],
            },
        )
        assert resp.status_code == 201, (
            f'Expected 201 but got {resp.status_code}: {resp.json()}'
        )
        data = resp.json()
        alice = next(ph for ph in data['player_hands'] if ph['player_name'] == 'Alice')
        bob = next(ph for ph in data['player_hands'] if ph['player_name'] == 'Bob')
        assert alice['card_1'] == 'AS'
        assert bob['card_1'] is None
        assert bob['card_2'] is None

    def test_record_hand_two_null_players_no_duplicate_error(
        self, client, game_with_players
    ):
        """Two players with null cards should NOT trigger duplicate card error."""
        game_id = game_with_players
        resp = client.post(
            f'/games/{game_id}/hands',
            json={
                'player_entries': [
                    {'player_name': 'Alice'},
                    {'player_name': 'Bob'},
                ],
            },
        )
        # Should not get 400 about duplicate "None" cards
        assert resp.status_code == 201, (
            f'Expected 201 but got {resp.status_code}: {resp.json()}'
        )


class TestBug2EditCommunityCardsNoneHoleCards:
    """aia-core-slhq: edit_community_cards() must filter None hole cards."""

    def test_edit_community_cards_with_null_hole_card_player(
        self, client, game_with_players
    ):
        """Edit community cards when a player has null hole cards — no 400."""
        game_id = game_with_players
        # Create hand with a player who has no hole cards
        hand_resp = client.post(
            f'/games/{game_id}/hands',
            json={
                'player_entries': [
                    {'player_name': 'Alice'},
                ],
            },
        )
        assert hand_resp.status_code == 201
        hand_number = hand_resp.json()['hand_number']

        # Edit community cards — should succeed
        edit_resp = client.patch(
            f'/games/{game_id}/hands/{hand_number}',
            json={
                'flop_1': {'rank': '2', 'suit': 'D'},
                'flop_2': {'rank': '3', 'suit': 'C'},
                'flop_3': {'rank': '4', 'suit': 'H'},
            },
        )
        assert edit_resp.status_code == 200, (
            f'Expected 200 but got {edit_resp.status_code}: {edit_resp.json()}'
        )

    def test_edit_community_cards_two_null_hole_card_players(
        self, client, game_with_players
    ):
        """Two players with null cards — no spurious duplicate error on community edit."""
        game_id = game_with_players
        hand_resp = client.post(
            f'/games/{game_id}/hands',
            json={
                'player_entries': [
                    {'player_name': 'Alice'},
                    {'player_name': 'Bob'},
                ],
            },
        )
        assert hand_resp.status_code == 201
        hand_number = hand_resp.json()['hand_number']

        edit_resp = client.patch(
            f'/games/{game_id}/hands/{hand_number}',
            json={
                'flop_1': {'rank': '5', 'suit': 'S'},
                'flop_2': {'rank': '6', 'suit': 'H'},
                'flop_3': {'rank': '7', 'suit': 'D'},
            },
        )
        assert edit_resp.status_code == 200, (
            f'Expected 200 but got {edit_resp.status_code}: {edit_resp.json()}'
        )


class TestBug3EditHoleCardsNoneOtherPlayer:
    """aia-core-ulji: edit_player_hole_cards() must filter None other-player cards."""

    def test_edit_hole_cards_when_other_player_has_null_cards(
        self, client, game_with_players
    ):
        """Edit Alice's cards when Bob has null cards — no 400."""
        game_id = game_with_players
        # Create hand: Alice has cards, Bob has none
        hand_resp = client.post(
            f'/games/{game_id}/hands',
            json={
                'player_entries': [
                    {
                        'player_name': 'Alice',
                        'card_1': {'rank': 'A', 'suit': 'S'},
                        'card_2': {'rank': 'K', 'suit': 'H'},
                    },
                    {'player_name': 'Bob'},
                ],
            },
        )
        assert hand_resp.status_code == 201
        hand_number = hand_resp.json()['hand_number']

        # Edit Alice's hole cards — should succeed even though Bob has null cards
        edit_resp = client.patch(
            f'/games/{game_id}/hands/{hand_number}/players/Alice',
            json={
                'card_1': {'rank': 'Q', 'suit': 'C'},
                'card_2': {'rank': 'J', 'suit': 'D'},
            },
        )
        assert edit_resp.status_code == 200, (
            f'Expected 200 but got {edit_resp.status_code}: {edit_resp.json()}'
        )


class TestBug4HoleCardsUpdateOptional:
    """aia-core-cdap: HoleCardsUpdate should accept optional card fields."""

    def test_hole_cards_update_accepts_null_cards(self, client, game_with_players):
        """PATCH hole cards with null card_1/card_2 should be accepted."""
        game_id = game_with_players
        hand_resp = client.post(
            f'/games/{game_id}/hands',
            json={
                'player_entries': [
                    {
                        'player_name': 'Alice',
                        'card_1': {'rank': 'A', 'suit': 'S'},
                        'card_2': {'rank': 'K', 'suit': 'H'},
                    },
                ],
            },
        )
        assert hand_resp.status_code == 201
        hand_number = hand_resp.json()['hand_number']

        # Patch with null cards (clearing hole cards)
        edit_resp = client.patch(
            f'/games/{game_id}/hands/{hand_number}/players/Alice',
            json={},
        )
        # Should not get 422 validation error
        assert edit_resp.status_code == 200, (
            f'Expected 200 but got {edit_resp.status_code}: {edit_resp.json()}'
        )
        data = edit_resp.json()
        assert data['card_1'] is None
        assert data['card_2'] is None

    def test_hole_cards_update_partial_card(self, client, game_with_players):
        """PATCH with only card_1 should accept card_2 as None."""
        game_id = game_with_players
        hand_resp = client.post(
            f'/games/{game_id}/hands',
            json={
                'player_entries': [
                    {
                        'player_name': 'Alice',
                        'card_1': {'rank': 'A', 'suit': 'S'},
                        'card_2': {'rank': 'K', 'suit': 'H'},
                    },
                ],
            },
        )
        assert hand_resp.status_code == 201
        hand_number = hand_resp.json()['hand_number']

        edit_resp = client.patch(
            f'/games/{game_id}/hands/{hand_number}/players/Alice',
            json={'card_1': {'rank': 'Q', 'suit': 'C'}},
        )
        assert edit_resp.status_code == 200, (
            f'Expected 200 but got {edit_resp.status_code}: {edit_resp.json()}'
        )
        data = edit_resp.json()
        assert data['card_1'] == 'QC'
        assert data['card_2'] is None
