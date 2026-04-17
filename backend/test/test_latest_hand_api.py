"""Tests for GET /games/{game_id}/hands/latest endpoint."""


def test_latest_hand_returns_none_when_no_hands(client):
    """latest endpoint returns null when the game has no hands."""
    game = client.post(
        '/games',
        json={'game_date': '2026-04-13', 'player_names': ['Alice', 'Bob']},
    )
    game_id = game.json()['game_id']
    resp = client.get(f'/games/{game_id}/hands/latest')
    assert resp.status_code == 200
    assert resp.json() is None


def test_latest_hand_returns_404_for_missing_game(client):
    """latest endpoint returns 404 when game does not exist."""
    resp = client.get('/games/9999/hands/latest')
    assert resp.status_code == 404


def test_latest_hand_returns_most_recent(client):
    """latest endpoint returns the hand with the highest hand_number."""
    game = client.post(
        '/games',
        json={'game_date': '2026-04-13', 'player_names': ['Alice', 'Bob']},
    ).json()
    game_id = game['game_id']

    # Create two hands
    h1 = client.post(f'/games/{game_id}/hands', json={}).json()
    h2 = client.post(f'/games/{game_id}/hands', json={}).json()

    resp = client.get(f'/games/{game_id}/hands/latest')
    assert resp.status_code == 200
    data = resp.json()
    assert data is not None
    assert data['hand_number'] == h2['hand_number']
    assert data['hand_number'] > h1['hand_number']


def test_latest_hand_has_player_hands_key(client):
    """latest endpoint includes player_hands key in the response."""
    game = client.post(
        '/games',
        json={'game_date': '2026-04-13', 'player_names': ['Alice', 'Bob']},
    ).json()
    game_id = game['game_id']

    client.post(f'/games/{game_id}/hands', json={})

    resp = client.get(f'/games/{game_id}/hands/latest')
    data = resp.json()
    assert 'player_hands' in data
    assert isinstance(data['player_hands'], list)
