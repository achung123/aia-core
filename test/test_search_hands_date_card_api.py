"""Tests for T-037: Search Hands by Date Range and Card endpoints (GET /hands)."""

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


def _create_game(client, game_date, player_names):
    """Create a game session and return game_id."""
    resp = client.post(
        '/games',
        json={'game_date': game_date, 'player_names': player_names},
    )
    assert resp.status_code == 201
    return resp.json()['game_id']


def _record_hand(client, game_id, payload):
    """Record a hand with the given payload; assert 201 and return response JSON."""
    resp = client.post(f'/games/{game_id}/hands', json=payload)
    assert resp.status_code == 201, resp.json()
    return resp.json()


# Hand payloads — all cards within each hand are unique.
# AS appears as: community card in EARLY_HAND, hole card (Alice) in LATE_HAND.
EARLY_HAND_PAYLOAD = {
    'flop_1': {'rank': 'A', 'suit': 'S'},  # AS — community
    'flop_2': {'rank': 'K', 'suit': 'H'},
    'flop_3': {'rank': '2', 'suit': 'D'},
    'player_entries': [
        {
            'player_name': 'Alice',
            'card_1': {'rank': '7', 'suit': 'S'},
            'card_2': {'rank': '8', 'suit': 'S'},
            'result': 'win',
            'profit_loss': 50.0,
        },
        {
            'player_name': 'Bob',
            'card_1': {'rank': '9', 'suit': 'H'},
            'card_2': {'rank': '10', 'suit': 'H'},
            'result': 'loss',
            'profit_loss': -50.0,
        },
    ],
}

LATE_HAND_PAYLOAD = {
    'flop_1': {'rank': 'K', 'suit': 'D'},  # KD — different suit from early KH
    'flop_2': {'rank': 'Q', 'suit': 'C'},
    'flop_3': {'rank': 'J', 'suit': 'H'},
    'player_entries': [
        {
            'player_name': 'Alice',
            'card_1': {'rank': 'A', 'suit': 'S'},  # AS — hole card
            'card_2': {'rank': '2', 'suit': 'C'},
            'result': 'win',
            'profit_loss': 100.0,
        },
        {
            'player_name': 'Carol',
            'card_1': {'rank': '3', 'suit': 'D'},
            'card_2': {'rank': '4', 'suit': 'D'},
            'result': 'loss',
            'profit_loss': -100.0,
        },
    ],
}


@pytest.fixture
def seeded_data(client):
    """
    Seed two game sessions with hands containing specific cards.

    game_early (2026-01-10):
      - Hand 1: flop_1=AS (community), Alice: 7S/8S, Bob: 9H/10H

    game_late (2026-06-15):
      - Hand 1: flop_1=KD (community), Alice: AS/2C (hole), Carol: 3D/4D
    """
    game_early_id = _create_game(client, '2026-01-10', ['Alice', 'Bob'])
    game_late_id = _create_game(client, '2026-06-15', ['Alice', 'Carol'])

    _record_hand(client, game_early_id, EARLY_HAND_PAYLOAD)
    _record_hand(client, game_late_id, LATE_HAND_PAYLOAD)

    return {'game_early_id': game_early_id, 'game_late_id': game_late_id}


class TestSearchHandsByDateRange:
    """GET /hands?date_from=...&date_to=... — filter hands by date range."""

    def test_date_from_returns_200(self, client, seeded_data):
        response = client.get('/hands', params={'date_from': '2026-03-01'})
        assert response.status_code == 200

    def test_date_from_filters_correctly(self, client, seeded_data):
        """date_from=2026-03-01 should only return game_late (2026-06-15) hands."""
        response = client.get('/hands', params={'date_from': '2026-03-01'})
        data = response.json()
        game_dates = {r['game_date'] for r in data['results']}
        assert '2026-01-10' not in game_dates
        assert '2026-06-15' in game_dates

    def test_date_to_filters_correctly(self, client, seeded_data):
        """date_to=2026-03-01 should only return game_early (2026-01-10) hands."""
        response = client.get('/hands', params={'date_to': '2026-03-01'})
        data = response.json()
        game_dates = {r['game_date'] for r in data['results']}
        assert '2026-01-10' in game_dates
        assert '2026-06-15' not in game_dates

    def test_date_range_returns_only_in_range(self, client, seeded_data):
        """date_from + date_to returns only hands within the range."""
        response = client.get(
            '/hands', params={'date_from': '2026-01-01', 'date_to': '2026-01-31'}
        )
        data = response.json()
        game_dates = {r['game_date'] for r in data['results']}
        assert '2026-01-10' in game_dates
        assert '2026-06-15' not in game_dates

    def test_date_range_no_results(self, client, seeded_data):
        """Date range with no matching hands returns empty results."""
        response = client.get(
            '/hands', params={'date_from': '2026-03-01', 'date_to': '2026-05-01'}
        )
        data = response.json()
        assert data['total'] == 0
        assert data['results'] == []

    def test_date_inclusive_boundary_from(self, client, seeded_data):
        """date_from is inclusive — exact date is included."""
        response = client.get('/hands', params={'date_from': '2026-01-10'})
        data = response.json()
        game_dates = {r['game_date'] for r in data['results']}
        assert '2026-01-10' in game_dates

    def test_date_inclusive_boundary_to(self, client, seeded_data):
        """date_to is inclusive — exact date is included."""
        response = client.get('/hands', params={'date_to': '2026-01-10'})
        data = response.json()
        game_dates = {r['game_date'] for r in data['results']}
        assert '2026-01-10' in game_dates

    def test_date_range_combined_with_player(self, client, seeded_data):
        """date_from + player filters to intersection."""
        response = client.get(
            '/hands',
            params={'date_from': '2026-03-01', 'player': 'Alice'},
        )
        data = response.json()
        # Only Alice's late-game hands should appear
        for result in data['results']:
            assert result['game_date'] == '2026-06-15'
            assert result['player_hand']['player_name'] == 'Alice'

    def test_date_range_response_has_pagination_keys(self, client, seeded_data):
        response = client.get('/hands', params={'date_from': '2026-01-01'})
        data = response.json()
        assert 'total' in data
        assert 'page' in data
        assert 'per_page' in data
        assert 'results' in data

    def test_date_from_total_count(self, client, seeded_data):
        """date_from=2026-06-15 should yield 2 rows (one per player in game_late)."""
        response = client.get('/hands', params={'date_from': '2026-06-15'})
        data = response.json()
        assert data['total'] == 2


class TestSearchHandsByCard:
    """GET /hands?card={rank}{suit} — filter hands by card appearance."""

    def test_card_filter_returns_200(self, client, seeded_data):
        response = client.get('/hands', params={'card': 'AS'})
        assert response.status_code == 200

    def test_card_community_match(self, client, seeded_data):
        """AS in flop_1 of game_early — should appear in results."""
        response = client.get('/hands', params={'card': 'AS'})
        data = response.json()
        assert data['total'] > 0

    def test_card_community_results_have_correct_game(self, client, seeded_data):
        """AS community card is only in game_early (2026-01-10)."""
        # AS appears: community (2026-01-10 hand) + Alice's hole card (2026-06-15)
        response = client.get('/hands', params={'card': 'AS'})
        data = response.json()
        game_dates = {r['game_date'] for r in data['results']}
        assert '2026-01-10' in game_dates
        assert '2026-06-15' in game_dates

    def test_card_location_community_only(self, client, seeded_data):
        """location=community: AS is flop_1 in game_early, not community in game_late."""
        response = client.get('/hands', params={'card': 'AS', 'location': 'community'})
        data = response.json()
        game_dates = {r['game_date'] for r in data['results']}
        assert '2026-01-10' in game_dates
        assert '2026-06-15' not in game_dates

    def test_card_location_hole_only(self, client, seeded_data):
        """location=hole: AS is Alice's hole card in game_late, not in game_early."""
        response = client.get('/hands', params={'card': 'AS', 'location': 'hole'})
        data = response.json()
        game_dates = {r['game_date'] for r in data['results']}
        assert '2026-06-15' in game_dates
        assert '2026-01-10' not in game_dates

    def test_card_location_hole_returns_correct_player(self, client, seeded_data):
        """location=hole: only Alice's result appears (she holds AS in game_late)."""
        response = client.get('/hands', params={'card': 'AS', 'location': 'hole'})
        data = response.json()
        assert data['total'] == 1
        assert data['results'][0]['player_hand']['player_name'] == 'Alice'
        assert data['results'][0]['player_hand']['card_1'] == 'AS'

    def test_card_no_results(self, client, seeded_data):
        """Card not in any hand returns empty results."""
        response = client.get('/hands', params={'card': '5H'})
        data = response.json()
        assert data['total'] == 0
        assert data['results'] == []

    def test_card_filter_response_shape(self, client, seeded_data):
        response = client.get('/hands', params={'card': 'AS'})
        data = response.json()
        assert 'total' in data
        assert 'page' in data
        assert 'per_page' in data
        assert 'results' in data

    def test_card_result_includes_community_cards(self, client, seeded_data):
        response = client.get('/hands', params={'card': 'AS', 'location': 'community'})
        result = response.json()['results'][0]
        assert 'flop_1' in result
        assert result['flop_1'] == 'AS'

    def test_card_result_includes_player_hand(self, client, seeded_data):
        response = client.get('/hands', params={'card': 'AS', 'location': 'community'})
        result = response.json()['results'][0]
        assert 'player_hand' in result

    def test_card_combined_with_date_range(self, client, seeded_data):
        """card=AS + date_from=2026-06-01 returns only the hole-card match in game_late."""
        response = client.get(
            '/hands', params={'card': 'AS', 'date_from': '2026-06-01'}
        )
        data = response.json()
        game_dates = {r['game_date'] for r in data['results']}
        assert '2026-06-15' in game_dates
        assert '2026-01-10' not in game_dates

    def test_card_combined_with_player(self, client, seeded_data):
        """card=AS + player=Alice returns Alice's appearances with AS."""
        response = client.get('/hands', params={'card': 'AS', 'player': 'Alice'})
        data = response.json()
        assert data['total'] > 0
        for result in data['results']:
            assert result['player_hand']['player_name'] == 'Alice'

    def test_card_invalid_location_returns_422(self, client, seeded_data):
        """Invalid location value should return 422."""
        response = client.get('/hands', params={'card': 'AS', 'location': 'invalid'})
        assert response.status_code == 422


class TestSearchHandsNoFilter:
    """GET /hands with no filters returns all hands paginated."""

    def test_no_filter_returns_200(self, client, seeded_data):
        response = client.get('/hands')
        assert response.status_code == 200

    def test_no_filter_returns_all_hands(self, client, seeded_data):
        """With no filters, all 4 player_hand rows should be returned."""
        response = client.get('/hands')
        data = response.json()
        assert data['total'] == 4

    def test_no_filter_pagination_defaults(self, client, seeded_data):
        response = client.get('/hands')
        data = response.json()
        assert data['page'] == 1
        assert data['per_page'] == 50
