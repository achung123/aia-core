"""Upload router - handles file upload endpoints."""

import csv
import io
import json
import zipfile
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database.models import (
    GamePlayer,
    GameSession,
    Hand,
    Player,
    PlayerHand,
    PlayerHandAction,
    Rebuy,
)
from app.database.session import get_db
from pydantic_models.common import ResultEnum
from pydantic_models.csv_schemas import CSVCommitSummary, ZipCommitSummary
from pydantic_models.csv_schema import (
    CSV_COLUMNS,
    CSV_COLUMN_FORMATS,
    parse_csv,
    validate_csv_rows,
)

router = APIRouter(prefix='/upload', tags=['upload'])


@router.get('/csv/schema')
def get_csv_schema():
    return {
        'columns': CSV_COLUMNS,
        'formats': CSV_COLUMN_FORMATS,
    }


@router.post('/csv')
async def upload_csv(file: UploadFile):
    """Accept a CSV file upload, validate it, and return a validation report."""
    content = await file.read()
    csv_text = content.decode('utf-8')

    try:
        grouped = parse_csv(csv_text)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    total_rows = sum(len(rows) for rows in grouped.values())
    errors = validate_csv_rows(grouped)

    return {
        'valid': len(errors) == 0,
        'total_rows': total_rows,
        'error_count': len(errors),
        'errors': errors,
    }


@router.post('/csv/commit', status_code=201, response_model=CSVCommitSummary)
async def commit_csv(
    file: UploadFile,
    db: Annotated[Session, Depends(get_db)],
):
    """Parse, validate, and bulk-commit CSV data in a single transaction."""
    content = await file.read()
    csv_text = content.decode('utf-8')

    try:
        grouped = parse_csv(csv_text)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    errors = validate_csv_rows(grouped)
    if errors:
        raise HTTPException(
            status_code=400,
            detail={'valid': False, 'error_count': len(errors), 'errors': errors},
        )

    games_created = 0
    hands_created = 0
    players_created = 0
    players_matched = 0

    # Track within-commit state to avoid duplicate DB hits
    session_by_date: dict[str, GameSession] = {}
    player_by_name: dict[str, Player] = {}

    try:
        for (game_date_str, hand_number_str), rows in grouped.items():
            # --- Game Session ---
            if game_date_str not in session_by_date:
                game_date = datetime.strptime(game_date_str, '%m-%d-%Y').date()
                game_session = GameSession(game_date=game_date, status='active')
                db.add(game_session)
                db.flush()
                games_created += 1
                session_by_date[game_date_str] = game_session

            game_session = session_by_date[game_date_str]
            hand_number = int(hand_number_str)

            # --- Hand (community cards from first row) ---
            first_row = rows[0]
            flop_1_val = first_row['flop_1'].strip() or None
            flop_2_val = first_row['flop_2'].strip() or None
            flop_3_val = first_row['flop_3'].strip() or None
            turn_val = first_row['turn'].strip() or None
            river_val = first_row['river'].strip() or None
            hand = Hand(
                game_id=game_session.game_id,
                hand_number=hand_number,
                flop_1=flop_1_val,
                flop_2=flop_2_val,
                flop_3=flop_3_val,
                turn=turn_val,
                river=river_val,
            )
            db.add(hand)
            db.flush()
            hands_created += 1

            # --- Players and PlayerHands ---
            for row in rows:
                player_name = row['player_name'].strip()
                name_key = player_name.lower()

                if name_key not in player_by_name:
                    existing = (
                        db.query(Player)
                        .filter(func.lower(Player.name) == name_key)
                        .first()
                    )
                    if existing is None:
                        player = Player(name=player_name)
                        db.add(player)
                        db.flush()
                        players_created += 1
                    else:
                        player = existing
                        players_matched += 1
                    player_by_name[name_key] = player

                player = player_by_name[name_key]

                # Link player to game session if not already linked
                already_linked = (
                    db.query(GamePlayer)
                    .filter(
                        GamePlayer.game_id == game_session.game_id,
                        GamePlayer.player_id == player.player_id,
                    )
                    .first()
                )
                if already_linked is None:
                    db.add(
                        GamePlayer(
                            game_id=game_session.game_id,
                            player_id=player.player_id,
                        )
                    )

                pl_str = row['profit_loss'].strip()
                raw_result = row['result'].strip() or None
                if raw_result is not None:
                    try:
                        raw_result = ResultEnum(raw_result).value
                    except ValueError:
                        raise HTTPException(
                            status_code=400,
                            detail=f'Invalid result {raw_result!r} for player {player_name!r}. '
                            f'Must be one of: {[e.value for e in ResultEnum]}',
                        ) from None
                db.add(
                    PlayerHand(
                        hand_id=hand.hand_id,
                        player_id=player.player_id,
                        card_1=row['hole_card_1'].strip(),
                        card_2=row['hole_card_2'].strip(),
                        result=raw_result,
                        profit_loss=float(pl_str) if pl_str else None,
                        outcome_street=row.get('outcome_street', '').strip() or None,
                        is_all_in=row.get('is_all_in', '').strip().lower() == 'true',
                    )
                )

        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f'Commit failed: {exc}') from exc

    return CSVCommitSummary(
        games_created=games_created,
        hands_created=hands_created,
        players_created=players_created,
        players_matched=players_matched,
    )


# ── ZIP Import Endpoints ─────────────────────────────────


def _read_zip_csvs(content: bytes) -> dict[str, str]:
    """Extract CSV files from a ZIP archive."""
    try:
        zf = zipfile.ZipFile(io.BytesIO(content))
    except zipfile.BadZipFile as exc:
        raise HTTPException(status_code=400, detail='Invalid ZIP file') from exc
    return {name: zf.read(name).decode('utf-8') for name in zf.namelist()}


def _validate_zip_structure(files: dict[str, str]) -> list[str]:
    """Return list of validation errors for the ZIP structure."""
    errors = []
    if 'game_info.csv' not in files:
        errors.append('Missing required file: game_info.csv')
    if 'hands.csv' not in files:
        errors.append('Missing required file: hands.csv')
    return errors


@router.post('/zip')
async def upload_zip(file: UploadFile):
    """Validate a ZIP file containing multi-CSV game data."""
    content = await file.read()
    files = _read_zip_csvs(content)
    errors = _validate_zip_structure(files)

    return {
        'valid': len(errors) == 0,
        'files_found': len(files),
        'files': list(files.keys()),
        'errors': errors,
    }


@router.post('/zip/commit', status_code=201, response_model=ZipCommitSummary)
async def commit_zip(
    file: UploadFile,
    db: Annotated[Session, Depends(get_db)],
):
    """Parse and commit a multi-CSV ZIP game archive."""
    content = await file.read()
    files = _read_zip_csvs(content)
    errors = _validate_zip_structure(files)
    if errors:
        raise HTTPException(status_code=400, detail={'errors': errors})

    games_created = 0
    hands_created = 0
    players_created = 0
    players_matched = 0
    actions_created = 0
    rebuys_created = 0

    player_by_name: dict[str, Player] = {}

    def _get_or_create_player(name: str) -> Player:
        nonlocal players_created, players_matched
        key = name.lower()
        if key in player_by_name:
            return player_by_name[key]
        existing = db.query(Player).filter(func.lower(Player.name) == key).first()
        if existing:
            players_matched += 1
            player_by_name[key] = existing
            return existing
        player = Player(name=name)
        db.add(player)
        db.flush()
        players_created += 1
        player_by_name[key] = player
        return player

    try:
        # Parse game_info.csv
        gi_reader = csv.DictReader(io.StringIO(files['game_info.csv']))
        gi_rows = list(gi_reader)
        if not gi_rows:
            raise HTTPException(status_code=400, detail='game_info.csv is empty')
        gi = gi_rows[0]

        game_date = datetime.strptime(gi['game_date'], '%m-%d-%Y').date()
        sb_val = gi.get('small_blind', '').strip()
        bb_val = gi.get('big_blind', '').strip()
        timer_val = gi.get('blind_timer_minutes', '').strip()
        buyin_val = gi.get('default_buy_in', '').strip()
        winners_raw = gi.get('winners', '').strip()

        # Build winners JSON
        winners_json = None
        if winners_raw:
            winner_names = [w.strip() for w in winners_raw.split(',') if w.strip()]
            winners_json = json.dumps(winner_names)

        game = GameSession(
            game_date=game_date,
            status=gi.get('status', 'active').strip() or 'active',
            small_blind=float(sb_val) if sb_val else None,
            big_blind=float(bb_val) if bb_val else None,
            blind_timer_minutes=int(timer_val) if timer_val else None,
            default_buy_in=float(buyin_val) if buyin_val else None,
            winners=winners_json,
        )
        db.add(game)
        db.flush()
        games_created += 1

        # Parse players.csv (optional)
        if 'players.csv' in files:
            pl_reader = csv.DictReader(io.StringIO(files['players.csv']))
            for row in pl_reader:
                name = row['player_name'].strip()
                player = _get_or_create_player(name)
                seat = row.get('seat_number', '').strip()
                buy_in = row.get('buy_in', '').strip()
                chips = row.get('current_chips', '').strip()
                is_active = row.get('is_active', 'true').strip().lower() != 'false'
                gp = GamePlayer(
                    game_id=game.game_id,
                    player_id=player.player_id,
                    seat_number=int(seat) if seat else None,
                    buy_in=float(buy_in) if buy_in else None,
                    current_chips=float(chips) if chips else None,
                    is_active=is_active,
                )
                db.add(gp)
            db.flush()

        # Parse hands.csv
        hd_reader = csv.DictReader(io.StringIO(files['hands.csv']))
        # Group by hand_number
        hand_rows: dict[str, list[dict]] = {}
        for row in hd_reader:
            hn = row['hand_number'].strip()
            hand_rows.setdefault(hn, []).append(row)

        # Map hand_number -> Hand ORM object for action linking
        hand_obj_by_number: dict[str, Hand] = {}

        for hn, rows in hand_rows.items():
            first = rows[0]
            hand = Hand(
                game_id=game.game_id,
                hand_number=int(hn),
                flop_1=first.get('flop_1', '').strip() or None,
                flop_2=first.get('flop_2', '').strip() or None,
                flop_3=first.get('flop_3', '').strip() or None,
                turn=first.get('turn', '').strip() or None,
                river=first.get('river', '').strip() or None,
            )
            db.add(hand)
            db.flush()
            hands_created += 1
            hand_obj_by_number[hn] = hand

            for row in rows:
                name = row['player_name'].strip()
                player = _get_or_create_player(name)

                # Ensure player is linked to game
                already_linked = (
                    db.query(GamePlayer)
                    .filter(
                        GamePlayer.game_id == game.game_id,
                        GamePlayer.player_id == player.player_id,
                    )
                    .first()
                )
                if not already_linked:
                    db.add(
                        GamePlayer(
                            game_id=game.game_id,
                            player_id=player.player_id,
                        )
                    )
                    db.flush()

                pl_str = row.get('profit_loss', '').strip()
                raw_result = row.get('result', '').strip() or None
                if raw_result:
                    try:
                        raw_result = ResultEnum(raw_result).value
                    except ValueError:
                        pass

                ph = PlayerHand(
                    hand_id=hand.hand_id,
                    player_id=player.player_id,
                    card_1=row.get('hole_card_1', '').strip() or None,
                    card_2=row.get('hole_card_2', '').strip() or None,
                    result=raw_result,
                    profit_loss=float(pl_str) if pl_str else None,
                    outcome_street=row.get('outcome_street', '').strip() or None,
                    is_all_in=row.get('is_all_in', '').strip().lower() == 'true',
                )
                db.add(ph)
                db.flush()

        # Parse actions.csv (optional)
        if 'actions.csv' in files:
            ac_reader = csv.DictReader(io.StringIO(files['actions.csv']))
            for row in ac_reader:
                hn = row['hand_number'].strip()
                name = row['player_name'].strip()
                hand = hand_obj_by_number.get(hn)
                if not hand:
                    continue
                player = _get_or_create_player(name)
                # Find the PlayerHand for this player+hand
                ph = (
                    db.query(PlayerHand)
                    .filter(
                        PlayerHand.hand_id == hand.hand_id,
                        PlayerHand.player_id == player.player_id,
                    )
                    .first()
                )
                if not ph:
                    continue
                amt = row.get('amount', '').strip()
                db.add(
                    PlayerHandAction(
                        player_hand_id=ph.player_hand_id,
                        street=row['street'].strip(),
                        action=row['action'].strip(),
                        amount=float(amt) if amt else None,
                    )
                )
                actions_created += 1
            db.flush()

        # Parse rebuys.csv (optional)
        if 'rebuys.csv' in files:
            rb_reader = csv.DictReader(io.StringIO(files['rebuys.csv']))
            for row in rb_reader:
                name = row['player_name'].strip()
                player = _get_or_create_player(name)
                db.add(
                    Rebuy(
                        game_id=game.game_id,
                        player_id=player.player_id,
                        amount=float(row['amount'].strip()),
                    )
                )
                rebuys_created += 1
            db.flush()

        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f'Commit failed: {exc}') from exc

    return ZipCommitSummary(
        games_created=games_created,
        hands_created=hands_created,
        players_created=players_created,
        players_matched=players_matched,
        actions_created=actions_created,
        rebuys_created=rebuys_created,
    )
