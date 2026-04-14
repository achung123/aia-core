"""Tests for T-003 / aia-core-7jw1: PlayerHandAction SQLAlchemy model."""

from datetime import date, datetime

import pytest
from sqlalchemy import create_engine, event, inspect, StaticPool
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker

from app.database.models import Base, PlayerHandAction


@pytest.fixture
def db_session():
    """Create an in-memory SQLite database with all model tables."""
    engine = create_engine(
        'sqlite:///:memory:',
        connect_args={'check_same_thread': False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, 'connect')
    def _set_sqlite_pragma(dbapi_conn, _connection_record):
        cursor = dbapi_conn.cursor()
        cursor.execute('PRAGMA foreign_keys=ON')
        cursor.close()

    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()
    Base.metadata.drop_all(bind=engine)


class TestPlayerHandActionModelExists:
    """AC-1: PlayerHandAction model exists with correct table and columns."""

    def test_importable(self):
        assert PlayerHandAction is not None

    def test_tablename(self):
        assert PlayerHandAction.__tablename__ == 'player_hand_actions'

    def test_has_action_id_column(self):
        mapper = inspect(PlayerHandAction)
        columns = {c.key for c in mapper.columns}
        assert 'action_id' in columns

    def test_has_player_hand_id_column(self):
        mapper = inspect(PlayerHandAction)
        columns = {c.key for c in mapper.columns}
        assert 'player_hand_id' in columns

    def test_has_street_column(self):
        mapper = inspect(PlayerHandAction)
        columns = {c.key for c in mapper.columns}
        assert 'street' in columns

    def test_has_action_column(self):
        mapper = inspect(PlayerHandAction)
        columns = {c.key for c in mapper.columns}
        assert 'action' in columns

    def test_has_amount_column(self):
        mapper = inspect(PlayerHandAction)
        columns = {c.key for c in mapper.columns}
        assert 'amount' in columns

    def test_has_created_at_column(self):
        mapper = inspect(PlayerHandAction)
        columns = {c.key for c in mapper.columns}
        assert 'created_at' in columns

    def test_action_id_is_primary_key(self):
        mapper = inspect(PlayerHandAction)
        pk_cols = [c.key for c in mapper.columns if c.primary_key]
        assert 'action_id' in pk_cols


class TestPlayerHandActionSchema:
    """AC-1: Column constraints match the spec."""

    def test_player_hand_id_not_nullable(self):
        mapper = inspect(PlayerHandAction)
        col = mapper.columns['player_hand_id']
        assert col.nullable is False

    def test_street_not_nullable(self):
        mapper = inspect(PlayerHandAction)
        col = mapper.columns['street']
        assert col.nullable is False

    def test_action_not_nullable(self):
        mapper = inspect(PlayerHandAction)
        col = mapper.columns['action']
        assert col.nullable is False

    def test_amount_nullable(self):
        mapper = inspect(PlayerHandAction)
        col = mapper.columns['amount']
        assert col.nullable is True

    def test_player_hand_id_is_foreign_key(self):
        mapper = inspect(PlayerHandAction)
        col = mapper.columns['player_hand_id']
        fk_targets = {fk.target_fullname for fk in col.foreign_keys}
        assert 'player_hands.player_hand_id' in fk_targets


class TestPlayerHandActionCRUD:
    """AC-1/2: Can create, persist, and query PlayerHandAction rows."""

    def _create_player_hand(self, db_session):
        """Helper to create prerequisite Player, GameSession, Hand, PlayerHand."""
        from app.database.models import GameSession, Hand, Player, PlayerHand

        player = Player(name='TestPlayer')
        db_session.add(player)
        db_session.flush()

        game = GameSession(game_date=date(2026, 4, 12))
        db_session.add(game)
        db_session.flush()

        hand = Hand(game_id=game.game_id, hand_number=1)
        db_session.add(hand)
        db_session.flush()

        ph = PlayerHand(hand_id=hand.hand_id, player_id=player.player_id)
        db_session.add(ph)
        db_session.flush()
        return ph

    def test_create_action(self, db_session):
        ph = self._create_player_hand(db_session)
        action = PlayerHandAction(
            player_hand_id=ph.player_hand_id,
            street='preflop',
            action='raise',
            amount=50.0,
        )
        db_session.add(action)
        db_session.commit()

        result = db_session.query(PlayerHandAction).first()
        assert result is not None
        assert result.street == 'preflop'
        assert result.action == 'raise'
        assert result.amount == 50.0

    def test_create_action_without_amount(self, db_session):
        ph = self._create_player_hand(db_session)
        action = PlayerHandAction(
            player_hand_id=ph.player_hand_id,
            street='flop',
            action='check',
        )
        db_session.add(action)
        db_session.commit()

        result = db_session.query(PlayerHandAction).first()
        assert result.amount is None

    def test_created_at_defaults(self, db_session):
        ph = self._create_player_hand(db_session)
        action = PlayerHandAction(
            player_hand_id=ph.player_hand_id,
            street='preflop',
            action='fold',
        )
        db_session.add(action)
        db_session.commit()

        result = db_session.query(PlayerHandAction).first()
        assert result.created_at is not None
        assert isinstance(result.created_at, datetime)

    def test_foreign_key_enforced(self, db_session):
        """Cannot insert with a non-existent player_hand_id."""
        action = PlayerHandAction(
            player_hand_id=99999,
            street='preflop',
            action='fold',
        )
        db_session.add(action)
        with pytest.raises(IntegrityError):
            db_session.commit()


class TestPlayerHandActionRelationships:
    """AC-3: Bidirectional relationship between PlayerHand and PlayerHandAction."""

    def _create_player_hand(self, db_session):
        from app.database.models import GameSession, Hand, Player, PlayerHand

        player = Player(name='RelPlayer')
        db_session.add(player)
        db_session.flush()

        game = GameSession(game_date=date(2026, 4, 12))
        db_session.add(game)
        db_session.flush()

        hand = Hand(game_id=game.game_id, hand_number=1)
        db_session.add(hand)
        db_session.flush()

        ph = PlayerHand(hand_id=hand.hand_id, player_id=player.player_id)
        db_session.add(ph)
        db_session.flush()
        return ph

    def test_player_hand_has_actions_attribute(self):
        from app.database.models import PlayerHand

        mapper = inspect(PlayerHand)
        assert 'actions' in mapper.relationships.keys()

    def test_action_has_player_hand_attribute(self):
        mapper = inspect(PlayerHandAction)
        assert 'player_hand' in mapper.relationships.keys()

    def test_navigate_player_hand_to_actions(self, db_session):
        ph = self._create_player_hand(db_session)
        a1 = PlayerHandAction(
            player_hand_id=ph.player_hand_id,
            street='preflop',
            action='call',
            amount=10.0,
        )
        a2 = PlayerHandAction(
            player_hand_id=ph.player_hand_id, street='flop', action='bet', amount=25.0
        )
        db_session.add_all([a1, a2])
        db_session.commit()

        db_session.refresh(ph)
        assert len(ph.actions) == 2
        streets = {a.street for a in ph.actions}
        assert streets == {'preflop', 'flop'}

    def test_navigate_action_to_player_hand(self, db_session):
        ph = self._create_player_hand(db_session)
        action = PlayerHandAction(
            player_hand_id=ph.player_hand_id, street='river', action='fold'
        )
        db_session.add(action)
        db_session.commit()

        db_session.refresh(action)
        assert action.player_hand is not None
        assert action.player_hand.player_hand_id == ph.player_hand_id
