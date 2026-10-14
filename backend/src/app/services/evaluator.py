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
        ((rank_value, count) for rank_value, count in enumerate(frequency) if count),
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
#
# The best five of up to seven cards is read straight off rank and suit
# counts. The previous approach classified all 21 five-card subsets, which
# made a single equity simulation take seconds.


def _build_straight_table() -> list[int]:
    """Rank-bitmask → rank of the highest straight's top card, or -1."""
    table = [-1] * (1 << 13)
    for mask in range(1 << 13):
        # Bit 0 is the ace playing low; bit r+1 is rank r.
        extended = (mask << 1) | (mask >> 12)
        for high in range(12, 2, -1):
            window = 0b11111 << (high - 3)
            if extended & window == window:
                table[mask] = high
                break
    return table


_STRAIGHT_HIGH = _build_straight_table()


def best_hand(cards: list[tuple[int, int]]) -> tuple[int, list[int]]:
    """Best five-card hand from 5-7 cards → (category, kickers).

    Categories and kicker order match `classify_five_cards`, so scores from
    `compute_hand_score` are identical to the brute-force result.
    """
    counts = [0] * 13
    suit_counts = [0, 0, 0, 0]
    suit_masks = [0, 0, 0, 0]
    mask = 0
    for rank, suit in cards:
        counts[rank] += 1
        suit_counts[suit] += 1
        suit_masks[suit] |= 1 << rank
        mask |= 1 << rank

    flush_mask = 0
    for suit in range(4):
        if suit_counts[suit] >= 5:
            flush_mask = suit_masks[suit]
            straight_flush_high = _STRAIGHT_HIGH[flush_mask]
            if straight_flush_high >= 0:
                return (8, [straight_flush_high])
            break

    quads = -1
    trips: list[int] = []
    pairs: list[int] = []
    singles: list[int] = []
    for rank in range(12, -1, -1):
        count = counts[rank]
        if count == 0:
            continue
        if count == 4:
            quads = rank
        elif count == 3:
            trips.append(rank)
        elif count == 2:
            pairs.append(rank)
        else:
            singles.append(rank)

    if quads >= 0:
        kicker = max(rank for rank in range(13) if counts[rank] and rank != quads)
        return (7, [quads, kicker])

    if trips and (len(trips) > 1 or pairs):
        second_trips = trips[1] if len(trips) > 1 else -1
        best_pair = pairs[0] if pairs else -1
        return (6, [trips[0], max(second_trips, best_pair)])

    if flush_mask:
        flush_ranks = [rank for rank in range(12, -1, -1) if flush_mask >> rank & 1]
        return (5, flush_ranks[:5])

    straight_high = _STRAIGHT_HIGH[mask]
    if straight_high >= 0:
        return (4, [straight_high])

    if trips:
        return (3, [trips[0], *sorted(pairs + singles, reverse=True)[:2]])

    if len(pairs) >= 2:
        kicker = max(pairs[2:] + singles)
        return (2, [pairs[0], pairs[1], kicker])

    if pairs:
        return (1, [pairs[0], *singles[:3]])

    return (0, singles[:5])


def find_best_five_card_hand(
    cards: list[tuple[int, int]],
) -> tuple[int, list[int]]:
    """Find the best 5-card hand from 5-7 cards → (category, group_ranks)."""
    if len(cards) < 5:
        return (0, [0])
    return best_hand(cards)


def find_best_five_card_score(cards: list[tuple[int, int]]) -> int:
    """Numeric score of the best 5-card hand from 5-7 cards."""
    if len(cards) < 5:
        return -1
    category, kickers = best_hand(cards)
    return compute_hand_score(category, kickers)


def brute_force_best_score(cards: list[tuple[int, int]]) -> int:
    """Reference implementation: score every five-card subset. Tests only."""
    best = -1
    for combo in combinations(cards, 5):
        current_score = evaluate_five_cards(*combo)
        if current_score > best:
            best = current_score
    return best
