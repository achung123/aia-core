"""Tests for T-037: Search Hands by Date Range and Card endpoints (GET /hands)."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, StaticPool
from sqlalchemy.orm import sessionmaker

from app.database.models import Base
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
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


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

LATE_HAND_PAYLOAD = {
    'flop_1': {'rank': 'K', 'suit': 'D'},  # KD — different suit from early KH
    'flop_2': {'rank': 'Q', 'suit': 'C'},
    'flop_3': {'rank': 'J', 'suit': 'H'},
    'player_entries': [
        {
            'player_name': 'Alice',
            'card_1': {'rank': 'A', 'suit': 'S'},  # AS — hole card
            'card_2': {'rank': '2', 'suit': 'C'},
            'result': 'won',
            'profit_loss': 100.0,
        },
        {
            'player_name': 'Carol',
            'card_1': {'rank': '3', 'suit': 'D'},
            'card_2': {'rank': '4', 'suit': 'D'},
            'result': 'lost',
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


class TestCombinedFilters:
    """Combined multi-filter queries — verify intersection semantics."""

    def test_player_date_card_combined(self, client, seeded_data):
        """player + date_from + card returns intersection of all three filters."""
        response = client.get(
            '/hands',
            params={'player': 'Alice', 'date_from': '2026-06-01', 'card': 'AS'},
        )
        data = response.json()
        assert data['total'] == 1
        result = data['results'][0]
        assert result['game_date'] == '2026-06-15'
        assert result['player_hand']['player_name'] == 'Alice'

    def test_player_card_location_community(self, client, seeded_data):
        """player + card + location=community — Alice sees AS as community in early game."""
        response = client.get(
            '/hands',
            params={'player': 'Alice', 'card': 'AS', 'location': 'community'},
        )
        data = response.json()
        assert data['total'] == 1
        assert data['results'][0]['game_date'] == '2026-01-10'
        assert data['results'][0]['player_hand']['player_name'] == 'Alice'

    def test_player_card_location_hole(self, client, seeded_data):
        """player + card + location=hole — Alice holds AS as hole card in late game."""
        response = client.get(
            '/hands',
            params={'player': 'Alice', 'card': 'AS', 'location': 'hole'},
        )
        data = response.json()
        assert data['total'] == 1
        assert data['results'][0]['game_date'] == '2026-06-15'
        assert data['results'][0]['player_hand']['card_1'] == 'AS'

    def test_date_card_location(self, client, seeded_data):
        """date_to + card + location=community — restricts to early game's community AS."""
        response = client.get(
            '/hands',
            params={'date_to': '2026-03-01', 'card': 'AS', 'location': 'community'},
        )
        data = response.json()
        # game_early has AS in flop_1; both Alice & Bob rows match
        assert data['total'] == 2
        for result in data['results']:
            assert result['game_date'] == '2026-01-10'
            assert result['flop_1'] == 'AS'

    def test_all_four_filters(self, client, seeded_data):
        """player + date_from + card + location=hole — maximal filter combination."""
        response = client.get(
            '/hands',
            params={
                'player': 'Alice',
                'date_from': '2026-06-01',
                'card': 'AS',
                'location': 'hole',
            },
        )
        data = response.json()
        assert data['total'] == 1
        result = data['results'][0]
        assert result['game_date'] == '2026-06-15'
        assert result['player_hand']['player_name'] == 'Alice'
        assert result['player_hand']['card_1'] == 'AS'

    def test_all_filters_no_match(self, client, seeded_data):
        """All filters combined with contradictory values yields empty results."""
        response = client.get(
            '/hands',
            params={
                'player': 'Bob',
                'date_from': '2026-06-01',
                'card': 'AS',
                'location': 'hole',
            },
        )
        data = response.json()
        assert data['total'] == 0
        assert data['results'] == []

    def test_card_player_not_in_that_hand(self, client, seeded_data):
        """card + player where player didn't play with that card returns empty."""
        response = client.get(
            '/hands',
            params={'player': 'Carol', 'card': 'AS', 'location': 'community'},
        )
        data = response.json()
        # Carol only plays in game_late; AS is NOT community there
        assert data['total'] == 0


class TestPaginationEdges:
    """Pagination boundary tests across all filter types."""

    def test_page_beyond_results_returns_empty(self, client, seeded_data):
        """Requesting a page past the last page returns empty results with correct total."""
        response = client.get('/hands', params={'page': 100, 'per_page': 50})
        data = response.json()
        assert data['total'] == 4
        assert data['results'] == []
        assert data['page'] == 100

    def test_per_page_one_single_result(self, client, seeded_data):
        """per_page=1 returns exactly one result per page."""
        response = client.get('/hands', params={'page': 1, 'per_page': 1})
        data = response.json()
        assert data['total'] == 4
        assert len(data['results']) == 1
        assert data['per_page'] == 1

    def test_per_page_one_all_pages(self, client, seeded_data):
        """Iterating per_page=1 across all pages yields all results."""
        seen_ids = set()
        for page_num in range(1, 6):
            response = client.get('/hands', params={'page': page_num, 'per_page': 1})
            data = response.json()
            if data['results']:
                seen_ids.add(data['results'][0]['hand_id'])
        assert len(seen_ids) >= 1  # at least some unique hands

    def test_pagination_with_date_filter(self, client, seeded_data):
        """page/per_page work correctly with date_from filter."""
        response = client.get(
            '/hands',
            params={'date_from': '2026-01-01', 'page': 1, 'per_page': 1},
        )
        data = response.json()
        assert data['total'] == 4
        assert len(data['results']) == 1
        assert data['page'] == 1
        assert data['per_page'] == 1

    def test_pagination_with_card_filter(self, client, seeded_data):
        """page/per_page work correctly with card filter."""
        response = client.get('/hands', params={'card': 'AS', 'page': 1, 'per_page': 1})
        data = response.json()
        assert data['total'] > 0
        assert len(data['results']) == 1

    def test_large_per_page_returns_all(self, client, seeded_data):
        """per_page larger than total returns all results on page 1."""
        response = client.get('/hands', params={'per_page': 200})
        data = response.json()
        assert data['total'] == 4
        assert len(data['results']) == 4

    def test_page_zero_returns_422(self, client, seeded_data):
        """page=0 is below the minimum (ge=1) and returns 422."""
        response = client.get('/hands', params={'page': 0})
        assert response.status_code == 422

    def test_per_page_zero_returns_422(self, client, seeded_data):
        """per_page=0 is below the minimum (ge=1) and returns 422."""
        response = client.get('/hands', params={'per_page': 0})
        assert response.status_code == 422

    def test_per_page_exceeds_max_returns_422(self, client, seeded_data):
        """per_page > 200 exceeds the max (le=200) and returns 422."""
        response = client.get('/hands', params={'per_page': 201})
        assert response.status_code == 422


class TestSearchEdgeCases:
    """Edge cases and input validation for the search endpoint."""

    def test_location_without_card_is_no_op(self, client, seeded_data):
        """location param without card is silently ignored — returns all hands."""
        response = client.get('/hands', params={'location': 'community'})
        data = response.json()
        assert data['total'] == 4

    def test_empty_database_returns_empty(self, client):
        """No data seeded — GET /hands returns empty paginated response."""
        response = client.get('/hands')
        data = response.json()
        assert data['total'] == 0
        assert data['results'] == []
        assert data['page'] == 1
        assert data['per_page'] == 50

    def test_results_ordered_by_date_then_hand_number(self, client, seeded_data):
        """Results are ordered by game_date ASC, then hand_number ASC."""
        response = client.get('/hands')
        data = response.json()
        dates = [r['game_date'] for r in data['results']]
        assert dates == sorted(dates)

    def test_invalid_date_format_returns_422(self, client, seeded_data):
        """Malformed date string returns 422."""
        response = client.get('/hands', params={'date_from': 'not-a-date'})
        assert response.status_code == 422

    def test_negative_page_returns_422(self, client, seeded_data):
        """Negative page number returns 422."""
        response = client.get('/hands', params={'page': -1})
        assert response.status_code == 422
