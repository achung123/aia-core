"""Tests for T-002: sb_player_id and bb_player_id on Hand model."""

from datetime import date

from sqlalchemy import create_engine, inspect, StaticPool
from sqlalchemy.orm import sessionmaker


def _make_session():
    from app.database.models import Base

    engine = create_engine(
        'sqlite:///:memory:',
        connect_args={'check_same_thread': False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    return Session(), engine


class TestSbBbColumnsExist:
    """AC-1 & AC-2: Hand model has sb_player_id and bb_player_id columns."""

    def test_hand_has_sb_player_id_column(self):
        from app.database.models import Hand

        mapper = inspect(Hand)
        columns = {c.key for c in mapper.columns}
        assert 'sb_player_id' in columns

    def test_hand_has_bb_player_id_column(self):
        from app.database.models import Hand

        mapper = inspect(Hand)
        columns = {c.key for c in mapper.columns}
        assert 'bb_player_id' in columns


class TestSbBbNullable:
    """AC-1: Both columns are nullable."""

    def test_sb_player_id_is_nullable(self):
        from app.database.models import Hand

        col = Hand.__table__.columns['sb_player_id']
        assert col.nullable is True

    def test_bb_player_id_is_nullable(self):
        from app.database.models import Hand

        col = Hand.__table__.columns['bb_player_id']
        assert col.nullable is True


class TestSbBbForeignKeys:
    """AC-1: Both columns are ForeignKey('players.player_id')."""

    def test_sb_player_id_fk_target(self):
        from app.database.models import Hand

        col = Hand.__table__.columns['sb_player_id']
        fk_targets = {fk.target_fullname for fk in col.foreign_keys}
        assert 'players.player_id' in fk_targets

    def test_bb_player_id_fk_target(self):
        from app.database.models import Hand

        col = Hand.__table__.columns['bb_player_id']
        fk_targets = {fk.target_fullname for fk in col.foreign_keys}
        assert 'players.player_id' in fk_targets


class TestSbBbIntegerType:
    """AC-1: Both columns are Integer type."""

    def test_sb_player_id_is_integer(self):
        from app.database.models import Hand

        col = Hand.__table__.columns['sb_player_id']
        assert isinstance(col.type, type(Hand.__table__.columns['hand_id'].type))

    def test_bb_player_id_is_integer(self):
        from app.database.models import Hand

        col = Hand.__table__.columns['bb_player_id']
        assert isinstance(col.type, type(Hand.__table__.columns['hand_id'].type))


class TestSbBbDefaultNull:
    """AC-3: Existing hands retain null values for both columns."""

    def test_hand_created_without_sb_bb_has_nulls(self):
        from app.database.models import GameSession, Hand

        session, engine = _make_session()
        try:
            game = GameSession(game_date=date(2026, 4, 12), status='active')
            session.add(game)
            session.flush()

            hand = Hand(game_id=game.game_id, hand_number=1)
            session.add(hand)
            session.flush()

            assert hand.sb_player_id is None
            assert hand.bb_player_id is None
        finally:
            session.close()

    def test_hand_with_sb_bb_set(self):
        from app.database.models import GameSession, Hand, Player

        session, engine = _make_session()
        try:
            game = GameSession(game_date=date(2026, 4, 12), status='active')
            session.add(game)
            session.flush()

            p1 = Player(name='Alice')
            p2 = Player(name='Bob')
            session.add_all([p1, p2])
            session.flush()

            hand = Hand(
                game_id=game.game_id,
                hand_number=1,
                sb_player_id=p1.player_id,
                bb_player_id=p2.player_id,
            )
            session.add(hand)
            session.flush()

            assert hand.sb_player_id == p1.player_id
            assert hand.bb_player_id == p2.player_id
        finally:
            session.close()
