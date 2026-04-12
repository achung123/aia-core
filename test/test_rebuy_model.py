"""Tests for the Rebuy model — schema, FK relationships, and CRUD."""

from datetime import datetime, timezone

import pytest
from sqlalchemy import create_engine, inspect, StaticPool
from sqlalchemy.orm import sessionmaker

from app.database.models import Base, GameSession, Rebuy


@pytest.fixture
def db_session():
    """Create an in-memory SQLite database with all model tables."""
    engine = create_engine(
        'sqlite:///:memory:',
        connect_args={'check_same_thread': False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session, engine
    session.close()
    Base.metadata.drop_all(bind=engine)


class TestRebuyTableSchema:
    """Verify the rebuys table has the correct columns and constraints."""

    def test_table_name(self):
        assert Rebuy.__tablename__ == 'rebuys'

    def test_columns_exist(self, db_session):
        _, engine = db_session
        inspector = inspect(engine)
        columns = {col['name'] for col in inspector.get_columns('rebuys')}
        assert columns == {'rebuy_id', 'game_id', 'player_name', 'amount', 'created_at'}

    def test_primary_key(self, db_session):
        _, engine = db_session
        inspector = inspect(engine)
        pk = inspector.get_pk_constraint('rebuys')
        assert pk['constrained_columns'] == ['rebuy_id']

    def test_game_id_foreign_key(self, db_session):
        _, engine = db_session
        inspector = inspect(engine)
        fks = inspector.get_foreign_keys('rebuys')
        game_fk = [fk for fk in fks if fk['referred_table'] == 'game_sessions']
        assert len(game_fk) == 1
        assert game_fk[0]['constrained_columns'] == ['game_id']
        assert game_fk[0]['referred_columns'] == ['game_id']

    def test_game_id_not_nullable(self, db_session):
        _, engine = db_session
        inspector = inspect(engine)
        cols = {col['name']: col for col in inspector.get_columns('rebuys')}
        assert cols['game_id']['nullable'] is False

    def test_player_name_not_nullable(self, db_session):
        _, engine = db_session
        inspector = inspect(engine)
        cols = {col['name']: col for col in inspector.get_columns('rebuys')}
        assert cols['player_name']['nullable'] is False

    def test_amount_not_nullable(self, db_session):
        _, engine = db_session
        inspector = inspect(engine)
        cols = {col['name']: col for col in inspector.get_columns('rebuys')}
        assert cols['amount']['nullable'] is False


class TestRebuyCRUD:
    """Verify basic CRUD operations on the Rebuy model."""

    def _create_game(self, db):
        game = GameSession(
            game_date=datetime(2026, 4, 12, tzinfo=timezone.utc).date(),
            status='active',
        )
        db.add(game)
        db.commit()
        db.refresh(game)
        return game

    def test_create_rebuy(self, db_session):
        db, _ = db_session
        game = self._create_game(db)
        rebuy = Rebuy(
            game_id=game.game_id,
            player_name='Alice',
            amount=20.0,
        )
        db.add(rebuy)
        db.commit()
        db.refresh(rebuy)

        assert rebuy.rebuy_id is not None
        assert rebuy.game_id == game.game_id
        assert rebuy.player_name == 'Alice'
        assert rebuy.amount == 20.0
        assert rebuy.created_at is not None

    def test_created_at_defaults_to_utcnow(self, db_session):
        db, _ = db_session
        game = self._create_game(db)
        before = datetime.now(timezone.utc)
        rebuy = Rebuy(
            game_id=game.game_id,
            player_name='Bob',
            amount=10.0,
        )
        db.add(rebuy)
        db.commit()
        db.refresh(rebuy)
        after = datetime.now(timezone.utc)

        created = rebuy.created_at.replace(tzinfo=None)
        assert before.replace(tzinfo=None) <= created <= after.replace(tzinfo=None)

    def test_multiple_rebuys_per_game(self, db_session):
        db, _ = db_session
        game = self._create_game(db)
        for name in ['Alice', 'Bob', 'Alice']:
            db.add(Rebuy(game_id=game.game_id, player_name=name, amount=20.0))
        db.commit()

        rebuys = db.query(Rebuy).filter_by(game_id=game.game_id).all()
        assert len(rebuys) == 3

    def test_rebuy_id_autoincrement(self, db_session):
        db, _ = db_session
        game = self._create_game(db)
        r1 = Rebuy(game_id=game.game_id, player_name='Alice', amount=10.0)
        r2 = Rebuy(game_id=game.game_id, player_name='Bob', amount=15.0)
        db.add_all([r1, r2])
        db.commit()
        db.refresh(r1)
        db.refresh(r2)
        assert r2.rebuy_id > r1.rebuy_id
