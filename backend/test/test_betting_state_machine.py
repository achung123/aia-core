"""Tests for the betting state machine: blinds, turn order, pot, side pots.

Covers acceptance criteria for aia-core-ndtd / T-002.
"""

import pytest
from fastapi.testclient import TestClient

from app.database.session import get_db
from app.main import app
from conftest import activate_hand, override_get_db


@pytest.fixture
def client():
    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()


def _create_game(client, names):
    """Helper: create a game and return game_id."""
    resp = client.post(
        '/games', json={'game_date': '2026-04-12', 'player_names': names}
    )
    assert resp.status_code == 201
    return resp.json()['game_id']


def _start_hand(client, game_id):
    resp = client.post(f'/games/{game_id}/hands/start')
    assert resp.status_code == 201
    hand = resp.json()
    activate_hand(client, game_id, hand)
    hn = hand['hand_number']
    return client.get(f'/games/{game_id}/hands/{hn}').json()


def _state(client, game_id, hand_number=1):
    return client.get(f'/games/{game_id}/hands/{hand_number}/state').json()


def _status(client, game_id, hand_number=1):
    return client.get(f'/games/{game_id}/hands/{hand_number}/status').json()


def _act(
    client,
    game_id,
    player_name,
    action,
    amount=None,
    hand_number=1,
    street=None,
    is_all_in=False,
):
    """Record an action for the given player. Auto-detects street from state if not given."""
    if street is None:
        street = _state(client, game_id, hand_number)['phase']
    payload = {'street': street, 'action': action}
    if amount is not None:
        payload['amount'] = amount
    if is_all_in:
        payload['is_all_in'] = True
    return client.post(
        f'/games/{game_id}/hands/{hand_number}/players/{player_name}/actions',
        json=payload,
    )


def _current(client, game_id, hand_number=1):
    """Return the name of the current player to act."""
    return _state(client, game_id, hand_number)['current_player_name']


# ────────────────────────────────────────────────────────────────────
# BUG FIX: negative action amounts must be rejected (aia-core-n01m)
# ────────────────────────────────────────────────────────────────────


class TestNegativeAmountRejected:
    def test_negative_amount_returns_422(self, client):
        """A negative amount on a player action must be rejected by validation."""
        game_id = _create_game(client, ['Alice', 'Bob', 'Charlie'])
        _start_hand(client, game_id)
        current = _current(client, game_id)
        resp = _act(client, game_id, current, 'call', amount=-5.0)
        assert resp.status_code == 422


# ────────────────────────────────────────────────────────────────────
# AC 1: start-all creates blind actions and initializes pot = SB + BB
# ────────────────────────────────────────────────────────────────────


class TestBlindPosting:
    def test_start_hand_creates_blind_actions(self, client):
        game_id = _create_game(client, ['Alice', 'Bob', 'Charlie'])
        hand = _start_hand(client, game_id)
        hn = hand['hand_number']

        actions = client.get(f'/games/{game_id}/hands/{hn}/actions').json()
        blind_actions = [a for a in actions if a['action'] == 'blind']
        assert len(blind_actions) == 2

        sb_action = blind_actions[0]
        assert sb_action['amount'] == 0.10
        assert sb_action['player_name'] == hand['sb_player_name']

        bb_action = blind_actions[1]
        assert bb_action['amount'] == 0.20
        assert bb_action['player_name'] == hand['bb_player_name']

    def test_start_hand_initializes_pot(self, client):
        game_id = _create_game(client, ['Alice', 'Bob', 'Charlie'])
        hand = _start_hand(client, game_id)
        assert hand['pot'] == pytest.approx(0.30)

    def test_start_hand_sets_utg_as_current(self, client):
        game_id = _create_game(client, ['Alice', 'Bob', 'Charlie'])
        hand = _start_hand(client, game_id)
        state = _state(client, game_id, hand['hand_number'])
        assert state['phase'] == 'preflop'
        # UTG should not be SB or BB
        assert state['current_player_name'] not in (
            hand['sb_player_name'],
            hand['bb_player_name'],
        )


# ────────────────────────────────────────────────────────────────────
# AC 2: start-all returns 400 if fewer than 2 active players
# ────────────────────────────────────────────────────────────────────


class TestStartHandMinPlayers:
    def test_fewer_than_2_returns_400(self, client):
        game_id = _create_game(client, ['Alice', 'Bob'])
        client.patch(f'/games/{game_id}/players/Bob/status', json={'is_active': False})
        resp = client.post(f'/games/{game_id}/hands/start')
        assert resp.status_code == 400


# ────────────────────────────────────────────────────────────────────
# AC 3: GET .../status returns betting fields
# ────────────────────────────────────────────────────────────────────


class TestHandStatusBettingFields:
    def test_status_returns_new_fields(self, client):
        game_id = _create_game(client, ['Alice', 'Bob', 'Charlie'])
        _start_hand(client, game_id)
        status = _status(client, game_id)

        assert 'current_player_name' in status
        assert 'legal_actions' in status
        assert 'amount_to_call' in status
        assert 'minimum_bet' in status
        assert 'minimum_raise' in status
        assert 'pot' in status
        assert 'side_pots' in status

    def test_status_pot_equals_blinds_after_start(self, client):
        game_id = _create_game(client, ['Alice', 'Bob', 'Charlie'])
        _start_hand(client, game_id)
        status = _status(client, game_id)
        assert status['pot'] == pytest.approx(0.30)
        assert status['side_pots'] == []

    def test_status_legal_actions_for_utg(self, client):
        """UTG faces a bet (the BB), so legal actions should include call/raise/fold."""
        game_id = _create_game(client, ['Alice', 'Bob', 'Charlie'])
        _start_hand(client, game_id)
        status = _status(client, game_id)
        assert 'call' in status['legal_actions']
        assert 'fold' in status['legal_actions']
        assert status['amount_to_call'] == pytest.approx(0.20)
        assert status['minimum_bet'] is None
        assert status['minimum_raise'] == pytest.approx(0.40)

    def test_status_legal_actions_bb_option(self, client):
        """When everyone calls, BB can check (amount_to_call == 0)."""
        game_id = _create_game(client, ['Alice', 'Bob', 'Charlie'])
        hand = _start_hand(client, game_id)

        # UTG calls
        utg = _current(client, game_id)
        _act(client, game_id, utg, 'call', amount=0.20)
        # SB calls
        sb = _current(client, game_id)
        _act(client, game_id, sb, 'call', amount=0.10)

        # BB should have check/raise/fold (raise, not bet — blinds are on the table)
        status = _status(client, game_id)
        current = status['current_player_name']
        assert current == hand['bb_player_name']
        assert 'check' in status['legal_actions']
        assert 'raise' in status['legal_actions']
        assert status['amount_to_call'] == 0
        assert status['minimum_bet'] is None
        assert status['minimum_raise'] == pytest.approx(0.20)


# ────────────────────────────────────────────────────────────────────
# AC 4: POST .../actions returns 403 when non-current player acts
# ────────────────────────────────────────────────────────────────────


class TestTurnOrderEnforcement:
    def test_non_current_player_gets_403(self, client):
        game_id = _create_game(client, ['Alice', 'Bob', 'Charlie'])
        _start_hand(client, game_id)
        current = _current(client, game_id)
        wrong = next(n for n in ['Alice', 'Bob', 'Charlie'] if n != current)

        resp = _act(client, game_id, wrong, 'call', amount=0.20)
        assert resp.status_code == 403

    def test_force_true_bypasses_turn_order(self, client):
        game_id = _create_game(client, ['Alice', 'Bob', 'Charlie'])
        _start_hand(client, game_id)
        current = _current(client, game_id)
        wrong = next(n for n in ['Alice', 'Bob', 'Charlie'] if n != current)

        resp = client.post(
            f'/games/{game_id}/hands/1/players/{wrong}/actions?force=true',
            json={'street': 'preflop', 'action': 'fold'},
        )
        assert resp.status_code == 201


# ────────────────────────────────────────────────────────────────────
# AC 5: current_seat advances; after street completion phase advances
# ────────────────────────────────────────────────────────────────────


class TestSeatAndPhaseAdvancement:
    def test_seat_advances_after_action(self, client):
        game_id = _create_game(client, ['Alice', 'Bob', 'Charlie'])
        _start_hand(client, game_id)
        before = _state(client, game_id)
        p = before['current_player_name']

        _act(client, game_id, p, 'call', amount=0.20)

        after = _state(client, game_id)
        assert after['current_player_name'] != p
        assert after['current_seat'] != before['current_seat']

    def test_preflop_to_flop_transition(self, client):
        """Full preflop round: UTG call, SB call, BB check → phase advances to flop."""
        game_id = _create_game(client, ['Alice', 'Bob', 'Charlie'])
        _start_hand(client, game_id)

        # Deal flop so phase CAN advance
        client.patch(
            f'/games/{game_id}/hands/1/flop',
            json={'flop_1': '9H', 'flop_2': 'JD', 'flop_3': 'QS'},
        )

        # UTG calls
        _act(client, game_id, _current(client, game_id), 'call', amount=0.20)
        # SB calls (0.10 more to match)
        _act(client, game_id, _current(client, game_id), 'call', amount=0.10)
        # BB checks
        _act(client, game_id, _current(client, game_id), 'check')

        state = _state(client, game_id)
        assert state['phase'] == 'flop'

    def test_full_preflop_round_with_raise(self, client):
        """UTG raises, SB/BB call → street complete."""
        game_id = _create_game(client, ['Alice', 'Bob', 'Charlie'])
        _start_hand(client, game_id)

        client.patch(
            f'/games/{game_id}/hands/1/flop',
            json={'flop_1': '9H', 'flop_2': 'JD', 'flop_3': 'QS'},
        )

        # UTG raises to 0.60
        _act(client, game_id, _current(client, game_id), 'raise', amount=0.60)
        # SB calls (0.50 more)
        _act(client, game_id, _current(client, game_id), 'call', amount=0.50)
        # BB calls (0.40 more)
        _act(client, game_id, _current(client, game_id), 'call', amount=0.40)

        state = _state(client, game_id)
        assert state['phase'] == 'flop'


# ────────────────────────────────────────────────────────────────────
# AC 6: fold-to-one ends the hand, remaining player wins
# ────────────────────────────────────────────────────────────────────


class TestFoldToOne:
    def test_fold_to_one_two_players(self, client):
        game_id = _create_game(client, ['Alice', 'Bob'])
        _start_hand(client, game_id)

        folder = _current(client, game_id)
        _act(client, game_id, folder, 'fold')

        hand = client.get(f'/games/{game_id}/hands/1').json()
        winners = [ph for ph in hand['player_hands'] if ph['result'] == 'won']
        assert len(winners) == 1
        assert winners[0]['player_name'] != folder

    def test_fold_to_one_three_players(self, client):
        game_id = _create_game(client, ['Alice', 'Bob', 'Charlie'])
        _start_hand(client, game_id)

        # First two players fold
        _act(client, game_id, _current(client, game_id), 'fold')
        _act(client, game_id, _current(client, game_id), 'fold')

        hand = client.get(f'/games/{game_id}/hands/1').json()
        winners = [ph for ph in hand['player_hands'] if ph['result'] == 'won']
        assert len(winners) == 1

    def test_fold_to_one_sets_showdown_phase(self, client):
        game_id = _create_game(client, ['Alice', 'Bob'])
        _start_hand(client, game_id)
        _act(client, game_id, _current(client, game_id), 'fold')

        state = _state(client, game_id)
        assert state['phase'] == 'showdown'


# ────────────────────────────────────────────────────────────────────
# AC 7: pot accumulates correctly across actions
# ────────────────────────────────────────────────────────────────────


class TestPotTracking:
    def test_pot_accumulates_on_calls(self, client):
        game_id = _create_game(client, ['Alice', 'Bob', 'Charlie'])
        _start_hand(client, game_id)

        # After blinds: pot = 0.30
        hand = client.get(f'/games/{game_id}/hands/1').json()
        assert hand['pot'] == pytest.approx(0.30)

        # UTG calls 0.20
        _act(client, game_id, _current(client, game_id), 'call', amount=0.20)
        hand = client.get(f'/games/{game_id}/hands/1').json()
        assert hand['pot'] == pytest.approx(0.50)

        # SB calls 0.10
        _act(client, game_id, _current(client, game_id), 'call', amount=0.10)
        hand = client.get(f'/games/{game_id}/hands/1').json()
        assert hand['pot'] == pytest.approx(0.60)

    def test_pot_accumulates_on_raise(self, client):
        game_id = _create_game(client, ['Alice', 'Bob', 'Charlie'])
        _start_hand(client, game_id)

        # UTG raises to 0.60
        _act(client, game_id, _current(client, game_id), 'raise', amount=0.60)
        hand = client.get(f'/games/{game_id}/hands/1').json()
        assert hand['pot'] == pytest.approx(0.90)  # 0.30 (blinds) + 0.60


# ────────────────────────────────────────────────────────────────────
# AC 8: all-in-for-less triggers side-pot creation
# ────────────────────────────────────────────────────────────────────


class TestSidePots:
    def test_all_in_for_less_creates_side_pot(self, client):
        """SB calls for less than required → side pot created."""
        game_id = _create_game(client, ['Alice', 'Bob', 'Charlie'])
        _start_hand(client, game_id)

        # UTG raises to 1.00
        _act(client, game_id, _current(client, game_id), 'raise', amount=1.00)
        # SB calls 0.50 (all-in-for-less: needs 0.90 but only puts in 0.50)
        _act(
            client,
            game_id,
            _current(client, game_id),
            'call',
            amount=0.50,
            is_all_in=True,
        )
        # BB calls 0.80 (full call)
        _act(client, game_id, _current(client, game_id), 'call', amount=0.80)

        hand = client.get(f'/games/{game_id}/hands/1').json()
        # Total pot = 0.10 + 0.20 + 1.00 + 0.50 + 0.80 = 2.60
        assert hand['pot'] == pytest.approx(2.60)
        # Side pots should exist since SB is all-in for less
        assert len(hand['side_pots']) >= 1
        # Each side pot should have amount and eligible player IDs
        for sp in hand['side_pots']:
            assert 'amount' in sp
            assert 'eligible_players' in sp

    def test_three_way_all_in_side_pots(self, client):
        """Three different contribution levels → two side pots."""
        game_id = _create_game(client, ['Alice', 'Bob', 'Charlie'])
        _start_hand(client, game_id)

        # UTG raises to 2.00
        _act(client, game_id, _current(client, game_id), 'raise', amount=2.00)
        # SB calls 0.50 (all-in, total = 0.60)
        _act(
            client,
            game_id,
            _current(client, game_id),
            'call',
            amount=0.50,
            is_all_in=True,
        )
        # BB calls 0.80 (all-in, total = 1.00)
        _act(
            client,
            game_id,
            _current(client, game_id),
            'call',
            amount=0.80,
            is_all_in=True,
        )

        hand = client.get(f'/games/{game_id}/hands/1').json()
        # Total = 0.10 + 0.20 + 2.00 + 0.50 + 0.80 = 3.60
        assert hand['pot'] == pytest.approx(3.60)
        # Should have 2 side pots (SB contributes least, BB mid, UTG most)
        assert len(hand['side_pots']) == 2


# ────────────────────────────────────────────────────────────────────
# AC 9: no all-in → side_pots is [] and pot holds full amount
# ────────────────────────────────────────────────────────────────────


class TestNoSidePots:
    def test_no_side_pots_without_all_in(self, client):
        game_id = _create_game(client, ['Alice', 'Bob', 'Charlie'])
        _start_hand(client, game_id)

        # UTG calls (full amount)
        _act(client, game_id, _current(client, game_id), 'call', amount=0.20)

        hand = client.get(f'/games/{game_id}/hands/1').json()
        assert hand['side_pots'] == []
        assert hand['pot'] == pytest.approx(0.50)


# ────────────────────────────────────────────────────────────────────
# AC 11: legal action calculator unit tests
# ────────────────────────────────────────────────────────────────────


class TestLegalActionCalculator:
    def test_no_bet_allows_check_bet(self):
        from app.services.betting import get_legal_actions

        result = get_legal_actions(
            phase='flop',
            actions_this_street=[],
            current_player_id=1,
            blind_amounts=(0.10, 0.20),
        )
        assert 'check' in result['legal_actions']
        assert 'bet' in result['legal_actions']
        assert result['amount_to_call'] == 0
        assert result['minimum_bet'] == pytest.approx(0.20)
        assert result['minimum_raise'] is None

    def test_facing_bet_allows_call_raise(self):
        from app.services.betting import get_legal_actions

        result = get_legal_actions(
            phase='flop',
            actions_this_street=[
                {'player_id': 1, 'action': 'bet', 'amount': 0.50},
            ],
            current_player_id=2,
            blind_amounts=(0.10, 0.20),
        )
        assert 'call' in result['legal_actions']
        assert 'raise' in result['legal_actions']
        assert result['amount_to_call'] == pytest.approx(0.50)
        assert result['minimum_bet'] is None
        assert result['minimum_raise'] == pytest.approx(1.00)

    def test_preflop_utg_faces_bb(self):
        from app.services.betting import get_legal_actions

        result = get_legal_actions(
            phase='preflop',
            actions_this_street=[
                {'player_id': 1, 'action': 'blind', 'amount': 0.10},
                {'player_id': 2, 'action': 'blind', 'amount': 0.20},
            ],
            current_player_id=3,
            blind_amounts=(0.10, 0.20),
        )
        assert 'call' in result['legal_actions']
        assert result['amount_to_call'] == pytest.approx(0.20)
        assert result['minimum_bet'] is None
        assert result['minimum_raise'] == pytest.approx(0.40)


# ────────────────────────────────────────────────────────────────────
# Street completion unit tests
# ────────────────────────────────────────────────────────────────────


class TestStreetCompletion:
    def test_preflop_bb_must_act(self):
        """BB blind is not a voluntary action; BB must still act."""
        from app.services.betting import is_street_complete

        actions = [
            {'player_id': 1, 'action': 'blind', 'amount': 0.10},
            {'player_id': 2, 'action': 'blind', 'amount': 0.20},
            {'player_id': 3, 'action': 'call', 'amount': 0.20},
            {'player_id': 1, 'action': 'call', 'amount': 0.10},
        ]
        # BB hasn't acted voluntarily yet
        assert not is_street_complete(
            actions, {1, 2, 3}, set(), 'preflop', bb_player_id=2
        )

    def test_preflop_complete_after_bb_checks(self):
        from app.services.betting import is_street_complete

        actions = [
            {'player_id': 1, 'action': 'blind', 'amount': 0.10},
            {'player_id': 2, 'action': 'blind', 'amount': 0.20},
            {'player_id': 3, 'action': 'call', 'amount': 0.20},
            {'player_id': 1, 'action': 'call', 'amount': 0.10},
            {'player_id': 2, 'action': 'check', 'amount': 0},
        ]
        assert is_street_complete(actions, {1, 2, 3}, set(), 'preflop', bb_player_id=2)

    def test_postflop_all_check(self):
        from app.services.betting import is_street_complete

        actions = [
            {'player_id': 1, 'action': 'check', 'amount': 0},
            {'player_id': 2, 'action': 'check', 'amount': 0},
        ]
        assert is_street_complete(actions, {1, 2}, set(), 'flop', bb_player_id=2)

    def test_raise_requires_others_to_act(self):
        from app.services.betting import is_street_complete

        actions = [
            {'player_id': 1, 'action': 'blind', 'amount': 0.10},
            {'player_id': 2, 'action': 'blind', 'amount': 0.20},
            {'player_id': 3, 'action': 'raise', 'amount': 0.60},
            {'player_id': 1, 'action': 'call', 'amount': 0.50},
        ]
        # BB hasn't responded to the raise
        assert not is_street_complete(
            actions, {1, 2, 3}, set(), 'preflop', bb_player_id=2
        )

    def test_single_acting_player_postflop_no_actions_is_complete(self):
        """One non-all-in player on a post-flop street with no actions — complete."""
        from app.services.betting import is_street_complete

        # Player 1 is all-in, player 2 covered the all-in.
        # On flop, no actions yet. Only player 2 can act, but nobody to bet against.
        assert is_street_complete(
            [], {1, 2}, {1}, 'flop', bb_player_id=2
        )

    def test_single_acting_player_preflop_not_complete(self):
        """One acting player on preflop still needs to respond to an all-in."""
        from app.services.betting import is_street_complete

        actions = [
            {'player_id': 1, 'action': 'blind', 'amount': 0.10},
            {'player_id': 2, 'action': 'blind', 'amount': 0.20},
            {'player_id': 1, 'action': 'raise', 'amount': 10.00},
        ]
        # Player 1 went all-in, player 2 hasn't responded yet
        assert not is_street_complete(
            actions, {1, 2}, {1}, 'preflop', bb_player_id=2
        )

    def test_single_acting_player_turn_is_complete(self):
        """One non-all-in player on the turn — complete immediately."""
        from app.services.betting import is_street_complete

        assert is_street_complete(
            [], {1, 2, 3}, {1, 2}, 'turn', bb_player_id=2
        )

    def test_single_acting_player_river_is_complete(self):
        """One non-all-in player on the river — complete immediately."""
        from app.services.betting import is_street_complete

        assert is_street_complete(
            [], {1, 2}, {1}, 'river', bb_player_id=2
        )


# ────────────────────────────────────────────────────────────────────
# Side pot computation unit tests
# ────────────────────────────────────────────────────────────────────


class TestComputeSidePots:
    def test_no_all_in_returns_empty(self):
        from app.services.betting import compute_side_pots

        result = compute_side_pots({1: 1.0, 2: 1.0}, set(), {1, 2})
        assert result == []

    def test_two_way_all_in(self):
        from app.services.betting import compute_side_pots

        # Player 1 contributes 0.60, player 2 contributes 1.00
        result = compute_side_pots(
            {1: 0.60, 2: 1.00, 3: 1.00},
            {1},
            {1, 2, 3},
        )
        assert len(result) == 1
        assert result[0]['amount'] == pytest.approx(0.80)  # (1.00-0.60)*2
        assert 1 not in result[0]['eligible_player_ids']

    def test_three_way_all_in(self):
        from app.services.betting import compute_side_pots

        # Player 1: 0.60, Player 2: 1.00, Player 3: 2.00
        result = compute_side_pots(
            {1: 0.60, 2: 1.00, 3: 2.00},
            {1, 2},
            {1, 2, 3},
        )
        assert len(result) == 2
        # Side pot 1: (1.00-0.60)*2 = 0.80  (players 2,3)
        assert result[0]['amount'] == pytest.approx(0.80)
        # Side pot 2: (2.00-1.00)*1 = 1.00  (player 3 only)
        assert result[1]['amount'] == pytest.approx(1.00)
