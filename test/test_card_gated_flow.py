"""Tests for card-gated hand flow.

When a hand starts, phase should be 'awaiting_cards' with no blinds posted.
Blinds auto-post only after ALL players have captured their hole cards.
"""

import pytest
from fastapi.testclient import TestClient

from app.database.session import get_db
from app.main import app

from conftest import override_get_db


@pytest.fixture
def client():
    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()


def _create_game(client, names=None):
    if names is None:
        names = ['Alice', 'Bob', 'Charlie']
    resp = client.post(
        '/games', json={'game_date': '2026-04-13', 'player_names': names}
    )
    assert resp.status_code == 201
    return resp.json()['game_id']


def _start_hand(client, game_id):
    resp = client.post(f'/games/{game_id}/hands/start')
    assert resp.status_code == 201
    return resp.json()


def _capture_cards(client, game_id, hand_number, player_name, card_1, card_2):
    resp = client.patch(
        f'/games/{game_id}/hands/{hand_number}/players/{player_name}',
        json={'card_1': card_1, 'card_2': card_2},
    )
    assert resp.status_code == 200
    return resp.json()


def _capture_all(client, game_id, hand_number, names, cards):
    """Capture cards for all players. cards is list of (c1, c2) tuples."""
    for name, (c1, c2) in zip(names, cards, strict=False):
        _capture_cards(client, game_id, hand_number, name, c1, c2)


class TestHandStartsInAwaitingCards:
    def test_phase_is_awaiting_cards(self, client):
        """New hand should start in awaiting_cards phase."""
        gid = _create_game(client)
        hand = _start_hand(client, gid)
        hn = hand['hand_number']

        state = client.get(f'/games/{gid}/hands/{hn}/state').json()
        assert state['phase'] == 'awaiting_cards'

    def test_current_seat_is_none(self, client):
        """No player should be current in awaiting_cards."""
        gid = _create_game(client)
        hand = _start_hand(client, gid)
        hn = hand['hand_number']

        state = client.get(f'/games/{gid}/hands/{hn}/state').json()
        assert state['current_seat'] is None
        assert state['current_player_name'] is None

    def test_no_blinds_posted(self, client):
        """No blind actions should exist yet."""
        gid = _create_game(client)
        hand = _start_hand(client, gid)
        hn = hand['hand_number']

        actions = client.get(f'/games/{gid}/hands/{hn}/actions').json()
        assert len(actions) == 0

    def test_pot_is_zero(self, client):
        """Pot should be zero before cards are captured."""
        gid = _create_game(client)
        hand = _start_hand(client, gid)
        hn = hand['hand_number']

        status = client.get(f'/games/{gid}/hands/{hn}/status').json()
        assert status['pot'] == 0

    def test_status_phase_is_awaiting_cards(self, client):
        """Hand status endpoint should expose the phase."""
        gid = _create_game(client)
        hand = _start_hand(client, gid)
        hn = hand['hand_number']

        status = client.get(f'/games/{gid}/hands/{hn}/status').json()
        assert status['phase'] == 'awaiting_cards'


class TestPartialCardCapture:
    def test_still_awaiting_after_one_capture(self, client):
        """Phase stays awaiting_cards until ALL players have cards."""
        gid = _create_game(client, ['Alice', 'Bob', 'Charlie'])
        hand = _start_hand(client, gid)
        hn = hand['hand_number']

        _capture_cards(client, gid, hn, 'Alice', 'Ah', 'Kd')

        state = client.get(f'/games/{gid}/hands/{hn}/state').json()
        assert state['phase'] == 'awaiting_cards'
        assert state['current_seat'] is None

    def test_still_awaiting_after_two_of_three(self, client):
        """Phase stays awaiting_cards with 2/3 captured."""
        gid = _create_game(client, ['Alice', 'Bob', 'Charlie'])
        hand = _start_hand(client, gid)
        hn = hand['hand_number']

        _capture_cards(client, gid, hn, 'Alice', 'Ah', 'Kd')
        _capture_cards(client, gid, hn, 'Bob', '2c', '3c')

        state = client.get(f'/games/{gid}/hands/{hn}/state').json()
        assert state['phase'] == 'awaiting_cards'


class TestTransitionToPreflop:
    def test_all_captured_activates_preflop(self, client):
        """After last player captures, phase transitions to preflop."""
        gid = _create_game(client, ['Alice', 'Bob', 'Charlie'])
        hand = _start_hand(client, gid)
        hn = hand['hand_number']

        _capture_all(
            client,
            gid,
            hn,
            ['Alice', 'Bob', 'Charlie'],
            [('Ah', 'Kd'), ('2c', '3c'), ('4s', '5s')],
        )

        state = client.get(f'/games/{gid}/hands/{hn}/state').json()
        assert state['phase'] == 'preflop'

    def test_blinds_auto_posted(self, client):
        """After all capture, blinds should be posted."""
        gid = _create_game(client, ['Alice', 'Bob', 'Charlie'])
        hand = _start_hand(client, gid)
        hn = hand['hand_number']

        _capture_all(
            client,
            gid,
            hn,
            ['Alice', 'Bob', 'Charlie'],
            [('Ah', 'Kd'), ('2c', '3c'), ('4s', '5s')],
        )

        actions = client.get(f'/games/{gid}/hands/{hn}/actions').json()
        blind_actions = [a for a in actions if a['action'] == 'blind']
        assert len(blind_actions) == 2

    def test_pot_includes_blinds(self, client):
        """Pot should equal SB + BB after transition."""
        gid = _create_game(client, ['Alice', 'Bob', 'Charlie'])
        hand = _start_hand(client, gid)
        hn = hand['hand_number']

        _capture_all(
            client,
            gid,
            hn,
            ['Alice', 'Bob', 'Charlie'],
            [('Ah', 'Kd'), ('2c', '3c'), ('4s', '5s')],
        )

        status = client.get(f'/games/{gid}/hands/{hn}/status').json()
        assert abs(status['pot'] - 0.30) < 0.01  # 0.10 + 0.20

    def test_utg_is_first_to_act(self, client):
        """After transition, first-to-act should be UTG (after BB)."""
        gid = _create_game(client, ['Alice', 'Bob', 'Charlie'])
        hand = _start_hand(client, gid)
        hn = hand['hand_number']

        _capture_all(
            client,
            gid,
            hn,
            ['Alice', 'Bob', 'Charlie'],
            [('Ah', 'Kd'), ('2c', '3c'), ('4s', '5s')],
        )

        state = client.get(f'/games/{gid}/hands/{hn}/state').json()
        assert state['current_player_name'] is not None
        # UTG is the player AFTER BB
        bb_name = hand['bb_player_name']
        assert state['current_player_name'] != bb_name

    def test_status_phase_is_preflop(self, client):
        """Status endpoint should report phase=preflop after transition."""
        gid = _create_game(client, ['Alice', 'Bob', 'Charlie'])
        hand = _start_hand(client, gid)
        hn = hand['hand_number']

        _capture_all(
            client,
            gid,
            hn,
            ['Alice', 'Bob', 'Charlie'],
            [('Ah', 'Kd'), ('2c', '3c'), ('4s', '5s')],
        )

        status = client.get(f'/games/{gid}/hands/{hn}/status').json()
        assert status['phase'] == 'preflop'

    def test_two_player_transition(self, client):
        """Two-player game should also transition correctly."""
        gid = _create_game(client, ['Alice', 'Bob'])
        hand = _start_hand(client, gid)
        hn = hand['hand_number']

        _capture_all(client, gid, hn, ['Alice', 'Bob'], [('Ah', 'Kd'), ('2c', '3c')])

        state = client.get(f'/games/{gid}/hands/{hn}/state').json()
        assert state['phase'] == 'preflop'
        assert state['current_player_name'] is not None

        actions = client.get(f'/games/{gid}/hands/{hn}/actions').json()
        blind_actions = [a for a in actions if a['action'] == 'blind']
        assert len(blind_actions) == 2


class TestBettingBlockedDuringAwaitingCards:
    def test_action_rejected_during_awaiting_cards(self, client):
        """Cannot record a betting action while awaiting cards."""
        gid = _create_game(client, ['Alice', 'Bob', 'Charlie'])
        hand = _start_hand(client, gid)
        hn = hand['hand_number']

        # Try to bet before capturing cards
        resp = client.post(
            f'/games/{gid}/hands/{hn}/players/Alice/actions',
            json={'street': 'preflop', 'action': 'call', 'amount': 0.20},
        )
        assert resp.status_code == 403
        assert 'awaiting' in resp.json()['detail'].lower()

    def test_street_complete_false_during_awaiting(self, client):
        """street_complete should be False during awaiting_cards."""
        gid = _create_game(client)
        hand = _start_hand(client, gid)
        hn = hand['hand_number']

        status = client.get(f'/games/{gid}/hands/{hn}/status').json()
        assert status['street_complete'] is False

    def test_no_current_player_during_awaiting(self, client):
        """No player should be current during awaiting_cards."""
        gid = _create_game(client)
        hand = _start_hand(client, gid)
        hn = hand['hand_number']

        status = client.get(f'/games/{gid}/hands/{hn}/status').json()
        assert status['current_player_name'] is None


class TestFullGatedFlow:
    def test_capture_then_bet_to_flop(self, client):
        """Full flow: capture cards → blinds → bet preflop → deal flop."""
        gid = _create_game(client, ['Alice', 'Bob', 'Charlie'])
        hand = _start_hand(client, gid)
        hn = hand['hand_number']

        # 1. Capture all cards
        _capture_all(
            client,
            gid,
            hn,
            ['Alice', 'Bob', 'Charlie'],
            [('Ah', 'Kd'), ('2c', '3c'), ('4s', '5s')],
        )

        # 2. Set flop cards for later advance
        client.patch(
            f'/games/{gid}/hands/{hn}/flop',
            json={'flop_1': '9h', 'flop_2': '8d', 'flop_3': '7c'},
        )

        # 3. Play out preflop: UTG call, SB call, BB check
        state = client.get(f'/games/{gid}/hands/{hn}/state').json()
        assert state['phase'] == 'preflop'
        client.post(
            f'/games/{gid}/hands/{hn}/players/{state["current_player_name"]}/actions',
            json={'street': 'preflop', 'action': 'call', 'amount': 0.20},
        )
        state = client.get(f'/games/{gid}/hands/{hn}/state').json()
        client.post(
            f'/games/{gid}/hands/{hn}/players/{state["current_player_name"]}/actions',
            json={'street': 'preflop', 'action': 'call', 'amount': 0.10},
        )
        state = client.get(f'/games/{gid}/hands/{hn}/state').json()
        client.post(
            f'/games/{gid}/hands/{hn}/players/{state["current_player_name"]}/actions',
            json={'street': 'preflop', 'action': 'check'},
        )

        # 4. Phase should have advanced to flop
        state = client.get(f'/games/{gid}/hands/{hn}/state').json()
        assert state['phase'] == 'flop'
