"""Tests for game highlights endpoint (GET /stats/games/{game_id}/highlights)."""

from datetime import date

from app.database.models import GamePlayer, GameSession, Hand, Player, PlayerHand


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _create_game_with_players(db, player_names, game_date=date(2026, 1, 15)):
    """Create a game session with registered players."""
    players = {}
    for name in player_names:
        p = Player(name=name)
        db.add(p)
        db.flush()
        players[name] = p

    game = GameSession(game_date=game_date)
    db.add(game)
    db.flush()

    for p in players.values():
        db.add(GamePlayer(game_id=game.game_id, player_id=p.player_id))
    db.flush()
    return game, players


def _add_hand(db, game_id, hand_number, player_results, *, has_river=False):
    """Add a hand with player results.

    player_results: list of (player, result_str) tuples.
    """
    hand = Hand(
        game_id=game_id,
        hand_number=hand_number,
        flop_1='Ah',
        flop_2='Kd',
        flop_3='Qs',
        turn='Jc' if has_river else None,
        river='Th' if has_river else None,
    )
    db.add(hand)
    db.flush()

    for player, result in player_results:
        db.add(
            PlayerHand(
                hand_id=hand.hand_id,
                player_id=player.player_id,
                result=result,
                profit_loss=10.0
                if result == 'won'
                else -5.0
                if result == 'lost'
                else 0.0,
            )
        )
    db.flush()
    return hand


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestHighlights404:
    def test_nonexistent_game_returns_404(self, client):
        resp = client.get('/stats/games/9999/highlights')
        assert resp.status_code == 404


class TestHighlightsMinHands:
    def test_fewer_than_3_hands_returns_empty(self, client, db_session):
        game, players = _create_game_with_players(db_session, ['Alice', 'Bob'])
        _add_hand(
            db_session,
            game.game_id,
            1,
            [
                (players['Alice'], 'won'),
                (players['Bob'], 'lost'),
            ],
        )
        _add_hand(
            db_session,
            game.game_id,
            2,
            [
                (players['Alice'], 'lost'),
                (players['Bob'], 'won'),
            ],
        )
        db_session.commit()

        resp = client.get(f'/stats/games/{game.game_id}/highlights')
        assert resp.status_code == 200
        assert resp.json() == []


class TestMostAction:
    def test_hand_with_most_non_fold_players(self, client, db_session):
        game, players = _create_game_with_players(
            db_session,
            ['Alice', 'Bob', 'Charlie', 'Dan'],
        )
        # Hand 1: 2 non-fold (Alice wins, Bob lost, Charlie folds)
        _add_hand(
            db_session,
            game.game_id,
            1,
            [
                (players['Alice'], 'won'),
                (players['Bob'], 'lost'),
                (players['Charlie'], 'folded'),
            ],
        )
        # Hand 2: 4 non-fold — highest action
        _add_hand(
            db_session,
            game.game_id,
            2,
            [
                (players['Alice'], 'won'),
                (players['Bob'], 'lost'),
                (players['Charlie'], 'lost'),
                (players['Dan'], 'lost'),
            ],
        )
        # Hand 3: 3 non-fold
        _add_hand(
            db_session,
            game.game_id,
            3,
            [
                (players['Alice'], 'won'),
                (players['Bob'], 'lost'),
                (players['Charlie'], 'lost'),
            ],
        )
        db_session.commit()

        resp = client.get(f'/stats/games/{game.game_id}/highlights')
        assert resp.status_code == 200
        highlights = resp.json()
        most_action = [h for h in highlights if h['highlight_type'] == 'most_action']
        assert len(most_action) == 1
        assert most_action[0]['hand_number'] == 2


class TestRiverShowdown:
    def test_river_with_3_plus_active(self, client, db_session):
        game, players = _create_game_with_players(
            db_session,
            ['Alice', 'Bob', 'Charlie'],
        )
        # Hand 1: no river, 3 non-fold → NOT river_showdown
        _add_hand(
            db_session,
            game.game_id,
            1,
            [
                (players['Alice'], 'won'),
                (players['Bob'], 'lost'),
                (players['Charlie'], 'lost'),
            ],
        )
        # Hand 2: river, 3 non-fold → river_showdown
        _add_hand(
            db_session,
            game.game_id,
            2,
            [
                (players['Alice'], 'won'),
                (players['Bob'], 'lost'),
                (players['Charlie'], 'lost'),
            ],
            has_river=True,
        )
        # Hand 3: river, 2 non-fold (Charlie folds) → NOT river_showdown
        _add_hand(
            db_session,
            game.game_id,
            3,
            [
                (players['Alice'], 'won'),
                (players['Bob'], 'lost'),
                (players['Charlie'], 'folded'),
            ],
            has_river=True,
        )
        db_session.commit()

        resp = client.get(f'/stats/games/{game.game_id}/highlights')
        assert resp.status_code == 200
        highlights = resp.json()
        river = [h for h in highlights if h['highlight_type'] == 'river_showdown']
        assert len(river) == 1
        assert river[0]['hand_number'] == 2


class TestStreakStart:
    def test_first_hand_of_longest_streak(self, client, db_session):
        game, players = _create_game_with_players(
            db_session,
            ['Alice', 'Bob', 'Charlie'],
        )
        # Hand 1: Bob wins
        _add_hand(
            db_session,
            game.game_id,
            1,
            [
                (players['Alice'], 'lost'),
                (players['Bob'], 'won'),
                (players['Charlie'], 'lost'),
            ],
        )
        # Hands 2-5: Alice wins 4 in a row
        for i in range(2, 6):
            _add_hand(
                db_session,
                game.game_id,
                i,
                [
                    (players['Alice'], 'won'),
                    (players['Bob'], 'lost'),
                    (players['Charlie'], 'lost'),
                ],
            )
        db_session.commit()

        resp = client.get(f'/stats/games/{game.game_id}/highlights')
        assert resp.status_code == 200
        highlights = resp.json()
        streak = [h for h in highlights if h['highlight_type'] == 'streak_start']
        assert len(streak) == 1
        assert streak[0]['hand_number'] == 2
        assert 'Alice' in streak[0]['description']

    def test_no_streak_when_all_different_winners(self, client, db_session):
        """No streak_start highlight when no player wins 2+ consecutive."""
        game, players = _create_game_with_players(
            db_session,
            ['Alice', 'Bob', 'Charlie'],
        )
        winners = ['Alice', 'Bob', 'Charlie']
        for i in range(1, 4):
            winner = winners[(i - 1) % 3]
            _add_hand(
                db_session,
                game.game_id,
                i,
                [
                    (players[n], 'won' if n == winner else 'lost')
                    for n in ['Alice', 'Bob', 'Charlie']
                ],
            )
        db_session.commit()

        resp = client.get(f'/stats/games/{game.game_id}/highlights')
        assert resp.status_code == 200
        highlights = resp.json()
        streak = [h for h in highlights if h['highlight_type'] == 'streak_start']
        assert len(streak) == 0


class TestHighlightsCap:
    def test_returns_at_most_5(self, client, db_session):
        game, players = _create_game_with_players(
            db_session,
            ['Alice', 'Bob', 'Charlie'],
        )
        # 9 hands, all river showdowns to generate many highlights
        winners = ['Alice', 'Bob', 'Charlie']
        for i in range(1, 10):
            winner = winners[(i - 1) % 3]
            _add_hand(
                db_session,
                game.game_id,
                i,
                [
                    (players[n], 'won' if n == winner else 'lost')
                    for n in ['Alice', 'Bob', 'Charlie']
                ],
                has_river=True,
            )
        db_session.commit()

        resp = client.get(f'/stats/games/{game.game_id}/highlights')
        assert resp.status_code == 200
        highlights = resp.json()
        assert 1 <= len(highlights) <= 5


class TestTenPlusHandsHighlightCount:
    def test_game_with_10_plus_hands_returns_3_to_5_highlights(self, client, db_session):
        """AC-1: A game with 10+ hands should produce between 3 and 5 highlights."""
        game, players = _create_game_with_players(
            db_session,
            ['Alice', 'Bob', 'Charlie', 'Dan'],
        )
        # 12 hands: mix of river showdowns, varied winners, and high-action hands
        for i in range(1, 13):
            if i <= 4:
                # Alice wins 4 in a row → streak_start
                results = [
                    (players['Alice'], 'won'),
                    (players['Bob'], 'lost'),
                    (players['Charlie'], 'lost'),
                ]
            elif i == 5:
                # High-action hand: all 4 players → most_action
                results = [
                    (players['Alice'], 'lost'),
                    (players['Bob'], 'won'),
                    (players['Charlie'], 'lost'),
                    (players['Dan'], 'lost'),
                ]
            else:
                # Rotating winners with river → river_showdown candidates
                winner = ['Bob', 'Charlie', 'Dan'][(i - 6) % 3]
                results = [
                    (players[n], 'won' if n == winner else 'lost')
                    for n in ['Alice', 'Bob', 'Charlie']
                ]
            _add_hand(
                db_session,
                game.game_id,
                i,
                results,
                has_river=(i >= 6),
            )
        db_session.commit()

        resp = client.get(f'/stats/games/{game.game_id}/highlights')
        assert resp.status_code == 200
        highlights = resp.json()
        assert 3 <= len(highlights) <= 5


class TestHighlightTypesValid:
    def test_highlight_types_are_valid_enum_values(self, client, db_session):
        """AC-4: Every returned highlight_type must be a known value."""
        valid_types = {'most_action', 'river_showdown', 'streak_start'}
        game, players = _create_game_with_players(
            db_session,
            ['Alice', 'Bob', 'Charlie', 'Dan'],
        )
        # Build a game that produces all three highlight types
        # Hands 1-3: Alice wins 3 in a row → streak_start
        for i in range(1, 4):
            _add_hand(
                db_session,
                game.game_id,
                i,
                [
                    (players['Alice'], 'won'),
                    (players['Bob'], 'lost'),
                    (players['Charlie'], 'lost'),
                ],
            )
        # Hand 4: all 4 non-fold → most_action
        _add_hand(
            db_session,
            game.game_id,
            4,
            [
                (players['Alice'], 'lost'),
                (players['Bob'], 'won'),
                (players['Charlie'], 'lost'),
                (players['Dan'], 'lost'),
            ],
        )
        # Hand 5: river + 3 active → river_showdown
        _add_hand(
            db_session,
            game.game_id,
            5,
            [
                (players['Alice'], 'won'),
                (players['Bob'], 'lost'),
                (players['Charlie'], 'lost'),
            ],
            has_river=True,
        )
        db_session.commit()

        resp = client.get(f'/stats/games/{game.game_id}/highlights')
        assert resp.status_code == 200
        highlights = resp.json()
        assert len(highlights) >= 1
        for h in highlights:
            assert h['highlight_type'] in valid_types, (
                f"Unexpected highlight_type: {h['highlight_type']}"
            )


class TestCombinedHighlights:
    def test_multiple_highlight_types(self, client, db_session):
        game, players = _create_game_with_players(
            db_session,
            ['Alice', 'Bob', 'Charlie', 'Dan'],
        )
        # Hand 1: Alice wins, 2 non-fold
        _add_hand(
            db_session,
            game.game_id,
            1,
            [
                (players['Alice'], 'won'),
                (players['Bob'], 'lost'),
                (players['Charlie'], 'folded'),
            ],
        )
        # Hand 2: 4 non-fold (most_action), Bob wins — breaks Alice streak
        _add_hand(
            db_session,
            game.game_id,
            2,
            [
                (players['Alice'], 'lost'),
                (players['Bob'], 'won'),
                (players['Charlie'], 'lost'),
                (players['Dan'], 'lost'),
            ],
        )
        # Hand 3: river + 3 active (river_showdown), Alice wins
        _add_hand(
            db_session,
            game.game_id,
            3,
            [
                (players['Alice'], 'won'),
                (players['Bob'], 'lost'),
                (players['Charlie'], 'lost'),
            ],
            has_river=True,
        )
        # Hand 4: Alice wins (streak: hands 3-4)
        _add_hand(
            db_session,
            game.game_id,
            4,
            [
                (players['Alice'], 'won'),
                (players['Bob'], 'lost'),
                (players['Charlie'], 'lost'),
            ],
        )
        db_session.commit()

        resp = client.get(f'/stats/games/{game.game_id}/highlights')
        assert resp.status_code == 200
        highlights = resp.json()
        types = {h['highlight_type'] for h in highlights}
        assert 'most_action' in types
        assert len(types) >= 2
