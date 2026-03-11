from datetime import date, datetime, timezone

from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String
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


class GamePlayer(Base):
    __tablename__ = 'game_players'

    game_id = Column(
        Integer, ForeignKey('game_sessions.game_id'), primary_key=True
    )
    player_id = Column(
        Integer, ForeignKey('players.player_id'), primary_key=True
    )
