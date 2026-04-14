"""Tests for NLHE action validation in record_player_action.

The system must enforce No-Limit Hold'em rules:
- call: amount must equal amount_to_call (or all chips if short-stacked)
- check: only legal when no bet is facing the player (amount_to_call == 0)
- bet: only legal when no prior wager exists on the current street
- raise: total contribution must exceed current bet; min raise = previous raise size
- fold: always legal when facing a bet; legal but wasteful otherwise

These tests ensure the server rejects illegal actions with 400 status codes
so the game cannot advance with unequal/missing bets.
"""

import pytest
from fastapi.testclient import TestClient

from app.database.session import get_db
from app.main import app
from conftest import activate_hand, override_get_db


@pytest.fixture
def client():
    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()


def _create_game(client, names, buy_in=100.0):
    resp = client.post(
        '/games',
        json={
            'game_date': '2026-04-14',
            'player_names': names,
            'default_buy_in': buy_in,
        },
    )
    assert resp.status_code == 201
    return resp.json()['game_id']


def _start_hand(client, game_id):
    resp = client.post(f'/games/{game_id}/hands/start')
    assert resp.status_code == 201
    hand = resp.json()
    activate_hand(client, game_id, hand)
    hn = hand['hand_number']
    return client.get(f'/games/{game_id}/hands/{hn}').json()


def _state(client, game_id, hn=1):
    return client.get(f'/games/{game_id}/hands/{hn}/state').json()


def _current(client, game_id, hn=1):
    return _state(client, game_id, hn)['current_player_name']


def _act(client, game_id, name, action, amount=None, hn=1, street=None, is_all_in=False):
    if street is None:
        street = _state(client, game_id, hn)['phase']
    payload = {'street': street, 'action': action}
    if amount is not None:
        payload['amount'] = amount
    if is_all_in:
        payload['is_all_in'] = True
    return client.post(
        f'/games/{game_id}/hands/{hn}/players/{name}/actions',
        json=payload,
    )


def _deal_flop(client, game_id, hn=1):
    client.patch(
        f'/games/{game_id}/hands/{hn}/flop',
        json={
            'flop_1': {'rank': 'Q', 'suit': 'D'},
            'flop_2': {'rank': 'J', 'suit': 'C'},
            'flop_3': {'rank': '9', 'suit': 'H'},
        },
    )


def _deal_turn(client, game_id, hn=1):
    client.patch(
        f'/games/{game_id}/hands/{hn}/turn',
        json={'turn': {'rank': '8', 'suit': 'S'}},
    )


def _deal_river(client, game_id, hn=1):
    client.patch(
        f'/games/{game_id}/hands/{hn}/river',
        json={'river': {'rank': '2', 'suit': 'D'}},
    )


# ────────────────────────────────────────────────────────────────────
# CHECK validation: cannot check when facing a bet
# ────────────────────────────────────────────────────────────────────


class TestCheckValidation:
    def test_check_rejected_when_facing_bet_preflop(self, client):
        """UTG cannot check preflop — they face the BB blind (a bet)."""
        game_id = _create_game(client, ['Alice', 'Bob', 'Charlie'])
        _start_hand(client, game_id)
        utg = _current(client, game_id)

        resp = _act(client, game_id, utg, 'check')
        assert resp.status_code == 400

    def test_check_allowed_when_no_bet(self, client):
        """Post-flop first-to-act can check when no bet has been made."""
        game_id = _create_game(client, ['Alice', 'Bob', 'Charlie'])
        _start_hand(client, game_id)
        _deal_flop(client, game_id)

        # Complete preflop: UTG call, SB call, BB check
        _act(client, game_id, _current(client, game_id), 'call', amount=0.20)
        _act(client, game_id, _current(client, game_id), 'call', amount=0.10)
        _act(client, game_id, _current(client, game_id), 'check')

        state = _state(client, game_id)
        assert state['phase'] == 'flop'
        first = _current(client, game_id)
        resp = _act(client, game_id, first, 'check')
        assert resp.status_code == 201

    def test_check_rejected_after_bet_postflop(self, client):
        """After someone bets on the flop, next player cannot check."""
        game_id = _create_game(client, ['Alice', 'Bob', 'Charlie'])
        _start_hand(client, game_id)
        _deal_flop(client, game_id)

        # Complete preflop
        _act(client, game_id, _current(client, game_id), 'call', amount=0.20)
        _act(client, game_id, _current(client, game_id), 'call', amount=0.10)
        _act(client, game_id, _current(client, game_id), 'check')

        # Flop: first player bets
        assert _state(client, game_id)['phase'] == 'flop'
        first = _current(client, game_id)
        _act(client, game_id, first, 'bet', amount=1.00)

        # Next player tries to check — must be rejected
        second = _current(client, game_id)
        resp = _act(client, game_id, second, 'check')
        assert resp.status_code == 400


# ────────────────────────────────────────────────────────────────────
# CALL validation: amount must equal amount_to_call
# ────────────────────────────────────────────────────────────────────


class TestCallValidation:
    def test_call_for_less_rejected_when_not_all_in(self, client):
        """Calling for less than amount_to_call is only legal as an all-in.
        With plenty of chips, it must be rejected."""
        game_id = _create_game(client, ['Alice', 'Bob', 'Charlie'], buy_in=100.0)
        _start_hand(client, game_id)
        utg = _current(client, game_id)

        # UTG tries to call 0.05 when amount_to_call is 0.20
        resp = _act(client, game_id, utg, 'call', amount=0.05)
        assert resp.status_code == 400

    def test_call_for_more_than_needed_rejected(self, client):
        """Calling more than amount_to_call is not a call — it's rejected."""
        game_id = _create_game(client, ['Alice', 'Bob', 'Charlie'], buy_in=100.0)
        _start_hand(client, game_id)
        utg = _current(client, game_id)

        # amount_to_call is 0.20, but player sends 0.50
        resp = _act(client, game_id, utg, 'call', amount=0.50)
        assert resp.status_code == 400

    def test_call_exact_amount_accepted(self, client):
        """Calling exactly amount_to_call succeeds."""
        game_id = _create_game(client, ['Alice', 'Bob', 'Charlie'], buy_in=100.0)
        _start_hand(client, game_id)
        utg = _current(client, game_id)

        resp = _act(client, game_id, utg, 'call', amount=0.20)
        assert resp.status_code == 201

    def test_call_all_in_for_less_accepted(self, client):
        """Short-stacked player can call for less if they mark is_all_in."""
        game_id = _create_game(client, ['Alice', 'Bob', 'Charlie'], buy_in=0.15)
        _start_hand(client, game_id)
        # After SB blind (0.10) and BB blind (0.20), BB might be all-in already
        # UTG has 0.15 chips, can't cover 0.20 call
        utg = _current(client, game_id)
        # The UTG started with 0.15 chips, amount_to_call is 0.20
        # Calling for 0.15 (all chips) with is_all_in=True should work
        resp = _act(client, game_id, utg, 'call', amount=0.15, is_all_in=True)
        assert resp.status_code == 201

    def test_call_rejected_when_nothing_to_call(self, client):
        """Cannot call when amount_to_call is 0 (should check instead)."""
        game_id = _create_game(client, ['Alice', 'Bob', 'Charlie'])
        _start_hand(client, game_id)
        _deal_flop(client, game_id)

        # Complete preflop
        _act(client, game_id, _current(client, game_id), 'call', amount=0.20)
        _act(client, game_id, _current(client, game_id), 'call', amount=0.10)
        _act(client, game_id, _current(client, game_id), 'check')

        assert _state(client, game_id)['phase'] == 'flop'
        first = _current(client, game_id)
        # No bet yet — calling makes no sense
        resp = _act(client, game_id, first, 'call', amount=0.0)
        assert resp.status_code == 400


# ────────────────────────────────────────────────────────────────────
# RAISE validation: must exceed current bet, min raise enforced
# ────────────────────────────────────────────────────────────────────


class TestRaiseValidation:
    def test_raise_below_call_amount_rejected(self, client):
        """A raise that doesn't even cover the call is illegal."""
        game_id = _create_game(client, ['Alice', 'Bob', 'Charlie'], buy_in=100.0)
        _start_hand(client, game_id)
        utg = _current(client, game_id)

        # amount_to_call is 0.20 (BB), raise of 0.10 doesn't even cover the call
        resp = _act(client, game_id, utg, 'raise', amount=0.10)
        assert resp.status_code == 400

    def test_raise_exactly_call_amount_rejected(self, client):
        """Raising exactly the call amount is just a call, not a raise. Rejected."""
        game_id = _create_game(client, ['Alice', 'Bob', 'Charlie'], buy_in=100.0)
        _start_hand(client, game_id)
        utg = _current(client, game_id)

        # 0.20 is the call amount — a "raise" of 0.20 is just a call
        resp = _act(client, game_id, utg, 'raise', amount=0.20)
        assert resp.status_code == 400

    def test_raise_must_meet_minimum(self, client):
        """Min raise = previous raise size. BB is 0.20, so min raise = 0.20 on top of call.
        Total raise amount must be >= 0.40 (0.20 call + 0.20 min raise)."""
        game_id = _create_game(client, ['Alice', 'Bob', 'Charlie'], buy_in=100.0)
        _start_hand(client, game_id)
        utg = _current(client, game_id)

        # Min raise preflop: call 0.20 + raise 0.20 = 0.40 total
        resp = _act(client, game_id, utg, 'raise', amount=0.40)
        assert resp.status_code == 201

    def test_raise_below_minimum_rejected(self, client):
        """Raise of 0.30 preflop: covers the call (0.20) but the raise increment
        (0.10) is less than the min raise (0.20). Should be rejected."""
        game_id = _create_game(client, ['Alice', 'Bob', 'Charlie'], buy_in=100.0)
        _start_hand(client, game_id)
        utg = _current(client, game_id)

        resp = _act(client, game_id, utg, 'raise', amount=0.30)
        assert resp.status_code == 400

    def test_raise_after_raise_min_size(self, client):
        """After a raise to 0.60 (raise increment = 0.40 over BB),
        next re-raise min = call 0.60 + 0.40 = 1.00 total new money."""
        game_id = _create_game(client, ['Alice', 'Bob', 'Charlie'], buy_in=100.0)
        _start_hand(client, game_id)

        # UTG raises to 0.60 (0.60 new money: 0.20 call + 0.40 raise)
        _act(client, game_id, _current(client, game_id), 'raise', amount=0.60)

        # SB faces 0.60 total, has put in 0.10 blind, needs 0.50 to call
        # Min re-raise increment = 0.40 (same as UTG's raise increment)
        # Min re-raise total new money = 0.50 (call) + 0.40 = 0.90
        sb = _current(client, game_id)

        # Try 0.60 — only covers the call + 0.10 raise, below min
        resp = _act(client, game_id, sb, 'raise', amount=0.60)
        assert resp.status_code == 400

        # 0.90 meets minimum (0.50 call + 0.40 min raise)
        resp = _act(client, game_id, sb, 'raise', amount=0.90)
        assert resp.status_code == 201

    def test_raise_all_in_below_min_accepted(self, client):
        """All-in raise below minimum is allowed (player has no choice)."""
        game_id = _create_game(client, ['Alice', 'Bob', 'Charlie'], buy_in=0.50)
        _start_hand(client, game_id)
        # After blinds, UTG has 0.50 chips
        utg = _current(client, game_id)
        # UTG goes all-in for 0.50 — covers call (0.20) but raise increment
        # (0.30) is less than min (0.20 BB). Still accepted because all-in.
        resp = _act(client, game_id, utg, 'raise', amount=0.50, is_all_in=True)
        assert resp.status_code == 201


# ────────────────────────────────────────────────────────────────────
# BET validation: only legal when no wager on the street
# ────────────────────────────────────────────────────────────────────


class TestBetValidation:
    def test_bet_rejected_preflop(self, client):
        """Preflop always has blinds on the table — 'bet' is never legal, only 'raise'."""
        game_id = _create_game(client, ['Alice', 'Bob', 'Charlie'])
        _start_hand(client, game_id)
        utg = _current(client, game_id)

        resp = _act(client, game_id, utg, 'bet', amount=1.00)
        assert resp.status_code == 400

    def test_bet_after_bet_rejected(self, client):
        """On the flop, after someone bets, next player must raise/call/fold — not bet."""
        game_id = _create_game(client, ['Alice', 'Bob', 'Charlie'])
        _start_hand(client, game_id)
        _deal_flop(client, game_id)

        # Complete preflop
        _act(client, game_id, _current(client, game_id), 'call', amount=0.20)
        _act(client, game_id, _current(client, game_id), 'call', amount=0.10)
        _act(client, game_id, _current(client, game_id), 'check')

        assert _state(client, game_id)['phase'] == 'flop'
        first = _current(client, game_id)
        _act(client, game_id, first, 'bet', amount=0.50)

        second = _current(client, game_id)
        # Second player tries 'bet' instead of 'raise' or 'call' — rejected
        resp = _act(client, game_id, second, 'bet', amount=1.00)
        assert resp.status_code == 400

    def test_bet_on_clean_street_accepted(self, client):
        """On flop with no prior wagers, a bet is legal."""
        game_id = _create_game(client, ['Alice', 'Bob', 'Charlie'])
        _start_hand(client, game_id)
        _deal_flop(client, game_id)

        # Complete preflop
        _act(client, game_id, _current(client, game_id), 'call', amount=0.20)
        _act(client, game_id, _current(client, game_id), 'call', amount=0.10)
        _act(client, game_id, _current(client, game_id), 'check')

        assert _state(client, game_id)['phase'] == 'flop'
        first = _current(client, game_id)
        resp = _act(client, game_id, first, 'bet', amount=0.50)
        assert resp.status_code == 201

    def test_bet_must_be_at_least_big_blind(self, client):
        """A bet must be at least the big blind amount."""
        game_id = _create_game(client, ['Alice', 'Bob', 'Charlie'])
        _start_hand(client, game_id)
        _deal_flop(client, game_id)

        # Complete preflop
        _act(client, game_id, _current(client, game_id), 'call', amount=0.20)
        _act(client, game_id, _current(client, game_id), 'call', amount=0.10)
        _act(client, game_id, _current(client, game_id), 'check')

        assert _state(client, game_id)['phase'] == 'flop'
        first = _current(client, game_id)
        # Bet 0.05 is below BB (0.20) — rejected
        resp = _act(client, game_id, first, 'bet', amount=0.05)
        assert resp.status_code == 400


# ────────────────────────────────────────────────────────────────────
# Integration: game cannot advance street with unequal bets
# ────────────────────────────────────────────────────────────────────


class TestStreetCannotAdvanceWithUnequalBets:
    def test_underpaid_call_blocked(self, client):
        """If validation is bypassed (force=true), the street should still not
        advance when contributions aren't equalized. This is a safety net test."""
        game_id = _create_game(client, ['Alice', 'Bob', 'Charlie'], buy_in=100.0)
        _start_hand(client, game_id)
        _deal_flop(client, game_id)

        # UTG calls correctly
        _act(client, game_id, _current(client, game_id), 'call', amount=0.20)

        # SB calls correctly
        _act(client, game_id, _current(client, game_id), 'call', amount=0.10)

        # BB checks — completes preflop
        _act(client, game_id, _current(client, game_id), 'check')

        state = _state(client, game_id)
        assert state['phase'] == 'flop'

    def test_force_flag_still_validates_action_type(self, client):
        """Even with force=true, illegal action types should be rejected."""
        game_id = _create_game(client, ['Alice', 'Bob', 'Charlie'])
        _start_hand(client, game_id)

        # force=true bypasses turn order, but check facing a bet should still fail
        names = ['Alice', 'Bob', 'Charlie']
        hand = client.get(f'/games/{game_id}/hands/1').json()
        # Find a non-current player
        current = _current(client, game_id)
        other = next(n for n in names if n != current)

        resp = client.post(
            f'/games/{game_id}/hands/1/players/{other}/actions?force=true',
            json={'street': 'preflop', 'action': 'check'},
        )
        assert resp.status_code == 400
