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


# ── Analytics models (analytics-dashboard-007) ──────────────────────


class PlayerSessionTrend(BaseModel):
    game_id: int
    game_date: date
    hands_played: int
    hands_won: int
    win_rate: float
    profit_loss: float


class StreetBreakdown(BaseModel):
    street: str
    hands_ended: int
    player1_wins: int
    player2_wins: int


class HeadToHeadResponse(BaseModel):
    player1_name: str
    player2_name: str
    shared_hands_count: int
    showdown_count: int
    player1_showdown_wins: int
    player2_showdown_wins: int
    player1_fold_count: int
    player2_fold_count: int
    player1_fold_rate: float
    player2_fold_rate: float
    street_breakdown: list[StreetBreakdown]


class AwardEntry(BaseModel):
    award_name: str
    emoji: str
    description: str
    winner_name: str
    stat_value: float
    stat_label: str


class GameHighlight(BaseModel):
    hand_number: int
    highlight_type: str
    description: str
