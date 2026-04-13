"""aia-core-poxs: After river betting completes, hand advances to showdown with no current player."""

from conftest import activate_hand


def _create_game(client, names):
    resp = client.post(
        '/games', json={'game_date': '2026-04-13', 'player_names': names}
    )
    assert resp.status_code == 201
    return resp.json()['game_id']


def _state(client, game_id, hand_number):
    return client.get(f'/games/{game_id}/hands/{hand_number}/state').json()


def _status(client, game_id, hand_number):
    return client.get(f'/games/{game_id}/hands/{hand_number}/status').json()


def _act(client, game_id, player_name, action, amount=None, hand_number=1):
    street = _state(client, game_id, hand_number)['phase']
    payload = {'street': street, 'action': action}
    if amount is not None:
        payload['amount'] = amount
    resp = client.post(
        f'/games/{game_id}/hands/{hand_number}/players/{player_name}/actions',
        json=payload,
    )
    assert resp.status_code == 201, f'{player_name} {action}: {resp.text}'
    return resp


def _current(client, game_id, hand_number):
    return _state(client, game_id, hand_number)['current_player_name']


class TestRiverShowdownTransition:
    """After river betting completes the hand should be in showdown with no current player."""

    def test_showdown_after_river_has_no_current_player(self, client):
        """Play preflop→flop→turn→river with all checks/calls, verify showdown."""
        game_id = _create_game(client, ['Alice', 'Bob'])
        hand_resp = client.post(f'/games/{game_id}/hands/start')
        assert hand_resp.status_code == 201
        hand = hand_resp.json()
        hn = hand['hand_number']
        activate_hand(client, game_id, hand)

        # Deal flop up front so preflop→flop can advance
        resp = client.patch(
            f'/games/{game_id}/hands/{hn}/flop',
            json={
                'flop_1': {'rank': '9', 'suit': 'H'},
                'flop_2': {'rank': 'J', 'suit': 'D'},
                'flop_3': {'rank': 'Q', 'suit': 'S'},
            },
        )
        assert resp.status_code == 200

        # --- Preflop: SB calls, BB checks ---
        p = _current(client, game_id, hn)
        _act(client, game_id, p, 'call', amount=0.10, hand_number=hn)
        p = _current(client, game_id, hn)
        _act(client, game_id, p, 'check', hand_number=hn)

        state = _state(client, game_id, hn)
        assert state['phase'] == 'flop', f"Expected flop, got {state['phase']}"

        # Deal turn so flop→turn can advance
        resp = client.patch(
            f'/games/{game_id}/hands/{hn}/turn',
            json={'turn': {'rank': '7', 'suit': 'C'}},
        )
        assert resp.status_code == 200

        # --- Flop: both check ---
        p = _current(client, game_id, hn)
        _act(client, game_id, p, 'check', hand_number=hn)
        p = _current(client, game_id, hn)
        _act(client, game_id, p, 'check', hand_number=hn)

        state = _state(client, game_id, hn)
        assert state['phase'] == 'turn', f"Expected turn, got {state['phase']}"

        # Deal river so turn→river can advance
        resp = client.patch(
            f'/games/{game_id}/hands/{hn}/river',
            json={'river': {'rank': '5', 'suit': 'D'}},
        )
        assert resp.status_code == 200

        # --- Turn: both check ---
        p = _current(client, game_id, hn)
        _act(client, game_id, p, 'check', hand_number=hn)
        p = _current(client, game_id, hn)
        _act(client, game_id, p, 'check', hand_number=hn)

        state = _state(client, game_id, hn)
        assert state['phase'] == 'river', f"Expected river, got {state['phase']}"

        # --- River: both check ---
        p = _current(client, game_id, hn)
        _act(client, game_id, p, 'check', hand_number=hn)
        p = _current(client, game_id, hn)
        _act(client, game_id, p, 'check', hand_number=hn)

        # --- Verify showdown ---
        state = _state(client, game_id, hn)
        assert state['phase'] == 'showdown'
        assert state['current_player_name'] is None
        assert state['current_seat'] is None

        status = _status(client, game_id, hn)
        assert status['phase'] == 'showdown'
        assert status['current_player_name'] is None
