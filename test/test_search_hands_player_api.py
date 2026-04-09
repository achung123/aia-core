"""Tests for T-036: Search Hands by Player endpoint (GET /hands?player={name})."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, StaticPool
from sqlalchemy.orm import sessionmaker

from app.database.database_models import Base as LegacyBase
from app.database.models import Base as ModelsBase
from app.database.session import get_db
from app.main import app

DATABASE_URL = 'sqlite:///:memory:'
engine = create_engine(
    DATABASE_URL, connect_args={'check_same_thread': False}, poolclass=StaticPool
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True)
def setup_db():
    LegacyBase.metadata.create_all(bind=engine)
    ModelsBase.metadata.create_all(bind=engine)
    yield
    ModelsBase.metadata.drop_all(bind=engine)
    LegacyBase.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def game_with_players(client):
    """Create a game session with Alice and Bob; return game_id."""
    resp = client.post(
        '/games',
        json={'game_date': '2026-03-11', 'player_names': ['Alice', 'Bob']},
    )
    assert resp.status_code == 201
    return resp.json()['game_id']


HAND_PAYLOAD = {
    'flop_1': {'rank': 'A', 'suit': 'S'},
    'flop_2': {'rank': 'K', 'suit': 'H'},
    'flop_3': {'rank': '2', 'suit': 'D'},
    'turn': {'rank': '5', 'suit': 'C'},
    'river': {'rank': 'J', 'suit': 'D'},
    'player_entries': [
        {
            'player_name': 'Alice',
            'card_1': {'rank': '7', 'suit': 'S'},
            'card_2': {'rank': '8', 'suit': 'S'},
            'result': 'won',
            'profit_loss': 50.0,
        },
        {
            'player_name': 'Bob',
            'card_1': {'rank': '9', 'suit': 'H'},
            'card_2': {'rank': '10', 'suit': 'H'},
            'result': 'lost',
            'profit_loss': -50.0,
        },
    ],
}


@pytest.fixture
def recorded_hand(client, game_with_players):
    """Record one hand; return response JSON."""
    resp = client.post(f'/games/{game_with_players}/hands', json=HAND_PAYLOAD)
    assert resp.status_code == 201
    return resp.json()


def _build_hand(c1r, c2r, bob_c1r='J', bob_c2r='Q'):
    return {
        'flop_1': {'rank': 'A', 'suit': 'S'},
        'flop_2': {'rank': 'K', 'suit': 'H'},
        'flop_3': {'rank': '2', 'suit': 'D'},
        'player_entries': [
            {
                'player_name': 'Alice',
                'card_1': {'rank': c1r, 'suit': 'C'},
                'card_2': {'rank': c2r, 'suit': 'D'},
            },
            {
                'player_name': 'Bob',
                'card_1': {'rank': bob_c1r, 'suit': 'S'},
                'card_2': {'rank': bob_c2r, 'suit': 'S'},
            },
        ],
    }


class TestSearchHandsByPlayer:
    """GET /hands?player={name} — search hands by player participation."""

    def test_search_returns_200(self, client, game_with_players, recorded_hand):
        response = client.get('/hands', params={'player': 'Alice'})
        assert response.status_code == 200

    def test_search_returns_paginated_shape(
        self, client, game_with_players, recorded_hand
    ):
        response = client.get('/hands', params={'player': 'Alice'})
        data = response.json()
        assert 'total' in data
        assert 'page' in data
        assert 'per_page' in data
        assert 'results' in data

    def test_search_default_pagination_values(
        self, client, game_with_players, recorded_hand
    ):
        response = client.get('/hands', params={'player': 'Alice'})
        data = response.json()
        assert data['page'] == 1
        assert data['per_page'] == 50

    def test_search_filters_by_player(self, client, game_with_players, recorded_hand):
        response = client.get('/hands', params={'player': 'Alice'})
        data = response.json()
        assert data['total'] == 1
        assert len(data['results']) == 1

    def test_search_result_includes_community_cards(
        self, client, game_with_players, recorded_hand
    ):
        response = client.get('/hands', params={'player': 'Alice'})
        result = response.json()['results'][0]
        assert result['flop_1'] == 'AS'
        assert result['flop_2'] == 'KH'
        assert result['flop_3'] == '2D'
        assert result['turn'] == '5C'
        assert result['river'] == 'JD'

    def test_search_result_includes_player_hole_cards(
        self, client, game_with_players, recorded_hand
    ):
        response = client.get('/hands', params={'player': 'Alice'})
        result = response.json()['results'][0]
        assert 'player_hand' in result
        ph = result['player_hand']
        assert ph['card_1'] == '7S'
        assert ph['card_2'] == '8S'

    def test_search_result_includes_result_field(
        self, client, game_with_players, recorded_hand
    ):
        response = client.get('/hands', params={'player': 'Alice'})
        ph = response.json()['results'][0]['player_hand']
        assert ph['result'] == 'won'

    def test_search_result_includes_game_date(
        self, client, game_with_players, recorded_hand
    ):
        response = client.get('/hands', params={'player': 'Alice'})
        result = response.json()['results'][0]
        assert 'game_date' in result
        assert result['game_date'] == '2026-03-11'

    def test_search_result_includes_hand_number(
        self, client, game_with_players, recorded_hand
    ):
        response = client.get('/hands', params={'player': 'Alice'})
        result = response.json()['results'][0]
        assert 'hand_number' in result
        assert result['hand_number'] == 1

    def test_search_result_includes_game_id(
        self, client, game_with_players, recorded_hand
    ):
        response = client.get('/hands', params={'player': 'Alice'})
        result = response.json()['results'][0]
        assert 'game_id' in result
        assert result['game_id'] == game_with_players

    def test_search_returns_only_players_own_hole_cards(
        self, client, game_with_players, recorded_hand
    ):
        """Alice's result has Alice's cards; Bob's result has Bob's cards."""
        resp_alice = client.get('/hands', params={'player': 'Alice'})
        ph_alice = resp_alice.json()['results'][0]['player_hand']
        assert ph_alice['card_1'] == '7S'
        assert ph_alice['card_2'] == '8S'

        resp_bob = client.get('/hands', params={'player': 'Bob'})
        ph_bob = resp_bob.json()['results'][0]['player_hand']
        assert ph_bob['card_1'] == '9H'
        assert ph_bob['card_2'] == '10H'

    def test_search_empty_results_for_nonexistent_player(
        self, client, game_with_players, recorded_hand
    ):
        response = client.get('/hands', params={'player': 'NonExistent'})
        data = response.json()
        assert data['total'] == 0
        assert data['results'] == []

    def test_search_no_params_returns_200(self, client):
        """GET /hands with no params is valid — all filters are optional."""
        response = client.get('/hands')
        assert response.status_code == 200

    def test_search_case_insensitive_player_name(
        self, client, game_with_players, recorded_hand
    ):
        response = client.get('/hands', params={'player': 'alice'})
        data = response.json()
        assert data['total'] == 1

    def test_search_pagination_first_page(self, client, game_with_players):
        """First page returns per_page results; total reflects all matching."""
        for c1r, c2r in [('3', '4'), ('5', '6'), ('7', '8')]:
            resp = client.post(
                f'/games/{game_with_players}/hands', json=_build_hand(c1r, c2r)
            )
            assert resp.status_code == 201

        response = client.get(
            '/hands', params={'player': 'Alice', 'page': 1, 'per_page': 2}
        )
        data = response.json()
        assert data['total'] == 3
        assert len(data['results']) == 2
        assert data['page'] == 1
        assert data['per_page'] == 2

    def test_search_pagination_second_page(self, client, game_with_players):
        """Second page returns remaining results."""
        for c1r, c2r in [('3', '4'), ('5', '6'), ('7', '8')]:
            resp = client.post(
                f'/games/{game_with_players}/hands', json=_build_hand(c1r, c2r)
            )
            assert resp.status_code == 201

        response = client.get(
            '/hands', params={'player': 'Alice', 'page': 2, 'per_page': 2}
        )
        data = response.json()
        assert data['total'] == 3
        assert len(data['results']) == 1
        assert data['page'] == 2

    def test_search_only_counts_hands_player_participated_in(self, client):
        """Only hands where the player has hole cards are returned."""
        # Create two separate games; Alice only plays in game 1
        resp1 = client.post(
            '/games',
            json={'game_date': '2026-03-11', 'player_names': ['Alice', 'Bob']},
        )
        game1_id = resp1.json()['game_id']

        resp2 = client.post(
            '/games',
            json={'game_date': '2026-03-12', 'player_names': ['Charlie', 'Bob']},
        )
        game2_id = resp2.json()['game_id']

        # Record a hand in game1 (Alice plays)
        client.post(f'/games/{game1_id}/hands', json=HAND_PAYLOAD)

        # Record a hand in game2 (Alice not in this game)
        hand_no_alice = {
            'flop_1': {'rank': '3', 'suit': 'C'},
            'flop_2': {'rank': '4', 'suit': 'C'},
            'flop_3': {'rank': '5', 'suit': 'C'},
            'player_entries': [
                {
                    'player_name': 'Charlie',
                    'card_1': {'rank': '6', 'suit': 'C'},
                    'card_2': {'rank': '7', 'suit': 'C'},
                },
                {
                    'player_name': 'Bob',
                    'card_1': {'rank': '8', 'suit': 'D'},
                    'card_2': {'rank': '9', 'suit': 'D'},
                },
            ],
        }
        client.post(f'/games/{game2_id}/hands', json=hand_no_alice)

        response = client.get('/hands', params={'player': 'Alice'})
        data = response.json()
        assert data['total'] == 1
