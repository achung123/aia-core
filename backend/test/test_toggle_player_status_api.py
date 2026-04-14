"""Tests for PATCH /games/{game_id}/players/{player_name}/status endpoint."""


def _create_game_with_players(client, player_names=None):
    """Helper: create a game with given players and return the game_id."""
    if player_names is None:
        player_names = ['Alice', 'Bob']
    resp = client.post(
        '/games',
        json={'game_date': '2026-04-12', 'player_names': player_names},
    )
    assert resp.status_code == 201
    return resp.json()['game_id']


class TestTogglePlayerStatusActivate:
    def test_activate_player(self, client):
        """Setting is_active=True returns 200 with correct body."""
        game_id = _create_game_with_players(client)
        resp = client.patch(
            f'/games/{game_id}/players/Alice/status',
            json={'is_active': True},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body['player_name'] == 'Alice'
        assert body['is_active'] is True


class TestTogglePlayerStatusDeactivate:
    def test_deactivate_player(self, client):
        """Setting is_active=False returns 200 and the flag is flipped."""
        game_id = _create_game_with_players(client)
        resp = client.patch(
            f'/games/{game_id}/players/Alice/status',
            json={'is_active': False},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body['player_name'] == 'Alice'
        assert body['is_active'] is False

    def test_deactivate_does_not_delete_player_hands(self, client):
        """Deactivating a player does NOT remove their PlayerHand rows."""
        game_id = _create_game_with_players(client)
        # Create a hand with Alice
        hand_resp = client.post(
            f'/games/{game_id}/hands',
            json={
                'player_entries': [
                    {'player_name': 'Alice', 'card_1': 'AH', 'card_2': 'KS'},
                ]
            },
        )
        assert hand_resp.status_code == 201
        hand_number = hand_resp.json()['hand_number']

        # Deactivate Alice
        resp = client.patch(
            f'/games/{game_id}/players/Alice/status',
            json={'is_active': False},
        )
        assert resp.status_code == 200
        assert resp.json()['is_active'] is False

        # Alice's hand entry should still exist
        get_resp = client.get(f'/games/{game_id}/hands/{hand_number}')
        assert get_resp.status_code == 200
        players_in_hand = [pe['player_name'] for pe in get_resp.json()['player_hands']]
        assert 'Alice' in players_in_hand


class TestTogglePlayerStatusNotFound:
    def test_player_not_in_game_returns_404(self, client):
        """Toggling a player not in this game returns 404."""
        game_id = _create_game_with_players(client)
        resp = client.patch(
            f'/games/{game_id}/players/Charlie/status',
            json={'is_active': False},
        )
        assert resp.status_code == 404

    def test_game_not_found_returns_404(self, client):
        """Toggling a player on a non-existent game returns 404."""
        resp = client.patch(
            '/games/9999/players/Alice/status',
            json={'is_active': False},
        )
        assert resp.status_code == 404


class TestTogglePlayerStatusIdempotent:
    def test_idempotent_deactivate(self, client):
        """Deactivating an already-inactive player is idempotent (still 200)."""
        game_id = _create_game_with_players(client)
        # Deactivate twice
        client.patch(
            f'/games/{game_id}/players/Alice/status',
            json={'is_active': False},
        )
        resp = client.patch(
            f'/games/{game_id}/players/Alice/status',
            json={'is_active': False},
        )
        assert resp.status_code == 200
        assert resp.json()['is_active'] is False

    def test_idempotent_activate(self, client):
        """Activating an already-active player is idempotent (still 200)."""
        game_id = _create_game_with_players(client)
        resp = client.patch(
            f'/games/{game_id}/players/Alice/status',
            json={'is_active': True},
        )
        assert resp.status_code == 200
        assert resp.json()['is_active'] is True

    def test_toggle_back_and_forth(self, client):
        """Deactivate then reactivate returns correct state each time."""
        game_id = _create_game_with_players(client)
        # Deactivate
        resp1 = client.patch(
            f'/games/{game_id}/players/Alice/status',
            json={'is_active': False},
        )
        assert resp1.json()['is_active'] is False

        # Reactivate
        resp2 = client.patch(
            f'/games/{game_id}/players/Alice/status',
            json={'is_active': True},
        )
        assert resp2.json()['is_active'] is True
