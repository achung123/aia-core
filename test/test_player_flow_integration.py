"""T-042: Player flow integration test.

End-to-end integration test covering the player flow:
create game → start hand → poll status → record hole cards → record actions → finalize → verify results & actions.
"""

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


class TestPlayerFlowIntegration:
    """Full player flow: create game → start hand → poll status → hole cards → actions → finalize → verify."""

    def test_full_player_flow_three_players(self, client):
        """AC 1-4: Complete player flow with 3 players covering hole cards, actions, results, and action retrieval."""

        # === AC1: Create a game with 3 players and start a hand ===
        game_resp = client.post(
            '/games',
            json={
                'game_date': '2026-04-12',
                'player_names': ['Alice', 'Bob', 'Charlie'],
            },
        )
        assert game_resp.status_code == 201
        game = game_resp.json()
        game_id = game['game_id']
        assert len(game['player_names']) == 3

        # Start a hand (auto-assigns SB/BB + creates PlayerHands)
        start_resp = client.post(f'/games/{game_id}/hands/start')
        assert start_resp.status_code == 201
        hand = start_resp.json()
        hand_number = hand['hand_number']
        assert hand_number == 1
        assert len(hand['player_hands']) == 3

        # Simulate player joining by polling hand status
        status_resp = client.get(f'/games/{game_id}/hands/{hand_number}/status')
        assert status_resp.status_code == 200
        status = status_resp.json()
        assert status['hand_number'] == hand_number
        assert len(status['players']) == 3
        # All players should have a participation status (in hand)
        for p in status['players']:
            assert p['participation_status'] is not None

        # === AC2: Record hole cards via PATCH ===
        alice_cards_resp = client.patch(
            f'/games/{game_id}/hands/{hand_number}/players/Alice',
            json={
                'card_1': {'rank': 'A', 'suit': 'S'},
                'card_2': {'rank': 'K', 'suit': 'S'},
            },
        )
        assert alice_cards_resp.status_code == 200
        assert alice_cards_resp.json()['card_1'] == 'AS'
        assert alice_cards_resp.json()['card_2'] == 'KS'

        bob_cards_resp = client.patch(
            f'/games/{game_id}/hands/{hand_number}/players/Bob',
            json={
                'card_1': {'rank': 'Q', 'suit': 'H'},
                'card_2': {'rank': 'J', 'suit': 'H'},
            },
        )
        assert bob_cards_resp.status_code == 200
        assert bob_cards_resp.json()['card_1'] == 'QH'
        assert bob_cards_resp.json()['card_2'] == 'JH'

        charlie_cards_resp = client.patch(
            f'/games/{game_id}/hands/{hand_number}/players/Charlie',
            json={
                'card_1': {'rank': '7', 'suit': 'D'},
                'card_2': {'rank': '2', 'suit': 'C'},
            },
        )
        assert charlie_cards_resp.status_code == 200
        assert charlie_cards_resp.json()['card_1'] == '7D'
        assert charlie_cards_resp.json()['card_2'] == '2C'

        # === AC2 cont: Record player actions via POST (bet, check, fold) ===
        # Preflop: Alice bets
        alice_bet_resp = client.post(
            f'/games/{game_id}/hands/{hand_number}/players/Alice/actions?force=true',
            json={'street': 'preflop', 'action': 'bet', 'amount': 20.0},
        )
        assert alice_bet_resp.status_code == 201
        assert alice_bet_resp.json()['action'] == 'bet'
        assert alice_bet_resp.json()['amount'] == 20.0
        assert alice_bet_resp.json()['street'] == 'preflop'

        # Preflop: Bob calls
        bob_call_resp = client.post(
            f'/games/{game_id}/hands/{hand_number}/players/Bob/actions?force=true',
            json={'street': 'preflop', 'action': 'call', 'amount': 20.0},
        )
        assert bob_call_resp.status_code == 201
        assert bob_call_resp.json()['action'] == 'call'

        # Preflop: Charlie folds
        charlie_fold_resp = client.post(
            f'/games/{game_id}/hands/{hand_number}/players/Charlie/actions?force=true',
            json={'street': 'preflop', 'action': 'fold'},
        )
        assert charlie_fold_resp.status_code == 201
        assert charlie_fold_resp.json()['action'] == 'fold'

        # Record community cards (flop, turn, river) so hand can be finalized
        client.patch(
            f'/games/{game_id}/hands/{hand_number}/flop',
            json={
                'flop_1': {'rank': '10', 'suit': 'H'},
                'flop_2': {'rank': '9', 'suit': 'H'},
                'flop_3': {'rank': '2', 'suit': 'S'},
            },
        )

        # Flop: Alice checks
        alice_check_resp = client.post(
            f'/games/{game_id}/hands/{hand_number}/players/Alice/actions?force=true',
            json={'street': 'flop', 'action': 'check'},
        )
        assert alice_check_resp.status_code == 201
        assert alice_check_resp.json()['action'] == 'check'

        # Flop: Bob bets
        bob_bet_resp = client.post(
            f'/games/{game_id}/hands/{hand_number}/players/Bob/actions?force=true',
            json={'street': 'flop', 'action': 'bet', 'amount': 30.0},
        )
        assert bob_bet_resp.status_code == 201

        # Flop: Alice calls
        alice_call_resp = client.post(
            f'/games/{game_id}/hands/{hand_number}/players/Alice/actions?force=true',
            json={'street': 'flop', 'action': 'call', 'amount': 30.0},
        )
        assert alice_call_resp.status_code == 201

        # Turn and river
        client.patch(
            f'/games/{game_id}/hands/{hand_number}/turn',
            json={'turn': {'rank': '8', 'suit': 'H'}},
        )
        client.patch(
            f'/games/{game_id}/hands/{hand_number}/river',
            json={'river': {'rank': '3', 'suit': 'D'}},
        )

        # River: Alice checks, Bob checks
        client.post(
            f'/games/{game_id}/hands/{hand_number}/players/Alice/actions?force=true',
            json={'street': 'river', 'action': 'check'},
        )
        client.post(
            f'/games/{game_id}/hands/{hand_number}/players/Bob/actions?force=true',
            json={'street': 'river', 'action': 'check'},
        )

        # === AC3: Finalize hand — record results for all players ===
        # Charlie already folded via action; set result explicitly
        charlie_result_resp = client.patch(
            f'/games/{game_id}/hands/{hand_number}/players/Charlie/result',
            json={'result': 'folded', 'profit_loss': -10.0, 'outcome_street': 'preflop'},
        )
        assert charlie_result_resp.status_code == 200
        assert charlie_result_resp.json()['result'] == 'folded'

        # Bob has flush (QhJh with 10h9h8h board) → Bob wins
        bob_result_resp = client.patch(
            f'/games/{game_id}/hands/{hand_number}/players/Bob/result',
            json={'result': 'won', 'profit_loss': 60.0, 'outcome_street': 'river'},
        )
        assert bob_result_resp.status_code == 200
        assert bob_result_resp.json()['result'] == 'won'

        alice_result_resp = client.patch(
            f'/games/{game_id}/hands/{hand_number}/players/Alice/result',
            json={'result': 'lost', 'profit_loss': -50.0, 'outcome_street': 'river'},
        )
        assert alice_result_resp.status_code == 200
        assert alice_result_resp.json()['result'] == 'lost'

        # Verify showdown results via hand endpoint
        final_resp = client.get(f'/games/{game_id}/hands/{hand_number}')
        assert final_resp.status_code == 200
        final = final_resp.json()

        player_hands = {ph['player_name']: ph for ph in final['player_hands']}
        assert len(player_hands) == 3

        assert player_hands['Alice']['result'] == 'lost'
        assert player_hands['Alice']['profit_loss'] == -50.0
        assert player_hands['Alice']['card_1'] == 'AS'
        assert player_hands['Alice']['card_2'] == 'KS'

        assert player_hands['Bob']['result'] == 'won'
        assert player_hands['Bob']['profit_loss'] == 60.0
        assert player_hands['Bob']['card_1'] == 'QH'
        assert player_hands['Bob']['card_2'] == 'JH'

        assert player_hands['Charlie']['result'] == 'folded'
        assert player_hands['Charlie']['profit_loss'] == -10.0

        # Verify showdown via status endpoint
        status_resp = client.get(f'/games/{game_id}/hands/{hand_number}/status')
        assert status_resp.status_code == 200
        status = status_resp.json()
        status_by_name = {p['name']: p for p in status['players']}
        assert status_by_name['Bob']['result'] == 'won'
        assert status_by_name['Alice']['result'] == 'lost'
        assert status_by_name['Charlie']['result'] == 'folded'

        # === AC4: Verify actions retrievable via GET /hands/{num}/actions ===
        actions_resp = client.get(f'/games/{game_id}/hands/{hand_number}/actions')
        assert actions_resp.status_code == 200
        actions = actions_resp.json()

        # We recorded 8 actions total:
        # preflop: Alice bet, Bob call, Charlie fold
        # flop: Alice check, Bob bet, Alice call
        # river: Alice check, Bob check
        assert len(actions) == 8

        # Verify action details and ordering
        assert actions[0]['player_name'] == 'Alice'
        assert actions[0]['street'] == 'preflop'
        assert actions[0]['action'] == 'bet'
        assert actions[0]['amount'] == 20.0

        assert actions[1]['player_name'] == 'Bob'
        assert actions[1]['street'] == 'preflop'
        assert actions[1]['action'] == 'call'

        assert actions[2]['player_name'] == 'Charlie'
        assert actions[2]['street'] == 'preflop'
        assert actions[2]['action'] == 'fold'

        assert actions[3]['player_name'] == 'Alice'
        assert actions[3]['street'] == 'flop'
        assert actions[3]['action'] == 'check'

        assert actions[4]['player_name'] == 'Bob'
        assert actions[4]['street'] == 'flop'
        assert actions[4]['action'] == 'bet'
        assert actions[4]['amount'] == 30.0

        assert actions[5]['player_name'] == 'Alice'
        assert actions[5]['street'] == 'flop'
        assert actions[5]['action'] == 'call'

        assert actions[6]['player_name'] == 'Alice'
        assert actions[6]['street'] == 'river'
        assert actions[6]['action'] == 'check'

        assert actions[7]['player_name'] == 'Bob'
        assert actions[7]['street'] == 'river'
        assert actions[7]['action'] == 'check'

        # All actions have created_at timestamps
        for a in actions:
            assert a['created_at'] is not None
