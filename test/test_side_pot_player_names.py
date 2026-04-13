"""Test that side pot responses expose player names, not internal DB IDs.

Regression test for aia-core-7l16.
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


def _create_game(client, names):
    resp = client.post(
        '/games', json={'game_date': '2026-04-12', 'player_names': names}
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


def _state(client, game_id, hand_number=1):
    return client.get(f'/games/{game_id}/hands/{hand_number}/state').json()


def _current(client, game_id, hand_number=1):
    return _state(client, game_id, hand_number)['current_player_name']


def _act(client, game_id, player_name, action, amount=None, hand_number=1, street=None):
    if street is None:
        street = _state(client, game_id, hand_number)['phase']
    payload = {'street': street, 'action': action}
    if amount is not None:
        payload['amount'] = amount
    return client.post(
        f'/games/{game_id}/hands/{hand_number}/players/{player_name}/actions',
        json=payload,
    )


class TestSidePotPlayerNames:
    """Side pots must expose eligible_players (names) not eligible_player_ids (ints)."""

    def test_hand_response_side_pots_contain_player_names(self, client):
        """GET /games/{id}/hands/{n} side_pots should have eligible_players with names."""
        game_id = _create_game(client, ['Alice', 'Bob', 'Charlie'])
        _start_hand(client, game_id)

        # UTG raises to 2.00
        _act(client, game_id, _current(client, game_id), 'raise', amount=2.00)
        # SB calls 0.50 (all-in-for-less)
        _act(client, game_id, _current(client, game_id), 'call', amount=0.50)
        # BB calls 0.80 (all-in)
        _act(client, game_id, _current(client, game_id), 'call', amount=0.80)

        hand = client.get(f'/games/{game_id}/hands/1').json()
        assert len(hand['side_pots']) >= 1

        for sp in hand['side_pots']:
            # Must have eligible_players with string names
            assert 'eligible_players' in sp, 'side pot missing eligible_players key'
            assert all(isinstance(name, str) for name in sp['eligible_players']), (
                'eligible_players should contain strings (player names)'
            )
            # Must NOT expose internal DB IDs
            assert 'eligible_player_ids' not in sp, (
                'side pot must not expose eligible_player_ids'
            )

    def test_status_response_side_pots_contain_player_names(self, client):
        """GET .../status side_pots should have eligible_players with names."""
        game_id = _create_game(client, ['Alice', 'Bob', 'Charlie'])
        _start_hand(client, game_id)

        _act(client, game_id, _current(client, game_id), 'raise', amount=2.00)
        _act(client, game_id, _current(client, game_id), 'call', amount=0.50)
        _act(client, game_id, _current(client, game_id), 'call', amount=0.80)

        status = client.get(f'/games/{game_id}/hands/1/status').json()
        for sp in status['side_pots']:
            assert 'eligible_players' in sp
            assert all(isinstance(name, str) for name in sp['eligible_players'])
            assert 'eligible_player_ids' not in sp

    def test_side_pot_eligible_players_are_correct_names(self, client):
        """Verify the actual names in side pots are correct player names."""
        game_id = _create_game(client, ['Alice', 'Bob', 'Charlie'])
        _start_hand(client, game_id)

        _act(client, game_id, _current(client, game_id), 'raise', amount=2.00)
        _act(client, game_id, _current(client, game_id), 'call', amount=0.50)
        _act(client, game_id, _current(client, game_id), 'call', amount=0.80)

        hand = client.get(f'/games/{game_id}/hands/1').json()
        all_names_in_pots = set()
        for sp in hand['side_pots']:
            all_names_in_pots.update(sp['eligible_players'])

        # All names in side pots should be from the game's player list
        assert all_names_in_pots <= {'Alice', 'Bob', 'Charlie'}
