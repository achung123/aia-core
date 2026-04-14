"""Test that _resolve_side_pot_names empty-IDs fallback uses eligible_players.

Regression test for aia-core-1q8v: the fallback path returned raw dicts
which could contain eligible_player_ids instead of eligible_players.
"""

from unittest.mock import MagicMock

from app.routes.hands import _resolve_side_pot_names


class TestResolveSidePotNamesEmptyIdsFallback:
    """When no player IDs exist in side pots, output must still use eligible_players."""

    def test_empty_eligible_player_ids_returns_eligible_players_key(self):
        """Side pots with empty eligible_player_ids should get eligible_players: []."""
        raw = [{'amount': 10.0, 'eligible_player_ids': []}]
        db = MagicMock()
        result = _resolve_side_pot_names(raw, db)
        assert len(result) == 1
        assert 'eligible_players' in result[0]
        assert result[0]['eligible_players'] == []
        assert 'eligible_player_ids' not in result[0]

    def test_missing_eligible_player_ids_key_returns_eligible_players(self):
        """Side pots without eligible_player_ids key should get eligible_players: []."""
        raw = [{'amount': 5.0}]
        db = MagicMock()
        result = _resolve_side_pot_names(raw, db)
        assert len(result) == 1
        assert 'eligible_players' in result[0]
        assert result[0]['eligible_players'] == []
        assert 'eligible_player_ids' not in result[0]

    def test_multiple_side_pots_all_empty_ids(self):
        """Multiple side pots with no IDs should all be transformed."""
        raw = [
            {'amount': 10.0, 'eligible_player_ids': []},
            {'amount': 20.0},
        ]
        db = MagicMock()
        result = _resolve_side_pot_names(raw, db)
        assert len(result) == 2
        for sp in result:
            assert 'eligible_players' in sp
            assert sp['eligible_players'] == []
            assert 'eligible_player_ids' not in sp

    def test_amount_preserved_in_fallback(self):
        """Amount values must be preserved through the fallback path."""
        raw = [{'amount': 42.5, 'eligible_player_ids': []}]
        db = MagicMock()
        result = _resolve_side_pot_names(raw, db)
        assert result[0]['amount'] == 42.5
