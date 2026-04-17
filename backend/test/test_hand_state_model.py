"""Tests for HandState model — schema, FK, unique constraint, and defaults."""

from datetime import datetime, timezone

from sqlalchemy import create_engine, inspect, StaticPool
from sqlalchemy.orm import sessionmaker

from app.database.models import Base, GameSession, Hand, HandState


engine = create_engine(
    'sqlite:///:memory:',
    connect_args={'check_same_thread': False},
    poolclass=StaticPool,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def _setup():
    Base.metadata.create_all(bind=engine)
    return SessionLocal()


def _teardown(db):
    db.close()
    Base.metadata.drop_all(bind=engine)


def _create_game_and_hand(db):
    """Helper to create prerequisite game session and hand."""
    game = GameSession(game_date=datetime(2026, 4, 12, tzinfo=timezone.utc))
    db.add(game)
    db.flush()
    hand = Hand(game_id=game.game_id, hand_number=1)
    db.add(hand)
    db.flush()
    return game, hand


class TestHandStateTableSchema:
    """Verify the hand_states table columns, types, and constraints."""

    def test_table_exists(self):
        db = _setup()
        try:
            inspector = inspect(engine)
            assert 'hand_states' in inspector.get_table_names()
        finally:
            _teardown(db)

    def test_columns_present(self):
        db = _setup()
        try:
            inspector = inspect(engine)
            col_names = [c['name'] for c in inspector.get_columns('hand_states')]
            assert 'hand_state_id' in col_names
            assert 'hand_id' in col_names
            assert 'phase' in col_names
            assert 'current_seat' in col_names
            assert 'action_index' in col_names
            assert 'updated_at' in col_names
        finally:
            _teardown(db)

    def test_hand_id_foreign_key(self):
        db = _setup()
        try:
            inspector = inspect(engine)
            fks = inspector.get_foreign_keys('hand_states')
            hand_id_fk = [fk for fk in fks if 'hand_id' in fk['constrained_columns']]
            assert len(hand_id_fk) == 1
            assert hand_id_fk[0]['referred_table'] == 'hands'
            assert hand_id_fk[0]['referred_columns'] == ['hand_id']
        finally:
            _teardown(db)

    def test_hand_id_unique_constraint(self):
        db = _setup()
        try:
            inspector = inspect(engine)
            unique_constraints = inspector.get_unique_constraints('hand_states')
            # hand_id should be unique (either via unique=True on column or UniqueConstraint)
            unique_cols = []
            for uc in unique_constraints:
                unique_cols.extend(uc['column_names'])
            # Also check column-level unique
            # cols = inspector.get_columns("hand_states")  # unused
            # SQLite might report unique via index, check indexes too
            indexes = inspector.get_indexes('hand_states')
            unique_index_cols = []
            for idx in indexes:
                if idx.get('unique'):
                    unique_index_cols.extend(idx['column_names'])
            assert 'hand_id' in unique_cols or 'hand_id' in unique_index_cols
        finally:
            _teardown(db)


class TestHandStateDefaults:
    """Verify default values when creating a HandState with minimal args."""

    def test_phase_defaults_to_preflop(self):
        db = _setup()
        try:
            _, hand = _create_game_and_hand(db)
            state = HandState(hand_id=hand.hand_id)
            db.add(state)
            db.flush()
            assert state.phase == 'preflop'
        finally:
            _teardown(db)

    def test_action_index_defaults_to_zero(self):
        db = _setup()
        try:
            _, hand = _create_game_and_hand(db)
            state = HandState(hand_id=hand.hand_id)
            db.add(state)
            db.flush()
            assert state.action_index == 0
        finally:
            _teardown(db)

    def test_current_seat_nullable(self):
        db = _setup()
        try:
            _, hand = _create_game_and_hand(db)
            state = HandState(hand_id=hand.hand_id)
            db.add(state)
            db.flush()
            assert state.current_seat is None
        finally:
            _teardown(db)

    def test_updated_at_populated(self):
        db = _setup()
        try:
            _, hand = _create_game_and_hand(db)
            state = HandState(hand_id=hand.hand_id)
            db.add(state)
            db.flush()
            assert state.updated_at is not None
            assert isinstance(state.updated_at, datetime)
        finally:
            _teardown(db)

    def test_hand_state_id_auto_increments(self):
        db = _setup()
        try:
            _, hand = _create_game_and_hand(db)
            state = HandState(hand_id=hand.hand_id)
            db.add(state)
            db.flush()
            assert state.hand_state_id is not None
            assert isinstance(state.hand_state_id, int)
        finally:
            _teardown(db)


class TestHandStateRelationship:
    """Verify ORM relationships between Hand and HandState."""

    def test_hand_state_has_hand_relationship(self):
        db = _setup()
        try:
            _, hand = _create_game_and_hand(db)
            state = HandState(hand_id=hand.hand_id)
            db.add(state)
            db.flush()
            assert state.hand is not None
            assert state.hand.hand_id == hand.hand_id
        finally:
            _teardown(db)

    def test_hand_has_state_relationship(self):
        db = _setup()
        try:
            _, hand = _create_game_and_hand(db)
            state = HandState(hand_id=hand.hand_id)
            db.add(state)
            db.flush()
            db.refresh(hand)
            assert hand.state is not None
            assert hand.state.hand_state_id == state.hand_state_id
        finally:
            _teardown(db)


class TestHandStateExplicitValues:
    """Verify explicit values override defaults."""

    def test_explicit_phase(self):
        db = _setup()
        try:
            _, hand = _create_game_and_hand(db)
            state = HandState(
                hand_id=hand.hand_id, phase='flop', current_seat=3, action_index=5
            )
            db.add(state)
            db.flush()
            assert state.phase == 'flop'
            assert state.current_seat == 3
            assert state.action_index == 5
        finally:
            _teardown(db)
