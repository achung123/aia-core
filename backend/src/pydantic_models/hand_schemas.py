from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from pydantic_models.common import (
    ActionEnum,
    Card,
    PlayerName,
    ResultEnum,
    StreetEnum,
)


class PlayerHandEntry(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    player_name: PlayerName
    card_1: Card | None = None
    card_2: Card | None = None
    result: ResultEnum | None = None
    profit_loss: float | None = None


class HandCreate(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    flop_1: Card | None = None
    flop_2: Card | None = None
    flop_3: Card | None = None
    turn: Card | None = None
    river: Card | None = None
    player_entries: list[PlayerHandEntry] = []

    @model_validator(mode='after')
    def flop_all_or_none(self) -> HandCreate:
        flop_fields = [self.flop_1, self.flop_2, self.flop_3]
        set_count = sum(f is not None for f in flop_fields)
        if set_count not in (0, 3):
            msg = 'Flop must have all three cards or none; partial flop is not allowed'
            raise ValueError(msg)
        return self


class PlayerHandResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    player_hand_id: int
    hand_id: int
    player_id: int
    player_name: str
    card_1: str | None = None
    card_2: str | None = None
    result: ResultEnum | None = None
    profit_loss: float | None = None
    outcome_street: str | None = None
    winning_hand_description: str | None = None


class HandResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    hand_id: int
    game_id: int
    hand_number: int
    flop_1: str | None = None
    flop_2: str | None = None
    flop_3: str | None = None
    turn: str | None = None
    river: str | None = None
    source_upload_id: int | None = None
    sb_player_name: str | None = None
    bb_player_name: str | None = None
    pot: float = 0
    side_pots: list = []
    created_at: datetime
    player_hands: list[PlayerHandResponse] = []


class HandResultUpdate(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    result: ResultEnum | None = None
    profit_loss: float


class PlayerResultEntry(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    player_name: PlayerName
    result: ResultEnum | None = None
    profit_loss: float


class PlayerResultUpdate(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    result: ResultEnum
    profit_loss: float | None = None
    outcome_street: StreetEnum | None = None


class CommunityCardsUpdate(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    flop_1: Card
    flop_2: Card
    flop_3: Card
    turn: Card | None = None
    river: Card | None = None


class FlopUpdate(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    flop_1: Card
    flop_2: Card
    flop_3: Card


class TurnUpdate(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    turn: Card


class RiverUpdate(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    river: Card


class HoleCardsUpdate(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    card_1: Card | None = None
    card_2: Card | None = None


class PlayerActionCreate(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    street: StreetEnum
    action: ActionEnum
    amount: float | None = Field(default=None, ge=0)
    is_all_in: bool = False


class PlayerActionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    action_id: int
    player_hand_id: int
    street: str
    action: str
    amount: float | None = None
    created_at: datetime


class HandActionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    player_name: str
    street: str
    action: str
    amount: float | None = None
    created_at: datetime


class PlayerStatusEntry(BaseModel):
    name: str
    participation_status: str
    card_1: str | None = None
    card_2: str | None = None
    result: ResultEnum | None = None
    outcome_street: str | None = None
    is_current_turn: bool = False
    last_action: str | None = None
    current_chips: float | None = None
    pot_contribution: float = 0


class HandStatusResponse(BaseModel):
    hand_number: int
    community_recorded: bool
    players: list[PlayerStatusEntry]
    current_player_name: str | None = None
    legal_actions: list[str] = []
    amount_to_call: float = 0
    minimum_bet: float | None = None
    minimum_raise: float | None = None
    pot: float = 0
    side_pots: list = []
    street_complete: bool = False
    phase: str = 'preflop'


class HandStateResponse(BaseModel):
    phase: str
    current_seat: int | None
    current_player_name: str | None
    action_index: int
