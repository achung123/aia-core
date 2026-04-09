"""Tests for T-033: Leaderboard endpoint (GET /stats/leaderboard)."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import StaticPool, create_engine
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
def seeded_client(client):
    """
    Seed two players with hands and results.

    Alice: 3 hands, wins=2, folds=1
      total_profit_loss = 30 + 0 + 50 = 80.0
      win_rate = 2/3 * 100 = 66.67%
      hands_played = 3

    Bob: 3 hands, wins=1, losses=2
      total_profit_loss = -30 + 10 + (-50) = -70.0
      win_rate = 1/3 * 100 = 33.33%
      hands_played = 3

    Charlie: 1 hand, wins=1
      total_profit_loss = 100.0
      win_rate = 100.0%
      hands_played = 1
    """
    # Session 1: Alice, Bob
    g1 = client.post(
        '/games', json={'game_date': '2026-01-01', 'player_names': ['Alice', 'Bob']}
    )
    assert g1.status_code == 201
    gid1 = g1.json()['game_id']

    h1 = client.post(
        f'/games/{gid1}/hands',
        json={
            'flop_1': {'rank': 'A', 'suit': 'S'},
            'flop_2': {'rank': 'K', 'suit': 'H'},
            'flop_3': {'rank': '2', 'suit': 'D'},
            'player_entries': [
                {
                    'player_name': 'Alice',
                    'card_1': {'rank': '7', 'suit': 'S'},
                    'card_2': {'rank': '8', 'suit': 'S'},
                },
                {
                    'player_name': 'Bob',
                    'card_1': {'rank': '9', 'suit': 'H'},
                    'card_2': {'rank': '10', 'suit': 'H'},
                },
            ],
        },
    )
    assert h1.status_code == 201
    hn1 = h1.json()['hand_number']
    r1 = client.patch(
        f'/games/{gid1}/hands/{hn1}/results',
        json=[
            {'player_name': 'Alice', 'result': 'won', 'profit_loss': 30.0},
            {'player_name': 'Bob', 'result': 'lost', 'profit_loss': -30.0},
        ],
    )
    assert r1.status_code == 200

    h2 = client.post(
        f'/games/{gid1}/hands',
        json={
            'flop_1': {'rank': '3', 'suit': 'S'},
            'flop_2': {'rank': '4', 'suit': 'H'},
            'flop_3': {'rank': '5', 'suit': 'D'},
            'turn': {'rank': '6', 'suit': 'C'},
            'player_entries': [
                {
                    'player_name': 'Alice',
                    'card_1': {'rank': 'J', 'suit': 'S'},
                    'card_2': {'rank': 'Q', 'suit': 'S'},
                },
                {
                    'player_name': 'Bob',
                    'card_1': {'rank': 'K', 'suit': 'D'},
                    'card_2': {'rank': 'A', 'suit': 'D'},
                },
            ],
        },
    )
    assert h2.status_code == 201
    hn2 = h2.json()['hand_number']
    r2 = client.patch(
        f'/games/{gid1}/hands/{hn2}/results',
        json=[
            {'player_name': 'Alice', 'result': 'folded', 'profit_loss': 0.0},
            {'player_name': 'Bob', 'result': 'won', 'profit_loss': 10.0},
        ],
    )
    assert r2.status_code == 200

    # Session 2: Alice, Bob
    g2 = client.post(
        '/games', json={'game_date': '2026-01-08', 'player_names': ['Alice', 'Bob']}
    )
    assert g2.status_code == 201
    gid2 = g2.json()['game_id']

    h3 = client.post(
        f'/games/{gid2}/hands',
        json={
            'flop_1': {'rank': '2', 'suit': 'S'},
            'flop_2': {'rank': '3', 'suit': 'H'},
            'flop_3': {'rank': '4', 'suit': 'D'},
            'turn': {'rank': '5', 'suit': 'C'},
            'river': {'rank': '6', 'suit': 'S'},
            'player_entries': [
                {
                    'player_name': 'Alice',
                    'card_1': {'rank': '9', 'suit': 'S'},
                    'card_2': {'rank': '10', 'suit': 'S'},
                },
                {
                    'player_name': 'Bob',
                    'card_1': {'rank': 'J', 'suit': 'H'},
                    'card_2': {'rank': 'Q', 'suit': 'H'},
                },
            ],
        },
    )
    assert h3.status_code == 201
    hn3 = h3.json()['hand_number']
    r3 = client.patch(
        f'/games/{gid2}/hands/{hn3}/results',
        json=[
            {'player_name': 'Alice', 'result': 'won', 'profit_loss': 50.0},
            {'player_name': 'Bob', 'result': 'lost', 'profit_loss': -50.0},
        ],
    )
    assert r3.status_code == 200

    # Session 3: Charlie (1 hand, big win)
    g3 = client.post(
        '/games', json={'game_date': '2026-01-15', 'player_names': ['Charlie']}
    )
    assert g3.status_code == 201
    gid3 = g3.json()['game_id']

    h4 = client.post(
        f'/games/{gid3}/hands',
        json={
            'flop_1': {'rank': '7', 'suit': 'S'},
            'flop_2': {'rank': '8', 'suit': 'H'},
            'flop_3': {'rank': '9', 'suit': 'D'},
            'player_entries': [
                {
                    'player_name': 'Charlie',
                    'card_1': {'rank': 'A', 'suit': 'C'},
                    'card_2': {'rank': 'K', 'suit': 'C'},
                },
            ],
        },
    )
    assert h4.status_code == 201
    hn4 = h4.json()['hand_number']
    r4 = client.patch(
        f'/games/{gid3}/hands/{hn4}/results',
        json=[
            {'player_name': 'Charlie', 'result': 'won', 'profit_loss': 100.0},
        ],
    )
    assert r4.status_code == 200

    return client


class TestLeaderboardEmpty:
    """Leaderboard with no players returns empty list."""

    def test_empty_leaderboard_returns_200(self, client):
        resp = client.get('/stats/leaderboard')
        assert resp.status_code == 200
        assert resp.json() == []


class TestLeaderboardDefaultSort:
    """AC-1: Default sort by total_profit_loss descending."""

    def test_returns_200(self, seeded_client):
        resp = seeded_client.get('/stats/leaderboard')
        assert resp.status_code == 200

    def test_returns_list(self, seeded_client):
        resp = seeded_client.get('/stats/leaderboard')
        assert isinstance(resp.json(), list)

    def test_all_players_included(self, seeded_client):
        resp = seeded_client.get('/stats/leaderboard')
        names = [e['player_name'] for e in resp.json()]
        assert set(names) == {'Alice', 'Bob', 'Charlie'}

    def test_sorted_by_total_profit_loss_desc(self, seeded_client):
        """Charlie(100) > Alice(80) > Bob(-70)."""
        resp = seeded_client.get('/stats/leaderboard')
        entries = resp.json()
        pls = [e['total_profit_loss'] for e in entries]
        assert pls == sorted(pls, reverse=True)

    def test_first_place_is_charlie(self, seeded_client):
        resp = seeded_client.get('/stats/leaderboard')
        assert resp.json()[0]['player_name'] == 'Charlie'

    def test_last_place_is_bob(self, seeded_client):
        resp = seeded_client.get('/stats/leaderboard')
        assert resp.json()[-1]['player_name'] == 'Bob'


class TestLeaderboardEntryFields:
    """AC-2: Each entry includes rank, player_name, total_profit_loss, win_rate, hands_played."""

    def test_entry_has_rank(self, seeded_client):
        resp = seeded_client.get('/stats/leaderboard')
        assert 'rank' in resp.json()[0]

    def test_entry_has_player_name(self, seeded_client):
        resp = seeded_client.get('/stats/leaderboard')
        assert 'player_name' in resp.json()[0]

    def test_entry_has_total_profit_loss(self, seeded_client):
        resp = seeded_client.get('/stats/leaderboard')
        assert 'total_profit_loss' in resp.json()[0]

    def test_entry_has_win_rate(self, seeded_client):
        resp = seeded_client.get('/stats/leaderboard')
        assert 'win_rate' in resp.json()[0]

    def test_entry_has_hands_played(self, seeded_client):
        resp = seeded_client.get('/stats/leaderboard')
        assert 'hands_played' in resp.json()[0]

    def test_ranks_are_sequential(self, seeded_client):
        resp = seeded_client.get('/stats/leaderboard')
        ranks = [e['rank'] for e in resp.json()]
        assert ranks == list(range(1, len(ranks) + 1))

    def test_charlie_stats(self, seeded_client):
        resp = seeded_client.get('/stats/leaderboard')
        charlie = next(e for e in resp.json() if e['player_name'] == 'Charlie')
        assert charlie['rank'] == 1
        assert charlie['total_profit_loss'] == 100.0
        assert charlie['win_rate'] == 100.0
        assert charlie['hands_played'] == 1

    def test_alice_stats(self, seeded_client):
        resp = seeded_client.get('/stats/leaderboard')
        alice = next(e for e in resp.json() if e['player_name'] == 'Alice')
        assert alice['rank'] == 2
        assert alice['total_profit_loss'] == 80.0
        assert alice['win_rate'] == round(2 / 3 * 100, 2)
        assert alice['hands_played'] == 3

    def test_bob_stats(self, seeded_client):
        resp = seeded_client.get('/stats/leaderboard')
        bob = next(e for e in resp.json() if e['player_name'] == 'Bob')
        assert bob['rank'] == 3
        assert bob['total_profit_loss'] == -70.0
        assert bob['win_rate'] == round(1 / 3 * 100, 2)
        assert bob['hands_played'] == 3


class TestLeaderboardMetricWinRate:
    """AC-3: metric=win_rate sorts by win_rate descending."""

    def test_win_rate_sort_returns_200(self, seeded_client):
        resp = seeded_client.get('/stats/leaderboard?metric=win_rate')
        assert resp.status_code == 200

    def test_sorted_by_win_rate_desc(self, seeded_client):
        """Charlie(100%) > Alice(66.67%) > Bob(33.33%)."""
        resp = seeded_client.get('/stats/leaderboard?metric=win_rate')
        entries = resp.json()
        win_rates = [e['win_rate'] for e in entries]
        assert win_rates == sorted(win_rates, reverse=True)

    def test_charlie_is_first_by_win_rate(self, seeded_client):
        resp = seeded_client.get('/stats/leaderboard?metric=win_rate')
        assert resp.json()[0]['player_name'] == 'Charlie'

    def test_bob_is_last_by_win_rate(self, seeded_client):
        resp = seeded_client.get('/stats/leaderboard?metric=win_rate')
        assert resp.json()[-1]['player_name'] == 'Bob'


class TestLeaderboardMetricHandsPlayed:
    """AC-3: metric=hands_played sorts by hands_played descending."""

    def test_hands_played_sort_returns_200(self, seeded_client):
        resp = seeded_client.get('/stats/leaderboard?metric=hands_played')
        assert resp.status_code == 200

    def test_sorted_by_hands_played_desc(self, seeded_client):
        """Alice(3) and Bob(3) > Charlie(1)."""
        resp = seeded_client.get('/stats/leaderboard?metric=hands_played')
        entries = resp.json()
        counts = [e['hands_played'] for e in entries]
        assert counts == sorted(counts, reverse=True)

    def test_charlie_is_last_by_hands_played(self, seeded_client):
        resp = seeded_client.get('/stats/leaderboard?metric=hands_played')
        assert resp.json()[-1]['player_name'] == 'Charlie'


class TestLeaderboardInvalidMetric:
    """Invalid metric value returns 422."""

    def test_invalid_metric_returns_422(self, client):
        resp = client.get('/stats/leaderboard?metric=invalid')
        assert resp.status_code == 422


class TestLeaderboardExplicitDefaultMetric:
    """metric=total_profit_loss is same as no metric."""

    def test_explicit_default_metric(self, seeded_client):
        resp1 = seeded_client.get('/stats/leaderboard')
        resp2 = seeded_client.get('/stats/leaderboard?metric=total_profit_loss')
        assert resp1.json() == resp2.json()


class TestLeaderboardComputationAccuracy:
    """Verify exact computed values across all metrics with known data."""

    def test_win_rate_sort_exact_values(self, seeded_client):
        """Verify exact win_rate values: Charlie=100.0, Alice=66.67, Bob=33.33."""
        resp = seeded_client.get('/stats/leaderboard?metric=win_rate')
        entries = resp.json()
        charlie = entries[0]
        alice = entries[1]
        bob = entries[2]
        assert charlie['win_rate'] == 100.0
        assert abs(alice['win_rate'] - 66.67) < 0.01
        assert abs(bob['win_rate'] - 33.33) < 0.01

    def test_win_rate_sort_ranks_reassigned(self, seeded_client):
        """Ranks reflect the win_rate ordering, not the default sort."""
        resp = seeded_client.get('/stats/leaderboard?metric=win_rate')
        entries = resp.json()
        ranks = {e['player_name']: e['rank'] for e in entries}
        assert ranks['Charlie'] == 1
        assert ranks['Alice'] == 2
        assert ranks['Bob'] == 3

    def test_hands_played_sort_exact_values(self, seeded_client):
        """Alice=3, Bob=3, Charlie=1 — verify exact hands_played values."""
        resp = seeded_client.get('/stats/leaderboard?metric=hands_played')
        entries = resp.json()
        values = {e['player_name']: e['hands_played'] for e in entries}
        assert values['Alice'] == 3
        assert values['Bob'] == 3
        assert values['Charlie'] == 1

    def test_hands_played_sort_charlie_last(self, seeded_client):
        resp = seeded_client.get('/stats/leaderboard?metric=hands_played')
        assert resp.json()[-1]['player_name'] == 'Charlie'
        assert resp.json()[-1]['rank'] == 3

    def test_profit_loss_sort_exact_values(self, seeded_client):
        """Charlie=100.0, Alice=80.0, Bob=-70.0 — verify exact P/L."""
        resp = seeded_client.get('/stats/leaderboard')
        values = {e['player_name']: e['total_profit_loss'] for e in resp.json()}
        assert values['Charlie'] == 100.0
        assert values['Alice'] == 80.0
        assert values['Bob'] == -70.0


class TestLeaderboardExcludesPlayersWithNoResults:
    """Players with no recorded results are excluded from leaderboard."""

    def test_player_without_results_excluded(self, client):
        # Create a player with a hand but no results
        g = client.post(
            '/games', json={'game_date': '2026-02-01', 'player_names': ['Ghost']}
        )
        assert g.status_code == 201
        gid = g.json()['game_id']
        h = client.post(
            f'/games/{gid}/hands',
            json={
                'flop_1': {'rank': 'A', 'suit': 'S'},
                'flop_2': {'rank': 'K', 'suit': 'H'},
                'flop_3': {'rank': '2', 'suit': 'D'},
                'player_entries': [
                    {
                        'player_name': 'Ghost',
                        'card_1': {'rank': '7', 'suit': 'S'},
                        'card_2': {'rank': '8', 'suit': 'S'},
                    },
                ],
            },
        )
        assert h.status_code == 201

        resp = client.get('/stats/leaderboard')
        names = [e['player_name'] for e in resp.json()]
        assert 'Ghost' not in names
