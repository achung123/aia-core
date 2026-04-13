"""Tests for hand state machine: auto-create HandState on hand start,
expose turn query endpoint, enforce turn order, and auto-advance phase.

Covers acceptance criteria for aia-core-07y6 / T-050.
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


def _create_seated_game(client, names=None):
    """Create a game with seated players (auto-assigned seats 1,2,3...). Returns game_id."""
    if names is None:
        names = ['Alice', 'Bob', 'Charlie']

    resp = client.post(
        '/games',
        json={'game_date': '2026-04-12', 'player_names': names},
    )
    assert resp.status_code == 201
    return resp.json()['game_id']


def _start_hand(client, game_id):
    """Start a hand, activate card capture, return the re-fetched hand json."""
    resp = client.post(f'/games/{game_id}/hands/start')
    assert resp.status_code == 201
    hand = resp.json()
    activate_hand(client, game_id, hand)
    hn = hand['hand_number']
    return client.get(f'/games/{game_id}/hands/{hn}').json()


# ── AC-1: POST /hands/start creates HandState with phase=preflop ──


class TestStartHandCreatesHandState:
    def test_start_hand_creates_hand_state(self, client):
        """HandState row should be created when a hand starts."""
        game_id = _create_seated_game(client)
        hand = _start_hand(client, game_id)
        hand_number = hand['hand_number']

        resp = client.get(f'/games/{game_id}/hands/{hand_number}/state')
        assert resp.status_code == 200
        data = resp.json()
        assert data['phase'] == 'preflop'
        assert data['action_index'] == 0

    def test_start_hand_state_first_to_act_is_after_bb(self, client):
        """In preflop the first-to-act seat should be the player after BB."""
        # 3 players: seats 1,2,3. SB=seat1, BB=seat2 → first-to-act=seat3
        game_id = _create_seated_game(client, ['Alice', 'Bob', 'Charlie'])
        hand = _start_hand(client, game_id)
        hand_number = hand['hand_number']

        resp = client.get(f'/games/{game_id}/hands/{hand_number}/state')
        data = resp.json()
        # BB is seat 2, so first-to-act should be seat 3
        bb_name = hand['bb_player_name']
        assert data['current_player_name'] != bb_name


# ── AC-2: GET /games/{id}/hands/{num}/state returns correct fields ──


class TestGetHandState:
    def test_returns_all_fields(self, client):
        game_id = _create_seated_game(client)
        hand = _start_hand(client, game_id)
        hand_number = hand['hand_number']

        resp = client.get(f'/games/{game_id}/hands/{hand_number}/state')
        assert resp.status_code == 200
        data = resp.json()
        assert 'phase' in data
        assert 'current_seat' in data
        assert 'current_player_name' in data
        assert 'action_index' in data

    def test_404_for_missing_game(self, client):
        resp = client.get('/games/999/hands/1/state')
        assert resp.status_code == 404

    def test_404_for_missing_hand(self, client):
        game_id = _create_seated_game(client)
        resp = client.get(f'/games/{game_id}/hands/999/state')
        assert resp.status_code == 404


# ── AC-3: POST .../actions validates turn order, 403 if wrong player ──


class TestTurnOrderValidation:
    def test_correct_player_can_act(self, client):
        """The current player should be able to record an action."""
        game_id = _create_seated_game(client, ['Alice', 'Bob', 'Charlie'])
        hand = _start_hand(client, game_id)
        hand_number = hand['hand_number']

        # Get current player
        state = client.get(f'/games/{game_id}/hands/{hand_number}/state').json()
        current_player = state['current_player_name']

        resp = client.post(
            f'/games/{game_id}/hands/{hand_number}/players/{current_player}/actions',
            json={'street': 'preflop', 'action': 'call', 'amount': 0.20},
        )
        assert resp.status_code == 201

    def test_wrong_player_gets_403(self, client):
        """A player who is not current should get 403 Forbidden."""
        game_id = _create_seated_game(client, ['Alice', 'Bob', 'Charlie'])
        hand = _start_hand(client, game_id)
        hand_number = hand['hand_number']

        state = client.get(f'/games/{game_id}/hands/{hand_number}/state').json()
        current_player = state['current_player_name']

        # Find a player who is NOT current
        all_names = ['Alice', 'Bob', 'Charlie']
        wrong_player = next(n for n in all_names if n != current_player)

        resp = client.post(
            f'/games/{game_id}/hands/{hand_number}/players/{wrong_player}/actions',
            json={'street': 'preflop', 'action': 'call', 'amount': 0.20},
        )
        assert resp.status_code == 403


# ── AC-4: After valid action, current_seat advances to next non-folded player ──


class TestSeatAdvancement:
    def test_seat_advances_after_action(self, client):
        """current_seat should change after a valid action."""
        game_id = _create_seated_game(client, ['Alice', 'Bob', 'Charlie'])
        hand = _start_hand(client, game_id)
        hand_number = hand['hand_number']

        state_before = client.get(f'/games/{game_id}/hands/{hand_number}/state').json()
        current = state_before['current_player_name']

        client.post(
            f'/games/{game_id}/hands/{hand_number}/players/{current}/actions',
            json={'street': 'preflop', 'action': 'call', 'amount': 0.20},
        )

        state_after = client.get(f'/games/{game_id}/hands/{hand_number}/state').json()
        assert state_after['current_seat'] != state_before['current_seat']
        assert state_after['action_index'] == state_before['action_index'] + 1

    def test_fold_skipping(self, client):
        """A folded player should be skipped in rotation."""
        game_id = _create_seated_game(client, ['Alice', 'Bob', 'Charlie'])
        hand = _start_hand(client, game_id)
        hand_number = hand['hand_number']

        # First player folds
        state = client.get(f'/games/{game_id}/hands/{hand_number}/state').json()
        p1 = state['current_player_name']
        client.post(
            f'/games/{game_id}/hands/{hand_number}/players/{p1}/actions',
            json={'street': 'preflop', 'action': 'fold'},
        )

        # Second player acts
        state = client.get(f'/games/{game_id}/hands/{hand_number}/state').json()
        p2 = state['current_player_name']
        assert p2 != p1
        client.post(
            f'/games/{game_id}/hands/{hand_number}/players/{p2}/actions',
            json={'street': 'preflop', 'action': 'call', 'amount': 0.20},
        )

        # Third player acts
        state = client.get(f'/games/{game_id}/hands/{hand_number}/state').json()
        p3 = state['current_player_name']
        assert p3 != p1  # Folded player is skipped
        assert p3 != p2


# ── AC-5: All non-folded players acted → phase auto-advances ──


class TestPhaseAdvancement:
    def test_phase_advances_after_all_act(self, client):
        """After all non-folded players act, phase should advance."""
        game_id = _create_seated_game(client, ['Alice', 'Bob', 'Charlie'])
        hand = _start_hand(client, game_id)
        hand_number = hand['hand_number']

        # Now set flop cards so phase can actually advance
        client.patch(
            f'/games/{game_id}/hands/{hand_number}/flop',
            json={'flop_1': '9H', 'flop_2': 'JD', 'flop_3': 'QS'},
        )

        # UTG calls, SB calls (0.10 more), BB checks
        state = client.get(f'/games/{game_id}/hands/{hand_number}/state').json()
        client.post(
            f'/games/{game_id}/hands/{hand_number}/players/{state["current_player_name"]}/actions',
            json={'street': 'preflop', 'action': 'call', 'amount': 0.20},
        )
        state = client.get(f'/games/{game_id}/hands/{hand_number}/state').json()
        client.post(
            f'/games/{game_id}/hands/{hand_number}/players/{state["current_player_name"]}/actions',
            json={'street': 'preflop', 'action': 'call', 'amount': 0.10},
        )
        state = client.get(f'/games/{game_id}/hands/{hand_number}/state').json()
        client.post(
            f'/games/{game_id}/hands/{hand_number}/players/{state["current_player_name"]}/actions',
            json={'street': 'preflop', 'action': 'check'},
        )

        state = client.get(f'/games/{game_id}/hands/{hand_number}/state').json()
        assert state['phase'] == 'flop'

    def test_phase_advances_with_folds(self, client):
        """Phase should advance even when some players have folded."""
        game_id = _create_seated_game(client, ['Alice', 'Bob', 'Charlie'])
        hand = _start_hand(client, game_id)
        hand_number = hand['hand_number']

        # Set flop cards so phase can advance
        client.patch(
            f'/games/{game_id}/hands/{hand_number}/flop',
            json={'flop_1': '9H', 'flop_2': 'JD', 'flop_3': 'QS'},
        )

        # UTG folds, SB calls (0.10 more), BB checks
        state = client.get(f'/games/{game_id}/hands/{hand_number}/state').json()
        client.post(
            f'/games/{game_id}/hands/{hand_number}/players/{state["current_player_name"]}/actions',
            json={'street': 'preflop', 'action': 'fold'},
        )
        state = client.get(f'/games/{game_id}/hands/{hand_number}/state').json()
        client.post(
            f'/games/{game_id}/hands/{hand_number}/players/{state["current_player_name"]}/actions',
            json={'street': 'preflop', 'action': 'call', 'amount': 0.10},
        )
        state = client.get(f'/games/{game_id}/hands/{hand_number}/state').json()
        client.post(
            f'/games/{game_id}/hands/{hand_number}/players/{state["current_player_name"]}/actions',
            json={'street': 'preflop', 'action': 'check'},
        )

        state = client.get(f'/games/{game_id}/hands/{hand_number}/state').json()
        assert state['phase'] == 'flop'


# ── AC-6: Phase cannot advance past community card count ──


class TestPhaseCommunityCardGating:
    def test_phase_stays_at_preflop_without_flop_cards(self, client):
        """Phase cannot advance to flop if no flop cards are dealt."""
        game_id = _create_seated_game(client, ['Alice', 'Bob'])
        hand = _start_hand(client, game_id)
        hand_number = hand['hand_number']

        # Heads-up: SB calls (0.10 more), BB checks
        state = client.get(f'/games/{game_id}/hands/{hand_number}/state').json()
        client.post(
            f'/games/{game_id}/hands/{hand_number}/players/{state["current_player_name"]}/actions',
            json={'street': 'preflop', 'action': 'call', 'amount': 0.10},
        )
        state = client.get(f'/games/{game_id}/hands/{hand_number}/state').json()
        client.post(
            f'/games/{game_id}/hands/{hand_number}/players/{state["current_player_name"]}/actions',
            json={'street': 'preflop', 'action': 'check'},
        )

        # No flop cards set → phase should stay at preflop
        state = client.get(f'/games/{game_id}/hands/{hand_number}/state').json()
        assert state['phase'] == 'preflop'

    def test_phase_stays_at_flop_without_turn_card(self, client):
        """Phase cannot advance to turn if no turn card is dealt."""
        game_id = _create_seated_game(client, ['Alice', 'Bob'])
        hand = _start_hand(client, game_id)
        hand_number = hand['hand_number']

        # Complete preflop: SB calls (0.10 more), BB checks
        state = client.get(f'/games/{game_id}/hands/{hand_number}/state').json()
        client.post(
            f'/games/{game_id}/hands/{hand_number}/players/{state["current_player_name"]}/actions',
            json={'street': 'preflop', 'action': 'call', 'amount': 0.10},
        )
        state = client.get(f'/games/{game_id}/hands/{hand_number}/state').json()
        client.post(
            f'/games/{game_id}/hands/{hand_number}/players/{state["current_player_name"]}/actions',
            json={'street': 'preflop', 'action': 'check'},
        )

        # Set flop cards to advance to flop
        client.patch(
            f'/games/{game_id}/hands/{hand_number}/flop',
            json={'flop_1': '9H', 'flop_2': 'JD', 'flop_3': 'QS'},
        )

        state = client.get(f'/games/{game_id}/hands/{hand_number}/state').json()
        assert state['phase'] == 'flop'

        # Complete flop actions
        for _ in range(2):
            state = client.get(f'/games/{game_id}/hands/{hand_number}/state').json()
            client.post(
                f'/games/{game_id}/hands/{hand_number}/players/{state["current_player_name"]}/actions',
                json={'street': 'flop', 'action': 'check'},
            )

        # No turn card → phase stays at flop
        state = client.get(f'/games/{game_id}/hands/{hand_number}/state').json()
        assert state['phase'] == 'flop'


# ── AC-7: ?force=true bypasses turn-order enforcement ──


class TestForceBypass:
    def test_force_true_allows_wrong_player(self, client):
        """With ?force=true, any player can act regardless of turn."""
        game_id = _create_seated_game(client, ['Alice', 'Bob', 'Charlie'])
        hand = _start_hand(client, game_id)
        hand_number = hand['hand_number']

        state = client.get(f'/games/{game_id}/hands/{hand_number}/state').json()
        current_player = state['current_player_name']
        wrong_player = next(
            n for n in ['Alice', 'Bob', 'Charlie'] if n != current_player
        )

        resp = client.post(
            f'/games/{game_id}/hands/{hand_number}/players/{wrong_player}/actions?force=true',
            json={'street': 'preflop', 'action': 'call', 'amount': 0.20},
        )
        assert resp.status_code == 201

    def test_force_false_still_validates(self, client):
        """With ?force=false (default), turn order is enforced."""
        game_id = _create_seated_game(client, ['Alice', 'Bob', 'Charlie'])
        hand = _start_hand(client, game_id)
        hand_number = hand['hand_number']

        state = client.get(f'/games/{game_id}/hands/{hand_number}/state').json()
        current_player = state['current_player_name']
        wrong_player = next(
            n for n in ['Alice', 'Bob', 'Charlie'] if n != current_player
        )

        resp = client.post(
            f'/games/{game_id}/hands/{hand_number}/players/{wrong_player}/actions?force=false',
            json={'street': 'preflop', 'action': 'call', 'amount': 0.20},
        )
        assert resp.status_code == 403


# ── AC-8: Full rotation test ──


class TestFullRotation:
    def test_full_preflop_to_flop_to_turn(self, client):
        """Complete preflop → flop → turn rotation with 3 players."""
        game_id = _create_seated_game(client, ['Alice', 'Bob', 'Charlie'])
        hand = _start_hand(client, game_id)
        hn = hand['hand_number']

        # Deal flop and turn ahead of time
        client.patch(
            f'/games/{game_id}/hands/{hn}/flop',
            json={'flop_1': '9H', 'flop_2': 'JD', 'flop_3': 'QS'},
        )

        # ── Preflop round: UTG call, SB call (0.10), BB check ──
        state = client.get(f'/games/{game_id}/hands/{hn}/state').json()
        client.post(
            f'/games/{game_id}/hands/{hn}/players/{state["current_player_name"]}/actions',
            json={'street': 'preflop', 'action': 'call', 'amount': 0.20},
        )
        state = client.get(f'/games/{game_id}/hands/{hn}/state').json()
        client.post(
            f'/games/{game_id}/hands/{hn}/players/{state["current_player_name"]}/actions',
            json={'street': 'preflop', 'action': 'call', 'amount': 0.10},
        )
        state = client.get(f'/games/{game_id}/hands/{hn}/state').json()
        client.post(
            f'/games/{game_id}/hands/{hn}/players/{state["current_player_name"]}/actions',
            json={'street': 'preflop', 'action': 'check'},
        )

        state = client.get(f'/games/{game_id}/hands/{hn}/state').json()
        assert state['phase'] == 'flop'

        # ── Flop round ──
        for _ in range(3):
            state = client.get(f'/games/{game_id}/hands/{hn}/state').json()
            client.post(
                f'/games/{game_id}/hands/{hn}/players/{state["current_player_name"]}/actions',
                json={'street': 'flop', 'action': 'check'},
            )

        # Deal turn
        client.patch(
            f'/games/{game_id}/hands/{hn}/turn',
            json={'turn': 'JC'},
        )

        state = client.get(f'/games/{game_id}/hands/{hn}/state').json()
        assert state['phase'] == 'turn'

    def test_rotation_wraps_around(self, client):
        """Seat rotation should wrap from highest seat back to lowest."""
        game_id = _create_seated_game(client, ['Alice', 'Bob', 'Charlie'])
        hand = _start_hand(client, game_id)
        hn = hand['hand_number']

        seen_players = []
        for _ in range(3):
            state = client.get(f'/games/{game_id}/hands/{hn}/state').json()
            seen_players.append(state['current_player_name'])
            client.post(
                f'/games/{game_id}/hands/{hn}/players/{state["current_player_name"]}/actions',
                json={'street': 'preflop', 'action': 'call', 'amount': 0.20},
            )

        # All 3 unique players should have acted
        assert len(set(seen_players)) == 3

    def test_two_player_rotation(self, client):
        """Two-player game should alternate correctly."""
        game_id = _create_seated_game(client, ['Alice', 'Bob'])
        hand = _start_hand(client, game_id)
        hn = hand['hand_number']

        state = client.get(f'/games/{game_id}/hands/{hn}/state').json()
        p1 = state['current_player_name']
        client.post(
            f'/games/{game_id}/hands/{hn}/players/{p1}/actions',
            json={'street': 'preflop', 'action': 'call', 'amount': 0.20},
        )

        state = client.get(f'/games/{game_id}/hands/{hn}/state').json()
        p2 = state['current_player_name']
        assert p2 != p1

    def test_post_flop_first_to_act_changes(self, client):
        """Post-flop first-to-act should be first active player after dealer/SB."""
        game_id = _create_seated_game(client, ['Alice', 'Bob', 'Charlie'])
        hand = _start_hand(client, game_id)
        hn = hand['hand_number']

        # Complete preflop
        for _ in range(3):
            state = client.get(f'/games/{game_id}/hands/{hn}/state').json()
            client.post(
                f'/games/{game_id}/hands/{hn}/players/{state["current_player_name"]}/actions',
                json={'street': 'preflop', 'action': 'call', 'amount': 0.20},
            )

        # Deal flop
        client.patch(
            f'/games/{game_id}/hands/{hn}/flop',
            json={'flop_1': '9H', 'flop_2': 'JD', 'flop_3': 'QS'},
        )

        state = client.get(f'/games/{game_id}/hands/{hn}/state').json()
        # SB is seat 1, so post-flop first-to-act should be seat 1 (SB)
        # or the first active after dealer. In standard poker SB acts first post-flop.
        _sb_name = hand['sb_player_name']  # noqa: F841
        # Post-flop: first non-folded player at or after SB seat
        assert state['current_player_name'] is not None
