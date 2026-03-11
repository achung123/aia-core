"""Games router - handles game-related endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database.models import GamePlayer, GameSession, Player
from app.database.session import get_db
from pydantic_models.app_models import GameSessionCreate, GameSessionResponse

router = APIRouter(prefix='/games', tags=['games'])


@router.post('', status_code=201, response_model=GameSessionResponse)
def create_game_session(
    payload: GameSessionCreate,
    db: Annotated[Session, Depends(get_db)],
):
    game = GameSession(game_date=payload.game_date, status='active')
    db.add(game)
    db.flush()  # populate game_id without committing

    seen_player_ids: set[int] = set()
    for name in payload.player_names:
        player = (
            db.query(Player).filter(func.lower(Player.name) == name.lower()).first()
        )
        if player is None:
            player = Player(name=name)
            db.add(player)
            db.flush()
        if player.player_id in seen_player_ids:
            continue
        seen_player_ids.add(player.player_id)
        db.add(GamePlayer(game_id=game.game_id, player_id=player.player_id))

    db.commit()
    db.refresh(game)

    return GameSessionResponse(
        game_id=game.game_id,
        game_date=game.game_date,
        status=game.status,
        created_at=game.created_at,
        player_names=[p.name for p in game.players],
        hand_count=len(game.hands),
    )
