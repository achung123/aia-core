"""Hands router - handles hand-related endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database.models import GameSession, Hand, Player, PlayerHand
from app.database.session import get_db
from pydantic_models.app_models import (
    CommunityCardsUpdate,
    HandCreate,
    HandResponse,
    PlayerHandResponse,
    PlayerResultEntry,
)
from pydantic_models.card_validator import validate_no_duplicate_cards

router = APIRouter(prefix='/games', tags=['hands'])


@router.get('/{game_id}/hands', response_model=list[HandResponse])
def list_hands(
    game_id: int,
    db: Annotated[Session, Depends(get_db)],
):
    game = db.query(GameSession).filter(GameSession.game_id == game_id).first()
    if game is None:
        raise HTTPException(status_code=404, detail='Game session not found')

    hands = (
        db.query(Hand).filter(Hand.game_id == game_id).order_by(Hand.hand_number).all()
    )

    result: list[HandResponse] = []
    for hand in hands:
        player_hand_responses: list[PlayerHandResponse] = []
        for ph in hand.player_hands:
            player = db.query(Player).filter(Player.player_id == ph.player_id).first()
            player_hand_responses.append(
                PlayerHandResponse(
                    player_hand_id=ph.player_hand_id,
                    hand_id=ph.hand_id,
                    player_id=ph.player_id,
                    player_name=player.name if player else '',
                    card_1=ph.card_1,
                    card_2=ph.card_2,
                    result=ph.result,
                    profit_loss=ph.profit_loss,
                )
            )
        result.append(
            HandResponse(
                hand_id=hand.hand_id,
                game_id=hand.game_id,
                hand_number=hand.hand_number,
                flop_1=hand.flop_1,
                flop_2=hand.flop_2,
                flop_3=hand.flop_3,
                turn=hand.turn,
                river=hand.river,
                created_at=hand.created_at,
                player_hands=player_hand_responses,
            )
        )
    return result


@router.get('/{game_id}/hands/{hand_number}', response_model=HandResponse)
def get_hand(
    game_id: int,
    hand_number: int,
    db: Annotated[Session, Depends(get_db)],
):
    game = db.query(GameSession).filter(GameSession.game_id == game_id).first()
    if game is None:
        raise HTTPException(status_code=404, detail='Game session not found')

    hand = (
        db.query(Hand)
        .filter(Hand.game_id == game_id, Hand.hand_number == hand_number)
        .first()
    )
    if hand is None:
        raise HTTPException(status_code=404, detail='Hand not found')

    player_hand_responses: list[PlayerHandResponse] = []
    for ph in hand.player_hands:
        player = db.query(Player).filter(Player.player_id == ph.player_id).first()
        player_hand_responses.append(
            PlayerHandResponse(
                player_hand_id=ph.player_hand_id,
                hand_id=ph.hand_id,
                player_id=ph.player_id,
                player_name=player.name if player else '',
                card_1=ph.card_1,
                card_2=ph.card_2,
                result=ph.result,
                profit_loss=ph.profit_loss,
            )
        )

    return HandResponse(
        hand_id=hand.hand_id,
        game_id=hand.game_id,
        hand_number=hand.hand_number,
        flop_1=hand.flop_1,
        flop_2=hand.flop_2,
        flop_3=hand.flop_3,
        turn=hand.turn,
        river=hand.river,
        created_at=hand.created_at,
        player_hands=player_hand_responses,
    )


@router.patch('/{game_id}/hands/{hand_number}', response_model=HandResponse)
def edit_community_cards(
    game_id: int,
    hand_number: int,
    payload: CommunityCardsUpdate,
    db: Annotated[Session, Depends(get_db)],
):
    game = db.query(GameSession).filter(GameSession.game_id == game_id).first()
    if game is None:
        raise HTTPException(status_code=404, detail='Game session not found')

    hand = (
        db.query(Hand)
        .filter(Hand.game_id == game_id, Hand.hand_number == hand_number)
        .first()
    )
    if hand is None:
        raise HTTPException(status_code=404, detail='Hand not found')

    # Build full card set: new community cards + existing player hole cards
    all_cards = [
        str(payload.flop_1),
        str(payload.flop_2),
        str(payload.flop_3),
    ]
    if payload.turn is not None:
        all_cards.append(str(payload.turn))
    if payload.river is not None:
        all_cards.append(str(payload.river))
    for ph in hand.player_hands:
        all_cards.append(ph.card_1)
        all_cards.append(ph.card_2)
    try:
        validate_no_duplicate_cards(all_cards)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    hand.flop_1 = str(payload.flop_1)
    hand.flop_2 = str(payload.flop_2)
    hand.flop_3 = str(payload.flop_3)
    hand.turn = str(payload.turn) if payload.turn is not None else None
    hand.river = str(payload.river) if payload.river is not None else None

    db.commit()
    db.refresh(hand)

    player_hand_responses: list[PlayerHandResponse] = []
    for ph in hand.player_hands:
        player = db.query(Player).filter(Player.player_id == ph.player_id).first()
        player_hand_responses.append(
            PlayerHandResponse(
                player_hand_id=ph.player_hand_id,
                hand_id=ph.hand_id,
                player_id=ph.player_id,
                player_name=player.name if player else '',
                card_1=ph.card_1,
                card_2=ph.card_2,
                result=ph.result,
                profit_loss=ph.profit_loss,
            )
        )

    return HandResponse(
        hand_id=hand.hand_id,
        game_id=hand.game_id,
        hand_number=hand.hand_number,
        flop_1=hand.flop_1,
        flop_2=hand.flop_2,
        flop_3=hand.flop_3,
        turn=hand.turn,
        river=hand.river,
        created_at=hand.created_at,
        player_hands=player_hand_responses,
    )


@router.post('/{game_id}/hands', status_code=201, response_model=HandResponse)
def record_hand(
    game_id: int,
    payload: HandCreate,
    db: Annotated[Session, Depends(get_db)],
):
    game = db.query(GameSession).filter(GameSession.game_id == game_id).first()
    if game is None:
        raise HTTPException(status_code=404, detail='Game session not found')

    all_cards = [
        str(payload.flop_1),
        str(payload.flop_2),
        str(payload.flop_3),
    ]
    if payload.turn is not None:
        all_cards.append(str(payload.turn))
    if payload.river is not None:
        all_cards.append(str(payload.river))
    for entry in payload.player_entries:
        all_cards.append(str(entry.card_1))
        all_cards.append(str(entry.card_2))
    try:
        validate_no_duplicate_cards(all_cards)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    max_hand_number = (
        db.query(func.max(Hand.hand_number)).filter(Hand.game_id == game_id).scalar()
    )
    hand_number = (max_hand_number or 0) + 1

    game_player_ids = {p.player_id for p in game.players}

    hand = Hand(
        game_id=game_id,
        hand_number=hand_number,
        flop_1=str(payload.flop_1),
        flop_2=str(payload.flop_2),
        flop_3=str(payload.flop_3),
        turn=str(payload.turn) if payload.turn is not None else None,
        river=str(payload.river) if payload.river is not None else None,
    )
    db.add(hand)
    db.flush()

    player_hand_responses: list[PlayerHandResponse] = []
    for entry in payload.player_entries:
        player = (
            db.query(Player)
            .filter(func.lower(Player.name) == entry.player_name.lower())
            .first()
        )
        if player is None:
            raise HTTPException(
                status_code=404,
                detail=f'Player {entry.player_name!r} not found',
            )
        if player.player_id not in game_player_ids:
            raise HTTPException(
                status_code=400,
                detail=f'Player {entry.player_name!r} is not a participant in this game',
            )

        ph = PlayerHand(
            hand_id=hand.hand_id,
            player_id=player.player_id,
            card_1=str(entry.card_1),
            card_2=str(entry.card_2),
            result=entry.result,
            profit_loss=entry.profit_loss,
        )
        db.add(ph)
        db.flush()

        player_hand_responses.append(
            PlayerHandResponse(
                player_hand_id=ph.player_hand_id,
                hand_id=ph.hand_id,
                player_id=ph.player_id,
                player_name=player.name,
                card_1=ph.card_1,
                card_2=ph.card_2,
                result=ph.result,
                profit_loss=ph.profit_loss,
            )
        )

    db.commit()
    db.refresh(hand)

    return HandResponse(
        hand_id=hand.hand_id,
        game_id=hand.game_id,
        hand_number=hand.hand_number,
        flop_1=hand.flop_1,
        flop_2=hand.flop_2,
        flop_3=hand.flop_3,
        turn=hand.turn,
        river=hand.river,
        created_at=hand.created_at,
        player_hands=player_hand_responses,
    )


@router.patch(
    '/{game_id}/hands/{hand_number}/results',
    response_model=HandResponse,
)
def record_hand_results(
    game_id: int,
    hand_number: int,
    payload: list[PlayerResultEntry],
    db: Annotated[Session, Depends(get_db)],
):
    game = db.query(GameSession).filter(GameSession.game_id == game_id).first()
    if game is None:
        raise HTTPException(status_code=404, detail='Game session not found')

    hand = (
        db.query(Hand)
        .filter(Hand.game_id == game_id, Hand.hand_number == hand_number)
        .first()
    )
    if hand is None:
        raise HTTPException(status_code=404, detail='Hand not found')

    for entry in payload:
        player = (
            db.query(Player)
            .filter(func.lower(Player.name) == entry.player_name.lower())
            .first()
        )
        if player is None:
            raise HTTPException(
                status_code=404,
                detail=f'Player {entry.player_name!r} not found',
            )
        ph = (
            db.query(PlayerHand)
            .filter(
                PlayerHand.hand_id == hand.hand_id,
                PlayerHand.player_id == player.player_id,
            )
            .first()
        )
        if ph is None:
            raise HTTPException(
                status_code=404,
                detail=f'Player {entry.player_name!r} not found in this hand',
            )
        ph.result = entry.result
        ph.profit_loss = entry.profit_loss

    db.commit()
    db.refresh(hand)

    player_hand_responses: list[PlayerHandResponse] = []
    for ph in hand.player_hands:
        player = db.query(Player).filter(Player.player_id == ph.player_id).first()
        player_hand_responses.append(
            PlayerHandResponse(
                player_hand_id=ph.player_hand_id,
                hand_id=ph.hand_id,
                player_id=ph.player_id,
                player_name=player.name if player else '',
                card_1=ph.card_1,
                card_2=ph.card_2,
                result=ph.result,
                profit_loss=ph.profit_loss,
            )
        )

    return HandResponse(
        hand_id=hand.hand_id,
        game_id=hand.game_id,
        hand_number=hand.hand_number,
        flop_1=hand.flop_1,
        flop_2=hand.flop_2,
        flop_3=hand.flop_3,
        turn=hand.turn,
        river=hand.river,
        created_at=hand.created_at,
        player_hands=player_hand_responses,
    )
