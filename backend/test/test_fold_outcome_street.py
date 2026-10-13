"""Tests: Fold action sets outcome_street on PlayerHand."""

from conftest import activate_hand


def _action_url(game_id, hand_number, player_name):
    return f'/games/{game_id}/hands/{hand_number}/players/{player_name}/actions'


def _hand_url(game_id, hand_number):
    return f'/games/{game_id}/hands/{hand_number}'


def _create_game_and_hand(client, names=None):
    if names is None:
        names = ['Alice', 'Bob', 'Charlie']
    resp = client.post(
        '/games',
        json={'game_date': '2026-04-13', 'player_names': names},
    )
    assert resp.status_code == 201
    game_id = resp.json()['game_id']

    resp = client.post(
        f'/games/{game_id}/hands',
        json={'player_entries': [{'player_name': n} for n in names]},
    )
    assert resp.status_code == 201
    hand_json = resp.json()
    hand_number = hand_json['hand_number']
    activate_hand(client, game_id, hand_json, names)
    return game_id, hand_number


class TestFoldSetsOutcomeStreet:
    """Folding sets outcome_street to the street where the fold occurred."""

    def test_fold_on_preflop_sets_outcome_street(self, client):
        game_id, hn = _create_game_and_hand(client)
        resp = client.post(
            _action_url(game_id, hn, 'Alice'),
            json={'street': 'preflop', 'action': 'fold'},
        )
        assert resp.status_code == 201

        hand_resp = client.get(_hand_url(game_id, hn))
        phs = hand_resp.json()['player_hands']
        alice = next(ph for ph in phs if ph['player_name'] == 'Alice')
        assert alice['outcome_street'] == 'preflop'

    def test_fold_on_flop_sets_outcome_street(self, client):
        game_id, hn = _create_game_and_hand(client)
        resp = client.post(
            _action_url(game_id, hn, 'Alice'),
            json={'street': 'flop', 'action': 'fold'},
        )
        assert resp.status_code == 201

        hand_resp = client.get(_hand_url(game_id, hn))
        phs = hand_resp.json()['player_hands']
        alice = next(ph for ph in phs if ph['player_name'] == 'Alice')
        assert alice['outcome_street'] == 'flop'


class TestFoldToOneSetsWinnerOutcomeStreet:
    """When all but one player folds, the winner's outcome_street is also set."""

    def test_fold_to_one_sets_winner_outcome_street(self, client):
        game_id, hn = _create_game_and_hand(client, names=['Alice', 'Bob'])
        resp = client.post(
            _action_url(game_id, hn, 'Alice'),
            json={'street': 'flop', 'action': 'fold'},
        )
        assert resp.status_code == 201

        hand_resp = client.get(_hand_url(game_id, hn))
        phs = hand_resp.json()['player_hands']
        bob = next(ph for ph in phs if ph['player_name'] == 'Bob')
        assert bob['result'] == 'won'
        assert bob['outcome_street'] == 'flop'
