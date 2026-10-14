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
    # Expected share of the pot (ties split). win + tie-share adds up to this.
    equity: float
    # Probability of winning outright / of splitting. None when not computed
    # (the single-player "versus random hands" view).
    win: float | None = None
    tie: float | None = None
    winning_hand_description: str | None = None


class EquityResponse(BaseModel):
    equities: list[PlayerEquityEntry] = []
    # 'exact' when every remaining board was enumerated, 'monte_carlo' when
    # simulated (preflop). None when there was nothing to compute.
    method: str | None = None
    samples: int | None = None
