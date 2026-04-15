"""Tests for analytics Pydantic models (aia-core-9va)."""

from datetime import date

import pytest
from pydantic import ValidationError

from pydantic_models.stats_schemas import (
    AwardEntry,
    GameHighlight,
    HeadToHeadResponse,
    PlayerSessionTrend,
    StreetBreakdown,
)


# ── PlayerSessionTrend ──────────────────────────────────────────────


class TestPlayerSessionTrend:
    def test_valid_instance(self):
        trend = PlayerSessionTrend(
            game_id=1,
            game_date=date(2026, 4, 10),
            hands_played=20,
            hands_won=8,
            win_rate=40.0,
            profit_loss=-15.50,
        )
        assert trend.game_id == 1
        assert trend.game_date == date(2026, 4, 10)
        assert trend.hands_played == 20
        assert trend.hands_won == 8
        assert trend.win_rate == 40.0
        assert trend.profit_loss == -15.50

    def test_serialization_roundtrip(self):
        data = {
            'game_id': 2,
            'game_date': '2026-04-11',
            'hands_played': 30,
            'hands_won': 15,
            'win_rate': 50.0,
            'profit_loss': 100.0,
        }
        trend = PlayerSessionTrend.model_validate(data)
        dumped = trend.model_dump()
        assert dumped['game_id'] == 2
        assert dumped['game_date'] == date(2026, 4, 11)

    def test_missing_required_field(self):
        with pytest.raises(ValidationError):
            PlayerSessionTrend(
                game_id=1,
                game_date=date(2026, 4, 10),
                # missing hands_played, hands_won, win_rate, profit_loss
            )


# ── StreetBreakdown ─────────────────────────────────────────────────


class TestStreetBreakdown:
    def test_valid_instance(self):
        sb = StreetBreakdown(
            street='flop',
            hands_ended=5,
            player1_wins=3,
            player2_wins=2,
        )
        assert sb.street == 'flop'
        assert sb.hands_ended == 5
        assert sb.player1_wins == 3
        assert sb.player2_wins == 2


# ── HeadToHeadResponse ──────────────────────────────────────────────


class TestHeadToHeadResponse:
    def _make_response(self, **overrides):
        defaults = {
            'player1_name': 'Alice',
            'player2_name': 'Bob',
            'shared_hands_count': 50,
            'showdown_count': 20,
            'player1_showdown_wins': 12,
            'player2_showdown_wins': 8,
            'player1_fold_count': 10,
            'player2_fold_count': 15,
            'player1_fold_rate': 20.0,
            'player2_fold_rate': 30.0,
            'street_breakdown': [],
        }
        defaults.update(overrides)
        return HeadToHeadResponse(**defaults)

    def test_valid_instance(self):
        resp = self._make_response()
        assert resp.player1_name == 'Alice'
        assert resp.player2_name == 'Bob'
        assert resp.shared_hands_count == 50
        assert resp.showdown_count == 20
        assert resp.player1_showdown_wins == 12
        assert resp.player2_showdown_wins == 8
        assert resp.player1_fold_count == 10
        assert resp.player2_fold_count == 15
        assert resp.player1_fold_rate == 20.0
        assert resp.player2_fold_rate == 30.0
        assert resp.street_breakdown == []

    def test_with_street_breakdown(self):
        breakdown = [
            {'street': 'preflop', 'hands_ended': 3, 'player1_wins': 2, 'player2_wins': 1},
            {'street': 'flop', 'hands_ended': 5, 'player1_wins': 3, 'player2_wins': 2},
        ]
        resp = self._make_response(street_breakdown=breakdown)
        assert len(resp.street_breakdown) == 2
        assert isinstance(resp.street_breakdown[0], StreetBreakdown)
        assert resp.street_breakdown[0].street == 'preflop'

    def test_missing_required_field(self):
        with pytest.raises(ValidationError):
            HeadToHeadResponse(player1_name='Alice')


# ── AwardEntry ──────────────────────────────────────────────────────


class TestAwardEntry:
    def test_valid_instance(self):
        award = AwardEntry(
            award_name='Iron Man',
            emoji='🦾',
            description='Played the most hands',
            winner_name='Charlie',
            stat_value=150.0,
            stat_label='hands played',
        )
        assert award.award_name == 'Iron Man'
        assert award.emoji == '🦾'
        assert award.description == 'Played the most hands'
        assert award.winner_name == 'Charlie'
        assert award.stat_value == 150.0
        assert award.stat_label == 'hands played'

    def test_serialization_roundtrip(self):
        data = {
            'award_name': 'Sniper',
            'emoji': '🎯',
            'description': 'Highest win rate',
            'winner_name': 'Dana',
            'stat_value': 72.5,
            'stat_label': '% win rate',
        }
        award = AwardEntry.model_validate(data)
        dumped = award.model_dump()
        assert dumped['award_name'] == 'Sniper'
        assert dumped['stat_value'] == 72.5

    def test_missing_required_field(self):
        with pytest.raises(ValidationError):
            AwardEntry(award_name='Iron Man')


# ── GameHighlight ───────────────────────────────────────────────────


class TestGameHighlight:
    def test_valid_instance(self):
        highlight = GameHighlight(
            hand_number=7,
            highlight_type='most_players',
            description='Hand with the most non-fold players (5)',
        )
        assert highlight.hand_number == 7
        assert highlight.highlight_type == 'most_players'
        assert highlight.description == 'Hand with the most non-fold players (5)'

    def test_serialization_roundtrip(self):
        data = {
            'hand_number': 12,
            'highlight_type': 'river_showdown',
            'description': 'Went to river with 3 active players',
        }
        highlight = GameHighlight.model_validate(data)
        dumped = highlight.model_dump()
        assert dumped['hand_number'] == 12
        assert dumped['highlight_type'] == 'river_showdown'

    def test_missing_required_field(self):
        with pytest.raises(ValidationError):
            GameHighlight(hand_number=1)
