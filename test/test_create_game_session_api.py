"""Tests for T-013: Create Game Session endpoint (POST /games)."""

import pytest
from fastapi.testclient import TestClient

from app.database.database_models import Base as LegacyBase
from app.database.models import Base as ModelsBase
from app.database.session import get_db
from app.main import app
from sqlalchemy import create_engine, StaticPool
from sqlalchemy.orm import sessionmaker

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


class TestCreateGameSession:
    """POST /games — create a game session."""

    def test_create_game_returns_201(self, client):
        response = client.post(
            '/games',
            json={'game_date': '2026-03-11', 'player_names': ['Adam', 'Gil']},
        )
        assert response.status_code == 201

    def test_create_game_returns_game_id(self, client):
        response = client.post(
            '/games',
            json={'game_date': '2026-03-11', 'player_names': ['Adam', 'Gil']},
        )
        data = response.json()
        assert 'game_id' in data
        assert isinstance(data['game_id'], int)
        assert data['game_id'] > 0

    def test_create_game_returns_correct_date(self, client):
        response = client.post(
            '/games',
            json={'game_date': '2026-03-11', 'player_names': ['Adam', 'Gil']},
        )
        data = response.json()
        assert data['game_date'] == '2026-03-11'

    def test_create_game_returns_active_status(self, client):
        response = client.post(
            '/games',
            json={'game_date': '2026-03-11', 'player_names': ['Adam', 'Gil']},
        )
        data = response.json()
        assert data['status'] == 'active'

    def test_create_game_returns_player_names(self, client):
        response = client.post(
            '/games',
            json={'game_date': '2026-03-11', 'player_names': ['Adam', 'Gil']},
        )
        data = response.json()
        assert set(data['player_names']) == {'Adam', 'Gil'}

    def test_create_game_returns_hand_count_zero(self, client):
        response = client.post(
            '/games',
            json={'game_date': '2026-03-11', 'player_names': ['Adam', 'Gil']},
        )
        data = response.json()
        assert data['hand_count'] == 0

    def test_create_game_returns_created_at(self, client):
        response = client.post(
            '/games',
            json={'game_date': '2026-03-11', 'player_names': ['Adam', 'Gil']},
        )
        data = response.json()
        assert 'created_at' in data

    def test_create_game_auto_creates_missing_players(self, client):
        """Players that don't exist yet are auto-created."""
        response = client.post(
            '/games',
            json={'game_date': '2026-03-11', 'player_names': ['NewPlayer1', 'NewPlayer2']},
        )
        assert response.status_code == 201
        assert set(response.json()['player_names']) == {'NewPlayer1', 'NewPlayer2'}

    def test_create_game_reuses_existing_players(self, client):
        """Players that already exist are reused, not duplicated."""
        client.post('/players', json={'name': 'Adam'})
        response = client.post(
            '/games',
            json={'game_date': '2026-03-11', 'player_names': ['Adam', 'Gil']},
        )
        assert response.status_code == 201
        assert set(response.json()['player_names']) == {'Adam', 'Gil'}

    def test_create_game_mix_existing_and_new_players(self, client):
        """Mix of existing and new players is handled correctly."""
        client.post('/players', json={'name': 'Adam'})
        response = client.post(
            '/games',
            json={'game_date': '2026-03-11', 'player_names': ['Adam', 'Zain']},
        )
        assert response.status_code == 201
        assert set(response.json()['player_names']) == {'Adam', 'Zain'}

    def test_create_game_links_players_via_game_player(self, client):
        """Created game session is linked to players in the DB."""
        from app.database.models import GameSession, GamePlayer
        resp = client.post(
            '/games',
            json={'game_date': '2026-03-11', 'player_names': ['Adam', 'Gil']},
        )
        game_id = resp.json()['game_id']
        db = SessionLocal()
        try:
            links = db.query(GamePlayer).filter(GamePlayer.game_id == game_id).all()
            assert len(links) == 2
        finally:
            db.close()

    def test_create_game_single_player(self, client):
        response = client.post(
            '/games',
            json={'game_date': '2026-03-11', 'player_names': ['Solo']},
        )
        assert response.status_code == 201
        assert response.json()['player_names'] == ['Solo']

    def test_create_two_games_get_different_ids(self, client):
        r1 = client.post(
            '/games',
            json={'game_date': '2026-03-11', 'player_names': ['Adam']},
        )
        r2 = client.post(
            '/games',
            json={'game_date': '2026-03-12', 'player_names': ['Gil']},
        )
        assert r1.json()['game_id'] != r2.json()['game_id']

    def test_create_game_empty_player_names_returns_422(self, client):
        response = client.post(
            '/games',
            json={'game_date': '2026-03-11', 'player_names': []},
        )
        assert response.status_code == 422

    def test_create_game_duplicate_player_names_returns_201(self, client):
        """Duplicate player_names must not cause an IntegrityError (500)."""
        response = client.post(
            '/games',
            json={'game_date': '2026-03-11', 'player_names': ['Adam', 'Adam', 'Gil']},
        )
        assert response.status_code == 201

    def test_create_game_duplicate_player_names_deduplicates(self, client):
        """Duplicate player_names result in each player linked once."""
        from app.database.models import GamePlayer
        response = client.post(
            '/games',
            json={'game_date': '2026-03-11', 'player_names': ['Adam', 'Adam', 'Gil']},
        )
        data = response.json()
        assert set(data['player_names']) == {'Adam', 'Gil'}
        db = SessionLocal()
        try:
            links = db.query(GamePlayer).filter(GamePlayer.game_id == data['game_id']).all()
            assert len(links) == 2
        finally:
            db.close()
