"""Tests for state machine behavior fixes.

Issue 1: Seat assignment restricted after hands start (player-side only)
Issue 2: street_complete flag in hand status for dealer UI
Issue 3: is_current_turn flag on player status entries
Issue 4: winning_hand_description in player hand responses
"""

from conftest import activate_hand


# ── helpers ──────────────────────────────────────────────────────────


def _create_game(client, names=None):
    if names is None:
        names = ['Alice', 'Bob', 'Charlie']
    resp = client.post(
        '/games', json={'game_date': '2026-04-12', 'player_names': names}
    )
    assert resp.status_code == 201
    return resp.json()


def _start_hand(client, game_id):
    resp = client.post(f'/games/{game_id}/hands/start')
    assert resp.status_code == 201
    hand = resp.json()
    activate_hand(client, game_id, hand)
    hn = hand['hand_number']
    return client.get(f'/games/{game_id}/hands/{hn}').json()


def _status(client, game_id, hand_number=1):
    return client.get(f'/games/{game_id}/hands/{hand_number}/status').json()


def _state(client, game_id, hand_number=1):
    return client.get(f'/games/{game_id}/hands/{hand_number}/state').json()


def _act(client, game_id, player_name, action, amount=None, hand_number=1):
    street = _state(client, game_id, hand_number)['phase']
    payload = {'street': street, 'action': action}
    if amount is not None:
        payload['amount'] = amount
    return client.post(
        f'/games/{game_id}/hands/{hand_number}/players/{player_name}/actions',
        json=payload,
    )


def _current(client, game_id, hand_number=1):
    return _state(client, game_id, hand_number)['current_player_name']


# ────────────────────────────────────────────────────────────────────
# Issue 1: Seat assignment restricted after game has hands
# ────────────────────────────────────────────────────────────────────


class TestSeatRestrictionAfterHandsStart:
    """PATCH .../seat should reject player requests once hands have been played."""

    def test_seat_assignment_works_before_first_hand(self, client):
        """Before any hand starts, seat assignment works normally."""
        game = _create_game(client)
        resp = client.patch(
            f'/games/{game["game_id"]}/players/Alice/seat',
            json={'seat_number': 5},
        )
        assert resp.status_code == 200
        assert resp.json()['seat_number'] == 5

    def test_seat_assignment_rejected_after_hand_starts(self, client):
        """After a hand has been played, seat reassignment is rejected (403)."""
        game = _create_game(client)
        game_id = game['game_id']
        _start_hand(client, game_id)

        resp = client.patch(
            f'/games/{game_id}/players/Alice/seat',
            json={'seat_number': 7},
        )
        assert resp.status_code == 403

    def test_seat_assignment_allowed_with_force_after_hand_starts(self, client):
        """Dealer can still reassign seats with ?force=true."""
        game = _create_game(client)
        game_id = game['game_id']
        _start_hand(client, game_id)

        resp = client.patch(
            f'/games/{game_id}/players/Alice/seat?force=true',
            json={'seat_number': 7},
        )
        assert resp.status_code == 200
        assert resp.json()['seat_number'] == 7


# ────────────────────────────────────────────────────────────────────
# Issue 2: street_complete flag in hand status
# ────────────────────────────────────────────────────────────────────


class TestStreetCompleteFlag:
    """HandStatusResponse should include street_complete to control dealer UI."""

    def test_street_not_complete_at_hand_start(self, client):
        """After hand start, preflop is NOT complete — UTG hasn't acted."""
        game = _create_game(client)
        game_id = game['game_id']
        _start_hand(client, game_id)

        status = _status(client, game_id)
        assert 'street_complete' in status
        assert status['street_complete'] is False

    def test_street_complete_after_all_players_act(self, client):
        """After all players act (UTG calls, SB calls, BB checks), preflop is complete."""
        game = _create_game(client)
        game_id = game['game_id']
        hand = _start_hand(client, game_id)

        # UTG calls
        utg = _current(client, game_id)
        _act(client, game_id, utg, 'call', amount=0.20)
        # SB calls
        sb = _current(client, game_id)
        _act(client, game_id, sb, 'call', amount=0.10)
        # BB checks
        bb = _current(client, game_id)
        _act(client, game_id, bb, 'check')

        status = _status(client, game_id)
        assert status['street_complete'] is True

    def test_street_not_complete_mid_round(self, client):
        """After UTG calls but before SB and BB act, preflop is NOT complete."""
        game = _create_game(client)
        game_id = game['game_id']
        _start_hand(client, game_id)

        # Only UTG calls
        utg = _current(client, game_id)
        _act(client, game_id, utg, 'call', amount=0.20)

        status = _status(client, game_id)
        assert status['street_complete'] is False


# ────────────────────────────────────────────────────────────────────
# Issue 3: is_current_turn flag on player status entries
# ────────────────────────────────────────────────────────────────────


class TestPlayerCurrentTurnFlag:
    """PlayerStatusEntry should include is_current_turn for the player waiting screen."""

    def test_current_player_has_is_current_turn_true(self, client):
        """The player whose turn it is has is_current_turn = True."""
        game = _create_game(client)
        game_id = game['game_id']
        _start_hand(client, game_id)

        status = _status(client, game_id)
        current_name = status['current_player_name']
        for p in status['players']:
            if p['name'] == current_name:
                assert p['is_current_turn'] is True
            else:
                assert p['is_current_turn'] is False

    def test_turn_moves_after_action(self, client):
        """After UTG acts, the next player gets is_current_turn."""
        game = _create_game(client)
        game_id = game['game_id']
        _start_hand(client, game_id)

        utg = _current(client, game_id)
        _act(client, game_id, utg, 'call', amount=0.20)

        status = _status(client, game_id)
        new_current = status['current_player_name']
        assert new_current != utg
        for p in status['players']:
            assert p['is_current_turn'] == (p['name'] == new_current)


# ────────────────────────────────────────────────────────────────────
# Issue 4: winning_hand_description in player hand responses
# ────────────────────────────────────────────────────────────────────


class TestWinningHandDescription:
    """PlayerHandResponse should include winning_hand_description when cards are known."""

    def test_hand_response_includes_winning_hand_description_field(self, client):
        """The PlayerHandResponse schema includes winning_hand_description."""
        game = _create_game(client)
        game_id = game['game_id']
        hand = _start_hand(client, game_id)

        # Set hole cards for a player
        client.patch(
            f'/games/{game_id}/hands/1/players/Alice',
            json={'card_1': 'AS', 'card_2': 'KS'},
        )

        resp = client.get(f'/games/{game_id}/hands/1')
        hand_data = resp.json()
        for ph in hand_data['player_hands']:
            assert 'winning_hand_description' in ph

    def test_winning_hand_description_populated_with_full_board(self, client):
        """When both hole cards and all community cards are present, description is populated."""
        game = _create_game(client)
        game_id = game['game_id']
        _start_hand(client, game_id)

        # Set Alice's hole cards
        client.patch(
            f'/games/{game_id}/hands/1/players/Alice',
            json={'card_1': 'AS', 'card_2': 'KS'},
        )
        # Set community cards that make a flush
        client.patch(
            f'/games/{game_id}/hands/1',
            json={
                'flop_1': 'QS',
                'flop_2': 'JS',
                'flop_3': '2S',
                'turn': '7H',
                'river': '3D',
            },
        )

        resp = client.get(f'/games/{game_id}/hands/1')
        hand_data = resp.json()
        alice_ph = next(
            p for p in hand_data['player_hands'] if p['player_name'] == 'Alice'
        )
        assert alice_ph['winning_hand_description'] is not None
        assert 'flush' in alice_ph['winning_hand_description'].lower()

    def test_winning_hand_description_null_without_community_cards(self, client):
        """Without community cards, winning_hand_description is null."""
        game = _create_game(client)
        game_id = game['game_id']
        _start_hand(client, game_id)

        client.patch(
            f'/games/{game_id}/hands/1/players/Alice',
            json={'card_1': 'AS', 'card_2': 'KS'},
        )

        resp = client.get(f'/games/{game_id}/hands/1')
        hand_data = resp.json()
        alice_ph = next(
            p for p in hand_data['player_hands'] if p['player_name'] == 'Alice'
        )
        assert alice_ph['winning_hand_description'] is None

    def test_winning_hand_description_null_without_hole_cards(self, client):
        """Without hole cards, winning_hand_description is null."""
        game = _create_game(client)
        game_id = game['game_id']
        _start_hand(client, game_id)

        # Set community cards but no hole cards
        client.patch(
            f'/games/{game_id}/hands/1',
            json={
                'flop_1': 'QS',
                'flop_2': 'JS',
                'flop_3': '2S',
                'turn': '7H',
                'river': '3D',
            },
        )

        resp = client.get(f'/games/{game_id}/hands/1')
        hand_data = resp.json()
        # All players without hole cards should have null
        for ph in hand_data['player_hands']:
            if ph['card_1'] is None:
                assert ph['winning_hand_description'] is None
