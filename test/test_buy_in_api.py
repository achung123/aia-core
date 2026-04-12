"""Tests for buy-in capture on game/player creation endpoints (aia-core-vm6d)."""


class TestPostGamesWithBuyIn:
    """AC-1: POST /games accepts optional buy_in float per player."""

    def test_create_game_with_buy_ins(self, client):
        """Players created with buy_in dict have buy_in set."""
        resp = client.post(
            '/games/',
            json={
                'game_date': '2026-04-12',
                'player_names': ['Alice', 'Bob'],
                'player_buy_ins': {'Alice': 50.0, 'Bob': 100.0},
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        players = {p['name']: p for p in data['players']}
        assert players['Alice']['buy_in'] == 50.0
        assert players['Bob']['buy_in'] == 100.0

    def test_create_game_partial_buy_ins(self, client):
        """Only players listed in player_buy_ins get buy_in; others are null."""
        resp = client.post(
            '/games/',
            json={
                'game_date': '2026-04-12',
                'player_names': ['Alice', 'Bob'],
                'player_buy_ins': {'Alice': 25.0},
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        players = {p['name']: p for p in data['players']}
        assert players['Alice']['buy_in'] == 25.0
        assert players['Bob']['buy_in'] is None

    def test_create_game_without_buy_ins_defaults_null(self, client):
        """When player_buy_ins is omitted, all buy_in values are null."""
        resp = client.post(
            '/games/',
            json={
                'game_date': '2026-04-12',
                'player_names': ['Alice', 'Bob'],
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        for p in data['players']:
            assert p['buy_in'] is None


class TestPostPlayersWithBuyIn:
    """AC-2: POST /games/{id}/players accepts optional buy_in in body."""

    def _create_game(self, client):
        resp = client.post(
            '/games/',
            json={'game_date': '2026-04-12', 'player_names': ['Alice']},
        )
        return resp.json()['game_id']

    def test_add_player_with_buy_in(self, client):
        """Adding a player with buy_in sets it on the game player."""
        game_id = self._create_game(client)
        resp = client.post(
            f'/games/{game_id}/players',
            json={'player_name': 'Bob', 'buy_in': 75.0},
        )
        assert resp.status_code == 201
        assert resp.json()['buy_in'] == 75.0

    def test_add_player_without_buy_in_defaults_null(self, client):
        """Adding a player without buy_in leaves it as null."""
        game_id = self._create_game(client)
        resp = client.post(
            f'/games/{game_id}/players',
            json={'player_name': 'Bob'},
        )
        assert resp.status_code == 201
        assert resp.json()['buy_in'] is None


class TestGameSessionResponseIncludesBuyIn:
    """AC-3: GameSessionResponse includes buy_in per player."""

    def test_get_game_includes_buy_in(self, client):
        """GET /games/{id} returns buy_in in each player entry."""
        resp = client.post(
            '/games/',
            json={
                'game_date': '2026-04-12',
                'player_names': ['Alice'],
                'player_buy_ins': {'Alice': 40.0},
            },
        )
        game_id = resp.json()['game_id']

        resp = client.get(f'/games/{game_id}')
        assert resp.status_code == 200
        players = resp.json()['players']
        assert len(players) == 1
        assert players[0]['buy_in'] == 40.0

    def test_get_game_mid_game_add_includes_buy_in(self, client):
        """buy_in appears for players added mid-game via POST /players."""
        resp = client.post(
            '/games/',
            json={'game_date': '2026-04-12', 'player_names': ['Alice']},
        )
        game_id = resp.json()['game_id']

        client.post(
            f'/games/{game_id}/players',
            json={'player_name': 'Bob', 'buy_in': 60.0},
        )

        resp = client.get(f'/games/{game_id}')
        players = {p['name']: p for p in resp.json()['players']}
        assert players['Alice']['buy_in'] is None
        assert players['Bob']['buy_in'] == 60.0
