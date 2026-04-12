"""Tests for rebuy (re-buy/buyback) endpoints."""

from datetime import date


def _create_game_with_player(client, player_name="Alice", buy_in=100.0):
    """Helper: create a game session with one player and return game_id."""
    resp = client.post(
        "/games",
        json={
            "game_date": str(date.today()),
            "player_names": [player_name],
            "player_buy_ins": {player_name: buy_in},
        },
    )
    assert resp.status_code == 201
    return resp.json()["game_id"]


class TestPostRebuy:
    def test_post_rebuy_creates_record_201(self, client):
        game_id = _create_game_with_player(client)
        resp = client.post(
            f"/games/{game_id}/players/Alice/rebuys",
            json={"amount": 50.0},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["player_name"] == "Alice"
        assert data["amount"] == 50.0
        assert data["game_id"] == game_id
        assert "rebuy_id" in data
        assert "created_at" in data

    def test_post_rebuy_reactivates_inactive_player(self, client):
        game_id = _create_game_with_player(client)
        # Deactivate player
        client.patch(
            f"/games/{game_id}/players/Alice/status",
            json={"is_active": False},
        )
        # Confirm player is inactive
        resp = client.get(f"/games/{game_id}")
        player = next(p for p in resp.json()["players"] if p["name"] == "Alice")
        assert player["is_active"] is False

        # Record a rebuy — should reactivate
        resp = client.post(
            f"/games/{game_id}/players/Alice/rebuys",
            json={"amount": 75.0},
        )
        assert resp.status_code == 201

        # Confirm player is now active
        resp = client.get(f"/games/{game_id}")
        player = next(p for p in resp.json()["players"] if p["name"] == "Alice")
        assert player["is_active"] is True

    def test_post_rebuy_404_missing_game(self, client):
        resp = client.post(
            "/games/9999/players/Alice/rebuys",
            json={"amount": 50.0},
        )
        assert resp.status_code == 404

    def test_post_rebuy_404_missing_player(self, client):
        game_id = _create_game_with_player(client)
        resp = client.post(
            f"/games/{game_id}/players/NoSuchPlayer/rebuys",
            json={"amount": 50.0},
        )
        assert resp.status_code == 404

    def test_post_rebuy_negative_amount_422(self, client):
        game_id = _create_game_with_player(client)
        resp = client.post(
            f"/games/{game_id}/players/Alice/rebuys",
            json={"amount": -50.0},
        )
        assert resp.status_code == 422

    def test_post_rebuy_zero_amount_422(self, client):
        game_id = _create_game_with_player(client)
        resp = client.post(
            f"/games/{game_id}/players/Alice/rebuys",
            json={"amount": 0},
        )
        assert resp.status_code == 422


class TestGetRebuys:
    def test_get_rebuys_returns_ordered_list(self, client):
        game_id = _create_game_with_player(client)
        # Create multiple rebuys
        client.post(
            f"/games/{game_id}/players/Alice/rebuys", json={"amount": 30.0}
        )
        client.post(
            f"/games/{game_id}/players/Alice/rebuys", json={"amount": 50.0}
        )
        client.post(
            f"/games/{game_id}/players/Alice/rebuys", json={"amount": 20.0}
        )

        resp = client.get(f"/games/{game_id}/players/Alice/rebuys")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 3
        # Should be ordered by created_at
        assert data[0]["amount"] == 30.0
        assert data[1]["amount"] == 50.0
        assert data[2]["amount"] == 20.0

    def test_get_rebuys_empty_list(self, client):
        game_id = _create_game_with_player(client)
        resp = client.get(f"/games/{game_id}/players/Alice/rebuys")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_get_rebuys_404_missing_game(self, client):
        resp = client.get("/games/9999/players/Alice/rebuys")
        assert resp.status_code == 404

    def test_get_rebuys_404_missing_player(self, client):
        game_id = _create_game_with_player(client)
        resp = client.get(f"/games/{game_id}/players/NoSuchPlayer/rebuys")
        assert resp.status_code == 404


class TestGameSessionResponseRebuyFields:
    def test_player_info_includes_rebuy_stats(self, client):
        game_id = _create_game_with_player(client)
        # Create two rebuys
        client.post(
            f"/games/{game_id}/players/Alice/rebuys", json={"amount": 50.0}
        )
        client.post(
            f"/games/{game_id}/players/Alice/rebuys", json={"amount": 75.0}
        )

        resp = client.get(f"/games/{game_id}")
        assert resp.status_code == 200
        player = next(p for p in resp.json()["players"] if p["name"] == "Alice")
        assert player["rebuy_count"] == 2
        assert player["total_rebuys"] == 125.0

    def test_player_info_zero_rebuys(self, client):
        game_id = _create_game_with_player(client)
        resp = client.get(f"/games/{game_id}")
        player = next(p for p in resp.json()["players"] if p["name"] == "Alice")
        assert player["rebuy_count"] == 0
        assert player["total_rebuys"] == 0.0
