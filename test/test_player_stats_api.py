"""Tests for T-032: Player Stats endpoint (GET /stats/players/{player_name})."""

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
    Seed two game sessions with hands and results for 'Alice' and 'Bob'.

    Session 1 (game_id=1):
      Hand 1: flop only, Alice win (+30), Bob loss (-30)
      Hand 2: flop+turn, Alice fold (0),  Bob win (+10)

    Session 2 (game_id=2):
      Hand 1: flop+turn+river, Alice win (+50), Bob loss (-50)

    Alice totals:
      hands_with_results = 3 (all have result)
      wins=2, losses=0, folds=1
      win_rate = 2/3 * 100 = 66.67%
      total_profit_loss = 30 + 0 + 50 = 80.0
      avg_profit_loss_per_hand = 80.0 / 3 = 26.67
      sessions = {1: 30, 2: 50}  → avg_profit_loss_per_session = 65.0 / 2 = ... wait
      session 1 P/L for Alice = 30 + 0 = 30.0
      session 2 P/L for Alice = 50.0
      avg_profit_loss_per_session = (30 + 50) / 2 = 40.0
      flop_pct: 3/3 = 100.0 (all hands have flop)
      turn_pct: 2/3 = 66.67 (hands 2 and 3 had turn)
      river_pct: 1/3 = 33.33 (only hand 3 had river)
    """
    # Session 1
    g1 = client.post(
        '/games', json={'game_date': '2026-01-01', 'player_names': ['Alice', 'Bob']}
    )
    assert g1.status_code == 201
    gid1 = g1.json()['game_id']

    # Hand 1: flop only
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

    # Hand 2: flop + turn
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

    # Session 2
    g2 = client.post(
        '/games', json={'game_date': '2026-01-08', 'player_names': ['Alice', 'Bob']}
    )
    assert g2.status_code == 201
    gid2 = g2.json()['game_id']

    # Hand 1: flop + turn + river
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

    return client


class TestPlayerStatsNotFound:
    """AC: 404 for nonexistent player."""

    def test_unknown_player_returns_404(self, client):
        resp = client.get('/stats/players/Ghost')
        assert resp.status_code == 404
        assert 'not found' in resp.json()['detail'].lower()


class TestPlayerStatsNoResults:
    """Player exists but has no hands with results — all stats are zero."""

    def test_no_results_returns_zeros(self, client):
        # Create a player with a hand but no results recorded
        g = client.post(
            '/games', json={'game_date': '2026-02-01', 'player_names': ['Charlie']}
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
                        'player_name': 'Charlie',
                        'card_1': {'rank': '7', 'suit': 'S'},
                        'card_2': {'rank': '8', 'suit': 'S'},
                    },
                ],
            },
        )
        assert h.status_code == 201

        resp = client.get('/stats/players/Charlie')
        assert resp.status_code == 200
        body = resp.json()
        assert body['total_hands_played'] == 0
        assert body['hands_won'] == 0
        assert body['hands_lost'] == 0
        assert body['hands_folded'] == 0
        assert body['win_rate'] == 0.0
        assert body['total_profit_loss'] == 0.0
        assert body['avg_profit_loss_per_hand'] == 0.0
        assert body['avg_profit_loss_per_session'] == 0.0


class TestPlayerStatsHandCounts:
    """AC-1/AC-3: Stats derived from non-null result hands; correct counts."""

    def test_total_hands_played(self, seeded_client):
        resp = seeded_client.get('/stats/players/Alice')
        assert resp.status_code == 200
        assert resp.json()['total_hands_played'] == 3

    def test_hands_won(self, seeded_client):
        resp = seeded_client.get('/stats/players/Alice')
        assert resp.json()['hands_won'] == 2

    def test_hands_lost(self, seeded_client):
        resp = seeded_client.get('/stats/players/Alice')
        assert resp.json()['hands_lost'] == 0

    def test_hands_folded(self, seeded_client):
        resp = seeded_client.get('/stats/players/Alice')
        assert resp.json()['hands_folded'] == 1

    def test_hands_without_results_excluded(self, seeded_client):
        # Add a hand with no result for Alice
        g = seeded_client.post(
            '/games', json={'game_date': '2026-02-15', 'player_names': ['Alice']}
        )
        gid = g.json()['game_id']
        seeded_client.post(
            f'/games/{gid}/hands',
            json={
                'flop_1': {'rank': 'A', 'suit': 'H'},
                'flop_2': {'rank': 'K', 'suit': 'D'},
                'flop_3': {'rank': 'Q', 'suit': 'C'},
                'player_entries': [
                    {
                        'player_name': 'Alice',
                        'card_1': {'rank': '2', 'suit': 'H'},
                        'card_2': {'rank': '3', 'suit': 'H'},
                    },
                ],
            },
        )
        resp = seeded_client.get('/stats/players/Alice')
        assert resp.json()['total_hands_played'] == 3  # unchanged


class TestPlayerStatsWinRate:
    """AC-2: Win rate = wins / total hands with results, as percentage."""

    def test_win_rate_calculation(self, seeded_client):
        resp = seeded_client.get('/stats/players/Alice')
        assert resp.status_code == 200
        # 2 wins / 3 total = 66.67%
        assert abs(resp.json()['win_rate'] - 66.67) < 0.01

    def test_win_rate_is_percentage(self, seeded_client):
        resp = seeded_client.get('/stats/players/Bob')
        body = resp.json()
        # Bob: 1 win (hand2 game1), 2 losses → 1/3 * 100 = 33.33%
        assert abs(body['win_rate'] - 33.33) < 0.01


class TestPlayerStatsProfitLoss:
    """AC-1/S-6.2: P/L stats correct."""

    def test_total_profit_loss(self, seeded_client):
        resp = seeded_client.get('/stats/players/Alice')
        # 30 + 0 + 50 = 80.0
        assert abs(resp.json()['total_profit_loss'] - 80.0) < 0.01

    def test_avg_profit_loss_per_hand(self, seeded_client):
        resp = seeded_client.get('/stats/players/Alice')
        # 80.0 / 3 = 26.67
        assert abs(resp.json()['avg_profit_loss_per_hand'] - 26.67) < 0.01

    def test_avg_profit_loss_per_session(self, seeded_client):
        resp = seeded_client.get('/stats/players/Alice')
        # session1: 30+0=30, session2: 50 → (30+50)/2 = 40.0
        assert abs(resp.json()['avg_profit_loss_per_session'] - 40.0) < 0.01

    def test_total_profit_loss_bob(self, seeded_client):
        resp = seeded_client.get('/stats/players/Bob')
        # -30 + 10 + -50 = -70.0
        assert abs(resp.json()['total_profit_loss'] - (-70.0)) < 0.01


class TestPlayerStatsStreetDistribution:
    """AC-3: Street distribution computed from Hand's community card presence."""

    def test_flop_pct_always_100(self, seeded_client):
        resp = seeded_client.get('/stats/players/Alice')
        assert abs(resp.json()['flop_pct'] - 100.0) < 0.01

    def test_turn_pct(self, seeded_client):
        resp = seeded_client.get('/stats/players/Alice')
        # hands with turn: hand2(game1) and hand1(game2) = 2/3 = 66.67%
        assert abs(resp.json()['turn_pct'] - 66.67) < 0.01

    def test_river_pct(self, seeded_client):
        resp = seeded_client.get('/stats/players/Alice')
        # only hand1(game2) had river = 1/3 = 33.33%
        assert abs(resp.json()['river_pct'] - 33.33) < 0.01


class TestPlayerStatsBobComputation:
    """Verify Bob's full computation accuracy with known data."""

    def test_bob_total_hands_played(self, seeded_client):
        resp = seeded_client.get('/stats/players/Bob')
        assert resp.json()['total_hands_played'] == 3

    def test_bob_hands_won(self, seeded_client):
        resp = seeded_client.get('/stats/players/Bob')
        assert resp.json()['hands_won'] == 1

    def test_bob_hands_lost(self, seeded_client):
        resp = seeded_client.get('/stats/players/Bob')
        assert resp.json()['hands_lost'] == 2

    def test_bob_hands_folded(self, seeded_client):
        resp = seeded_client.get('/stats/players/Bob')
        assert resp.json()['hands_folded'] == 0

    def test_bob_avg_profit_loss_per_hand(self, seeded_client):
        resp = seeded_client.get('/stats/players/Bob')
        # -70.0 / 3 = -23.33
        assert abs(resp.json()['avg_profit_loss_per_hand'] - (-23.33)) < 0.01

    def test_bob_avg_profit_loss_per_session(self, seeded_client):
        resp = seeded_client.get('/stats/players/Bob')
        # session1: -30+10=-20, session2: -50 → (-20+-50)/2 = -35.0
        assert abs(resp.json()['avg_profit_loss_per_session'] - (-35.0)) < 0.01

    def test_bob_turn_pct(self, seeded_client):
        resp = seeded_client.get('/stats/players/Bob')
        # Bob's hands with turn: hand2(game1) + hand1(game2) = 2/3 = 66.67%
        assert abs(resp.json()['turn_pct'] - 66.67) < 0.01

    def test_bob_river_pct(self, seeded_client):
        resp = seeded_client.get('/stats/players/Bob')
        # Bob's hands with river: hand1(game2) = 1/3 = 33.33%
        assert abs(resp.json()['river_pct'] - 33.33) < 0.01


class TestPlayerStatsResponseFields:
    """Response includes all required fields."""

    def test_response_has_player_name(self, seeded_client):
        resp = seeded_client.get('/stats/players/Alice')
        assert resp.json()['player_name'] == 'Alice'

    def test_case_insensitive_lookup(self, seeded_client):
        resp = seeded_client.get('/stats/players/alice')
        assert resp.status_code == 200
        assert resp.json()['player_name'] == 'Alice'

    def test_all_required_fields_present(self, seeded_client):
        resp = seeded_client.get('/stats/players/Alice')
        body = resp.json()
        required_fields = [
            'player_name',
            'total_hands_played',
            'hands_won',
            'hands_lost',
            'hands_folded',
            'win_rate',
            'total_profit_loss',
            'avg_profit_loss_per_hand',
            'avg_profit_loss_per_session',
            'flop_pct',
            'turn_pct',
            'river_pct',
        ]
        for field in required_fields:
            assert field in body, f'Missing field: {field}'


class TestPlayerStatsExcludesHandedBack:
    """handed_back results should not count in win/loss/fold totals."""

    def test_handed_back_excluded_from_totals(self, seeded_client):
        """Add a handed_back result and verify it is invisible to stats."""
        # Seed a new hand with handed_back for Alice in game 1
        # First find game 1
        g = seeded_client.post(
            '/games',
            json={'game_date': '2026-03-01', 'player_names': ['Alice', 'Bob']},
        )
        assert g.status_code == 201
        gid = g.json()['game_id']

        h = seeded_client.post(
            f'/games/{gid}/hands',
            json={
                'flop_1': {'rank': '2', 'suit': 'C'},
                'flop_2': {'rank': '3', 'suit': 'C'},
                'flop_3': {'rank': '4', 'suit': 'C'},
                'player_entries': [
                    {
                        'player_name': 'Alice',
                        'card_1': {'rank': '5', 'suit': 'C'},
                        'card_2': {'rank': '6', 'suit': 'C'},
                    },
                    {
                        'player_name': 'Bob',
                        'card_1': {'rank': '7', 'suit': 'C'},
                        'card_2': {'rank': '8', 'suit': 'C'},
                    },
                ],
            },
        )
        assert h.status_code == 201
        hn = h.json()['hand_number']
        r = seeded_client.patch(
            f'/games/{gid}/hands/{hn}/results',
            json=[
                {'player_name': 'Alice', 'result': 'handed_back', 'profit_loss': 0.0},
                {'player_name': 'Bob', 'result': 'won', 'profit_loss': 20.0},
            ],
        )
        assert r.status_code == 200

        # Alice stats should be unchanged from the seeded_client fixture
        # (3 hands: 2 won, 0 lost, 1 folded — the handed_back is invisible)
        resp = seeded_client.get('/stats/players/Alice')
        assert resp.status_code == 200
        body = resp.json()
        assert body['total_hands_played'] == 3
        assert body['hands_won'] == 2
        assert body['hands_lost'] == 0
        assert body['hands_folded'] == 1
        assert abs(body['win_rate'] - 66.67) < 0.01
