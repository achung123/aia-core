"""Tests for outcome-street cross-validation.

When setting a player's outcome_street via PATCH .../result, the backend must validate:
1. Community cards for that street are dealt (flop→needs flop, turn→needs flop+turn, etc.)
2. Losers/folders must be on the same outcome_street as the winner(s).
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import StaticPool, create_engine
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
    """Create a game with a hand (no community cards), return (game_id, hand_number)."""
    game_resp = client.post(
        '/games',
        json={'game_date': '2026-04-10', 'player_names': ['Alice', 'Bob', 'Charlie']},
    )
    game_id = game_resp.json()['game_id']

    hand_resp = client.post(
        f'/games/{game_id}/hands',
        json={
            'player_entries': [
                {
                    'player_name': 'Alice',
                    'card_1': {'rank': '7', 'suit': 'S'},
                    'card_2': {'rank': '8', 'suit': 'S'},
                },
                {
                    'player_name': 'Bob',
                    'card_1': {'rank': '9', 'suit': 'H'},
                    'card_2': {'rank': '10', 'suit': 'H'},
                },
                {
                    'player_name': 'Charlie',
                    'card_1': {'rank': 'J', 'suit': 'D'},
                    'card_2': {'rank': 'Q', 'suit': 'D'},
                },
            ],
        },
    )
    return game_id, hand_resp.json()['hand_number']


def _result_url(game_id, hand_number, name):
    return f'/games/{game_id}/hands/{hand_number}/players/{name}/result'


class TestOutcomeStreetRequiresCommunityCards:
    """Setting outcome_street must require matching community cards to exist."""

    def test_preflop_always_allowed(self, client, game_with_hand):
        """Preflop doesn't require any community cards."""
        game_id, hn = game_with_hand
        resp = client.patch(
            _result_url(game_id, hn, 'Alice'),
            json={'result': 'won', 'outcome_street': 'preflop'},
        )
        assert resp.status_code == 200

    def test_flop_outcome_requires_flop_cards(self, client, game_with_hand):
        """outcome_street='flop' rejected when no flop cards are dealt."""
        game_id, hn = game_with_hand
        resp = client.patch(
            _result_url(game_id, hn, 'Alice'),
            json={'result': 'won', 'outcome_street': 'flop'},
        )
        assert resp.status_code == 400
        assert 'flop' in resp.json()['detail'].lower()

    def test_flop_outcome_allowed_with_flop(self, client, game_with_hand):
        game_id, hn = game_with_hand
        client.patch(
            f'/games/{game_id}/hands/{hn}/flop',
            json={
                'flop_1': {'rank': 'A', 'suit': 'C'},
                'flop_2': {'rank': 'K', 'suit': 'C'},
                'flop_3': {'rank': '2', 'suit': 'C'},
            },
        )
        resp = client.patch(
            _result_url(game_id, hn, 'Alice'),
            json={'result': 'won', 'outcome_street': 'flop'},
        )
        assert resp.status_code == 200

    def test_turn_outcome_requires_turn_card(self, client, game_with_hand):
        """outcome_street='turn' rejected when turn card not dealt (even if flop exists)."""
        game_id, hn = game_with_hand
        client.patch(
            f'/games/{game_id}/hands/{hn}/flop',
            json={
                'flop_1': {'rank': 'A', 'suit': 'C'},
                'flop_2': {'rank': 'K', 'suit': 'C'},
                'flop_3': {'rank': '2', 'suit': 'C'},
            },
        )
        resp = client.patch(
            _result_url(game_id, hn, 'Alice'),
            json={'result': 'won', 'outcome_street': 'turn'},
        )
        assert resp.status_code == 400
        assert 'turn' in resp.json()['detail'].lower()

    def test_turn_outcome_allowed_with_turn(self, client, game_with_hand):
        game_id, hn = game_with_hand
        client.patch(
            f'/games/{game_id}/hands/{hn}/flop',
            json={
                'flop_1': {'rank': 'A', 'suit': 'C'},
                'flop_2': {'rank': 'K', 'suit': 'C'},
                'flop_3': {'rank': '2', 'suit': 'C'},
            },
        )
        client.patch(
            f'/games/{game_id}/hands/{hn}/turn',
            json={'turn': {'rank': '3', 'suit': 'C'}},
        )
        resp = client.patch(
            _result_url(game_id, hn, 'Alice'),
            json={'result': 'won', 'outcome_street': 'turn'},
        )
        assert resp.status_code == 200

    def test_river_outcome_requires_river_card(self, client, game_with_hand):
        game_id, hn = game_with_hand
        client.patch(
            f'/games/{game_id}/hands/{hn}/flop',
            json={
                'flop_1': {'rank': 'A', 'suit': 'C'},
                'flop_2': {'rank': 'K', 'suit': 'C'},
                'flop_3': {'rank': '2', 'suit': 'C'},
            },
        )
        client.patch(
            f'/games/{game_id}/hands/{hn}/turn',
            json={'turn': {'rank': '3', 'suit': 'C'}},
        )
        resp = client.patch(
            _result_url(game_id, hn, 'Alice'),
            json={'result': 'won', 'outcome_street': 'river'},
        )
        assert resp.status_code == 400
        assert 'river' in resp.json()['detail'].lower()

    def test_river_outcome_allowed_with_river(self, client, game_with_hand):
        game_id, hn = game_with_hand
        client.patch(
            f'/games/{game_id}/hands/{hn}/flop',
            json={
                'flop_1': {'rank': 'A', 'suit': 'C'},
                'flop_2': {'rank': 'K', 'suit': 'C'},
                'flop_3': {'rank': '2', 'suit': 'C'},
            },
        )
        client.patch(
            f'/games/{game_id}/hands/{hn}/turn',
            json={'turn': {'rank': '3', 'suit': 'C'}},
        )
        client.patch(
            f'/games/{game_id}/hands/{hn}/river',
            json={'river': {'rank': '4', 'suit': 'C'}},
        )
        resp = client.patch(
            _result_url(game_id, hn, 'Alice'),
            json={'result': 'won', 'outcome_street': 'river'},
        )
        assert resp.status_code == 200


class TestOutcomeStreetCrossValidation:
    """Winners and losers (non-fold) must share the same outcome_street.
    Folders may fold on any street on or before the winner's street.
    """

    def test_loser_on_same_street_as_winner_ok(self, client, game_with_hand):
        game_id, hn = game_with_hand
        # Set preflop outcome for both
        client.patch(
            _result_url(game_id, hn, 'Alice'),
            json={'result': 'won', 'outcome_street': 'preflop'},
        )
        resp = client.patch(
            _result_url(game_id, hn, 'Bob'),
            json={'result': 'lost', 'outcome_street': 'preflop'},
        )
        assert resp.status_code == 200

    def test_folder_same_street_as_winner_ok(self, client, game_with_hand):
        game_id, hn = game_with_hand
        client.patch(
            _result_url(game_id, hn, 'Alice'),
            json={'result': 'won', 'outcome_street': 'preflop'},
        )
        resp = client.patch(
            _result_url(game_id, hn, 'Bob'),
            json={'result': 'folded', 'outcome_street': 'preflop'},
        )
        assert resp.status_code == 200

    def test_folder_on_earlier_street_than_winner_ok(self, client, game_with_hand):
        """A player can fold on preflop while winner wins on river."""
        game_id, hn = game_with_hand
        client.patch(
            f'/games/{game_id}/hands/{hn}/flop',
            json={
                'flop_1': {'rank': 'A', 'suit': 'C'},
                'flop_2': {'rank': 'K', 'suit': 'C'},
                'flop_3': {'rank': '2', 'suit': 'C'},
            },
        )
        client.patch(
            f'/games/{game_id}/hands/{hn}/turn',
            json={'turn': {'rank': '3', 'suit': 'C'}},
        )
        client.patch(
            f'/games/{game_id}/hands/{hn}/river',
            json={'river': {'rank': '4', 'suit': 'C'}},
        )
        # Alice wins on river
        client.patch(
            _result_url(game_id, hn, 'Alice'),
            json={'result': 'won', 'outcome_street': 'river'},
        )
        # Bob folded on preflop — allowed (preflop < river)
        resp = client.patch(
            _result_url(game_id, hn, 'Bob'),
            json={'result': 'folded', 'outcome_street': 'preflop'},
        )
        assert resp.status_code == 200

    def test_folder_on_flop_winner_on_river_ok(self, client, game_with_hand):
        game_id, hn = game_with_hand
        client.patch(
            f'/games/{game_id}/hands/{hn}/flop',
            json={
                'flop_1': {'rank': 'A', 'suit': 'C'},
                'flop_2': {'rank': 'K', 'suit': 'C'},
                'flop_3': {'rank': '2', 'suit': 'C'},
            },
        )
        client.patch(
            f'/games/{game_id}/hands/{hn}/turn',
            json={'turn': {'rank': '3', 'suit': 'C'}},
        )
        client.patch(
            f'/games/{game_id}/hands/{hn}/river',
            json={'river': {'rank': '4', 'suit': 'C'}},
        )
        client.patch(
            _result_url(game_id, hn, 'Alice'),
            json={'result': 'won', 'outcome_street': 'river'},
        )
        # Bob folded on flop — allowed (flop < river)
        resp = client.patch(
            _result_url(game_id, hn, 'Bob'),
            json={'result': 'folded', 'outcome_street': 'flop'},
        )
        assert resp.status_code == 200

    def test_folder_on_later_street_than_winner_rejected(self, client, game_with_hand):
        """Cannot fold on a street after the winner's outcome street."""
        game_id, hn = game_with_hand
        client.patch(
            f'/games/{game_id}/hands/{hn}/flop',
            json={
                'flop_1': {'rank': 'A', 'suit': 'C'},
                'flop_2': {'rank': 'K', 'suit': 'C'},
                'flop_3': {'rank': '2', 'suit': 'C'},
            },
        )
        client.patch(
            _result_url(game_id, hn, 'Alice'),
            json={'result': 'won', 'outcome_street': 'preflop'},
        )
        # Bob tries to fold on flop — rejected (flop > preflop)
        resp = client.patch(
            _result_url(game_id, hn, 'Bob'),
            json={'result': 'folded', 'outcome_street': 'flop'},
        )
        assert resp.status_code == 400
        assert 'street' in resp.json()['detail'].lower()

    def test_loser_on_different_street_from_winner_rejected(
        self, client, game_with_hand
    ):
        """If Alice won on preflop, Bob cannot lose on flop."""
        game_id, hn = game_with_hand
        client.patch(
            f'/games/{game_id}/hands/{hn}/flop',
            json={
                'flop_1': {'rank': 'A', 'suit': 'C'},
                'flop_2': {'rank': 'K', 'suit': 'C'},
                'flop_3': {'rank': '2', 'suit': 'C'},
            },
        )
        client.patch(
            _result_url(game_id, hn, 'Alice'),
            json={'result': 'won', 'outcome_street': 'preflop'},
        )
        resp = client.patch(
            _result_url(game_id, hn, 'Bob'),
            json={'result': 'lost', 'outcome_street': 'flop'},
        )
        assert resp.status_code == 400
        assert 'street' in resp.json()['detail'].lower()

    def test_winner_on_different_street_from_existing_loser_rejected(
        self, client, game_with_hand
    ):
        """If Bob lost on flop, Alice cannot win on turn (losers must match winner)."""
        game_id, hn = game_with_hand
        client.patch(
            f'/games/{game_id}/hands/{hn}/flop',
            json={
                'flop_1': {'rank': 'A', 'suit': 'C'},
                'flop_2': {'rank': 'K', 'suit': 'C'},
                'flop_3': {'rank': '2', 'suit': 'C'},
            },
        )
        client.patch(
            f'/games/{game_id}/hands/{hn}/turn',
            json={'turn': {'rank': '3', 'suit': 'C'}},
        )
        client.patch(
            _result_url(game_id, hn, 'Bob'),
            json={'result': 'lost', 'outcome_street': 'flop'},
        )
        resp = client.patch(
            _result_url(game_id, hn, 'Alice'),
            json={'result': 'won', 'outcome_street': 'turn'},
        )
        assert resp.status_code == 400

    def test_winner_after_existing_folder_on_earlier_street_ok(
        self, client, game_with_hand
    ):
        """If Bob folded on flop, Alice can still win on river."""
        game_id, hn = game_with_hand
        client.patch(
            f'/games/{game_id}/hands/{hn}/flop',
            json={
                'flop_1': {'rank': 'A', 'suit': 'C'},
                'flop_2': {'rank': 'K', 'suit': 'C'},
                'flop_3': {'rank': '2', 'suit': 'C'},
            },
        )
        client.patch(
            f'/games/{game_id}/hands/{hn}/turn',
            json={'turn': {'rank': '3', 'suit': 'C'}},
        )
        client.patch(
            f'/games/{game_id}/hands/{hn}/river',
            json={'river': {'rank': '4', 'suit': 'C'}},
        )
        # Bob folds on flop first
        client.patch(
            _result_url(game_id, hn, 'Bob'),
            json={'result': 'folded', 'outcome_street': 'flop'},
        )
        # Alice wins on river — allowed since Bob only folded (not lost)
        resp = client.patch(
            _result_url(game_id, hn, 'Alice'),
            json={'result': 'won', 'outcome_street': 'river'},
        )
        assert resp.status_code == 200

    def test_winner_before_existing_folder_rejected(self, client, game_with_hand):
        """If Bob folded on river, Alice cannot win on flop (folder must be <= winner)."""
        game_id, hn = game_with_hand
        client.patch(
            f'/games/{game_id}/hands/{hn}/flop',
            json={
                'flop_1': {'rank': 'A', 'suit': 'C'},
                'flop_2': {'rank': 'K', 'suit': 'C'},
                'flop_3': {'rank': '2', 'suit': 'C'},
            },
        )
        client.patch(
            f'/games/{game_id}/hands/{hn}/turn',
            json={'turn': {'rank': '3', 'suit': 'C'}},
        )
        client.patch(
            f'/games/{game_id}/hands/{hn}/river',
            json={'river': {'rank': '4', 'suit': 'C'}},
        )
        # Bob folds on river
        client.patch(
            _result_url(game_id, hn, 'Bob'),
            json={'result': 'folded', 'outcome_street': 'river'},
        )
        # Alice tries to win on flop — rejected (Bob folded on river > flop)
        resp = client.patch(
            _result_url(game_id, hn, 'Alice'),
            json={'result': 'won', 'outcome_street': 'flop'},
        )
        assert resp.status_code == 400

    def test_multiple_folders_on_different_streets_before_winner_ok(
        self, client, game_with_hand
    ):
        """Multiple players can fold on different streets, all before the winner."""
        game_id, hn = game_with_hand
        client.patch(
            f'/games/{game_id}/hands/{hn}/flop',
            json={
                'flop_1': {'rank': 'A', 'suit': 'C'},
                'flop_2': {'rank': 'K', 'suit': 'C'},
                'flop_3': {'rank': '2', 'suit': 'C'},
            },
        )
        client.patch(
            f'/games/{game_id}/hands/{hn}/turn',
            json={'turn': {'rank': '3', 'suit': 'C'}},
        )
        client.patch(
            f'/games/{game_id}/hands/{hn}/river',
            json={'river': {'rank': '4', 'suit': 'C'}},
        )
        # Alice wins on river
        client.patch(
            _result_url(game_id, hn, 'Alice'),
            json={'result': 'won', 'outcome_street': 'river'},
        )
        # Bob folded on preflop
        resp = client.patch(
            _result_url(game_id, hn, 'Bob'),
            json={'result': 'folded', 'outcome_street': 'preflop'},
        )
        assert resp.status_code == 200
        # Charlie folded on flop
        resp = client.patch(
            _result_url(game_id, hn, 'Charlie'),
            json={'result': 'folded', 'outcome_street': 'flop'},
        )
        assert resp.status_code == 200

    def test_loser_must_match_winner_with_folders_present(self, client, game_with_hand):
        """With folders on earlier streets, a loser (non-fold) must still match the winner's street."""
        game_id, hn = game_with_hand
        client.patch(
            f'/games/{game_id}/hands/{hn}/flop',
            json={
                'flop_1': {'rank': 'A', 'suit': 'C'},
                'flop_2': {'rank': 'K', 'suit': 'C'},
                'flop_3': {'rank': '2', 'suit': 'C'},
            },
        )
        client.patch(
            f'/games/{game_id}/hands/{hn}/turn',
            json={'turn': {'rank': '3', 'suit': 'C'}},
        )
        client.patch(
            f'/games/{game_id}/hands/{hn}/river',
            json={'river': {'rank': '4', 'suit': 'C'}},
        )
        # Alice wins on river
        client.patch(
            _result_url(game_id, hn, 'Alice'),
            json={'result': 'won', 'outcome_street': 'river'},
        )
        # Bob folded on flop — ok
        resp = client.patch(
            _result_url(game_id, hn, 'Bob'),
            json={'result': 'folded', 'outcome_street': 'flop'},
        )
        assert resp.status_code == 200
        # Charlie lost on turn — rejected (loser must match winner's river)
        resp = client.patch(
            _result_url(game_id, hn, 'Charlie'),
            json={'result': 'lost', 'outcome_street': 'turn'},
        )
        assert resp.status_code == 400

    def test_no_winner_yet_allows_any_street(self, client, game_with_hand):
        """Without a winner, losers/folders can be set on any street."""
        game_id, hn = game_with_hand
        client.patch(
            f'/games/{game_id}/hands/{hn}/flop',
            json={
                'flop_1': {'rank': 'A', 'suit': 'C'},
                'flop_2': {'rank': 'K', 'suit': 'C'},
                'flop_3': {'rank': '2', 'suit': 'C'},
            },
        )
        resp = client.patch(
            _result_url(game_id, hn, 'Bob'),
            json={'result': 'folded', 'outcome_street': 'flop'},
        )
        assert resp.status_code == 200

    def test_handed_back_exempt_from_street_match(self, client, game_with_hand):
        """handed_back is a participation marker, not an outcome — no street validation."""
        game_id, hn = game_with_hand
        resp = client.patch(
            _result_url(game_id, hn, 'Bob'),
            json={'result': 'handed_back'},
        )
        assert resp.status_code == 200

    def test_null_outcome_street_allowed(self, client, game_with_hand):
        """Setting result without outcome_street should still work."""
        game_id, hn = game_with_hand
        resp = client.patch(
            _result_url(game_id, hn, 'Alice'),
            json={'result': 'won'},
        )
        assert resp.status_code == 200
