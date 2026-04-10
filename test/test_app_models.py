import pytest
from pydantic import ValidationError

from pydantic_models.app_models import (
    Card,
    CardRank,
    CardSuit,
)


def test_valid_card():
    card = Card(rank=CardRank.ACE, suit=CardSuit.SPADES)
    assert card.rank == CardRank.ACE
    assert card.suit == CardSuit.SPADES


def test_invalid_card_rank():
    with pytest.raises(ValidationError):
        Card(rank='Ace', suit=CardSuit.SPADES)


def test_invalid_card_suit():
    with pytest.raises(ValidationError):
        Card(rank=CardRank.ACE, suit='Spades')


def test_json_validiate():
    card_dict = {'rank': 'A', 'suit': 'S'}
    card = Card.model_validate(card_dict)
    assert card.rank == CardRank.ACE
    assert card.suit == CardSuit.SPADES
