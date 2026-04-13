"""Betting state machine logic — legal actions, street completion, side pots."""

from __future__ import annotations


def get_legal_actions(
    phase: str,
    actions_this_street: list[dict],
    current_player_id: int,
    blind_amounts: tuple[float, float],
) -> dict:
    """Return legal actions and amount_to_call for the current player.

    Parameters
    ----------
    phase : str
        Current hand phase (preflop, flop, turn, river).
    actions_this_street : list[dict]
        Each dict has keys: player_id, action, amount.
    current_player_id : int
        The player whose legal actions we are computing.
    blind_amounts : tuple[float, float]
        (small_blind, big_blind).

    Returns
    -------
    dict with keys 'legal_actions' (list[str]) and 'amount_to_call' (float).
    """
    contributions: dict[int, float] = {}
    for a in actions_this_street:
        pid = a['player_id']
        amt = a.get('amount') or 0
        if a['action'] in ('blind', 'call', 'bet', 'raise'):
            contributions[pid] = contributions.get(pid, 0) + amt

    max_contribution = max(contributions.values()) if contributions else 0
    my_contribution = contributions.get(current_player_id, 0)
    amount_to_call = round(max_contribution - my_contribution, 2)

    if amount_to_call > 0:
        legal = ['fold', 'call', 'raise']
    else:
        # "bet" only when no money is on the table this street;
        # otherwise it's "raise" (e.g. BB option preflop, or after a bet was matched).
        has_wager = any(
            a['action'] in ('blind', 'bet', 'raise') for a in actions_this_street
        )
        legal = ['fold', 'check', 'raise'] if has_wager else ['fold', 'check', 'bet']

    return {
        'legal_actions': legal,
        'amount_to_call': amount_to_call,
    }


def compute_side_pots(
    player_contributions: dict[int, float],
    all_in_player_ids: set[int],
    non_folded_player_ids: set[int],
) -> list[dict]:
    """Compute side pots when there are all-in players.

    Returns list of side pot dicts: [{'amount': float, 'eligible_player_ids': list[int]}, ...]
    Only returns pots beyond the main pot (i.e. the actual side pots).
    """
    if not all_in_player_ids:
        return []

    active_contributions = {
        pid: amt
        for pid, amt in player_contributions.items()
        if pid in non_folded_player_ids
    }

    if not active_contributions:
        return []

    sorted_players = sorted(active_contributions.items(), key=lambda x: x[1])

    pots = []
    prev_level = 0.0
    remaining = [pid for pid, _ in sorted_players]

    for pid, contrib in sorted_players:
        if contrib > prev_level:
            pot_amount = round((contrib - prev_level) * len(remaining), 2)
            pots.append(
                {
                    'amount': pot_amount,
                    'eligible_player_ids': list(remaining),
                }
            )
            prev_level = contrib
        remaining.remove(pid)

    if len(pots) <= 1:
        return []

    return pots[1:]


def is_street_complete(
    actions_this_street: list[dict],
    active_non_folded_ids: set[int],
    all_in_ids: set[int],
    phase: str,
    bb_player_id: int | None,
) -> bool:
    """Check if the current street's action is complete.

    A street is complete when all non-folded, non-all-in players have:
    1. Had a voluntary action since the last bet/raise (or BB blind for preflop)
    2. Equal contributions this street
    """
    acting_players = active_non_folded_ids - all_in_ids
    if not acting_players:
        return True

    if not actions_this_street:
        return False

    # Find the last aggressor index
    last_aggressor_idx = -1
    for i, a in enumerate(actions_this_street):
        if a['action'] in ('bet', 'raise'):
            last_aggressor_idx = i

    # For preflop with no voluntary raise, use BB blind as reference
    if last_aggressor_idx == -1 and phase == 'preflop':
        for i, a in enumerate(actions_this_street):
            if a['action'] == 'blind' and a['player_id'] == bb_player_id:
                last_aggressor_idx = i

    if last_aggressor_idx == -1:
        # Post-flop, no bets — has everyone checked?
        checked_players = {
            a['player_id']
            for a in actions_this_street
            if a['action'] == 'check' and a['player_id'] in acting_players
        }
        return acting_players <= checked_players

    # Count voluntary actors since the last aggressor
    actors_since = set()
    for i, a in enumerate(actions_this_street):
        if (
            i > last_aggressor_idx
            and a['player_id'] in acting_players
            and a['action'] != 'blind'
        ):
            actors_since.add(a['player_id'])

    # Aggressor counts if their action was voluntary (not a blind)
    aggressor_action = actions_this_street[last_aggressor_idx]
    if (
        aggressor_action['action'] != 'blind'
        and aggressor_action['player_id'] in acting_players
    ):
        actors_since.add(aggressor_action['player_id'])

    if actors_since < acting_players:
        return False

    # Check contributions are equalized among acting players
    contributions: dict[int, float] = {}
    for a in actions_this_street:
        pid = a['player_id']
        amt = a.get('amount') or 0
        if a['action'] in ('blind', 'call', 'bet', 'raise'):
            contributions[pid] = contributions.get(pid, 0) + amt

    acting_contribs = {round(contributions.get(pid, 0), 2) for pid in acting_players}
    return len(acting_contribs) <= 1
