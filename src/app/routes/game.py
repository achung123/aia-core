import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pytz import timezone
from sqlalchemy.orm import Session, sessionmaker

from pydantic_models.app_models import GameRequest, GameResponse
from app import database  # Import Game model and engine from database_models.py
from app.database.database_models import (
    engine,  # Import Game model and engine from database_models.py
)

router = APIRouter(prefix="/game", tags=["game"])
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Endpoint to create a new game
@router.post("/")
def create_game(db: Annotated[Session, Depends(get_db)]):
    """
    Create a new game table
    """
    today = datetime.datetime.now(timezone("US/Eastern")).date()
    formatted_date = today.strftime("%m-%d-%Y")
    games = (
        db.query(database.database_models.Game)
        .filter(database.database_models.Game.game_date == formatted_date)
        .all()
    )
    if games:
        raise HTTPException(status_code=404, detail="Game already exists...")

    game_entry = database.database_models.Game(
        game_date=formatted_date, winner="Gil", losers="Adam,Matt,Zain"
    )
    db.add(game_entry)
    db.commit()

    queried_game = (
        db.query(database.database_models.Game)
        .filter(database.database_models.Game.game_date == formatted_date)
        .first()
    )

    return GameResponse(
        game_id=queried_game.game_id,
        game_date=queried_game.game_date,
        winner=queried_game.winner,
        losers=queried_game.losers,
    )


@router.get("/")
def get_game_by_date(db: Session = Depends(get_db), request: str = Depends(GameRequest)):
    """
    Get a game by date
    """
    game = (
        db.query(database.database_models.Game)
        .filter(database.database_models.Game.game_date == request.game_date)
        .first()
    )
    if game is None:
        raise HTTPException(status_code=404, detail="Game not found")
    
    return GameResponse(
        game_id=game.game_id,
        game_date=game.game_date,
        winner=game.winner,
        losers=game.losers,
    )

# Endpoint to Update winners and losers
# @router.put("/{game_id}")
# def update_game(
#     db: Annotated[Session, Depends(get_db)], game_id: int, game: pydantic_models.Game
# ):
#     """
#     Update a game by ID
#     """
#     db_game = (
#         db.query(database.database_models.Game)
#         .filter(database.database_models.Game.game_id == game_id)
#         .first()
#     )
#     if db_game is None:
#         raise HTTPException(status_code=404, detail="Game not found")

#     db_game.winner = game.winner
#     db_game.losers = game.losers
#     db.commit()

#     return pydantic_models.GameResponse(
#         game_id=db_game.game_id,
#         game_date=db_game.game_date,
#         winner=db_game.winner,`z`
#         losers=db_game.losers,
#     )