"""Tests for POST /games/{game_id}/players — add player to existing game."""


def _create_game(client, player_names=None):
    """Helper to create a game session and return the response JSON."""
    if player_names is None:
        player_names = ["Alice", "Bob"]
    resp = client.post(
        "/games",
        json={"game_date": "2026-04-12", "player_names": player_names},
    )
    assert resp.status_code == 201
    return resp.json()


class TestAddPlayerToGame:
    """POST /games/{game_id}/players"""

    def test_add_brand_new_player(self, client):
        """AC-1/2: New player created + GamePlayer row added, returns 201."""
        game = _create_game(client)
        game_id = game["game_id"]

        resp = client.post(
            f"/games/{game_id}/players",
            json={"player_name": "Charlie"},
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["player_name"] == "Charlie"
        assert body["is_active"] is True
        assert "seat_number" in body

        # Verify player appears in game session
        game_resp = client.get(f"/games/{game_id}")
        assert "Charlie" in game_resp.json()["player_names"]

    def test_add_existing_player_not_in_game(self, client):
        """AC-2: Player exists in system but not in this game — add them."""
        # Create first game with Charlie
        _create_game(client, player_names=["Charlie"])

        # Create second game without Charlie
        game2 = _create_game(client, player_names=["Alice", "Bob"])
        game_id = game2["game_id"]

        resp = client.post(
            f"/games/{game_id}/players",
            json={"player_name": "Charlie"},
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["player_name"] == "Charlie"
        assert body["is_active"] is True

    def test_duplicate_player_returns_409(self, client):
        """AC-4: Player already in game (active) → 409."""
        game = _create_game(client, player_names=["Alice", "Bob"])
        game_id = game["game_id"]

        resp = client.post(
            f"/games/{game_id}/players",
            json={"player_name": "Alice"},
        )
        assert resp.status_code == 409
        assert "already in this game" in resp.json()["detail"].lower()

    def test_inactive_player_returns_409_with_hint(self, client):
        """AC-5: Inactive player already in game → 409 with toggle hint."""
        game = _create_game(client, player_names=["Alice", "Bob"])
        game_id = game["game_id"]

        # Deactivate Alice via the toggle endpoint
        client.patch(
            f"/games/{game_id}/players/Alice/status",
            json={"is_active": False},
        )

        resp = client.post(
            f"/games/{game_id}/players",
            json={"player_name": "Alice"},
        )
        assert resp.status_code == 409
        detail = resp.json()["detail"]
        assert "already in this game" in detail.lower()
        assert "status" in detail.lower() or "toggle" in detail.lower()

    def test_game_not_found_returns_404(self, client):
        """AC-4: Non-existent game → 404."""
        resp = client.post(
            "/games/9999/players",
            json={"player_name": "Charlie"},
        )
        assert resp.status_code == 404
        assert "not found" in resp.json()["detail"].lower()

    def test_case_insensitive_player_lookup(self, client):
        """Player lookup is case-insensitive — adding 'alice' matches 'Alice'."""
        game = _create_game(client, player_names=["Alice"])
        game_id = game["game_id"]

        resp = client.post(
            f"/games/{game_id}/players",
            json={"player_name": "alice"},
        )
        assert resp.status_code == 409

    def test_auto_assigns_seat_number(self, client):
        """Seat number auto-increments from max existing seat."""
        game = _create_game(client, player_names=["Alice", "Bob"])
        game_id = game["game_id"]

        resp = client.post(
            f"/games/{game_id}/players",
            json={"player_name": "Charlie"},
        )
        assert resp.status_code == 201
        body = resp.json()
        # Alice and Bob get seats during game creation (no seat_number set),
        # so Charlie should get a valid seat_number
        assert body["seat_number"] is not None
        assert isinstance(body["seat_number"], int)
