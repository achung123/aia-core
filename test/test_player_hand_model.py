"""Tests for T-005: PlayerHand SQLAlchemy model."""

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


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_hand(db_session, hand_number=1):
    from app.database.models import GameSession, Hand

    game = GameSession(game_date=date(2026, 3, 9))
    db_session.add(game)
    db_session.flush()

    hand = Hand(
        game_id=game.game_id,
        hand_number=hand_number,
        flop_1='AS',
        flop_2='KH',
        flop_3='QD',
    )
    db_session.add(hand)
    db_session.flush()
    return hand


def _make_player(db_session, name='Alice'):
    from app.database.models import Player

    player = Player(name=name)
    db_session.add(player)
    db_session.flush()
    return player


# ---------------------------------------------------------------------------
# AC-1: PlayerHand model exists with all specified columns
# ---------------------------------------------------------------------------

class TestPlayerHandModelExists:
    """AC-1: PlayerHand model exists with all columns and correct tablename."""

    def test_player_hand_importable(self):
        from app.database.models import PlayerHand

        assert PlayerHand is not None

    def test_player_hand_has_correct_tablename(self):
        from app.database.models import PlayerHand

        assert PlayerHand.__tablename__ == 'player_hands'

    def test_player_hand_has_player_hand_id_column(self):
        from app.database.models import PlayerHand

        mapper = inspect(PlayerHand)
        columns = {c.key for c in mapper.columns}
        assert 'player_hand_id' in columns

    def test_player_hand_has_hand_id_column(self):
        from app.database.models import PlayerHand

        mapper = inspect(PlayerHand)
        columns = {c.key for c in mapper.columns}
        assert 'hand_id' in columns

    def test_player_hand_has_player_id_column(self):
        from app.database.models import PlayerHand

        mapper = inspect(PlayerHand)
        columns = {c.key for c in mapper.columns}
        assert 'player_id' in columns

    def test_player_hand_has_card_1_column(self):
        from app.database.models import PlayerHand

        mapper = inspect(PlayerHand)
        columns = {c.key for c in mapper.columns}
        assert 'card_1' in columns

    def test_player_hand_has_card_2_column(self):
        from app.database.models import PlayerHand

        mapper = inspect(PlayerHand)
        columns = {c.key for c in mapper.columns}
        assert 'card_2' in columns

    def test_player_hand_has_result_column(self):
        from app.database.models import PlayerHand

        mapper = inspect(PlayerHand)
        columns = {c.key for c in mapper.columns}
        assert 'result' in columns

    def test_player_hand_has_profit_loss_column(self):
        from app.database.models import PlayerHand

        mapper = inspect(PlayerHand)
        columns = {c.key for c in mapper.columns}
        assert 'profit_loss' in columns

    def test_player_hand_has_created_at_column(self):
        from app.database.models import PlayerHand

        mapper = inspect(PlayerHand)
        columns = {c.key for c in mapper.columns}
        assert 'created_at' in columns

    def test_player_hand_id_is_primary_key(self):
        from app.database.models import PlayerHand

        mapper = inspect(PlayerHand)
        pk_cols = [c.key for c in mapper.columns if c.primary_key]
        assert 'player_hand_id' in pk_cols

    def test_player_hand_table_in_base_metadata(self):
        from app.database.models import Base

        assert 'player_hands' in Base.metadata.tables


# ---------------------------------------------------------------------------
# AC-2: Foreign keys are correctly defined
# ---------------------------------------------------------------------------

class TestPlayerHandForeignKeys:
    """AC-2: hand_id and player_id are foreign keys."""

    def test_hand_id_is_foreign_key(self):
        from app.database.models import PlayerHand

        mapper = inspect(PlayerHand)
        hand_id_col = next(c for c in mapper.columns if c.key == 'hand_id')
        fk_targets = {fk.target_fullname for fk in hand_id_col.foreign_keys}
        assert 'hands.hand_id' in fk_targets

    def test_player_id_is_foreign_key(self):
        from app.database.models import PlayerHand

        mapper = inspect(PlayerHand)
        player_id_col = next(c for c in mapper.columns if c.key == 'player_id')
        fk_targets = {fk.target_fullname for fk in player_id_col.foreign_keys}
        assert 'players.player_id' in fk_targets


# ---------------------------------------------------------------------------
# AC-3: Unique constraint on (hand_id, player_id)
# ---------------------------------------------------------------------------

class TestPlayerHandUniqueConstraint:
    """AC-3: Unique constraint on (hand_id, player_id) prevents duplicates."""

    def test_duplicate_player_in_same_hand_raises_integrity_error(self, db_session):
        from app.database.models import PlayerHand

        hand = _make_hand(db_session)
        player = _make_player(db_session)
        db_session.commit()

        ph1 = PlayerHand(
            hand_id=hand.hand_id,
            player_id=player.player_id,
            card_1='AS',
            card_2='KH',
        )
        ph2 = PlayerHand(
            hand_id=hand.hand_id,
            player_id=player.player_id,
            card_1='2C',
            card_2='3D',
        )
        db_session.add(ph1)
        db_session.flush()
        db_session.add(ph2)
        with pytest.raises(IntegrityError):
            db_session.flush()

    def test_same_player_different_hands_allowed(self, db_session):
        from app.database.models import GameSession, Hand, PlayerHand

        player = _make_player(db_session)
        hand1 = _make_hand(db_session, hand_number=1)
        hand2 = _make_hand(db_session, hand_number=2)
        db_session.commit()

        ph1 = PlayerHand(
            hand_id=hand1.hand_id,
            player_id=player.player_id,
            card_1='AS',
            card_2='KH',
        )
        ph2 = PlayerHand(
            hand_id=hand2.hand_id,
            player_id=player.player_id,
            card_1='2C',
            card_2='3D',
        )
        db_session.add_all([ph1, ph2])
        db_session.commit()

        assert db_session.query(PlayerHand).count() == 2

    def test_different_players_same_hand_allowed(self, db_session):
        from app.database.models import PlayerHand

        hand = _make_hand(db_session)
        p1 = _make_player(db_session, name='Alice')
        p2 = _make_player(db_session, name='Bob')
        db_session.commit()

        ph1 = PlayerHand(
            hand_id=hand.hand_id,
            player_id=p1.player_id,
            card_1='AS',
            card_2='KH',
        )
        ph2 = PlayerHand(
            hand_id=hand.hand_id,
            player_id=p2.player_id,
            card_1='2C',
            card_2='3D',
        )
        db_session.add_all([ph1, ph2])
        db_session.commit()

        assert db_session.query(PlayerHand).count() == 2


# ---------------------------------------------------------------------------
# AC-4: result and profit_loss are nullable
# ---------------------------------------------------------------------------

class TestPlayerHandNullableColumns:
    """AC-4: result and profit_loss are nullable."""

    def test_result_is_nullable(self):
        from app.database.models import PlayerHand

        mapper = inspect(PlayerHand)
        col = next(c for c in mapper.columns if c.key == 'result')
        assert col.nullable, 'result should be nullable'

    def test_profit_loss_is_nullable(self):
        from app.database.models import PlayerHand

        mapper = inspect(PlayerHand)
        col = next(c for c in mapper.columns if c.key == 'profit_loss')
        assert col.nullable, 'profit_loss should be nullable'

    def test_player_hand_can_be_created_without_result_and_profit_loss(self, db_session):
        from app.database.models import PlayerHand

        hand = _make_hand(db_session)
        player = _make_player(db_session)
        db_session.commit()

        ph = PlayerHand(
            hand_id=hand.hand_id,
            player_id=player.player_id,
            card_1='AS',
            card_2='KH',
        )
        db_session.add(ph)
        db_session.commit()

        result = db_session.query(PlayerHand).first()
        assert result.result is None
        assert result.profit_loss is None

    def test_result_and_profit_loss_can_be_set(self, db_session):
        from app.database.models import PlayerHand

        hand = _make_hand(db_session)
        player = _make_player(db_session)
        db_session.commit()

        ph = PlayerHand(
            hand_id=hand.hand_id,
            player_id=player.player_id,
            card_1='AS',
            card_2='KH',
            result='win',
            profit_loss=150.0,
        )
        db_session.add(ph)
        db_session.commit()

        result = db_session.query(PlayerHand).first()
        assert result.result == 'win'
        assert result.profit_loss == 150.0


# ---------------------------------------------------------------------------
# AC-5: created_at auto-populates, card_1/card_2 are stored
# ---------------------------------------------------------------------------

class TestPlayerHandCreation:
    """AC-5: Full round-trip creation with all fields."""

    def test_player_hand_can_be_created(self, db_session):
        from app.database.models import PlayerHand

        hand = _make_hand(db_session)
        player = _make_player(db_session)
        db_session.commit()

        ph = PlayerHand(
            hand_id=hand.hand_id,
            player_id=player.player_id,
            card_1='AS',
            card_2='KH',
            result='win',
            profit_loss=100.0,
        )
        db_session.add(ph)
        db_session.commit()

        result = db_session.query(PlayerHand).first()
        assert result.player_hand_id is not None
        assert result.hand_id == hand.hand_id
        assert result.player_id == player.player_id
        assert result.card_1 == 'AS'
        assert result.card_2 == 'KH'
        assert result.result == 'win'
        assert result.profit_loss == 100.0

    def test_player_hand_created_at_has_default(self, db_session):
        from app.database.models import PlayerHand

        hand = _make_hand(db_session)
        player = _make_player(db_session)
        db_session.commit()

        ph = PlayerHand(
            hand_id=hand.hand_id,
            player_id=player.player_id,
            card_1='AS',
            card_2='KH',
        )
        db_session.add(ph)
        db_session.commit()

        result = db_session.query(PlayerHand).first()
        assert result.created_at is not None
        assert isinstance(result.created_at, datetime)


# ---------------------------------------------------------------------------
# AC-6: PlayerHand.player relationship uses back_populates (T-044)
# ---------------------------------------------------------------------------

class TestPlayerHandPlayerRelationship:
    """AC-6: PlayerHand.player has back_populates='hands_played'."""

    def test_player_hand_has_player_relationship(self):
        from sqlalchemy import inspect
        from app.database.models import PlayerHand

        mapper = inspect(PlayerHand)
        rel_keys = {r.key for r in mapper.relationships}
        assert 'player' in rel_keys

    def test_player_hand_player_back_populates_hands_played(self):
        from sqlalchemy import inspect
        from app.database.models import PlayerHand

        mapper = inspect(PlayerHand)
        rel = next(r for r in mapper.relationships if r.key == 'player')
        assert rel.back_populates == 'hands_played', (
            f"PlayerHand.player.back_populates must be 'hands_played', got {rel.back_populates!r}"
        )

    def test_player_hand_player_reverse_traversal(self, db_session):
        from app.database.models import PlayerHand

        hand = _make_hand(db_session)
        player = _make_player(db_session)
        db_session.commit()

        ph = PlayerHand(
            hand_id=hand.hand_id,
            player_id=player.player_id,
            card_1='AS',
            card_2='KH',
        )
        db_session.add(ph)
        db_session.commit()

        db_session.refresh(ph)
        assert ph.player is not None
        assert ph.player.name == 'Alice'
