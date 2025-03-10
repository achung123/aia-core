import datetime
from typing import Annotated

import pytz
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, sessionmaker

from app.database.database_models import Community, Game, engine
from pydantic_models.app_models import (
    Card,
    CardRank,
    CardSuit,
    CommunityCards,
    CommunityErrorResponse,
    CommunityRequest,
    CommunityResponse,
    GameResponse,
    GameState,
)

router = APIRouter(prefix="/game", tags=["game"])
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db  # Dependency injection
    finally:
        db.close()


@router.post("/")
def create_game(db: Annotated[Session, Depends(get_db)]):
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
def get_game_by_date(game_date: str, db: Annotated[Session, Depends(get_db)]):
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


@router.post("/community")
def push_community(request: CommunityRequest, db: Annotated[Session, Depends(get_db)]):
    if request.community_cards.game_state == GameState.BAD_GAME_STATE:
        response = CommunityErrorResponse(
            status="error",
            message="Invalid Move",
        )
        raise HTTPException(status_code=400, detail=response.model_dump())

    game_date = request.game_date
    hand_number = request.hand_number
    community_cards = request.community_cards
    active_players = None
    if community_cards.game_state == GameState.FLOP:
        turn_card = None
        river_card = None
        active_players = {GameState.FLOP: request.players}
    elif community_cards.game_state == GameState.TURN:
        turn_card = str(community_cards.turn_card)
        river_card = None
        flop_active_players = (
            db.query(Community)
            .filter(
                Community.game_date == game_date,
                Community.hand_number == hand_number,
            )
            .order_by(Community.id)
            .all()[-1]
            .players.split(",")
        )
        active_players = {GameState.TURN: request.players} | {
            GameState.FLOP: flop_active_players
        }
    elif community_cards.game_state == GameState.RIVER:
        turn_card = str(community_cards.turn_card)
        river_card = str(community_cards.river_card)
        flop_active_players = (
            db.query(Community)
            .filter(
                Community.game_date == game_date,
                Community.hand_number == hand_number,
            )
            .order_by(Community.id)
            .all()[-2]
            .players.split(",")
        )
        turn_active_players = (
            db.query(Community)
            .filter(
                Community.game_date == game_date,
                Community.hand_number == hand_number,
            )
            .order_by(Community.id)
            .all()[-1]
            .players.split(",")
        )
        active_players = (
            {GameState.RIVER: request.players}
            | {GameState.TURN: turn_active_players}
            | {GameState.FLOP: flop_active_players}
        )
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
    db.add(community)
    db.commit()

    response = CommunityResponse(
        status="success",
        message="Community Cards Pushed",
        game_date=game_date,
        hand_number=hand_number,
        community_cards=community_cards,
        active_players=active_players,
    )
    return response.model_dump()


@router.get("/community/{game_date}/{hand_number}")
def get_community(
    game_date: str, hand_number: int, db: Annotated[Session, Depends(get_db)]
):
    community = (
        db.query(Community)
        .filter(Community.game_date == game_date, Community.hand_number == hand_number)
        .order_by(Community.id)  # Or `Community.id.desc()` for descending order
        .all()
    )
    if not community:
        response = CommunityErrorResponse(
            status="error",
            message="Community Cards Not Found",
        )
        raise HTTPException(status_code=404, detail=response.model_dump())
    game_states = [GameState.FLOP, GameState.TURN, GameState.RIVER]
    active_players = {
        game_states[i]: data.players.split(",") for i, data in enumerate(community)
    }
    community = community[-1]
    comunity_cards = CommunityCards(
        flop_card_0=Card(
            rank=CardRank(community.flop_card_0[0]),
            suit=CardSuit(community.flop_card_0[1]),
        ),
        flop_card_1=Card(
            rank=CardRank(community.flop_card_1[0]),
            suit=CardSuit(community.flop_card_1[1]),
        ),
        flop_card_2=Card(
            rank=CardRank(community.flop_card_2[0]),
            suit=CardSuit(community.flop_card_2[1]),
        ),
        turn_card=Card(
            rank=CardRank(community.turn_card[0]),
            suit=CardSuit(community.turn_card[1]),
        )
        if community.turn_card
        else None,
        river_card=Card(
            rank=CardRank(community.river_card[0]),
            suit=CardSuit(community.river_card[1]),
        )
        if community.river_card
        else None,
    )
    response = CommunityResponse(
        status="success",
        message="Community Cards Found",
        game_date=community.game_date,
        hand_number=community.hand_number,
        community_cards=comunity_cards,
        active_players=active_players,
    )
    return response.model_dump()
