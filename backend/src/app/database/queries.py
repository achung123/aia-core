"""Reusable get-or-404 database lookup helpers."""

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, aliased

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
    player_hand = (
        db.query(PlayerHand)
        .filter(
            PlayerHand.hand_id == hand_id,
            PlayerHand.player_id == player_id,
        )
        .first()
    )
    if player_hand is None:
        raise HTTPException(
            status_code=404,
            detail=f'Player {player_name!r} not found in this hand',
        )
    return player_hand


def get_shared_hands(
    db: Session, player1_id: int, player2_id: int
) -> list[tuple[Hand, PlayerHand, PlayerHand]]:
    """Return all hands where both players participated.

    Results are ordered by hand_number ascending within each game.
    Each tuple contains (Hand, PlayerHand for player1, PlayerHand for player2).
    """
    ph1 = aliased(PlayerHand)
    ph2 = aliased(PlayerHand)

    return (
        db.query(Hand, ph1, ph2)
        .join(ph1, Hand.hand_id == ph1.hand_id)
        .join(ph2, Hand.hand_id == ph2.hand_id)
        .filter(ph1.player_id == player1_id)
        .filter(ph2.player_id == player2_id)
        .order_by(Hand.game_id, Hand.hand_number)
        .all()
    )
