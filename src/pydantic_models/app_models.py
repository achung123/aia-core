from __future__ import annotations

from datetime import date, datetime
from enum import Enum

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    model_validator,
)


class ResultEnum(str, Enum):
    WON = 'won'
    FOLDED = 'folded'
    LOST = 'lost'
    HANDED_BACK = 'handed_back'


class StreetEnum(str, Enum):
    PREFLOP = 'preflop'
    FLOP = 'flop'
    TURN = 'turn'
    RIVER = 'river'


class CardRank(str, Enum):
    """
    Enumeration for the rank of a card.

    Attributes:
        ACE (str): The rank of Ace.
        TWO (str): The rank of Two.
        THREE (str): The rank of Three.
        FOUR (str): The rank of Four.
        FIVE (str): The rank of Five.
        SIX (str): The rank of Six.
        SEVEN (str): The rank of Seven.
        EIGHT (str): The rank of Eight.
        NINE (str): The rank of Nine.
        TEN (str): The rank of Ten.
        JACK (str): The rank of Jack.
        QUEEN (str): The rank of Queen.
        KING (str): The rank of King.

    """

    ACE = 'A'
    TWO = '2'
    THREE = '3'
    FOUR = '4'
    FIVE = '5'
    SIX = '6'
    SEVEN = '7'
    EIGHT = '8'
    NINE = '9'
    TEN = '10'
    JACK = 'J'
    QUEEN = 'Q'
    KING = 'K'


class CardSuit(str, Enum):
    """
    Enumeration for the suit of a card.

    Attributes:
        SPADES (int): The suit of Spades.
        HEART (int): The suit of Heartss.
        DIAMONDS (int): The suit of Diamonds.
        CLUBS (int): The suit of Clubs.

    """

    SPADES = 'S'
    HEARTS = 'H'
    DIAMONDS = 'D'
    CLUBS = 'C'


class Card(BaseModel):
    """
    Model representing a card.

    Attributes:
        suit (CardSuit): The suit of the card.
        rank (CardRank): The rank of the card.

    """

    model_config = ConfigDict(use_enum_values=True)

    rank: CardRank
    suit: CardSuit

    @model_validator(mode='before')
    @classmethod
    def _parse_string(cls, data):
        if isinstance(data, str):
            s = data.strip().upper()
            if len(s) == 3 and s[:2] == '10':
                return {'rank': '10', 'suit': s[2]}
            if len(s) == 2:
                return {'rank': s[0], 'suit': s[1]}
            msg = f'Invalid card string: {data!r}'
            raise ValueError(msg)
        return data

    def __str__(self) -> str:
        return f'{self.rank}{self.suit}'


# === Game/Hand/Player Request/Response Models ===


class GameSessionCreate(BaseModel):
    game_date: date
    player_names: list[str] = Field(..., min_length=1)


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
    hand_count: int
    winners: list[str] = []


class CompleteGameRequest(BaseModel):
    winners: list[str] = Field(default_factory=list, max_length=2)


class PlayerCreate(BaseModel):
    name: str


class PlayerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    player_id: int
    name: str
    created_at: datetime


class PlayerHandEntry(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    player_name: str
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


class PlayerHandResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    player_hand_id: int
    hand_id: int
    player_id: int
    player_name: str
    card_1: str | None = None
    card_2: str | None = None
    result: str | None = None
    profit_loss: float | None = None
    outcome_street: str | None = None


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
    created_at: datetime
    player_hands: list[PlayerHandResponse] = []


class HandResultUpdate(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    result: ResultEnum | None = None
    profit_loss: float


class PlayerResultEntry(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    player_name: str
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


class ConfirmCommunityCards(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    flop_1: Card
    flop_2: Card
    flop_3: Card
    turn: Card | None = None
    river: Card | None = None


class ConfirmPlayerEntry(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    player_name: str
    card_1: Card
    card_2: Card


class ConfirmDetectionRequest(BaseModel):
    community_cards: ConfirmCommunityCards
    player_hands: list[ConfirmPlayerEntry] = Field(..., min_length=1)


class CSVCommitSummary(BaseModel):
    games_created: int
    hands_created: int
    players_created: int
    players_matched: int


class PlayerEquityEntry(BaseModel):
    player_name: str
    equity: float


class EquityResponse(BaseModel):
    equities: list[PlayerEquityEntry] = []


class PlayerStatusEntry(BaseModel):
    name: str
    participation_status: str
    card_1: str | None = None
    card_2: str | None = None
    result: str | None = None
    outcome_street: str | None = None


class HandStatusResponse(BaseModel):
    hand_number: int
    community_recorded: bool
    players: list[PlayerStatusEntry]
