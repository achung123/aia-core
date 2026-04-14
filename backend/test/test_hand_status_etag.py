"""Tests for T-014: ETag support on hand status endpoint."""

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
    resp = client.post(
        '/games',
        json={'game_date': '2026-04-09', 'player_names': ['Alice', 'Bob', 'Charlie']},
    )
    assert resp.status_code == 201
    return resp.json()['game_id']


@pytest.fixture
def empty_hand(client, game_with_players):
    resp = client.post(f'/games/{game_with_players}/hands', json={})
    assert resp.status_code == 201
    return game_with_players, resp.json()['hand_number']


class TestHandStatusETagPresent:
    """AC-1: Response includes ETag header (hash of response body)."""

    def test_response_includes_etag_header(self, client, empty_hand):
        game_id, hand_number = empty_hand
        resp = client.get(f'/games/{game_id}/hands/{hand_number}/status')
        assert resp.status_code == 200
        assert 'etag' in resp.headers
        etag = resp.headers['etag']
        # ETag should be a quoted string per HTTP spec
        assert etag.startswith('"') and etag.endswith('"')

    def test_etag_is_deterministic(self, client, empty_hand):
        """Same data should produce the same ETag."""
        game_id, hand_number = empty_hand
        resp1 = client.get(f'/games/{game_id}/hands/{hand_number}/status')
        resp2 = client.get(f'/games/{game_id}/hands/{hand_number}/status')
        assert resp1.headers['etag'] == resp2.headers['etag']


class TestHandStatusIfNoneMatch304:
    """AC-2: If-None-Match matching current ETag returns 304 with empty body."""

    def test_matching_etag_returns_304(self, client, empty_hand):
        game_id, hand_number = empty_hand
        resp = client.get(f'/games/{game_id}/hands/{hand_number}/status')
        etag = resp.headers['etag']

        resp2 = client.get(
            f'/games/{game_id}/hands/{hand_number}/status',
            headers={'If-None-Match': etag},
        )
        assert resp2.status_code == 304
        assert resp2.content == b''

    def test_non_matching_etag_returns_200(self, client, empty_hand):
        game_id, hand_number = empty_hand
        resp = client.get(
            f'/games/{game_id}/hands/{hand_number}/status',
            headers={'If-None-Match': '"stale-etag"'},
        )
        assert resp.status_code == 200
        assert 'etag' in resp.headers


class TestHandStatusETagChangesWithData:
    """AC-3: Changed data returns 200 with new ETag."""

    def test_etag_changes_when_player_added(self, client, empty_hand):
        game_id, hand_number = empty_hand
        resp1 = client.get(f'/games/{game_id}/hands/{hand_number}/status')
        etag_before = resp1.headers['etag']

        # Add a player to the hand — changes data
        client.post(
            f'/games/{game_id}/hands/{hand_number}/players',
            json={'player_name': 'Alice'},
        )

        resp2 = client.get(
            f'/games/{game_id}/hands/{hand_number}/status',
            headers={'If-None-Match': etag_before},
        )
        assert resp2.status_code == 200
        etag_after = resp2.headers['etag']
        assert etag_after != etag_before

    def test_etag_changes_when_cards_set(self, client, empty_hand):
        game_id, hand_number = empty_hand
        client.post(
            f'/games/{game_id}/hands/{hand_number}/players',
            json={'player_name': 'Alice'},
        )
        resp1 = client.get(f'/games/{game_id}/hands/{hand_number}/status')
        etag_before = resp1.headers['etag']

        # Set hole cards — changes data
        client.patch(
            f'/games/{game_id}/hands/{hand_number}/players/Alice',
            json={
                'card_1': {'rank': 'A', 'suit': 'S'},
                'card_2': {'rank': 'K', 'suit': 'H'},
            },
        )

        resp2 = client.get(
            f'/games/{game_id}/hands/{hand_number}/status',
            headers={'If-None-Match': etag_before},
        )
        assert resp2.status_code == 200
        assert resp2.headers['etag'] != etag_before
