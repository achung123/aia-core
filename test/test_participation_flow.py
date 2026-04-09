"""Integration tests for multi-client participation flow (T-015 / aia-core-9j7a).

Simulates the full dealer-player lifecycle:
1. Create game with 3 players
2. Create empty hand
3. Player 1 submits cards → status "joined"
4. Player 2 folds → status "folded"
5. Player 3 submits cards → status "joined"
6. Player 1 hands back cards → status "handed_back"
7. Dealer assigns outcomes (won/lost)
8. Verify final hand status
9. Verify stats exclude "handed_back"
"""

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
def game_id(client):
    """Create a game session with three players."""
    resp = client.post(
        '/games',
        json={'game_date': '2026-04-09', 'player_names': ['Alice', 'Bob', 'Charlie']},
    )
    assert resp.status_code == 201
    return resp.json()['game_id']


@pytest.fixture
def hand(client, game_id):
    """Create an empty hand; return (game_id, hand_number)."""
    resp = client.post(f'/games/{game_id}/hands', json={})
    assert resp.status_code == 201
    return game_id, resp.json()['hand_number']


def _status_map(client, game_id, hand_number):
    """Return {player_name: participation_status} from the status endpoint."""
    resp = client.get(f'/games/{game_id}/hands/{hand_number}/status')
    assert resp.status_code == 200
    return {p['name']: p['participation_status'] for p in resp.json()['players']}


class TestMultiClientParticipationFlow:
    """Full lifecycle: 3 players, various transitions, final status & stats."""

    def test_full_participation_lifecycle(self, client, hand):
        game_id, hand_number = hand

        # --- Step 0: all players start as "idle" (no PlayerHand rows yet) ---
        statuses = _status_map(client, game_id, hand_number)
        assert statuses == {
            'Alice': 'idle',
            'Bob': 'idle',
            'Charlie': 'idle',
        }

        # --- Step 1: Player 1 (Alice) submits cards → "joined" ---
        resp = client.post(
            f'/games/{game_id}/hands/{hand_number}/players',
            json={'player_name': 'Alice', 'card_1': 'AS', 'card_2': 'KH'},
        )
        assert resp.status_code == 201

        statuses = _status_map(client, game_id, hand_number)
        assert statuses['Alice'] == 'joined'
        assert statuses['Bob'] == 'idle'
        assert statuses['Charlie'] == 'idle'

        # --- Step 2: Player 2 (Bob) is added without cards, then folds ---
        resp = client.post(
            f'/games/{game_id}/hands/{hand_number}/players',
            json={'player_name': 'Bob'},
        )
        assert resp.status_code == 201

        statuses = _status_map(client, game_id, hand_number)
        assert statuses['Bob'] == 'pending'

        resp = client.patch(
            f'/games/{game_id}/hands/{hand_number}/players/Bob/result',
            json={'result': 'folded'},
        )
        assert resp.status_code == 200

        statuses = _status_map(client, game_id, hand_number)
        assert statuses['Bob'] == 'folded'

        # --- Step 3: Player 3 (Charlie) submits cards → "joined" ---
        resp = client.post(
            f'/games/{game_id}/hands/{hand_number}/players',
            json={'player_name': 'Charlie', 'card_1': 'QD', 'card_2': 'JC'},
        )
        assert resp.status_code == 201

        statuses = _status_map(client, game_id, hand_number)
        assert statuses['Charlie'] == 'joined'

        # --- Step 4: Player 1 (Alice) hands back cards → "handed_back" ---
        resp = client.patch(
            f'/games/{game_id}/hands/{hand_number}/players/Alice/result',
            json={'result': 'handed_back'},
        )
        assert resp.status_code == 200

        statuses = _status_map(client, game_id, hand_number)
        assert statuses['Alice'] == 'handed_back'
        assert statuses['Bob'] == 'folded'
        assert statuses['Charlie'] == 'joined'

        # --- Step 5: Dealer assigns final outcomes ---
        # Charlie won, Bob already folded — Alice handed_back stays as-is
        resp = client.patch(
            f'/games/{game_id}/hands/{hand_number}/players/Charlie/result',
            json={'result': 'won', 'profit_loss': 50.0, 'outcome_street': 'river'},
        )
        assert resp.status_code == 200

        # --- Step 6: Verify final status for all players ---
        statuses = _status_map(client, game_id, hand_number)
        assert statuses == {
            'Alice': 'handed_back',
            'Bob': 'folded',
            'Charlie': 'won',
        }

        # Also verify full status response structure
        resp = client.get(f'/games/{game_id}/hands/{hand_number}/status')
        data = resp.json()
        assert data['hand_number'] == hand_number

        charlie_entry = next(p for p in data['players'] if p['name'] == 'Charlie')
        assert charlie_entry['result'] == 'won'
        assert charlie_entry['outcome_street'] == 'river'
        assert charlie_entry['card_1'] == 'QD'
        assert charlie_entry['card_2'] == 'JC'

    def test_stats_exclude_handed_back(self, client, hand):
        """handed_back player should not count in stats totals."""
        game_id, hand_number = hand

        # Alice submits cards then hands back
        client.post(
            f'/games/{game_id}/hands/{hand_number}/players',
            json={'player_name': 'Alice', 'card_1': 'AS', 'card_2': 'KH'},
        )
        client.patch(
            f'/games/{game_id}/hands/{hand_number}/players/Alice/result',
            json={'result': 'handed_back'},
        )

        # Bob folds
        client.post(
            f'/games/{game_id}/hands/{hand_number}/players',
            json={'player_name': 'Bob'},
        )
        client.patch(
            f'/games/{game_id}/hands/{hand_number}/players/Bob/result',
            json={'result': 'folded'},
        )

        # Charlie wins
        client.post(
            f'/games/{game_id}/hands/{hand_number}/players',
            json={'player_name': 'Charlie', 'card_1': 'QD', 'card_2': 'JC'},
        )
        client.patch(
            f'/games/{game_id}/hands/{hand_number}/players/Charlie/result',
            json={'result': 'won', 'profit_loss': 50.0},
        )

        # Alice stats: handed_back excluded → 0 hands played
        resp = client.get('/stats/players/Alice')
        assert resp.status_code == 200
        alice_stats = resp.json()
        assert alice_stats['total_hands_played'] == 0
        assert alice_stats['hands_won'] == 0

        # Bob stats: folded counts
        resp = client.get('/stats/players/Bob')
        assert resp.status_code == 200
        bob_stats = resp.json()
        assert bob_stats['total_hands_played'] == 1
        assert bob_stats['hands_folded'] == 1

        # Charlie stats: won counts
        resp = client.get('/stats/players/Charlie')
        assert resp.status_code == 200
        charlie_stats = resp.json()
        assert charlie_stats['total_hands_played'] == 1
        assert charlie_stats['hands_won'] == 1
        assert charlie_stats['total_profit_loss'] == 50.0

    def test_leaderboard_excludes_handed_back(self, client, hand):
        """Leaderboard should not count handed_back hands."""
        game_id, hand_number = hand

        # Alice: handed_back only
        client.post(
            f'/games/{game_id}/hands/{hand_number}/players',
            json={'player_name': 'Alice', 'card_1': 'AS', 'card_2': 'KH'},
        )
        client.patch(
            f'/games/{game_id}/hands/{hand_number}/players/Alice/result',
            json={'result': 'handed_back'},
        )

        # Charlie: won
        client.post(
            f'/games/{game_id}/hands/{hand_number}/players',
            json={'player_name': 'Charlie', 'card_1': 'QD', 'card_2': 'JC'},
        )
        client.patch(
            f'/games/{game_id}/hands/{hand_number}/players/Charlie/result',
            json={'result': 'won', 'profit_loss': 25.0},
        )

        resp = client.get('/stats/leaderboard')
        assert resp.status_code == 200
        entries = resp.json()
        names = [e['player_name'] for e in entries]

        # Alice should NOT appear (only has handed_back)
        assert 'Alice' not in names

        # Charlie should appear
        assert 'Charlie' in names
        charlie = next(e for e in entries if e['player_name'] == 'Charlie')
        assert charlie['hands_played'] == 1
