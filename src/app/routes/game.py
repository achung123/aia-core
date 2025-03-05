from fastapi import APIRouter, HTTPException
from sqlalchemy.orm import sessionmaker

from app.database.database_models import Community, engine
from pydantic_models.app_models import (
    CommunityErrorResponse,
    CommunityRequest,
    CommunityResponse,
    GameState,
)

router = APIRouter(prefix="/game", tags=["game"])

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


@router.post("/")
def create_game():
    return {"message": "New Game Created"}


@router.get("/{game_id}")
def get_game(game_id: int):
    # TODO: Implement this endpoint
    return {"message": f"Game {game_id}"}


@router.post("/community")
def push_community(request: CommunityRequest):
    if request.community_cards.game_state == GameState.BAD_GAME_STATE:
        response = CommunityErrorResponse(
            status="error",
            message="Invalid Move",
        )
        raise HTTPException(status_code=400, detail=response.model_dump())

    game_date = request.game_date
    hand_number = request.hand_number
    community_cards = request.community_cards

    turn_card = str(community_cards.turn_card) if community_cards.turn_card else "None"
    river_card = (
        str(community_cards.river_card) if community_cards.river_card else "None"
    )
    with SessionLocal() as session:
        community = Community(
            game_date=game_date,
            hand_number=hand_number,
            flop_card_0=str(community_cards.flop_card_0),
            flop_card_1=str(community_cards.flop_card_1),
            flop_card_2=str(community_cards.flop_card_2),
            turn_card=turn_card,
            river_card=river_card,
            players=",".join(request.players),
        )
        session.add(community)
        session.commit()

    response = CommunityResponse(
        status="success",
        message="Community Cards Pushed",
        game_date=game_date,
        hand_number=hand_number,
        current_game_state=community_cards.game_state,
    )
    return response.model_dump()
