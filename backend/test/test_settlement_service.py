"""Unit tests for the pure pot-building and payout functions."""

import pytest

from app.services.settlement import (
    UnresolvedPotError,
    build_pots,
    distribute_pots,
    to_cents,
)


class TestToCents:
    def test_rounds_float_noise(self):
        assert to_cents(0.1 + 0.2) == 30

    def test_none_is_zero(self):
        assert to_cents(None) == 0


class TestBuildPots:
    def test_single_pot_when_contributions_equal(self):
        pots = build_pots({1: 1000, 2: 1000, 3: 1000}, folded_ids=set())
        assert pots == [{'amount': 3000, 'eligible_player_ids': [1, 2, 3]}]

    def test_folded_money_stays_in_the_pots(self):
        # A all-in 50, B and C in for 100, D folded after putting in 100
        pots = build_pots({1: 5000, 2: 10000, 3: 10000, 4: 10000}, folded_ids={4})
        assert pots == [
            {'amount': 20000, 'eligible_player_ids': [1, 2, 3]},
            {'amount': 15000, 'eligible_player_ids': [2, 3]},
        ]

    def test_uncalled_bet_is_a_pot_only_the_bettor_can_win(self):
        pots = build_pots({1: 5000, 2: 20000}, folded_ids=set())
        assert pots == [
            {'amount': 10000, 'eligible_player_ids': [1, 2]},
            {'amount': 15000, 'eligible_player_ids': [2]},
        ]

    def test_folded_player_who_put_in_more_than_anyone_left(self):
        pots = build_pots({1: 5000, 2: 5000, 3: 8000}, folded_ids={3})
        assert pots == [{'amount': 18000, 'eligible_player_ids': [1, 2]}]

    def test_zero_contributors_are_not_eligible(self):
        pots = build_pots({1: 0, 2: 20, 3: 20}, folded_ids=set())
        assert pots == [{'amount': 40, 'eligible_player_ids': [2, 3]}]

    def test_no_money_means_no_pots(self):
        assert build_pots({1: 0, 2: 0}, folded_ids=set()) == []

    def test_pots_sum_to_total_contributions(self):
        contributions = {1: 1234, 2: 99, 3: 5000, 4: 5000, 5: 777}
        pots = build_pots(contributions, folded_ids={5})
        assert sum(pot['amount'] for pot in pots) == sum(contributions.values())


class TestDistributePots:
    def test_winner_takes_single_pot(self):
        pots = [{'amount': 3000, 'eligible_player_ids': [1, 2, 3]}]
        payouts, winners = distribute_pots(
            pots, [[2], [1, 3]], odd_chip_order=[1, 2, 3]
        )
        assert payouts == {2: 3000}
        assert winners == {2}

    def test_short_all_in_winner_only_takes_the_main_pot(self):
        pots = [
            {'amount': 20000, 'eligible_player_ids': [1, 2, 3]},
            {'amount': 15000, 'eligible_player_ids': [2, 3]},
        ]
        payouts, winners = distribute_pots(
            pots, [[1], [3], [2]], odd_chip_order=[1, 2, 3]
        )
        assert payouts == {1: 20000, 3: 15000}
        assert winners == {1, 3}

    def test_split_pot_odd_cent_goes_to_first_in_order(self):
        pots = [{'amount': 101, 'eligible_player_ids': [1, 2, 3]}]
        payouts, _ = distribute_pots(pots, [[1, 3], [2]], odd_chip_order=[3, 1, 2])
        assert payouts == {3: 51, 1: 50}

    def test_uncalled_bet_returns_without_counting_as_a_win(self):
        pots = [
            {'amount': 10000, 'eligible_player_ids': [1, 2]},
            {'amount': 15000, 'eligible_player_ids': [2]},
        ]
        payouts, winners = distribute_pots(pots, [[1], [2]], odd_chip_order=[1, 2])
        assert payouts == {1: 10000, 2: 15000}
        assert winners == {1}

    def test_payouts_always_sum_to_the_pots(self):
        pots = [
            {'amount': 1001, 'eligible_player_ids': [1, 2, 3, 4]},
            {'amount': 333, 'eligible_player_ids': [2, 3, 4]},
            {'amount': 7, 'eligible_player_ids': [3, 4]},
        ]
        payouts, _ = distribute_pots(
            pots, [[1, 2, 3], [4]], odd_chip_order=[4, 3, 2, 1]
        )
        assert sum(payouts.values()) == 1341

    def test_ranking_that_cannot_decide_a_pot_raises(self):
        pots = [
            {'amount': 20000, 'eligible_player_ids': [1, 2, 3]},
            {'amount': 15000, 'eligible_player_ids': [2, 3]},
        ]
        with pytest.raises(UnresolvedPotError) as excinfo:
            distribute_pots(pots, [[1]], odd_chip_order=[1, 2, 3])
        assert excinfo.value.player_ids == [2, 3]
