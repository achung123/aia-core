from sqlalchemy import Column, Integer, String, create_engine
from sqlalchemy.ext.declarative import declarative_base

db_url = "sqlite:///poker_game.db"
engine = create_engine(db_url)

Base = declarative_base()


class Player(Base):
    __tablename__ = "players"

    id = Column(Integer, primary_key=True, autoincrement=True)  # Add an explicit PK
    game_uuid = Column(String, index=True)
    game_date = Column(String)
    player_id = Column(String)
    hand_number = Column(Integer)
    hole_card_1 = Column(String)
    hole_card_2 = Column(String)


class Game(Base):
    __tablename__ = "game"

    id = Column(Integer, primary_key=True, autoincrement=True)
    game_uuid = Column(String, index=True)
    game_date = Column(String)


class Dealer(Base):
    __tablename__ = "dealer"

    id = Column(Integer, primary_key=True, autoincrement=True)
    game_uuid = Column(String, index=True)
    game_date = Column(String)
    flop_card_1 = Column(String)
    flop_card_2 = Column(String)
    flop_card_3 = Column(String)
    turn_card = Column(String)
    river_card = Column(String)


Base.metadata.create_all(engine)
