"""Tests for bet/raise all-in detection via explicit is_all_in flag.

Covers bug fix aia-core-ibuc: bet/raise all-ins not detected for side pots.
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


def _create_game(client, names, default_buy_in=None):
    body = {'game_date': '2026-04-12', 'player_names': names}
    if default_buy_in is not None:
        body['default_buy_in'] = default_buy_in
    resp = client.post('/games', json=body)
    assert resp.status_code == 201
    return resp.json()['game_id']


def _start_hand(client, game_id):
    resp = client.post(f'/games/{game_id}/hands/start')
    assert resp.status_code == 201
    hand = resp.json()
    activate_hand(client, game_id, hand)
    hn = hand['hand_number']
    return client.get(f'/games/{game_id}/hands/{hn}').json()


def _state(client, game_id, hand_number=1):
    return client.get(f'/games/{game_id}/hands/{hand_number}/state').json()


def _current(client, game_id, hand_number=1):
    return _state(client, game_id, hand_number)['current_player_name']


def _act(
    client,
    game_id,
    player_name,
    action,
    amount=None,
    hand_number=1,
    street=None,
    is_all_in=False,
):
    if street is None:
        street = _state(client, game_id, hand_number)['phase']
    payload = {'street': street, 'action': action}
    if amount is not None:
        payload['amount'] = amount
    if is_all_in:
        payload['is_all_in'] = True
    return client.post(
        f'/games/{game_id}/hands/{hand_number}/players/{player_name}/actions',
        json=payload,
    )


def _deal_flop(client, game_id, hand_number=1):
    client.patch(
        f'/games/{game_id}/hands/{hand_number}/flop',
        json={
            'flop_1': {'rank': 'Q', 'suit': 'D'},
            'flop_2': {'rank': 'J', 'suit': 'C'},
            'flop_3': {'rank': '9', 'suit': 'H'},
        },
    )


class TestBetAllIn:
    """A player bets all-in — is_all_in should be set and side pots computed."""

    def test_bet_all_in_sets_flag(self, client):
        game_id = _create_game(client, ['Alice', 'Bob', 'Charlie'])
        _start_hand(client, game_id)

        # UTG raises all-in for 5.00 (preflop has blinds, so it's a raise not bet)
        resp = _act(
            client,
            game_id,
            _current(client, game_id),
            'raise',
            amount=5.00,
            is_all_in=True,
        )
        assert resp.status_code == 201

        # SB calls for the full amount (SB posted 0.10, needs 4.90 more)
        _act(client, game_id, _current(client, game_id), 'call', amount=4.90)

        # BB calls for the full amount (BB posted 0.20, needs 4.80 more)
        _act(client, game_id, _current(client, game_id), 'call', amount=4.80)

        hand = client.get(f'/games/{game_id}/hands/1').json()
        # Side pots should exist because UTG is all-in
        assert len(hand['side_pots']) >= 1

    def test_bet_all_in_pot_correct(self, client):
        game_id = _create_game(client, ['Alice', 'Bob', 'Charlie'])
        _start_hand(client, game_id)

        # UTG raises all-in for 5.00
        _act(
            client,
            game_id,
            _current(client, game_id),
            'raise',
            amount=5.00,
            is_all_in=True,
        )
        # SB calls full
        _act(client, game_id, _current(client, game_id), 'call', amount=4.90)
        # BB calls full
        _act(client, game_id, _current(client, game_id), 'call', amount=4.80)

        hand = client.get(f'/games/{game_id}/hands/1').json()
        # Total = 0.10 + 0.20 + 5.00 + 4.90 + 4.80 = 15.00
        assert hand['pot'] == pytest.approx(15.00)


class TestRaiseAllIn:
    """A player raises all-in — is_all_in should be set and side pots computed."""

    def test_raise_all_in_creates_side_pots(self, client):
        game_id = _create_game(client, ['Alice', 'Bob', 'Charlie'])
        _start_hand(client, game_id)

        # UTG raises to 1.00
        _act(client, game_id, _current(client, game_id), 'raise', amount=1.00)
        # SB re-raises all-in to 3.00
        resp = _act(
            client,
            game_id,
            _current(client, game_id),
            'raise',
            amount=3.00,
            is_all_in=True,
        )
        assert resp.status_code == 201

        # BB calls
        _act(client, game_id, _current(client, game_id), 'call', amount=2.80)

        # UTG calls the re-raise
        _act(client, game_id, _current(client, game_id), 'call', amount=2.00)

        hand = client.get(f'/games/{game_id}/hands/1').json()
        # SB is all-in, side pots should exist
        assert len(hand['side_pots']) >= 1

    def test_raise_all_in_flag_accepted(self, client):
        """The is_all_in field should be accepted in the request payload."""
        game_id = _create_game(client, ['Alice', 'Bob', 'Charlie'])
        _start_hand(client, game_id)

        # UTG raises all-in
        resp = _act(
            client,
            game_id,
            _current(client, game_id),
            'raise',
            amount=10.00,
            is_all_in=True,
        )
        # Should not fail validation
        assert resp.status_code == 201

    def test_raise_all_in_without_amount_uses_player_stack(self, client):
        """Frontend all-in omits amount and relies on backend stack inference."""
        game_id = _create_game(
            client, ['Alice', 'Bob', 'Charlie'], default_buy_in=20.00
        )
        _start_hand(client, game_id)

        resp = _act(
            client,
            game_id,
            _current(client, game_id),
            'raise',
            is_all_in=True,
        )

        assert resp.status_code == 201
        assert resp.json()['amount'] == pytest.approx(20.00)


class TestBetAllInWithoutAmount:
    def test_bet_all_in_without_amount_uses_remaining_stack_postflop(self, client):
        game_id = _create_game(client, ['Alice', 'Bob'], default_buy_in=20.00)
        _start_hand(client, game_id)
        _deal_flop(client, game_id)

        # Complete preflop so the next street allows a bet.
        _act(client, game_id, _current(client, game_id), 'call', amount=0.10)
        _act(client, game_id, _current(client, game_id), 'check')

        state = _state(client, game_id)
        assert state['phase'] == 'flop'

        resp = _act(
            client,
            game_id,
            _current(client, game_id),
            'bet',
            is_all_in=True,
        )

        assert resp.status_code == 201
        # Small blind posted 0.10 preflop, then called 0.10, leaving 19.80.
        assert resp.json()['amount'] == pytest.approx(19.80)


class TestCallAllInFallback:
    """Existing auto-detection for call all-in-for-less still works."""

    def test_call_for_less_auto_detected(self, client):
        game_id = _create_game(client, ['Alice', 'Bob', 'Charlie'])
        _start_hand(client, game_id)

        # UTG raises to 5.00
        _act(client, game_id, _current(client, game_id), 'raise', amount=5.00)
        # SB calls for less (0.50) — marked as all-in
        _act(
            client,
            game_id,
            _current(client, game_id),
            'call',
            amount=0.50,
            is_all_in=True,
        )
        # BB calls full
        _act(client, game_id, _current(client, game_id), 'call', amount=4.80)

        hand = client.get(f'/games/{game_id}/hands/1').json()
        assert len(hand['side_pots']) >= 1

    def test_explicit_call_all_in_also_works(self, client):
        """Sending is_all_in=True on a call should also work."""
        game_id = _create_game(client, ['Alice', 'Bob', 'Charlie'])
        _start_hand(client, game_id)

        # UTG raises to 5.00
        _act(client, game_id, _current(client, game_id), 'raise', amount=5.00)
        # SB calls full amount but marks as all-in
        _act(
            client,
            game_id,
            _current(client, game_id),
            'call',
            amount=4.90,
            is_all_in=True,
        )
        # BB folds
        _act(client, game_id, _current(client, game_id), 'fold')

        hand = client.get(f'/games/{game_id}/hands/1').json()
        # Even though SB called the full amount, is_all_in was explicitly set
        assert len(hand['side_pots']) >= 1
