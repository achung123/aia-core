from __future__ import annotations

from datetime import date
from enum import Enum

from pydantic import BaseModel


class PlayerStatsResponse(BaseModel):
    player_name: str
    total_hands_played: int
    hands_won: int
    hands_lost: int
    hands_folded: int
    win_rate: float
    total_profit_loss: float
    avg_profit_loss_per_hand: float
    avg_profit_loss_per_session: float
    flop_pct: float
    turn_pct: float
    river_pct: float


class LeaderboardMetric(str, Enum):
    total_profit_loss = 'total_profit_loss'
    win_rate = 'win_rate'
    hands_played = 'hands_played'


class LeaderboardEntry(BaseModel):
    rank: int
    player_name: str
    total_profit_loss: float
    win_rate: float
    hands_played: int


class GameStatsPlayerEntry(BaseModel):
    player_name: str
    hands_played: int
    hands_won: int
    hands_lost: int
    hands_folded: int
    win_rate: float
    profit_loss: float


class GameStatsResponse(BaseModel):
    game_id: int
    game_date: date
    total_hands: int
    player_stats: list[GameStatsPlayerEntry]
