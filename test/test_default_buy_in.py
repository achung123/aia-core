"""Tests for default_buy_in on game session creation."""

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def _seed_players(client: TestClient):
    client.post('/players', json={'name': 'Alice'})
    client.post('/players', json={'name': 'Bob'})


class TestDefaultBuyIn:
    def test_create_game_with_default_buy_in(self, client: TestClient, _seed_players):  # noqa: F811
        resp = client.post('/games', json={
            'game_date': '2026-04-10',
            'player_names': ['Alice', 'Bob'],
            'default_buy_in': 50.0,
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data['default_buy_in'] == 50.0
        # All players should have the default buy-in
        for p in data['players']:
            assert p['buy_in'] == 50.0

    def test_create_game_without_default_buy_in(self, client: TestClient, _seed_players):  # noqa: F811
        resp = client.post('/games', json={
            'game_date': '2026-04-10',
            'player_names': ['Alice', 'Bob'],
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data['default_buy_in'] is None
        for p in data['players']:
            assert p['buy_in'] is None

    def test_per_player_buy_in_overrides_default(self, client: TestClient, _seed_players):  # noqa: F811
        resp = client.post('/games', json={
            'game_date': '2026-04-10',
            'player_names': ['Alice', 'Bob'],
            'default_buy_in': 50.0,
            'player_buy_ins': {'Alice': 100.0},
        })
        assert resp.status_code == 201
        data = resp.json()
        players = {p['name']: p for p in data['players']}
        assert players['Alice']['buy_in'] == 100.0
        assert players['Bob']['buy_in'] == 50.0

    def test_get_game_returns_default_buy_in(self, client: TestClient, _seed_players):  # noqa: F811
        create_resp = client.post('/games', json={
            'game_date': '2026-04-10',
            'player_names': ['Alice', 'Bob'],
            'default_buy_in': 25.0,
        })
        game_id = create_resp.json()['game_id']
        resp = client.get(f'/games/{game_id}')
        assert resp.status_code == 200
        assert resp.json()['default_buy_in'] == 25.0

    def test_rebuy_endpoint_works_with_default_buy_in(self, client: TestClient, _seed_players):  # noqa: F811
        create_resp = client.post('/games', json={
            'game_date': '2026-04-10',
            'player_names': ['Alice', 'Bob'],
            'default_buy_in': 50.0,
        })
        game_id = create_resp.json()['game_id']
        # Rebuy for Alice
        rebuy_resp = client.post(f'/games/{game_id}/players/Alice/rebuys', json={'amount': 50.0})
        assert rebuy_resp.status_code == 201
        assert rebuy_resp.json()['amount'] == 50.0
        # Verify rebuy stats reflect
        game_resp = client.get(f'/games/{game_id}')
        players = {p['name']: p for p in game_resp.json()['players']}
        assert players['Alice']['rebuy_count'] == 1
        assert players['Alice']['total_rebuys'] == 50.0
