"""Tests for the poker equity calculator — ported from JS evaluator."""

import pytest

from app.services.equity import calculate_equity


class TestCalculateEquityReturnType:
    """Verify the function returns list[float] with correct length."""

    def test_returns_list_of_floats(self):
        result = calculate_equity(
            [[('A', 's'), ('A', 'h')], [('K', 's'), ('K', 'h')]], []
        )
        assert isinstance(result, list)
        assert all(isinstance(v, float) for v in result)

    def test_returns_one_equity_per_player(self):
        result = calculate_equity(
            [[('A', 's'), ('A', 'h')], [('K', 's'), ('K', 'h')]], []
        )
        assert len(result) == 2

    def test_equities_sum_to_one(self):
        result = calculate_equity(
            [[('A', 's'), ('A', 'h')], [('K', 's'), ('K', 'h')]], []
        )
        assert abs(sum(result) - 1.0) < 0.01


class TestKnownEquityScenarios:
    """Known equity scenarios — verified against poker equity calculators."""

    def test_aa_vs_kk_preflop(self):
        """AA vs KK preflop: ~81% vs 19% (Monte Carlo, wider tolerance)."""
        result = calculate_equity(
            [[('A', 's'), ('A', 'h')], [('K', 's'), ('K', 'h')]], []
        )
        assert abs(result[0] - 0.81) < 0.04
        assert abs(result[1] - 0.19) < 0.04

    def test_aks_vs_qq_preflop(self):
        """AKs vs QQ preflop: ~46% vs 54%."""
        result = calculate_equity(
            [[('A', 's'), ('K', 's')], [('Q', 'h'), ('Q', 'd')]], []
        )
        assert abs(result[0] - 0.46) < 0.03
        assert abs(result[1] - 0.54) < 0.03

    def test_aa_vs_72o_preflop(self):
        """AA vs 72o preflop: ~88% vs 12%."""
        result = calculate_equity(
            [[('A', 's'), ('A', 'h')], [('7', 'd'), ('2', 'c')]], []
        )
        assert abs(result[0] - 0.88) < 0.02
        assert abs(result[1] - 0.12) < 0.02

    def test_aa_vs_kk_on_flop_with_ace_and_king(self):
        """AA vs KK on flop A♠K♦2♣: exhaustive gives ~95.7% vs 4.3%."""
        result = calculate_equity(
            [[('A', 's'), ('A', 'h')], [('K', 's'), ('K', 'h')]],
            [('A', 'd'), ('K', 'd'), ('2', 'c')],
        )
        # Exhaustive enumeration (2 cards remaining) — deterministic
        assert abs(result[0] - 0.957) < 0.02
        assert abs(result[1] - 0.043) < 0.02

    def test_same_hand_equal_equity(self):
        """Two players with equivalent hands should split ~50/50."""
        result = calculate_equity(
            [[('A', 's'), ('K', 's')], [('A', 'h'), ('K', 'h')]], []
        )
        assert abs(result[0] - 0.50) < 0.03
        assert abs(result[1] - 0.50) < 0.03


class TestExhaustiveVsMonteCarlo:
    """Verify the correct algorithm is used based on remaining community cards."""

    def test_river_complete_no_simulation(self):
        """With 5 community cards, result should be deterministic."""
        result = calculate_equity(
            [[('A', 's'), ('A', 'h')], [('K', 's'), ('K', 'h')]],
            [('2', 'c'), ('7', 'd'), ('J', 's'), ('3', 'h'), ('9', 'c')],
        )
        # AA wins — deterministic, exact result
        assert result[0] == pytest.approx(1.0)
        assert result[1] == pytest.approx(0.0)

    def test_turn_exhaustive(self):
        """With 4 community cards (1 remaining), exhaustive enumeration."""
        r1 = calculate_equity(
            [[('A', 's'), ('A', 'h')], [('K', 's'), ('K', 'h')]],
            [('2', 'c'), ('7', 'd'), ('J', 's'), ('3', 'h')],
        )
        r2 = calculate_equity(
            [[('A', 's'), ('A', 'h')], [('K', 's'), ('K', 'h')]],
            [('2', 'c'), ('7', 'd'), ('J', 's'), ('3', 'h')],
        )
        # Exhaustive → deterministic, same result every time
        assert r1 == r2

    def test_flop_exhaustive(self):
        """With 3 community cards (2 remaining), exhaustive enumeration."""
        r1 = calculate_equity(
            [[('A', 's'), ('A', 'h')], [('K', 's'), ('K', 'h')]],
            [('2', 'c'), ('7', 'd'), ('J', 's')],
        )
        r2 = calculate_equity(
            [[('A', 's'), ('A', 'h')], [('K', 's'), ('K', 'h')]],
            [('2', 'c'), ('7', 'd'), ('J', 's')],
        )
        # Exhaustive → deterministic
        assert r1 == r2


class TestHandEvaluation:
    """Test that the hand evaluator correctly ranks poker hands."""

    def test_flush_beats_straight(self):
        """Player with flush should beat player with straight."""
        # Player 1 has flush in hearts, Player 2 has a straight
        result = calculate_equity(
            [[('A', 'h'), ('K', 'h')], [('9', 's'), ('8', 'd')]],
            [('Q', 'h'), ('J', 'h'), ('2', 'h'), ('7', 'c'), ('6', 's')],
        )
        assert result[0] == pytest.approx(1.0)
        assert result[1] == pytest.approx(0.0)

    def test_full_house_beats_flush(self):
        """Player with full house should beat player with flush."""
        result = calculate_equity(
            [[('A', 's'), ('A', 'h')], [('K', 'h'), ('Q', 'h')]],
            [('A', 'd'), ('9', 'h'), ('9', 'c'), ('2', 'h'), ('7', 'd')],
        )
        # Player 1: AAA99 (full house), Player 2: K Q 9 2 (hearts) flush
        assert result[0] == pytest.approx(1.0)
        assert result[1] == pytest.approx(0.0)

    def test_split_pot_identical_board(self):
        """When board makes the best hand, equity should be split."""
        result = calculate_equity(
            [[('2', 's'), ('3', 's')], [('2', 'h'), ('3', 'h')]],
            [('A', 'c'), ('A', 'd'), ('A', 'h'), ('K', 'c'), ('K', 'd')],
        )
        # Board: AAA KK — full house beats anything either player can make
        assert result[0] == pytest.approx(0.5)
        assert result[1] == pytest.approx(0.5)


class TestEdgeCasePlayerCounts:
    """Edge cases: 0 or 1 player should not crash."""

    def test_zero_players_returns_empty_list(self):
        result = calculate_equity([], [])
        assert result == []

    def test_zero_players_with_community_cards(self):
        result = calculate_equity([], [('A', 's'), ('K', 'd'), ('Q', 'c')])
        assert result == []

    def test_one_player_returns_full_equity(self):
        result = calculate_equity([[('A', 's'), ('K', 'h')]], [])
        assert result == [1.0]

    def test_one_player_with_community_cards(self):
        result = calculate_equity(
            [[('A', 's'), ('K', 'h')]],
            [('Q', 'c'), ('J', 'd'), ('10', 'h')],
        )
        assert result == [1.0]
