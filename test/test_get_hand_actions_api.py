"""Tests for GET /games/{game_id}/hands/{hand_number}/actions endpoint."""


def _seed_game_with_hand(client):
    """Create a game with two players, start a hand. Returns (game_id, hand_number)."""
    resp = client.post(
        '/games',
        json={'game_date': '2026-04-12', 'player_names': ['Alice', 'Bob']},
    )
    assert resp.status_code == 201
    game_id = resp.json()['game_id']
    hand_resp = client.post(f'/games/{game_id}/hands/start')
    assert hand_resp.status_code == 201
    return game_id, hand_resp.json()['hand_number']


class TestGetHandActionsOrdering:
    def test_returns_actions_ordered_by_created_at(self, client):
        game_id, hand_number = _seed_game_with_hand(client)

        # Record several actions
        client.post(
            f'/games/{game_id}/hands/{hand_number}/players/Alice/actions',
            json={'street': 'preflop', 'action': 'call', 'amount': 0.20},
        )
        client.post(
            f'/games/{game_id}/hands/{hand_number}/players/Bob/actions',
            json={'street': 'preflop', 'action': 'check'},
        )
        client.post(
            f'/games/{game_id}/hands/{hand_number}/players/Alice/actions',
            json={'street': 'flop', 'action': 'bet', 'amount': 1.00},
        )

        resp = client.get(f'/games/{game_id}/hands/{hand_number}/actions')
        assert resp.status_code == 200

        actions = resp.json()
        assert len(actions) == 3

        # Verify ordering by created_at ascending
        timestamps = [a['created_at'] for a in actions]
        assert timestamps == sorted(timestamps)

    def test_actions_contain_player_name(self, client):
        game_id, hand_number = _seed_game_with_hand(client)

        client.post(
            f'/games/{game_id}/hands/{hand_number}/players/Alice/actions',
            json={'street': 'preflop', 'action': 'call', 'amount': 0.20},
        )
        client.post(
            f'/games/{game_id}/hands/{hand_number}/players/Bob/actions',
            json={'street': 'preflop', 'action': 'check'},
        )

        resp = client.get(f'/games/{game_id}/hands/{hand_number}/actions')
        actions = resp.json()

        assert actions[0]['player_name'] == 'Alice'
        assert actions[1]['player_name'] == 'Bob'

    def test_action_fields_are_correct(self, client):
        game_id, hand_number = _seed_game_with_hand(client)

        client.post(
            f'/games/{game_id}/hands/{hand_number}/players/Alice/actions',
            json={'street': 'preflop', 'action': 'raise', 'amount': 2.50},
        )

        resp = client.get(f'/games/{game_id}/hands/{hand_number}/actions')
        actions = resp.json()

        assert len(actions) == 1
        action = actions[0]
        assert action['player_name'] == 'Alice'
        assert action['street'] == 'preflop'
        assert action['action'] == 'raise'
        assert action['amount'] == 2.50
        assert 'created_at' in action


class TestGetHandActionsEmptyCase:
    def test_returns_empty_list_when_no_actions(self, client):
        game_id, hand_number = _seed_game_with_hand(client)

        resp = client.get(f'/games/{game_id}/hands/{hand_number}/actions')
        assert resp.status_code == 200
        assert resp.json() == []


class TestGetHandActions404:
    def test_returns_404_for_missing_game(self, client):
        resp = client.get('/games/9999/hands/1/actions')
        assert resp.status_code == 404
        assert resp.json()['detail'] == 'Game session not found'

    def test_returns_404_for_missing_hand(self, client):
        resp = client.post(
            '/games',
            json={'game_date': '2026-04-12', 'player_names': ['Alice']},
        )
        game_id = resp.json()['game_id']

        resp = client.get(f'/games/{game_id}/hands/99/actions')
        assert resp.status_code == 404
        assert resp.json()['detail'] == 'Hand not found'
