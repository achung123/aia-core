from sqlalchemy import Float

from app.database.models import GamePlayer


def test_game_player_has_buy_in_attribute():
    """GamePlayer model has a buy_in column."""
    assert hasattr(GamePlayer, 'buy_in')


def test_buy_in_column_is_float():
    """buy_in column is a Float type."""
    col = GamePlayer.__table__.columns['buy_in']
    assert isinstance(col.type, Float)


def test_buy_in_column_is_nullable():
    """buy_in column is nullable."""
    col = GamePlayer.__table__.columns['buy_in']
    assert col.nullable is True


def test_buy_in_column_default_is_none():
    """buy_in column defaults to None."""
    col = GamePlayer.__table__.columns['buy_in']
    assert col.default is None


def test_buy_in_defaults_to_none_on_insert(client):
    """When a game player is created without buy_in, it stores null."""
    # Create a game session with a player
    response = client.post(
        '/games/',
        json={
            'game_date': '2026-04-12',
            'player_names': ['Alice'],
        },
    )
    assert response.status_code == 201
    game_id = response.json()['game_id']

    # Query via the ORM to verify buy_in is null
    from conftest import SessionLocal

    db = SessionLocal()
    gp = db.query(GamePlayer).filter_by(game_id=game_id).first()
    db.close()
    assert gp is not None
    assert gp.buy_in is None
