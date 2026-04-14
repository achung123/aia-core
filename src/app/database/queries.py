"""Reusable get-or-404 database lookup helpers."""

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database.models import GameSession, Hand, Player, PlayerHand


def get_game_or_404(db: Session, game_id: int) -> GameSession:
    game = db.query(GameSession).filter(GameSession.game_id == game_id).first()
    if game is None:
        raise HTTPException(status_code=404, detail='Game session not found')
    return game


def get_hand_or_404(db: Session, game_id: int, hand_number: int) -> Hand:
    hand = (
        db.query(Hand)
        .filter(Hand.game_id == game_id, Hand.hand_number == hand_number)
        .first()
    )
    if hand is None:
        raise HTTPException(status_code=404, detail='Hand not found')
    return hand


def get_player_by_name_or_404(db: Session, player_name: str) -> Player:
    player = (
        db.query(Player)
        .filter(func.lower(Player.name) == func.lower(player_name))
        .first()
    )
    if player is None:
        raise HTTPException(status_code=404, detail=f'Player {player_name!r} not found')
    return player


def get_player_hand_or_404(
    db: Session, hand_id: int, player_id: int, player_name: str
) -> PlayerHand:
    ph = (
        db.query(PlayerHand)
        .filter(
            PlayerHand.hand_id == hand_id,
            PlayerHand.player_id == player_id,
        )
        .first()
    )
    if ph is None:
        raise HTTPException(
            status_code=404,
            detail=f'Player {player_name!r} not found in this hand',
        )
    return ph
