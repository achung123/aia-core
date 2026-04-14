"""Texas Hold'em equity calculator — ported from frontend/src/poker/evaluator.js."""

from __future__ import annotations

import random
from itertools import combinations

from app.services.evaluator import RANK_VAL, SUIT_VAL, best_score as _best_score

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


def calculate_player_equity(
    hole_cards: list[tuple[str, str]],
    num_opponents: int,
    community_cards: list[tuple[str, str]],
) -> float:
    """Calculate equity for a single player vs random opponent hands.

    Args:
        hole_cards: Player's 2 hole cards as (rank, suit) tuples.
        num_opponents: Number of opponents with random hands.
        community_cards: 0-5 known community cards as (rank, suit) tuples.

    Returns:
        Float representing the player's equity (0.0–1.0).
    """
    if num_opponents == 0:
        return 1.0

    player = [_to_internal(c) for c in hole_cards]
    board = [_to_internal(c) for c in community_cards]

    all_known = list(board) + player
    deck = _build_deck(all_known)

    remaining = 5 - len(board)
    iters = 5000
    wins = 0.0

    for _ in range(iters):
        random.shuffle(deck)
        idx = 0
        # Deal random hole cards to opponents
        opponents = []
        for _ in range(num_opponents):
            opponents.append([deck[idx], deck[idx + 1]])
            idx += 2
        # Deal remaining community cards
        b = board + deck[idx : idx + remaining] if remaining > 0 else board
        all_players = [player] + opponents
        result = _eval_board(all_players, b)
        wins += result[0]

    return wins / iters
