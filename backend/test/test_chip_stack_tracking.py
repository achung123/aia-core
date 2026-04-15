"""Tests for Bug Fix: Player chip stacks should update live when betting."""

from conftest import activate_hand


def _create_game_with_buy_ins(client, buy_in=100.0):
    """Create a game with two players, each with a buy-in."""
    resp = client.post(
        '/games',
        json={
            'game_date': '2026-04-13',
            'player_names': ['Alice', 'Bob'],
            'default_buy_in': buy_in,
        },
    )
    assert resp.status_code == 201
    return resp.json()


class TestChipStackInitialization:
    def test_players_start_with_current_chips_equal_to_buy_in(self, client):
        """When a game is created with buy-ins, each player's current_chips should equal their buy_in."""
        game = _create_game_with_buy_ins(client, buy_in=100.0)
        for p in game['players']:
            assert 'current_chips' in p, 'PlayerInfo must expose current_chips'
            assert p['current_chips'] == 100.0

    def test_added_player_gets_current_chips_equal_to_buy_in(self, client):
        """Players added after game creation should also get current_chips from their buy_in."""
        game = _create_game_with_buy_ins(client, buy_in=100.0)
        resp = client.post(
            f'/games/{game["game_id"]}/players',
            json={'player_name': 'Charlie', 'buy_in': 200.0},
        )
        assert resp.status_code == 201
        assert resp.json()['buy_in'] == 200.0

        # Fetch the game to check current_chips
        resp = client.get(f'/games/{game["game_id"]}')
        charlie = [p for p in resp.json()['players'] if p['name'] == 'Charlie'][0]
        assert charlie['current_chips'] == 200.0

    def test_rebuy_adds_to_current_chips(self, client):
        """A rebuy should increase the player's current_chips."""
        game = _create_game_with_buy_ins(client, buy_in=100.0)
        game_id = game['game_id']

        # Record a rebuy for Alice
        resp = client.post(
            f'/games/{game_id}/players/Alice/rebuys',
            json={'amount': 50.0},
        )
        assert resp.status_code == 201

        # Verify current_chips increased
        resp = client.get(f'/games/{game_id}')
        alice = [p for p in resp.json()['players'] if p['name'] == 'Alice'][0]
        assert alice['current_chips'] == 150.0


class TestChipStackBetting:
    def test_blind_deducts_from_stack(self, client):
        """When blinds are auto-posted (activate_hand), current_chips should decrease."""
        game = _create_game_with_buy_ins(client, buy_in=100.0)
        game_id = game['game_id']

        resp = client.post(f'/games/{game_id}/hands/start')
        assert resp.status_code == 201
        hand = resp.json()

        # Activate hand — this triggers auto-blind posting (SB=0.10, BB=0.20)
        activate_hand(client, game_id, hand)

        sb_name = hand['sb_player_name']
        bb_name = hand['bb_player_name']

        # SB should have lost 0.10, BB should have lost 0.20
        resp = client.get(f'/games/{game_id}')
        players_map = {p['name']: p for p in resp.json()['players']}
        assert players_map[sb_name]['current_chips'] == 99.90
        assert players_map[bb_name]['current_chips'] == 99.80

    def test_raise_deducts_from_stack(self, client):
        """When a player raises, their current_chips should decrease by the raise amount."""
        game = _create_game_with_buy_ins(client, buy_in=100.0)
        game_id = game['game_id']

        resp = client.post(f'/games/{game_id}/hands/start')
        assert resp.status_code == 201
        hand = resp.json()
        hn = hand['hand_number']
        activate_hand(client, game_id, hand)

        sb_name = hand['sb_player_name']

        # After blinds: SB has 99.90 (posted 0.10), it's SB's turn next (UTG in heads-up)
        # SB raises 0.90 (total investment this street: 0.10 + 0.90 = 1.00)
        resp = client.post(
            f'/games/{game_id}/hands/{hn}/players/{sb_name}/actions',
            json={'street': 'preflop', 'action': 'raise', 'amount': 0.90},
        )
        assert resp.status_code == 201

        # SB now has 100.0 - 0.10 (blind) - 0.90 (raise) = 99.0
        resp = client.get(f'/games/{game_id}')
        sb_player = [p for p in resp.json()['players'] if p['name'] == sb_name][0]
        assert sb_player['current_chips'] == 99.0

    def test_call_deducts_from_stack(self, client):
        """When a player calls, their current_chips should decrease by the call amount."""
        game = _create_game_with_buy_ins(client, buy_in=100.0)
        game_id = game['game_id']

        resp = client.post(f'/games/{game_id}/hands/start')
        assert resp.status_code == 201
        hand = resp.json()
        hn = hand['hand_number']
        activate_hand(client, game_id, hand)

        sb_name = hand['sb_player_name']
        bb_name = hand['bb_player_name']

        # SB raises 0.90
        client.post(
            f'/games/{game_id}/hands/{hn}/players/{sb_name}/actions',
            json={'street': 'preflop', 'action': 'raise', 'amount': 0.90},
        )

        # BB calls 0.80 (to match SB's total of 1.00)
        resp = client.post(
            f'/games/{game_id}/hands/{hn}/players/{bb_name}/actions',
            json={'street': 'preflop', 'action': 'call', 'amount': 0.80},
        )
        assert resp.status_code == 201

        # BB now has 100.0 - 0.20 (blind) - 0.80 (call) = 99.0
        resp = client.get(f'/games/{game_id}')
        bb_player = [p for p in resp.json()['players'] if p['name'] == bb_name][0]
        assert bb_player['current_chips'] == 99.0


class TestChipStackInHandStatus:
    def test_hand_status_shows_current_chips(self, client):
        """The hand status endpoint should also reflect each player's current chip count."""
        game = _create_game_with_buy_ins(client, buy_in=100.0)
        game_id = game['game_id']

        resp = client.post(f'/games/{game_id}/hands/start')
        assert resp.status_code == 201
        hand = resp.json()
        hn = hand['hand_number']
        activate_hand(client, game_id, hand)

        sb_name = hand['sb_player_name']
        bb_name = hand['bb_player_name']

        # Check hand status — players should have current_chips (reduced by blinds)
        resp = client.get(f'/games/{game_id}/hands/{hn}/status')
        assert resp.status_code == 200
        players_map = {p['name']: p for p in resp.json()['players']}
        assert 'current_chips' in players_map[sb_name]
        assert players_map[sb_name]['current_chips'] == 99.90
        assert players_map[bb_name]['current_chips'] == 99.80


class TestAutoDeactivateZeroChips:
    def test_player_deactivated_when_chips_hit_zero(self, client):
        """A player whose current_chips reach 0 after results should be auto-deactivated."""
        game = _create_game_with_buy_ins(client, buy_in=10.0)
        game_id = game['game_id']

        resp = client.post(f'/games/{game_id}/hands/start')
        assert resp.status_code == 201
        hand = resp.json()
        hn = hand['hand_number']
        activate_hand(client, game_id, hand)

        sb_name = hand['sb_player_name']
        bb_name = hand['bb_player_name']

        # Record results: loser loses all (profit_loss = -buy_in), winner wins
        resp = client.patch(
            f'/games/{game_id}/hands/{hn}/results',
            json=[
                {'player_name': sb_name, 'result': 'lost', 'profit_loss': -10.0},
                {'player_name': bb_name, 'result': 'won', 'profit_loss': 10.0},
            ],
        )
        assert resp.status_code == 200

        # Verify loser is now inactive
        resp = client.get(f'/games/{game_id}')
        assert resp.status_code == 200
        players_map = {p['name']: p for p in resp.json()['players']}
        assert players_map[sb_name]['is_active'] is False
        assert players_map[sb_name]['current_chips'] <= 0

        # Winner should still be active
        assert players_map[bb_name]['is_active'] is True

    def test_player_stays_active_when_chips_above_zero(self, client):
        """A player who still has chips after results should remain active."""
        game = _create_game_with_buy_ins(client, buy_in=100.0)
        game_id = game['game_id']

        resp = client.post(f'/games/{game_id}/hands/start')
        assert resp.status_code == 201
        hand = resp.json()
        hn = hand['hand_number']
        activate_hand(client, game_id, hand)

        sb_name = hand['sb_player_name']
        bb_name = hand['bb_player_name']

        resp = client.patch(
            f'/games/{game_id}/hands/{hn}/results',
            json=[
                {'player_name': sb_name, 'result': 'lost', 'profit_loss': -5.0},
                {'player_name': bb_name, 'result': 'won', 'profit_loss': 5.0},
            ],
        )
        assert resp.status_code == 200

        resp = client.get(f'/games/{game_id}')
        players_map = {p['name']: p for p in resp.json()['players']}
        assert players_map[sb_name]['is_active'] is True
        assert players_map[bb_name]['is_active'] is True

    def test_single_player_result_deactivates_when_chips_hit_zero(self, client):
        """The single-player PATCH .../result endpoint should auto-deactivate when chips hit 0."""
        game = _create_game_with_buy_ins(client, buy_in=10.0)
        game_id = game['game_id']

        resp = client.post(f'/games/{game_id}/hands/start')
        assert resp.status_code == 201
        hand = resp.json()
        hn = hand['hand_number']
        activate_hand(client, game_id, hand)

        sb_name = hand['sb_player_name']
        bb_name = hand['bb_player_name']

        # Record single-player result: loser loses all
        resp = client.patch(
            f'/games/{game_id}/hands/{hn}/players/{sb_name}/result',
            json={'result': 'lost', 'profit_loss': -10.0},
        )
        assert resp.status_code == 200

        # Winner result
        resp = client.patch(
            f'/games/{game_id}/hands/{hn}/players/{bb_name}/result',
            json={'result': 'won', 'profit_loss': 10.0},
        )
        assert resp.status_code == 200

        # Verify loser is now inactive
        resp = client.get(f'/games/{game_id}')
        assert resp.status_code == 200
        players_map = {p['name']: p for p in resp.json()['players']}
        assert players_map[sb_name]['is_active'] is False
        assert players_map[sb_name]['current_chips'] <= 0

        # Winner should still be active
        assert players_map[bb_name]['is_active'] is True
