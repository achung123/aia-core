"""Players router - handles player-related endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database.models import Player
from app.database.session import get_db
from pydantic_models.app_models import PlayerCreate, PlayerResponse

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
    player = (
        db.query(Player)
        .filter(func.lower(Player.name) == func.lower(player_name))
        .first()
    )
    if player is None:
        raise HTTPException(status_code=404, detail='Player not found')
    return player
