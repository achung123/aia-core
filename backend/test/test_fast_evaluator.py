"""The fast evaluator must agree with scoring every five-card subset."""

import random

from app.services.evaluator import (
    best_hand,
    brute_force_best_score,
    find_best_five_card_score,
)

DECK = [(rank, suit) for rank in range(13) for suit in range(4)]


def card(text: str) -> tuple[int, int]:
    ranks = '23456789TJQKA'
    return (ranks.index(text[0]), 'hdcs'.index(text[1]))


def hand(*cards: str) -> list[tuple[int, int]]:
    return [card(c) for c in cards]


class TestAgreesWithBruteForce:
    def test_random_seven_card_hands(self):
        rng = random.Random(20261013)
        for _ in range(20000):
            cards = rng.sample(DECK, 7)
            assert find_best_five_card_score(cards) == brute_force_best_score(cards), (
                cards
            )

    def test_random_five_and_six_card_hands(self):
        rng = random.Random(7)
        for size in (5, 6):
            for _ in range(5000):
                cards = rng.sample(DECK, size)
                assert find_best_five_card_score(cards) == brute_force_best_score(
                    cards
                ), cards

    def test_hands_dense_in_one_suit_and_paired_ranks(self):
        # Random deals rarely hit straight flushes, quads or double trips;
        # draw from a small slice of the deck to hit them constantly.
        rng = random.Random(99)
        slice_of_deck = [
            (rank, suit) for rank in (12, 0, 1, 2, 3, 4, 5) for suit in range(4)
        ]
        for _ in range(20000):
            cards = rng.sample(slice_of_deck, 7)
            assert find_best_five_card_score(cards) == brute_force_best_score(cards), (
                cards
            )


class TestCategories:
    def test_wheel_is_a_five_high_straight(self):
        assert best_hand(hand('Ah', '2d', '3c', '4s', '5h', 'Kd', 'Qc')) == (4, [3])

    def test_steel_wheel(self):
        assert best_hand(hand('Ah', '2h', '3h', '4h', '5h', 'Kd', 'Kc')) == (8, [3])

    def test_royal_flush(self):
        assert best_hand(hand('Ts', 'Js', 'Qs', 'Ks', 'As', '2d', '2c'))[0] == 8

    def test_two_sets_of_trips_make_a_full_house(self):
        assert best_hand(hand('9h', '9d', '9c', '4s', '4h', '4d', 'Kc')) == (6, [7, 2])

    def test_three_pairs_keep_the_best_two_and_the_best_kicker(self):
        assert best_hand(hand('Ah', 'Ad', 'Kc', 'Ks', '3h', '3d', 'Qc')) == (
            2,
            [12, 11, 10],
        )

    def test_flush_beats_a_straight_on_the_same_board(self):
        assert best_hand(hand('2h', '3h', '4h', '5h', '9h', '6d', '7c'))[0] == 5

    def test_quads_take_the_best_kicker_even_from_a_pair(self):
        assert best_hand(hand('7h', '7d', '7c', '7s', 'Kh', 'Kd', '2c')) == (7, [5, 11])
