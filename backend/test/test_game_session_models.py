"""Tests for T-003: GameSession and GamePlayer SQLAlchemy models."""

from datetime import date, datetime

import pytest
from sqlalchemy import create_engine, inspect, StaticPool
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker


@pytest.fixture
def db_session():
    """Create an in-memory SQLite database with all model tables."""
    from app.database.models import Base

    engine = create_engine(
        'sqlite:///:memory:',
        connect_args={'check_same_thread': False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()
    Base.metadata.drop_all(bind=engine)


class TestGameSessionModelExists:
    """AC-1: GameSession model exists with correct columns."""

    def test_game_session_importable(self):
        from app.database.models import GameSession

        assert GameSession is not None

    def test_game_session_has_correct_tablename(self):
        from app.database.models import GameSession

        assert GameSession.__tablename__ == 'game_sessions'

    def test_game_session_has_game_id_column(self):
        from app.database.models import GameSession

        mapper = inspect(GameSession)
        columns = {c.key for c in mapper.columns}
        assert 'game_id' in columns

    def test_game_session_has_game_date_column(self):
        from app.database.models import GameSession

        mapper = inspect(GameSession)
        columns = {c.key for c in mapper.columns}
        assert 'game_date' in columns

    def test_game_session_has_status_column(self):
        from app.database.models import GameSession

        mapper = inspect(GameSession)
        columns = {c.key for c in mapper.columns}
        assert 'status' in columns

    def test_game_session_has_created_at_column(self):
        from app.database.models import GameSession

        mapper = inspect(GameSession)
        columns = {c.key for c in mapper.columns}
        assert 'created_at' in columns

    def test_game_id_is_primary_key(self):
        from app.database.models import GameSession

        mapper = inspect(GameSession)
        pk_cols = [c.key for c in mapper.columns if c.primary_key]
        assert 'game_id' in pk_cols

    def test_game_session_can_be_created(self, db_session):
        from app.database.models import GameSession

        game = GameSession(game_date=date(2026, 3, 9))
        db_session.add(game)
        db_session.commit()

        result = db_session.query(GameSession).first()
        assert result.game_date == date(2026, 3, 9)
        assert result.game_id is not None

    def test_game_session_created_at_has_default(self, db_session):
        from app.database.models import GameSession

        game = GameSession(game_date=date(2026, 3, 9))
        db_session.add(game)
        db_session.commit()

        result = db_session.query(GameSession).first()
        assert result.created_at is not None
        assert isinstance(result.created_at, datetime)


class TestGameSessionStatusDefault:
    """AC-3: status defaults to 'active'."""

    def test_status_defaults_to_active(self, db_session):
        from app.database.models import GameSession

        game = GameSession(game_date=date(2026, 3, 9))
        db_session.add(game)
        db_session.commit()

        result = db_session.query(GameSession).first()
        assert result.status == 'active'

    def test_status_can_be_set_explicitly(self, db_session):
        from app.database.models import GameSession

        game = GameSession(game_date=date(2026, 3, 9), status='completed')
        db_session.add(game)
        db_session.commit()

        result = db_session.query(GameSession).first()
        assert result.status == 'completed'


class TestGamePlayerModelExists:
    """AC-1: GamePlayer association table exists with correct columns and FKs."""

    def test_game_player_importable(self):
        from app.database.models import GamePlayer

        assert GamePlayer is not None

    def test_game_player_has_correct_tablename(self):
        from app.database.models import GamePlayer

        assert GamePlayer.__tablename__ == 'game_players'

    def test_game_player_has_game_id_column(self):
        from app.database.models import GamePlayer

        mapper = inspect(GamePlayer)
        columns = {c.key for c in mapper.columns}
        assert 'game_id' in columns

    def test_game_player_has_player_id_column(self):
        from app.database.models import GamePlayer

        mapper = inspect(GamePlayer)
        columns = {c.key for c in mapper.columns}
        assert 'player_id' in columns

    def test_game_player_has_composite_primary_key(self):
        from app.database.models import GamePlayer

        mapper = inspect(GamePlayer)
        pk_cols = {c.key for c in mapper.columns if c.primary_key}
        assert pk_cols == {'game_id', 'player_id'}

    def test_game_player_game_id_is_foreign_key(self):
        from app.database.models import GamePlayer

        mapper = inspect(GamePlayer)
        game_id_col = next(c for c in mapper.columns if c.key == 'game_id')
        fk_targets = {fk.target_fullname for fk in game_id_col.foreign_keys}
        assert 'game_sessions.game_id' in fk_targets

    def test_game_player_player_id_is_foreign_key(self):
        from app.database.models import GamePlayer

        mapper = inspect(GamePlayer)
        player_id_col = next(c for c in mapper.columns if c.key == 'player_id')
        fk_targets = {fk.target_fullname for fk in player_id_col.foreign_keys}
        assert 'players.player_id' in fk_targets


class TestGameSessionPlayersRelationship:
    """AC-2: GameSession.players relationship returns associated Player objects."""

    def test_game_session_has_players_relationship(self, db_session):
        from app.database.models import GameSession, GamePlayer, Player

        player = Player(name='Adam')
        db_session.add(player)
        db_session.commit()

        game = GameSession(game_date=date(2026, 3, 9))
        db_session.add(game)
        db_session.commit()

        gp = GamePlayer(game_id=game.game_id, player_id=player.player_id)
        db_session.add(gp)
        db_session.commit()

        db_session.refresh(game)
        assert len(game.players) == 1
        assert game.players[0].name == 'Adam'

    def test_game_session_multiple_players(self, db_session):
        from app.database.models import GameSession, GamePlayer, Player

        p1 = Player(name='Adam')
        p2 = Player(name='Gil')
        p3 = Player(name='Zain')
        db_session.add_all([p1, p2, p3])
        db_session.commit()

        game = GameSession(game_date=date(2026, 3, 9))
        db_session.add(game)
        db_session.commit()

        for p in [p1, p2, p3]:
            db_session.add(GamePlayer(game_id=game.game_id, player_id=p.player_id))
        db_session.commit()

        db_session.refresh(game)
        assert len(game.players) == 3
        names = {p.name for p in game.players}
        assert names == {'Adam', 'Gil', 'Zain'}

    def test_player_games_relationship(self, db_session):
        from app.database.models import GameSession, GamePlayer, Player

        player = Player(name='Adam')
        db_session.add(player)
        db_session.commit()

        g1 = GameSession(game_date=date(2026, 3, 9))
        g2 = GameSession(game_date=date(2026, 3, 10))
        db_session.add_all([g1, g2])
        db_session.commit()

        db_session.add(GamePlayer(game_id=g1.game_id, player_id=player.player_id))
        db_session.add(GamePlayer(game_id=g2.game_id, player_id=player.player_id))
        db_session.commit()

        db_session.refresh(player)
        assert len(player.games) == 2

    def test_duplicate_game_player_raises_integrity_error(self, db_session):
        from app.database.models import GameSession, GamePlayer, Player

        player = Player(name='Adam')
        db_session.add(player)
        db_session.commit()

        game = GameSession(game_date=date(2026, 3, 9))
        db_session.add(game)
        db_session.commit()

        gp1 = GamePlayer(game_id=game.game_id, player_id=player.player_id)
        gp2 = GamePlayer(game_id=game.game_id, player_id=player.player_id)
        db_session.add(gp1)
        db_session.commit()
        db_session.add(gp2)
        with pytest.raises(IntegrityError):
            db_session.flush()


class TestModelsInBaseMetadata:
    """AC-1 (cont): Models import cleanly and Base.metadata includes them."""

    def test_game_sessions_table_in_base_metadata(self):
        from app.database.models import Base

        assert 'game_sessions' in Base.metadata.tables

    def test_game_players_table_in_base_metadata(self):
        from app.database.models import Base

        assert 'game_players' in Base.metadata.tables
