from enum import Enum
import datetime
from pydantic import BaseModel, Field, field_validator
from dateutil.parser import parse

class Role(Enum):
    """Enumeration for the role of a player in the game."""

    DEALER = "DEALER"
    PLAYER = "PLAYER"
    ON_THE_BUTTON = "ON_THE_BUTTON"


class CardRank(Enum):
    """
    Enumeration for the rank of a card.

    Attributes:
        ACE (int): The rank of Ace.
        TWO (int): The rank of Two.
        THREE (int): The rank of Three.
        FOUR (int): The rank of Four.
        FIVE (int): The rank of Five.
        SIX (int): The rank of Six.
        SEVEN (int): The rank of Seven.
        EIGHT (int): The rank of Eight.
        NINE (int): The rank of Nine.
        TEN (int): The rank of Ten.
        JACK (int): The rank of Jack.
        QUEEN (int): The rank of Queen.
        KING (int): The rank of King.

    """

    ACE = 1
    TWO = 2
    THREE = 3
    FOUR = 4
    FIVE = 5
    SIX = 6
    SEVEN = 7
    EIGHT = 8
    NINE = 9
    TEN = 10
    JACK = 11
    QUEEN = 12
    KING = 13


class CardSuit(Enum):
    """
    Enumeration for the suit of a card.

    Attributes:
        CLUBS (int): The suit of Clubs.
        DIAMONDS (int): The suit of Diamonds.
        HEARTS (int): The suit of Hearts.
        SPADES (int): The suit of Spades.

    """

    CLUBS = 1
    DIAMONDS = 2
    HEARTS = 3
    SPADES = 4


class Card(BaseModel):
    """
    Model representing a card.

    Attributes:
        rank (CardRank): The rank of the card.
        suit (CardSuit): The suit of the card.

    """

    rank: CardRank
    suit: CardSuit

class GameRequest(BaseModel):
    game_date: str = Field(..., description="Date in MM-DD-YYYY format")

    @field_validator("game_date")
    @classmethod
    def validate_game_date(cls, value: str) -> str:
        """Ensure game_date follows MM-DD-YYYY format and is a valid date."""
        try:
            parse(value, dayfirst=False, yearfirst=False)  # Validate the date
        except ValueError:
            raise ValueError("game_date must be a valid date in MM-DD-YYYY format")
        return value

# Pydantic models for data validation
class GameResponse(BaseModel):
    game_id: int
    game_date: str
    winner: str
    losers: str


class Hand(BaseModel):
    game_id: str
    player_id: str
    hand_number: int
    hole_cards: str
    on_cheese: bool


class Community(BaseModel):
    game_id: str
    hand_number: int
    board_cards: str
    active_players: str


class GameStatistic(BaseModel):
    game_id: str
    player_id: str
    best_hands: str  # possibly a list?
    hole_cards: str
