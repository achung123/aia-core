from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from pydantic_models.common import PlayerName


class PlayerInfo(BaseModel):
    name: str
    is_active: bool
    seat_number: int | None = None
    buy_in: float | None = None
    current_chips: float | None = None
    rebuy_count: int = 0
    total_rebuys: float = 0.0


class RebuyCreate(BaseModel):
    amount: float = Field(gt=0)


class RebuyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    rebuy_id: int
    game_id: int
    player_id: int
    amount: float
    created_at: datetime


class PlayerCreate(BaseModel):
    name: str


class PlayerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    player_id: int
    name: str
    created_at: datetime


class AddPlayerToGameRequest(BaseModel):
    player_name: PlayerName
    buy_in: float | None = None
    seat_number: int | None = Field(default=None, ge=1, le=10)


class AddPlayerToGameResponse(BaseModel):
    player_name: str
    is_active: bool
    seat_number: int | None = None
    buy_in: float | None = None


class PlayerStatusUpdate(BaseModel):
    is_active: bool


class PlayerStatusResponse(BaseModel):
    player_name: str
    is_active: bool


class SeatAssignmentRequest(BaseModel):
    seat_number: int = Field(ge=1, le=10)
    swap: bool = False
