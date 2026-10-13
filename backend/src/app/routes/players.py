"""Players router - handles player-related endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database.models import Player
from app.database.queries import get_player_by_name_or_404
from app.database.session import get_db
from pydantic_models.player_schemas import PlayerCreate, PlayerResponse

router = APIRouter(prefix='/players', tags=['players'])


@router.post('', status_code=201, response_model=PlayerResponse)
def create_player(
    payload: PlayerCreate,
    db: Annotated[Session, Depends(get_db)],
):
    existing = (
        db.query(Player)
        .filter(func.lower(Player.name) == func.lower(payload.name))
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail='Player already exists')
    player = Player(name=payload.name)
    db.add(player)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail='Player already exists') from None
    db.refresh(player)
    return player


@router.get('', response_model=list[PlayerResponse])
def list_players(db: Annotated[Session, Depends(get_db)]):
    return db.query(Player).all()


@router.get('/{player_name}', response_model=PlayerResponse)
def get_player_by_name(
    player_name: str,
    db: Annotated[Session, Depends(get_db)],
):
    player = get_player_by_name_or_404(db, player_name)
    return player
