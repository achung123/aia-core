from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict

from pydantic_models.hand_schemas import PlayerHandResponse


class HandSearchResult(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    hand_id: int
    game_id: int
    game_date: date
    hand_number: int
    flop_1: str
    flop_2: str
    flop_3: str
    turn: str | None = None
    river: str | None = None
    created_at: datetime
    player_hand: PlayerHandResponse


class PaginatedHandSearchResponse(BaseModel):
    total: int
    page: int
    per_page: int
    results: list[HandSearchResult]
