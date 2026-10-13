"""Tests for get_shared_hands query helper."""

from datetime import date

from app.database.models import GameSession, Hand, Player, PlayerHand
from app.database.queries import get_shared_hands


def _make_game(db, game_date=None):
    game = GameSession(game_date=game_date or date(2025, 1, 1))
    db.add(game)
    db.flush()
    return game


def _make_player(db, name):
    player = Player(name=name)
    db.add(player)
    db.flush()
    return player


def _make_hand(db, game_id, hand_number):
    hand = Hand(game_id=game_id, hand_number=hand_number)
    db.add(hand)
    db.flush()
    return hand


def _make_player_hand(db, hand_id, player_id, result=None):
    ph = PlayerHand(hand_id=hand_id, player_id=player_id, result=result)
    db.add(ph)
    db.flush()
    return ph


class TestGetSharedHandsBothPresent:
    """Scenario 1: Both players participated in the same hands."""

    def test_returns_hands_where_both_players_participated(self, db_session):
        db = db_session
        game = _make_game(db)
        alice = _make_player(db, 'Alice')
        bob = _make_player(db, 'Bob')

        h1 = _make_hand(db, game.game_id, hand_number=1)
        ph_a1 = _make_player_hand(db, h1.hand_id, alice.player_id)
        ph_b1 = _make_player_hand(db, h1.hand_id, bob.player_id)

        h2 = _make_hand(db, game.game_id, hand_number=2)
        ph_a2 = _make_player_hand(db, h2.hand_id, alice.player_id)
        ph_b2 = _make_player_hand(db, h2.hand_id, bob.player_id)

        db.commit()

        results = get_shared_hands(db, alice.player_id, bob.player_id)

        assert len(results) == 2
        # Ordered by hand_number ascending
        assert results[0] == (h1, ph_a1, ph_b1)
        assert results[1] == (h2, ph_a2, ph_b2)

    def test_ordering_by_hand_number_ascending(self, db_session):
        db = db_session
        game = _make_game(db)
        alice = _make_player(db, 'Alice')
        bob = _make_player(db, 'Bob')

        # Create hands out of order
        h3 = _make_hand(db, game.game_id, hand_number=3)
        _make_player_hand(db, h3.hand_id, alice.player_id)
        _make_player_hand(db, h3.hand_id, bob.player_id)

        h1 = _make_hand(db, game.game_id, hand_number=1)
        _make_player_hand(db, h1.hand_id, alice.player_id)
        _make_player_hand(db, h1.hand_id, bob.player_id)

        h2 = _make_hand(db, game.game_id, hand_number=2)
        _make_player_hand(db, h2.hand_id, alice.player_id)
        _make_player_hand(db, h2.hand_id, bob.player_id)

        db.commit()

        results = get_shared_hands(db, alice.player_id, bob.player_id)

        assert len(results) == 3
        assert results[0][0].hand_number == 1
        assert results[1][0].hand_number == 2
        assert results[2][0].hand_number == 3


class TestGetSharedHandsOneAbsent:
    """Scenario 2: One player is absent from a hand — that hand is excluded."""

    def test_excludes_hands_where_only_one_player_participated(self, db_session):
        db = db_session
        game = _make_game(db)
        alice = _make_player(db, 'Alice')
        bob = _make_player(db, 'Bob')
        charlie = _make_player(db, 'Charlie')

        # Hand 1: Alice + Bob  → shared
        h1 = _make_hand(db, game.game_id, hand_number=1)
        _make_player_hand(db, h1.hand_id, alice.player_id)
        _make_player_hand(db, h1.hand_id, bob.player_id)

        # Hand 2: Alice + Charlie only (Bob absent) → NOT shared
        h2 = _make_hand(db, game.game_id, hand_number=2)
        _make_player_hand(db, h2.hand_id, alice.player_id)
        _make_player_hand(db, h2.hand_id, charlie.player_id)

        # Hand 3: Bob + Charlie only (Alice absent) → NOT shared
        h3 = _make_hand(db, game.game_id, hand_number=3)
        _make_player_hand(db, h3.hand_id, bob.player_id)
        _make_player_hand(db, h3.hand_id, charlie.player_id)

        db.commit()

        results = get_shared_hands(db, alice.player_id, bob.player_id)

        assert len(results) == 1
        assert results[0][0].hand_id == h1.hand_id


class TestGetSharedHandsFoldVsWin:
    """Scenario 3: Both fold vs one wins — result doesn't matter, only participation."""

    def test_includes_hands_regardless_of_result(self, db_session):
        db = db_session
        game = _make_game(db)
        alice = _make_player(db, 'Alice')
        bob = _make_player(db, 'Bob')

        # Hand 1: both fold
        h1 = _make_hand(db, game.game_id, hand_number=1)
        ph_a1 = _make_player_hand(db, h1.hand_id, alice.player_id, result='fold')
        ph_b1 = _make_player_hand(db, h1.hand_id, bob.player_id, result='fold')

        # Hand 2: Alice wins, Bob folds
        h2 = _make_hand(db, game.game_id, hand_number=2)
        ph_a2 = _make_player_hand(db, h2.hand_id, alice.player_id, result='win')
        ph_b2 = _make_player_hand(db, h2.hand_id, bob.player_id, result='fold')

        # Hand 3: Alice has no result set (None), Bob wins
        h3 = _make_hand(db, game.game_id, hand_number=3)
        ph_a3 = _make_player_hand(db, h3.hand_id, alice.player_id, result=None)
        ph_b3 = _make_player_hand(db, h3.hand_id, bob.player_id, result='win')

        db.commit()

        results = get_shared_hands(db, alice.player_id, bob.player_id)

        assert len(results) == 3
        # All three hands included regardless of result
        assert results[0] == (h1, ph_a1, ph_b1)
        assert results[1] == (h2, ph_a2, ph_b2)
        assert results[2] == (h3, ph_a3, ph_b3)
