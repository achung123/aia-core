import pytest
from pydantic import ValidationError

from pydantic_models.app_models import Card, CardRank, CardSuit, Hand, Role


def test_valid_card():
    card = Card(rank=CardRank.ACE, suit=CardSuit.SPADES)
    assert card.rank == CardRank.ACE
    assert card.suit == CardSuit.SPADES


def test_invalid_card_rank():
    with pytest.raises(ValidationError):
        Card(rank="Ace", suit=CardSuit.SPADES)


def test_invalid_card_suit():
    with pytest.raises(ValidationError):
        Card(rank=CardRank.ACE, suit="Spades")


def test_valid_hand():
    card1 = Card(rank=CardRank.ACE, suit=CardSuit.SPADES)
    card2 = Card(rank=CardRank.KING, suit=CardSuit.HEARTS)
    hand = Hand(cards=[card1, card2], role=Role.PLAYER)
    assert hand.cards[0].rank == CardRank.ACE
    assert hand.cards[0].suit == CardSuit.SPADES
    assert hand.cards[1].rank == CardRank.KING
    assert hand.cards[1].suit == CardSuit.HEARTS
    assert hand.role == Role.PLAYER


def test_invalid_hand_role():
    card1 = Card(rank=CardRank.ACE, suit=CardSuit.SPADES)
    card2 = Card(rank=CardRank.KING, suit=CardSuit.HEARTS)
    with pytest.raises(ValidationError):
        Hand(cards=[card1, card2], role="Player")
