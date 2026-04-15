"""Tests for GET /stats/players/{player_name}/trends endpoint."""

from datetime import date


def _seed_game_with_hands(client, db_session, game_date, player_name, results):
    """Create a game session with hands and assign results for a player.

    Args:
        client: TestClient instance.
        db_session: SQLAlchemy session.
        game_date: Date string (YYYY-MM-DD) for the game.
        player_name: Name of the player.
        results: List of dicts with keys 'result' and 'profit_loss'.

    Returns:
        The game_id of the created game.
    """
    from app.database.models import GameSession, Hand, Player, PlayerHand

    # Ensure the player exists
    player = db_session.query(Player).filter(Player.name == player_name).first()
    if not player:
        player = Player(name=player_name)
        db_session.add(player)
        db_session.flush()

    game = GameSession(game_date=date.fromisoformat(game_date), status='completed')
    db_session.add(game)
    db_session.flush()

    for i, res in enumerate(results, start=1):
        hand = Hand(game_id=game.game_id, hand_number=i)
        db_session.add(hand)
        db_session.flush()

        ph = PlayerHand(
            hand_id=hand.hand_id,
            player_id=player.player_id,
            result=res['result'],
            profit_loss=res['profit_loss'],
        )
        db_session.add(ph)

    db_session.commit()
    return game.game_id


class TestPlayerTrendsEndpoint:
    """Tests for the player career trend endpoint."""

    def test_returns_404_for_nonexistent_player(self, client):
        resp = client.get('/stats/players/ghost_player/trends')
        assert resp.status_code == 404

    def test_returns_empty_list_for_player_with_no_hands(self, client, db_session):
        from app.database.models import Player

        player = Player(name='lonely_player')
        db_session.add(player)
        db_session.commit()

        resp = client.get('/stats/players/lonely_player/trends')
        assert resp.status_code == 200
        assert resp.json() == []

    def test_returns_single_session_trend(self, client, db_session):
        _seed_game_with_hands(
            client,
            db_session,
            '2025-03-15',
            'alice',
            [
                {'result': 'won', 'profit_loss': 10.0},
                {'result': 'lost', 'profit_loss': -5.0},
                {'result': 'won', 'profit_loss': 8.0},
            ],
        )

        resp = client.get('/stats/players/alice/trends')
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1

        trend = data[0]
        assert trend['game_date'] == '2025-03-15'
        assert trend['hands_played'] == 3
        assert trend['hands_won'] == 2
        assert trend['win_rate'] == round(2 / 3 * 100, 2)
        assert trend['profit_loss'] == 13.0

    def test_returns_multiple_sessions_sorted_by_date(self, client, db_session):
        # Create sessions out of chronological order
        _seed_game_with_hands(
            client,
            db_session,
            '2025-04-01',
            'bob',
            [
                {'result': 'won', 'profit_loss': 20.0},
                {'result': 'won', 'profit_loss': 15.0},
            ],
        )
        _seed_game_with_hands(
            client,
            db_session,
            '2025-03-01',
            'bob',
            [
                {'result': 'lost', 'profit_loss': -10.0},
                {'result': 'folded', 'profit_loss': -2.0},
                {'result': 'won', 'profit_loss': 5.0},
            ],
        )

        resp = client.get('/stats/players/bob/trends')
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2

        # First entry should be the earlier session (March)
        assert data[0]['game_date'] == '2025-03-01'
        assert data[0]['hands_played'] == 3
        assert data[0]['hands_won'] == 1
        assert data[0]['win_rate'] == round(1 / 3 * 100, 2)
        assert data[0]['profit_loss'] == -7.0

        # Second entry should be the later session (April)
        assert data[1]['game_date'] == '2025-04-01'
        assert data[1]['hands_played'] == 2
        assert data[1]['hands_won'] == 2
        assert data[1]['win_rate'] == 100.0
        assert data[1]['profit_loss'] == 35.0

    def test_win_rate_calculation_hands_won_over_total(self, client, db_session):
        _seed_game_with_hands(
            client,
            db_session,
            '2025-06-01',
            'carol',
            [
                {'result': 'won', 'profit_loss': 5.0},
                {'result': 'lost', 'profit_loss': -3.0},
                {'result': 'lost', 'profit_loss': -2.0},
                {'result': 'lost', 'profit_loss': -1.0},
            ],
        )

        resp = client.get('/stats/players/carol/trends')
        data = resp.json()
        assert data[0]['win_rate'] == round(1 / 4 * 100, 2)

    def test_win_rate_two_out_of_five(self, client, db_session):
        _seed_game_with_hands(
            client,
            db_session,
            '2025-06-15',
            'frank',
            [
                {'result': 'won', 'profit_loss': 12.0},
                {'result': 'lost', 'profit_loss': -5.0},
                {'result': 'won', 'profit_loss': 8.0},
                {'result': 'lost', 'profit_loss': -3.0},
                {'result': 'lost', 'profit_loss': -2.0},
            ],
        )

        resp = client.get('/stats/players/frank/trends')
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]['hands_played'] == 5
        assert data[0]['hands_won'] == 2
        assert data[0]['win_rate'] == 40.0
        assert data[0]['profit_loss'] == 10.0

    def test_case_insensitive_player_name(self, client, db_session):
        _seed_game_with_hands(
            client,
            db_session,
            '2025-05-01',
            'Dave',
            [{'result': 'won', 'profit_loss': 10.0}],
        )

        resp = client.get('/stats/players/dave/trends')
        assert resp.status_code == 200
        assert len(resp.json()) == 1

    def test_excludes_handed_back_results(self, client, db_session):
        _seed_game_with_hands(
            client,
            db_session,
            '2025-07-01',
            'eve',
            [
                {'result': 'won', 'profit_loss': 10.0},
                {'result': 'handed_back', 'profit_loss': 0.0},
            ],
        )

        resp = client.get('/stats/players/eve/trends')
        data = resp.json()
        assert len(data) == 1
        # Only 1 hand counted (handed_back excluded)
        assert data[0]['hands_played'] == 1
        assert data[0]['hands_won'] == 1
        assert data[0]['win_rate'] == 100.0
