"""Stats router - handles statistics endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.database.models import Player, PlayerHand
from app.database.session import get_db
from pydantic_models.app_models import PlayerStatsResponse

router = APIRouter(prefix='/stats', tags=['stats'])


@router.get('/players/{player_name}', response_model=PlayerStatsResponse)
def get_player_stats(
    player_name: str,
    db: Annotated[Session, Depends(get_db)],
):
    player = (
        db.query(Player)
        .filter(func.lower(Player.name) == func.lower(player_name))
        .first()
    )
    if player is None:
        raise HTTPException(status_code=404, detail='Player not found')

    player_hands = (
        db.query(PlayerHand)
        .options(joinedload(PlayerHand.hand))
        .filter(
            PlayerHand.player_id == player.player_id,
            PlayerHand.result.isnot(None),
        )
        .all()
    )

    total = len(player_hands)

    if total == 0:
        return PlayerStatsResponse(
            player_name=player.name,
            total_hands_played=0,
            hands_won=0,
            hands_lost=0,
            hands_folded=0,
            win_rate=0.0,
            total_profit_loss=0.0,
            avg_profit_loss_per_hand=0.0,
            avg_profit_loss_per_session=0.0,
            flop_pct=0.0,
            turn_pct=0.0,
            river_pct=0.0,
        )

    hands_won = sum(1 for ph in player_hands if ph.result == 'win')
    hands_lost = sum(1 for ph in player_hands if ph.result == 'loss')
    hands_folded = sum(1 for ph in player_hands if ph.result == 'fold')
    win_rate = round(hands_won / total * 100, 2)

    total_pl = sum(ph.profit_loss or 0.0 for ph in player_hands)
    avg_pl_per_hand = round(total_pl / total, 2)

    session_pl: dict[int, float] = {}
    for ph in player_hands:
        gid = ph.hand.game_id
        session_pl[gid] = session_pl.get(gid, 0.0) + (ph.profit_loss or 0.0)
    avg_pl_per_session = round(sum(session_pl.values()) / len(session_pl), 2)

    hands_with_turn = sum(1 for ph in player_hands if ph.hand.turn is not None)
    hands_with_river = sum(1 for ph in player_hands if ph.hand.river is not None)

    return PlayerStatsResponse(
        player_name=player.name,
        total_hands_played=total,
        hands_won=hands_won,
        hands_lost=hands_lost,
        hands_folded=hands_folded,
        win_rate=win_rate,
        total_profit_loss=round(total_pl, 2),
        avg_profit_loss_per_hand=avg_pl_per_hand,
        avg_profit_loss_per_session=avg_pl_per_session,
        flop_pct=100.0,
        turn_pct=round(hands_with_turn / total * 100, 2),
        river_pct=round(hands_with_river / total * 100, 2),
    )
