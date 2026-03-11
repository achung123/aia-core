"""Tests for T-034: Per-Session Stats endpoint (GET /stats/games/{game_id})."""

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
    Seed two game sessions with hands and results.

    Session 1 (game_id=1):
      Hand 1: flop only
        Alice: win  (+30)
        Bob:   loss (-30)
      Hand 2: flop+turn
        Alice: fold  (0)
        Bob:   win (+10)

    Session 2 (game_id=2):
      Hand 1: flop+turn+river
        Alice: win  (+50)
        Bob:   loss (-50)

    Session 1 per-player:
      Alice: 2 hands, 1 win, 0 loss, 1 fold, win_rate=50.0, profit_loss=30.0
      Bob:   2 hands, 1 win, 1 loss, 0 fold, win_rate=50.0, profit_loss=-20.0

    Session 2 per-player:
      Alice: 1 hand, 1 win, 0 loss, 0 fold, win_rate=100.0, profit_loss=50.0
      Bob:   1 hand, 0 win, 1 loss, 0 fold, win_rate=0.0,   profit_loss=-50.0
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
            {'player_name': 'Alice', 'result': 'win', 'profit_loss': 30.0},
            {'player_name': 'Bob', 'result': 'loss', 'profit_loss': -30.0},
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
            {'player_name': 'Alice', 'result': 'fold', 'profit_loss': 0.0},
            {'player_name': 'Bob', 'result': 'win', 'profit_loss': 10.0},
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
            {'player_name': 'Alice', 'result': 'win', 'profit_loss': 50.0},
            {'player_name': 'Bob', 'result': 'loss', 'profit_loss': -50.0},
        ],
    )
    assert r3.status_code == 200

    return client, gid1, gid2


class TestGameStatsNotFound:
    """AC-3: 404 for nonexistent game."""

    def test_nonexistent_game_returns_404(self, client):
        resp = client.get('/stats/games/9999')
        assert resp.status_code == 404
        assert 'not found' in resp.json()['detail'].lower()


class TestGameStatsTopLevelFields:
    """AC-1: Top-level response includes game_id, game_date, total_hands, player_stats."""

    def test_game_id_in_response(self, seeded_client):
        client, gid1, _ = seeded_client
        resp = client.get(f'/stats/games/{gid1}')
        assert resp.status_code == 200
        assert resp.json()['game_id'] == gid1

    def test_game_date_in_response(self, seeded_client):
        client, gid1, _ = seeded_client
        resp = client.get(f'/stats/games/{gid1}')
        assert resp.status_code == 200
        assert resp.json()['game_date'] == '2026-01-01'

    def test_total_hands_session1(self, seeded_client):
        client, gid1, _ = seeded_client
        resp = client.get(f'/stats/games/{gid1}')
        assert resp.status_code == 200
        assert resp.json()['total_hands'] == 2

    def test_total_hands_session2(self, seeded_client):
        client, _, gid2 = seeded_client
        resp = client.get(f'/stats/games/{gid2}')
        assert resp.status_code == 200
        assert resp.json()['total_hands'] == 1

    def test_player_stats_list_present(self, seeded_client):
        client, gid1, _ = seeded_client
        resp = client.get(f'/stats/games/{gid1}')
        assert resp.status_code == 200
        assert 'player_stats' in resp.json()
        assert isinstance(resp.json()['player_stats'], list)

    def test_player_stats_list_length(self, seeded_client):
        client, gid1, _ = seeded_client
        resp = client.get(f'/stats/games/{gid1}')
        assert len(resp.json()['player_stats']) == 2


class TestGameStatsPlayerBreakdown:
    """AC-1/AC-2: Per-player stats scoped to the game session."""

    def _get_player(self, player_stats, name):
        return next(p for p in player_stats if p['player_name'] == name)

    def test_alice_hands_played_session1(self, seeded_client):
        client, gid1, _ = seeded_client
        resp = client.get(f'/stats/games/{gid1}')
        alice = self._get_player(resp.json()['player_stats'], 'Alice')
        assert alice['hands_played'] == 2

    def test_alice_hands_won_session1(self, seeded_client):
        client, gid1, _ = seeded_client
        resp = client.get(f'/stats/games/{gid1}')
        alice = self._get_player(resp.json()['player_stats'], 'Alice')
        assert alice['hands_won'] == 1

    def test_alice_hands_lost_session1(self, seeded_client):
        client, gid1, _ = seeded_client
        resp = client.get(f'/stats/games/{gid1}')
        alice = self._get_player(resp.json()['player_stats'], 'Alice')
        assert alice['hands_lost'] == 0

    def test_alice_hands_folded_session1(self, seeded_client):
        client, gid1, _ = seeded_client
        resp = client.get(f'/stats/games/{gid1}')
        alice = self._get_player(resp.json()['player_stats'], 'Alice')
        assert alice['hands_folded'] == 1

    def test_alice_win_rate_session1(self, seeded_client):
        client, gid1, _ = seeded_client
        resp = client.get(f'/stats/games/{gid1}')
        alice = self._get_player(resp.json()['player_stats'], 'Alice')
        # 1 win / 2 total = 50.0%
        assert abs(alice['win_rate'] - 50.0) < 0.01

    def test_alice_profit_loss_session1(self, seeded_client):
        client, gid1, _ = seeded_client
        resp = client.get(f'/stats/games/{gid1}')
        alice = self._get_player(resp.json()['player_stats'], 'Alice')
        # 30 + 0 = 30.0
        assert abs(alice['profit_loss'] - 30.0) < 0.01

    def test_bob_hands_played_session1(self, seeded_client):
        client, gid1, _ = seeded_client
        resp = client.get(f'/stats/games/{gid1}')
        bob = self._get_player(resp.json()['player_stats'], 'Bob')
        assert bob['hands_played'] == 2

    def test_bob_win_rate_session1(self, seeded_client):
        client, gid1, _ = seeded_client
        resp = client.get(f'/stats/games/{gid1}')
        bob = self._get_player(resp.json()['player_stats'], 'Bob')
        # 1 win / 2 total = 50.0%
        assert abs(bob['win_rate'] - 50.0) < 0.01

    def test_bob_profit_loss_session1(self, seeded_client):
        client, gid1, _ = seeded_client
        resp = client.get(f'/stats/games/{gid1}')
        bob = self._get_player(resp.json()['player_stats'], 'Bob')
        # -30 + 10 = -20.0
        assert abs(bob['profit_loss'] - (-20.0)) < 0.01

    def test_alice_session2_stats_isolated(self, seeded_client):
        """AC-2: Stats are scoped to only the specified game session."""
        client, _, gid2 = seeded_client
        resp = client.get(f'/stats/games/{gid2}')
        alice = self._get_player(resp.json()['player_stats'], 'Alice')
        # Only 1 hand in session 2 — should not include session 1 hands
        assert alice['hands_played'] == 1
        assert alice['hands_won'] == 1
        assert abs(alice['profit_loss'] - 50.0) < 0.01
        assert abs(alice['win_rate'] - 100.0) < 0.01

    def test_player_with_no_results_included(self, client):
        """Players in a session whose hands have no result still appear with zero stats."""
        g = client.post(
            '/games', json={'game_date': '2026-03-01', 'player_names': ['Charlie']}
        )
        gid = g.json()['game_id']
        client.post(
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
        resp = client.get(f'/stats/games/{gid}')
        assert resp.status_code == 200
        charlie = self._get_player(resp.json()['player_stats'], 'Charlie')
        assert charlie['hands_played'] == 0
        assert charlie['win_rate'] == 0.0
        assert charlie['profit_loss'] == 0.0
