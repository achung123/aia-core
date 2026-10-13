"""Tests for GamePlayer.is_active column."""

from datetime import date

from app.database.models import GamePlayer, GameSession, Player


def test_game_player_has_is_active_column():
    """GamePlayer model has an is_active column."""
    assert hasattr(GamePlayer, 'is_active'), 'GamePlayer missing is_active column'


def test_game_player_is_active_defaults_to_true(client):
    """When a GamePlayer row is created without specifying is_active, it defaults to True."""
    from conftest import SessionLocal

    db = SessionLocal()
    try:
        player = Player(name='TestPlayer')
        db.add(player)
        db.flush()

        game = GameSession(game_date=date(2026, 4, 12))
        db.add(game)
        db.flush()

        gp = GamePlayer(game_id=game.game_id, player_id=player.player_id)
        db.add(gp)
        db.commit()
        db.refresh(gp)

        assert gp.is_active is True
    finally:
        db.close()


def test_game_player_is_active_can_be_set_false(client):
    """is_active can be explicitly set to False."""
    from conftest import SessionLocal

    db = SessionLocal()
    try:
        player = Player(name='InactivePlayer')
        db.add(player)
        db.flush()

        game = GameSession(game_date=date(2026, 4, 12))
        db.add(game)
        db.flush()

        gp = GamePlayer(
            game_id=game.game_id, player_id=player.player_id, is_active=False
        )
        db.add(gp)
        db.commit()
        db.refresh(gp)

        assert gp.is_active is False
    finally:
        db.close()
