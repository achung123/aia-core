"""Hand ranking description — maps hole cards + community cards to a human-readable name."""

from __future__ import annotations

from app.services.evaluator import RANK_VAL, SUIT_VAL, find_best_five_card_hand

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
    rank_value = RANK_VAL.get(rank_str.upper() if len(rank_str) == 1 else rank_str)
    suit_value = SUIT_VAL.get(suit_char)
    if rank_value is None or suit_value is None:
        return None
    return (rank_value, suit_value)


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

    category, group_ranks = find_best_five_card_hand(valid)
    base = CATEGORY_NAMES[category]

    # Add detail for common hands
    if category == 1 and group_ranks:  # Pair
        return f'Pair of {RANK_NAMES_PLURAL.get(group_ranks[0], "?")}'
    if category == 2 and len(group_ranks) >= 2:  # Two Pair
        high = RANK_NAMES_PLURAL.get(group_ranks[0], '?')
        low = RANK_NAMES_PLURAL.get(group_ranks[1], '?')
        return f'Two Pair, {high} and {low}'
    if category == 3 and group_ranks:  # Three of a Kind
        return f'Three of a Kind, {RANK_NAMES_PLURAL.get(group_ranks[0], "?")}'
    if category == 6 and len(group_ranks) >= 2:  # Full House
        trips = RANK_NAMES_PLURAL.get(group_ranks[0], '?')
        pair = RANK_NAMES_PLURAL.get(group_ranks[1], '?')
        return f'Full House, {trips} full of {pair}'
    if category == 7 and group_ranks:  # Four of a Kind
        return f'Four of a Kind, {RANK_NAMES_PLURAL.get(group_ranks[0], "?")}'
    if category == 4 and group_ranks:  # Straight
        high_rank_name = RANK_NAMES.get(group_ranks[0], '?')
        return f'Straight, {high_rank_name} high'
    if category == 8 and group_ranks:  # Straight Flush
        high_rank_name = RANK_NAMES.get(group_ranks[0], '?')
        if group_ranks[0] == 12:
            return 'Royal Flush'
        return f'Straight Flush, {high_rank_name} high'

    return base
