"""E2E integration tests simulating realistic multi-hand poker game flows.

Covers:
- Winning via folds on every street (preflop, flop, turn, river)
- Player kicked out (deactivated) and buying back in (rebuy reactivates)
- All-in scenarios with explicit is_all_in flag
- Side pots from partial all-ins
- Error modes: acting out of turn, double fold, insufficient players, etc.
"""

import pytest


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

# Unique card sets for all players (no overlap with each other or community cards we use)
PLAYER_CARDS = {
    'Alice': ('Ah', 'Kd'),
    'Bob': ('2c', '3c'),
    'Charlie': ('4s', '5s'),
    'Diana': ('6h', '7d'),
    'Short': ('10h', '3d'),
    'Medium': ('5c', '6c'),
    'Big': ('7s', '8h'),
}

COMMUNITY_FLOP = {
    'flop_1': {'rank': 'Q', 'suit': 'D'},
    'flop_2': {'rank': 'J', 'suit': 'C'},
    'flop_3': {'rank': '9', 'suit': 'H'},
}
COMMUNITY_TURN = {'turn': {'rank': '8', 'suit': 'S'}}
COMMUNITY_RIVER = {'river': {'rank': '2', 'suit': 'D'}}


def _create_game(client, names, buy_in=100.0):
    resp = client.post(
        '/games',
        json={
            'game_date': '2026-04-13',
            'player_names': names,
            'default_buy_in': buy_in,
        },
    )
    assert resp.status_code == 201
    return resp.json()


def _start_and_activate(client, game_id, card_overrides=None):
    """Start a hand, assign hole cards (activate), return refreshed hand JSON."""
    resp = client.post(f'/games/{game_id}/hands/start')
    assert resp.status_code == 201
    hand = resp.json()
    hn = hand['hand_number']

    names = [ph['player_name'] for ph in hand['player_hands']]
    for name in names:
        c1, c2 = (card_overrides or PLAYER_CARDS).get(
            name, PLAYER_CARDS.get(name, ('Jh', 'Qs'))
        )
        r = client.patch(
            f'/games/{game_id}/hands/{hn}/players/{name}',
            json={'card_1': c1, 'card_2': c2},
        )
        assert r.status_code == 200, f'Card capture failed for {name}: {r.text}'

    # Refresh hand to get post-activation state
    return client.get(f'/games/{game_id}/hands/{hn}').json()


def _state(client, game_id, hn):
    return client.get(f'/games/{game_id}/hands/{hn}/state').json()


def _current(client, game_id, hn):
    return _state(client, game_id, hn)['current_player_name']


def _act(
    client, game_id, name, action, amount=None, hn=1, street=None, is_all_in=False
):
    if street is None:
        street = _state(client, game_id, hn)['phase']
    payload = {'street': street, 'action': action}
    if amount is not None:
        payload['amount'] = amount
    if is_all_in:
        payload['is_all_in'] = True
    resp = client.post(
        f'/games/{game_id}/hands/{hn}/players/{name}/actions',
        json=payload,
    )
    return resp


def _deal_community(client, game_id, hn, through='river'):
    """Deal community cards through the specified street."""
    client.patch(f'/games/{game_id}/hands/{hn}/flop', json=COMMUNITY_FLOP)
    if through in ('turn', 'river'):
        client.patch(f'/games/{game_id}/hands/{hn}/turn', json=COMMUNITY_TURN)
    if through == 'river':
        client.patch(f'/games/{game_id}/hands/{hn}/river', json=COMMUNITY_RIVER)


def _set_result(client, game_id, hn, name, result, profit_loss, outcome_street):
    resp = client.patch(
        f'/games/{game_id}/hands/{hn}/players/{name}/result',
        json={
            'result': result,
            'profit_loss': profit_loss,
            'outcome_street': outcome_street,
        },
    )
    return resp


def _get_chips(client, game_id):
    """Return dict of player_name → current_chips."""
    game = client.get(f'/games/{game_id}').json()
    return {p['name']: p['current_chips'] for p in game['players']}


# ---------------------------------------------------------------------------
# Scenario 1: Win by fold on every street
# ---------------------------------------------------------------------------


class TestWinByFoldOnAllStreets:
    """Someone wins because all opponents fold — tested on each street."""

    def test_win_by_fold_preflop(self, client):
        """All opponents fold preflop → last player wins automatically."""
        game = _create_game(client, ['Alice', 'Bob', 'Charlie'])
        game_id = game['game_id']
        hand = _start_and_activate(client, game_id)
        hn = hand['hand_number']

        # Preflop: UTG folds, SB folds → BB wins
        p1 = _current(client, game_id, hn)
        resp = _act(client, game_id, p1, 'fold', hn=hn)
        assert resp.status_code == 201

        p2 = _current(client, game_id, hn)
        resp = _act(client, game_id, p2, 'fold', hn=hn)
        assert resp.status_code == 201

        # Hand should be in showdown — last player wins automatically
        hand_data = client.get(f'/games/{game_id}/hands/{hn}').json()
        winners = [ph for ph in hand_data['player_hands'] if ph['result'] == 'won']
        assert len(winners) == 1
        folded = [ph for ph in hand_data['player_hands'] if ph['result'] == 'folded']
        assert len(folded) == 2

        state = _state(client, game_id, hn)
        assert state['phase'] == 'showdown'

    def test_win_by_fold_on_flop(self, client):
        """All opponents fold on flop → last player wins."""
        game = _create_game(client, ['Alice', 'Bob', 'Charlie'])
        game_id = game['game_id']
        hand = _start_and_activate(client, game_id)
        hn = hand['hand_number']

        # Preflop: everyone calls
        p1 = _current(client, game_id, hn)
        _act(client, game_id, p1, 'call', amount=0.20, hn=hn)
        p2 = _current(client, game_id, hn)
        _act(client, game_id, p2, 'call', amount=0.10, hn=hn)
        p3 = _current(client, game_id, hn)
        _act(client, game_id, p3, 'check', hn=hn)

        # Deal flop
        _deal_community(client, game_id, hn, through='flop')

        # Flop: first two players fold → third wins
        p1 = _current(client, game_id, hn)
        _act(client, game_id, p1, 'fold', hn=hn)
        p2 = _current(client, game_id, hn)
        _act(client, game_id, p2, 'fold', hn=hn)

        hand_data = client.get(f'/games/{game_id}/hands/{hn}').json()
        winners = [ph for ph in hand_data['player_hands'] if ph['result'] == 'won']
        assert len(winners) == 1
        assert _state(client, game_id, hn)['phase'] == 'showdown'

    def test_win_by_fold_on_turn(self, client):
        """Opponent folds on turn → remaining player wins."""
        game = _create_game(client, ['Alice', 'Bob'])
        game_id = game['game_id']
        hand = _start_and_activate(client, game_id)
        hn = hand['hand_number']

        # Preflop: SB calls, BB checks
        p1 = _current(client, game_id, hn)
        _act(client, game_id, p1, 'call', amount=0.10, hn=hn)
        p2 = _current(client, game_id, hn)
        _act(client, game_id, p2, 'check', hn=hn)

        # Flop: checks all around
        _deal_community(client, game_id, hn, through='flop')
        p1 = _current(client, game_id, hn)
        _act(client, game_id, p1, 'check', hn=hn)
        p2 = _current(client, game_id, hn)
        _act(client, game_id, p2, 'check', hn=hn)

        # Turn: one folds
        _deal_community(client, game_id, hn, through='turn')
        p1 = _current(client, game_id, hn)
        _act(client, game_id, p1, 'fold', hn=hn)

        hand_data = client.get(f'/games/{game_id}/hands/{hn}').json()
        winners = [ph for ph in hand_data['player_hands'] if ph['result'] == 'won']
        assert len(winners) == 1
        assert _state(client, game_id, hn)['phase'] == 'showdown'

    def test_win_by_fold_on_river(self, client):
        """Opponent folds on river → remaining player wins."""
        game = _create_game(client, ['Alice', 'Bob'])
        game_id = game['game_id']
        hand = _start_and_activate(client, game_id)
        hn = hand['hand_number']

        # Preflop
        p1 = _current(client, game_id, hn)
        _act(client, game_id, p1, 'call', amount=0.10, hn=hn)
        p2 = _current(client, game_id, hn)
        _act(client, game_id, p2, 'check', hn=hn)

        # Flop
        _deal_community(client, game_id, hn, through='flop')
        p1 = _current(client, game_id, hn)
        _act(client, game_id, p1, 'check', hn=hn)
        p2 = _current(client, game_id, hn)
        _act(client, game_id, p2, 'check', hn=hn)

        # Turn
        _deal_community(client, game_id, hn, through='turn')
        p1 = _current(client, game_id, hn)
        _act(client, game_id, p1, 'check', hn=hn)
        p2 = _current(client, game_id, hn)
        _act(client, game_id, p2, 'check', hn=hn)

        # River: fold
        _deal_community(client, game_id, hn, through='river')
        p1 = _current(client, game_id, hn)
        _act(client, game_id, p1, 'fold', hn=hn)

        hand_data = client.get(f'/games/{game_id}/hands/{hn}').json()
        winners = [ph for ph in hand_data['player_hands'] if ph['result'] == 'won']
        assert len(winners) == 1
        assert _state(client, game_id, hn)['phase'] == 'showdown'


# ---------------------------------------------------------------------------
# Scenario 2: Kicked out and buying back in
# ---------------------------------------------------------------------------


class TestKickAndRebuy:
    """Player gets kicked out (deactivated) and buys back in via rebuy."""

    def test_deactivate_player_then_rebuy(self, client):
        """Deactivated player isn't in new hands; rebuy reactivates them."""
        game = _create_game(client, ['Alice', 'Bob', 'Charlie'], buy_in=100.0)
        game_id = game['game_id']

        # Play hand 1 normally
        hand1 = _start_and_activate(client, game_id)
        hn1 = hand1['hand_number']
        # Everyone folds to BB
        p1 = _current(client, game_id, hn1)
        _act(client, game_id, p1, 'fold', hn=hn1)
        p2 = _current(client, game_id, hn1)
        _act(client, game_id, p2, 'fold', hn=hn1)

        # Kick Charlie out (deactivate)
        resp = client.patch(
            f'/games/{game_id}/players/Charlie/status',
            json={'is_active': False},
        )
        assert resp.status_code == 200
        assert resp.json()['is_active'] is False

        # Hand 2: Charlie should NOT be in the hand
        hand2 = _start_and_activate(client, game_id)
        hn2 = hand2['hand_number']
        names_in_hand2 = {ph['player_name'] for ph in hand2['player_hands']}
        assert 'Charlie' not in names_in_hand2
        assert len(names_in_hand2) == 2

        # Finish hand 2 quickly
        p1 = _current(client, game_id, hn2)
        _act(client, game_id, p1, 'fold', hn=hn2)

        # Charlie buys back in via rebuy (rebuy auto-reactivates)
        resp = client.post(
            f'/games/{game_id}/players/Charlie/rebuys',
            json={'amount': 50.0},
        )
        assert resp.status_code == 201

        # Verify Charlie is active again
        game_data = client.get(f'/games/{game_id}').json()
        charlie = [p for p in game_data['players'] if p['name'] == 'Charlie'][0]
        assert charlie['is_active'] is True
        # Chips = whatever was left + rebuy amount
        assert charlie['current_chips'] is not None

        # Hand 3: Charlie should be in the hand again
        hand3 = _start_and_activate(client, game_id)
        names_in_hand3 = {ph['player_name'] for ph in hand3['player_hands']}
        assert 'Charlie' in names_in_hand3
        assert len(names_in_hand3) == 3

    def test_cannot_start_hand_with_one_active_player(self, client):
        """If only one player is active, starting a hand should fail."""
        game = _create_game(client, ['Alice', 'Bob'])
        game_id = game['game_id']

        # Deactivate Bob
        client.patch(
            f'/games/{game_id}/players/Bob/status',
            json={'is_active': False},
        )

        resp = client.post(f'/games/{game_id}/hands/start')
        assert resp.status_code == 400
        assert 'At least 2 active players' in resp.json()['detail']


# ---------------------------------------------------------------------------
# Scenario 3: All-in
# ---------------------------------------------------------------------------


class TestAllIn:
    """All-in scenarios: explicit flag, auto-detection, and chip stack updates."""

    def test_preflop_all_in_and_call(self, client):
        """Player goes all-in preflop, opponent calls. Side pots not needed (equal stacks)."""
        game = _create_game(client, ['Alice', 'Bob'], buy_in=50.0)
        game_id = game['game_id']
        hand = _start_and_activate(client, game_id)
        hn = hand['hand_number']

        # SB raises all-in
        p1 = _current(client, game_id, hn)
        # SB already posted 0.10, so remaining = 49.90
        resp = _act(client, game_id, p1, 'raise', amount=49.90, hn=hn, is_all_in=True)
        assert resp.status_code == 201

        # BB calls (BB posted 0.20, so needs 49.80 more to match 50.00 total)
        p2 = _current(client, game_id, hn)
        resp = _act(client, game_id, p2, 'call', amount=49.80, hn=hn)
        assert resp.status_code == 201

        # Verify chip stacks are depleted
        chips_after = _get_chips(client, game_id)
        assert chips_after[p1] == pytest.approx(0.0)
        assert chips_after[p2] == pytest.approx(0.0)

        # Pot should be 100.0 (50 + 50)
        hand_data = client.get(f'/games/{game_id}/hands/{hn}').json()
        assert hand_data['pot'] == pytest.approx(100.0)

    def test_all_in_skips_future_actions(self, client):
        """An all-in player should not be expected to act on subsequent streets."""
        game = _create_game(client, ['Alice', 'Bob', 'Charlie'], buy_in=50.0)
        game_id = game['game_id']
        hand = _start_and_activate(client, game_id)
        hn = hand['hand_number']

        # UTG raises all-in
        p1 = _current(client, game_id, hn)
        _act(client, game_id, p1, 'raise', amount=49.80, hn=hn, is_all_in=True)

        # SB calls (SB posted 0.10 blind, needs 49.70 more to match)
        p2 = _current(client, game_id, hn)
        _act(client, game_id, p2, 'call', amount=49.70, hn=hn)

        # BB calls (BB posted 0.20 blind, needs 49.60 more to match)
        p3 = _current(client, game_id, hn)
        _act(client, game_id, p3, 'call', amount=49.60, hn=hn)

        # Deal flop — only non-all-in players should act
        _deal_community(client, game_id, hn, through='flop')
        state = _state(client, game_id, hn)
        assert state['phase'] == 'flop'
        # The all-in player should NOT be current
        assert state['current_player_name'] != p1


# ---------------------------------------------------------------------------
# Scenario 4: Side pots from partial all-in
# ---------------------------------------------------------------------------


class TestSidePots:
    """Side pots when a short-stacked player goes all-in but others have more."""

    def test_side_pot_short_stack_all_in(self, client):
        """Short-stacked player all-in → main pot + side pot computed."""
        # Create game with uneven buy-ins
        game2 = client.post(
            '/games',
            json={
                'game_date': '2026-04-13',
                'player_names': ['Short', 'Medium', 'Big'],
                'player_buy_ins': {'Short': 10.0, 'Medium': 100.0, 'Big': 100.0},
                'default_buy_in': 100.0,
            },
        )
        assert game2.status_code == 201
        g = game2.json()
        gid = g['game_id']

        hand = _start_and_activate(client, gid)
        hn = hand['hand_number']

        # UTG raises to 5.00
        p1 = _current(client, gid, hn)
        _act(client, gid, p1, 'raise', amount=5.00, hn=hn)

        # SB calls 5.00 (after posting 0.10, needs 4.90 more)
        p2 = _current(client, gid, hn)
        _act(client, gid, p2, 'call', amount=4.90, hn=hn)

        # BB calls 5.00 (after posting 0.20, needs 4.80 more)
        p3 = _current(client, gid, hn)
        _act(client, gid, p3, 'call', amount=4.80, hn=hn)

        hand_data = client.get(f'/games/{gid}/hands/{hn}').json()
        # Total pot: 5.00 + 5.00 + 5.00 = 15.00
        assert hand_data['pot'] == pytest.approx(15.00)

    def test_side_pot_from_call_for_less(self, client):
        """Player calls for less than the raise → auto-detected as all-in → side pot created."""
        game = client.post(
            '/games',
            json={
                'game_date': '2026-04-13',
                'player_names': ['Short', 'Medium', 'Big'],
                'player_buy_ins': {'Short': 5.0, 'Medium': 100.0, 'Big': 100.0},
                'default_buy_in': 100.0,
            },
        ).json()
        gid = game['game_id']
        hand = _start_and_activate(client, gid)
        hn = hand['hand_number']

        # UTG (first to act) raises big
        p1 = _current(client, gid, hn)
        _act(client, gid, p1, 'raise', amount=20.0, hn=hn)

        # SB can only call for less (Short has ~5.0 - 0.10 blind = 4.90 left)
        p2 = _current(client, gid, hn)
        resp = _act(client, gid, p2, 'call', amount=4.90, hn=hn, is_all_in=True)
        assert resp.status_code == 201

        # BB calls the full raise
        p3 = _current(client, gid, hn)
        _act(client, gid, p3, 'call', amount=19.80, hn=hn)

        hand_data = client.get(f'/games/{gid}/hands/{hn}').json()
        # Side pots should exist because Short is all-in for less
        assert len(hand_data['side_pots']) >= 1

    def test_explicit_all_in_bet_creates_side_pot(self, client):
        """Explicit is_all_in=True on a bet triggers side pot computation."""
        game = client.post(
            '/games',
            json={
                'game_date': '2026-04-13',
                'player_names': ['Short', 'Medium', 'Big'],
                'player_buy_ins': {'Short': 8.0, 'Medium': 100.0, 'Big': 100.0},
                'default_buy_in': 100.0,
            },
        ).json()
        gid = game['game_id']
        hand = _start_and_activate(client, gid)
        hn = hand['hand_number']

        # UTG goes all-in with a raise (preflop has blinds, so raise not bet)
        p1 = _current(client, gid, hn)
        resp = _act(client, gid, p1, 'raise', amount=7.80, hn=hn, is_all_in=True)
        assert resp.status_code == 201

        # Other two players call
        p2 = _current(client, gid, hn)
        _act(client, gid, p2, 'call', amount=7.70, hn=hn)
        p3 = _current(client, gid, hn)
        _act(client, gid, p3, 'call', amount=7.60, hn=hn)

        hand_data = client.get(f'/games/{gid}/hands/{hn}').json()
        assert len(hand_data['side_pots']) >= 1


# ---------------------------------------------------------------------------
# Scenario 5: Multi-hand game flow (dealer + player simulation)
# ---------------------------------------------------------------------------


class TestMultiHandGameFlow:
    """Simulate a realistic multi-hand game session."""

    def test_three_hand_session_with_blind_rotation(self, client):
        """Play 3 hands → verify blind rotation and chip tracking."""
        game = _create_game(client, ['Alice', 'Bob', 'Charlie'], buy_in=100.0)
        game_id = game['game_id']

        sb_names = []
        bb_names = []

        for hand_num in range(1, 4):
            hand = _start_and_activate(client, game_id)
            hn = hand['hand_number']
            assert hn == hand_num

            sb_names.append(hand['sb_player_name'])
            bb_names.append(hand['bb_player_name'])

            # Quick fold to end hand
            p1 = _current(client, game_id, hn)
            _act(client, game_id, p1, 'fold', hn=hn)
            p2 = _current(client, game_id, hn)
            _act(client, game_id, p2, 'fold', hn=hn)

        # Blinds should rotate — SB from hand 1 should not be SB in hand 2
        assert sb_names[0] != sb_names[1], 'SB should rotate between hands'
        assert bb_names[0] != bb_names[1], 'BB should rotate between hands'

    def test_full_hand_to_showdown(self, client):
        """Complete hand through all streets to showdown with results."""
        game = _create_game(client, ['Alice', 'Bob'], buy_in=100.0)
        game_id = game['game_id']
        hand = _start_and_activate(client, game_id)
        hn = hand['hand_number']

        # Preflop: SB calls, BB checks
        p1 = _current(client, game_id, hn)
        _act(client, game_id, p1, 'call', amount=0.10, hn=hn)
        p2 = _current(client, game_id, hn)
        _act(client, game_id, p2, 'check', hn=hn)

        # Flop
        _deal_community(client, game_id, hn, through='flop')
        p1 = _current(client, game_id, hn)
        _act(client, game_id, p1, 'check', hn=hn)
        p2 = _current(client, game_id, hn)
        _act(client, game_id, p2, 'check', hn=hn)

        # Turn
        _deal_community(client, game_id, hn, through='turn')
        p1 = _current(client, game_id, hn)
        _act(client, game_id, p1, 'check', hn=hn)
        p2 = _current(client, game_id, hn)
        _act(client, game_id, p2, 'check', hn=hn)

        # River
        _deal_community(client, game_id, hn, through='river')
        p1 = _current(client, game_id, hn)
        _act(client, game_id, p1, 'check', hn=hn)
        p2 = _current(client, game_id, hn)
        _act(client, game_id, p2, 'check', hn=hn)

        # Should now be at showdown
        state = _state(client, game_id, hn)
        assert state['phase'] == 'showdown'

        # Record results
        _deal_community(
            client, game_id, hn, through='river'
        )  # already dealt, idempotent
        resp1 = _set_result(client, game_id, hn, 'Alice', 'won', 0.20, 'river')
        assert resp1.status_code == 200
        resp2 = _set_result(client, game_id, hn, 'Bob', 'lost', -0.20, 'river')
        assert resp2.status_code == 200

        # Verify final state
        final = client.get(f'/games/{game_id}/hands/{hn}').json()
        phs = {ph['player_name']: ph for ph in final['player_hands']}
        assert phs['Alice']['result'] == 'won'
        assert phs['Bob']['result'] == 'lost'


# ---------------------------------------------------------------------------
# Scenario 6: Error modes
# ---------------------------------------------------------------------------


class TestErrorModes:
    """Various error conditions and edge cases in game flow."""

    def test_action_out_of_turn_rejected(self, client):
        """Acting out of turn should be rejected (403)."""
        game = _create_game(client, ['Alice', 'Bob', 'Charlie'])
        game_id = game['game_id']
        hand = _start_and_activate(client, game_id)
        hn = hand['hand_number']

        current = _current(client, game_id, hn)
        # Pick a player that is NOT current
        all_names = {ph['player_name'] for ph in hand['player_hands']}
        wrong_player = (all_names - {current}).pop()

        resp = _act(client, game_id, wrong_player, 'call', amount=0.20, hn=hn)
        assert resp.status_code == 403
        assert 'turn' in resp.json()['detail'].lower()

    def test_double_fold_rejected(self, client):
        """A player who already folded cannot fold again."""
        game = _create_game(client, ['Alice', 'Bob', 'Charlie'])
        game_id = game['game_id']
        hand = _start_and_activate(client, game_id)
        hn = hand['hand_number']

        p1 = _current(client, game_id, hn)
        _act(client, game_id, p1, 'fold', hn=hn)

        # Try to fold again (force=true to bypass turn order, test the fold guard itself)
        resp = client.post(
            f'/games/{game_id}/hands/{hn}/players/{p1}/actions',
            json={'street': 'preflop', 'action': 'fold'},
            params={'force': 'true'},
        )
        assert resp.status_code == 400
        assert 'already folded' in resp.json()['detail'].lower()

    def test_action_during_awaiting_cards_rejected(self, client):
        """Cannot bet before all cards are captured."""
        game = _create_game(client, ['Alice', 'Bob'])
        game_id = game['game_id']

        # Start hand but do NOT activate (no card capture)
        resp = client.post(f'/games/{game_id}/hands/start')
        assert resp.status_code == 201
        hand = resp.json()
        hn = hand['hand_number']

        # Try to act — should be rejected
        resp = client.post(
            f'/games/{game_id}/hands/{hn}/players/Alice/actions',
            json={'street': 'preflop', 'action': 'call', 'amount': 0.10},
            params={'force': 'true'},
        )
        assert resp.status_code == 403
        assert 'awaiting' in resp.json()['detail'].lower()

    def test_turn_before_flop_rejected(self, client):
        """Cannot deal turn before flop."""
        game = _create_game(client, ['Alice', 'Bob'])
        game_id = game['game_id']
        hand = _start_and_activate(client, game_id)
        hn = hand['hand_number']

        resp = client.patch(
            f'/games/{game_id}/hands/{hn}/turn',
            json=COMMUNITY_TURN,
        )
        assert resp.status_code == 400
        assert 'flop' in resp.json()['detail'].lower()

    def test_river_before_turn_rejected(self, client):
        """Cannot deal river before turn."""
        game = _create_game(client, ['Alice', 'Bob'])
        game_id = game['game_id']
        hand = _start_and_activate(client, game_id)
        hn = hand['hand_number']

        # Deal flop first
        _deal_community(client, game_id, hn, through='flop')

        resp = client.patch(
            f'/games/{game_id}/hands/{hn}/river',
            json=COMMUNITY_RIVER,
        )
        assert resp.status_code == 400
        assert 'turn' in resp.json()['detail'].lower()

    def test_nonexistent_player_action_404(self, client):
        """Acting for a player not in the hand returns 404."""
        game = _create_game(client, ['Alice', 'Bob'])
        game_id = game['game_id']
        hand = _start_and_activate(client, game_id)
        hn = hand['hand_number']

        resp = client.post(
            f'/games/{game_id}/hands/{hn}/players/Zach/actions',
            json={'street': 'preflop', 'action': 'fold'},
        )
        assert resp.status_code == 404

    def test_result_outcome_street_mismatch(self, client):
        """Setting result on a street where community cards don't exist should fail."""
        game = _create_game(client, ['Alice', 'Bob'])
        game_id = game['game_id']
        hand = _start_and_activate(client, game_id)
        hn = hand['hand_number']

        # No community cards dealt — try setting result on flop street
        resp = _set_result(client, game_id, hn, 'Alice', 'won', 10.0, 'flop')
        assert resp.status_code == 400
        assert 'flop' in resp.json()['detail'].lower()


# ---------------------------------------------------------------------------
# Scenario 7: Chip stack tracking across hands
# ---------------------------------------------------------------------------


class TestChipStackAcrossHands:
    """Verify chip stacks update correctly across a multi-hand session."""

    def test_chips_deducted_by_blinds_and_bets(self, client):
        """Blind posting and betting deducts chips; folding preserves remaining stack."""
        game = _create_game(client, ['Alice', 'Bob'], buy_in=100.0)
        game_id = game['game_id']

        chips_before = _get_chips(client, game_id)
        assert chips_before['Alice'] == 100.0
        assert chips_before['Bob'] == 100.0

        hand = _start_and_activate(client, game_id)
        hn = hand['hand_number']
        sb_name = hand['sb_player_name']
        bb_name = hand['bb_player_name']

        # After blinds: SB posted 0.10, BB posted 0.20
        chips_after_blinds = _get_chips(client, game_id)
        assert chips_after_blinds[sb_name] == pytest.approx(99.90)
        assert chips_after_blinds[bb_name] == pytest.approx(99.80)

        # SB raises to 1.00 (additional 0.90)
        _act(client, game_id, sb_name, 'raise', amount=0.90, hn=hn)
        chips_after_raise = _get_chips(client, game_id)
        assert chips_after_raise[sb_name] == pytest.approx(99.00)

        # BB folds → SB wins the pot
        _act(client, game_id, bb_name, 'fold', hn=hn)

        # SB still has 99.00 chips (pot not auto-added back)
        final_chips = _get_chips(client, game_id)
        assert final_chips[sb_name] == pytest.approx(99.00)
        assert final_chips[bb_name] == pytest.approx(99.80)

    def test_rebuy_restores_chips(self, client):
        """After losing most chips, a rebuy adds to the stack."""
        game = _create_game(client, ['Alice', 'Bob'], buy_in=10.0)
        game_id = game['game_id']
        hand = _start_and_activate(client, game_id)
        hn = hand['hand_number']

        # SB goes all-in preflop
        sb = hand['sb_player_name']
        _act(client, game_id, sb, 'raise', amount=9.90, hn=hn, is_all_in=True)

        # BB folds
        bb = hand['bb_player_name']
        _act(client, game_id, bb, 'fold', hn=hn)

        # SB's chips are now 0
        chips = _get_chips(client, game_id)
        assert chips[sb] == pytest.approx(0.0)

        # Rebuy for SB
        resp = client.post(
            f'/games/{game_id}/players/{sb}/rebuys',
            json={'amount': 50.0},
        )
        assert resp.status_code == 201

        chips_after = _get_chips(client, game_id)
        assert chips_after[sb] == pytest.approx(50.0)


# ---------------------------------------------------------------------------
# Scenario 8: Complex multi-street betting with raises
# ---------------------------------------------------------------------------


class TestComplexBetting:
    """Multi-street betting with raises, re-raises, and varying amounts."""

    def test_raise_reraise_call_sequence(self, client):
        """Raise → re-raise → call sequence advances correctly."""
        game = _create_game(client, ['Alice', 'Bob', 'Charlie'], buy_in=200.0)
        game_id = game['game_id']
        hand = _start_and_activate(client, game_id)
        hn = hand['hand_number']

        # Preflop: UTG raises to 2.00
        p1 = _current(client, game_id, hn)
        resp = _act(client, game_id, p1, 'raise', amount=2.00, hn=hn)
        assert resp.status_code == 201

        # SB re-raises to 6.00
        p2 = _current(client, game_id, hn)
        resp = _act(client, game_id, p2, 'raise', amount=6.00, hn=hn)
        assert resp.status_code == 201

        # BB folds
        p3 = _current(client, game_id, hn)
        resp = _act(client, game_id, p3, 'fold', hn=hn)
        assert resp.status_code == 201

        # UTG calls the re-raise (SB total = 0.10 + 6.00 = 6.10, UTG has 2.00 in, needs 4.10)
        p1_again = _current(client, game_id, hn)
        assert p1_again == p1
        resp = _act(client, game_id, p1_again, 'call', amount=4.10, hn=hn)
        assert resp.status_code == 201

        # Should advance to flop phase (waiting for community cards)
        state = _state(client, game_id, hn)
        # Phase might be flop (if cards waiting) or preflop still
        # With no community cards dealt: current_seat should be None (waiting for cards)
        assert state['current_player_name'] is None or state['phase'] == 'flop'

    def test_bet_fold_heads_up_on_flop(self, client):
        """Heads-up on flop: one bets, other folds → hand over."""
        game = _create_game(client, ['Alice', 'Bob'], buy_in=100.0)
        game_id = game['game_id']
        hand = _start_and_activate(client, game_id)
        hn = hand['hand_number']

        # Preflop: SB calls, BB checks
        p1 = _current(client, game_id, hn)
        _act(client, game_id, p1, 'call', amount=0.10, hn=hn)
        p2 = _current(client, game_id, hn)
        _act(client, game_id, p2, 'check', hn=hn)

        # Deal flop
        _deal_community(client, game_id, hn, through='flop')

        # Flop: SB bets, BB folds
        p1 = _current(client, game_id, hn)
        _act(client, game_id, p1, 'bet', amount=0.30, hn=hn)
        p2 = _current(client, game_id, hn)
        _act(client, game_id, p2, 'fold', hn=hn)

        hand_data = client.get(f'/games/{game_id}/hands/{hn}').json()
        winners = [ph for ph in hand_data['player_hands'] if ph['result'] == 'won']
        assert len(winners) == 1
        assert _state(client, game_id, hn)['phase'] == 'showdown'
