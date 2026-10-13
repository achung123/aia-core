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


# ---------------------------------------------------------------------------
# AC-4: Player.hands_played relationship (T-044)
# ---------------------------------------------------------------------------


class TestPlayerHandsPlayedRelationship:
    """AC-4: Player.hands_played is a relationship to PlayerHand with back_populates."""

    def test_player_has_hands_played_attribute(self):
        from app.database.models import Player

        assert hasattr(Player, 'hands_played'), (
            'Player model must have a hands_played attribute'
        )

    def test_player_hands_played_is_relationship(self):
        from sqlalchemy import inspect
        from app.database.models import Player

        mapper = inspect(Player)
        rel_keys = {r.key for r in mapper.relationships}
        assert 'hands_played' in rel_keys, (
            'Player.hands_played must be a SQLAlchemy relationship'
        )

    def test_player_hands_played_back_populates_player(self):
        from sqlalchemy import inspect
        from app.database.models import Player

        mapper = inspect(Player)
        rel = next(r for r in mapper.relationships if r.key == 'hands_played')
        assert rel.back_populates == 'player', (
            f"Player.hands_played.back_populates must be 'player', got {rel.back_populates!r}"
        )

    def test_player_hands_played_traversal(self, db_session):
        from app.database.models import GameSession, Hand, Player, PlayerHand
        from datetime import date

        game = GameSession(game_date=date(2026, 3, 9))
        db_session.add(game)
        db_session.flush()

        hand = Hand(
            game_id=game.game_id,
            hand_number=1,
            flop_1='AS',
            flop_2='KH',
            flop_3='QD',
        )
        db_session.add(hand)
        db_session.flush()

        player = Player(name='TestPlayer')
        db_session.add(player)
        db_session.flush()

        ph = PlayerHand(
            hand_id=hand.hand_id,
            player_id=player.player_id,
            card_1='2C',
            card_2='3D',
        )
        db_session.add(ph)
        db_session.commit()

        db_session.refresh(player)
        assert len(player.hands_played) == 1
        assert player.hands_played[0].card_1 == '2C'
