"""Tests for auto-seat-number assignment (aia-core-9gaj)."""


def test_post_games_assigns_sequential_seat_numbers(client):
    """POST /games should assign seat_number 1, 2, 3 in player order."""
    resp = client.post(
        '/games',
        json={'game_date': '2026-04-12', 'player_names': ['Alice', 'Bob', 'Carol']},
    )
    assert resp.status_code == 201
    data = resp.json()
    players = data['players']
    assert len(players) == 3
    seats = {p['name']: p['seat_number'] for p in players}
    assert seats == {'Alice': 1, 'Bob': 2, 'Carol': 3}


def test_add_player_assigns_max_plus_one(client):
    """POST /games/{id}/players should assign max(existing seats) + 1."""
    resp = client.post(
        '/games',
        json={'game_date': '2026-04-12', 'player_names': ['Alice', 'Bob']},
    )
    game_id = resp.json()['game_id']

    resp2 = client.post(
        f'/games/{game_id}/players',
        json={'player_name': 'Carol'},
    )
    assert resp2.status_code == 201
    assert resp2.json()['seat_number'] == 3

    # Verify via GET that Carol's seat persists in the response
    resp3 = client.get(f'/games/{game_id}')
    players = resp3.json()['players']
    seats = {p['name']: p['seat_number'] for p in players}
    assert seats == {'Alice': 1, 'Bob': 2, 'Carol': 3}


def test_toggle_active_preserves_seat_number(client):
    """Toggling is_active should NOT change a player's seat_number."""
    resp = client.post(
        '/games',
        json={'game_date': '2026-04-12', 'player_names': ['Alice', 'Bob']},
    )
    game_id = resp.json()['game_id']

    # Deactivate Alice
    client.patch(
        f'/games/{game_id}/players/Alice/status',
        json={'is_active': False},
    )

    # Reactivate Alice
    client.patch(
        f'/games/{game_id}/players/Alice/status',
        json={'is_active': True},
    )

    resp2 = client.get(f'/games/{game_id}')
    players = resp2.json()['players']
    seats = {p['name']: p['seat_number'] for p in players}
    assert seats == {'Alice': 1, 'Bob': 2}


def test_game_session_response_includes_seat_number(client):
    """GameSessionResponse must include seat_number for every player."""
    resp = client.post(
        '/games',
        json={'game_date': '2026-04-12', 'player_names': ['Zoe']},
    )
    data = resp.json()
    player = data['players'][0]
    assert 'seat_number' in player
    assert player['seat_number'] == 1
