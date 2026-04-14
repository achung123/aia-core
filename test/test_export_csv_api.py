"""Tests for CSV export of a game session."""

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


@pytest.fixture
def game_with_hand(client):
    """Create a game with one hand containing two players."""
    resp = client.post(
        '/games',
        json={'game_date': '2026-03-15', 'player_names': ['Alice', 'Bob']},
    )
    assert resp.status_code == 201
    game_id = resp.json()['game_id']

    resp = client.post(
        f'/games/{game_id}/hands',
        json={
            'flop_1': 'AH',
            'flop_2': 'KD',
            'flop_3': '2S',
            'turn': '7C',
            'river': '10H',
            'player_entries': [
                {
                    'player_name': 'Alice',
                    'card_1': 'QH',
                    'card_2': 'JD',
                    'result': 'won',
                },
                {
                    'player_name': 'Bob',
                    'card_1': '3S',
                    'card_2': '4C',
                    'result': 'lost',
                },
            ],
        },
    )
    assert resp.status_code == 201
    return game_id


class TestExportCsv:
    def test_export_csv_returns_200(self, client, game_with_hand):
        resp = client.get(f'/games/{game_with_hand}/export/csv')
        assert resp.status_code == 200

    def test_export_csv_content_type(self, client, game_with_hand):
        resp = client.get(f'/games/{game_with_hand}/export/csv')
        assert 'text/csv' in resp.headers['content-type']

    def test_export_csv_has_correct_headers(self, client, game_with_hand):
        resp = client.get(f'/games/{game_with_hand}/export/csv')
        lines = resp.text.strip().splitlines()
        header = lines[0].strip()
        assert (
            header
            == 'game_date,hand_number,player_name,hole_card_1,hole_card_2,flop_1,flop_2,flop_3,turn,river,result,profit_loss,outcome_street,is_all_in'
        )

    def test_export_csv_has_correct_data_rows(self, client, game_with_hand):
        resp = client.get(f'/games/{game_with_hand}/export/csv')
        lines = resp.text.strip().splitlines()
        # header + 2 player rows
        assert len(lines) == 3
        # Check Alice's row
        assert 'Alice' in lines[1]
        assert 'QH' in lines[1]
        assert 'JD' in lines[1]
        assert 'won' in lines[1]
        # Check Bob's row
        assert 'Bob' in lines[2]
        assert '3S' in lines[2]
        assert '4C' in lines[2]
        assert 'lost' in lines[2]

    def test_export_csv_community_cards_in_each_row(self, client, game_with_hand):
        resp = client.get(f'/games/{game_with_hand}/export/csv')
        lines = resp.text.strip().splitlines()
        for line in lines[1:]:
            assert 'AH' in line
            assert 'KD' in line
            assert '2S' in line
            assert '7C' in line
            assert '10H' in line

    def test_export_csv_game_date_format(self, client, game_with_hand):
        resp = client.get(f'/games/{game_with_hand}/export/csv')
        lines = resp.text.strip().splitlines()
        # game_date should be MM-DD-YYYY format to match CSV_COLUMNS schema
        assert '03-15-2026' in lines[1]

    def test_export_csv_404_for_missing_game(self, client):
        resp = client.get('/games/9999/export/csv')
        assert resp.status_code == 404

    def test_export_csv_empty_game(self, client):
        """Game with no hands should export just the header."""
        resp = client.post(
            '/games',
            json={'game_date': '2026-03-15', 'player_names': ['Alice']},
        )
        game_id = resp.json()['game_id']
        resp = client.get(f'/games/{game_id}/export/csv')
        assert resp.status_code == 200
        lines = resp.text.strip().splitlines()
        assert len(lines) == 1  # header only

    def test_export_csv_content_disposition(self, client, game_with_hand):
        resp = client.get(f'/games/{game_with_hand}/export/csv')
        disp = resp.headers.get('content-disposition', '')
        assert 'attachment' in disp
        assert '.csv' in disp

    def test_export_csv_null_cards_become_empty(self, client):
        """Hand with no turn/river should have empty fields."""
        resp = client.post(
            '/games',
            json={'game_date': '2026-03-15', 'player_names': ['Alice']},
        )
        game_id = resp.json()['game_id']
        resp = client.post(
            f'/games/{game_id}/hands',
            json={
                'flop_1': 'AH',
                'flop_2': 'KD',
                'flop_3': '2S',
                'player_entries': [
                    {
                        'player_name': 'Alice',
                        'card_1': 'QH',
                        'card_2': 'JD',
                        'result': 'won',
                    },
                ],
            },
        )
        assert resp.status_code == 201
        resp = client.get(f'/games/{game_id}/export/csv')
        lines = resp.text.strip().splitlines()
        parts = lines[1].split(',')
        # turn and river should be empty
        assert parts[8] == ''  # turn
        assert parts[9] == ''  # river
