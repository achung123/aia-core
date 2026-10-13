"""Tests for seat_number column on GamePlayer."""

from datetime import date

from sqlalchemy import inspect

from app.database.models import GamePlayer, GameSession, Player


def test_game_player_model_has_seat_number_attribute():
    """GamePlayer model class exposes a seat_number column."""
    mapper = inspect(GamePlayer)
    column_names = [c.key for c in mapper.column_attrs]
    assert 'seat_number' in column_names


def test_seat_number_column_is_nullable():
    """seat_number column must be nullable with no default."""
    mapper = inspect(GamePlayer)
    col = mapper.columns['seat_number']
    assert col.nullable is True
    assert col.default is None


def test_seat_number_defaults_to_none(client):
    """Creating a GamePlayer without seat_number stores NULL."""
    from conftest import SessionLocal

    db = SessionLocal()
    try:
        player = Player(name='SeatTestPlayer')
        db.add(player)
        db.flush()

        game = GameSession(game_date=date(2026, 4, 12))
        db.add(game)
        db.flush()

        gp = GamePlayer(game_id=game.game_id, player_id=player.player_id)
        db.add(gp)
        db.commit()
        db.refresh(gp)

        assert gp.seat_number is None
    finally:
        db.close()
