"""Tests for card validation utilities."""

import pytest

from pydantic_models.common import Card, CardRank, CardSuit
from pydantic_models.card_validator import validate_no_duplicate_cards


def test_validate_no_duplicates_with_valid_cards():
    """Test that validation passes with no duplicate cards."""
    cards = ['AS', 'KH', '2D', 'JC', '10S']
    # Should not raise any exception
    validate_no_duplicate_cards(cards)


def test_validate_no_duplicates_empty_list():
    """Test that validation passes with empty card list."""
    cards = []
    # Should not raise any exception
    validate_no_duplicate_cards(cards)


def test_validate_no_duplicates_single_card():
    """Test that validation passes with single card."""
    cards = ['AS']
    # Should not raise any exception
    validate_no_duplicate_cards(cards)


def test_validate_duplicates_raises_value_error():
    """Test that validation raises ValueError when duplicates exist."""
    cards = ['AS', 'KH', 'AS', '2D']
    with pytest.raises(ValueError) as exc_info:
        validate_no_duplicate_cards(cards)

    # Check that the error message contains the duplicate card
    assert 'AS' in str(exc_info.value)
    assert 'duplicate' in str(exc_info.value).lower()


def test_validate_multiple_duplicates():
    """Test that validation catches multiple duplicate cards."""
    cards = ['AS', 'KH', 'AS', 'KH', '2D']
    with pytest.raises(ValueError) as exc_info:
        validate_no_duplicate_cards(cards)

    # Should mention duplicates
    assert 'duplicate' in str(exc_info.value).lower()


def test_validate_case_sensitive_cards():
    """Test that card validation is case-sensitive (AS != as)."""
    # These should be treated as different based on the spec
    cards = ['AS', 'as', 'KH']
    # Since spec uses uppercase (A,2-10,J,Q,K and S,H,D,C),
    # lowercase should be different strings technically
    # But if we're strict about valid cards from Card model,
    # we'd reject lowercase. For string-based validation,
    # we treat them as is.
    validate_no_duplicate_cards(cards)


def test_validate_with_card_objects():
    """Test that validation works with Card objects converted to strings."""
    cards_objs = [
        Card(rank=CardRank.ACE, suit=CardSuit.SPADES),
        Card(rank=CardRank.KING, suit=CardSuit.HEARTS),
        Card(rank=CardRank.TWO, suit=CardSuit.DIAMONDS),
    ]
    cards_strs = [str(card) for card in cards_objs]
    validate_no_duplicate_cards(cards_strs)


def test_validate_duplicate_card_objects():
    """Test that validation catches duplicates in Card objects."""
    cards_objs = [
        Card(rank=CardRank.ACE, suit=CardSuit.SPADES),
        Card(rank=CardRank.KING, suit=CardSuit.HEARTS),
        Card(rank=CardRank.ACE, suit=CardSuit.SPADES),  # Duplicate
    ]
    cards_strs = [str(card) for card in cards_objs]
    with pytest.raises(ValueError) as exc_info:
        validate_no_duplicate_cards(cards_strs)

    assert 'AS' in str(exc_info.value)


def test_validate_all_same_cards():
    """Test validation with all cards being the same."""
    cards = ['AS', 'AS', 'AS', 'AS']
    with pytest.raises(ValueError):
        validate_no_duplicate_cards(cards)
