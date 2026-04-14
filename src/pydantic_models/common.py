from __future__ import annotations

from enum import Enum
from typing import Annotated

from pydantic import (
    BaseModel,
    ConfigDict,
    StringConstraints,
    model_validator,
)

# Reusable constrained type: strips whitespace, then requires ≥1 char.
PlayerName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


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


class ActionEnum(str, Enum):
    FOLD = 'fold'
    CHECK = 'check'
    CALL = 'call'
    BET = 'bet'
    RAISE = 'raise'


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
