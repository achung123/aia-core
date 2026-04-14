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
    for action_record in actions_this_street:
        player_id = action_record['player_id']
        action_amount = action_record.get('amount') or 0
        if action_record['action'] in ('blind', 'call', 'bet', 'raise'):
            contributions[player_id] = contributions.get(player_id, 0) + action_amount

    max_contribution = max(contributions.values()) if contributions else 0
    my_contribution = contributions.get(current_player_id, 0)
    amount_to_call = round(max_contribution - my_contribution, 2)

    if amount_to_call > 0:
        legal = ['fold', 'call', 'raise']
    else:
        # "bet" only when no money is on the table this street;
        # otherwise it's "raise" (e.g. BB option preflop, or after a bet was matched).
        has_wager = any(
            action_record['action'] in ('blind', 'bet', 'raise')
            for action_record in actions_this_street
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
    for action_record in actions_this_street:
        action_amount = action_record.get('amount') or 0
        if action_record['action'] in ('bet', 'raise'):
            previous_contributions: dict[int, float] = {}
            for previous_action in actions_this_street:
                if previous_action is action_record:
                    break
                previous_player_id = previous_action['player_id']
                if previous_action['action'] in ('blind', 'call', 'bet', 'raise'):
                    previous_contributions[previous_player_id] = (
                        previous_contributions.get(previous_player_id, 0)
                        + (previous_action.get('amount') or 0)
                    )
            max_before = (
                max(previous_contributions.values()) if previous_contributions else 0.0
            )
            raiser_before = previous_contributions.get(
                action_record['player_id'], 0.0
            )
            call_needed = max_before - raiser_before
            increment = action_amount - call_needed
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
        player_id: contribution_amount
        for player_id, contribution_amount in player_contributions.items()
        if player_id in non_folded_player_ids
    }

    if not active_contributions:
        return []

    sorted_players = sorted(active_contributions.items(), key=lambda x: x[1])

    pots = []
    prev_level = 0.0
    remaining = [player_id for player_id, _ in sorted_players]

    for player_id, contribution_amount in sorted_players:
        if contribution_amount > prev_level:
            pot_amount = round((contribution_amount - prev_level) * len(remaining), 2)
            pots.append(
                {
                    'amount': pot_amount,
                    'eligible_player_ids': list(remaining),
                }
            )
            prev_level = contribution_amount
        remaining.remove(player_id)

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
    for action_index, action_record in enumerate(actions_this_street):
        if action_record['action'] in ('bet', 'raise'):
            last_aggressor_idx = action_index

    # For preflop with no voluntary raise, use BB blind as reference
    if last_aggressor_idx == -1 and phase == 'preflop':
        for action_index, action_record in enumerate(actions_this_street):
            if (
                action_record['action'] == 'blind'
                and action_record['player_id'] == bb_player_id
            ):
                last_aggressor_idx = action_index

    if last_aggressor_idx == -1:
        # Post-flop, no bets — has everyone checked?
        checked_players = {
            action_record['player_id']
            for action_record in actions_this_street
            if action_record['action'] == 'check'
            and action_record['player_id'] in acting_players
        }
        return acting_players <= checked_players

    # Count voluntary actors since the last aggressor
    actors_since = set()
    for action_index, action_record in enumerate(actions_this_street):
        if (
            action_index > last_aggressor_idx
            and action_record['player_id'] in acting_players
            and action_record['action'] != 'blind'
        ):
            actors_since.add(action_record['player_id'])

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
    for action_record in actions_this_street:
        player_id = action_record['player_id']
        action_amount = action_record.get('amount') or 0
        if action_record['action'] in ('blind', 'call', 'bet', 'raise'):
            contributions[player_id] = contributions.get(player_id, 0) + action_amount

    acting_contribs = {
        round(contributions.get(player_id, 0), 2) for player_id in acting_players
    }
    return len(acting_contribs) <= 1
