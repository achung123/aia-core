"""Search router - handles search endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database.models import GameSession, Hand, Player, PlayerHand
from app.database.session import get_db
from pydantic_models.app_models import (
    HandSearchResult,
    PaginatedHandSearchResponse,
    PlayerHandResponse,
)

router = APIRouter(prefix='/hands', tags=['search'])


@router.get('', response_model=PaginatedHandSearchResponse)
def search_hands_by_player(
    player: Annotated[str, Query(description='Player name to filter by')],
    page: Annotated[int, Query(ge=1)] = 1,
    per_page: Annotated[int, Query(ge=1, le=200)] = 50,
    db: Annotated[Session, Depends(get_db)] = None,
):
    query = (
        db.query(Hand, PlayerHand, Player, GameSession)
        .join(PlayerHand, PlayerHand.hand_id == Hand.hand_id)
        .join(Player, Player.player_id == PlayerHand.player_id)
        .join(GameSession, GameSession.game_id == Hand.game_id)
        .filter(func.lower(Player.name) == player.lower())
        .order_by(GameSession.game_date, Hand.hand_number)
    )

    total = query.count()
    rows = query.offset((page - 1) * per_page).limit(per_page).all()

    results: list[HandSearchResult] = []
    for hand, ph, player_obj, game in rows:
        results.append(
            HandSearchResult(
                hand_id=hand.hand_id,
                game_id=hand.game_id,
                game_date=game.game_date,
                hand_number=hand.hand_number,
                flop_1=hand.flop_1,
                flop_2=hand.flop_2,
                flop_3=hand.flop_3,
                turn=hand.turn,
                river=hand.river,
                created_at=hand.created_at,
                player_hand=PlayerHandResponse(
                    player_hand_id=ph.player_hand_id,
                    hand_id=ph.hand_id,
                    player_id=ph.player_id,
                    player_name=player_obj.name,
                    card_1=ph.card_1,
                    card_2=ph.card_2,
                    result=ph.result,
                    profit_loss=ph.profit_loss,
                ),
            )
        )

    return PaginatedHandSearchResponse(
        total=total,
        page=page,
        per_page=per_page,
        results=results,
    )
