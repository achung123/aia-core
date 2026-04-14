"""Tests for Card model accepting shorthand string input like 'AH', '10S'."""

import pytest
from pydantic import ValidationError

from pydantic_models.common import Card
from pydantic_models.hand_schemas import HoleCardsUpdate, PlayerHandEntry


class TestCardFromString:
    """Card model should accept both dict and shorthand string input."""

    def test_card_from_dict(self):
        card = Card(rank='A', suit='H')
        assert str(card) == 'AH'

    def test_card_from_two_char_string(self):
        card = Card.model_validate('AH')
        assert card.rank == 'A'
        assert card.suit == 'H'

    def test_card_from_three_char_string_ten(self):
        card = Card.model_validate('10S')
        assert card.rank == '10'
        assert card.suit == 'S'

    def test_card_from_lowercase_string(self):
        card = Card.model_validate('ah')
        assert card.rank == 'A'
        assert card.suit == 'H'

    def test_card_from_mixed_case(self):
        card = Card.model_validate('Kd')
        assert card.rank == 'K'
        assert card.suit == 'D'

    def test_card_invalid_string(self):
        with pytest.raises(ValidationError):
            Card.model_validate('XZ')

    def test_card_empty_string(self):
        with pytest.raises(ValidationError):
            Card.model_validate('')

    def test_card_single_char(self):
        with pytest.raises(ValidationError):
            Card.model_validate('A')


class TestPlayerHandEntryStringCards:
    """PlayerHandEntry should accept string cards from the frontend."""

    def test_string_cards(self):
        entry = PlayerHandEntry(player_name='Alice', card_1='AH', card_2='KC')
        assert str(entry.card_1) == 'AH'
        assert str(entry.card_2) == 'KC'

    def test_none_cards(self):
        entry = PlayerHandEntry(player_name='Alice')
        assert entry.card_1 is None
        assert entry.card_2 is None

    def test_dict_cards_still_work(self):
        entry = PlayerHandEntry(
            player_name='Alice',
            card_1={'rank': 'A', 'suit': 'H'},
            card_2={'rank': 'K', 'suit': 'C'},
        )
        assert str(entry.card_1) == 'AH'
        assert str(entry.card_2) == 'KC'


class TestHoleCardsUpdateStringCards:
    """HoleCardsUpdate should accept string cards from the frontend."""

    def test_string_cards(self):
        update = HoleCardsUpdate(card_1='AH', card_2='KC')
        assert str(update.card_1) == 'AH'
        assert str(update.card_2) == 'KC'
