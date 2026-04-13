"""Upload router - handles file upload endpoints."""

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database.models import GamePlayer, GameSession, Hand, Player, PlayerHand
from app.database.session import get_db
from pydantic_models.app_models import CSVCommitSummary, ResultEnum
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
