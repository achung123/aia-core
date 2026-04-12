"""Tests for T-004: Blind fields on game_sessions."""

from datetime import date, datetime

import pytest
from sqlalchemy import create_engine, inspect, StaticPool
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


class TestBlindFieldsExist:
    """All five blind columns exist on game_sessions."""

    def test_has_small_blind_column(self):
        from app.database.models import GameSession

        mapper = inspect(GameSession)
        columns = {c.key for c in mapper.columns}
        assert 'small_blind' in columns

    def test_has_big_blind_column(self):
        from app.database.models import GameSession

        mapper = inspect(GameSession)
        columns = {c.key for c in mapper.columns}
        assert 'big_blind' in columns

    def test_has_blind_timer_minutes_column(self):
        from app.database.models import GameSession

        mapper = inspect(GameSession)
        columns = {c.key for c in mapper.columns}
        assert 'blind_timer_minutes' in columns

    def test_has_blind_timer_paused_column(self):
        from app.database.models import GameSession

        mapper = inspect(GameSession)
        columns = {c.key for c in mapper.columns}
        assert 'blind_timer_paused' in columns

    def test_has_blind_timer_started_at_column(self):
        from app.database.models import GameSession

        mapper = inspect(GameSession)
        columns = {c.key for c in mapper.columns}
        assert 'blind_timer_started_at' in columns


class TestBlindFieldTypes:
    """Columns have correct SQLAlchemy types."""

    def test_small_blind_is_float(self):
        from app.database.models import GameSession

        mapper = inspect(GameSession)
        col = next(c for c in mapper.columns if c.key == 'small_blind')
        assert isinstance(col.type, type(col.type))  # exists
        assert 'FLOAT' in str(col.type).upper() or 'NUMERIC' in str(col.type).upper()

    def test_big_blind_is_float(self):
        from app.database.models import GameSession

        mapper = inspect(GameSession)
        col = next(c for c in mapper.columns if c.key == 'big_blind')
        assert 'FLOAT' in str(col.type).upper() or 'NUMERIC' in str(col.type).upper()

    def test_blind_timer_minutes_is_integer(self):
        from app.database.models import GameSession

        mapper = inspect(GameSession)
        col = next(c for c in mapper.columns if c.key == 'blind_timer_minutes')
        assert 'INT' in str(col.type).upper()

    def test_blind_timer_paused_is_boolean(self):
        from app.database.models import GameSession

        mapper = inspect(GameSession)
        col = next(c for c in mapper.columns if c.key == 'blind_timer_paused')
        assert 'BOOL' in str(col.type).upper()

    def test_blind_timer_started_at_is_datetime(self):
        from app.database.models import GameSession

        mapper = inspect(GameSession)
        col = next(c for c in mapper.columns if c.key == 'blind_timer_started_at')
        assert (
            'DATETIME' in str(col.type).upper() or 'TIMESTAMP' in str(col.type).upper()
        )


class TestBlindFieldDefaults:
    """Columns have correct default values when row is created."""

    def test_small_blind_defaults_to_0_10(self, db_session):
        from app.database.models import GameSession

        game = GameSession(game_date=date(2026, 4, 12))
        db_session.add(game)
        db_session.commit()

        result = db_session.query(GameSession).first()
        assert result.small_blind == pytest.approx(0.10)

    def test_big_blind_defaults_to_0_20(self, db_session):
        from app.database.models import GameSession

        game = GameSession(game_date=date(2026, 4, 12))
        db_session.add(game)
        db_session.commit()

        result = db_session.query(GameSession).first()
        assert result.big_blind == pytest.approx(0.20)

    def test_blind_timer_minutes_defaults_to_15(self, db_session):
        from app.database.models import GameSession

        game = GameSession(game_date=date(2026, 4, 12))
        db_session.add(game)
        db_session.commit()

        result = db_session.query(GameSession).first()
        assert result.blind_timer_minutes == 15

    def test_blind_timer_paused_defaults_to_false(self, db_session):
        from app.database.models import GameSession

        game = GameSession(game_date=date(2026, 4, 12))
        db_session.add(game)
        db_session.commit()

        result = db_session.query(GameSession).first()
        assert result.blind_timer_paused is False

    def test_blind_timer_started_at_defaults_to_none(self, db_session):
        from app.database.models import GameSession

        game = GameSession(game_date=date(2026, 4, 12))
        db_session.add(game)
        db_session.commit()

        result = db_session.query(GameSession).first()
        assert result.blind_timer_started_at is None


class TestBlindFieldsExplicitValues:
    """Columns can be set explicitly."""

    def test_can_set_blind_values(self, db_session):
        from app.database.models import GameSession

        game = GameSession(
            game_date=date(2026, 4, 12),
            small_blind=0.50,
            big_blind=1.00,
            blind_timer_minutes=20,
            blind_timer_paused=True,
            blind_timer_started_at=datetime(2026, 4, 12, 20, 0, 0),
        )
        db_session.add(game)
        db_session.commit()

        result = db_session.query(GameSession).first()
        assert result.small_blind == pytest.approx(0.50)
        assert result.big_blind == pytest.approx(1.00)
        assert result.blind_timer_minutes == 20
        assert result.blind_timer_paused is True
        assert result.blind_timer_started_at == datetime(2026, 4, 12, 20, 0, 0)
