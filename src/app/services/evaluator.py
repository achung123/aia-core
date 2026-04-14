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

_ENCODING_BASE = 14  # base > 13 to avoid collisions


# ---------------------------------------------------------------------------
# 5-card classification
# ---------------------------------------------------------------------------


def classify_five_cards(
    card_0: tuple[int, int],
    card_1: tuple[int, int],
    card_2: tuple[int, int],
    card_3: tuple[int, int],
    card_4: tuple[int, int],
) -> tuple[int, list[int]]:
    """Classify exactly 5 cards → (category, kickers).

    Categories: 0=high card, 1=pair, 2=two pair, 3=trips, 4=straight,
    5=flush, 6=full house, 7=quads, 8=straight flush
    """
    ranks = sorted(
        (card_0[0], card_1[0], card_2[0], card_3[0], card_4[0]), reverse=True
    )
    is_flush = card_0[1] == card_1[1] == card_2[1] == card_3[1] == card_4[1]

    # Straight detection
    is_straight = False
    straight_high_rank = -1
    if len(set(ranks)) == 5:
        if ranks[0] - ranks[4] == 4:
            is_straight = True
            straight_high_rank = ranks[0]
        elif ranks[0] == 12 and ranks[1] == 3:  # wheel A-2-3-4-5
            is_straight = True
            straight_high_rank = 3

    # Rank frequencies — sorted by (count desc, rank desc)
    frequency: list[int] = [0] * 13
    for rank_value, _ in (card_0, card_1, card_2, card_3, card_4):
        frequency[rank_value] += 1
    groups = sorted(
        (
            (rank_value, count)
            for rank_value, count in enumerate(frequency)
            if count
        ),
        key=lambda x: (x[1], x[0]),
        reverse=True,
    )
    group_ranks = [rank_value for rank_value, _ in groups]

    if is_flush and is_straight:
        return (8, [straight_high_rank])
    if groups[0][1] == 4:
        return (7, group_ranks)
    if groups[0][1] == 3 and groups[1][1] == 2:
        return (6, group_ranks)
    if is_flush:
        return (5, ranks)
    if is_straight:
        return (4, [straight_high_rank])
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


def compute_hand_score(category: int, kickers: list[int]) -> int:
    """Numeric score for comparison — higher is better."""
    encoded_score = category
    for kicker_index in range(5):
        encoded_score = encoded_score * _ENCODING_BASE + (
            kickers[kicker_index] if kicker_index < len(kickers) else 0
        )
    return encoded_score


def evaluate_five_cards(
    card_0: tuple[int, int],
    card_1: tuple[int, int],
    card_2: tuple[int, int],
    card_3: tuple[int, int],
    card_4: tuple[int, int],
) -> int:
    """Evaluate exactly 5 cards → numeric score (higher is better)."""
    category, kickers = classify_five_cards(card_0, card_1, card_2, card_3, card_4)
    return compute_hand_score(category, kickers)


# ---------------------------------------------------------------------------
# Best-of-N evaluators
# ---------------------------------------------------------------------------


def find_best_five_card_hand(
    cards: list[tuple[int, int]],
) -> tuple[int, list[int]]:
    """Find the best 5-card hand from 5-7 cards → (category, group_ranks)."""
    best_score_value = -1
    best_result = (0, [0])
    for combo in combinations(cards, 5):
        category, ranks = classify_five_cards(*combo)
        current_score = compute_hand_score(category, ranks)
        if current_score > best_score_value:
            best_score_value = current_score
            best_result = (category, ranks)
    return best_result


def find_best_five_card_score(cards: list[tuple[int, int]]) -> int:
    """Numeric score of the best 5-card hand from 5-7 cards."""
    best = -1
    for combo in combinations(cards, 5):
        current_score = evaluate_five_cards(*combo)
        if current_score > best:
            best = current_score
    return best
