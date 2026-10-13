"""Tests for T-015: List Game Sessions endpoint (GET /games)."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, StaticPool
from sqlalchemy.orm import sessionmaker

from app.database.models import Base
from app.database.session import get_db
from app.main import app

DATABASE_URL = 'sqlite:///:memory:'
engine = create_engine(
    DATABASE_URL, connect_args={'check_same_thread': False}, poolclass=StaticPool
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()


def create_game(client, game_date: str, player_names: list[str]):
    """Helper to create a game session and return its JSON."""
    resp = client.post(
        '/games',
        json={'game_date': game_date, 'player_names': player_names},
    )
    assert resp.status_code == 201
    return resp.json()


class TestListGameSessions:
    """GET /games — list game sessions with optional date filters."""

    def test_list_returns_200_with_no_games(self, client):
        response = client.get('/games')
        assert response.status_code == 200

    def test_list_returns_empty_list_when_no_games(self, client):
        response = client.get('/games')
        assert response.json() == []

    def test_list_returns_all_games(self, client):
        create_game(client, '2026-01-01', ['Alice', 'Bob'])
        create_game(client, '2026-02-01', ['Carol', 'Dan'])
        response = client.get('/games')
        assert len(response.json()) == 2

    def test_list_ordered_by_date_descending(self, client):
        create_game(client, '2026-01-01', ['Alice'])
        create_game(client, '2026-03-01', ['Bob'])
        create_game(client, '2026-02-01', ['Carol'])
        data = client.get('/games').json()
        dates = [item['game_date'] for item in data]
        assert dates == sorted(dates, reverse=True)

    def test_list_item_includes_game_id(self, client):
        created = create_game(client, '2026-03-11', ['Alice'])
        data = client.get('/games').json()
        assert data[0]['game_id'] == created['game_id']

    def test_list_item_includes_game_date(self, client):
        create_game(client, '2026-03-11', ['Alice'])
        data = client.get('/games').json()
        assert data[0]['game_date'] == '2026-03-11'

    def test_list_item_includes_status(self, client):
        create_game(client, '2026-03-11', ['Alice'])
        data = client.get('/games').json()
        assert data[0]['status'] == 'active'

    def test_list_item_includes_player_count(self, client):
        create_game(client, '2026-03-11', ['Alice', 'Bob', 'Carol'])
        data = client.get('/games').json()
        assert data[0]['player_count'] == 3

    def test_list_item_includes_hand_count(self, client):
        create_game(client, '2026-03-11', ['Alice'])
        data = client.get('/games').json()
        assert data[0]['hand_count'] == 0

    def test_list_item_does_not_include_player_names(self, client):
        create_game(client, '2026-03-11', ['Alice'])
        data = client.get('/games').json()
        assert 'player_names' not in data[0]

    def test_filter_date_from_excludes_earlier_games(self, client):
        create_game(client, '2026-01-01', ['Alice'])
        create_game(client, '2026-06-01', ['Bob'])
        data = client.get('/games', params={'date_from': '2026-03-01'}).json()
        assert len(data) == 1
        assert data[0]['game_date'] == '2026-06-01'

    def test_filter_date_to_excludes_later_games(self, client):
        create_game(client, '2026-01-01', ['Alice'])
        create_game(client, '2026-06-01', ['Bob'])
        data = client.get('/games', params={'date_to': '2026-03-01'}).json()
        assert len(data) == 1
        assert data[0]['game_date'] == '2026-01-01'

    def test_filter_date_from_and_date_to(self, client):
        create_game(client, '2026-01-01', ['Alice'])
        create_game(client, '2026-04-01', ['Bob'])
        create_game(client, '2026-07-01', ['Carol'])
        data = client.get(
            '/games',
            params={'date_from': '2026-02-01', 'date_to': '2026-06-01'},
        ).json()
        assert len(data) == 1
        assert data[0]['game_date'] == '2026-04-01'

    def test_filter_date_from_inclusive(self, client):
        create_game(client, '2026-03-01', ['Alice'])
        data = client.get('/games', params={'date_from': '2026-03-01'}).json()
        assert len(data) == 1

    def test_filter_date_to_inclusive(self, client):
        create_game(client, '2026-03-01', ['Alice'])
        data = client.get('/games', params={'date_to': '2026-03-01'}).json()
        assert len(data) == 1

    def test_filter_returns_empty_list_when_no_match(self, client):
        create_game(client, '2026-01-01', ['Alice'])
        data = client.get('/games', params={'date_from': '2026-06-01'}).json()
        assert data == []
