import datetime
from typing import Annotated

import pytz
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, sessionmaker

from app.database.database_models import Game, engine
from app.database.database_queries import (
    query_community_with_date_and_hand,
    query_game_with_date,
)
from pydantic_models.app_models import (
    CommunityErrorResponse,
    CommunityRequest,
    CommunityResponse,
    GameResponse,
    GameState,
)

from .utils import (
    _convert_community_query_to_state,
    _convert_community_state_to_query,
    _validate_game_date,
)

router = APIRouter(prefix="/game", tags=["game"])
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def _get_db():
    db = SessionLocal()
    try:
        yield db  # Dependency injection
    finally:
        db.close()


@router.post("/")
def create_game(db: Annotated[Session, Depends(_get_db)]):
    """
    Create a new game table
    """
    today = datetime.datetime.now(pytz.timezone("America/New_York")).date()
    formatted_date = today.strftime("%m-%d-%Y")
    games = db.query(Game).filter(Game.game_date == formatted_date).all()
    if games:
        raise HTTPException(status_code=404, detail="Game already exists...")

    game_entry = Game(game_date=formatted_date, winner="Gil", losers="Adam,Matt,Zain")
    db.add(game_entry)
    db.commit()

    queried_game = db.query(Game).filter(Game.game_date == formatted_date).first()

    return GameResponse(
        game_id=queried_game.game_id,
        game_date=queried_game.game_date,
        winner=queried_game.winner,
        losers=queried_game.losers,
    )


@router.get("/{game_date}")
def get_game_by_date(game_date: str, db: Annotated[Session, Depends(_get_db)]):
    """
    Get a game by date
    """
    game = db.query(Game).filter(Game.game_date == game_date).first()
    if game is None:
        raise HTTPException(status_code=404, detail="Game not found")

    return GameResponse(
        game_id=game.game_id,
        game_date=game.game_date,
        winner=game.winner,
        losers=game.losers,
    )


@router.post("/community/{game_date}/{hand_number}")
def push_community(
    game_date: str,
    hand_number: int,
    request: CommunityRequest,
    db: Annotated[Session, Depends(_get_db)],
):
    # Check if the game exists
    if query_game_with_date(db, game_date) is None:
        response = CommunityErrorResponse(
            status="FAILURE",
            message="Game Not Found",
        )
        raise HTTPException(status_code=404, detail=response.model_dump())

    # Check if the game state in request is valid
    if request.community_state.game_state == GameState.BAD_GAME_STATE:
        response = CommunityErrorResponse(
            status="FAILURE",
            message="Invalid Move",
        )
        raise HTTPException(status_code=400, detail=response.model_dump())

    try:
        game_date = _validate_game_date(game_date)
    except ValueError as e:
        response = CommunityErrorResponse(
            status="FAILURE",
            message="Invalid Date",
        )
        raise HTTPException(status_code=400, detail=response.model_dump()) from e

    community_state = request.community_state
    community = _convert_community_state_to_query(
        game_date, hand_number, community_state
    )
    db.add(community)
    db.commit()

    # Query the community table for the response
    community_query = query_community_with_date_and_hand(db, game_date, hand_number)
    if not community_query:
        response = CommunityErrorResponse(
            status="FAILURE",
            message="Community Cards Not Found",
        )
        raise HTTPException(status_code=404, detail=response.model_dump())

    community_states = []

    flop_community_query = community_query[0]
    flop_community_state = _convert_community_query_to_state(flop_community_query)
    community_states.append(flop_community_state)

    if community_state.game_state in (GameState.TURN, GameState.RIVER):
        turn_community_query = community_query[1]
        turn_community_state = _convert_community_query_to_state(turn_community_query)
        community_states.append(turn_community_state)

    if community_state.game_state == GameState.RIVER:
        river_community_query = community_query[2]
        river_community_state = _convert_community_query_to_state(river_community_query)
        community_states.append(river_community_state)

    response = CommunityResponse(
        status="SUCCESS",
        message="Community Cards Pushed",
        game_date=game_date,
        hand_number=hand_number,
        community_states=community_states,
    )
    return response.model_dump()


@router.get("/community/{game_date}/{hand_number}")
def get_community(
    game_date: str, hand_number: int, db: Annotated[Session, Depends(_get_db)]
):
    community_query = query_community_with_date_and_hand(db, game_date, hand_number)
    if not community_query:
        response = CommunityErrorResponse(
            status="FAILURE",
            message="Community Cards Not Found",
        )
        raise HTTPException(status_code=404, detail=response.model_dump())

    community_states = []

    for community_entry in community_query:
        community_state = _convert_community_query_to_state(community_entry)
        community_states.append(community_state)

    game_date = community_query[0].game_date
    community = community_query[0]

    response = CommunityResponse(
        status="SUCCESS",
        message="Community Cards Found",
        game_date=community.game_date,
        hand_number=community.hand_number,
        community_states=community_states,
    )
    return response.model_dump()
