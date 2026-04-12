import uuid


def test_response_has_x_request_id_header(client):
    response = client.get('/')
    assert 'x-request-id' in response.headers


def test_x_request_id_is_valid_uuid4(client):
    response = client.get('/')
    request_id = response.headers['x-request-id']
    parsed = uuid.UUID(request_id, version=4)
    assert str(parsed) == request_id


def test_x_request_id_is_unique_per_request(client):
    r1 = client.get('/')
    r2 = client.get('/')
    assert r1.headers['x-request-id'] != r2.headers['x-request-id']


def test_response_has_x_response_time_ms_header(client):
    response = client.get('/')
    assert 'x-response-time-ms' in response.headers


def test_x_response_time_ms_is_valid_number(client):
    response = client.get('/')
    value = response.headers['x-response-time-ms']
    parsed = float(value)
    assert parsed >= 0


def test_x_response_time_ms_has_two_decimal_places(client):
    response = client.get('/')
    value = response.headers['x-response-time-ms']
    # Should have exactly 2 decimal places
    assert '.' in value
    decimal_part = value.split('.')[1]
    assert len(decimal_part) == 2


def test_headers_present_on_error_response(client):
    response = client.get('/nonexistent-endpoint-that-does-not-exist')
    assert 'x-request-id' in response.headers
    assert 'x-response-time-ms' in response.headers
