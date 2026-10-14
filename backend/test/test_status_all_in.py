"""The status reports who has put their whole stack in."""


def make_game(client, buy_ins):
    game_id = client.post(
        '/games',
        json={
            'game_date': '2026-10-14',
            'player_names': list(buy_ins),
            'player_buy_ins': buy_ins,
            'default_buy_in': 20,
        },
    ).json()['game_id']
    client.post(f'/games/{game_id}/hands/start')
    cards = {'A': ('Ah', 'Ad'), 'B': ('Kh', 'Kd'), 'C': ('Qh', 'Qd')}
    for name in buy_ins:
        client.patch(
            f'/games/{game_id}/hands/1/players/{name}',
            json={'card_1': cards[name][0], 'card_2': cards[name][1]},
        )
    return game_id


def all_in_by_name(client, game_id):
    status = client.get(f'/games/{game_id}/hands/1/status').json()
    return {player['name']: player['is_all_in'] for player in status['players']}


def test_nobody_is_all_in_at_the_start_of_a_hand(client):
    game_id = make_game(client, {'A': 20, 'B': 20, 'C': 20})
    assert all_in_by_name(client, game_id) == {'A': False, 'B': False, 'C': False}


def test_a_player_who_bets_their_stack_is_reported_all_in(client):
    game_id = make_game(client, {'A': 20, 'B': 20, 'C': 5})
    response = client.post(
        f'/games/{game_id}/hands/1/players/C/actions',
        json={'street': 'preflop', 'action': 'raise', 'amount': 5},
    )
    assert response.status_code == 201, response.text
    assert all_in_by_name(client, game_id) == {'A': False, 'B': False, 'C': True}


def test_calling_for_less_marks_the_caller_all_in(client):
    game_id = make_game(client, {'A': 5, 'B': 20, 'C': 20})
    client.post(
        f'/games/{game_id}/hands/1/players/C/actions',
        json={'street': 'preflop', 'action': 'raise', 'amount': 10},
    )
    client.post(
        f'/games/{game_id}/hands/1/players/A/actions',
        json={'street': 'preflop', 'action': 'call', 'amount': 4.9},
    )
    assert all_in_by_name(client, game_id)['A'] is True
