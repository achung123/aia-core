"""Unit tests for hand ranking description function."""

import pytest

from app.services.hand_ranking import describe_hand


class TestDescribeHand:
    """describe_hand(hole_cards, community_cards) -> str"""

    def test_royal_flush(self):
        hole = ['AS', 'KS']
        community = ['QS', 'JS', '10S', '2H', '3D']
        result = describe_hand(hole, community)
        assert 'straight flush' in result.lower() or 'royal flush' in result.lower()

    def test_four_of_a_kind(self):
        hole = ['AH', 'AS']
        community = ['AD', 'AC', '2S', '7H', '3D']
        result = describe_hand(hole, community)
        assert 'four of a kind' in result.lower()

    def test_full_house(self):
        hole = ['AH', 'AS']
        community = ['AD', 'KC', 'KS', '7H', '3D']
        result = describe_hand(hole, community)
        assert 'full house' in result.lower()

    def test_flush(self):
        hole = ['AS', 'KS']
        community = ['QS', 'JS', '2S', '7H', '3D']
        result = describe_hand(hole, community)
        assert 'flush' in result.lower()

    def test_straight(self):
        hole = ['10H', 'JD']
        community = ['QS', 'KC', 'AS', '2H', '3D']
        result = describe_hand(hole, community)
        assert 'straight' in result.lower()

    def test_three_of_a_kind(self):
        hole = ['AH', 'AS']
        community = ['AD', '5C', '2S', '7H', '3D']
        result = describe_hand(hole, community)
        assert 'three of a kind' in result.lower()

    def test_two_pair(self):
        hole = ['AH', 'KS']
        community = ['AD', 'KC', '2S', '7H', '3D']
        result = describe_hand(hole, community)
        assert 'two pair' in result.lower()

    def test_one_pair(self):
        hole = ['AH', '5S']
        community = ['AD', 'KC', '2S', '7H', '3D']
        result = describe_hand(hole, community)
        assert 'pair' in result.lower()

    def test_high_card(self):
        hole = ['AH', 'KD']
        community = ['9S', '7C', '2S', '5H', '3D']
        result = describe_hand(hole, community)
        assert 'high card' in result.lower()

    def test_returns_none_for_insufficient_cards(self):
        """Need at least 5 cards total (2 hole + 3 community minimum)."""
        hole = ['AH', 'KD']
        community = ['9S', '7C']
        result = describe_hand(hole, community)
        assert result is None

    def test_partial_community_cards_with_flop(self):
        """With only the flop (3 community), still produces a description."""
        hole = ['AH', 'AS']
        community = ['AD', 'KC', '2S']
        result = describe_hand(hole, community)
        assert result is not None
        assert 'three of a kind' in result.lower()
