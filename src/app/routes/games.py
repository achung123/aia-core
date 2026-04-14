"""Games router - handles game-related endpoints."""

import csv
import io
import json
import zipfile
from datetime import date, datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database.models import (
    GamePlayer,
    GameSession,
    Hand,
    Player,
    Rebuy,
)
from app.database.queries import get_game_or_404
from app.database.session import get_db
from pydantic_models.game_schemas import (
    BlindsResponse,
    BlindsUpdate,
    CompleteGameRequest,
    GameSessionCreate,
    GameSessionListItem,
    GameSessionResponse,
)
from pydantic_models.player_schemas import (
    AddPlayerToGameRequest,
    AddPlayerToGameResponse,
    PlayerInfo,
    PlayerStatusResponse,
    PlayerStatusUpdate,
    RebuyCreate,
    RebuyResponse,
    SeatAssignmentRequest,
)


def _parse_winners(raw: str | None) -> list[str]:
    if not raw:
        return []
    return json.loads(raw)


def _build_players(db: Session, game_id: int) -> list[PlayerInfo]:
    """Return PlayerInfo list from GamePlayer join Player for a game."""
    rows = (
        db.query(
            Player.player_id,
            Player.name,
            GamePlayer.is_active,
            GamePlayer.seat_number,
            GamePlayer.buy_in,
            GamePlayer.current_chips,
        )
        .join(GamePlayer, GamePlayer.player_id == Player.player_id)
        .filter(GamePlayer.game_id == game_id)
        .order_by(GamePlayer.seat_number)
        .all()
    )

    # Compute rebuy stats per player id
    rebuy_rows = (
        db.query(
            Rebuy.player_id,
            func.count(Rebuy.rebuy_id).label('rebuy_count'),
            func.coalesce(func.sum(Rebuy.amount), 0.0).label('total_rebuys'),
        )
        .filter(Rebuy.game_id == game_id)
        .group_by(Rebuy.player_id)
        .all()
    )
    rebuy_map = {r.player_id: (r.rebuy_count, r.total_rebuys) for r in rebuy_rows}

    return [
        PlayerInfo(
            name=r.name,
            is_active=r.is_active,
            seat_number=r.seat_number,
            buy_in=r.buy_in,
            current_chips=r.current_chips,
            rebuy_count=rebuy_map.get(r.player_id, (0, 0.0))[0],
            total_rebuys=rebuy_map.get(r.player_id, (0, 0.0))[1],
        )
        for r in rows
    ]


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
    game = GameSession(
        game_date=payload.game_date,
        status='active',
        default_buy_in=payload.default_buy_in,
    )
    db.add(game)
    db.flush()  # populate game_id without committing

    buy_ins = payload.player_buy_ins or {}
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
        seat = len(seen_player_ids)
        player_buy_in = buy_ins.get(name, payload.default_buy_in)
        db.add(
            GamePlayer(
                game_id=game.game_id,
                player_id=player.player_id,
                seat_number=seat,
                buy_in=player_buy_in,
                current_chips=player_buy_in,
            )
        )

    db.commit()
    db.refresh(game)

    return GameSessionResponse(
        game_id=game.game_id,
        game_date=game.game_date,
        status=game.status,
        created_at=game.created_at,
        player_names=[p.name for p in game.players],
        players=_build_players(db, game.game_id),
        hand_count=len(game.hands),
        winners=_parse_winners(game.winners),
        default_buy_in=game.default_buy_in,
    )


@router.get('/{game_id}', response_model=GameSessionResponse)
def get_game_session(
    game_id: int,
    db: Annotated[Session, Depends(get_db)],
):
    game = get_game_or_404(db, game_id)
    return GameSessionResponse(
        game_id=game.game_id,
        game_date=game.game_date,
        status=game.status,
        created_at=game.created_at,
        player_names=[p.name for p in game.players],
        players=_build_players(db, game.game_id),
        hand_count=len(game.hands),
        winners=_parse_winners(game.winners),
        default_buy_in=game.default_buy_in,
    )


@router.patch('/{game_id}/complete', response_model=GameSessionResponse)
def complete_game_session(
    game_id: int,
    db: Annotated[Session, Depends(get_db)],
    payload: CompleteGameRequest | None = None,
):
    game = get_game_or_404(db, game_id)
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
        players=_build_players(db, game.game_id),
        hand_count=len(game.hands),
        winners=_parse_winners(game.winners),
        default_buy_in=game.default_buy_in,
    )


@router.patch('/{game_id}/reactivate', response_model=GameSessionResponse)
def reactivate_game_session(
    game_id: int,
    db: Annotated[Session, Depends(get_db)],
):
    game = get_game_or_404(db, game_id)
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
        players=_build_players(db, game.game_id),
        hand_count=len(game.hands),
        winners=_parse_winners(game.winners),
        default_buy_in=game.default_buy_in,
    )


@router.get('/{game_id}/blinds', response_model=BlindsResponse)
def get_blinds(
    game_id: int,
    db: Annotated[Session, Depends(get_db)],
):
    game = get_game_or_404(db, game_id)
    return BlindsResponse(
        small_blind=game.small_blind,
        big_blind=game.big_blind,
        blind_timer_minutes=game.blind_timer_minutes,
        blind_timer_paused=game.blind_timer_paused,
        blind_timer_started_at=game.blind_timer_started_at,
        blind_timer_remaining_seconds=game.blind_timer_remaining_seconds,
    )


@router.patch('/{game_id}/blinds', response_model=BlindsResponse)
def update_blinds(
    game_id: int,
    payload: BlindsUpdate,
    db: Annotated[Session, Depends(get_db)],
):
    game = get_game_or_404(db, game_id)

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    blinds_changed = False

    if payload.small_blind is not None:
        game.small_blind = payload.small_blind
        blinds_changed = True
    if payload.big_blind is not None:
        game.big_blind = payload.big_blind
        blinds_changed = True
    if payload.blind_timer_minutes is not None:
        game.blind_timer_minutes = payload.blind_timer_minutes

    # Handle pause/resume logic (AC-4)
    if payload.blind_timer_paused is not None:
        was_paused = game.blind_timer_paused
        if payload.blind_timer_paused and not was_paused:
            # Pausing: compute remaining seconds and store them
            if game.blind_timer_started_at is not None:
                elapsed = (now - game.blind_timer_started_at).total_seconds()
                total = game.blind_timer_minutes * 60
                remaining = max(0, int(total - elapsed))
                game.blind_timer_remaining_seconds = remaining
            game.blind_timer_paused = True
        elif not payload.blind_timer_paused and was_paused:
            # Resuming: adjust blind_timer_started_at so remaining time is correct
            if (
                game.blind_timer_started_at is not None
                and game.blind_timer_remaining_seconds is not None
            ):
                total = game.blind_timer_minutes * 60
                elapsed_before_pause = total - game.blind_timer_remaining_seconds
                game.blind_timer_started_at = now - timedelta(
                    seconds=elapsed_before_pause
                )
            game.blind_timer_remaining_seconds = None
            game.blind_timer_paused = False
        else:
            game.blind_timer_paused = payload.blind_timer_paused

    # AC-3: Updating blind amounts resets the timer
    if blinds_changed:
        game.blind_timer_started_at = now
        game.blind_timer_paused = False
        game.blind_timer_remaining_seconds = None

    db.commit()
    db.refresh(game)
    return BlindsResponse(
        small_blind=game.small_blind,
        big_blind=game.big_blind,
        blind_timer_minutes=game.blind_timer_minutes,
        blind_timer_paused=game.blind_timer_paused,
        blind_timer_started_at=game.blind_timer_started_at,
        blind_timer_remaining_seconds=game.blind_timer_remaining_seconds,
    )


@router.get('/{game_id}/export/csv')
def export_game_csv(
    game_id: int,
    db: Annotated[Session, Depends(get_db)],
):
    game = get_game_or_404(db, game_id)

    hands = (
        db.query(Hand).filter(Hand.game_id == game_id).order_by(Hand.hand_number).all()
    )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            'game_date',
            'hand_number',
            'player_name',
            'hole_card_1',
            'hole_card_2',
            'flop_1',
            'flop_2',
            'flop_3',
            'turn',
            'river',
            'result',
            'profit_loss',
            'outcome_street',
            'is_all_in',
        ]
    )

    game_date_str = game.game_date.strftime('%m-%d-%Y') if game.game_date else ''

    for hand in hands:
        for ph in hand.player_hands:
            player = db.query(Player).filter(Player.player_id == ph.player_id).first()
            writer.writerow(
                [
                    game_date_str,
                    hand.hand_number,
                    player.name if player else '',
                    ph.card_1 or '',
                    ph.card_2 or '',
                    hand.flop_1 or '',
                    hand.flop_2 or '',
                    hand.flop_3 or '',
                    hand.turn or '',
                    hand.river or '',
                    ph.result or '',
                    ph.profit_loss if ph.profit_loss is not None else '',
                    ph.outcome_street or '',
                    'true' if ph.is_all_in else 'false',
                ]
            )

    filename = f'game_{game_id}_{game_date_str}.csv'
    output.seek(0)
    return StreamingResponse(
        output,
        media_type='text/csv',
        headers={'Content-Disposition': f'attachment; filename="{filename}"'},
    )


@router.get('/{game_id}/export/zip')
def export_game_zip(
    game_id: int,
    db: Annotated[Session, Depends(get_db)],
):
    game = get_game_or_404(db, game_id)
    game_date_str = game.game_date.strftime('%m-%d-%Y') if game.game_date else ''

    hands = (
        db.query(Hand).filter(Hand.game_id == game_id).order_by(Hand.hand_number).all()
    )
    game_players = (
        db.query(GamePlayer, Player)
        .join(Player, GamePlayer.player_id == Player.player_id)
        .filter(GamePlayer.game_id == game_id)
        .order_by(GamePlayer.seat_number)
        .all()
    )
    rebuys = db.query(Rebuy).filter(Rebuy.game_id == game_id).all()

    # Parse winners JSON
    winners_str = ''
    if game.winners:
        try:
            winners_str = ','.join(json.loads(game.winners))
        except (json.JSONDecodeError, TypeError):
            winners_str = str(game.winners)

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
        # game_info.csv
        gi = io.StringIO()
        gi_w = csv.writer(gi)
        gi_w.writerow(
            [
                'game_date',
                'status',
                'small_blind',
                'big_blind',
                'blind_timer_minutes',
                'default_buy_in',
                'winners',
            ]
        )
        gi_w.writerow(
            [
                game_date_str,
                game.status or '',
                game.small_blind if game.small_blind is not None else '',
                game.big_blind if game.big_blind is not None else '',
                game.blind_timer_minutes
                if game.blind_timer_minutes is not None
                else '',
                game.default_buy_in if game.default_buy_in is not None else '',
                winners_str,
            ]
        )
        zf.writestr('game_info.csv', gi.getvalue())

        # players.csv
        pl = io.StringIO()
        pl_w = csv.writer(pl)
        pl_w.writerow(
            [
                'player_name',
                'seat_number',
                'buy_in',
                'current_chips',
                'is_active',
            ]
        )
        for gp, player in game_players:
            pl_w.writerow(
                [
                    player.name,
                    gp.seat_number if gp.seat_number is not None else '',
                    gp.buy_in if gp.buy_in is not None else '',
                    gp.current_chips if gp.current_chips is not None else '',
                    'true' if gp.is_active else 'false',
                ]
            )
        zf.writestr('players.csv', pl.getvalue())

        # hands.csv (enhanced)
        hd = io.StringIO()
        hd_w = csv.writer(hd)
        hd_w.writerow(
            [
                'game_date',
                'hand_number',
                'player_name',
                'hole_card_1',
                'hole_card_2',
                'flop_1',
                'flop_2',
                'flop_3',
                'turn',
                'river',
                'result',
                'profit_loss',
                'outcome_street',
                'is_all_in',
            ]
        )
        for hand in hands:
            for ph in hand.player_hands:
                player = (
                    db.query(Player).filter(Player.player_id == ph.player_id).first()
                )
                hd_w.writerow(
                    [
                        game_date_str,
                        hand.hand_number,
                        player.name if player else '',
                        ph.card_1 or '',
                        ph.card_2 or '',
                        hand.flop_1 or '',
                        hand.flop_2 or '',
                        hand.flop_3 or '',
                        hand.turn or '',
                        hand.river or '',
                        ph.result or '',
                        ph.profit_loss if ph.profit_loss is not None else '',
                        ph.outcome_street or '',
                        'true' if ph.is_all_in else 'false',
                    ]
                )
        zf.writestr('hands.csv', hd.getvalue())

        # actions.csv
        ac = io.StringIO()
        ac_w = csv.writer(ac)
        ac_w.writerow(
            [
                'hand_number',
                'player_name',
                'street',
                'action',
                'amount',
            ]
        )
        for hand in hands:
            for ph in hand.player_hands:
                player = (
                    db.query(Player).filter(Player.player_id == ph.player_id).first()
                )
                for action in ph.actions:
                    ac_w.writerow(
                        [
                            hand.hand_number,
                            player.name if player else '',
                            action.street,
                            action.action,
                            action.amount if action.amount is not None else '',
                        ]
                    )
        zf.writestr('actions.csv', ac.getvalue())

        # rebuys.csv
        rb = io.StringIO()
        rb_w = csv.writer(rb)
        rb_w.writerow(['player_name', 'amount'])
        for rebuy in rebuys:
            player = (
                db.query(Player).filter(Player.player_id == rebuy.player_id).first()
            )
            rb_w.writerow(
                [
                    player.name if player else '',
                    rebuy.amount,
                ]
            )
        zf.writestr('rebuys.csv', rb.getvalue())

    buf.seek(0)
    filename = f'game_{game_id}_{game_date_str}.zip'
    return StreamingResponse(
        buf,
        media_type='application/zip',
        headers={'Content-Disposition': f'attachment; filename="{filename}"'},
    )


@router.delete('/{game_id}', status_code=204)
def delete_game(
    game_id: int,
    db: Annotated[Session, Depends(get_db)],
):
    game = get_game_or_404(db, game_id)

    # Cascade deletes hands → player_hands → actions, hand_states via ORM cascade
    db.query(Rebuy).filter(Rebuy.game_id == game_id).delete()
    db.query(GamePlayer).filter(GamePlayer.game_id == game_id).delete()
    db.delete(game)
    db.commit()


@router.post(
    '/{game_id}/players', status_code=201, response_model=AddPlayerToGameResponse
)
def add_player_to_game(
    game_id: int,
    payload: AddPlayerToGameRequest,
    db: Annotated[Session, Depends(get_db)],
):
    get_game_or_404(db, game_id)

    # Case-insensitive player lookup
    player = (
        db.query(Player)
        .filter(func.lower(Player.name) == payload.player_name.lower())
        .first()
    )

    # Check if player is already in this game
    if player is not None:
        existing_gp = (
            db.query(GamePlayer)
            .filter(
                GamePlayer.game_id == game_id,
                GamePlayer.player_id == player.player_id,
            )
            .first()
        )
        if existing_gp is not None:
            if not existing_gp.is_active:
                raise HTTPException(
                    status_code=409,
                    detail=(
                        f'Player {player.name!r} is already in this game but inactive. '
                        'Use the toggle status endpoint to reactivate.'
                    ),
                )
            raise HTTPException(
                status_code=409,
                detail=f'Player {player.name!r} is already in this game',
            )

    # Create player if needed
    if player is None:
        try:
            with db.begin_nested():
                player = Player(name=payload.player_name)
                db.add(player)
                db.flush()
        except IntegrityError:
            player = (
                db.query(Player)
                .filter(func.lower(Player.name) == payload.player_name.lower())
                .first()
            )

    # Auto-assign seat_number: max existing + 1
    max_seat = (
        db.query(func.max(GamePlayer.seat_number))
        .filter(GamePlayer.game_id == game_id)
        .scalar()
    )
    next_seat = (max_seat or 0) + 1

    # Use requested seat_number if provided; check for conflicts
    seat = payload.seat_number if payload.seat_number is not None else next_seat
    if payload.seat_number is not None:
        occupant = (
            db.query(GamePlayer)
            .filter(
                GamePlayer.game_id == game_id,
                GamePlayer.seat_number == payload.seat_number,
                GamePlayer.is_active.is_(True),
            )
            .first()
        )
        if occupant is not None:
            occupant_name = (
                db.query(Player.name)
                .filter(Player.player_id == occupant.player_id)
                .scalar()
            )
            raise HTTPException(
                status_code=409,
                detail=f'Seat {payload.seat_number} is already occupied by {occupant_name!r}',
            )

    gp = GamePlayer(
        game_id=game_id,
        player_id=player.player_id,
        is_active=True,
        seat_number=seat,
        buy_in=payload.buy_in,
        current_chips=payload.buy_in,
    )
    db.add(gp)
    db.commit()

    return AddPlayerToGameResponse(
        player_name=player.name,
        is_active=gp.is_active,
        seat_number=gp.seat_number,
        buy_in=gp.buy_in,
    )


@router.patch(
    '/{game_id}/players/{player_name}/seat',
    response_model=PlayerInfo,
)
def assign_player_seat(
    game_id: int,
    player_name: str,
    payload: SeatAssignmentRequest,
    db: Annotated[Session, Depends(get_db)],
    force: bool = Query(default=False),
):
    get_game_or_404(db, game_id)

    # After hands have started, only dealer (force=true) can reassign seats
    if not force:
        hand_count = db.query(Hand).filter(Hand.game_id == game_id).count()
        if hand_count > 0:
            raise HTTPException(
                status_code=403,
                detail='Seat reassignment requires dealer override (?force=true) after hands have started',
            )

    player = (
        db.query(Player).filter(func.lower(Player.name) == player_name.lower()).first()
    )
    if player is None:
        raise HTTPException(
            status_code=404, detail=f'Player {player_name!r} not found in this game'
        )

    gp = (
        db.query(GamePlayer)
        .filter(
            GamePlayer.game_id == game_id,
            GamePlayer.player_id == player.player_id,
        )
        .first()
    )
    if gp is None:
        raise HTTPException(
            status_code=404, detail=f'Player {player_name!r} not found in this game'
        )

    # Check seat conflict — ignore the requesting player and inactive players
    occupant = (
        db.query(GamePlayer)
        .filter(
            GamePlayer.game_id == game_id,
            GamePlayer.seat_number == payload.seat_number,
            GamePlayer.is_active.is_(True),
            GamePlayer.player_id != player.player_id,
        )
        .first()
    )
    if occupant is not None:
        if payload.swap:
            # Swap: move occupant to the requesting player's old seat
            occupant.seat_number = gp.seat_number
        else:
            occupant_name = (
                db.query(Player.name)
                .filter(Player.player_id == occupant.player_id)
                .scalar()
            )
            raise HTTPException(
                status_code=409,
                detail=f'Seat {payload.seat_number} is already occupied by {occupant_name!r}',
            )

    gp.seat_number = payload.seat_number
    db.commit()
    db.refresh(gp)

    # Build full PlayerInfo for response
    players = _build_players(db, game_id)
    for p in players:
        if p.name == player.name:
            return p

    # Fallback (should not be reached)
    return PlayerInfo(
        name=player.name,
        is_active=gp.is_active,
        seat_number=gp.seat_number,
        buy_in=gp.buy_in,
    )


@router.patch(
    '/{game_id}/players/{player_name}/status',
    response_model=PlayerStatusResponse,
)
def toggle_player_status(
    game_id: int,
    player_name: str,
    payload: PlayerStatusUpdate,
    db: Annotated[Session, Depends(get_db)],
):
    get_game_or_404(db, game_id)

    player = (
        db.query(Player).filter(func.lower(Player.name) == player_name.lower()).first()
    )
    if player is None:
        raise HTTPException(
            status_code=404, detail=f'Player {player_name!r} not in this game'
        )

    gp = (
        db.query(GamePlayer)
        .filter(
            GamePlayer.game_id == game_id,
            GamePlayer.player_id == player.player_id,
        )
        .first()
    )
    if gp is None:
        raise HTTPException(
            status_code=404, detail=f'Player {player_name!r} not in this game'
        )

    gp.is_active = payload.is_active
    db.commit()
    db.refresh(gp)

    return PlayerStatusResponse(
        player_name=player.name,
        is_active=gp.is_active,
    )


def _get_game_player(db: Session, game_id: int, player_name: str):
    """Look up game, player and game_player; raise 404 on miss."""
    game = get_game_or_404(db, game_id)

    player = (
        db.query(Player).filter(func.lower(Player.name) == player_name.lower()).first()
    )
    if player is None:
        raise HTTPException(
            status_code=404, detail=f'Player {player_name!r} not in this game'
        )

    gp = (
        db.query(GamePlayer)
        .filter(
            GamePlayer.game_id == game_id,
            GamePlayer.player_id == player.player_id,
        )
        .first()
    )
    if gp is None:
        raise HTTPException(
            status_code=404, detail=f'Player {player_name!r} not in this game'
        )
    return game, player, gp


@router.post(
    '/{game_id}/players/{player_name}/rebuys',
    status_code=201,
    response_model=RebuyResponse,
)
def create_rebuy(
    game_id: int,
    player_name: str,
    payload: RebuyCreate,
    db: Annotated[Session, Depends(get_db)],
):
    _game, player, gp = _get_game_player(db, game_id, player_name)

    rebuy = Rebuy(
        game_id=game_id,
        player_id=player.player_id,
        amount=payload.amount,
    )
    db.add(rebuy)

    if not gp.is_active:
        gp.is_active = True

    # Add rebuy amount to player's chip stack
    if gp.current_chips is not None:
        gp.current_chips = round(gp.current_chips + payload.amount, 2)
    else:
        gp.current_chips = payload.amount

    db.commit()
    db.refresh(rebuy)
    return rebuy


@router.get(
    '/{game_id}/players/{player_name}/rebuys',
    response_model=list[RebuyResponse],
)
def list_rebuys(
    game_id: int,
    player_name: str,
    db: Annotated[Session, Depends(get_db)],
):
    _game, player, _gp = _get_game_player(db, game_id, player_name)

    rebuys = (
        db.query(Rebuy)
        .filter(Rebuy.game_id == game_id, Rebuy.player_id == player.player_id)
        .order_by(Rebuy.created_at)
        .all()
    )
    return rebuys
