from __future__ import annotations

from enum import Enum

from dateutil.parser import parse
from pydantic import BaseModel, ConfigDict, Field, computed_field, field_validator


class GameState(str, Enum):
    """
    Enumeration for the state of the game.

    Attributes:
        FLOP (str): The state of the game after the flop.
        TURN (str): The state of the game after the turn.
        RIVER (str): The state of the game after the river.
        BAD_MOVE (str): The state of the game after an invalid move.

    """

    FLOP = "flop"
    TURN = "turn"
    RIVER = "river"
    BAD_GAME_STATE = "bad_game_state"


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

    ACE = "A"
    TWO = "2"
    THREE = "3"
    FOUR = "4"
    FIVE = "5"
    SIX = "6"
    SEVEN = "7"
    EIGHT = "8"
    NINE = "9"
    TEN = "10"
    JACK = "J"
    QUEEN = "Q"
    KING = "K"


class CardSuit(str, Enum):
    """
    Enumeration for the suit of a card.

    Attributes:
        SPADES (int): The suit of Spades.
        HEART (int): The suit of Heartss.
        DIAMONDS (int): The suit of Diamonds.
        CLUBS (int): The suit of Clubs.

    """

    SPADES = "S"
    HEARTS = "H"
    DIAMONDS = "D"
    CLUBS = "C"


class Card(BaseModel):
    """
    Model representing a card.

    Attributes:
        suit (CardSuit): The suit of the card.
        rank (CardRank): The rank of the card.

    """

    model_config = ConfigDict(use_enum_values=True)

    suit: CardSuit
    rank: CardRank

    def __str__(self) -> str:
        return f"{self.rank}{self.suit}"


class GameRequest(BaseModel):
    game_date: str = Field(..., description="Date in MM-DD-YYYY format")
    players: list[str] = Field(..., description="List of player names")

    @field_validator("game_date")
    @classmethod
    def validate_game_date(cls, value: str) -> str:
        """Ensure game_date follows MM-DD-YYYY format and is a valid date."""
        try:
            parse(value, dayfirst=False, yearfirst=False)  # Validate the date
        except ValueError as e:
            msg = "game_date must be a valid date in MM-DD-YYYY format"
            raise ValueError(msg) from e
        return value


class GameResponse(BaseModel):
    game_id: int
    game_date: str
    winner: str
    losers: str


class CommunityCards(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    flop_card_0: Card
    flop_card_1: Card
    flop_card_2: Card

    turn_card: Card | None = None
    river_card: Card | None = None

    @computed_field
    @property
    def game_state(self) -> str:
        if self.river_card and self.turn_card:
            return GameState.RIVER.value
        if self.turn_card and not self.river_card:
            return GameState.TURN.value
        if not self.turn_card and not self.river_card:
            return GameState.FLOP.value
        return GameState.BAD_GAME_STATE.value


class CommunityRequest(GameRequest):
    """
    Model representing the community cards in a game.

    Attributes:
        game_date (str): The date of the game.
        hand_number (int): The number of the hand.
        community_info (CommunityInfo): The community cards.

    """

    hand_number: int

    community_cards: CommunityCards


class CommunityResponse(BaseModel):
    """
    Model representing the community cards in a game.

    Attributes:
        game_date (str): The date of the game.
        hand_number (int): The number of the hand.
        flop_card_0 (Card): The first card in the flop.
        flop_card_1 (Card): The second card in the flop.
        flop_card_2 (Card): The third card in the flop.
        turn_card (Card): The turn card.
        river_card (Card): The river card.

    """

    status: str
    message: str
    game_date: str
    hand_number: int
    community_cards: CommunityCards

    active_players: dict[GameState, list[str]] | None = None


class CommunityErrorResponse(BaseModel):
    """
    Model representing an error response for the community cards endpoint.

    Attributes:
        status (str): The status of the response.
        message (str): The error message.

    """

    status: str
    message: str
