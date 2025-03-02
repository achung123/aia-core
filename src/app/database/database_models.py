from sqlalchemy import Boolean, Column, Float, Integer, String, create_engine
from sqlalchemy.ext.declarative import declarative_base

db_url = "sqlite:///poker_game.db"
engine = create_engine(db_url)

Base = declarative_base()


class Game(Base):
    __tablename__ = "game"

    game_id = Column(Integer, primary_key=True, autoincrement=True)
    game_date = Column(String)
    winner = Column(String)
    losers = Column(String)


class Hand(Base):
    __tablename__ = "hand"

    id = Column(Integer, primary_key=True, autoincrement=True)
    game_id = Column(String)
    player_id = Column(String)
    hand_number = Column(Integer)
    hole_card = Column(String)
    on_cheese = Column(Boolean)


class Community(Base):
    __tablename__ = "community"

    id = Column(Integer, primary_key=True, autoincrement=True)
    game_id = Column(String)
    hand_number = Column(Integer)
    board_cards = Column(String)
    active_players = Column(String)


class GameStatistc(Base):
    __tablename__ = "game_statistic"

    id = Column(Integer, primary_key=True, autoincrement=True)
    game_id = Column(String)
    player_id = Column(String)
    best_hands = Column(String)
    hole_cards = Column(String)


class PlayerStatistc(Base):
    __tablename__ = "player_statistc"

    id = Column(Integer, primary_key=True, autoincrement=True)
    start_date = Column(Integer)
    end_date = Column(Integer)
    player_id = Column(String)
    win_rate = Column(Float)
    best_hand = Column(String)


Base.metadata.create_all(engine)
