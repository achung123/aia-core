"""Tests for player_name validation — empty/whitespace names must be rejected.

Covers bug fix aia-core-p3y2: AddPlayerToGameRequest.player_name and
GameSessionCreate.player_names accept bare str with no constraints.
"""

import pytest


class TestAddPlayerToGameValidation:
    """POST /games/{game_id}/players rejects invalid player names."""

    def _create_game(self, client):
        resp = client.post(
            '/games',
            json={'game_date': '2026-04-12', 'player_names': ['Alice', 'Bob']},
        )
        assert resp.status_code == 201
        return resp.json()

    def test_empty_string_rejected(self, client):
        game = self._create_game(client)
        resp = client.post(
            f'/games/{game["game_id"]}/players',
            json={'player_name': ''},
        )
        assert resp.status_code == 422

    def test_whitespace_only_rejected(self, client):
        game = self._create_game(client)
        resp = client.post(
            f'/games/{game["game_id"]}/players',
            json={'player_name': '   '},
        )
        assert resp.status_code == 422

    def test_whitespace_stripped(self, client):
        """Leading/trailing whitespace is stripped; core name is preserved."""
        game = self._create_game(client)
        resp = client.post(
            f'/games/{game["game_id"]}/players',
            json={'player_name': '  Charlie  '},
        )
        assert resp.status_code == 201
        assert resp.json()['player_name'] == 'Charlie'


class TestGameSessionCreateValidation:
    """POST /games rejects empty/whitespace player names in the list."""

    def test_empty_name_in_list_rejected(self, client):
        resp = client.post(
            '/games',
            json={'game_date': '2026-04-12', 'player_names': ['Alice', '']},
        )
        assert resp.status_code == 422

    def test_whitespace_only_name_in_list_rejected(self, client):
        resp = client.post(
            '/games',
            json={'game_date': '2026-04-12', 'player_names': ['Alice', '   ']},
        )
        assert resp.status_code == 422

    def test_whitespace_stripped_in_list(self, client):
        resp = client.post(
            '/games',
            json={'game_date': '2026-04-12', 'player_names': ['  Alice  ', 'Bob']},
        )
        assert resp.status_code == 201
        assert 'Alice' in resp.json()['player_names']


class TestPlayerHandEntryValidation:
    """PlayerHandEntry.player_name rejects empty/whitespace."""

    def test_empty_player_name_in_hand(self, client):
        """Creating a hand with empty player_name fails validation."""
        resp = client.post(
            '/games',
            json={'game_date': '2026-04-12', 'player_names': ['Alice']},
        )
        game_id = resp.json()['game_id']

        resp = client.post(
            f'/games/{game_id}/hands',
            json={'player_entries': [{'player_name': ''}]},
        )
        assert resp.status_code == 422

    def test_whitespace_player_name_in_hand(self, client):
        resp = client.post(
            '/games',
            json={'game_date': '2026-04-12', 'player_names': ['Alice']},
        )
        game_id = resp.json()['game_id']

        resp = client.post(
            f'/games/{game_id}/hands',
            json={'player_entries': [{'player_name': '   '}]},
        )
        assert resp.status_code == 422


class TestConfirmPlayerEntryValidation:
    """ConfirmPlayerEntry.player_name rejects empty/whitespace."""

    def test_empty_player_name_in_confirm(self):
        from pydantic import ValidationError

        from pydantic_models.detection_schemas import ConfirmPlayerEntry

        with pytest.raises(ValidationError):
            ConfirmPlayerEntry(player_name='', card_1='2S', card_2='3S')

    def test_whitespace_player_name_in_confirm(self):
        from pydantic import ValidationError

        from pydantic_models.detection_schemas import ConfirmPlayerEntry

        with pytest.raises(ValidationError):
            ConfirmPlayerEntry(player_name='   ', card_1='2S', card_2='3S')
