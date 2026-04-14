from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from pydantic_models.common import Card, PlayerName


class ConfirmCommunityCards(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    flop_1: Card
    flop_2: Card
    flop_3: Card
    turn: Card | None = None
    river: Card | None = None


class ConfirmPlayerEntry(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    player_name: PlayerName
    card_1: Card
    card_2: Card


class ConfirmDetectionRequest(BaseModel):
    community_cards: ConfirmCommunityCards
    player_hands: list[ConfirmPlayerEntry] = Field(..., min_length=1)


class PlayerEquityEntry(BaseModel):
    player_name: str
    equity: float
    winning_hand_description: str | None = None


class EquityResponse(BaseModel):
    equities: list[PlayerEquityEntry] = []
