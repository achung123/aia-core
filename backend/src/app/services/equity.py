"""Texas Hold'em equity calculator.

Design:
  * Exact whenever it is affordable — every remaining board is enumerated
    from the flop onward, so those numbers are true probabilities.
  * Preflop (five cards to come) is simulated, but with a seed derived from
    the cards themselves: the same hand always produces the same number, so
    screens that poll do not flicker and two screens never disagree.
  * Results are cached, so repeated requests for an unchanged hand are free.
  * Known dead cards (a folded player's hole cards) are removed from the
    deck.
"""

from __future__ import annotations

import hashlib
import random
from dataclasses import dataclass
from functools import lru_cache
from itertools import combinations

from app.services.evaluator import (
    RANK_VAL,
    SUIT_VAL,
    best_hand,
    compute_hand_score,
)

Card = tuple[int, int]

# Enumerate every runout when that costs no more than this many hand
# evaluations; otherwise simulate. The flop (≤ 1,081 boards) and turn
# (≤ 46 boards) always fall under it.
EXACT_EVALUATION_BUDGET = 60_000
# Evaluations spent on a simulation. Iterations shrink as players are added
# so a nine-handed preflop request costs the same as a heads-up one.
SIMULATION_EVALUATION_BUDGET = 60_000
MIN_SIMULATION_ITERATIONS = 4_000

METHOD_EXACT = 'exact'
METHOD_SIMULATED = 'monte_carlo'


@dataclass(frozen=True)
class EquityResult:
    """Per-player results, in the order the players were given.

    equities: share of the pot each player expects (ties split).
    wins:     probability of winning the pot outright.
    ties:     probability of splitting it.
    method:   'exact' or 'monte_carlo'.
    samples:  boards evaluated.
    """

    equities: tuple[float, ...]
    wins: tuple[float, ...]
    ties: tuple[float, ...]
    method: str
    samples: int


# ---------------------------------------------------------------------------
# Card helpers
# ---------------------------------------------------------------------------


def _to_internal(card: tuple[str, str]) -> Card:
    """Convert (rank, suit) to internal (rank_index, suit_index) ints."""
    return (RANK_VAL[card[0]], SUIT_VAL[card[1]])


def _build_deck(known: list[Card]) -> list[Card]:
    used = {rank_index * 4 + suit_index for rank_index, suit_index in known}
    return [
        (rank_index, suit_index)
        for rank_index in range(13)
        for suit_index in range(4)
        if rank_index * 4 + suit_index not in used
    ]


def _score(cards: list[Card]) -> int:
    return compute_hand_score(*best_hand(cards))


def _seed_for(*parts: object) -> int:
    """A stable seed for a given situation, so simulations are repeatable."""
    digest = hashlib.sha256(repr(parts).encode()).digest()
    return int.from_bytes(digest[:8], 'big')


# ---------------------------------------------------------------------------
# Core
# ---------------------------------------------------------------------------


class _Tally:
    def __init__(self, player_count: int) -> None:
        self.shares = [0.0] * player_count
        self.wins = [0] * player_count
        self.ties = [0] * player_count
        self.samples = 0

    def add(self, players: tuple[tuple[Card, ...], ...], board: list[Card]) -> None:
        scores = [_score([*hole, *board]) for hole in players]
        best = max(scores)
        winners = [index for index, score in enumerate(scores) if score == best]
        if len(winners) == 1:
            self.wins[winners[0]] += 1
            self.shares[winners[0]] += 1.0
        else:
            share = 1.0 / len(winners)
            for index in winners:
                self.ties[index] += 1
                self.shares[index] += share
        self.samples += 1

    def result(self, method: str) -> EquityResult:
        samples = max(self.samples, 1)
        return EquityResult(
            equities=tuple(share / samples for share in self.shares),
            wins=tuple(count / samples for count in self.wins),
            ties=tuple(count / samples for count in self.ties),
            method=method,
            samples=self.samples,
        )


def _runout_count(deck_size: int, remaining: int) -> int:
    count = 1
    for index in range(remaining):
        count = count * (deck_size - index) // (index + 1)
    return count


@lru_cache(maxsize=512)
def _analyze(
    players: tuple[tuple[Card, ...], ...],
    board: tuple[Card, ...],
    dead: tuple[Card, ...],
) -> EquityResult:
    known = [*board, *dead]
    for hole in players:
        known.extend(hole)
    deck = _build_deck(known)
    remaining = 5 - len(board)
    tally = _Tally(len(players))
    board_list = list(board)

    if remaining <= 0:
        tally.add(players, board_list)
        return tally.result(METHOD_EXACT)

    if _runout_count(len(deck), remaining) * len(players) <= EXACT_EVALUATION_BUDGET:
        for runout in combinations(deck, remaining):
            tally.add(players, [*board_list, *runout])
        return tally.result(METHOD_EXACT)

    iterations = max(
        MIN_SIMULATION_ITERATIONS, SIMULATION_EVALUATION_BUDGET // len(players)
    )
    rng = random.Random(_seed_for(players, board, dead))
    for _ in range(iterations):
        tally.add(players, [*board_list, *rng.sample(deck, remaining)])
    return tally.result(METHOD_SIMULATED)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def analyze_equity(
    player_hole_cards: list[list[tuple[str, str]]],
    community_cards: list[tuple[str, str]],
    dead_cards: list[tuple[str, str]] | None = None,
) -> EquityResult:
    """Equity, outright-win and tie probabilities for each player.

    Args:
        player_hole_cards: Per-player list of 2 hole cards as (rank, suit).
        community_cards: 0-5 known community cards.
        dead_cards: Cards known to be out of play (folded hands).
    """
    if not player_hole_cards:
        return EquityResult((), (), (), METHOD_EXACT, 0)
    if len(player_hole_cards) == 1:
        return EquityResult((1.0,), (1.0,), (0.0,), METHOD_EXACT, 0)

    players = tuple(
        tuple(_to_internal(card) for card in hole_cards)
        for hole_cards in player_hole_cards
    )
    board = tuple(_to_internal(card) for card in community_cards)
    # Order does not matter for dead cards; sort so the cache key is stable.
    dead = tuple(sorted(_to_internal(card) for card in (dead_cards or [])))
    return _analyze(players, board, dead)


def calculate_equity(
    player_hole_cards: list[list[tuple[str, str]]],
    community_cards: list[tuple[str, str]],
    dead_cards: list[tuple[str, str]] | None = None,
) -> list[float]:
    """Win equity for each player (0.0–1.0), summing to 1.0."""
    return list(analyze_equity(player_hole_cards, community_cards, dead_cards).equities)


@lru_cache(maxsize=512)
def _analyze_vs_random(
    player: tuple[Card, ...],
    num_opponents: int,
    board: tuple[Card, ...],
) -> float:
    deck = _build_deck([*board, *player])
    remaining = 5 - len(board)
    needed = num_opponents * 2 + remaining
    iterations = max(
        MIN_SIMULATION_ITERATIONS,
        SIMULATION_EVALUATION_BUDGET // (num_opponents + 1),
    )
    rng = random.Random(_seed_for('vs-random', player, num_opponents, board))
    board_list = list(board)
    total = 0.0
    for _ in range(iterations):
        drawn = rng.sample(deck, needed)
        full_board = [*board_list, *drawn[num_opponents * 2 :]]
        mine = _score([*player, *full_board])
        opponent_scores = [
            _score([drawn[2 * index], drawn[2 * index + 1], *full_board])
            for index in range(num_opponents)
        ]
        best_opponent = max(opponent_scores)
        if mine > best_opponent:
            total += 1.0
        elif mine == best_opponent:
            total += 1.0 / (1 + opponent_scores.count(mine))
    return total / iterations


def calculate_player_equity(
    hole_cards: list[tuple[str, str]],
    num_opponents: int,
    community_cards: list[tuple[str, str]],
) -> float:
    """Equity for one player against opponents holding unknown hands.

    Always simulated (the opponents' cards are random), with a seed derived
    from the situation so the answer does not change between requests.
    """
    if num_opponents <= 0:
        return 1.0
    player = tuple(_to_internal(card) for card in hole_cards)
    board = tuple(_to_internal(card) for card in community_cards)
    return _analyze_vs_random(player, num_opponents, board)


def clear_equity_cache() -> None:
    """Drop cached results. Tests only."""
    _analyze.cache_clear()
    _analyze_vs_random.cache_clear()
