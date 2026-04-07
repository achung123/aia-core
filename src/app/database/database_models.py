from sqlalchemy import Column, Integer, String
from sqlalchemy.ext.declarative import declarative_base

from app.database.session import engine

Base = declarative_base()


class Community(Base):
    __tablename__ = 'community'

    id = Column(Integer, primary_key=True, index=True)
    game_date = Column(String)
    time_stamp = Column(String)
    hand_number = Column(Integer)
    flop_card_0 = Column(String)
    flop_card_1 = Column(String)
    flop_card_2 = Column(String)
    turn_card = Column(String)
    river_card = Column(String)
    players = Column(String)


class Game(Base):
    __tablename__ = 'game'

    game_id = Column(Integer, primary_key=True, autoincrement=True)
    game_date = Column(String)
    winner = Column(String)
    players = Column(String)


Base.metadata.create_all(engine)
