"""Tests for Game/Hand/Player request/response Pydantic models."""

from datetime import date, datetime

import pytest
from pydantic import ValidationError

from pydantic_models.app_models import (
    Card,
    CardRank,
    CardSuit,
    GameSessionCreate,
    GameSessionResponse,
    HandCreate,
    HandResponse,
    HandResultUpdate,
    PlayerHandEntry,
    PlayerHandResponse,
    PlayerResponse,
)


# === GameSessionCreate ===


class TestGameSessionCreate:
    def test_valid_game_session_create(self):
        session = GameSessionCreate(
            game_date=date(2026, 3, 9),
            player_names=['Adam', 'Gil', 'Zain'],
        )
        assert session.game_date == date(2026, 3, 9)
        assert session.player_names == ['Adam', 'Gil', 'Zain']

    def test_game_session_create_requires_date(self):
        with pytest.raises(ValidationError):
            GameSessionCreate(player_names=['Adam', 'Gil'])

    def test_game_session_create_requires_players(self):
        with pytest.raises(ValidationError):
            GameSessionCreate(game_date=date(2026, 3, 9))

    def test_game_session_create_empty_players_rejected(self):
        with pytest.raises(ValidationError):
            GameSessionCreate(game_date=date(2026, 3, 9), player_names=[])

    def test_game_session_create_serialization_round_trip(self):
        session = GameSessionCreate(
            game_date=date(2026, 3, 9),
            player_names=['Adam', 'Gil'],
        )
        data = session.model_dump()
        restored = GameSessionCreate.model_validate(data)
        assert restored.game_date == session.game_date
        assert restored.player_names == session.player_names


# === GameSessionResponse ===


class TestGameSessionResponse:
    def test_valid_game_session_response(self):
        resp = GameSessionResponse(
            game_id=1,
            game_date=date(2026, 3, 9),
            status='active',
            created_at=datetime(2026, 3, 9, 12, 0, 0),
            player_names=['Adam', 'Gil', 'Zain'],
            hand_count=5,
        )
        assert resp.game_id == 1
        assert resp.status == 'active'
        assert resp.hand_count == 5

    def test_game_session_response_serialization_round_trip(self):
        resp = GameSessionResponse(
            game_id=1,
            game_date=date(2026, 3, 9),
            status='active',
            created_at=datetime(2026, 3, 9, 12, 0, 0),
            player_names=['Adam'],
            hand_count=0,
        )
        data = resp.model_dump()
        restored = GameSessionResponse.model_validate(data)
        assert restored.game_id == resp.game_id
        assert restored.game_date == resp.game_date
        assert restored.player_names == resp.player_names


# === PlayerResponse ===


class TestPlayerResponse:
    def test_valid_player_response(self):
        player = PlayerResponse(
            player_id=1,
            name='Adam',
            created_at=datetime(2026, 3, 9, 12, 0, 0),
        )
        assert player.player_id == 1
        assert player.name == 'Adam'

    def test_player_response_serialization_round_trip(self):
        player = PlayerResponse(
            player_id=1,
            name='Adam',
            created_at=datetime(2026, 3, 9, 12, 0, 0),
        )
        data = player.model_dump()
        restored = PlayerResponse.model_validate(data)
        assert restored.player_id == player.player_id
        assert restored.name == player.name


# === PlayerHandEntry ===


class TestPlayerHandEntry:
    def test_valid_player_hand_entry(self):
        entry = PlayerHandEntry(
            player_name='Adam',
            card_1=Card(rank=CardRank.ACE, suit=CardSuit.SPADES),
            card_2=Card(rank=CardRank.KING, suit=CardSuit.HEARTS),
        )
        assert entry.player_name == 'Adam'
        assert str(entry.card_1) == 'AS'
        assert str(entry.card_2) == 'KH'

    def test_player_hand_entry_with_result(self):
        entry = PlayerHandEntry(
            player_name='Adam',
            card_1=Card(rank=CardRank.ACE, suit=CardSuit.SPADES),
            card_2=Card(rank=CardRank.KING, suit=CardSuit.HEARTS),
            result='win',
            profit_loss=50.0,
        )
        assert entry.result == 'win'
        assert entry.profit_loss == 50.0

    def test_player_hand_entry_optional_result(self):
        entry = PlayerHandEntry(
            player_name='Adam',
            card_1=Card(rank=CardRank.ACE, suit=CardSuit.SPADES),
            card_2=Card(rank=CardRank.KING, suit=CardSuit.HEARTS),
        )
        assert entry.result is None
        assert entry.profit_loss is None

    def test_player_hand_entry_requires_cards(self):
        with pytest.raises(ValidationError):
            PlayerHandEntry(player_name='Adam')

    def test_player_hand_entry_validates_card_values(self):
        with pytest.raises(ValidationError):
            PlayerHandEntry(
                player_name='Adam',
                card_1=Card(rank='X', suit=CardSuit.SPADES),
                card_2=Card(rank=CardRank.KING, suit=CardSuit.HEARTS),
            )


# === HandCreate ===


class TestHandCreate:
    def test_valid_hand_create_flop_only(self):
        hand = HandCreate(
            flop_1=Card(rank=CardRank.ACE, suit=CardSuit.SPADES),
            flop_2=Card(rank=CardRank.TWO, suit=CardSuit.CLUBS),
            flop_3=Card(rank=CardRank.THREE, suit=CardSuit.DIAMONDS),
            player_entries=[
                PlayerHandEntry(
                    player_name='Adam',
                    card_1=Card(rank=CardRank.KING, suit=CardSuit.HEARTS),
                    card_2=Card(rank=CardRank.QUEEN, suit=CardSuit.HEARTS),
                ),
            ],
        )
        assert hand.turn is None
        assert hand.river is None
        assert len(hand.player_entries) == 1

    def test_valid_hand_create_full_board(self):
        hand = HandCreate(
            flop_1=Card(rank=CardRank.ACE, suit=CardSuit.SPADES),
            flop_2=Card(rank=CardRank.TWO, suit=CardSuit.CLUBS),
            flop_3=Card(rank=CardRank.THREE, suit=CardSuit.DIAMONDS),
            turn=Card(rank=CardRank.FOUR, suit=CardSuit.HEARTS),
            river=Card(rank=CardRank.FIVE, suit=CardSuit.SPADES),
            player_entries=[
                PlayerHandEntry(
                    player_name='Adam',
                    card_1=Card(rank=CardRank.KING, suit=CardSuit.HEARTS),
                    card_2=Card(rank=CardRank.QUEEN, suit=CardSuit.HEARTS),
                ),
            ],
        )
        assert str(hand.turn) == '4H'
        assert str(hand.river) == '5S'

    def test_hand_create_requires_flop(self):
        with pytest.raises(ValidationError):
            HandCreate(
                player_entries=[
                    PlayerHandEntry(
                        player_name='Adam',
                        card_1=Card(rank=CardRank.KING, suit=CardSuit.HEARTS),
                        card_2=Card(rank=CardRank.QUEEN, suit=CardSuit.HEARTS),
                    ),
                ],
            )

    def test_hand_create_requires_player_entries(self):
        with pytest.raises(ValidationError):
            HandCreate(
                flop_1=Card(rank=CardRank.ACE, suit=CardSuit.SPADES),
                flop_2=Card(rank=CardRank.TWO, suit=CardSuit.CLUBS),
                flop_3=Card(rank=CardRank.THREE, suit=CardSuit.DIAMONDS),
                player_entries=[],
            )

    def test_hand_create_serialization_round_trip(self):
        hand = HandCreate(
            flop_1=Card(rank=CardRank.ACE, suit=CardSuit.SPADES),
            flop_2=Card(rank=CardRank.TWO, suit=CardSuit.CLUBS),
            flop_3=Card(rank=CardRank.THREE, suit=CardSuit.DIAMONDS),
            player_entries=[
                PlayerHandEntry(
                    player_name='Adam',
                    card_1=Card(rank=CardRank.KING, suit=CardSuit.HEARTS),
                    card_2=Card(rank=CardRank.QUEEN, suit=CardSuit.HEARTS),
                ),
            ],
        )
        data = hand.model_dump()
        restored = HandCreate.model_validate(data)
        assert str(restored.flop_1) == str(hand.flop_1)
        assert restored.player_entries[0].player_name == 'Adam'


# === HandResponse ===


class TestHandResponse:
    def test_valid_hand_response(self):
        resp = HandResponse(
            hand_id=1,
            game_id=1,
            hand_number=1,
            flop_1='AS',
            flop_2='2C',
            flop_3='3D',
            turn='4H',
            river='5S',
            created_at=datetime(2026, 3, 9, 12, 0, 0),
            player_hands=[
                PlayerHandResponse(
                    player_hand_id=1,
                    hand_id=1,
                    player_id=1,
                    player_name='Adam',
                    card_1='KH',
                    card_2='QH',
                    result='win',
                    profit_loss=50.0,
                ),
            ],
        )
        assert resp.hand_number == 1
        assert resp.player_hands[0].player_name == 'Adam'

    def test_hand_response_nullable_turn_river(self):
        resp = HandResponse(
            hand_id=1,
            game_id=1,
            hand_number=1,
            flop_1='AS',
            flop_2='2C',
            flop_3='3D',
            turn=None,
            river=None,
            created_at=datetime(2026, 3, 9, 12, 0, 0),
            player_hands=[],
        )
        assert resp.turn is None
        assert resp.river is None

    def test_hand_response_serialization_round_trip(self):
        resp = HandResponse(
            hand_id=1,
            game_id=1,
            hand_number=1,
            flop_1='AS',
            flop_2='2C',
            flop_3='3D',
            turn=None,
            river=None,
            created_at=datetime(2026, 3, 9, 12, 0, 0),
            player_hands=[],
        )
        data = resp.model_dump()
        restored = HandResponse.model_validate(data)
        assert restored.hand_id == resp.hand_id
        assert restored.flop_1 == resp.flop_1


# === HandResultUpdate ===


class TestHandResultUpdate:
    def test_valid_hand_result_update(self):
        update = HandResultUpdate(
            result='win',
            profit_loss=100.0,
        )
        assert update.result == 'win'
        assert update.profit_loss == 100.0

    def test_hand_result_update_loss(self):
        update = HandResultUpdate(
            result='loss',
            profit_loss=-50.0,
        )
        assert update.result == 'loss'
        assert update.profit_loss == -50.0

    def test_hand_result_update_fold(self):
        update = HandResultUpdate(
            result='fold',
            profit_loss=-10.0,
        )
        assert update.result == 'fold'

    def test_hand_result_update_requires_result(self):
        with pytest.raises(ValidationError):
            HandResultUpdate(profit_loss=50.0)

    def test_hand_result_update_requires_profit_loss(self):
        with pytest.raises(ValidationError):
            HandResultUpdate(result='win')

    def test_hand_result_update_serialization_round_trip(self):
        update = HandResultUpdate(result='win', profit_loss=100.0)
        data = update.model_dump()
        restored = HandResultUpdate.model_validate(data)
        assert restored.result == update.result
        assert restored.profit_loss == update.profit_loss
