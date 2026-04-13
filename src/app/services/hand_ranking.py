"""Hand ranking description — maps hole cards + community cards to a human-readable name."""

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

RANK_NAMES = {
    0: '2',
    1: '3',
    2: '4',
    3: '5',
    4: '6',
    5: '7',
    6: '8',
    7: '9',
    8: '10',
    9: 'Jack',
    10: 'Queen',
    11: 'King',
    12: 'Ace',
}

RANK_NAMES_PLURAL = {
    0: 'Twos',
    1: 'Threes',
    2: 'Fours',
    3: 'Fives',
    4: 'Sixes',
    5: 'Sevens',
    6: 'Eights',
    7: 'Nines',
    8: 'Tens',
    9: 'Jacks',
    10: 'Queens',
    11: 'Kings',
    12: 'Aces',
}


def _parse_card(card_str: str) -> tuple[int, int] | None:
    """Parse a card string like 'AS', '10H', 'Kd' → (rank_int, suit_int)."""
    if not card_str or len(card_str) < 2:
        return None
    suit_char = card_str[-1]
    rank_str = card_str[:-1]
    r = RANK_VAL.get(rank_str.upper() if len(rank_str) == 1 else rank_str)
    s = SUIT_VAL.get(suit_char)
    if r is None or s is None:
        return None
    return (r, s)


def _classify5(cards: list[tuple[int, int]]) -> tuple[int, list[int]]:
    """Classify exactly 5 cards → (category, sorted_group_ranks).

    Categories: 0=high card, 1=pair, 2=two pair, 3=trips, 4=straight,
    5=flush, 6=full house, 7=quads, 8=straight flush
    """
    ranks = sorted((c[0] for c in cards), reverse=True)
    is_flush = len({c[1] for c in cards}) == 1

    # Straight detection
    unique = sorted(set(ranks), reverse=True)
    is_straight = False
    straight_hi = -1
    if len(unique) == 5:
        if unique[0] - unique[4] == 4:
            is_straight = True
            straight_hi = unique[0]
        elif unique[0] == 12 and unique[1] == 3:  # wheel A-2-3-4-5
            is_straight = True
            straight_hi = 3

    # Frequency groups sorted by (count desc, rank desc)
    freq: dict[int, int] = {}
    for r in ranks:
        freq[r] = freq.get(r, 0) + 1
    groups = sorted(freq.items(), key=lambda x: (x[1], x[0]), reverse=True)
    group_ranks = [r for r, _ in groups]

    if is_flush and is_straight:
        return (8, [straight_hi])
    if groups[0][1] == 4:
        return (7, group_ranks)
    if groups[0][1] == 3 and groups[1][1] == 2:
        return (6, group_ranks)
    if is_flush:
        return (5, ranks)
    if is_straight:
        return (4, [straight_hi])
    if groups[0][1] == 3:
        return (3, group_ranks)
    if groups[0][1] == 2 and len(groups) >= 2 and groups[1][1] == 2:
        return (2, group_ranks)
    if groups[0][1] == 2:
        return (1, group_ranks)
    return (0, ranks)


def _score(cat: int, kickers: list[int]) -> int:
    """Numeric score for comparison — higher is better."""
    B = 14
    s = cat
    for i in range(5):
        s = s * B + (kickers[i] if i < len(kickers) else 0)
    return s


def _best_hand(cards: list[tuple[int, int]]) -> tuple[int, list[int]]:
    """Find the best 5-card hand from 5-7 cards → (category, group_ranks)."""
    best_score = -1
    best_result = (0, [0])
    for combo in combinations(cards, 5):
        cat, ranks = _classify5(list(combo))
        sc = _score(cat, ranks)
        if sc > best_score:
            best_score = sc
            best_result = (cat, ranks)
    return best_result


CATEGORY_NAMES = {
    0: 'High Card',
    1: 'Pair',
    2: 'Two Pair',
    3: 'Three of a Kind',
    4: 'Straight',
    5: 'Flush',
    6: 'Full House',
    7: 'Four of a Kind',
    8: 'Straight Flush',
}


def describe_hand(
    hole_cards: list[str],
    community_cards: list[str],
) -> str | None:
    """Return a human-readable description of the best 5-card hand.

    Parameters
    ----------
    hole_cards : list[str]
        Two hole card strings, e.g. ['AS', 'KH'].
    community_cards : list[str]
        3-5 community card strings, e.g. ['QS', 'JS', '10S', '7H', '3D'].

    Returns
    -------
    str or None — e.g. "Flush" or "Two Pair" or None if insufficient cards.
    """
    all_strs = [c for c in (hole_cards + community_cards) if c]
    parsed = [_parse_card(c) for c in all_strs]
    valid = [c for c in parsed if c is not None]

    if len(valid) < 5:
        return None

    cat, group_ranks = _best_hand(valid)
    base = CATEGORY_NAMES[cat]

    # Add detail for common hands
    if cat == 1 and group_ranks:  # Pair
        return f'Pair of {RANK_NAMES_PLURAL.get(group_ranks[0], "?")}'
    if cat == 2 and len(group_ranks) >= 2:  # Two Pair
        high = RANK_NAMES_PLURAL.get(group_ranks[0], '?')
        low = RANK_NAMES_PLURAL.get(group_ranks[1], '?')
        return f'Two Pair, {high} and {low}'
    if cat == 3 and group_ranks:  # Three of a Kind
        return f'Three of a Kind, {RANK_NAMES_PLURAL.get(group_ranks[0], "?")}'
    if cat == 6 and len(group_ranks) >= 2:  # Full House
        trips = RANK_NAMES_PLURAL.get(group_ranks[0], '?')
        pair = RANK_NAMES_PLURAL.get(group_ranks[1], '?')
        return f'Full House, {trips} full of {pair}'
    if cat == 7 and group_ranks:  # Four of a Kind
        return f'Four of a Kind, {RANK_NAMES_PLURAL.get(group_ranks[0], "?")}'
    if cat == 4 and group_ranks:  # Straight
        hi = RANK_NAMES.get(group_ranks[0], '?')
        return f'Straight, {hi} high'
    if cat == 8 and group_ranks:  # Straight Flush
        hi = RANK_NAMES.get(group_ranks[0], '?')
        if group_ranks[0] == 12:
            return 'Royal Flush'
        return f'Straight Flush, {hi} high'

    return base
