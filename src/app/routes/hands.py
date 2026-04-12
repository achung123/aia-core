"""Hands router - handles hand-related endpoints."""

import hashlib
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database.models import (
    GamePlayer,
    GameSession,
    Hand,
    HandState,
    Player,
    PlayerHand,
    PlayerHandAction,
)
from app.database.session import get_db
from app.services.equity import calculate_equity
from pydantic_models.app_models import (
    CommunityCardsUpdate,
    EquityResponse,
    FlopUpdate,
    HandActionResponse,
    HandCreate,
    HandResponse,
    HandStateResponse,
    HandStatusResponse,
    HoleCardsUpdate,
    PlayerActionCreate,
    PlayerActionResponse,
    PlayerHandEntry,
    PlayerHandResponse,
    PlayerResultEntry,
    PlayerResultUpdate,
    PlayerStatusEntry,
    RiverUpdate,
    TurnUpdate,
)
from pydantic_models.card_validator import validate_no_duplicate_cards

router = APIRouter(prefix='/games', tags=['hands'])

PHASE_ORDER = ['preflop', 'flop', 'turn', 'river', 'showdown']


def _get_active_seat_order(
    db: Session, game_id: int, hand: Hand
) -> list[tuple[int, int]]:
    """Return list of (seat_number, player_id) for active non-folded players, sorted by seat."""
    active_gps = (
        db.query(GamePlayer)
        .filter(GamePlayer.game_id == game_id, GamePlayer.is_active.is_(True))
        .order_by(
            func.coalesce(GamePlayer.seat_number, 999999),
            GamePlayer.player_id,
        )
        .all()
    )
    folded_ids = {ph.player_id for ph in hand.player_hands if ph.result == 'folded'}
    return [
        (gp.seat_number or 0, gp.player_id)
        for gp in active_gps
        if gp.player_id not in folded_ids
    ]


def _first_to_act_seat(
    db: Session,
    game_id: int,
    hand: Hand,
    phase: str,
) -> int | None:
    """Determine the first-to-act seat for a given phase."""
    seats = _get_active_seat_order(db, game_id, hand)
    if not seats:
        return None

    if phase == 'preflop':
        # First-to-act is the player after BB
        bb_gp = (
            db.query(GamePlayer)
            .filter(
                GamePlayer.game_id == game_id, GamePlayer.player_id == hand.bb_player_id
            )
            .first()
        )
        bb_seat = bb_gp.seat_number if bb_gp and bb_gp.seat_number else 0
        # Find first active non-folded seat after BB
        after_bb = [s for s in seats if s[0] > bb_seat]
        if after_bb:
            return after_bb[0][0]
        # Wrap around
        return seats[0][0]
    else:
        # Post-flop: first active non-folded player after dealer (SB seat)
        sb_gp = (
            db.query(GamePlayer)
            .filter(
                GamePlayer.game_id == game_id, GamePlayer.player_id == hand.sb_player_id
            )
            .first()
        )
        sb_seat = sb_gp.seat_number if sb_gp and sb_gp.seat_number else 0
        # SB acts first post-flop (seat >= sb_seat)
        at_or_after = [s for s in seats if s[0] >= sb_seat]
        if at_or_after:
            return at_or_after[0][0]
        return seats[0][0]


def _next_seat(
    db: Session,
    game_id: int,
    hand: Hand,
    current_seat: int,
) -> int | None:
    """Advance to the next non-folded active player seat after current_seat."""
    seats = _get_active_seat_order(db, game_id, hand)
    if not seats:
        return None
    after = [s for s in seats if s[0] > current_seat]
    if after:
        return after[0][0]
    return seats[0][0]


def _count_community_cards(hand: Hand) -> int:
    count = 0
    if hand.flop_1 is not None:
        count += 3
    if hand.turn is not None:
        count += 1
    if hand.river is not None:
        count += 1
    return count


def _can_advance_to_phase(hand: Hand, target_phase: str) -> bool:
    """Check if community cards are sufficient for the target phase."""
    cc = _count_community_cards(hand)
    if target_phase == 'flop':
        return cc >= 3
    if target_phase == 'turn':
        return cc >= 4
    if target_phase == 'river':
        return cc >= 5
    if target_phase == 'showdown':
        return cc >= 5
    return True  # preflop always ok


def _try_advance_phase(db: Session, game_id: int, hand: Hand, state: HandState) -> None:
    """If all non-folded players have acted in this phase, try to advance."""
    seats = _get_active_seat_order(db, game_id, hand)
    if len(seats) <= 1:
        return

    # Count actions in current phase by non-folded active players
    active_non_folded_ids = {pid for _, pid in seats}
    actions_this_phase = (
        db.query(PlayerHandAction)
        .join(PlayerHand, PlayerHandAction.player_hand_id == PlayerHand.player_hand_id)
        .filter(
            PlayerHand.hand_id == hand.hand_id,
            PlayerHandAction.street == state.phase,
            PlayerHand.player_id.in_(active_non_folded_ids),
        )
        .count()
    )

    if actions_this_phase < len(active_non_folded_ids):
        return

    # All acted — try to advance
    phase_idx = PHASE_ORDER.index(state.phase)
    if phase_idx >= len(PHASE_ORDER) - 1:
        return  # Already at showdown

    next_phase = PHASE_ORDER[phase_idx + 1]

    # Refresh hand to get latest community cards
    db.refresh(hand)
    if not _can_advance_to_phase(hand, next_phase):
        return  # Can't advance yet — not enough community cards

    state.phase = next_phase
    state.current_seat = _first_to_act_seat(db, game_id, hand, next_phase)


def _get_player_name_for_seat(
    db: Session, game_id: int, seat: int | None
) -> str | None:
    """Look up the player name for a given seat number in a game."""
    if seat is None:
        return None
    gp = (
        db.query(GamePlayer)
        .filter(GamePlayer.game_id == game_id, GamePlayer.seat_number == seat)
        .first()
    )
    if gp is None:
        return None
    player = db.query(Player).filter(Player.player_id == gp.player_id).first()
    return player.name if player else None


def _derive_participation_status(player_hand: PlayerHand | None) -> str:
    """Derive participation status from a PlayerHand row (or None)."""
    if player_hand is None:
        return 'idle'
    if player_hand.result is not None:
        return player_hand.result
    if player_hand.card_1 is not None:
        return 'joined'
    return 'pending'


@router.get('/{game_id}/hands/{hand_number}/status', response_model=HandStatusResponse)
def get_hand_status(
    game_id: int,
    hand_number: int,
    db: Annotated[Session, Depends(get_db)],
    response: Response,
    if_none_match: Annotated[str | None, Header()] = None,
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

    community_recorded = any(
        c is not None for c in [hand.flop_1, hand.turn, hand.river]
    )

    # Build a lookup of player_id -> PlayerHand for this hand
    ph_by_player_id = {ph.player_id: ph for ph in hand.player_hands}

    players: list[PlayerStatusEntry] = []
    for player in game.players:
        ph = ph_by_player_id.get(player.player_id)
        players.append(
            PlayerStatusEntry(
                name=player.name,
                participation_status=_derive_participation_status(ph),
                card_1=ph.card_1 if ph else None,
                card_2=ph.card_2 if ph else None,
                result=ph.result if ph else None,
                outcome_street=ph.outcome_street if ph else None,
            )
        )

    body = HandStatusResponse(
        hand_number=hand.hand_number,
        community_recorded=community_recorded,
        players=players,
    )

    etag = '"' + hashlib.md5(body.model_dump_json().encode()).hexdigest() + '"'

    if if_none_match and if_none_match == etag:
        return Response(status_code=304, headers={'etag': etag})

    response.headers['etag'] = etag
    return body


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

    return [_build_hand_response(hand, db) for hand in hands]


@router.get(
    '/{game_id}/hands/{hand_number}/actions',
    response_model=list[HandActionResponse],
)
def get_hand_actions(
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

    actions = (
        db.query(PlayerHandAction)
        .join(PlayerHand, PlayerHandAction.player_hand_id == PlayerHand.player_hand_id)
        .filter(PlayerHand.hand_id == hand.hand_id)
        .order_by(PlayerHandAction.created_at)
        .all()
    )

    return [
        HandActionResponse(
            player_name=a.player_hand.player.name,
            street=a.street,
            action=a.action,
            amount=a.amount,
            created_at=a.created_at,
        )
        for a in actions
    ]


@router.post('/{game_id}/hands/start', status_code=201, response_model=HandResponse)
def start_hand(
    game_id: int,
    db: Annotated[Session, Depends(get_db)],
):
    """Create a new hand, add all active players, and auto-assign SB/BB."""
    game = db.query(GameSession).filter(GameSession.game_id == game_id).first()
    if game is None:
        raise HTTPException(status_code=404, detail='Game session not found')

    # Get active players sorted by seat_number (nulls last), then player_id
    active_gps = (
        db.query(GamePlayer)
        .filter(GamePlayer.game_id == game_id, GamePlayer.is_active.is_(True))
        .order_by(
            func.coalesce(GamePlayer.seat_number, 999999),
            GamePlayer.player_id,
        )
        .all()
    )

    if len(active_gps) < 2:
        raise HTTPException(
            status_code=400,
            detail='At least 2 active players are required to start a hand',
        )

    # Determine next hand number
    max_hand_number = (
        db.query(func.max(Hand.hand_number)).filter(Hand.game_id == game_id).scalar()
    )
    hand_number = (max_hand_number or 0) + 1

    # Get previous hand for SB/BB rotation
    prev_hand = None
    if hand_number > 1:
        prev_hand = (
            db.query(Hand)
            .filter(Hand.game_id == game_id, Hand.hand_number == hand_number - 1)
            .first()
        )

    # Determine SB/BB
    active_player_ids = [gp.player_id for gp in active_gps]
    n = len(active_player_ids)

    if prev_hand is None or prev_hand.sb_player_id is None:
        # First hand: SB = first active player, BB = second
        sb_player_id = active_player_ids[0]
        bb_player_id = active_player_ids[1]
    else:
        prev_sb_id = prev_hand.sb_player_id
        try:
            prev_sb_idx = active_player_ids.index(prev_sb_id)
            sb_idx = (prev_sb_idx + 1) % n
        except ValueError:
            # Prev SB is no longer active — find next active by seat
            prev_sb_gp = (
                db.query(GamePlayer)
                .filter(
                    GamePlayer.game_id == game_id,
                    GamePlayer.player_id == prev_sb_id,
                )
                .first()
            )
            prev_sb_seat = (
                prev_sb_gp.seat_number if prev_sb_gp and prev_sb_gp.seat_number else 0
            )
            sb_idx = 0
            for i, gp in enumerate(active_gps):
                if (gp.seat_number or 0) > prev_sb_seat:
                    sb_idx = i
                    break
        sb_player_id = active_player_ids[sb_idx]
        bb_player_id = active_player_ids[(sb_idx + 1) % n]

    # Create hand
    hand = Hand(
        game_id=game_id,
        hand_number=hand_number,
        sb_player_id=sb_player_id,
        bb_player_id=bb_player_id,
    )
    db.add(hand)
    db.flush()

    # Create PlayerHand for each active player
    for gp in active_gps:
        ph = PlayerHand(hand_id=hand.hand_id, player_id=gp.player_id)
        db.add(ph)

    # Create HandState with phase=preflop and first-to-act seat
    first_seat = _first_to_act_seat(db, game_id, hand, 'preflop')
    hand_state = HandState(
        hand_id=hand.hand_id,
        phase='preflop',
        current_seat=first_seat,
        action_index=0,
    )
    db.add(hand_state)

    db.commit()
    db.refresh(hand)

    return _build_hand_response(hand, db)


@router.get(
    '/{game_id}/hands/{hand_number}/state',
    response_model=HandStateResponse,
)
def get_hand_state(
    game_id: int,
    hand_number: int,
    db: Annotated[Session, Depends(get_db)],
):
    """Return the current turn state for a hand."""
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

    state = db.query(HandState).filter(HandState.hand_id == hand.hand_id).first()
    if state is None:
        raise HTTPException(status_code=404, detail='Hand state not found')

    # Try phase advancement (community cards may have been dealt since last action)
    _try_advance_phase(db, game_id, hand, state)
    db.commit()
    db.refresh(state)

    current_name = _get_player_name_for_seat(db, game_id, state.current_seat)

    return HandStateResponse(
        phase=state.phase,
        current_seat=state.current_seat,
        current_player_name=current_name,
        action_index=state.action_index,
    )


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

    return _build_hand_response(hand, db)


def _db_card_to_tuple(card_str: str) -> tuple[str, str]:
    """Convert DB card string (e.g. 'AS', '10H') to (rank, suit) tuple for equity calc."""
    return (card_str[:-1], card_str[-1].lower())


@router.get('/{game_id}/hands/{hand_number}/equity', response_model=EquityResponse)
def get_hand_equity(
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

    # Collect players with non-null hole cards
    players_with_cards: list[tuple[str, list[tuple[str, str]]]] = []
    for ph in hand.player_hands:
        if ph.card_1 is None or ph.card_2 is None:
            continue
        player = db.query(Player).filter(Player.player_id == ph.player_id).first()
        player_name = player.name if player else ''
        hole_cards = [_db_card_to_tuple(ph.card_1), _db_card_to_tuple(ph.card_2)]
        players_with_cards.append((player_name, hole_cards))

    if len(players_with_cards) < 2:
        return EquityResponse(equities=[])

    # Gather community cards
    community_cards: list[tuple[str, str]] = []
    for card_str in [hand.flop_1, hand.flop_2, hand.flop_3, hand.turn, hand.river]:
        if card_str is not None:
            community_cards.append(_db_card_to_tuple(card_str))

    player_hole_cards = [hc for _, hc in players_with_cards]
    equities = calculate_equity(player_hole_cards, community_cards)

    return EquityResponse(
        equities=[
            {'player_name': name, 'equity': round(eq, 4)}
            for (name, _), eq in zip(players_with_cards, equities)
        ]
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
        if ph.card_1 is not None:
            all_cards.append(ph.card_1)
        if ph.card_2 is not None:
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

    return _build_hand_response(hand, db)


def _build_hand_response(hand: Hand, db: Session) -> HandResponse:
    """Build a HandResponse from a Hand ORM object."""
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
                outcome_street=ph.outcome_street,
            )
        )
    sb_name = None
    if hand.sb_player_id is not None:
        sb_player = (
            db.query(Player).filter(Player.player_id == hand.sb_player_id).first()
        )
        sb_name = sb_player.name if sb_player else None
    bb_name = None
    if hand.bb_player_id is not None:
        bb_player = (
            db.query(Player).filter(Player.player_id == hand.bb_player_id).first()
        )
        bb_name = bb_player.name if bb_player else None
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
        sb_player_name=sb_name,
        bb_player_name=bb_name,
        player_hands=player_hand_responses,
    )


def _get_game_and_hand(
    game_id: int, hand_number: int, db: Session
) -> tuple[GameSession, Hand]:
    """Look up game + hand or raise 404."""
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
    return game, hand


@router.patch('/{game_id}/hands/{hand_number}/flop', response_model=HandResponse)
def set_flop(
    game_id: int,
    hand_number: int,
    payload: FlopUpdate,
    db: Annotated[Session, Depends(get_db)],
):
    """Set the three flop cards for a hand."""
    _game, hand = _get_game_and_hand(game_id, hand_number, db)

    # Duplicate validation: new flop + existing turn/river + hole cards
    all_cards = [str(payload.flop_1), str(payload.flop_2), str(payload.flop_3)]
    if hand.turn is not None:
        all_cards.append(hand.turn)
    if hand.river is not None:
        all_cards.append(hand.river)
    for ph in hand.player_hands:
        if ph.card_1 is not None:
            all_cards.append(ph.card_1)
        if ph.card_2 is not None:
            all_cards.append(ph.card_2)
    try:
        validate_no_duplicate_cards(all_cards)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    hand.flop_1 = str(payload.flop_1)
    hand.flop_2 = str(payload.flop_2)
    hand.flop_3 = str(payload.flop_3)

    db.commit()
    db.refresh(hand)
    return _build_hand_response(hand, db)


@router.patch('/{game_id}/hands/{hand_number}/turn', response_model=HandResponse)
def set_turn(
    game_id: int,
    hand_number: int,
    payload: TurnUpdate,
    db: Annotated[Session, Depends(get_db)],
):
    """Set the turn card for a hand. Requires flop to be dealt first."""
    _game, hand = _get_game_and_hand(game_id, hand_number, db)

    if hand.flop_1 is None:
        raise HTTPException(
            status_code=400,
            detail='Cannot set turn before flop is dealt',
        )

    # Duplicate validation: existing flop + new turn + existing river + hole cards
    all_cards = [hand.flop_1, hand.flop_2, hand.flop_3, str(payload.turn)]
    if hand.river is not None:
        all_cards.append(hand.river)
    for ph in hand.player_hands:
        if ph.card_1 is not None:
            all_cards.append(ph.card_1)
        if ph.card_2 is not None:
            all_cards.append(ph.card_2)
    try:
        validate_no_duplicate_cards(all_cards)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    hand.turn = str(payload.turn)

    db.commit()
    db.refresh(hand)
    return _build_hand_response(hand, db)


@router.patch('/{game_id}/hands/{hand_number}/river', response_model=HandResponse)
def set_river(
    game_id: int,
    hand_number: int,
    payload: RiverUpdate,
    db: Annotated[Session, Depends(get_db)],
):
    """Set the river card for a hand. Requires turn (and flop) to be dealt first."""
    _game, hand = _get_game_and_hand(game_id, hand_number, db)

    if hand.flop_1 is None:
        raise HTTPException(
            status_code=400,
            detail='Cannot set river before flop is dealt',
        )
    if hand.turn is None:
        raise HTTPException(
            status_code=400,
            detail='Cannot set river before turn is dealt',
        )

    # Duplicate validation: existing community + new river + hole cards
    all_cards = [hand.flop_1, hand.flop_2, hand.flop_3, hand.turn, str(payload.river)]
    for ph in hand.player_hands:
        if ph.card_1 is not None:
            all_cards.append(ph.card_1)
        if ph.card_2 is not None:
            all_cards.append(ph.card_2)
    try:
        validate_no_duplicate_cards(all_cards)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    hand.river = str(payload.river)

    db.commit()
    db.refresh(hand)
    return _build_hand_response(hand, db)


@router.patch(
    '/{game_id}/hands/{hand_number}/players/{player_name}',
    response_model=PlayerHandResponse,
)
def edit_player_hole_cards(
    game_id: int,
    hand_number: int,
    player_name: str,
    payload: HoleCardsUpdate,
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

    player = (
        db.query(Player).filter(func.lower(Player.name) == player_name.lower()).first()
    )
    if player is None:
        raise HTTPException(status_code=404, detail=f'Player {player_name!r} not found')

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
            detail=f'Player {player_name!r} not found in this hand',
        )

    # Build full card set: new hole cards + community cards + other players' hole cards
    all_cards = [str(c) for c in [payload.card_1, payload.card_2] if c is not None]
    all_cards.extend(
        [
            c
            for c in [hand.flop_1, hand.flop_2, hand.flop_3, hand.turn, hand.river]
            if c is not None
        ]
    )
    for other_ph in hand.player_hands:
        if other_ph.player_id != player.player_id:
            if other_ph.card_1 is not None:
                all_cards.append(other_ph.card_1)
            if other_ph.card_2 is not None:
                all_cards.append(other_ph.card_2)
    try:
        validate_no_duplicate_cards(all_cards)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    ph.card_1 = str(payload.card_1) if payload.card_1 is not None else None
    ph.card_2 = str(payload.card_2) if payload.card_2 is not None else None

    db.commit()
    db.refresh(ph)

    return PlayerHandResponse(
        player_hand_id=ph.player_hand_id,
        hand_id=ph.hand_id,
        player_id=ph.player_id,
        player_name=player.name,
        card_1=ph.card_1,
        card_2=ph.card_2,
        result=ph.result,
        profit_loss=ph.profit_loss,
        outcome_street=ph.outcome_street,
    )


@router.post(
    '/{game_id}/hands/{hand_number}/players',
    status_code=201,
    response_model=PlayerHandResponse,
)
def add_player_to_hand(
    game_id: int,
    hand_number: int,
    payload: PlayerHandEntry,
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

    player = (
        db.query(Player)
        .filter(func.lower(Player.name) == payload.player_name.lower())
        .first()
    )
    if player is None:
        raise HTTPException(
            status_code=404, detail=f'Player {payload.player_name!r} not found'
        )

    game_player_ids = {p.player_id for p in game.players}
    if player.player_id not in game_player_ids:
        raise HTTPException(
            status_code=400,
            detail=f'Player {payload.player_name!r} is not a participant in this game',
        )

    existing_ph = (
        db.query(PlayerHand)
        .filter(
            PlayerHand.hand_id == hand.hand_id,
            PlayerHand.player_id == player.player_id,
        )
        .first()
    )
    if existing_ph is not None:
        raise HTTPException(
            status_code=400,
            detail=f'Player {payload.player_name!r} is already recorded in this hand',
        )

    # Build full card set: new hole cards + community cards + existing hole cards
    all_cards = [str(c) for c in [payload.card_1, payload.card_2] if c is not None]
    all_cards.extend(
        [
            c
            for c in [hand.flop_1, hand.flop_2, hand.flop_3, hand.turn, hand.river]
            if c is not None
        ]
    )
    for existing in hand.player_hands:
        if existing.card_1 is not None:
            all_cards.append(existing.card_1)
        if existing.card_2 is not None:
            all_cards.append(existing.card_2)
    try:
        validate_no_duplicate_cards(all_cards)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    ph = PlayerHand(
        hand_id=hand.hand_id,
        player_id=player.player_id,
        card_1=str(payload.card_1) if payload.card_1 is not None else None,
        card_2=str(payload.card_2) if payload.card_2 is not None else None,
        result=payload.result,
        profit_loss=payload.profit_loss,
    )
    db.add(ph)
    db.commit()
    db.refresh(ph)

    return PlayerHandResponse(
        player_hand_id=ph.player_hand_id,
        hand_id=ph.hand_id,
        player_id=ph.player_id,
        player_name=player.name,
        card_1=ph.card_1,
        card_2=ph.card_2,
        result=ph.result,
        profit_loss=ph.profit_loss,
        outcome_street=ph.outcome_street,
    )


@router.delete(
    '/{game_id}/hands/{hand_number}/players/{player_name}',
    status_code=204,
)
def remove_player_from_hand(
    game_id: int,
    hand_number: int,
    player_name: str,
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

    player = (
        db.query(Player).filter(func.lower(Player.name) == player_name.lower()).first()
    )
    if player is None:
        raise HTTPException(status_code=404, detail=f'Player {player_name!r} not found')

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
            detail=f'Player {player_name!r} not found in this hand',
        )

    db.delete(ph)
    db.commit()


@router.delete('/{game_id}/hands/{hand_number}', status_code=204)
def delete_hand(
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

    db.query(PlayerHand).filter(PlayerHand.hand_id == hand.hand_id).delete()
    db.delete(hand)
    db.commit()


@router.post('/{game_id}/hands', status_code=201, response_model=HandResponse)
def record_hand(
    game_id: int,
    payload: HandCreate,
    db: Annotated[Session, Depends(get_db)],
):
    game = db.query(GameSession).filter(GameSession.game_id == game_id).first()
    if game is None:
        raise HTTPException(status_code=404, detail='Game session not found')

    all_cards = []
    for card in (
        payload.flop_1,
        payload.flop_2,
        payload.flop_3,
        payload.turn,
        payload.river,
    ):
        if card is not None:
            all_cards.append(str(card))
    for entry in payload.player_entries:
        if entry.card_1 is not None:
            all_cards.append(str(entry.card_1))
        if entry.card_2 is not None:
            all_cards.append(str(entry.card_2))
    if all_cards:
        try:
            validate_no_duplicate_cards(all_cards)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    # Reject duplicate player names
    player_names = [e.player_name.lower() for e in payload.player_entries]
    if len(player_names) != len(set(player_names)):
        raise HTTPException(
            status_code=400,
            detail='Duplicate player_name in player_entries',
        )

    max_hand_number = (
        db.query(func.max(Hand.hand_number)).filter(Hand.game_id == game_id).scalar()
    )
    hand_number = (max_hand_number or 0) + 1

    game_player_ids = {p.player_id for p in game.players}

    hand = Hand(
        game_id=game_id,
        hand_number=hand_number,
        flop_1=str(payload.flop_1) if payload.flop_1 is not None else None,
        flop_2=str(payload.flop_2) if payload.flop_2 is not None else None,
        flop_3=str(payload.flop_3) if payload.flop_3 is not None else None,
        turn=str(payload.turn) if payload.turn is not None else None,
        river=str(payload.river) if payload.river is not None else None,
    )
    db.add(hand)
    db.flush()

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
            card_1=str(entry.card_1) if entry.card_1 is not None else None,
            card_2=str(entry.card_2) if entry.card_2 is not None else None,
            result=entry.result,
            profit_loss=entry.profit_loss,
        )
        db.add(ph)
        db.flush()

    db.commit()
    db.refresh(hand)

    return _build_hand_response(hand, db)


@router.patch(
    '/{game_id}/hands/{hand_number}/players/{player_name}/result',
    response_model=PlayerHandResponse,
)
def update_player_result(
    game_id: int,
    hand_number: int,
    player_name: str,
    payload: PlayerResultUpdate,
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

    player = (
        db.query(Player).filter(func.lower(Player.name) == player_name.lower()).first()
    )
    if player is None:
        raise HTTPException(status_code=404, detail=f'Player {player_name!r} not found')

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
            detail=f'Player {player_name!r} not found in this hand',
        )

    # --- Outcome street validation ---
    # 'handed_back' is a participation marker, not an outcome — skip validation
    if payload.outcome_street and payload.result != 'handed_back':
        street = payload.outcome_street

        # 1. Validate community cards exist for the claimed street
        if street == 'flop' and hand.flop_1 is None:
            raise HTTPException(
                status_code=400,
                detail='Cannot set outcome_street to flop — flop cards have not been dealt',
            )
        if street == 'turn' and hand.turn is None:
            raise HTTPException(
                status_code=400,
                detail='Cannot set outcome_street to turn — turn card has not been dealt',
            )
        if street == 'river' and hand.river is None:
            raise HTTPException(
                status_code=400,
                detail='Cannot set outcome_street to river — river card has not been dealt',
            )

        # 2. Cross-validate outcome streets:
        #    - Winners and losers (non-fold) must share the same outcome_street (showdown street)
        #    - Folders may fold on any street on or before the showdown street
        STREET_ORDER = {'preflop': 0, 'flop': 1, 'turn': 2, 'river': 3}
        other_phs = (
            db.query(PlayerHand)
            .filter(
                PlayerHand.hand_id == hand.hand_id,
                PlayerHand.player_id != player.player_id,
            )
            .all()
        )

        # Collect showdown street (from won/lost results) and folder streets separately
        showdown_streets = set()
        folder_streets = []
        for oph in other_phs:
            if oph.outcome_street and oph.result in ('won', 'lost'):
                showdown_streets.add(oph.outcome_street)
            elif oph.outcome_street and oph.result == 'folded':
                folder_streets.append(oph.outcome_street)

        current_is_fold = payload.result == 'folded'
        incoming_order = STREET_ORDER.get(street, -1)

        if current_is_fold:
            # Folder: must be on or before any existing showdown street
            if showdown_streets:
                showdown_order = max(STREET_ORDER.get(s, -1) for s in showdown_streets)
                if incoming_order > showdown_order:
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            f'Cannot fold on {street!r} — showdown street is '
                            f'{next(iter(showdown_streets))!r}. '
                            f'Folders must fold on or before the showdown street.'
                        ),
                    )
        else:
            # Winner/loser: must match existing showdown street exactly
            if showdown_streets and street not in showdown_streets:
                existing = ', '.join(sorted(showdown_streets))
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f'Winners and losers must share the same outcome_street. '
                        f'Existing showdown street: {existing}. '
                        f'Cannot set {player_name!r} to {street!r}.'
                    ),
                )
            # Also check: if only folders exist, the new showdown street must be >= all folder streets
            if folder_streets:
                max_folder_order = max(STREET_ORDER.get(s, -1) for s in folder_streets)
                if incoming_order < max_folder_order:
                    offending = [
                        s
                        for s in folder_streets
                        if STREET_ORDER.get(s, -1) > incoming_order
                    ]
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            f'Cannot set showdown street to {street!r} — '
                            f'existing fold(s) on later street(s): {", ".join(offending)}. '
                            f'Folders must fold on or before the showdown street.'
                        ),
                    )

    ph.result = payload.result
    ph.profit_loss = payload.profit_loss
    ph.outcome_street = payload.outcome_street

    db.commit()
    db.refresh(ph)

    return PlayerHandResponse(
        player_hand_id=ph.player_hand_id,
        hand_id=ph.hand_id,
        player_id=ph.player_id,
        player_name=player.name,
        card_1=ph.card_1,
        card_2=ph.card_2,
        result=ph.result,
        profit_loss=ph.profit_loss,
        outcome_street=ph.outcome_street,
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

    return _build_hand_response(hand, db)


@router.post(
    '/{game_id}/hands/{hand_number}/players/{player_name}/actions',
    status_code=201,
    response_model=PlayerActionResponse,
)
def record_player_action(
    game_id: int,
    hand_number: int,
    player_name: str,
    payload: PlayerActionCreate,
    db: Annotated[Session, Depends(get_db)],
    force: bool = Query(default=False),
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

    player = (
        db.query(Player).filter(func.lower(Player.name) == player_name.lower()).first()
    )
    if player is None:
        raise HTTPException(status_code=404, detail=f'Player {player_name!r} not found')

    player_hand = (
        db.query(PlayerHand)
        .filter(
            PlayerHand.hand_id == hand.hand_id,
            PlayerHand.player_id == player.player_id,
        )
        .first()
    )
    if player_hand is None:
        raise HTTPException(
            status_code=404,
            detail=f'Player {player_name!r} is not recorded in this hand',
        )

    # Turn-order validation (skip if force=true or no hand state)
    hand_state = db.query(HandState).filter(HandState.hand_id == hand.hand_id).first()
    if hand_state and not force:
        expected_name = _get_player_name_for_seat(db, game_id, hand_state.current_seat)
        if expected_name and expected_name.lower() != player_name.lower():
            raise HTTPException(
                status_code=409,
                detail=(
                    f"It is {expected_name}'s turn (seat {hand_state.current_seat}), "
                    f"not {player_name}'s"
                ),
            )

    if payload.action == 'fold':
        if player_hand.result == 'folded':
            raise HTTPException(
                status_code=400,
                detail=f'Player {player_name!r} has already folded',
            )
        player_hand.result = 'folded'

    action = PlayerHandAction(
        player_hand_id=player_hand.player_hand_id,
        street=payload.street,
        action=payload.action,
        amount=payload.amount,
    )
    db.add(action)

    # Advance turn state
    if hand_state:
        hand_state.action_index += 1
        next_s = _next_seat(db, game_id, hand, hand_state.current_seat)
        hand_state.current_seat = next_s
        # Check if phase should advance
        _try_advance_phase(db, game_id, hand, hand_state)

    db.commit()
    db.refresh(action)
    return action
