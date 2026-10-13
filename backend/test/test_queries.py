"""Tests for database/queries.py get-or-404 helpers."""

from datetime import date

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, StaticPool
from sqlalchemy.orm import sessionmaker

from app.database.models import Base, GameSession, Hand, Player, PlayerHand
from app.database.queries import (
    get_game_or_404,
    get_hand_or_404,
    get_player_by_name_or_404,
    get_player_hand_or_404,
)

DATABASE_URL = 'sqlite:///:memory:'
engine = create_engine(
    DATABASE_URL, connect_args={'check_same_thread': False}, poolclass=StaticPool
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(autouse=True)
def db():
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    yield session
    session.close()
    Base.metadata.drop_all(bind=engine)


# ── get_game_or_404 ──────────────────────────────────────────────────────


class TestGetGameOr404:
    def test_returns_game_when_found(self, db):
        game = GameSession(game_date=date(2026, 1, 1), status='active')
        db.add(game)
        db.commit()
        db.refresh(game)

        result = get_game_or_404(db, game.game_id)
        assert result.game_id == game.game_id

    def test_raises_404_when_not_found(self, db):
        with pytest.raises(HTTPException) as exc_info:
            get_game_or_404(db, 999)
        assert exc_info.value.status_code == 404
        assert exc_info.value.detail == 'Game session not found'


# ── get_hand_or_404 ──────────────────────────────────────────────────────


class TestGetHandOr404:
    def test_returns_hand_when_found(self, db):
        game = GameSession(game_date=date(2026, 1, 1), status='active')
        db.add(game)
        db.flush()
        hand = Hand(game_id=game.game_id, hand_number=1)
        db.add(hand)
        db.commit()
        db.refresh(hand)

        result = get_hand_or_404(db, game.game_id, 1)
        assert result.hand_id == hand.hand_id
        assert result.hand_number == 1

    def test_raises_404_when_not_found(self, db):
        game = GameSession(game_date=date(2026, 1, 1), status='active')
        db.add(game)
        db.commit()
        db.refresh(game)

        with pytest.raises(HTTPException) as exc_info:
            get_hand_or_404(db, game.game_id, 99)
        assert exc_info.value.status_code == 404
        assert exc_info.value.detail == 'Hand not found'


# ── get_player_by_name_or_404 ────────────────────────────────────────────


class TestGetPlayerByNameOr404:
    def test_returns_player_when_found(self, db):
        player = Player(name='Alice')
        db.add(player)
        db.commit()
        db.refresh(player)

        result = get_player_by_name_or_404(db, 'Alice')
        assert result.player_id == player.player_id

    def test_case_insensitive_lookup(self, db):
        player = Player(name='Alice')
        db.add(player)
        db.commit()
        db.refresh(player)

        result = get_player_by_name_or_404(db, 'alice')
        assert result.player_id == player.player_id

    def test_raises_404_when_not_found(self, db):
        with pytest.raises(HTTPException) as exc_info:
            get_player_by_name_or_404(db, 'Nobody')
        assert exc_info.value.status_code == 404
        assert exc_info.value.detail == "Player 'Nobody' not found"


# ── get_player_hand_or_404 ───────────────────────────────────────────────


class TestGetPlayerHandOr404:
    def test_returns_player_hand_when_found(self, db):
        game = GameSession(game_date=date(2026, 1, 1), status='active')
        db.add(game)
        db.flush()
        hand = Hand(game_id=game.game_id, hand_number=1)
        db.add(hand)
        db.flush()
        player = Player(name='Bob')
        db.add(player)
        db.flush()
        ph = PlayerHand(hand_id=hand.hand_id, player_id=player.player_id)
        db.add(ph)
        db.commit()
        db.refresh(ph)

        result = get_player_hand_or_404(db, hand.hand_id, player.player_id, 'Bob')
        assert result.player_hand_id == ph.player_hand_id

    def test_raises_404_when_not_found(self, db):
        game = GameSession(game_date=date(2026, 1, 1), status='active')
        db.add(game)
        db.flush()
        hand = Hand(game_id=game.game_id, hand_number=1)
        db.add(hand)
        db.flush()
        player = Player(name='Bob')
        db.add(player)
        db.commit()

        with pytest.raises(HTTPException) as exc_info:
            get_player_hand_or_404(db, hand.hand_id, player.player_id, 'Bob')
        assert exc_info.value.status_code == 404
        assert exc_info.value.detail == "Player 'Bob' not found in this hand"
