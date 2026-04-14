"""Shared 5-card poker hand evaluator.

Extracted from equity.py and hand_ranking.py to eliminate duplicate
RANK_VAL / SUIT_VAL dicts, 5-card classification, and scoring logic.
"""

from __future__ import annotations

from itertools import combinations

RANK_VAL = {
    '2': 0,
    '3': 1,
    '4': 2,
    '5': 3,
    '6': 4,
    '7': 5,
    '8': 6,
    '9': 7,
    '10': 8,
    'T': 8,
    'J': 9,
    'Q': 10,
    'K': 11,
    'A': 12,
}
SUIT_VAL = {'h': 0, 'd': 1, 'c': 2, 's': 3, 'H': 0, 'D': 1, 'C': 2, 'S': 3}

_B = 14  # base > 13 to avoid collisions


# ---------------------------------------------------------------------------
# 5-card classification
# ---------------------------------------------------------------------------


def classify5(
    c0: tuple[int, int],
    c1: tuple[int, int],
    c2: tuple[int, int],
    c3: tuple[int, int],
    c4: tuple[int, int],
) -> tuple[int, list[int]]:
    """Classify exactly 5 cards → (category, kickers).

    Categories: 0=high card, 1=pair, 2=two pair, 3=trips, 4=straight,
    5=flush, 6=full house, 7=quads, 8=straight flush
    """
    ranks = sorted((c0[0], c1[0], c2[0], c3[0], c4[0]), reverse=True)
    flush = c0[1] == c1[1] == c2[1] == c3[1] == c4[1]

    # Straight detection
    is_straight = False
    str_hi = -1
    if len(set(ranks)) == 5:
        if ranks[0] - ranks[4] == 4:
            is_straight = True
            str_hi = ranks[0]
        elif ranks[0] == 12 and ranks[1] == 3:  # wheel A-2-3-4-5
            is_straight = True
            str_hi = 3

    # Rank frequencies — sorted by (count desc, rank desc)
    freq: list[int] = [0] * 13
    for r, _ in (c0, c1, c2, c3, c4):
        freq[r] += 1
    groups = sorted(
        ((r, cnt) for r, cnt in enumerate(freq) if cnt),
        key=lambda x: (x[1], x[0]),
        reverse=True,
    )
    group_ranks = [r for r, _ in groups]

    if flush and is_straight:
        return (8, [str_hi])
    if groups[0][1] == 4:
        return (7, group_ranks)
    if groups[0][1] == 3 and groups[1][1] == 2:
        return (6, group_ranks)
    if flush:
        return (5, ranks)
    if is_straight:
        return (4, [str_hi])
    if groups[0][1] == 3:
        return (3, group_ranks)
    if groups[0][1] == 2 and groups[1][1] == 2:
        return (2, group_ranks)
    if groups[0][1] == 2:
        return (1, group_ranks)
    return (0, ranks)


# ---------------------------------------------------------------------------
# Scoring
# ---------------------------------------------------------------------------


def score(cat: int, kickers: list[int]) -> int:
    """Numeric score for comparison — higher is better."""
    s = cat
    for i in range(5):
        s = s * _B + (kickers[i] if i < len(kickers) else 0)
    return s


def eval5(
    c0: tuple[int, int],
    c1: tuple[int, int],
    c2: tuple[int, int],
    c3: tuple[int, int],
    c4: tuple[int, int],
) -> int:
    """Evaluate exactly 5 cards → numeric score (higher is better)."""
    cat, kickers = classify5(c0, c1, c2, c3, c4)
    return score(cat, kickers)


# ---------------------------------------------------------------------------
# Best-of-N evaluators
# ---------------------------------------------------------------------------


def best_hand(cards: list[tuple[int, int]]) -> tuple[int, list[int]]:
    """Find the best 5-card hand from 5-7 cards → (category, group_ranks)."""
    best_sc = -1
    best_result = (0, [0])
    for combo in combinations(cards, 5):
        cat, ranks = classify5(*combo)
        sc = score(cat, ranks)
        if sc > best_sc:
            best_sc = sc
            best_result = (cat, ranks)
    return best_result


def best_score(cards: list[tuple[int, int]]) -> int:
    """Numeric score of the best 5-card hand from 5-7 cards."""
    best = -1
    for combo in combinations(cards, 5):
        s = eval5(*combo)
        if s > best:
            best = s
    return best
