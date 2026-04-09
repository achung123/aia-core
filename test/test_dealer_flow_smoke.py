"""T-024: End-to-end smoke test — full dealer flow.

Exercises the complete dealer flow:
1. POST create empty hand (no cards, no players)
2. POST add player cards (3 players + 1 eliminated)
3. PATCH assign results (won/lost/folded)
4. PATCH add community cards (flop, turn, river)
5. GET equity computation
6. Verify eliminated player has null cards/result
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


class TestDealerFlowSmoke:
    """Full dealer flow: create game → empty hand → add players → results → community → equity."""

    def test_full_dealer_flow(self, client):
        # --- Step 0: Create a game session with 4 players ---
        game_resp = client.post(
            '/games',
            json={
                'game_date': '2026-04-09',
                'player_names': ['Alice', 'Bob', 'Charlie', 'Dave'],
            },
        )
        assert game_resp.status_code == 201
        game_id = game_resp.json()['game_id']

        # --- Step 1: POST empty hand (no cards, no players) ---
        hand_resp = client.post(f'/games/{game_id}/hands', json={})
        assert hand_resp.status_code == 201
        hand_data = hand_resp.json()
        hand_number = hand_data['hand_number']
        assert hand_number == 1
        assert hand_data['flop_1'] is None
        assert hand_data['player_hands'] == []

        # --- Step 2: POST add player cards (3 active + 1 eliminated) ---
        # Alice: active with cards
        alice_resp = client.post(
            f'/games/{game_id}/hands/{hand_number}/players',
            json={
                'player_name': 'Alice',
                'card_1': {'rank': 'A', 'suit': 'S'},
                'card_2': {'rank': 'A', 'suit': 'H'},
            },
        )
        assert alice_resp.status_code == 201
        assert alice_resp.json()['card_1'] == 'AS'
        assert alice_resp.json()['card_2'] == 'AH'

        # Bob: active with cards
        bob_resp = client.post(
            f'/games/{game_id}/hands/{hand_number}/players',
            json={
                'player_name': 'Bob',
                'card_1': {'rank': 'K', 'suit': 'S'},
                'card_2': {'rank': 'K', 'suit': 'H'},
            },
        )
        assert bob_resp.status_code == 201

        # Charlie: active with cards
        charlie_resp = client.post(
            f'/games/{game_id}/hands/{hand_number}/players',
            json={
                'player_name': 'Charlie',
                'card_1': {'rank': 'Q', 'suit': 'D'},
                'card_2': {'rank': 'Q', 'suit': 'C'},
            },
        )
        assert charlie_resp.status_code == 201

        # Dave: eliminated — null cards, no result
        dave_resp = client.post(
            f'/games/{game_id}/hands/{hand_number}/players',
            json={'player_name': 'Dave', 'card_1': None, 'card_2': None},
        )
        assert dave_resp.status_code == 201
        assert dave_resp.json()['card_1'] is None
        assert dave_resp.json()['card_2'] is None

        # --- Step 3: PATCH assign results ---
        alice_result = client.patch(
            f'/games/{game_id}/hands/{hand_number}/players/Alice/result',
            json={'result': 'won', 'profit_loss': 100.0},
        )
        assert alice_result.status_code == 200
        assert alice_result.json()['result'] == 'won'

        bob_result = client.patch(
            f'/games/{game_id}/hands/{hand_number}/players/Bob/result',
            json={'result': 'lost', 'profit_loss': -50.0},
        )
        assert bob_result.status_code == 200
        assert bob_result.json()['result'] == 'lost'

        charlie_result = client.patch(
            f'/games/{game_id}/hands/{hand_number}/players/Charlie/result',
            json={'result': 'folded', 'profit_loss': -25.0},
        )
        assert charlie_result.status_code == 200
        assert charlie_result.json()['result'] == 'folded'

        # --- Step 4: PATCH community cards (flop + turn + river) ---
        community_resp = client.patch(
            f'/games/{game_id}/hands/{hand_number}',
            json={
                'flop_1': {'rank': '2', 'suit': 'C'},
                'flop_2': {'rank': '7', 'suit': 'D'},
                'flop_3': {'rank': 'J', 'suit': 'S'},
                'turn': {'rank': '5', 'suit': 'C'},
                'river': {'rank': '9', 'suit': 'D'},
            },
        )
        assert community_resp.status_code == 200
        comm_data = community_resp.json()
        assert comm_data['flop_1'] == '2C'
        assert comm_data['flop_2'] == '7D'
        assert comm_data['flop_3'] == 'JS'
        assert comm_data['turn'] == '5C'
        assert comm_data['river'] == '9D'

        # --- Step 5: GET equity computation ---
        equity_resp = client.get(
            f'/games/{game_id}/hands/{hand_number}/equity',
        )
        assert equity_resp.status_code == 200
        equity_data = equity_resp.json()
        assert 'equities' in equity_data
        # Only players with non-null cards get equity (Alice, Bob, Charlie)
        equity_names = {e['player_name'] for e in equity_data['equities']}
        assert 'Alice' in equity_names
        assert 'Bob' in equity_names
        assert 'Charlie' in equity_names
        # Dave (eliminated, null cards) should NOT appear in equity
        assert 'Dave' not in equity_names
        for entry in equity_data['equities']:
            assert 0.0 <= entry['equity'] <= 1.0

        # --- Step 6: Verify eliminated player has null cards/result ---
        hand_get = client.get(f'/games/{game_id}/hands/{hand_number}')
        assert hand_get.status_code == 200
        player_hands = hand_get.json()['player_hands']
        dave_ph = next(ph for ph in player_hands if ph['player_name'] == 'Dave')
        assert dave_ph['card_1'] is None
        assert dave_ph['card_2'] is None
        assert dave_ph['result'] is None
