"""A new hand cannot be started while the previous one is unsettled."""

CARDS = {'A': ('Ah', 'Ad'), 'B': ('Kh', 'Kd'), 'C': ('Qh', 'Qd')}


def new_game(client):
    return client.post(
        '/games',
        json={
            'game_date': '2026-10-14',
            'player_names': ['A', 'B', 'C'],
            'default_buy_in': 20,
        },
    ).json()['game_id']


def deal(client, game_id, hand_number=1):
    for name, (c1, c2) in CARDS.items():
        client.patch(
            f'/games/{game_id}/hands/{hand_number}/players/{name}',
            json={'card_1': c1, 'card_2': c2},
        )


def start(client, game_id, **params):
    return client.post(f'/games/{game_id}/hands/start', params=params or None)


def test_the_first_hand_can_always_start(client):
    assert start(client, new_game(client)).status_code == 201


def test_a_second_hand_is_refused_while_the_first_is_in_progress(client):
    game_id = new_game(client)
    start(client, game_id)
    deal(client, game_id)
    response = start(client, game_id)
    assert response.status_code == 409
    assert 'Hand 1' in response.json()['detail']
    hands = client.get(f'/games/{game_id}/hands').json()
    assert len(hands) == 1


def test_a_hand_still_waiting_for_cards_also_blocks(client):
    game_id = new_game(client)
    start(client, game_id)
    assert start(client, game_id).status_code == 409


def test_a_second_hand_starts_once_the_first_is_settled(client):
    game_id = new_game(client)
    start(client, game_id)
    deal(client, game_id)
    for name, action, amount in (('C', 'fold', None), ('A', 'fold', None)):
        client.post(
            f'/games/{game_id}/hands/1/players/{name}/actions',
            json={'street': 'preflop', 'action': action, 'amount': amount},
        )
    # Fold-to-one settled the hand: B won, A and C folded
    assert start(client, game_id).status_code == 201


def test_force_overrides_the_guard(client):
    game_id = new_game(client)
    start(client, game_id)
    deal(client, game_id)
    response = start(client, game_id, force='true')
    assert response.status_code == 201
    assert response.json()['hand_number'] == 2


def test_hands_entered_after_the_fact_never_block(client):
    game_id = new_game(client)
    client.post(
        f'/games/{game_id}/hands',
        json={
            'flop_1': '3c',
            'flop_2': '8d',
            'flop_3': '9s',
            'turn': '4h',
            'river': '10c',
            'player_entries': [
                {'player_name': 'A', 'card_1': 'Ah', 'card_2': 'Ad'},
                {'player_name': 'B', 'card_1': 'Kh', 'card_2': 'Kd'},
            ],
        },
    )
    assert start(client, game_id).status_code == 201
