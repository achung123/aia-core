from sqlalchemy import Column, Integer, String, create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Database setup
SQLALCHEMY_DATABASE_URL = "sqlite:///./poker.db"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class Community(Base):
    __tablename__ = "community"

    id = Column(Integer, primary_key=True, index=True)
    game_date = Column(String)
    hand_number = Column(Integer)
    flop_card_0 = Column(String)
    flop_card_1 = Column(String)
    flop_card_2 = Column(String)
    turn_card = Column(String)
    river_card = Column(String)
    players = Column(String)

class Game(Base):
    __tablename__ = "game"

    game_id = Column(Integer, primary_key=True, autoincrement=True)
    game_date = Column(Integer)
    winner = Column(String)
    losers = Column(String)

Base.metadata.create_all(engine)
