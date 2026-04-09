"""Games router - handles game-related endpoints."""

import json
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database.models import GamePlayer, GameSession, Player
from app.database.session import get_db
from pydantic_models.app_models import (
    CompleteGameRequest,
    GameSessionCreate,
    GameSessionListItem,
    GameSessionResponse,
)


def _parse_winners(raw: str | None) -> list[str]:
    if not raw:
        return []
    return json.loads(raw)


router = APIRouter(prefix='/games', tags=['games'])


@router.get('', response_model=list[GameSessionListItem])
def list_game_sessions(
    db: Annotated[Session, Depends(get_db)],
    date_from: date | None = None,
    date_to: date | None = None,
):
    query = db.query(GameSession)
    if date_from is not None:
        query = query.filter(GameSession.game_date >= date_from)
    if date_to is not None:
        query = query.filter(GameSession.game_date <= date_to)
    games = query.order_by(GameSession.game_date.desc()).all()
    return [
        GameSessionListItem(
            game_id=game.game_id,
            game_date=game.game_date,
            status=game.status,
            player_count=len(game.players),
            hand_count=len(game.hands),
            winners=_parse_winners(game.winners),
        )
        for game in games
    ]


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
            try:
                with db.begin_nested():
                    player = Player(name=name)
                    db.add(player)
                    db.flush()
            except IntegrityError:
                # Concurrent request inserted the same player between our check
                # and our flush (TOCTOU). Roll back the savepoint and re-query.
                player = (
                    db.query(Player)
                    .filter(func.lower(Player.name) == name.lower())
                    .first()
                )
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
        winners=_parse_winners(game.winners),
    )


@router.get('/{game_id}', response_model=GameSessionResponse)
def get_game_session(
    game_id: int,
    db: Annotated[Session, Depends(get_db)],
):
    game = db.query(GameSession).filter(GameSession.game_id == game_id).first()
    if game is None:
        raise HTTPException(status_code=404, detail='Game session not found')
    return GameSessionResponse(
        game_id=game.game_id,
        game_date=game.game_date,
        status=game.status,
        created_at=game.created_at,
        player_names=[p.name for p in game.players],
        hand_count=len(game.hands),
        winners=_parse_winners(game.winners),
    )


@router.patch('/{game_id}/complete', response_model=GameSessionResponse)
def complete_game_session(
    game_id: int,
    db: Annotated[Session, Depends(get_db)],
    payload: CompleteGameRequest | None = None,
):
    game = db.query(GameSession).filter(GameSession.game_id == game_id).first()
    if game is None:
        raise HTTPException(status_code=404, detail='Game session not found')
    if game.status == 'completed':
        raise HTTPException(status_code=400, detail='Game session already completed')
    winners = payload.winners if payload else []
    game.status = 'completed'
    game.winners = json.dumps(winners) if winners else None
    db.commit()
    db.refresh(game)
    return GameSessionResponse(
        game_id=game.game_id,
        game_date=game.game_date,
        status=game.status,
        created_at=game.created_at,
        player_names=[p.name for p in game.players],
        hand_count=len(game.hands),
        winners=_parse_winners(game.winners),
    )


@router.patch('/{game_id}/reactivate', response_model=GameSessionResponse)
def reactivate_game_session(
    game_id: int,
    db: Annotated[Session, Depends(get_db)],
):
    game = db.query(GameSession).filter(GameSession.game_id == game_id).first()
    if game is None:
        raise HTTPException(status_code=404, detail='Game session not found')
    if game.status == 'active':
        raise HTTPException(status_code=400, detail='Game session is already active')
    game.status = 'active'
    game.winners = None
    db.commit()
    db.refresh(game)
    return GameSessionResponse(
        game_id=game.game_id,
        game_date=game.game_date,
        status=game.status,
        created_at=game.created_at,
        player_names=[p.name for p in game.players],
        hand_count=len(game.hands),
        winners=_parse_winners(game.winners),
    )
