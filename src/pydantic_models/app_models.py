from enum import Enum

from pydantic import BaseModel


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


class Hand(BaseModel):
    """
    Model representing a hand of cards.

    Attributes:
        cards (list[Card]): The list of cards in the hand.
        role (Role): The role of the player holding the hand.

    """

    cards: list[Card]
    role: Role
