"""Regression tests for betting-engine bugs found in the 2026-10 deep dive."""

from app.services.betting import is_street_complete

CARDS = {'A': ('Ah', 'Ad'), 'B': ('Kh', 'Kd'), 'C': ('Qh', 'Qd')}
FLOP = {'flop_1': '3c', 'flop_2': '8d', 'flop_3': '9s'}


def start_game(client, names, buy_ins=None):
    payload = {
        'game_date': '2026-10-13',
        'player_names': names,
        'default_buy_in': 100,
    }
    if buy_ins:
        payload['player_buy_ins'] = buy_ins
    game_id = client.post('/games', json=payload).json()['game_id']
    client.post(f'/games/{game_id}/hands/start')
    for name in names:
        card_1, card_2 = CARDS[name]
        client.patch(
            f'/games/{game_id}/hands/1/players/{name}',
            json={'card_1': card_1, 'card_2': card_2},
        )
    return game_id


def act(client, game_id, name, street, action, amount=None, all_in=False, force=False):
    return client.post(
        f'/games/{game_id}/hands/1/players/{name}/actions',
        params={'force': 'true'} if force else None,
        json={
            'street': street,
            'action': action,
            'amount': amount,
            'is_all_in': all_in,
        },
    )


def status(client, game_id):
    return client.get(f'/games/{game_id}/hands/1/status').json()


def chips(client, game_id):
    return {p['name']: p['current_chips'] for p in status(client, game_id)['players']}


def limp_to_flop(client, game_id):
    assert act(client, game_id, 'C', 'preflop', 'call', 0.2).status_code == 201
    assert act(client, game_id, 'A', 'preflop', 'call', 0.1).status_code == 201
    assert act(client, game_id, 'B', 'preflop', 'check').status_code == 201
    client.patch(f'/games/{game_id}/hands/1/flop', json=FLOP)


class TestStackLimits:
    def test_cannot_wager_more_than_the_stack(self, client):
        game_id = start_game(client, ['A', 'B', 'C'], buy_ins={'C': 10})
        response = act(client, game_id, 'C', 'preflop', 'raise', 500)
        assert response.status_code == 400
        assert '10.00' in response.json()['detail']
        assert chips(client, game_id)['C'] == 10

    def test_wagering_the_whole_stack_is_all_in_without_the_flag(self, client):
        game_id = start_game(client, ['A', 'B', 'C'], buy_ins={'C': 10})
        assert act(client, game_id, 'C', 'preflop', 'raise', 10).status_code == 201
        assert chips(client, game_id)['C'] == 0
        # C is all-in, so A and B finishing the street never comes back to C
        assert act(client, game_id, 'A', 'preflop', 'call', 9.9).status_code == 201
        assert act(client, game_id, 'B', 'preflop', 'call', 9.8).status_code == 201
        assert status(client, game_id)['current_player_name'] != 'C'

    def test_call_for_less_is_capped_at_the_stack(self, client):
        game_id = start_game(client, ['A', 'B', 'C'], buy_ins={'A': 5})
        assert act(client, game_id, 'C', 'preflop', 'raise', 50).status_code == 201
        # A has 4.90 behind and faces 49.90: a plain call puts in what A has
        response = act(client, game_id, 'A', 'preflop', 'call', 49.9)
        assert response.status_code == 201, response.text
        assert response.json()['amount'] == 4.9
        assert chips(client, game_id)['A'] == 0

    def test_all_in_call_needs_no_amount(self, client):
        game_id = start_game(client, ['A', 'B', 'C'], buy_ins={'A': 5})
        act(client, game_id, 'C', 'preflop', 'raise', 50)
        response = act(client, game_id, 'A', 'preflop', 'call', None, all_in=True)
        assert response.status_code == 201, response.text
        assert response.json()['amount'] == 4.9

    def test_short_stack_posts_a_partial_blind_all_in(self, client):
        game_id = start_game(client, ['A', 'B', 'C'], buy_ins={'B': 0.15})
        current = status(client, game_id)
        assert chips(client, game_id)['B'] == 0
        assert current['pot'] == 0.25
        # The price to call is still the full big blind
        assert current['amount_to_call'] == 0.2

    def test_games_without_stacks_are_not_limited(self, client):
        game_id = client.post(
            '/games',
            json={'game_date': '2026-10-13', 'player_names': ['A', 'B', 'C']},
        ).json()['game_id']
        client.post(f'/games/{game_id}/hands/start')
        for name in ['A', 'B', 'C']:
            client.patch(
                f'/games/{game_id}/hands/1/players/{name}',
                json={'card_1': CARDS[name][0], 'card_2': CARDS[name][1]},
            )
        assert act(client, game_id, 'C', 'preflop', 'raise', 500).status_code == 201


class TestFacingAnAllIn:
    def test_lone_player_with_chips_still_owes_a_decision(self):
        actions = [{'player_id': 1, 'action': 'bet', 'amount': 100}]
        assert not is_street_complete(actions, {1, 2}, {1}, 'flop', None)

    def test_lone_player_who_has_matched_the_all_in_is_done(self):
        actions = [
            {'player_id': 1, 'action': 'bet', 'amount': 100},
            {'player_id': 2, 'action': 'call', 'amount': 100},
        ]
        assert is_street_complete(actions, {1, 2}, {1}, 'flop', None)

    def test_lone_player_with_nothing_to_call_is_done(self):
        assert is_street_complete([], {1, 2}, {1}, 'flop', None)

    def test_last_player_gets_to_call_or_fold(self, client):
        game_id = start_game(client, ['A', 'B', 'C'])
        limp_to_flop(client, game_id)
        status(client, game_id)
        assert (
            act(client, game_id, 'A', 'flop', 'bet', None, all_in=True).status_code
            == 201
        )
        assert act(client, game_id, 'B', 'flop', 'fold').status_code == 201
        current = status(client, game_id)
        assert current['current_player_name'] == 'C'
        assert current['amount_to_call'] == 99.8
        assert 'call' in current['legal_actions']


class TestTurnOrder:
    def test_all_in_player_is_not_given_the_turn_on_the_next_street(self, client):
        game_id = start_game(client, ['A', 'B', 'C'], buy_ins={'A': 10})
        limp_to_flop(client, game_id)
        status(client, game_id)
        assert (
            act(client, game_id, 'A', 'flop', 'bet', None, all_in=True).status_code
            == 201
        )
        assert act(client, game_id, 'B', 'flop', 'call', 9.8).status_code == 201
        assert act(client, game_id, 'C', 'flop', 'call', 9.8).status_code == 201
        client.patch(f'/games/{game_id}/hands/1/turn', json={'turn': '4h'})
        current = status(client, game_id)
        assert current['phase'] == 'turn'
        assert current['current_player_name'] == 'B'

    def test_forced_out_of_turn_action_does_not_skip_the_player_to_act(self, client):
        game_id = start_game(client, ['A', 'B', 'C'])
        assert status(client, game_id)['current_player_name'] == 'C'
        assert (
            act(client, game_id, 'A', 'preflop', 'fold', force=True).status_code == 201
        )
        assert status(client, game_id)['current_player_name'] == 'C'

    def test_forced_action_for_the_player_to_act_moves_on(self, client):
        game_id = start_game(client, ['A', 'B', 'C'])
        assert (
            act(client, game_id, 'C', 'preflop', 'fold', force=True).status_code == 201
        )
        assert status(client, game_id)['current_player_name'] == 'A'

    def test_folded_player_cannot_act_again(self, client):
        game_id = start_game(client, ['A', 'B', 'C'])
        act(client, game_id, 'C', 'preflop', 'fold')
        response = act(client, game_id, 'C', 'preflop', 'call', 0.2, force=True)
        assert response.status_code == 400


class TestStreetMatchesPhase:
    def test_action_is_recorded_on_the_street_the_hand_is_actually_on(self, client):
        game_id = start_game(client, ['A', 'B', 'C'])
        response = act(client, game_id, 'C', 'river', 'raise', 5)
        assert response.status_code == 201
        assert response.json()['street'] == 'preflop'
        # ...so the next player is facing that raise
        assert status(client, game_id)['amount_to_call'] == 4.9

    def test_dealing_the_flop_moves_the_hand_on_without_a_status_poll(self, client):
        game_id = start_game(client, ['A', 'B', 'C'])
        limp_to_flop(client, game_id)
        # No status poll between the flop and the bet
        response = act(client, game_id, 'A', 'flop', 'bet', 5)
        assert response.status_code == 201, response.text
