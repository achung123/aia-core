"""Tests for the shared 5-card poker hand evaluator."""

from app.services.evaluator import (
    RANK_VAL,
    SUIT_VAL,
    classify_five_cards,
    compute_hand_score,
    evaluate_five_cards,
    find_best_five_card_hand,
    find_best_five_card_score,
)


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------


class TestConstants:
    """RANK_VAL and SUIT_VAL map all expected keys to ints."""

    def test_rank_val_includes_numeric_ranks(self):
        for r in ('2', '3', '4', '5', '6', '7', '8', '9'):
            assert isinstance(RANK_VAL[r], int)

    def test_rank_val_includes_face_cards(self):
        for r in ('T', 'J', 'Q', 'K', 'A'):
            assert isinstance(RANK_VAL[r], int)

    def test_rank_val_10_and_T_are_equal(self):
        assert RANK_VAL['10'] == RANK_VAL['T']

    def test_rank_val_ordering(self):
        assert RANK_VAL['2'] < RANK_VAL['3'] < RANK_VAL['A']

    def test_suit_val_lowercase(self):
        for s in ('h', 'd', 'c', 's'):
            assert isinstance(SUIT_VAL[s], int)

    def test_suit_val_uppercase(self):
        for s in ('H', 'D', 'C', 'S'):
            assert isinstance(SUIT_VAL[s], int)

    def test_suit_val_case_insensitive(self):
        assert SUIT_VAL['h'] == SUIT_VAL['H']
        assert SUIT_VAL['s'] == SUIT_VAL['S']


# ---------------------------------------------------------------------------
# classify5
# ---------------------------------------------------------------------------


# Helper: build 5 internal-rep cards from short strings
def _c(rank_int: int, suit_int: int) -> tuple[int, int]:
    return (rank_int, suit_int)


class TestClassifyFiveCards:
    """classify_five_cards returns (category, kickers) for each hand type."""

    def test_high_card(self):
        # A K 9 7 2, mixed suits
        category, _ = classify_five_cards(
            _c(12, 0), _c(11, 1), _c(7, 2), _c(5, 3), _c(0, 0)
        )
        assert category == 0

    def test_pair(self):
        # AA 9 7 2
        category, kickers = classify_five_cards(
            _c(12, 0), _c(12, 1), _c(7, 2), _c(5, 3), _c(0, 0)
        )
        assert category == 1
        assert kickers[0] == 12  # pair rank

    def test_two_pair(self):
        # AA KK 2
        category, kickers = classify_five_cards(
            _c(12, 0), _c(12, 1), _c(11, 2), _c(11, 3), _c(0, 0)
        )
        assert category == 2
        assert kickers[0] == 12
        assert kickers[1] == 11

    def test_three_of_a_kind(self):
        # AAA K 2
        category, kickers = classify_five_cards(
            _c(12, 0), _c(12, 1), _c(12, 2), _c(11, 3), _c(0, 0)
        )
        assert category == 3
        assert kickers[0] == 12

    def test_straight(self):
        # 5 6 7 8 9 mixed suits
        category, kickers = classify_five_cards(
            _c(3, 0), _c(4, 1), _c(5, 2), _c(6, 3), _c(7, 0)
        )
        assert category == 4
        assert kickers[0] == 7  # high card of straight

    def test_wheel_straight(self):
        # A 2 3 4 5 mixed suits
        category, kickers = classify_five_cards(
            _c(12, 0), _c(0, 1), _c(1, 2), _c(2, 3), _c(3, 0)
        )
        assert category == 4
        assert kickers[0] == 3  # wheel high is 5 (value 3)

    def test_flush(self):
        # A K 9 7 2 all hearts
        category, _ = classify_five_cards(
            _c(12, 0), _c(11, 0), _c(7, 0), _c(5, 0), _c(0, 0)
        )
        assert category == 5

    def test_full_house(self):
        # AAA KK
        category, kickers = classify_five_cards(
            _c(12, 0), _c(12, 1), _c(12, 2), _c(11, 3), _c(11, 0)
        )
        assert category == 6
        assert kickers[0] == 12
        assert kickers[1] == 11

    def test_four_of_a_kind(self):
        # AAAA K
        category, kickers = classify_five_cards(
            _c(12, 0), _c(12, 1), _c(12, 2), _c(12, 3), _c(11, 0)
        )
        assert category == 7
        assert kickers[0] == 12

    def test_straight_flush(self):
        # 5h 6h 7h 8h 9h
        category, kickers = classify_five_cards(
            _c(3, 0), _c(4, 0), _c(5, 0), _c(6, 0), _c(7, 0)
        )
        assert category == 8
        assert kickers[0] == 7

    def test_royal_flush(self):
        # 10s Js Qs Ks As
        category, kickers = classify_five_cards(
            _c(8, 3), _c(9, 3), _c(10, 3), _c(11, 3), _c(12, 3)
        )
        assert category == 8
        assert kickers[0] == 12


# ---------------------------------------------------------------------------
# score
# ---------------------------------------------------------------------------


class TestComputeHandScore:
    """compute_hand_score(category, kickers) produces correct ordering."""

    def test_higher_category_always_wins(self):
        # Pair < Two Pair < Trips < Straight < Flush < Full House < Quads < SF
        categories = list(range(9))
        scores = [
            compute_hand_score(category, [12, 11, 10, 9, 8]) for category in categories
        ]
        assert scores == sorted(scores)

    def test_same_category_kicker_breaks_tie(self):
        # Pair of Aces > Pair of Kings
        score_aces = compute_hand_score(1, [12, 11, 10, 9])
        score_kings = compute_hand_score(1, [11, 12, 10, 9])
        assert score_aces > score_kings


# ---------------------------------------------------------------------------
# eval5
# ---------------------------------------------------------------------------


class TestEvaluateFiveCards:
    """evaluate_five_cards returns the same score as compute_hand_score(classify_five_cards(...))."""

    def test_evaluate_five_cards_matches_classify_then_score(self):
        cards = (_c(12, 0), _c(12, 1), _c(7, 2), _c(5, 3), _c(0, 0))
        category, kickers = classify_five_cards(*cards)
        assert evaluate_five_cards(*cards) == compute_hand_score(category, kickers)


# ---------------------------------------------------------------------------
# best_hand / best_score
# ---------------------------------------------------------------------------


class TestFindBestFiveCardHand:
    """find_best_five_card_hand picks the best 5-card combo from 5-7 cards."""

    def test_selects_flush_over_pair(self):
        # 7 cards: Ah Kh Qh Jh 2h 3d 3c (flush in hearts beats pair of 3s)
        cards = [
            _c(12, 0),
            _c(11, 0),
            _c(10, 0),
            _c(9, 0),
            _c(0, 0),
            _c(1, 1),
            _c(1, 2),
        ]
        category, _ = find_best_five_card_hand(cards)
        assert category == 5  # flush

    def test_returns_correct_category_full_house(self):
        # 7 cards containing AAA KK + junk
        cards = [
            _c(12, 0),
            _c(12, 1),
            _c(12, 2),
            _c(11, 0),
            _c(11, 1),
            _c(5, 3),
            _c(0, 2),
        ]
        category, kickers = find_best_five_card_hand(cards)
        assert category == 6  # full house
        assert kickers[0] == 12
        assert kickers[1] == 11


class TestFindBestFiveCardScore:
    """find_best_five_card_score returns a numeric score consistent with find_best_five_card_hand."""

    def test_consistent_with_find_best_five_card_hand(self):
        cards = [
            _c(12, 0),
            _c(12, 1),
            _c(12, 2),
            _c(11, 0),
            _c(11, 1),
            _c(5, 3),
            _c(0, 2),
        ]
        category, kickers = find_best_five_card_hand(cards)
        assert find_best_five_card_score(cards) == compute_hand_score(category, kickers)

    def test_flush_beats_straight(self):
        flush_cards = [_c(12, 0), _c(10, 0), _c(7, 0), _c(5, 0), _c(3, 0)]
        straight_cards = [_c(4, 0), _c(5, 1), _c(6, 2), _c(7, 3), _c(8, 0)]
        assert find_best_five_card_score(flush_cards) > find_best_five_card_score(
            straight_cards
        )
