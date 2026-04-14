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
    dict with keys 'legal_actions' (list[str]), 'amount_to_call' (float),
    'minimum_bet' (float | None), and 'minimum_raise' (float | None).
    """
    big_blind = blind_amounts[1]
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

    minimum_bet = round(big_blind, 2) if 'bet' in legal else None
    minimum_raise = (
        round(amount_to_call + _last_raise_increment(actions_this_street, big_blind), 2)
        if 'raise' in legal
        else None
    )

    return {
        'legal_actions': legal,
        'amount_to_call': amount_to_call,
        'minimum_bet': minimum_bet,
        'minimum_raise': minimum_raise,
    }


def _last_raise_increment(actions_this_street: list[dict], big_blind: float) -> float:
    """Return the current minimum raise increment for the street."""
    last_raise_increment = big_blind
    for a in actions_this_street:
        amt = a.get('amount') or 0
        if a['action'] in ('bet', 'raise'):
            prev_contribs: dict[int, float] = {}
            for prev in actions_this_street:
                if prev is a:
                    break
                ppid = prev['player_id']
                if prev['action'] in ('blind', 'call', 'bet', 'raise'):
                    prev_contribs[ppid] = prev_contribs.get(ppid, 0) + (
                        prev.get('amount') or 0
                    )
            max_before = max(prev_contribs.values()) if prev_contribs else 0.0
            raiser_before = prev_contribs.get(a['player_id'], 0.0)
            call_needed = max_before - raiser_before
            increment = amt - call_needed
            if increment > 0:
                last_raise_increment = increment
    return round(last_raise_increment, 2)


def validate_action(
    action: str,
    amount: float | None,
    legal_actions: list[str],
    amount_to_call: float,
    actions_this_street: list[dict],
    big_blind: float,
    is_all_in: bool = False,
) -> str | None:
    """Validate a player action against NLHE rules.

    Returns None if the action is legal, or an error message string if illegal.
    """
    if action not in legal_actions:
        return (
            f"Action '{action}' is not legal here. "
            f'Legal actions: {", ".join(legal_actions)}'
        )

    if action == 'check':
        # Check is only legal when amount_to_call == 0 (enforced by legal_actions)
        # but double-check as a safety net
        if amount_to_call > 0:
            return 'Cannot check when facing a bet — must call, raise, or fold'
        return None

    if action == 'fold':
        return None

    if action == 'call':
        if amount_to_call <= 0:
            return 'Nothing to call — use check instead'
        if amount is None:
            return 'Call requires an amount'
        # Call must match amount_to_call exactly (or less if all-in)
        if is_all_in:
            if amount > round(amount_to_call, 2):
                return (
                    f'Call amount {amount} exceeds amount to call {amount_to_call:.2f}'
                )
        else:
            if round(amount, 2) != round(amount_to_call, 2):
                return (
                    f'Call amount must be exactly {amount_to_call:.2f}, '
                    f'got {amount:.2f}'
                )
        return None

    if action == 'bet':
        if amount is None or amount <= 0:
            return 'Bet requires a positive amount'
        # Min bet = big blind (unless all-in for less)
        if not is_all_in and amount < big_blind:
            return f'Minimum bet is {big_blind:.2f} (the big blind)'
        return None

    if action == 'raise':
        if amount is None or amount <= 0:
            return 'Raise requires a positive amount'
        # Raise amount is the new money the player puts in this action.
        # It must at least cover the call AND add a raise increment.
        if round(amount, 2) <= round(amount_to_call, 2):
            return (
                f'Raise amount ({amount:.2f}) must exceed the call amount '
                f'({amount_to_call:.2f})'
            )
        min_raise_total = round(
            amount_to_call + _last_raise_increment(actions_this_street, big_blind), 2
        )
        if not is_all_in and round(amount, 2) < min_raise_total:
            return (
                f'Minimum raise is {min_raise_total:.2f} '
                f'({amount_to_call:.2f} to call + '
                f'{_last_raise_increment(actions_this_street, big_blind):.2f} min raise). '
                f'Got {amount:.2f}'
            )
        return None

    return None


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
