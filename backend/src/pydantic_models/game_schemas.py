from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from pydantic_models.common import PlayerName
from pydantic_models.player_schemas import PlayerInfo


class GameSessionCreate(BaseModel):
    game_date: date
    player_names: list[PlayerName] = Field(..., min_length=1)
    player_buy_ins: dict[str, float] | None = None
    default_buy_in: float | None = None


class GameSessionListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    game_id: int
    game_date: date
    status: str
    player_count: int
    hand_count: int
    winners: list[str] = []


class GameSessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    game_id: int
    game_date: date
    status: str
    created_at: datetime
    player_names: list[str]
    players: list[PlayerInfo] = []
    hand_count: int
    winners: list[str] = []
    default_buy_in: float | None = None


class CompleteGameRequest(BaseModel):
    winners: list[str] = Field(default_factory=list, max_length=2)


class BlindsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    small_blind: float
    big_blind: float
    blind_timer_minutes: int
    blind_timer_paused: bool
    blind_timer_started_at: datetime | None = None
    blind_timer_remaining_seconds: int | None = None


class BlindsUpdate(BaseModel):
    small_blind: float | None = None
    big_blind: float | None = None
    blind_timer_minutes: int | None = None
    blind_timer_paused: bool | None = None
