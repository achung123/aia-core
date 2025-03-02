import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pytz import timezone
from sqlalchemy.orm import Session, sessionmaker

import pydantic_models.app_models as pydantic_models
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

    return pydantic_models.Game(
        game_id=queried_game.game_id,
        game_date=queried_game.game_date,
        winner=queried_game.winner,
        losers=queried_game.losers,
    )


@router.get("/{game_id}")
def get_game(db: Annotated[Session, Depends(get_db)], game_id: int):
    """
    Get a game by ID
    """
    game = (
        db.query(database.database_models.Game)
        .filter(database.database_models.Game.game_id == game_id)
        .first()
    )
    if game is None:
        raise HTTPException(status_code=404, detail="Game not found")
    return pydantic_models.Game(
        game_id=game.game_id,
        game_date=game.game_date,
        winner=game.winner,
        losers=game.losers,
    )
