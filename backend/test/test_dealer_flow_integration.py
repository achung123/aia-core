"""T-041: Dealer flow integration test.

End-to-end integration test covering the full dealer flow:
create game → add players → start hand → community cards → fold → equity → results → verify.
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


class TestDealerFlowIntegration:
    """Full dealer flow: create game → start hand → community → fold → equity → results → verify."""

    def test_full_dealer_flow_three_players(self, client):
        """AC 1-6: Complete dealer flow with 3 players, fold, equity, results, and final state."""

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

        # Start a hand via POST /hands/start (auto-assigns SB/BB + creates PlayerHands)
        start_resp = client.post(f'/games/{game_id}/hands/start')
        assert start_resp.status_code == 201
        hand = start_resp.json()
        hand_number = hand['hand_number']
        assert hand_number == 1
        assert hand['sb_player_name'] is not None
        assert hand['bb_player_name'] is not None
        assert hand['sb_player_name'] != hand['bb_player_name']
        # All 3 active players should have PlayerHand entries
        assert len(hand['player_hands']) == 3
        player_names_in_hand = {ph['player_name'] for ph in hand['player_hands']}
        assert player_names_in_hand == {'Alice', 'Bob', 'Charlie'}

        # === AC2: Record community cards (flop + turn + river) ===
        # Flop
        flop_resp = client.patch(
            f'/games/{game_id}/hands/{hand_number}/flop',
            json={
                'flop_1': {'rank': 'A', 'suit': 'D'},
                'flop_2': {'rank': 'K', 'suit': 'C'},
                'flop_3': {'rank': '7', 'suit': 'H'},
            },
        )
        assert flop_resp.status_code == 200
        flop_data = flop_resp.json()
        assert flop_data['flop_1'] == 'AD'
        assert flop_data['flop_2'] == 'KC'
        assert flop_data['flop_3'] == '7H'

        # Turn
        turn_resp = client.patch(
            f'/games/{game_id}/hands/{hand_number}/turn',
            json={'turn': {'rank': '3', 'suit': 'S'}},
        )
        assert turn_resp.status_code == 200
        assert turn_resp.json()['turn'] == '3S'

        # River
        river_resp = client.patch(
            f'/games/{game_id}/hands/{hand_number}/river',
            json={'river': {'rank': '9', 'suit': 'D'}},
        )
        assert river_resp.status_code == 200
        river_data = river_resp.json()
        assert river_data['river'] == '9D'

        # === AC3: Record fold for one player ===
        fold_resp = client.patch(
            f'/games/{game_id}/hands/{hand_number}/players/Charlie/result',
            json={'result': 'folded', 'profit_loss': -10.0, 'outcome_street': 'flop'},
        )
        assert fold_resp.status_code == 200
        assert fold_resp.json()['result'] == 'folded'

        # === AC3 cont: Give remaining two players hole cards so equity can compute ===
        # Edit hole cards for Alice
        alice_cards_resp = client.patch(
            f'/games/{game_id}/hands/{hand_number}/players/Alice',
            json={
                'card_1': {'rank': 'A', 'suit': 'S'},
                'card_2': {'rank': 'A', 'suit': 'H'},
            },
        )
        assert alice_cards_resp.status_code == 200
        assert alice_cards_resp.json()['card_1'] == 'AS'
        assert alice_cards_resp.json()['card_2'] == 'AH'

        # Edit hole cards for Bob
        bob_cards_resp = client.patch(
            f'/games/{game_id}/hands/{hand_number}/players/Bob',
            json={
                'card_1': {'rank': 'K', 'suit': 'S'},
                'card_2': {'rank': 'K', 'suit': 'H'},
            },
        )
        assert bob_cards_resp.status_code == 200

        # === AC4: Get equity for remaining two ===
        equity_resp = client.get(
            f'/games/{game_id}/hands/{hand_number}/equity',
        )
        assert equity_resp.status_code == 200
        equity_data = equity_resp.json()
        assert 'equities' in equity_data
        equity_names = {e['player_name'] for e in equity_data['equities']}
        # Alice and Bob have cards → they get equity
        assert 'Alice' in equity_names
        assert 'Bob' in equity_names
        # Charlie folded / has no cards → must be excluded from equity
        assert 'Charlie' not in equity_names
        assert len(equity_data['equities']) == 2
        # Equity values are valid and sum to ~1.0
        for entry in equity_data['equities']:
            assert 0.0 <= entry['equity'] <= 1.0
        assert abs(sum(e['equity'] for e in equity_data['equities']) - 1.0) < 0.01

        # === AC5: Call result endpoint for each remaining player ===
        alice_result_resp = client.patch(
            f'/games/{game_id}/hands/{hand_number}/players/Alice/result',
            json={'result': 'won', 'profit_loss': 50.0, 'outcome_street': 'river'},
        )
        assert alice_result_resp.status_code == 200
        assert alice_result_resp.json()['result'] == 'won'
        assert alice_result_resp.json()['profit_loss'] == 50.0

        bob_result_resp = client.patch(
            f'/games/{game_id}/hands/{hand_number}/players/Bob/result',
            json={'result': 'lost', 'profit_loss': -40.0, 'outcome_street': 'river'},
        )
        assert bob_result_resp.status_code == 200
        assert bob_result_resp.json()['result'] == 'lost'
        assert bob_result_resp.json()['profit_loss'] == -40.0

        # === AC6: Verify final hand state ===
        final_hand_resp = client.get(f'/games/{game_id}/hands/{hand_number}')
        assert final_hand_resp.status_code == 200
        final = final_hand_resp.json()

        # Community cards present
        assert final['flop_1'] == 'AD'
        assert final['flop_2'] == 'KC'
        assert final['flop_3'] == '7H'
        assert final['turn'] == '3S'
        assert final['river'] == '9D'

        # SB/BB assigned
        assert final['sb_player_name'] is not None
        assert final['bb_player_name'] is not None

        # All players have results
        player_hands = {ph['player_name']: ph for ph in final['player_hands']}
        assert len(player_hands) == 3

        assert player_hands['Alice']['result'] == 'won'
        assert player_hands['Alice']['profit_loss'] == 50.0

        assert player_hands['Bob']['result'] == 'lost'
        assert player_hands['Bob']['profit_loss'] == -40.0

        assert player_hands['Charlie']['result'] == 'folded'
        assert player_hands['Charlie']['profit_loss'] == -10.0

        # Verify hand status endpoint also reflects completed state
        status_resp = client.get(f'/games/{game_id}/hands/{hand_number}/status')
        assert status_resp.status_code == 200
        status = status_resp.json()
        assert status['community_recorded'] is True
        status_by_name = {p['name']: p for p in status['players']}
        assert status_by_name['Alice']['result'] == 'won'
        assert status_by_name['Bob']['result'] == 'lost'
        assert status_by_name['Charlie']['result'] == 'folded'
