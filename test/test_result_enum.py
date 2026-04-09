"""Tests for T-001: ResultEnum standardization in Pydantic models."""

import pytest
from pydantic import ValidationError

from pydantic_models.app_models import (
    Card,
    CardRank,
    CardSuit,
    HandResultUpdate,
    PlayerHandEntry,
    PlayerResultEntry,
    ResultEnum,
)


class TestResultEnumExists:
    """AC-1: ResultEnum class exists with exactly three values: won, folded, lost."""

    def test_result_enum_has_won(self):
        assert ResultEnum.WON == 'won'

    def test_result_enum_has_folded(self):
        assert ResultEnum.FOLDED == 'folded'

    def test_result_enum_has_lost(self):
        assert ResultEnum.LOST == 'lost'

    def test_result_enum_has_handed_back(self):
        assert ResultEnum.HANDED_BACK == 'handed_back'

    def test_result_enum_has_exactly_four_members(self):
        assert len(ResultEnum) == 4

    def test_result_enum_is_str_enum(self):
        assert isinstance(ResultEnum.WON, str)


class TestPlayerHandEntryResultEnum:
    """AC-2: PlayerHandEntry.result uses ResultEnum | None."""

    def test_accepts_won(self):
        entry = PlayerHandEntry(
            player_name='Alice',
            card_1=Card(rank=CardRank.ACE, suit=CardSuit.SPADES),
            card_2=Card(rank=CardRank.KING, suit=CardSuit.HEARTS),
            result='won',
        )
        assert entry.result == 'won'

    def test_accepts_lost(self):
        entry = PlayerHandEntry(
            player_name='Alice',
            card_1=Card(rank=CardRank.ACE, suit=CardSuit.SPADES),
            card_2=Card(rank=CardRank.KING, suit=CardSuit.HEARTS),
            result='lost',
        )
        assert entry.result == 'lost'

    def test_accepts_folded(self):
        entry = PlayerHandEntry(
            player_name='Alice',
            card_1=Card(rank=CardRank.ACE, suit=CardSuit.SPADES),
            card_2=Card(rank=CardRank.KING, suit=CardSuit.HEARTS),
            result='folded',
        )
        assert entry.result == 'folded'

    def test_accepts_null(self):
        entry = PlayerHandEntry(
            player_name='Alice',
            card_1=Card(rank=CardRank.ACE, suit=CardSuit.SPADES),
            card_2=Card(rank=CardRank.KING, suit=CardSuit.HEARTS),
            result=None,
        )
        assert entry.result is None

    def test_defaults_to_none(self):
        entry = PlayerHandEntry(
            player_name='Alice',
            card_1=Card(rank=CardRank.ACE, suit=CardSuit.SPADES),
            card_2=Card(rank=CardRank.KING, suit=CardSuit.HEARTS),
        )
        assert entry.result is None

    def test_accepts_handed_back(self):
        entry = PlayerHandEntry(
            player_name='Alice',
            card_1=Card(rank=CardRank.ACE, suit=CardSuit.SPADES),
            card_2=Card(rank=CardRank.KING, suit=CardSuit.HEARTS),
            result='handed_back',
        )
        assert entry.result == 'handed_back'

    def test_rejects_invalid_string(self):
        with pytest.raises(ValidationError):
            PlayerHandEntry(
                player_name='Alice',
                card_1=Card(rank=CardRank.ACE, suit=CardSuit.SPADES),
                card_2=Card(rank=CardRank.KING, suit=CardSuit.HEARTS),
                result='winner',
            )


class TestPlayerResultEntryResultEnum:
    """AC-2: PlayerResultEntry.result uses ResultEnum | None."""

    def test_accepts_won(self):
        entry = PlayerResultEntry(player_name='Alice', result='won', profit_loss=50.0)
        assert entry.result == 'won'

    def test_accepts_lost(self):
        entry = PlayerResultEntry(player_name='Alice', result='lost', profit_loss=-50.0)
        assert entry.result == 'lost'

    def test_accepts_folded(self):
        entry = PlayerResultEntry(player_name='Alice', result='folded', profit_loss=0.0)
        assert entry.result == 'folded'

    def test_accepts_handed_back(self):
        entry = PlayerResultEntry(
            player_name='Alice', result='handed_back', profit_loss=0.0
        )
        assert entry.result == 'handed_back'

    def test_rejects_invalid_string(self):
        with pytest.raises(ValidationError):
            PlayerResultEntry(player_name='Alice', result='winner', profit_loss=50.0)


class TestHandResultUpdateResultEnum:
    """AC-2: HandResultUpdate.result uses ResultEnum | None."""

    def test_accepts_won(self):
        update = HandResultUpdate(result='won', profit_loss=100.0)
        assert update.result == 'won'

    def test_accepts_lost(self):
        update = HandResultUpdate(result='lost', profit_loss=-50.0)
        assert update.result == 'lost'

    def test_accepts_folded(self):
        update = HandResultUpdate(result='folded', profit_loss=0.0)
        assert update.result == 'folded'

    def test_accepts_handed_back(self):
        update = HandResultUpdate(result='handed_back', profit_loss=0.0)
        assert update.result == 'handed_back'

    def test_rejects_invalid_string(self):
        with pytest.raises(ValidationError):
            HandResultUpdate(result='winner', profit_loss=50.0)
