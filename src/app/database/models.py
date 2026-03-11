from datetime import date, datetime, timezone

from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class Player(Base):
    __tablename__ = 'players'

    player_id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, unique=True, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    games = relationship(
        'GameSession', secondary='game_players', back_populates='players'
    )


class GameSession(Base):
    __tablename__ = 'game_sessions'

    game_id = Column(Integer, primary_key=True, autoincrement=True)
    game_date = Column(Date, nullable=False)
    status = Column(String, nullable=False, default='active')
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    players = relationship(
        'Player', secondary='game_players', back_populates='games'
    )

    hands = relationship('Hand', back_populates='game_session')


class GamePlayer(Base):
    __tablename__ = 'game_players'

    game_id = Column(
        Integer, ForeignKey('game_sessions.game_id'), primary_key=True
    )
    player_id = Column(
        Integer, ForeignKey('players.player_id'), primary_key=True
    )


class Hand(Base):
    __tablename__ = 'hands'
    __table_args__ = (
        UniqueConstraint('game_id', 'hand_number', name='uq_hand_game_number'),
    )

    hand_id = Column(Integer, primary_key=True, autoincrement=True)
    game_id = Column(Integer, ForeignKey('game_sessions.game_id'), nullable=False)
    hand_number = Column(Integer, nullable=False)
    flop_1 = Column(String, nullable=False)
    flop_2 = Column(String, nullable=False)
    flop_3 = Column(String, nullable=False)
    turn = Column(String, nullable=True)
    river = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    game_session = relationship('GameSession', back_populates='hands')
