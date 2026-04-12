"""Stats router - handles statistics endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import case, func
from sqlalchemy.orm import Session, joinedload

from app.database.models import GameSession, Hand, Player, PlayerHand
from app.database.session import get_db
from pydantic_models.app_models import (
    GameStatsPlayerEntry,
    GameStatsResponse,
    LeaderboardEntry,
    LeaderboardMetric,
    PlayerStatsResponse,
)

router = APIRouter(prefix='/stats', tags=['stats'])


@router.get('/players/{player_name}', response_model=PlayerStatsResponse)
def get_player_stats(
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

    player_hands = (
        db.query(PlayerHand)
        .options(joinedload(PlayerHand.hand))
        .filter(
            PlayerHand.player_id == player.player_id,
            PlayerHand.result.isnot(None),
            PlayerHand.result != 'handed_back',
        )
        .all()
    )

    total = len(player_hands)

    if total == 0:
        return PlayerStatsResponse(
            player_name=player.name,
            total_hands_played=0,
            hands_won=0,
            hands_lost=0,
            hands_folded=0,
            win_rate=0.0,
            total_profit_loss=0.0,
            avg_profit_loss_per_hand=0.0,
            avg_profit_loss_per_session=0.0,
            flop_pct=0.0,
            turn_pct=0.0,
            river_pct=0.0,
        )

    hands_won = sum(1 for ph in player_hands if ph.result == 'won')
    hands_lost = sum(1 for ph in player_hands if ph.result == 'lost')
    hands_folded = sum(1 for ph in player_hands if ph.result == 'folded')
    win_rate = round(hands_won / total * 100, 2)

    total_pl = sum(ph.profit_loss or 0.0 for ph in player_hands)
    avg_pl_per_hand = round(total_pl / total, 2)

    session_pl: dict[int, float] = {}
    for ph in player_hands:
        gid = ph.hand.game_id
        session_pl[gid] = session_pl.get(gid, 0.0) + (ph.profit_loss or 0.0)
    avg_pl_per_session = round(sum(session_pl.values()) / len(session_pl), 2)

    hands_with_turn = sum(1 for ph in player_hands if ph.hand.turn is not None)
    hands_with_river = sum(1 for ph in player_hands if ph.hand.river is not None)

    return PlayerStatsResponse(
        player_name=player.name,
        total_hands_played=total,
        hands_won=hands_won,
        hands_lost=hands_lost,
        hands_folded=hands_folded,
        win_rate=win_rate,
        total_profit_loss=round(total_pl, 2),
        avg_profit_loss_per_hand=avg_pl_per_hand,
        avg_profit_loss_per_session=avg_pl_per_session,
        flop_pct=100.0,
        turn_pct=round(hands_with_turn / total * 100, 2),
        river_pct=round(hands_with_river / total * 100, 2),
    )


@router.get('/leaderboard', response_model=list[LeaderboardEntry])
def get_leaderboard(
    db: Annotated[Session, Depends(get_db)],
    metric: LeaderboardMetric = LeaderboardMetric.total_profit_loss,
):
    rows = (
        db.query(
            Player.name,
            func.count(PlayerHand.player_hand_id).label('hands_played'),
            func.coalesce(func.sum(PlayerHand.profit_loss), 0.0).label('total_pl'),
            func.sum(case((PlayerHand.result == 'won', 1), else_=0)).label('wins'),
        )
        .join(PlayerHand, Player.player_id == PlayerHand.player_id)
        .filter(PlayerHand.result.isnot(None), PlayerHand.result != 'handed_back')
        .group_by(Player.player_id, Player.name)
        .all()
    )

    entries = []
    for row in rows:
        hands = row.hands_played
        wins = row.wins or 0
        win_rate = round(wins / hands * 100, 2) if hands > 0 else 0.0
        entries.append(
            LeaderboardEntry(
                rank=0,
                player_name=row.name,
                total_profit_loss=round(float(row.total_pl), 2),
                win_rate=win_rate,
                hands_played=hands,
            )
        )

    if metric == LeaderboardMetric.win_rate:
        entries.sort(key=lambda e: e.win_rate, reverse=True)
    elif metric == LeaderboardMetric.hands_played:
        entries.sort(key=lambda e: e.hands_played, reverse=True)
    else:
        entries.sort(key=lambda e: e.total_profit_loss, reverse=True)

    for i, entry in enumerate(entries, start=1):
        entry.rank = i

    return entries


@router.get('/games/{game_id}', response_model=GameStatsResponse)
def get_game_stats(
    game_id: int,
    db: Annotated[Session, Depends(get_db)],
):
    game = db.query(GameSession).filter(GameSession.game_id == game_id).first()
    if game is None:
        raise HTTPException(status_code=404, detail='Game not found')

    total_hands = (
        db.query(func.count(Hand.hand_id)).filter(Hand.game_id == game_id).scalar()
    )

    player_hands = (
        db.query(PlayerHand)
        .join(Hand, PlayerHand.hand_id == Hand.hand_id)
        .join(Player, PlayerHand.player_id == Player.player_id)
        .filter(
            Hand.game_id == game_id,
            PlayerHand.result.isnot(None),
            PlayerHand.result != 'handed_back',
        )
        .all()
    )

    # Aggregate per-player
    stats: dict[int, dict] = {}
    for ph in player_hands:
        pid = ph.player_id
        if pid not in stats:
            stats[pid] = {
                'player_name': ph.player.name,
                'hands_played': 0,
                'hands_won': 0,
                'hands_lost': 0,
                'hands_folded': 0,
                'profit_loss': 0.0,
            }
        s = stats[pid]
        s['hands_played'] += 1
        if ph.result == 'won':
            s['hands_won'] += 1
        elif ph.result == 'lost':
            s['hands_lost'] += 1
        elif ph.result == 'folded':
            s['hands_folded'] += 1
        s['profit_loss'] += ph.profit_loss or 0.0

    # Include players registered in the session but with no results
    for player in game.players:
        if player.player_id not in stats:
            stats[player.player_id] = {
                'player_name': player.name,
                'hands_played': 0,
                'hands_won': 0,
                'hands_lost': 0,
                'hands_folded': 0,
                'profit_loss': 0.0,
            }

    player_stats = []
    for s in stats.values():
        total = s['hands_played']
        win_rate = round(s['hands_won'] / total * 100, 2) if total > 0 else 0.0
        player_stats.append(
            GameStatsPlayerEntry(
                player_name=s['player_name'],
                hands_played=total,
                hands_won=s['hands_won'],
                hands_lost=s['hands_lost'],
                hands_folded=s['hands_folded'],
                win_rate=win_rate,
                profit_loss=round(s['profit_loss'], 2),
            )
        )

    player_stats.sort(key=lambda e: e.player_name)

    return GameStatsResponse(
        game_id=game.game_id,
        game_date=game.game_date,
        total_hands=total_hands,
        player_stats=player_stats,
    )
