import pytest
from pydantic import ValidationError

from pydantic_models.app_models import (
    Card,
    CardRank,
    CardSuit,
    CommunityRequest,
    CommunityState,
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


def test_valid_community_request_river():
    community_state = CommunityState(
        flop_card_0=Card(rank=CardRank.ACE, suit=CardSuit.SPADES),
        flop_card_1=Card(rank=CardRank.TWO, suit=CardSuit.CLUBS),
        flop_card_2=Card(rank=CardRank.THREE, suit=CardSuit.SPADES),
        turn_card=Card(rank=CardRank.FOUR, suit=CardSuit.DIAMONDS),
        river_card=Card(rank=CardRank.FIVE, suit=CardSuit.SPADES),
        active_players=['Gil', 'Adam', 'Zain', 'Matt'],
    )
    assert community_state.flop_card_0.rank == CardRank.ACE
    assert community_state.flop_card_0.suit == CardSuit.SPADES
    assert community_state.flop_card_1.rank == CardRank.TWO
    assert community_state.flop_card_1.suit == CardSuit.CLUBS
    assert community_state.flop_card_2.rank == CardRank.THREE
    assert community_state.flop_card_2.suit == CardSuit.SPADES

    community_request = CommunityRequest(community_state=community_state)
    assert community_request.community_state.flop_card_0.rank == CardRank.ACE
    assert community_request.community_state.flop_card_0.suit == CardSuit.SPADES

    # print() # noqa: ERA001
    # pprint.pprint(community_request.model_dump()) # noqa: ERA001
    # print() # noqa: ERA001


def test_json_validiate():
    card_dict = {'rank': 'A', 'suit': 'S'}
    card = Card.model_validate(card_dict)
    assert card.rank == CardRank.ACE
    assert card.suit == CardSuit.SPADES
    community_cards_dict = {
        'flop_card_0': {'rank': 'A', 'suit': 'S'},
        'flop_card_1': {'rank': '2', 'suit': 'C'},
        'flop_card_2': {'rank': '3', 'suit': 'S'},
        'turn_card': {'rank': '4', 'suit': 'D'},
        'river_card': {'rank': '5', 'suit': 'S'},
        'active_players': ['Gil', 'Adam', 'Zain', 'Matt'],
    }
    community_state = CommunityState.model_validate(community_cards_dict)
    assert community_state.flop_card_0.rank == CardRank.ACE
    assert community_state.flop_card_0.suit == CardSuit.SPADES
    assert community_state.flop_card_1.rank == CardRank.TWO
    assert community_state.flop_card_1.suit == CardSuit.CLUBS
    assert community_state.flop_card_2.rank == CardRank.THREE
    assert community_state.flop_card_2.suit == CardSuit.SPADES

    # print()  # noqa: ERA001
    # pprint.pprint(community_request.model_dump())  # noqa: ERA001
    # print()  # noqa: ERA001
