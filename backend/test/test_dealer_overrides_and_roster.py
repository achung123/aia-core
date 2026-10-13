"""Roster edge cases, dealer overrides, and remaining betting-rule fixes."""

from app.services.betting import _last_raise_increment

CARDS = {
    'A': ('Ah', 'Ad'),
    'B': ('Kh', 'Kd'),
    'C': ('Qh', 'Qd'),
    'D': ('7c', '2s'),
}
FLOP = {'flop_1': '3c', 'flop_2': '8d', 'flop_3': '9s'}


def create_game(client, names, buy_ins=None):
    payload = {
        'game_date': '2026-10-13',
        'player_names': names,
        'default_buy_in': 100,
    }
    if buy_ins:
        payload['player_buy_ins'] = buy_ins
    return client.post('/games', json=payload).json()['game_id']


def give_cards(client, game_id, names):
    responses = []
    for name in names:
        card_1, card_2 = CARDS[name]
        responses.append(
            client.patch(
                f'/games/{game_id}/hands/1/players/{name}',
                json={'card_1': card_1, 'card_2': card_2},
            )
        )
    return responses


def start_game(client, names, buy_ins=None):
    game_id = create_game(client, names, buy_ins)
    client.post(f'/games/{game_id}/hands/start')
    give_cards(client, game_id, names)
    return game_id


def act(client, game_id, name, action, amount=None, street='preflop', **params):
    return client.post(
        f'/games/{game_id}/hands/1/players/{name}/actions',
        params=params or None,
        json={'street': street, 'action': action, 'amount': amount},
    )


def status(client, game_id):
    return client.get(f'/games/{game_id}/hands/1/status').json()


def chips(client, game_id):
    return {p['name']: p['current_chips'] for p in status(client, game_id)['players']}


class TestRoster:
    def test_player_added_to_the_game_mid_hand_does_not_get_the_turn(self, client):
        game_id = start_game(client, ['A', 'B', 'C'])
        client.post(
            f'/games/{game_id}/players', json={'player_name': 'D', 'buy_in': 100}
        )
        assert act(client, game_id, 'C', 'call', 0.2).status_code == 201
        assert status(client, game_id)['current_player_name'] == 'A'

    def test_player_deactivated_mid_hand_keeps_their_turn(self, client):
        game_id = start_game(client, ['A', 'B', 'C'])
        client.patch(f'/games/{game_id}/players/A/status', json={'is_active': False})
        assert act(client, game_id, 'C', 'call', 0.2).status_code == 201
        assert status(client, game_id)['current_player_name'] == 'A'

    def test_removing_the_small_blind_before_cards_moves_the_blinds(self, client):
        game_id = create_game(client, ['A', 'B', 'C', 'D'])
        client.post(f'/games/{game_id}/hands/start')
        assert client.delete(f'/games/{game_id}/hands/1/players/A').status_code == 204
        responses = give_cards(client, game_id, ['B', 'C', 'D'])
        assert [r.status_code for r in responses] == [200, 200, 200]
        hand = client.get(f'/games/{game_id}/hands/1').json()
        assert hand['sb_player_name'] == 'B'
        assert hand['bb_player_name'] == 'C'
        assert status(client, game_id)['current_player_name'] == 'D'

    def test_removing_the_last_player_without_cards_starts_the_betting(self, client):
        game_id = create_game(client, ['A', 'B', 'C'])
        client.post(f'/games/{game_id}/hands/start')
        give_cards(client, game_id, ['A', 'B'])
        assert status(client, game_id)['phase'] == 'awaiting_cards'
        client.delete(f'/games/{game_id}/hands/1/players/C')
        assert status(client, game_id)['phase'] == 'preflop'

    def test_removing_the_player_to_act_passes_the_turn(self, client):
        game_id = start_game(client, ['A', 'B', 'C', 'D'])
        assert status(client, game_id)['current_player_name'] == 'C'
        assert client.delete(f'/games/{game_id}/hands/1/players/C').status_code == 204
        assert status(client, game_id)['current_player_name'] == 'D'

    def test_player_with_money_in_the_pot_cannot_be_removed(self, client):
        game_id = start_game(client, ['A', 'B', 'C'])
        response = client.delete(f'/games/{game_id}/hands/1/players/B')
        assert response.status_code == 400
        assert 'fold' in response.json()['detail'].lower()

    def test_dealer_fold_through_the_outcome_button_passes_the_turn(self, client):
        game_id = start_game(client, ['A', 'B', 'C'])
        response = client.patch(
            f'/games/{game_id}/hands/1/players/C/result', json={'result': 'folded'}
        )
        assert response.status_code == 200
        assert status(client, game_id)['current_player_name'] == 'A'


class TestBettingRules:
    def test_short_all_in_raise_does_not_lower_the_minimum_raise(self):
        actions = [
            {'player_id': 1, 'action': 'bet', 'amount': 100},
            {'player_id': 2, 'action': 'raise', 'amount': 105},
        ]
        assert _last_raise_increment(actions, 2) == 100

    def test_full_raise_sets_the_new_minimum(self):
        actions = [
            {'player_id': 1, 'action': 'bet', 'amount': 100},
            {'player_id': 2, 'action': 'raise', 'amount': 350},
        ]
        assert _last_raise_increment(actions, 2) == 250

    def test_heads_up_big_blind_acts_first_after_the_flop(self, client):
        game_id = start_game(client, ['A', 'B'])
        assert status(client, game_id)['current_player_name'] == 'A'
        act(client, game_id, 'A', 'call', 0.1)
        act(client, game_id, 'B', 'check')
        client.patch(f'/games/{game_id}/hands/1/flop', json=FLOP)
        assert status(client, game_id)['current_player_name'] == 'B'

    def test_changing_blinds_mid_hand_does_not_change_this_hand(self, client):
        game_id = start_game(client, ['A', 'B', 'C'])
        before = status(client, game_id)['minimum_raise']
        client.patch(
            f'/games/{game_id}/blinds', json={'small_blind': 1, 'big_blind': 2}
        )
        assert status(client, game_id)['minimum_raise'] == before

    def test_pot_has_no_float_noise(self, client):
        game_id = start_game(client, ['A', 'B', 'C'])
        assert status(client, game_id)['pot'] == 0.3


class TestStatusFreshness:
    def test_rebuy_changes_the_status_etag(self, client):
        game_id = start_game(client, ['A', 'B', 'C'])
        etag = client.get(f'/games/{game_id}/hands/1/status').headers['etag']
        client.post(f'/games/{game_id}/players/A/rebuys', json={'amount': 50})
        response = client.get(
            f'/games/{game_id}/hands/1/status', headers={'If-None-Match': etag}
        )
        assert response.status_code == 200
        assert chips(client, game_id)['A'] == 149.9

    def test_unchanged_status_still_returns_304(self, client):
        game_id = start_game(client, ['A', 'B', 'C'])
        etag = client.get(f'/games/{game_id}/hands/1/status').headers['etag']
        response = client.get(
            f'/games/{game_id}/hands/1/status', headers={'If-None-Match': etag}
        )
        assert response.status_code == 304


class TestDoubleSubmitGuard:
    def test_status_reports_the_action_index(self, client):
        game_id = start_game(client, ['A', 'B', 'C'])
        assert status(client, game_id)['action_index'] == 0
        act(client, game_id, 'C', 'call', 0.2)
        assert status(client, game_id)['action_index'] == 1

    def test_stale_action_index_is_rejected(self, client):
        game_id = start_game(client, ['A', 'B', 'C'])
        act(client, game_id, 'C', 'call', 0.2)
        response = client.post(
            f'/games/{game_id}/hands/1/players/A/actions',
            json={
                'street': 'preflop',
                'action': 'call',
                'amount': 0.1,
                'expected_action_index': 0,
            },
        )
        assert response.status_code == 409

    def test_matching_action_index_is_accepted(self, client):
        game_id = start_game(client, ['A', 'B', 'C'])
        response = client.post(
            f'/games/{game_id}/hands/1/players/C/actions',
            json={
                'street': 'preflop',
                'action': 'call',
                'amount': 0.2,
                'expected_action_index': 0,
            },
        )
        assert response.status_code == 201


class TestUndoLastAction:
    def undo(self, client, game_id):
        return client.delete(f'/games/{game_id}/hands/1/actions/last')

    def test_undo_returns_the_chips_and_the_turn(self, client):
        game_id = start_game(client, ['A', 'B', 'C'])
        act(client, game_id, 'C', 'raise', 5)
        response = self.undo(client, game_id)
        assert response.status_code == 200, response.text
        current = status(client, game_id)
        assert current['current_player_name'] == 'C'
        assert current['pot'] == 0.3
        assert current['amount_to_call'] == 0.2
        assert current['action_index'] == 0
        assert chips(client, game_id)['C'] == 100

    def test_undo_a_fold_brings_the_player_back(self, client):
        game_id = start_game(client, ['A', 'B', 'C'])
        act(client, game_id, 'C', 'fold')
        self.undo(client, game_id)
        current = status(client, game_id)
        assert current['current_player_name'] == 'C'
        assert {p['name']: p['result'] for p in current['players']}['C'] is None

    def test_undo_the_fold_that_ended_the_hand_takes_the_pot_back(self, client):
        game_id = start_game(client, ['A', 'B', 'C'])
        act(client, game_id, 'C', 'fold')
        act(client, game_id, 'A', 'fold')
        assert chips(client, game_id)['B'] == 100.1
        self.undo(client, game_id)
        current = status(client, game_id)
        assert current['phase'] == 'preflop'
        assert current['current_player_name'] == 'A'
        assert chips(client, game_id) == {'A': 99.9, 'B': 99.8, 'C': 100.0}
        results = {p['name']: p['result'] for p in current['players']}
        assert results == {'A': None, 'B': None, 'C': 'folded'}

    def test_undo_an_all_in_clears_the_flag(self, client):
        game_id = start_game(client, ['A', 'B', 'C'], buy_ins={'C': 10})
        act(client, game_id, 'C', 'raise', 10)
        self.undo(client, game_id)
        assert chips(client, game_id)['C'] == 10
        assert act(client, game_id, 'C', 'call', 0.2).status_code == 201
        act(client, game_id, 'A', 'raise', 5)
        act(client, game_id, 'B', 'fold')
        # C is not all-in any more, so the raise comes back to C
        assert status(client, game_id)['current_player_name'] == 'C'

    def test_undo_across_a_street_goes_back_a_street(self, client):
        game_id = start_game(client, ['A', 'B', 'C'])
        act(client, game_id, 'C', 'call', 0.2)
        act(client, game_id, 'A', 'call', 0.1)
        act(client, game_id, 'B', 'check')
        client.patch(f'/games/{game_id}/hands/1/flop', json=FLOP)
        assert status(client, game_id)['phase'] == 'flop'
        self.undo(client, game_id)
        current = status(client, game_id)
        assert current['phase'] == 'preflop'
        assert current['current_player_name'] == 'B'

    def test_blinds_cannot_be_undone(self, client):
        game_id = start_game(client, ['A', 'B', 'C'])
        assert self.undo(client, game_id).status_code == 400


class TestSetTurnAndStack:
    def test_dealer_can_hand_the_turn_to_another_player(self, client):
        game_id = start_game(client, ['A', 'B', 'C'])
        response = client.patch(
            f'/games/{game_id}/hands/1/state', json={'current_player_name': 'A'}
        )
        assert response.status_code == 200, response.text
        assert status(client, game_id)['current_player_name'] == 'A'
        assert act(client, game_id, 'A', 'call', 0.1).status_code == 201

    def test_turn_cannot_go_to_a_folded_player(self, client):
        game_id = start_game(client, ['A', 'B', 'C'])
        act(client, game_id, 'C', 'fold')
        response = client.patch(
            f'/games/{game_id}/hands/1/state', json={'current_player_name': 'C'}
        )
        assert response.status_code == 400

    def test_dealer_can_correct_a_stack_and_it_is_logged(self, client):
        game_id = start_game(client, ['A', 'B', 'C'])
        response = client.patch(
            f'/games/{game_id}/players/C/chips',
            json={'current_chips': 80, 'reason': 'miscounted buy-in'},
        )
        assert response.status_code == 200, response.text
        assert response.json()['current_chips'] == 80
        assert response.json()['delta'] == -20
        assert chips(client, game_id)['C'] == 80
        log = client.get(f'/games/{game_id}/chip-adjustments').json()
        assert log[0]['player_name'] == 'C'
        assert log[0]['delta'] == -20
        assert log[0]['reason'] == 'miscounted buy-in'

    def test_stack_cannot_be_negative(self, client):
        game_id = start_game(client, ['A', 'B', 'C'])
        response = client.patch(
            f'/games/{game_id}/players/C/chips', json={'current_chips': -5}
        )
        assert response.status_code == 422
