"""Stats router - handles statistics endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import case, func
from sqlalchemy.orm import Session, joinedload

from app.database.models import Hand, Player, PlayerHand
from app.database.queries import get_game_or_404, get_player_by_name_or_404
from app.database.session import get_db
from pydantic_models.common import ResultEnum
from pydantic_models.stats_schemas import (
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
    player = get_player_by_name_or_404(db, player_name)

    player_hands = (
        db.query(PlayerHand)
        .options(joinedload(PlayerHand.hand))
        .filter(
            PlayerHand.player_id == player.player_id,
            PlayerHand.result.isnot(None),
            PlayerHand.result != ResultEnum.HANDED_BACK,
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

    hands_won = sum(1 for player_hand in player_hands if player_hand.result == ResultEnum.WON)
    hands_lost = sum(1 for player_hand in player_hands if player_hand.result == ResultEnum.LOST)
    hands_folded = sum(1 for player_hand in player_hands if player_hand.result == ResultEnum.FOLDED)
    win_rate = round(hands_won / total * 100, 2)

    total_profit_loss = sum(player_hand.profit_loss or 0.0 for player_hand in player_hands)
    average_profit_loss_per_hand = round(total_profit_loss / total, 2)

    profit_loss_by_session: dict[int, float] = {}
    for player_hand in player_hands:
        game_id = player_hand.hand.game_id
        profit_loss_by_session[game_id] = profit_loss_by_session.get(game_id, 0.0) + (player_hand.profit_loss or 0.0)
    average_profit_loss_per_session = round(sum(profit_loss_by_session.values()) / len(profit_loss_by_session), 2)

    hands_with_turn = sum(1 for player_hand in player_hands if player_hand.hand.turn is not None)
    hands_with_river = sum(1 for player_hand in player_hands if player_hand.hand.river is not None)

    return PlayerStatsResponse(
        player_name=player.name,
        total_hands_played=total,
        hands_won=hands_won,
        hands_lost=hands_lost,
        hands_folded=hands_folded,
        win_rate=win_rate,
        total_profit_loss=round(total_profit_loss, 2),
        avg_profit_loss_per_hand=average_profit_loss_per_hand,
        avg_profit_loss_per_session=average_profit_loss_per_session,
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
            func.sum(case((PlayerHand.result == ResultEnum.WON, 1), else_=0)).label(
                'wins'
            ),
        )
        .join(PlayerHand, Player.player_id == PlayerHand.player_id)
        .filter(
            PlayerHand.result.isnot(None), PlayerHand.result != ResultEnum.HANDED_BACK
        )
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
    game = get_game_or_404(db, game_id)

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
            PlayerHand.result != ResultEnum.HANDED_BACK,
        )
        .all()
    )

    # Aggregate per-player
    stats: dict[int, dict] = {}
    for player_hand in player_hands:
        player_id = player_hand.player_id
        if player_id not in stats:
            stats[player_id] = {
                'player_name': player_hand.player.name,
                'hands_played': 0,
                'hands_won': 0,
                'hands_lost': 0,
                'hands_folded': 0,
                'profit_loss': 0.0,
            }
        player_stats_entry = stats[player_id]
        player_stats_entry['hands_played'] += 1
        if player_hand.result == ResultEnum.WON:
            player_stats_entry['hands_won'] += 1
        elif player_hand.result == ResultEnum.LOST:
            player_stats_entry['hands_lost'] += 1
        elif player_hand.result == ResultEnum.FOLDED:
            player_stats_entry['hands_folded'] += 1
        player_stats_entry['profit_loss'] += player_hand.profit_loss or 0.0

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
    for player_stats_entry in stats.values():
        total = player_stats_entry['hands_played']
        win_rate = round(player_stats_entry['hands_won'] / total * 100, 2) if total > 0 else 0.0
        player_stats.append(
            GameStatsPlayerEntry(
                player_name=player_stats_entry['player_name'],
                hands_played=total,
                hands_won=player_stats_entry['hands_won'],
                hands_lost=player_stats_entry['hands_lost'],
                hands_folded=player_stats_entry['hands_folded'],
                win_rate=win_rate,
                profit_loss=round(player_stats_entry['profit_loss'], 2),
            )
        )

    player_stats.sort(key=lambda e: e.player_name)

    return GameStatsResponse(
        game_id=game.game_id,
        game_date=game.game_date,
        total_hands=total_hands,
        player_stats=player_stats,
    )
