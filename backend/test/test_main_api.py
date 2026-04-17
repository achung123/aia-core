def test_game_api(client):
    response = client.get('/')
    assert response.status_code == 200
    assert response.json() == {
        'message': 'Welcome to the All In Analytics Core Backend!'
    }
