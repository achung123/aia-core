from pydantic_models.app_models import CommunityState, Card, GameState, CommunityRequest


def test_post_community_cards(client, game_setup):
    game_date = '01-10-2023'
    hand_number = 1

    community_state = CommunityState(
        flop_card_0=Card(rank='A', suit='S'),
        flop_card_1=Card(rank='K', suit='H'),
        flop_card_2=Card(rank='2', suit='D'),
        active_players=['Gil', 'Adam', 'Zain', 'Matt'],
    )

    request = CommunityRequest(community_state=community_state)
    response = client.post(
        f'/game/community/{game_date}/{hand_number}', json=request.model_dump()
    )
    assert response.status_code == 200
    data = response.json()
    assert data['status'] == 'SUCCESS'
    assert data['message'] == 'Community Cards Pushed'
    assert data['game_date'] == '01-10-2023'
    assert data['hand_number'] == 1


def test_get_community_cards(client, community_setup):
    response = client.get('/game/community/01-10-2023/1')
    assert response.status_code == 200
    data = response.json()
    assert data['status'] == 'SUCCESS'
    assert data['message'] == 'Community Cards Found'
    assert data['game_date'] == '01-10-2023'
    assert data['hand_number'] == 1

    community_states = data['community_states']
    assert len(community_states) == 1
    assert community_states[0]['flop_card_0'] == Card(rank='A', suit='S').model_dump()
    assert community_states[0]['flop_card_1'] == Card(rank='K', suit='H').model_dump()
    assert community_states[0]['flop_card_2'] == Card(rank='2', suit='D').model_dump()
    assert community_states[0]['turn_card'] is None
    assert community_states[0]['river_card'] is None
    assert community_states[0]['active_players'] == ['Gil', 'Adam', 'Zain', 'Matt']
    community_states[0]['game_state'] = GameState.RIVER.value
