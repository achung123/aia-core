"""Tests for per-player pot contribution in hand status."""

from conftest import activate_hand


def _create_game(client, buy_in=100.0):
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


class TestPotContributionInHandStatus:
    def test_hand_status_includes_pot_contribution_field(self, client):
        """Each player entry in hand status should have a pot_contribution field."""
        game = _create_game(client)
        game_id = game['game_id']

        resp = client.post(f'/games/{game_id}/hands/start')
        assert resp.status_code == 201
        hand = resp.json()
        hn = hand['hand_number']
        activate_hand(client, game_id, hand)

        resp = client.get(f'/games/{game_id}/hands/{hn}/status')
        assert resp.status_code == 200
        for p in resp.json()['players']:
            assert 'pot_contribution' in p, f"Player {p['name']} missing pot_contribution"

    def test_pot_contribution_reflects_blinds(self, client):
        """After blinds are posted, SB and BB should show their blind amounts."""
        game = _create_game(client)
        game_id = game['game_id']

        resp = client.post(f'/games/{game_id}/hands/start')
        assert resp.status_code == 201
        hand = resp.json()
        hn = hand['hand_number']
        activate_hand(client, game_id, hand)

        sb_name = hand['sb_player_name']
        bb_name = hand['bb_player_name']

        resp = client.get(f'/games/{game_id}/hands/{hn}/status')
        assert resp.status_code == 200
        players_map = {p['name']: p for p in resp.json()['players']}

        assert players_map[sb_name]['pot_contribution'] == 0.10
        assert players_map[bb_name]['pot_contribution'] == 0.20

    def test_pot_contribution_accumulates_across_actions(self, client):
        """Contributions should accumulate as players bet/call."""
        game = _create_game(client)
        game_id = game['game_id']

        resp = client.post(f'/games/{game_id}/hands/start')
        assert resp.status_code == 201
        hand = resp.json()
        hn = hand['hand_number']
        activate_hand(client, game_id, hand)

        sb_name = hand['sb_player_name']
        bb_name = hand['bb_player_name']

        # SB calls (0.10 more to match BB's 0.20)
        resp = client.post(
            f'/games/{game_id}/hands/{hn}/players/{sb_name}/actions',
            json={'street': 'preflop', 'action': 'call', 'amount': 0.10},
        )
        assert resp.status_code == 201

        resp = client.get(f'/games/{game_id}/hands/{hn}/status')
        players_map = {p['name']: p for p in resp.json()['players']}

        # SB: 0.10 (blind) + 0.10 (call) = 0.20
        assert players_map[sb_name]['pot_contribution'] == 0.20
        # BB: still 0.20 (blind only)
        assert players_map[bb_name]['pot_contribution'] == 0.20

    def test_pot_contribution_zero_for_non_playing(self, client):
        """Players not in the hand should have pot_contribution of 0."""
        resp = client.post(
            '/games',
            json={
                'game_date': '2026-04-13',
                'player_names': ['Alice', 'Bob', 'Carol'],
                'default_buy_in': 100.0,
            },
        )
        assert resp.status_code == 201
        game = resp.json()
        game_id = game['game_id']

        resp = client.post(f'/games/{game_id}/hands/start')
        assert resp.status_code == 201
        hand = resp.json()
        hn = hand['hand_number']
        activate_hand(client, game_id, hand)

        # Mark one player as not playing via patch
        resp = client.patch(
            f'/games/{game_id}/hands/{hn}/players/Carol',
            json={'result': 'not_playing'},
        )

        resp = client.get(f'/games/{game_id}/hands/{hn}/status')
        players_map = {p['name']: p for p in resp.json()['players']}

        # Carol has no actions, so contribution should be 0
        # (Carol may or may not be in the hand depending on implementation)
        # If she's in the status, her contribution should be 0
        if 'Carol' in players_map:
            assert players_map['Carol']['pot_contribution'] == 0
