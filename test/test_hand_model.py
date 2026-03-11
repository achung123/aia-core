"""Tests for T-004: Hand SQLAlchemy model."""

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


class TestHandModelExists:
    """AC-1: Hand model exists with all specified columns and FK to GameSession."""

    def test_hand_importable(self):
        from app.database.models import Hand

        assert Hand is not None

    def test_hand_has_correct_tablename(self):
        from app.database.models import Hand

        assert Hand.__tablename__ == 'hands'

    def test_hand_has_hand_id_column(self):
        from app.database.models import Hand

        mapper = inspect(Hand)
        columns = {c.key for c in mapper.columns}
        assert 'hand_id' in columns

    def test_hand_has_game_id_column(self):
        from app.database.models import Hand

        mapper = inspect(Hand)
        columns = {c.key for c in mapper.columns}
        assert 'game_id' in columns

    def test_hand_has_hand_number_column(self):
        from app.database.models import Hand

        mapper = inspect(Hand)
        columns = {c.key for c in mapper.columns}
        assert 'hand_number' in columns

    def test_hand_has_flop_columns(self):
        from app.database.models import Hand

        mapper = inspect(Hand)
        columns = {c.key for c in mapper.columns}
        assert 'flop_1' in columns
        assert 'flop_2' in columns
        assert 'flop_3' in columns

    def test_hand_has_turn_column(self):
        from app.database.models import Hand

        mapper = inspect(Hand)
        columns = {c.key for c in mapper.columns}
        assert 'turn' in columns

    def test_hand_has_river_column(self):
        from app.database.models import Hand

        mapper = inspect(Hand)
        columns = {c.key for c in mapper.columns}
        assert 'river' in columns

    def test_hand_has_created_at_column(self):
        from app.database.models import Hand

        mapper = inspect(Hand)
        columns = {c.key for c in mapper.columns}
        assert 'created_at' in columns

    def test_hand_id_is_primary_key(self):
        from app.database.models import Hand

        mapper = inspect(Hand)
        pk_cols = [c.key for c in mapper.columns if c.primary_key]
        assert 'hand_id' in pk_cols

    def test_game_id_is_foreign_key(self):
        from app.database.models import Hand

        mapper = inspect(Hand)
        game_id_col = next(c for c in mapper.columns if c.key == 'game_id')
        fk_targets = {fk.target_fullname for fk in game_id_col.foreign_keys}
        assert 'game_sessions.game_id' in fk_targets

    def test_flop_columns_are_not_nullable(self):
        from app.database.models import Hand

        mapper = inspect(Hand)
        for col_name in ('flop_1', 'flop_2', 'flop_3'):
            col = next(c for c in mapper.columns if c.key == col_name)
            assert not col.nullable, f'{col_name} should not be nullable'

    def test_hand_can_be_created(self, db_session):
        from app.database.models import GameSession, Hand

        game = GameSession(game_date=date(2026, 3, 9))
        db_session.add(game)
        db_session.commit()

        hand = Hand(
            game_id=game.game_id,
            hand_number=1,
            flop_1='AS',
            flop_2='KH',
            flop_3='QD',
        )
        db_session.add(hand)
        db_session.commit()

        result = db_session.query(Hand).first()
        assert result.hand_id is not None
        assert result.game_id == game.game_id
        assert result.hand_number == 1
        assert result.flop_1 == 'AS'

    def test_hand_created_at_has_default(self, db_session):
        from app.database.models import GameSession, Hand

        game = GameSession(game_date=date(2026, 3, 9))
        db_session.add(game)
        db_session.commit()

        hand = Hand(
            game_id=game.game_id,
            hand_number=1,
            flop_1='AS',
            flop_2='KH',
            flop_3='QD',
        )
        db_session.add(hand)
        db_session.commit()

        result = db_session.query(Hand).first()
        assert result.created_at is not None
        assert isinstance(result.created_at, datetime)


class TestHandUniqueConstraint:
    """AC-2: Unique constraint on (game_id, hand_number) prevents duplicates."""

    def test_duplicate_hand_number_same_game_raises_integrity_error(self, db_session):
        from app.database.models import GameSession, Hand

        game = GameSession(game_date=date(2026, 3, 9))
        db_session.add(game)
        db_session.commit()

        h1 = Hand(
            game_id=game.game_id,
            hand_number=1,
            flop_1='AS',
            flop_2='KH',
            flop_3='QD',
        )
        h2 = Hand(
            game_id=game.game_id,
            hand_number=1,
            flop_1='2C',
            flop_2='3D',
            flop_3='4S',
        )
        db_session.add(h1)
        db_session.commit()
        db_session.add(h2)
        with pytest.raises(IntegrityError):
            db_session.flush()

    def test_same_hand_number_different_games_allowed(self, db_session):
        from app.database.models import GameSession, Hand

        g1 = GameSession(game_date=date(2026, 3, 9))
        g2 = GameSession(game_date=date(2026, 3, 10))
        db_session.add_all([g1, g2])
        db_session.commit()

        h1 = Hand(
            game_id=g1.game_id,
            hand_number=1,
            flop_1='AS',
            flop_2='KH',
            flop_3='QD',
        )
        h2 = Hand(
            game_id=g2.game_id,
            hand_number=1,
            flop_1='2C',
            flop_2='3D',
            flop_3='4S',
        )
        db_session.add_all([h1, h2])
        db_session.commit()

        assert db_session.query(Hand).count() == 2


class TestHandNullableColumns:
    """AC-3: turn and river are nullable."""

    def test_turn_is_nullable(self, db_session):
        from app.database.models import GameSession, Hand

        game = GameSession(game_date=date(2026, 3, 9))
        db_session.add(game)
        db_session.commit()

        hand = Hand(
            game_id=game.game_id,
            hand_number=1,
            flop_1='AS',
            flop_2='KH',
            flop_3='QD',
            turn=None,
            river='5C',
        )
        db_session.add(hand)
        db_session.commit()

        result = db_session.query(Hand).first()
        assert result.turn is None

    def test_river_is_nullable(self, db_session):
        from app.database.models import GameSession, Hand

        game = GameSession(game_date=date(2026, 3, 9))
        db_session.add(game)
        db_session.commit()

        hand = Hand(
            game_id=game.game_id,
            hand_number=1,
            flop_1='AS',
            flop_2='KH',
            flop_3='QD',
            turn='JC',
            river=None,
        )
        db_session.add(hand)
        db_session.commit()

        result = db_session.query(Hand).first()
        assert result.river is None

    def test_both_turn_and_river_nullable(self, db_session):
        from app.database.models import GameSession, Hand

        game = GameSession(game_date=date(2026, 3, 9))
        db_session.add(game)
        db_session.commit()

        hand = Hand(
            game_id=game.game_id,
            hand_number=1,
            flop_1='AS',
            flop_2='KH',
            flop_3='QD',
        )
        db_session.add(hand)
        db_session.commit()

        result = db_session.query(Hand).first()
        assert result.turn is None
        assert result.river is None

    def test_turn_and_river_can_be_set(self, db_session):
        from app.database.models import GameSession, Hand

        game = GameSession(game_date=date(2026, 3, 9))
        db_session.add(game)
        db_session.commit()

        hand = Hand(
            game_id=game.game_id,
            hand_number=1,
            flop_1='AS',
            flop_2='KH',
            flop_3='QD',
            turn='JC',
            river='5C',
        )
        db_session.add(hand)
        db_session.commit()

        result = db_session.query(Hand).first()
        assert result.turn == 'JC'
        assert result.river == '5C'


class TestGameSessionHandsRelationship:
    """GameSession.hands relationship returns associated Hand objects."""

    def test_game_session_has_hands_relationship(self, db_session):
        from app.database.models import GameSession, Hand

        game = GameSession(game_date=date(2026, 3, 9))
        db_session.add(game)
        db_session.commit()

        h1 = Hand(
            game_id=game.game_id,
            hand_number=1,
            flop_1='AS',
            flop_2='KH',
            flop_3='QD',
        )
        h2 = Hand(
            game_id=game.game_id,
            hand_number=2,
            flop_1='2C',
            flop_2='3D',
            flop_3='4S',
        )
        db_session.add_all([h1, h2])
        db_session.commit()

        db_session.refresh(game)
        assert len(game.hands) == 2
        hand_numbers = {h.hand_number for h in game.hands}
        assert hand_numbers == {1, 2}


class TestHandInBaseMetadata:
    """Hand table is registered in Base.metadata."""

    def test_hands_table_in_base_metadata(self):
        from app.database.models import Base

        assert 'hands' in Base.metadata.tables
