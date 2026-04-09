"""Tests for T-007: GET /games/{game_id}/hands/{hand_number}/equity endpoint."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, StaticPool
from sqlalchemy.orm import sessionmaker

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


@pytest.fixture
def game_with_players(client):
    """Create a game session with three players; return the game_id."""
    resp = client.post(
        '/games',
        json={'game_date': '2026-03-11', 'player_names': ['Alice', 'Bob', 'Charlie']},
    )
    assert resp.status_code == 201
    return resp.json()['game_id']


def _create_hand(client, game_id, community=None, player_entries=None):
    """Helper: create a hand with optional community cards and player entries."""
    payload = {}
    if community:
        payload.update(community)
    if player_entries:
        payload['player_entries'] = player_entries

    resp = client.post(f'/games/{game_id}/hands', json=payload)
    assert resp.status_code == 201
    return resp.json()['hand_number']


class TestEquityEndpointHappyPath:
    """AC-1 / AC-4: Returns equity for each player with non-null hole cards."""

    def test_two_players_preflop_returns_equities(self, client, game_with_players):
        """AA vs KK preflop — each player gets an equity value."""
        hand_number = _create_hand(
            client,
            game_with_players,
            player_entries=[
                {
                    'player_name': 'Alice',
                    'card_1': {'rank': 'A', 'suit': 'S'},
                    'card_2': {'rank': 'A', 'suit': 'H'},
                },
                {
                    'player_name': 'Bob',
                    'card_1': {'rank': 'K', 'suit': 'S'},
                    'card_2': {'rank': 'K', 'suit': 'H'},
                },
            ],
        )

        resp = client.get(
            f'/games/{game_with_players}/hands/{hand_number}/equity'
        )
        assert resp.status_code == 200
        data = resp.json()
        assert 'equities' in data
        assert len(data['equities']) == 2

        # Verify structure: each entry has player_name and equity
        names = {e['player_name'] for e in data['equities']}
        assert names == {'Alice', 'Bob'}
        for entry in data['equities']:
            assert 0.0 <= entry['equity'] <= 1.0

    def test_aa_vs_kk_equity_values(self, client, game_with_players):
        """AC-4: AA vs KK preflop should be ~81% vs 19%."""
        hand_number = _create_hand(
            client,
            game_with_players,
            player_entries=[
                {
                    'player_name': 'Alice',
                    'card_1': {'rank': 'A', 'suit': 'S'},
                    'card_2': {'rank': 'A', 'suit': 'H'},
                },
                {
                    'player_name': 'Bob',
                    'card_1': {'rank': 'K', 'suit': 'S'},
                    'card_2': {'rank': 'K', 'suit': 'H'},
                },
            ],
        )

        resp = client.get(
            f'/games/{game_with_players}/hands/{hand_number}/equity'
        )
        data = resp.json()
        equities_by_name = {e['player_name']: e['equity'] for e in data['equities']}
        assert abs(equities_by_name['Alice'] - 0.81) < 0.05
        assert abs(equities_by_name['Bob'] - 0.19) < 0.05

    def test_three_players_with_community_cards(self, client, game_with_players):
        """Three players with flop dealt — each gets an equity value."""
        hand_number = _create_hand(
            client,
            game_with_players,
            community={
                'flop_1': {'rank': '2', 'suit': 'C'},
                'flop_2': {'rank': '7', 'suit': 'D'},
                'flop_3': {'rank': 'J', 'suit': 'S'},
            },
            player_entries=[
                {
                    'player_name': 'Alice',
                    'card_1': {'rank': 'A', 'suit': 'S'},
                    'card_2': {'rank': 'A', 'suit': 'H'},
                },
                {
                    'player_name': 'Bob',
                    'card_1': {'rank': 'K', 'suit': 'S'},
                    'card_2': {'rank': 'K', 'suit': 'H'},
                },
                {
                    'player_name': 'Charlie',
                    'card_1': {'rank': 'Q', 'suit': 'D'},
                    'card_2': {'rank': 'Q', 'suit': 'C'},
                },
            ],
        )

        resp = client.get(
            f'/games/{game_with_players}/hands/{hand_number}/equity'
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data['equities']) == 3
        total = sum(e['equity'] for e in data['equities'])
        assert abs(total - 1.0) < 0.02


class TestEquityEndpointTooFewPlayers:
    """AC-2: Returns empty equities list if <2 players have cards."""

    def test_no_players_with_cards(self, client, game_with_players):
        """Hand with no player cards → empty equities."""
        hand_number = _create_hand(client, game_with_players)

        resp = client.get(
            f'/games/{game_with_players}/hands/{hand_number}/equity'
        )
        assert resp.status_code == 200
        assert resp.json() == {'equities': []}

    def test_one_player_with_cards(self, client, game_with_players):
        """Only one player has hole cards → empty equities."""
        hand_number = _create_hand(
            client,
            game_with_players,
            player_entries=[
                {
                    'player_name': 'Alice',
                    'card_1': {'rank': 'A', 'suit': 'S'},
                    'card_2': {'rank': 'A', 'suit': 'H'},
                },
            ],
        )

        resp = client.get(
            f'/games/{game_with_players}/hands/{hand_number}/equity'
        )
        assert resp.status_code == 200
        assert resp.json() == {'equities': []}


class TestEquityEndpoint404:
    """AC-3: Returns 404 if game or hand doesn't exist."""

    def test_missing_game_returns_404(self, client):
        resp = client.get('/games/9999/hands/1/equity')
        assert resp.status_code == 404

    def test_missing_hand_returns_404(self, client, game_with_players):
        resp = client.get(f'/games/{game_with_players}/hands/999/equity')
        assert resp.status_code == 404


class TestEquityEndpointNullCardsExcluded:
    """Players with null hole cards are excluded from equity calculation."""

    def test_players_without_cards_excluded(self, client, game_with_players):
        """Three players in game, only two have cards → only two in equities."""
        hand_number = _create_hand(
            client,
            game_with_players,
            player_entries=[
                {
                    'player_name': 'Alice',
                    'card_1': {'rank': 'A', 'suit': 'S'},
                    'card_2': {'rank': 'A', 'suit': 'H'},
                },
                {
                    'player_name': 'Bob',
                    'card_1': {'rank': 'K', 'suit': 'S'},
                    'card_2': {'rank': 'K', 'suit': 'H'},
                },
                # Charlie has no cards (not in player_entries)
            ],
        )

        resp = client.get(
            f'/games/{game_with_players}/hands/{hand_number}/equity'
        )
        assert resp.status_code == 200
        data = resp.json()
        names = {e['player_name'] for e in data['equities']}
        assert 'Charlie' not in names
        assert len(data['equities']) == 2

    def test_equities_sum_to_one_with_excluded_players(self, client, game_with_players):
        """Even with excluded players, equities sum to ~1.0."""
        hand_number = _create_hand(
            client,
            game_with_players,
            player_entries=[
                {
                    'player_name': 'Alice',
                    'card_1': {'rank': 'A', 'suit': 'S'},
                    'card_2': {'rank': 'A', 'suit': 'H'},
                },
                {
                    'player_name': 'Bob',
                    'card_1': {'rank': 'K', 'suit': 'S'},
                    'card_2': {'rank': 'K', 'suit': 'H'},
                },
            ],
        )

        resp = client.get(
            f'/games/{game_with_players}/hands/{hand_number}/equity'
        )
        data = resp.json()
        total = sum(e['equity'] for e in data['equities'])
        assert abs(total - 1.0) < 0.02
