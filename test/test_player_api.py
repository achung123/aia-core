"""Tests for T-011: Player CRUD endpoints."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, StaticPool
from sqlalchemy.exc import IntegrityError as SAIntegrityError
from sqlalchemy.orm import sessionmaker
from unittest.mock import MagicMock

from app.database.database_models import Base as LegacyBase
from app.database.models import Base as ModelsBase
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
    LegacyBase.metadata.create_all(bind=engine)
    ModelsBase.metadata.create_all(bind=engine)
    yield
    ModelsBase.metadata.drop_all(bind=engine)
    LegacyBase.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()


class TestCreatePlayer:
    """POST /players — create a player."""

    def test_create_player_returns_201(self, client):
        response = client.post('/players', json={'name': 'Adam'})
        assert response.status_code == 201

    def test_create_player_returns_player_data(self, client):
        response = client.post('/players', json={'name': 'Adam'})
        data = response.json()
        assert data['name'] == 'Adam'
        assert 'player_id' in data
        assert 'created_at' in data

    def test_create_player_assigns_id(self, client):
        response = client.post('/players', json={'name': 'Gil'})
        data = response.json()
        assert isinstance(data['player_id'], int)
        assert data['player_id'] > 0

    def test_create_duplicate_player_returns_409(self, client):
        client.post('/players', json={'name': 'Adam'})
        response = client.post('/players', json={'name': 'Adam'})
        assert response.status_code == 409

    def test_create_duplicate_player_case_insensitive_returns_409(self, client):
        client.post('/players', json={'name': 'Adam'})
        response = client.post('/players', json={'name': 'adam'})
        assert response.status_code == 409


class TestListPlayers:
    """GET /players — list all players."""

    def test_list_players_returns_200(self, client):
        response = client.get('/players')
        assert response.status_code == 200

    def test_list_players_returns_empty_list(self, client):
        response = client.get('/players')
        assert response.json() == []

    def test_list_players_returns_created_players(self, client):
        client.post('/players', json={'name': 'Adam'})
        client.post('/players', json={'name': 'Gil'})
        response = client.get('/players')
        names = [p['name'] for p in response.json()]
        assert 'Adam' in names
        assert 'Gil' in names

    def test_list_players_returns_list_type(self, client):
        client.post('/players', json={'name': 'Zain'})
        response = client.get('/players')
        assert isinstance(response.json(), list)


class TestGetPlayerByName:
    """GET /players/{player_name} — get player by name (case-insensitive)."""

    def test_get_player_by_name_returns_200(self, client):
        client.post('/players', json={'name': 'Adam'})
        response = client.get('/players/Adam')
        assert response.status_code == 200

    def test_get_player_by_name_returns_player_data(self, client):
        client.post('/players', json={'name': 'Adam'})
        response = client.get('/players/Adam')
        data = response.json()
        assert data['name'] == 'Adam'
        assert 'player_id' in data

    def test_get_player_by_name_case_insensitive_lower(self, client):
        client.post('/players', json={'name': 'Adam'})
        response = client.get('/players/adam')
        assert response.status_code == 200

    def test_get_player_by_name_case_insensitive_upper(self, client):
        client.post('/players', json={'name': 'adam'})
        response = client.get('/players/ADAM')
        assert response.status_code == 200

    def test_get_player_by_name_case_insensitive_mixed(self, client):
        client.post('/players', json={'name': 'Adam'})
        response = client.get('/players/aDaM')
        assert response.status_code == 200

    def test_get_player_not_found_returns_404(self, client):
        response = client.get('/players/NonExistentPlayer')
        assert response.status_code == 404


@pytest.fixture
def client_with_racy_db():
    """Client whose db.commit() raises IntegrityError (simulates TOCTOU race)."""
    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.first.return_value = None
    mock_db.commit.side_effect = SAIntegrityError(None, None, BaseException())

    def mock_get_db():
        yield mock_db

    app.dependency_overrides[get_db] = mock_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()


class TestCreatePlayerConcurrencyGuard:
    """POST /players — TOCTOU race condition handling (aia-core-m41)."""

    def test_integrity_error_on_commit_returns_409(self, client_with_racy_db):
        """When db.commit raises IntegrityError (concurrent duplicate insert), return 409."""
        response = client_with_racy_db.post('/players', json={'name': 'RacePlayer'})
        assert response.status_code == 409

    def test_integrity_error_on_commit_rolls_back(self, client_with_racy_db):
        """When db.commit raises IntegrityError, the session must be rolled back."""
        from unittest.mock import MagicMock as _MM

        # Extract the mock_db from the override to inspect it after the call
        captured = {}

        def capturing_get_db():
            mock_db = _MM()
            mock_db.query.return_value.filter.return_value.first.return_value = None
            mock_db.commit.side_effect = SAIntegrityError(None, None, BaseException())
            captured['db'] = mock_db
            yield mock_db

        app.dependency_overrides[get_db] = capturing_get_db
        client = TestClient(app)
        client.post('/players', json={'name': 'RacePlayer'})
        app.dependency_overrides.clear()
        captured['db'].rollback.assert_called_once()
