"""Tests for card_class_map — bidirectional mapping between YOLO class IDs and AIA notation."""

import pytest

from app.services.card_class_map import class_id_to_card, card_to_class_id


class TestClassIdToCard:
    """class_id_to_card returns AIA notation for a YOLO class index."""

    def test_index_0_is_10C(self):
        assert class_id_to_card(0) == '10C'

    def test_index_39_is_AS(self):
        assert class_id_to_card(39) == 'AS'

    def test_index_44_is_KC(self):
        assert class_id_to_card(44) == 'KC'

    def test_index_48_is_QC(self):
        assert class_id_to_card(48) == 'QC'

    def test_index_4_is_2C(self):
        assert class_id_to_card(4) == '2C'

    def test_negative_index_raises(self):
        with pytest.raises(ValueError):
            class_id_to_card(-1)

    def test_index_52_raises(self):
        with pytest.raises(ValueError):
            class_id_to_card(52)

    def test_index_100_raises(self):
        with pytest.raises(ValueError):
            class_id_to_card(100)


class TestCardToClassId:
    """card_to_class_id returns the YOLO class index for an AIA notation string."""

    def test_10C_is_0(self):
        assert card_to_class_id('10C') == 0

    def test_AS_is_39(self):
        assert card_to_class_id('AS') == 39

    def test_KC_is_44(self):
        assert card_to_class_id('KC') == 44

    def test_QC_is_48(self):
        assert card_to_class_id('QC') == 48

    def test_2C_is_4(self):
        assert card_to_class_id('2C') == 4

    def test_unknown_card_raises(self):
        with pytest.raises(ValueError):
            card_to_class_id('XX')

    def test_empty_string_raises(self):
        with pytest.raises(ValueError):
            card_to_class_id('')


class TestRoundTrip:
    """All 52 cards round-trip correctly through both functions."""

    def test_all_52_round_trip_id_to_card_to_id(self):
        for class_id in range(52):
            card = class_id_to_card(class_id)
            assert card_to_class_id(card) == class_id

    def test_all_52_cards_are_unique(self):
        cards = [class_id_to_card(i) for i in range(52)]
        assert len(set(cards)) == 52

    def test_every_rank_suit_combo_present(self):
        ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
        suits = ['S', 'H', 'D', 'C']
        expected = {f'{r}{s}' for r in ranks for s in suits}
        actual = {class_id_to_card(i) for i in range(52)}
        assert actual == expected
