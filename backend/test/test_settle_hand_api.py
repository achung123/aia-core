"""API tests for hand settlement: pots, payouts, P&L, and safe re-runs."""

import pytest

CARDS = {
    'A': ('Ah', 'Ad'),  # aces
    'B': ('Kh', 'Kd'),  # kings
    'C': ('Qh', 'Qd'),  # queens
    'D': ('7c', '2s'),
}
BOARD = {'flop_1': '3c', 'flop_2': '8d', 'flop_3': '9s'}


def start_game(client, names, buy_ins=None, default_buy_in=100):
    payload = {
        'game_date': '2026-10-13',
        'player_names': names,
        'default_buy_in': default_buy_in,
    }
    if buy_ins:
        payload['player_buy_ins'] = buy_ins
    game_id = client.post('/games', json=payload).json()['game_id']
    assert client.post(f'/games/{game_id}/hands/start').status_code == 201
    for name in names:
        card_1, card_2 = CARDS[name]
        response = client.patch(
            f'/games/{game_id}/hands/1/players/{name}',
            json={'card_1': card_1, 'card_2': card_2},
        )
        assert response.status_code == 200, response.text
    return game_id


def act(client, game_id, name, street, action, amount=None, all_in=False):
    response = client.post(
        f'/games/{game_id}/hands/1/players/{name}/actions',
        json={
            'street': street,
            'action': action,
            'amount': amount,
            'is_all_in': all_in,
        },
    )
    assert response.status_code == 201, response.text


def status(client, game_id):
    return client.get(f'/games/{game_id}/hands/1/status').json()


def chips(client, game_id):
    return {p['name']: p['current_chips'] for p in status(client, game_id)['players']}


def deal_board(client, game_id):
    status(client, game_id)
    client.patch(f'/games/{game_id}/hands/1/flop', json=BOARD)
    status(client, game_id)
    client.patch(f'/games/{game_id}/hands/1/turn', json={'turn': '4h'})
    status(client, game_id)
    client.patch(f'/games/{game_id}/hands/1/river', json={'river': 'Jc'})
    status(client, game_id)


def settle(client, game_id, ranking=None, **params):
    body = {} if ranking is None else {'ranking': ranking}
    return client.post(f'/games/{game_id}/hands/1/settle', json=body, params=params)


def by_name(settlement):
    return {player['player_name']: player for player in settlement['players']}


@pytest.fixture
def limped_three_way(client):
    """A (SB), B (BB), C all in for 0.20 preflop, board dealt out."""
    game_id = start_game(client, ['A', 'B', 'C'])
    act(client, game_id, 'C', 'preflop', 'call', 0.2)
    act(client, game_id, 'A', 'preflop', 'call', 0.1)
    act(client, game_id, 'B', 'preflop', 'check')
    deal_board(client, game_id)
    return game_id


class TestSettleFromCards:
    def test_best_hand_wins_the_pot(self, client, limped_three_way):
        response = settle(client, limped_three_way)
        assert response.status_code == 200, response.text
        players = by_name(response.json())
        assert players['A']['result'] == 'won'
        assert players['A']['profit_loss'] == 0.4
        assert players['B']['result'] == 'lost'
        assert players['B']['profit_loss'] == -0.2
        assert chips(client, limped_three_way) == {'A': 100.4, 'B': 99.8, 'C': 99.8}

    def test_profit_and_loss_sums_to_zero(self, client, limped_three_way):
        players = settle(client, limped_three_way).json()['players']
        assert round(sum(player['profit_loss'] for player in players), 2) == 0

    def test_hand_response_carries_results(self, client, limped_three_way):
        settle(client, limped_three_way)
        hand = client.get(f'/games/{limped_three_way}/hands/1').json()
        results = {ph['player_name']: ph for ph in hand['player_hands']}
        assert results['A']['result'] == 'won'
        assert results['A']['outcome_street'] == 'river'
        assert results['C']['profit_loss'] == -0.2

    def test_phase_becomes_showdown(self, client, limped_three_way):
        settle(client, limped_three_way)
        assert status(client, limped_three_way)['phase'] == 'showdown'


class TestSettleIsRepeatable:
    def test_settling_twice_pays_once(self, client, limped_three_way):
        settle(client, limped_three_way)
        settle(client, limped_three_way)
        assert chips(client, limped_three_way) == {'A': 100.4, 'B': 99.8, 'C': 99.8}

    def test_correcting_the_winner_moves_the_chips(self, client, limped_three_way):
        settle(client, limped_three_way)
        response = settle(client, limped_three_way, ranking=[['B']])
        assert response.status_code == 200, response.text
        assert chips(client, limped_three_way) == {'A': 99.8, 'B': 100.4, 'C': 99.8}
        players = by_name(response.json())
        assert players['A']['result'] == 'lost'
        assert players['B']['result'] == 'won'

    def test_dry_run_changes_nothing(self, client, limped_three_way):
        response = settle(client, limped_three_way, dry_run=True)
        assert by_name(response.json())['A']['payout'] == 0.6
        assert chips(client, limped_three_way) == {'A': 99.8, 'B': 99.8, 'C': 99.8}
        hand = client.get(f'/games/{limped_three_way}/hands/1').json()
        assert all(ph['result'] is None for ph in hand['player_hands'])


class TestSplitPot:
    def test_dealer_declared_tie_splits_with_odd_cent_to_first_seat(self, client):
        game_id = start_game(client, ['A', 'B', 'C', 'D'])
        act(client, game_id, 'C', 'preflop', 'raise', 0.45)
        act(client, game_id, 'D', 'preflop', 'raise', 0.95)
        act(client, game_id, 'A', 'preflop', 'call', 0.85)
        act(client, game_id, 'B', 'preflop', 'fold')
        act(client, game_id, 'C', 'preflop', 'fold')
        # pot = 0.45 (C) + 0.20 (B) + 0.95 + 0.95 = 2.55
        response = settle(client, game_id, ranking=[['A', 'D']])
        assert response.status_code == 200, response.text
        players = by_name(response.json())
        assert players['A']['payout'] == 1.28  # small blind gets the odd cent
        assert players['D']['payout'] == 1.27
        assert players['C']['profit_loss'] == -0.45
        assert round(sum(p['profit_loss'] for p in players.values()), 2) == 0


class TestSidePots:
    def test_short_all_in_winner_takes_only_what_they_covered(self, client):
        # A has the best hand but only 10 chips
        game_id = start_game(client, ['A', 'B', 'C'], buy_ins={'A': 10})
        act(client, game_id, 'C', 'preflop', 'raise', 50)
        act(client, game_id, 'A', 'preflop', 'call', 9.9, all_in=True)
        act(client, game_id, 'B', 'preflop', 'call', 49.8)
        deal_board(client, game_id)
        response = settle(client, game_id)
        assert response.status_code == 200, response.text
        body = response.json()
        assert body['pots'] == [
            {'amount': 30.0, 'eligible_players': ['A', 'B', 'C'], 'winners': ['A']},
            {'amount': 80.0, 'eligible_players': ['B', 'C'], 'winners': ['B']},
        ]
        players = by_name(body)
        assert players['A']['profit_loss'] == 20.0
        assert players['B']['profit_loss'] == 30.0
        assert players['C']['profit_loss'] == -50.0
        assert players['C']['result'] == 'lost'
        assert chips(client, game_id) == {'A': 30.0, 'B': 130.0, 'C': 50.0}

    def test_folded_money_is_counted_in_side_pots_during_the_hand(self, client):
        game_id = start_game(client, ['A', 'B', 'C'], buy_ins={'A': 10})
        act(client, game_id, 'C', 'preflop', 'raise', 50)
        act(client, game_id, 'A', 'preflop', 'call', 9.9, all_in=True)
        act(client, game_id, 'B', 'preflop', 'call', 49.8)
        deal_board(client, game_id)
        current = status(client, game_id)
        assert current['pot'] == 110.0
        assert current['side_pots'] == [
            {'amount': 80.0, 'eligible_players': ['B', 'C']}
        ]

    def test_dealer_winner_who_is_not_in_the_side_pot_needs_cards_for_the_rest(
        self, client
    ):
        game_id = start_game(client, ['A', 'B', 'C'], buy_ins={'A': 10})
        act(client, game_id, 'C', 'preflop', 'raise', 50)
        act(client, game_id, 'A', 'preflop', 'call', 9.9, all_in=True)
        act(client, game_id, 'B', 'preflop', 'call', 49.8)
        # No board: cards cannot break the B-vs-C side pot
        response = settle(client, game_id, ranking=[['A']])
        assert response.status_code == 400
        assert 'B, C' in response.json()['detail']


class TestFoldToOne:
    def test_last_player_standing_is_paid_automatically(self, client):
        game_id = start_game(client, ['A', 'B', 'C'])
        act(client, game_id, 'C', 'preflop', 'fold')
        act(client, game_id, 'A', 'preflop', 'fold')
        assert chips(client, game_id) == {'A': 99.9, 'B': 100.1, 'C': 100.0}
        hand = client.get(f'/games/{game_id}/hands/1').json()
        results = {ph['player_name']: ph for ph in hand['player_hands']}
        assert results['B']['result'] == 'won'
        assert results['B']['profit_loss'] == 0.1
        assert results['A']['profit_loss'] == -0.1
        assert results['C']['profit_loss'] == 0.0

    def test_uncalled_raise_comes_back(self, client):
        game_id = start_game(client, ['A', 'B', 'C'])
        act(client, game_id, 'C', 'preflop', 'raise', 5)
        act(client, game_id, 'A', 'preflop', 'fold')
        act(client, game_id, 'B', 'preflop', 'fold')
        assert chips(client, game_id) == {'A': 99.9, 'B': 99.8, 'C': 100.3}


class TestSettleWithoutEnoughInformation:
    def test_needs_winners_when_board_is_incomplete(self, client):
        game_id = start_game(client, ['A', 'B', 'C'])
        act(client, game_id, 'C', 'preflop', 'call', 0.2)
        act(client, game_id, 'A', 'preflop', 'call', 0.1)
        act(client, game_id, 'B', 'preflop', 'check')
        response = settle(client, game_id)
        assert response.status_code == 400
        assert chips(client, game_id) == {'A': 99.8, 'B': 99.8, 'C': 99.8}

    def test_unknown_player_in_ranking_is_rejected(self, client, limped_three_way):
        response = settle(client, limped_three_way, ranking=[['Nobody']])
        assert response.status_code == 404

    def test_folded_player_cannot_be_ranked(self, client):
        game_id = start_game(client, ['A', 'B', 'C'])
        act(client, game_id, 'C', 'preflop', 'fold')
        act(client, game_id, 'A', 'preflop', 'call', 0.1)
        act(client, game_id, 'B', 'preflop', 'check')
        response = settle(client, game_id, ranking=[['C']])
        assert response.status_code == 400


class TestResultPatchIsRepeatable:
    def test_saving_the_same_result_twice_credits_once(self, client):
        game_id = start_game(client, ['A', 'B', 'C'])
        act(client, game_id, 'C', 'preflop', 'call', 0.2)
        act(client, game_id, 'A', 'preflop', 'call', 0.1)
        act(client, game_id, 'B', 'preflop', 'check')
        for _ in range(2):
            response = client.patch(
                f'/games/{game_id}/hands/1/players/A/result',
                json={'result': 'won', 'profit_loss': 0.4},
            )
            assert response.status_code == 200
        assert chips(client, game_id)['A'] == 100.4

    def test_bulk_results_twice_credits_once(self, client):
        game_id = start_game(client, ['A', 'B', 'C'])
        act(client, game_id, 'C', 'preflop', 'call', 0.2)
        act(client, game_id, 'A', 'preflop', 'call', 0.1)
        act(client, game_id, 'B', 'preflop', 'check')
        payload = [
            {'player_name': 'A', 'result': 'won', 'profit_loss': 0.4},
            {'player_name': 'B', 'result': 'lost', 'profit_loss': -0.2},
        ]
        for _ in range(2):
            client.patch(f'/games/{game_id}/hands/1/results', json=payload)
        assert chips(client, game_id) == {'A': 100.4, 'B': 99.8, 'C': 99.8}


class TestNoBettingTracked:
    def test_results_are_set_without_touching_chips(self, client):
        game_id = client.post(
            '/games', json={'game_date': '2026-10-13', 'player_names': ['A', 'B']}
        ).json()['game_id']
        client.post(
            f'/games/{game_id}/hands',
            json={
                'flop_1': '3c',
                'flop_2': '8d',
                'flop_3': '9s',
                'turn': '4h',
                'river': 'Jc',
                'player_entries': [
                    {'player_name': 'A', 'card_1': 'Ah', 'card_2': 'Ad'},
                    {'player_name': 'B', 'card_1': 'Kh', 'card_2': 'Kd'},
                ],
            },
        )
        response = settle(client, game_id)
        assert response.status_code == 200, response.text
        players = by_name(response.json())
        assert players['A']['result'] == 'won'
        assert players['B']['result'] == 'lost'
        assert players['A']['profit_loss'] is None
