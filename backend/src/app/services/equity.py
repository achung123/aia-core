"""Texas Hold'em equity calculator — ported from frontend/src/poker/evaluator.js."""

from __future__ import annotations

import random
from itertools import combinations

from app.services.evaluator import RANK_VAL, SUIT_VAL, find_best_five_card_score

# ---------------------------------------------------------------------------
# Card helpers
# ---------------------------------------------------------------------------


def _to_internal(card: tuple[str, str]) -> tuple[int, int]:
    """Convert (rank, suit) to internal (rank_index, suit_index) ints."""
    return (RANK_VAL[card[0]], SUIT_VAL[card[1]])


def _build_deck(known: list[tuple[int, int]]) -> list[tuple[int, int]]:
    used = {rank_index * 4 + suit_index for rank_index, suit_index in known}
    return [
        (rank_index, suit_index)
        for rank_index in range(13)
        for suit_index in range(4)
        if rank_index * 4 + suit_index not in used
    ]


# ---------------------------------------------------------------------------
# Board evaluation
# ---------------------------------------------------------------------------


def _evaluate_board(
    players: list[list[tuple[int, int]]],
    board: list[tuple[int, int]],
) -> list[float]:
    scores = [
        find_best_five_card_score(player_cards + board) for player_cards in players
    ]
    max_score = max(scores)
    winner_count = scores.count(max_score)
    return [
        1.0 / winner_count if score_value == max_score else 0.0
        for score_value in scores
    ]


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

    players = [
        [_to_internal(card) for card in hole_cards] for hole_cards in player_hole_cards
    ]
    board = [_to_internal(card) for card in community_cards]

    all_known = list(board)
    for player_cards in players:
        all_known.extend(player_cards)
    deck = _build_deck(all_known)

    remaining = 5 - len(board)
    num_players = len(players)
    wins = [0.0] * num_players

    if remaining == 0:
        return _evaluate_board(players, board)

    if remaining <= 2:
        # Exhaustive enumeration
        trial_count = 0
        for combo in combinations(deck, remaining):
            full_board = board + list(combo)
            result = _evaluate_board(players, full_board)
            for player_index in range(num_players):
                wins[player_index] += result[player_index]
            trial_count += 1
        return [win_total / trial_count for win_total in wins]

    # Monte Carlo for 3+ remaining cards
    iterations = 5000
    for _ in range(iterations):
        random.shuffle(deck)
        full_board = board + deck[:remaining]
        result = _evaluate_board(players, full_board)
        for player_index in range(num_players):
            wins[player_index] += result[player_index]
    return [win_total / iterations for win_total in wins]


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

    player = [_to_internal(card) for card in hole_cards]
    board = [_to_internal(card) for card in community_cards]

    all_known = list(board) + player
    deck = _build_deck(all_known)

    remaining = 5 - len(board)
    iterations = 5000
    wins = 0.0

    for _ in range(iterations):
        random.shuffle(deck)
        deal_index = 0
        # Deal random hole cards to opponents
        opponents = []
        for _ in range(num_opponents):
            opponents.append([deck[deal_index], deck[deal_index + 1]])
            deal_index += 2
        # Deal remaining community cards
        full_board = (
            board + deck[deal_index : deal_index + remaining]
            if remaining > 0
            else board
        )
        all_players = [player] + opponents
        result = _evaluate_board(all_players, full_board)
        wins += result[0]

    return wins / iterations
