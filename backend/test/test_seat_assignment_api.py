"""Tests for PATCH /games/{game_id}/players/{player_name}/seat — seat assignment."""


def _create_game(client, player_names=None):
    """Helper to create a game session and return the response JSON."""
    if player_names is None:
        player_names = ['Alice', 'Bob']
    resp = client.post(
        '/games',
        json={'game_date': '2026-04-12', 'player_names': player_names},
    )
    assert resp.status_code == 201
    return resp.json()


class TestSeatAssignmentPatch:
    """PATCH /games/{game_id}/players/{player_name}/seat"""

    def test_assign_seat_success(self, client):
        """AC-1: PATCH with seat_number 3 returns 200 and updates the seat."""
        game = _create_game(client)
        game_id = game['game_id']

        resp = client.patch(
            f'/games/{game_id}/players/Alice/seat',
            json={'seat_number': 3},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body['name'] == 'Alice'
        assert body['seat_number'] == 3

    def test_assign_seat_conflict_returns_409(self, client):
        """AC-2: Returns 409 when the seat is occupied by another active player."""
        game = _create_game(client)
        game_id = game['game_id']

        # Put Alice in seat 5
        resp = client.patch(
            f'/games/{game_id}/players/Alice/seat',
            json={'seat_number': 5},
        )
        assert resp.status_code == 200

        # Try to put Bob in seat 5
        resp = client.patch(
            f'/games/{game_id}/players/Bob/seat',
            json={'seat_number': 5},
        )
        assert resp.status_code == 409
        assert (
            'occupied' in resp.json()['detail'].lower()
            or 'seat' in resp.json()['detail'].lower()
        )

    def test_seat_out_of_range_low_returns_422(self, client):
        """AC-3: seat_number < 1 returns 422 (Pydantic validation)."""
        game = _create_game(client)
        game_id = game['game_id']

        resp = client.patch(
            f'/games/{game_id}/players/Alice/seat',
            json={'seat_number': 0},
        )
        assert resp.status_code == 422

    def test_seat_out_of_range_high_returns_422(self, client):
        """AC-3: seat_number > 10 returns 422 (Pydantic validation)."""
        game = _create_game(client)
        game_id = game['game_id']

        resp = client.patch(
            f'/games/{game_id}/players/Alice/seat',
            json={'seat_number': 11},
        )
        assert resp.status_code == 422

    def test_player_not_in_game_returns_404(self, client):
        """AC-4: Returns 404 when the player is not in the game."""
        game = _create_game(client)
        game_id = game['game_id']

        resp = client.patch(
            f'/games/{game_id}/players/Zara/seat',
            json={'seat_number': 3},
        )
        assert resp.status_code == 404

    def test_game_not_found_returns_404(self, client):
        """Returns 404 when the game does not exist."""
        resp = client.patch(
            '/games/9999/players/Alice/seat',
            json={'seat_number': 3},
        )
        assert resp.status_code == 404

    def test_reassign_to_different_open_seat(self, client):
        """AC-6: A player can reassign themselves to a different open seat."""
        game = _create_game(client)
        game_id = game['game_id']

        # Assign Alice to seat 3
        resp = client.patch(
            f'/games/{game_id}/players/Alice/seat',
            json={'seat_number': 3},
        )
        assert resp.status_code == 200
        assert resp.json()['seat_number'] == 3

        # Reassign Alice to seat 7
        resp = client.patch(
            f'/games/{game_id}/players/Alice/seat',
            json={'seat_number': 7},
        )
        assert resp.status_code == 200
        assert resp.json()['seat_number'] == 7

        # Bob should now be able to take seat 3
        resp = client.patch(
            f'/games/{game_id}/players/Bob/seat',
            json={'seat_number': 3},
        )
        assert resp.status_code == 200
        assert resp.json()['seat_number'] == 3

    def test_reassign_same_seat_is_idempotent(self, client):
        """A player reassigning to their own seat succeeds."""
        game = _create_game(client)
        game_id = game['game_id']

        # Assign Alice to seat 3
        client.patch(
            f'/games/{game_id}/players/Alice/seat',
            json={'seat_number': 3},
        )

        # Reassign Alice to seat 3 again
        resp = client.patch(
            f'/games/{game_id}/players/Alice/seat',
            json={'seat_number': 3},
        )
        assert resp.status_code == 200
        assert resp.json()['seat_number'] == 3

    def test_inactive_player_seat_not_blocked(self, client):
        """An inactive player's seat should not block assignment."""
        game = _create_game(client, player_names=['Alice', 'Bob', 'Charlie'])
        game_id = game['game_id']

        # Assign Charlie to seat 5
        client.patch(
            f'/games/{game_id}/players/Charlie/seat',
            json={'seat_number': 5},
        )

        # Deactivate Charlie
        client.patch(
            f'/games/{game_id}/players/Charlie/status',
            json={'is_active': False},
        )

        # Bob should be able to take seat 5
        resp = client.patch(
            f'/games/{game_id}/players/Bob/seat',
            json={'seat_number': 5},
        )
        assert resp.status_code == 200
        assert resp.json()['seat_number'] == 5


class TestAddPlayerWithSeat:
    """POST /games/{game_id}/players with optional seat_number."""

    def test_add_player_with_seat_success(self, client):
        """AC-5: Adding player with seat_number assigns that seat."""
        game = _create_game(client)
        game_id = game['game_id']

        resp = client.post(
            f'/games/{game_id}/players',
            json={'player_name': 'Charlie', 'seat_number': 5},
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body['player_name'] == 'Charlie'
        assert body['seat_number'] == 5

    def test_add_player_with_occupied_seat_returns_409(self, client):
        """AC-5: Returns 409 if the seat is already taken."""
        game = _create_game(client)
        game_id = game['game_id']

        # Put Alice at seat 3
        client.patch(
            f'/games/{game_id}/players/Alice/seat',
            json={'seat_number': 3},
        )

        # Try to add Charlie at seat 3
        resp = client.post(
            f'/games/{game_id}/players',
            json={'player_name': 'Charlie', 'seat_number': 3},
        )
        assert resp.status_code == 409
        assert 'seat' in resp.json()['detail'].lower()

    def test_add_player_without_seat_still_auto_assigns(self, client):
        """Adding player without seat_number still auto-assigns as before."""
        game = _create_game(client)
        game_id = game['game_id']

        resp = client.post(
            f'/games/{game_id}/players',
            json={'player_name': 'Charlie'},
        )
        assert resp.status_code == 201
        assert resp.json()['seat_number'] is not None
