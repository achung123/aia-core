"""Tests for aia-core-xnwk and aia-core-y7jn: None community cards cause spurious 400.

Bug: add_player_to_hand() and edit_player_hole_cards() pass None flop values
to validate_no_duplicate_cards(), which sees multiple Nones as duplicates.
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
def game_with_empty_hand(client):
    """Create a game with Alice and Bob, then an empty hand (no community cards)."""
    game_resp = client.post(
        '/games',
        json={'game_date': '2026-04-09', 'player_names': ['Alice', 'Bob']},
    )
    assert game_resp.status_code == 201
    game_id = game_resp.json()['game_id']

    hand_resp = client.post(f'/games/{game_id}/hands', json={})
    assert hand_resp.status_code == 201
    return game_id, hand_resp.json()['hand_number']


class TestAddPlayerToEmptyHand:
    """aia-core-xnwk: add_player_to_hand on empty hand should not 400."""

    def test_add_player_to_empty_hand_returns_201(self, client, game_with_empty_hand):
        game_id, hand_number = game_with_empty_hand
        resp = client.post(
            f'/games/{game_id}/hands/{hand_number}/players',
            json={
                'player_name': 'Alice',
                'card_1': {'rank': '7', 'suit': 'S'},
                'card_2': {'rank': '8', 'suit': 'S'},
            },
        )
        assert resp.status_code == 201, f'Expected 201 but got {resp.status_code}: {resp.json()}'

    def test_add_two_players_to_empty_hand(self, client, game_with_empty_hand):
        game_id, hand_number = game_with_empty_hand
        resp1 = client.post(
            f'/games/{game_id}/hands/{hand_number}/players',
            json={
                'player_name': 'Alice',
                'card_1': {'rank': '7', 'suit': 'S'},
                'card_2': {'rank': '8', 'suit': 'S'},
            },
        )
        assert resp1.status_code == 201

        resp2 = client.post(
            f'/games/{game_id}/hands/{hand_number}/players',
            json={
                'player_name': 'Bob',
                'card_1': {'rank': '9', 'suit': 'H'},
                'card_2': {'rank': '10', 'suit': 'H'},
            },
        )
        assert resp2.status_code == 201, f'Expected 201 but got {resp2.status_code}: {resp2.json()}'


class TestEditHoleCardsOnEmptyHand:
    """aia-core-y7jn: edit_player_hole_cards on empty hand should not 400."""

    def test_edit_hole_cards_on_empty_hand_returns_200(self, client, game_with_empty_hand):
        game_id, hand_number = game_with_empty_hand
        # First add a player so we can edit their cards
        add_resp = client.post(
            f'/games/{game_id}/hands/{hand_number}/players',
            json={
                'player_name': 'Alice',
                'card_1': {'rank': '7', 'suit': 'S'},
                'card_2': {'rank': '8', 'suit': 'S'},
            },
        )
        assert add_resp.status_code == 201

        # Now edit Alice's hole cards — should succeed, not 400
        edit_resp = client.patch(
            f'/games/{game_id}/hands/{hand_number}/players/Alice',
            json={
                'card_1': {'rank': 'Q', 'suit': 'C'},
                'card_2': {'rank': 'J', 'suit': 'D'},
            },
        )
        assert edit_resp.status_code == 200, f'Expected 200 but got {edit_resp.status_code}: {edit_resp.json()}'
