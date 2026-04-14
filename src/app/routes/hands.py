"""Hands router - handles hand-related endpoints."""

import hashlib
import json
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload, selectinload

from app.database.models import (
    GamePlayer,
    GameSession,
    Hand,
    HandState,
    Player,
    PlayerHand,
    PlayerHandAction,
)
from app.database.queries import (
    get_game_or_404,
    get_hand_or_404,
    get_player_by_name_or_404,
    get_player_hand_or_404,
)
from app.database.session import get_db
from app.services.betting import (
    compute_side_pots,
    get_legal_actions,
    is_street_complete,
    validate_action,
)
from app.services.equity import calculate_equity, calculate_player_equity
from app.services.hand_ranking import describe_hand
from app.services.hand_state import (
    activate_preflop,
    get_actions_this_street,
    get_active_seat_order,
    next_seat,
    try_advance_phase,
)
from pydantic_models.detection_schemas import EquityResponse
from pydantic_models.hand_schemas import (
    CommunityCardsUpdate,
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


def _touch_hand_state(db: Session, hand_id: int) -> None:
    """Update HandState.updated_at to invalidate status ETags."""
    hs = db.query(HandState).filter(HandState.hand_id == hand_id).first()
    if hs:
        hs.updated_at = datetime.now(timezone.utc)


def _resolve_side_pot_names(side_pots_raw: list[dict], db: Session) -> list[dict]:
    """Replace eligible_player_ids (ints) with eligible_players (names)."""
    if not side_pots_raw:
        return []
    all_ids = {pid for sp in side_pots_raw for pid in sp.get('eligible_player_ids', [])}
    if not all_ids:
        return [
            {'amount': sp['amount'], 'eligible_players': []} for sp in side_pots_raw
        ]
    players = db.query(Player).filter(Player.player_id.in_(all_ids)).all()
    id_to_name = {p.player_id: p.name for p in players}
    return [
        {
            'amount': sp['amount'],
            'eligible_players': [
                id_to_name.get(pid, str(pid)) for pid in sp['eligible_player_ids']
            ],
        }
        for sp in side_pots_raw
    ]


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
    game = (
        db.query(GameSession)
        .options(selectinload(GameSession.players))
        .filter(GameSession.game_id == game_id)
        .first()
    )
    if game is None:
        raise HTTPException(status_code=404, detail='Game session not found')

    hand = (
        db.query(Hand)
        .options(selectinload(Hand.player_hands))
        .filter(Hand.game_id == game_id, Hand.hand_number == hand_number)
        .first()
    )
    if hand is None:
        raise HTTPException(status_code=404, detail='Hand not found')

    # Cheap ETag pre-check — avoids heavy queries if nothing changed
    state_meta = (
        db.query(HandState.updated_at, HandState.phase)
        .filter(HandState.hand_id == hand.hand_id)
        .first()
    )
    if state_meta and if_none_match:
        cheap_etag = (
            '"'
            + hashlib.md5(
                f'{hand.hand_id}:{state_meta.updated_at}:{state_meta.phase}:{hand.pot}'.encode()
            ).hexdigest()
            + '"'
        )
        if if_none_match == cheap_etag:
            return Response(status_code=304, headers={'etag': cheap_etag})

    community_recorded = any(
        c is not None for c in [hand.flop_1, hand.turn, hand.river]
    )

    # Build a lookup of player_id -> PlayerHand for this hand
    ph_by_player_id = {ph.player_id: ph for ph in hand.player_hands}

    # Build a lookup of player_hand_id -> latest action name
    last_action_by_ph_id: dict[int, str | None] = {}
    for ph in hand.player_hands:
        latest = (
            db.query(PlayerHandAction)
            .filter(PlayerHandAction.player_hand_id == ph.player_hand_id)
            .order_by(PlayerHandAction.created_at.desc())
            .first()
        )
        last_action_by_ph_id[ph.player_hand_id] = latest.action if latest else None

    # Build a lookup of player_id -> current_chips from GamePlayer
    gp_rows = (
        db.query(GamePlayer.player_id, GamePlayer.current_chips)
        .filter(GamePlayer.game_id == game_id)
        .all()
    )
    chips_by_player_id = {gp.player_id: gp.current_chips for gp in gp_rows}

    # Build a lookup of player_id -> total pot contribution (sum of all action amounts)
    contrib_by_player_id: dict[int, float] = {}
    for ph in hand.player_hands:
        all_actions = (
            db.query(PlayerHandAction.amount)
            .filter(PlayerHandAction.player_hand_id == ph.player_hand_id)
            .all()
        )
        total = round(sum(a.amount for a in all_actions if a.amount), 2)
        contrib_by_player_id[ph.player_id] = total

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
                last_action=last_action_by_ph_id.get(ph.player_hand_id) if ph else None,
                current_chips=chips_by_player_id.get(player.player_id),
                pot_contribution=contrib_by_player_id.get(player.player_id, 0),
            )
        )

    raw_side_pots = json.loads(hand.side_pots) if hand.side_pots else []
    state = db.query(HandState).filter(HandState.hand_id == hand.hand_id).first()

    # Compute shared query data once before phase advancement
    actions_data: list[dict] = []
    seats: list[tuple[int, int]] = []
    if state:
        old_phase = state.phase
        actions_data = get_actions_this_street(db, hand, state.phase)
        seats = get_active_seat_order(db, game_id, hand)
        advanced = try_advance_phase(
            db,
            game_id,
            hand,
            state,
            actions_cache=actions_data,
            seats_cache=seats,
        )
        if advanced:
            state.updated_at = datetime.now(timezone.utc)
            db.commit()
            db.refresh(state)
            db.refresh(hand)
        # If phase advanced, actions for the new phase are empty
        if state.phase != old_phase:
            actions_data = get_actions_this_street(db, hand, state.phase)

    # Reuse already-fetched game for blind amounts
    sb = game.small_blind if game else 0.10
    bb = game.big_blind if game else 0.20

    body = HandStatusResponse(
        hand_number=hand.hand_number,
        community_recorded=community_recorded,
        players=players,
        current_player_name=None,
        legal_actions=[],
        amount_to_call=0,
        minimum_bet=None,
        minimum_raise=None,
        pot=hand.pot or 0,
        side_pots=_resolve_side_pot_names(raw_side_pots, db),
        phase=state.phase if state else 'preflop',
    )

    # Add betting state info if hand state exists
    if state and state.current_seat is not None:
        body.current_player_name = _get_player_name_for_seat(
            db, game_id, state.current_seat
        )
        # Compute legal actions for the current player
        current_gp = (
            db.query(GamePlayer)
            .filter(
                GamePlayer.game_id == game_id,
                GamePlayer.seat_number == state.current_seat,
            )
            .first()
        )
        if current_gp:
            la = get_legal_actions(
                state.phase, actions_data, current_gp.player_id, (sb, bb)
            )
            body.legal_actions = la['legal_actions']
            body.amount_to_call = la['amount_to_call']
            body.minimum_bet = la['minimum_bet']
            body.minimum_raise = la['minimum_raise']

    # Compute street_complete flag (independent of current_seat)
    if state and state.phase not in ('awaiting_cards', 'showdown'):
        active_non_folded_ids = {pid for _, pid in seats}
        all_in_ids = {ph.player_id for ph in hand.player_hands if ph.is_all_in}
        body.street_complete = is_street_complete(
            actions_data,
            active_non_folded_ids,
            all_in_ids,
            state.phase,
            hand.bb_player_id,
        )

    # Set is_current_turn on each player entry
    for p in body.players:
        p.is_current_turn = (
            body.current_player_name is not None and p.name == body.current_player_name
        )

    # Refresh state to get latest updated_at after any phase advancement
    if state:
        db.refresh(state)
        etag = (
            '"'
            + hashlib.md5(
                f'{hand.hand_id}:{state.updated_at}:{state.phase}:{hand.pot}'.encode()
            ).hexdigest()
            + '"'
        )
    else:
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
    get_game_or_404(db, game_id)

    hands = (
        db.query(Hand)
        .options(selectinload(Hand.player_hands))
        .filter(Hand.game_id == game_id)
        .order_by(Hand.hand_number)
        .all()
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
    get_game_or_404(db, game_id)

    hand = get_hand_or_404(db, game_id, hand_number)

    actions = (
        db.query(PlayerHandAction)
        .join(PlayerHand, PlayerHandAction.player_hand_id == PlayerHand.player_hand_id)
        .options(joinedload(PlayerHandAction.player_hand).joinedload(PlayerHand.player))
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
    get_game_or_404(db, game_id)

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
    db.flush()

    # Start in awaiting_cards phase — blinds post after all players capture cards
    hand_state = HandState(
        hand_id=hand.hand_id,
        phase='awaiting_cards',
        current_seat=None,
        action_index=0,
    )
    db.add(hand_state)

    db.commit()
    db.refresh(hand)

    return _build_hand_response(hand, db)


@router.get('/{game_id}/hands/latest', response_model=HandResponse | None)
def get_latest_hand(
    game_id: int,
    db: Annotated[Session, Depends(get_db)],
):
    """Return the most recent hand for a game, or null if no hands exist."""
    get_game_or_404(db, game_id)

    hand = (
        db.query(Hand)
        .options(selectinload(Hand.player_hands))
        .filter(Hand.game_id == game_id)
        .order_by(Hand.hand_number.desc())
        .first()
    )
    if hand is None:
        return None

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
    get_game_or_404(db, game_id)

    hand = get_hand_or_404(db, game_id, hand_number)

    state = db.query(HandState).filter(HandState.hand_id == hand.hand_id).first()
    if state is None:
        raise HTTPException(status_code=404, detail='Hand state not found')

    # Try phase advancement (community cards may have been dealt since last action)
    advanced = try_advance_phase(db, game_id, hand, state)
    if advanced:
        state.updated_at = datetime.now(timezone.utc)
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
    get_game_or_404(db, game_id)

    hand = (
        db.query(Hand)
        .options(selectinload(Hand.player_hands))
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
    player: str | None = None,
):
    get_game_or_404(db, game_id)

    hand = get_hand_or_404(db, game_id, hand_number)

    # Collect non-folded players with non-null hole cards
    folded_player_ids = {
        ph.player_id for ph in hand.player_hands if ph.result == 'folded'
    }
    players_with_cards: list[tuple[str, list[tuple[str, str]], list[str]]] = []
    for ph in hand.player_hands:
        if ph.card_1 is None or ph.card_2 is None:
            continue
        if ph.player_id in folded_player_ids:
            continue
        p = db.query(Player).filter(Player.player_id == ph.player_id).first()
        player_name = p.name if p else ''
        hole_cards = [_db_card_to_tuple(ph.card_1), _db_card_to_tuple(ph.card_2)]
        raw_hole = [ph.card_1, ph.card_2]
        players_with_cards.append((player_name, hole_cards, raw_hole))

    # Gather community cards
    community_cards: list[tuple[str, str]] = []
    raw_community: list[str] = []
    for card_str in [hand.flop_1, hand.flop_2, hand.flop_3, hand.turn, hand.river]:
        if card_str is not None:
            community_cards.append(_db_card_to_tuple(card_str))
            raw_community.append(card_str)

    # Player-perspective equity: single player vs random opponents
    if player is not None:
        target = [
            (name, hc, raw) for name, hc, raw in players_with_cards if name == player
        ]
        if not target:
            return EquityResponse(equities=[])
        target_name, target_cards, target_raw = target[0]
        num_opponents = len(players_with_cards) - 1
        if num_opponents < 1:
            return EquityResponse(equities=[])
        eq = calculate_player_equity(target_cards, num_opponents, community_cards)
        hand_desc = describe_hand(target_raw, raw_community)
        return EquityResponse(
            equities=[
                {
                    'player_name': target_name,
                    'equity': round(eq, 4),
                    'winning_hand_description': hand_desc,
                }
            ]
        )

    # Standard multi-player equity
    if len(players_with_cards) < 2:
        return EquityResponse(equities=[])

    player_hole_cards = [hc for _, hc, _ in players_with_cards]
    equities = calculate_equity(player_hole_cards, community_cards)

    return EquityResponse(
        equities=[
            {
                'player_name': name,
                'equity': round(eq, 4),
                'winning_hand_description': describe_hand(raw, raw_community),
            }
            for (name, _, raw), eq in zip(players_with_cards, equities, strict=False)
        ]
    )


@router.patch('/{game_id}/hands/{hand_number}', response_model=HandResponse)
def edit_community_cards(
    game_id: int,
    hand_number: int,
    payload: CommunityCardsUpdate,
    db: Annotated[Session, Depends(get_db)],
):
    get_game_or_404(db, game_id)

    hand = get_hand_or_404(db, game_id, hand_number)

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

    _touch_hand_state(db, hand.hand_id)
    db.commit()
    db.refresh(hand)

    return _build_hand_response(hand, db)


def _build_hand_response(hand: Hand, db: Session) -> HandResponse:
    """Build a HandResponse from a Hand ORM object."""
    community = [
        c for c in [hand.flop_1, hand.flop_2, hand.flop_3, hand.turn, hand.river] if c
    ]

    # Batch-fetch all needed Player rows in one query
    player_ids = {ph.player_id for ph in hand.player_hands}
    if hand.sb_player_id:
        player_ids.add(hand.sb_player_id)
    if hand.bb_player_id:
        player_ids.add(hand.bb_player_id)
    players = db.query(Player).filter(Player.player_id.in_(player_ids)).all()
    id_to_name = {p.player_id: p.name for p in players}

    player_hand_responses: list[PlayerHandResponse] = []
    for ph in hand.player_hands:
        hole = [c for c in [ph.card_1, ph.card_2] if c]
        hand_desc = describe_hand(hole, community) if len(hole) == 2 else None
        player_hand_responses.append(
            PlayerHandResponse(
                player_hand_id=ph.player_hand_id,
                hand_id=ph.hand_id,
                player_id=ph.player_id,
                player_name=id_to_name.get(ph.player_id, ''),
                card_1=ph.card_1,
                card_2=ph.card_2,
                result=ph.result,
                profit_loss=ph.profit_loss,
                outcome_street=ph.outcome_street,
                winning_hand_description=hand_desc,
            )
        )
    sb_name = id_to_name.get(hand.sb_player_id) if hand.sb_player_id else None
    bb_name = id_to_name.get(hand.bb_player_id) if hand.bb_player_id else None
    raw_side_pots = json.loads(hand.side_pots) if hand.side_pots else []
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
        pot=hand.pot or 0,
        side_pots=_resolve_side_pot_names(raw_side_pots, db),
        player_hands=player_hand_responses,
    )


def _get_game_and_hand(
    game_id: int, hand_number: int, db: Session
) -> tuple[GameSession, Hand]:
    """Look up game + hand or raise 404."""
    game = get_game_or_404(db, game_id)
    hand = get_hand_or_404(db, game_id, hand_number)
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

    _touch_hand_state(db, hand.hand_id)
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

    _touch_hand_state(db, hand.hand_id)
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

    _touch_hand_state(db, hand.hand_id)
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
    get_game_or_404(db, game_id)

    hand = get_hand_or_404(db, game_id, hand_number)

    player = get_player_by_name_or_404(db, player_name)

    ph = get_player_hand_or_404(db, hand.hand_id, player.player_id, player_name)

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

    # Check if all players now have cards → transition to preflop
    state = db.query(HandState).filter(HandState.hand_id == hand.hand_id).first()
    if state and state.phase == 'awaiting_cards':
        all_have_cards = all(p.card_1 is not None for p in hand.player_hands)
        if all_have_cards:
            activate_preflop(db, game_id, hand, state)

    if state:
        state.updated_at = datetime.now(timezone.utc)

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
    game = get_game_or_404(db, game_id)

    hand = get_hand_or_404(db, game_id, hand_number)

    player = get_player_by_name_or_404(db, payload.player_name)

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
    _touch_hand_state(db, hand.hand_id)
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
    get_game_or_404(db, game_id)

    hand = get_hand_or_404(db, game_id, hand_number)

    player = get_player_by_name_or_404(db, player_name)

    ph = get_player_hand_or_404(db, hand.hand_id, player.player_id, player_name)

    _touch_hand_state(db, hand.hand_id)
    db.delete(ph)
    db.commit()


@router.delete('/{game_id}/hands/{hand_number}', status_code=204)
def delete_hand(
    game_id: int,
    hand_number: int,
    db: Annotated[Session, Depends(get_db)],
):
    get_game_or_404(db, game_id)

    hand = get_hand_or_404(db, game_id, hand_number)

    # Cascade deletes player_hands → actions, hand_state via ORM cascade
    db.delete(hand)
    db.commit()


@router.post('/{game_id}/hands', status_code=201, response_model=HandResponse)
def record_hand(
    game_id: int,
    payload: HandCreate,
    db: Annotated[Session, Depends(get_db)],
):
    game = get_game_or_404(db, game_id)

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
        player = get_player_by_name_or_404(db, entry.player_name)
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
    get_game_or_404(db, game_id)

    hand = get_hand_or_404(db, game_id, hand_number)

    player = get_player_by_name_or_404(db, player_name)

    ph = get_player_hand_or_404(db, hand.hand_id, player.player_id, player_name)

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

    # Credit/debit chip stack when profit_loss is set
    if payload.profit_loss is not None:
        gp = (
            db.query(GamePlayer)
            .filter(
                GamePlayer.game_id == game_id,
                GamePlayer.player_id == player.player_id,
            )
            .first()
        )
        if gp and gp.current_chips is not None:
            # Compute player's total contribution from betting actions in this hand
            actions = (
                db.query(PlayerHandAction)
                .filter(
                    PlayerHandAction.player_hand_id == ph.player_hand_id,
                    PlayerHandAction.action.in_(['blind', 'call', 'bet', 'raise']),
                )
                .all()
            )
            contribution = sum(a.amount or 0 for a in actions)
            # credit = contribution + profit_loss
            # For winners: equals pot share (positive)
            # For losers/folders: equals 0 (contribution already deducted)
            credit = round(contribution + payload.profit_loss, 2)
            if credit != 0:
                gp.current_chips = round(gp.current_chips + credit, 2)

    _touch_hand_state(db, hand.hand_id)
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
    get_game_or_404(db, game_id)

    hand = get_hand_or_404(db, game_id, hand_number)

    for entry in payload:
        player = get_player_by_name_or_404(db, entry.player_name)
        ph = get_player_hand_or_404(
            db, hand.hand_id, player.player_id, entry.player_name
        )
        ph.result = entry.result
        ph.profit_loss = entry.profit_loss

        # Credit/debit chip stack when profit_loss is set
        if entry.profit_loss is not None:
            gp = (
                db.query(GamePlayer)
                .filter(
                    GamePlayer.game_id == game_id,
                    GamePlayer.player_id == player.player_id,
                )
                .first()
            )
            if gp and gp.current_chips is not None:
                actions = (
                    db.query(PlayerHandAction)
                    .filter(
                        PlayerHandAction.player_hand_id == ph.player_hand_id,
                        PlayerHandAction.action.in_(['blind', 'call', 'bet', 'raise']),
                    )
                    .all()
                )
                contribution = sum(a.amount or 0 for a in actions)
                credit = round(contribution + entry.profit_loss, 2)
                if credit != 0:
                    gp.current_chips = round(gp.current_chips + credit, 2)

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
    get_game_or_404(db, game_id)

    hand = get_hand_or_404(db, game_id, hand_number)

    player = get_player_by_name_or_404(db, player_name)

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

    game_player = (
        db.query(GamePlayer)
        .filter(
            GamePlayer.game_id == game_id,
            GamePlayer.player_id == player.player_id,
        )
        .first()
    )

    action_amount = payload.amount
    if (
        payload.is_all_in
        and action_amount is None
        and payload.action in ('bet', 'raise')
    ):
        current_chips = game_player.current_chips if game_player else None
        if current_chips is None or current_chips <= 0:
            raise HTTPException(
                status_code=400,
                detail='Cannot infer all-in amount without a positive chip stack',
            )
        action_amount = round(current_chips, 2)

    # Turn-order validation (skip if force=true or no hand state)
    hand_state = db.query(HandState).filter(HandState.hand_id == hand.hand_id).first()
    if hand_state and hand_state.phase == 'awaiting_cards':
        raise HTTPException(
            status_code=403,
            detail='Awaiting card capture — all players must submit cards before betting',
        )
    if hand_state and not force:
        expected_name = _get_player_name_for_seat(db, game_id, hand_state.current_seat)
        if expected_name and expected_name.lower() != player_name.lower():
            raise HTTPException(
                status_code=403,
                detail=(
                    f"It is {expected_name}'s turn (seat {hand_state.current_seat}), "
                    f"not {player_name}'s"
                ),
            )

    # Compute amount_to_call before recording the action (for all-in detection)
    amount_to_call = 0.0
    if hand_state:
        actions_data = get_actions_this_street(db, hand, hand_state.phase)
        street_contribs: dict[int, float] = {}
        for a in actions_data:
            pid = a['player_id']
            if a['action'] in ('blind', 'call', 'bet', 'raise'):
                street_contribs[pid] = street_contribs.get(pid, 0) + (
                    a.get('amount') or 0
                )
        max_contrib = max(street_contribs.values()) if street_contribs else 0
        amount_to_call = round(
            max_contrib - street_contribs.get(player.player_id, 0), 2
        )

    # --- NLHE action validation ---
    if hand_state:
        game = db.query(GameSession).filter(GameSession.game_id == game_id).first()
        bb = game.big_blind if game else 0.20
        legal_info = get_legal_actions(
            phase=hand_state.phase,
            actions_this_street=actions_data,
            current_player_id=player.player_id,
            blind_amounts=(game.small_blind if game else 0.10, bb),
        )
        error = validate_action(
            action=payload.action,
            amount=action_amount,
            legal_actions=legal_info['legal_actions'],
            amount_to_call=legal_info['amount_to_call'],
            actions_this_street=actions_data,
            big_blind=bb,
            is_all_in=payload.is_all_in,
        )
        if error:
            raise HTTPException(status_code=400, detail=error)

    if payload.action == 'fold':
        if player_hand.result == 'folded':
            raise HTTPException(
                status_code=400,
                detail=f'Player {player_name!r} has already folded',
            )
        player_hand.result = 'folded'
        player_hand.outcome_street = payload.street

    action = PlayerHandAction(
        player_hand_id=player_hand.player_hand_id,
        street=payload.street,
        action=payload.action,
        amount=action_amount,
    )
    db.add(action)

    # Update pot and deduct from player's chip stack
    if action_amount and payload.action in ('call', 'bet', 'raise', 'blind'):
        hand.pot = (hand.pot or 0) + action_amount
        # Deduct chips from the player's stack
        if game_player and game_player.current_chips is not None:
            game_player.current_chips = round(
                game_player.current_chips - action_amount, 2
            )

    # Detect all-in: explicit flag from client or auto-detect call-for-less
    if payload.is_all_in:
        player_hand.is_all_in = True
    elif payload.action == 'call' and action_amount is not None and amount_to_call > 0:
        if action_amount < amount_to_call:
            player_hand.is_all_in = True

    db.flush()

    # Check fold-to-one
    if payload.action == 'fold':
        non_folded = [ph for ph in hand.player_hands if ph.result != 'folded']
        if len(non_folded) == 1:
            non_folded[0].result = 'won'
            non_folded[0].outcome_street = payload.street
            if hand_state:
                hand_state.phase = 'showdown'
                hand_state.current_seat = None
                hand_state.updated_at = datetime.now(timezone.utc)
            db.commit()
            db.refresh(action)
            return action

    # Compute side pots if there are all-in players
    all_in_phs = [ph for ph in hand.player_hands if ph.is_all_in]
    if all_in_phs:
        cumulative: dict[int, float] = {}
        for ph in hand.player_hands:
            total = sum(
                a.amount or 0
                for a in ph.actions
                if a.action in ('blind', 'call', 'bet', 'raise') and a.amount
            )
            cumulative[ph.player_id] = total
        non_folded_ids = {
            ph.player_id for ph in hand.player_hands if ph.result != 'folded'
        }
        all_in_ids = {ph.player_id for ph in all_in_phs}
        side_pots = compute_side_pots(cumulative, all_in_ids, non_folded_ids)
        hand.side_pots = json.dumps(side_pots)

    # Advance turn state
    if hand_state:
        hand_state.updated_at = datetime.now(timezone.utc)
        hand_state.action_index += 1
        # Compute shared query data once after flush
        seats = get_active_seat_order(db, game_id, hand)
        all_in_ids = {ph.player_id for ph in hand.player_hands if ph.is_all_in}
        seats_excl_all_in = [(s, pid) for s, pid in seats if pid not in all_in_ids]
        actions_data = get_actions_this_street(db, hand, hand_state.phase)
        next_s = next_seat(
            db,
            game_id,
            hand,
            hand_state.current_seat,
            seats_cache=seats_excl_all_in,
        )
        hand_state.current_seat = next_s
        # Check if phase should advance
        try_advance_phase(
            db,
            game_id,
            hand,
            hand_state,
            actions_cache=actions_data,
            seats_cache=seats,
        )

    db.commit()
    db.refresh(action)
    return action
