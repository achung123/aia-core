"""Tests for T-002: Player SQLAlchemy model."""

from datetime import datetime

import pytest
from sqlalchemy import create_engine, inspect, StaticPool
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker


@pytest.fixture
def db_session():
    """Create an in-memory SQLite database with Player model tables."""
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


class TestPlayerModelExists:
    """AC-1: Player model exists with player_id, name, created_at."""

    def test_player_model_importable(self):
        from app.database.models import Player

        assert Player is not None

    def test_player_has_correct_tablename(self):
        from app.database.models import Player

        assert Player.__tablename__ == 'players'

    def test_player_has_player_id_column(self):
        from app.database.models import Player

        mapper = inspect(Player)
        columns = {c.key for c in mapper.columns}
        assert 'player_id' in columns

    def test_player_has_name_column(self):
        from app.database.models import Player

        mapper = inspect(Player)
        columns = {c.key for c in mapper.columns}
        assert 'name' in columns

    def test_player_has_created_at_column(self):
        from app.database.models import Player

        mapper = inspect(Player)
        columns = {c.key for c in mapper.columns}
        assert 'created_at' in columns

    def test_player_id_is_primary_key(self):
        from app.database.models import Player

        mapper = inspect(Player)
        pk_cols = [c.key for c in mapper.columns if c.primary_key]
        assert 'player_id' in pk_cols

    def test_player_can_be_created(self, db_session):
        from app.database.models import Player

        player = Player(name='Adam')
        db_session.add(player)
        db_session.commit()

        result = db_session.query(Player).first()
        assert result.name == 'Adam'
        assert result.player_id is not None

    def test_player_created_at_has_default(self, db_session):
        from app.database.models import Player

        player = Player(name='Gil')
        db_session.add(player)
        db_session.commit()

        result = db_session.query(Player).first()
        assert result.created_at is not None
        assert isinstance(result.created_at, datetime)


class TestPlayerNameUniqueness:
    """AC-2: name uniqueness is enforced at the DB level."""

    def test_duplicate_name_raises_integrity_error(self, db_session):
        from app.database.models import Player

        p1 = Player(name='Adam')
        p2 = Player(name='Adam')
        db_session.add(p1)
        db_session.commit()
        db_session.add(p2)
        with pytest.raises(IntegrityError):
            db_session.flush()


class TestPlayerInBaseMetadata:
    """AC-3: Model imports cleanly and Base.metadata includes it."""

    def test_player_table_in_base_metadata(self):
        from app.database.models import Base

        assert 'players' in Base.metadata.tables
