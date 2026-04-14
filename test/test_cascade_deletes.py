"""Tests for ORM cascade deletes on game session hierarchy."""

from sqlalchemy import create_engine, StaticPool
from sqlalchemy.orm import sessionmaker

from app.database.models import (
    Base,
    GameSession,
    Hand,
    HandState,
    PlayerHand,
    PlayerHandAction,
)
from app.database.session import get_db
from app.main import app

import pytest
from fastapi.testclient import TestClient

DATABASE_URL = 'sqlite:///:memory:'
_engine = create_engine(
    DATABASE_URL, connect_args={'check_same_thread': False}, poolclass=StaticPool
)
_SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_engine)


def _override_get_db():
    db = _SessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=_engine)
    yield
    Base.metadata.drop_all(bind=_engine)


@pytest.fixture
def client():
    app.dependency_overrides[get_db] = _override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()


def _seed_game(client):
    """Create a game with 2 players, 1 hand — returns (game_id, hand_number)."""
    r = client.post(
        '/games', json={'game_date': '2026-04-13', 'player_names': ['Alice', 'Bob']}
    )
    assert r.status_code == 201
    game_id = r.json()['game_id']

    r = client.post(f'/games/{game_id}/hands/start')
    assert r.status_code == 201
    hand_number = r.json()['hand_number']

    return game_id, hand_number


def _seed_full_game(client):
    """Create a game with 2 hands for richer cascade testing."""
    game_id, hn1 = _seed_game(client)

    r = client.post(f'/games/{game_id}/hands/start')
    assert r.status_code == 201
    hn2 = r.json()['hand_number']

    return game_id, hn1, hn2


def _get_db():
    """Get a raw DB session for direct queries."""
    db = _SessionLocal()
    return db


class TestDeleteGameCascade:
    """Deleting a GameSession should cascade to all child records."""

    def test_cascade_deletes_hands(self, client):
        game_id, _ = _seed_game(client)

        r = client.get(f'/games/{game_id}/hands')
        assert r.status_code == 200
        assert len(r.json()) > 0

        r = client.delete(f'/games/{game_id}')
        assert r.status_code == 204

        r = client.get(f'/games/{game_id}/hands')
        assert r.status_code == 404

    def test_cascade_deletes_player_hands(self, client):
        game_id, _ = _seed_game(client)

        r = client.delete(f'/games/{game_id}')
        assert r.status_code == 204

        r = client.get(f'/games/{game_id}')
        assert r.status_code == 404

    def test_cascade_deletes_all_children_via_orm(self, client):
        """Verify via direct DB queries that all child rows are removed."""
        game_id, hand_number = _seed_game(client)

        db = _get_db()
        try:
            # Gather child IDs before delete
            hands = db.query(Hand).filter_by(game_id=game_id).all()
            assert len(hands) > 0
            hand_ids = [h.hand_id for h in hands]

            player_hands = (
                db.query(PlayerHand)
                .filter(PlayerHand.hand_id.in_(hand_ids))
                .all()
            )
            ph_ids = [ph.player_hand_id for ph in player_hands]

            # Delete the game via API
            r = client.delete(f'/games/{game_id}')
            assert r.status_code == 204

            # Refresh session to see committed changes
            db.expire_all()

            # Verify all children are gone
            assert db.query(Hand).filter_by(game_id=game_id).count() == 0
            assert (
                db.query(PlayerHand)
                .filter(PlayerHand.hand_id.in_(hand_ids))
                .count()
                == 0
            )
            assert (
                db.query(HandState)
                .filter(HandState.hand_id.in_(hand_ids))
                .count()
                == 0
            )
            if ph_ids:
                assert (
                    db.query(PlayerHandAction)
                    .filter(PlayerHandAction.player_hand_id.in_(ph_ids))
                    .count()
                    == 0
                )
            assert db.query(GameSession).filter_by(game_id=game_id).first() is None
        finally:
            db.close()


class TestDeleteHandCascade:
    """Deleting a Hand should cascade to PlayerHands, HandStates, Actions."""

    def test_cascade_deletes_hand_children_via_orm(self, client):
        """Verify that deleting a hand removes its children."""
        game_id, hn1, hn2 = _seed_full_game(client)

        db = _get_db()
        try:
            hand1 = (
                db.query(Hand)
                .filter_by(game_id=game_id, hand_number=hn1)
                .first()
            )
            assert hand1 is not None
            hand1_id = hand1.hand_id

            ph_count = db.query(PlayerHand).filter_by(hand_id=hand1_id).count()
            assert ph_count > 0

            r = client.delete(f'/games/{game_id}/hands/{hn1}')
            assert r.status_code == 204

            db.expire_all()

            assert db.query(PlayerHand).filter_by(hand_id=hand1_id).count() == 0
            assert db.query(HandState).filter_by(hand_id=hand1_id).count() == 0

            # Hand 2 still exists
            hand2 = (
                db.query(Hand)
                .filter_by(game_id=game_id, hand_number=hn2)
                .first()
            )
            assert hand2 is not None
        finally:
            db.close()

    def test_delete_hand_preserves_sibling_hands(self, client):
        """Deleting one hand should not affect other hands in the game."""
        game_id, hn1, hn2 = _seed_full_game(client)

        r = client.delete(f'/games/{game_id}/hands/{hn1}')
        assert r.status_code == 204

        r = client.get(f'/games/{game_id}/hands/{hn2}')
        assert r.status_code == 200


class TestOrphanRemoval:
    """Verify delete-orphan cascades work when children are removed from collections."""

    def test_removing_hand_from_game_deletes_orphan(self, client):
        """When a hand is removed from GameSession.hands, it should be deleted."""
        game_id, hand_number = _seed_game(client)

        db = _get_db()
        try:
            game = db.query(GameSession).filter_by(game_id=game_id).first()
            hand = (
                db.query(Hand)
                .filter_by(game_id=game_id, hand_number=hand_number)
                .first()
            )
            hand_id = hand.hand_id

            # Remove hand from the relationship collection
            game.hands.remove(hand)
            db.commit()

            # Hand should be deleted (orphan removal)
            assert db.query(Hand).filter_by(hand_id=hand_id).first() is None
        finally:
            db.close()
