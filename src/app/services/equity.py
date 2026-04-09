"""Texas Hold'em equity calculator — ported from frontend/src/poker/evaluator.js."""

from __future__ import annotations

import random
from itertools import combinations

RANK_VAL = {
    '2': 0, '3': 1, '4': 2, '5': 3, '6': 4, '7': 5, '8': 6,
    '9': 7, '10': 8, 'T': 8, 'J': 9, 'Q': 10, 'K': 11, 'A': 12,
}
SUIT_VAL = {'h': 0, 'd': 1, 'c': 2, 's': 3}

B = 14  # base > 13 to avoid collisions
B5 = B ** 5

# ---------------------------------------------------------------------------
# Card helpers
# ---------------------------------------------------------------------------

def _to_internal(card: tuple[str, str]) -> tuple[int, int]:
    """Convert (rank, suit) to internal (r, s) ints."""
    return (RANK_VAL[card[0]], SUIT_VAL[card[1]])


def _build_deck(known: list[tuple[int, int]]) -> list[tuple[int, int]]:
    used = {r * 4 + s for r, s in known}
    return [(r, s) for r in range(13) for s in range(4) if r * 4 + s not in used]


# ---------------------------------------------------------------------------
# 5-card hand evaluator
# ---------------------------------------------------------------------------

def _score_component(cat: int, kickers: list[int]) -> int:
    s = cat
    for i in range(5):
        s = s * B + (kickers[i] if i < len(kickers) else 0)
    return s


def _eval5(c0: tuple[int, int], c1: tuple[int, int], c2: tuple[int, int],
           c3: tuple[int, int], c4: tuple[int, int]) -> int:
    """Evaluate exactly 5 cards → numeric score (higher is better)."""
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

    if flush and is_straight:
        return _score_component(8, [str_hi])
    if groups[0][1] == 4:
        return _score_component(7, [groups[0][0], groups[1][0]])
    if groups[0][1] == 3 and groups[1][1] == 2:
        return _score_component(6, [groups[0][0], groups[1][0]])
    if flush:
        return _score_component(5, ranks)
    if is_straight:
        return _score_component(4, [str_hi])
    if groups[0][1] == 3:
        return _score_component(3, [groups[0][0], groups[1][0], groups[2][0]])
    if groups[0][1] == 2 and groups[1][1] == 2:
        return _score_component(2, [groups[0][0], groups[1][0], groups[2][0]])
    if groups[0][1] == 2:
        return _score_component(1, [groups[0][0], groups[1][0], groups[2][0], groups[3][0]])
    return _score_component(0, ranks)


# ---------------------------------------------------------------------------
# Best-of-7 evaluator
# ---------------------------------------------------------------------------

def _best_score(cards: list[tuple[int, int]]) -> int:
    best = -1
    for combo in combinations(cards, 5):
        s = _eval5(*combo)
        if s > best:
            best = s
    return best


# ---------------------------------------------------------------------------
# Board evaluation
# ---------------------------------------------------------------------------

def _eval_board(
    players: list[list[tuple[int, int]]],
    board: list[tuple[int, int]],
) -> list[float]:
    scores = [_best_score(p + board) for p in players]
    mx = max(scores)
    winner_count = scores.count(mx)
    return [1.0 / winner_count if s == mx else 0.0 for s in scores]


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def calculate_equity(
    player_hole_cards: list[list[tuple[str, str]]],
    community_cards: list[tuple[str, str]],
) -> list[float]:
    """Calculate win equity for each player.

    Args:
        player_hole_cards: Per-player list of 2 hole cards as (rank, suit) tuples.
        community_cards: 0-5 known community cards as (rank, suit) tuples.

    Returns:
        List of floats (one per player) representing equity (0.0–1.0), summing to 1.0.
    """
    num_players = len(player_hole_cards)
    if num_players == 0:
        return []
    if num_players == 1:
        return [1.0]

    players = [[_to_internal(c) for c in hc] for hc in player_hole_cards]
    board = [_to_internal(c) for c in community_cards]

    all_known = list(board)
    for p in players:
        all_known.extend(p)
    deck = _build_deck(all_known)

    remaining = 5 - len(board)
    num_players = len(players)
    wins = [0.0] * num_players

    if remaining == 0:
        return _eval_board(players, board)

    if remaining <= 2:
        # Exhaustive enumeration
        n = 0
        for combo in combinations(deck, remaining):
            b = board + list(combo)
            result = _eval_board(players, b)
            for j in range(num_players):
                wins[j] += result[j]
            n += 1
        return [w / n for w in wins]

    # Monte Carlo for 3+ remaining cards
    iters = 5000
    for _ in range(iters):
        random.shuffle(deck)
        b = board + deck[:remaining]
        result = _eval_board(players, b)
        for j in range(num_players):
            wins[j] += result[j]
    return [w / iters for w in wins]
