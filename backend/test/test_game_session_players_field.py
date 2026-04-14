"""Tests for GameSessionResponse.players field (T-007 / aia-core-d22b).

Verifies that GET /games/{id}, POST /games, and other endpoints returning
GameSessionResponse include a `players` list with name and is_active,
while keeping backward-compatible `player_names`.
"""


def _create_game(client, player_names=None):
    if player_names is None:
        player_names = ['Alice', 'Bob']
    resp = client.post(
        '/games',
        json={'game_date': '2026-04-12', 'player_names': player_names},
    )
    assert resp.status_code == 201
    return resp.json()


class TestPlayersFieldInCreateResponse:
    """POST /games response includes the new players field."""

    def test_create_game_has_players_field(self, client):
        data = _create_game(client)
        assert 'players' in data

    def test_create_game_players_is_list(self, client):
        data = _create_game(client)
        assert isinstance(data['players'], list)

    def test_create_game_players_have_name_and_is_active(self, client):
        data = _create_game(client)
        for p in data['players']:
            assert 'name' in p
            assert 'is_active' in p

    def test_create_game_all_players_active_by_default(self, client):
        data = _create_game(client)
        assert all(p['is_active'] is True for p in data['players'])

    def test_create_game_players_names_match(self, client):
        data = _create_game(client, ['Alice', 'Bob', 'Charlie'])
        names = {p['name'] for p in data['players']}
        assert names == {'Alice', 'Bob', 'Charlie'}

    def test_create_game_still_has_player_names(self, client):
        """Backward compat: player_names still present."""
        data = _create_game(client)
        assert 'player_names' in data
        assert set(data['player_names']) == {'Alice', 'Bob'}


class TestPlayersFieldInGetResponse:
    """GET /games/{id} response includes the new players field."""

    def test_get_game_has_players_field(self, client):
        created = _create_game(client)
        resp = client.get(f'/games/{created["game_id"]}')
        data = resp.json()
        assert 'players' in data

    def test_get_game_players_have_correct_shape(self, client):
        created = _create_game(client)
        resp = client.get(f'/games/{created["game_id"]}')
        data = resp.json()
        for p in data['players']:
            assert 'name' in p
            assert 'is_active' in p

    def test_get_game_reflects_deactivated_player(self, client):
        """After deactivating a player, GET returns is_active=False."""
        created = _create_game(client)
        game_id = created['game_id']

        # Deactivate Alice
        client.patch(
            f'/games/{game_id}/players/Alice/status',
            json={'is_active': False},
        )

        resp = client.get(f'/games/{game_id}')
        data = resp.json()
        players_map = {p['name']: p['is_active'] for p in data['players']}
        assert players_map['Alice'] is False
        assert players_map['Bob'] is True

    def test_get_game_still_has_player_names(self, client):
        """Backward compat: player_names still present in GET."""
        created = _create_game(client)
        resp = client.get(f'/games/{created["game_id"]}')
        data = resp.json()
        assert 'player_names' in data


class TestPlayersFieldInCompleteResponse:
    """PATCH /games/{id}/complete response includes the new players field."""

    def test_complete_game_has_players_field(self, client):
        created = _create_game(client)
        resp = client.patch(
            f'/games/{created["game_id"]}/complete',
            json={'winners': []},
        )
        data = resp.json()
        assert 'players' in data
        assert all('name' in p and 'is_active' in p for p in data['players'])


class TestPlayersFieldInReactivateResponse:
    """PATCH /games/{id}/reactivate response includes the new players field."""

    def test_reactivate_game_has_players_field(self, client):
        created = _create_game(client)
        # Complete, then reactivate
        client.patch(
            f'/games/{created["game_id"]}/complete',
            json={'winners': []},
        )
        resp = client.patch(f'/games/{created["game_id"]}/reactivate')
        data = resp.json()
        assert 'players' in data
        assert all('name' in p and 'is_active' in p for p in data['players'])
