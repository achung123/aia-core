"""Search router - handles search endpoints."""

from datetime import date as date_type
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.database.models import GameSession, Hand, Player, PlayerHand
from app.database.session import get_db
from pydantic_models.hand_schemas import PlayerHandResponse
from pydantic_models.search_schemas import HandSearchResult, PaginatedHandSearchResponse

router = APIRouter(prefix='/hands', tags=['search'])


@router.get('', response_model=PaginatedHandSearchResponse)
def search_hands(
    player: Annotated[str | None, Query(description='Player name to filter by')] = None,
    date_from: Annotated[
        date_type | None,
        Query(description='Filter hands from this date inclusive (YYYY-MM-DD)'),
    ] = None,
    date_to: Annotated[
        date_type | None,
        Query(description='Filter hands to this date inclusive (YYYY-MM-DD)'),
    ] = None,
    card: Annotated[
        str | None, Query(description='Card to search for, e.g. AS or KH')
    ] = None,
    location: Annotated[
        Literal['community', 'hole'] | None,
        Query(description='Narrow card search to community or hole cards'),
    ] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    per_page: Annotated[int, Query(ge=1, le=200)] = 50,
    db: Annotated[Session, Depends(get_db)] = None,
):
    query = (
        db.query(Hand, PlayerHand, Player, GameSession)
        .join(PlayerHand, PlayerHand.hand_id == Hand.hand_id)
        .join(Player, Player.player_id == PlayerHand.player_id)
        .join(GameSession, GameSession.game_id == Hand.game_id)
    )

    if player is not None:
        query = query.filter(func.lower(Player.name) == player.lower())

    if date_from is not None:
        query = query.filter(GameSession.game_date >= date_from)

    if date_to is not None:
        query = query.filter(GameSession.game_date <= date_to)

    if card is not None:
        community_match = or_(
            Hand.flop_1 == card,
            Hand.flop_2 == card,
            Hand.flop_3 == card,
            Hand.turn == card,
            Hand.river == card,
        )
        hole_match = or_(
            PlayerHand.card_1 == card,
            PlayerHand.card_2 == card,
        )
        if location == 'community':
            query = query.filter(community_match)
        elif location == 'hole':
            query = query.filter(hole_match)
        else:
            query = query.filter(or_(community_match, hole_match))

    query = query.order_by(GameSession.game_date, Hand.hand_number)

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
                    outcome_street=ph.outcome_street,
                ),
            )
        )

    return PaginatedHandSearchResponse(
        total=total,
        page=page,
        per_page=per_page,
        results=results,
    )
