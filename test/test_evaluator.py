"""Tests for the shared 5-card poker hand evaluator."""

from app.services.evaluator import (
    RANK_VAL,
    SUIT_VAL,
    best_hand,
    best_score,
    classify5,
    eval5,
    score,
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


class TestClassify5:
    """classify5 returns (category, kickers) for each hand type."""

    def test_high_card(self):
        # A K 9 7 2, mixed suits
        cat, _ = classify5(_c(12, 0), _c(11, 1), _c(7, 2), _c(5, 3), _c(0, 0))
        assert cat == 0

    def test_pair(self):
        # AA 9 7 2
        cat, kickers = classify5(_c(12, 0), _c(12, 1), _c(7, 2), _c(5, 3), _c(0, 0))
        assert cat == 1
        assert kickers[0] == 12  # pair rank

    def test_two_pair(self):
        # AA KK 2
        cat, kickers = classify5(_c(12, 0), _c(12, 1), _c(11, 2), _c(11, 3), _c(0, 0))
        assert cat == 2
        assert kickers[0] == 12
        assert kickers[1] == 11

    def test_three_of_a_kind(self):
        # AAA K 2
        cat, kickers = classify5(_c(12, 0), _c(12, 1), _c(12, 2), _c(11, 3), _c(0, 0))
        assert cat == 3
        assert kickers[0] == 12

    def test_straight(self):
        # 5 6 7 8 9 mixed suits
        cat, kickers = classify5(_c(3, 0), _c(4, 1), _c(5, 2), _c(6, 3), _c(7, 0))
        assert cat == 4
        assert kickers[0] == 7  # high card of straight

    def test_wheel_straight(self):
        # A 2 3 4 5 mixed suits
        cat, kickers = classify5(_c(12, 0), _c(0, 1), _c(1, 2), _c(2, 3), _c(3, 0))
        assert cat == 4
        assert kickers[0] == 3  # wheel high is 5 (value 3)

    def test_flush(self):
        # A K 9 7 2 all hearts
        cat, _ = classify5(_c(12, 0), _c(11, 0), _c(7, 0), _c(5, 0), _c(0, 0))
        assert cat == 5

    def test_full_house(self):
        # AAA KK
        cat, kickers = classify5(_c(12, 0), _c(12, 1), _c(12, 2), _c(11, 3), _c(11, 0))
        assert cat == 6
        assert kickers[0] == 12
        assert kickers[1] == 11

    def test_four_of_a_kind(self):
        # AAAA K
        cat, kickers = classify5(
            _c(12, 0), _c(12, 1), _c(12, 2), _c(12, 3), _c(11, 0)
        )
        assert cat == 7
        assert kickers[0] == 12

    def test_straight_flush(self):
        # 5h 6h 7h 8h 9h
        cat, kickers = classify5(_c(3, 0), _c(4, 0), _c(5, 0), _c(6, 0), _c(7, 0))
        assert cat == 8
        assert kickers[0] == 7

    def test_royal_flush(self):
        # 10s Js Qs Ks As
        cat, kickers = classify5(_c(8, 3), _c(9, 3), _c(10, 3), _c(11, 3), _c(12, 3))
        assert cat == 8
        assert kickers[0] == 12


# ---------------------------------------------------------------------------
# score
# ---------------------------------------------------------------------------


class TestScore:
    """score(cat, kickers) produces correct ordering."""

    def test_higher_category_always_wins(self):
        # Pair < Two Pair < Trips < Straight < Flush < Full House < Quads < SF
        cats = list(range(9))
        scores = [score(c, [12, 11, 10, 9, 8]) for c in cats]
        assert scores == sorted(scores)

    def test_same_category_kicker_breaks_tie(self):
        # Pair of Aces > Pair of Kings
        s_aa = score(1, [12, 11, 10, 9])
        s_kk = score(1, [11, 12, 10, 9])
        assert s_aa > s_kk


# ---------------------------------------------------------------------------
# eval5
# ---------------------------------------------------------------------------


class TestEval5:
    """eval5 returns the same score as score(classify5(...))."""

    def test_eval5_matches_classify_then_score(self):
        cards = (_c(12, 0), _c(12, 1), _c(7, 2), _c(5, 3), _c(0, 0))
        cat, kickers = classify5(*cards)
        assert eval5(*cards) == score(cat, kickers)


# ---------------------------------------------------------------------------
# best_hand / best_score
# ---------------------------------------------------------------------------


class TestBestHand:
    """best_hand picks the best 5-card combo from 5-7 cards."""

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
        cat, _ = best_hand(cards)
        assert cat == 5  # flush

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
        cat, kickers = best_hand(cards)
        assert cat == 6  # full house
        assert kickers[0] == 12
        assert kickers[1] == 11


class TestBestScore:
    """best_score returns a numeric score consistent with best_hand."""

    def test_consistent_with_best_hand(self):
        cards = [
            _c(12, 0),
            _c(12, 1),
            _c(12, 2),
            _c(11, 0),
            _c(11, 1),
            _c(5, 3),
            _c(0, 2),
        ]
        cat, kickers = best_hand(cards)
        assert best_score(cards) == score(cat, kickers)

    def test_flush_beats_straight(self):
        flush_cards = [_c(12, 0), _c(10, 0), _c(7, 0), _c(5, 0), _c(3, 0)]
        straight_cards = [_c(4, 0), _c(5, 1), _c(6, 2), _c(7, 3), _c(8, 0)]
        assert best_score(flush_cards) > best_score(straight_cards)
