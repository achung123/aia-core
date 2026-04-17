"""Tests for GET /stats/head-to-head endpoint."""

from datetime import date

from app.database.models import GameSession, Hand, Player, PlayerHand


def _seed_players(client, game_id, names):
    for name in names:
        client.post(f'/games/{game_id}/players', json={'name': name})


def _make_game(db, game_date=None):
    game = GameSession(game_date=game_date or date(2025, 6, 1))
    db.add(game)
    db.flush()
    return game


def _make_player(db, name):
    player = Player(name=name)
    db.add(player)
    db.flush()
    return player


def _make_hand(db, game_id, hand_number, flop=None, turn=None, river=None):
    hand = Hand(
        game_id=game_id,
        hand_number=hand_number,
        flop_1=flop[0] if flop else None,
        flop_2=flop[1] if flop else None,
        flop_3=flop[2] if flop else None,
        turn=turn,
        river=river,
    )
    db.add(hand)
    db.flush()
    return hand


def _make_player_hand(db, hand_id, player_id, result=None, outcome_street=None):
    ph = PlayerHand(
        hand_id=hand_id,
        player_id=player_id,
        result=result,
        outcome_street=outcome_street,
    )
    db.add(ph)
    db.flush()
    return ph


class TestHeadToHead404:
    """Returns 404 when either player does not exist."""

    def test_player1_not_found(self, client, db_session):
        db = db_session
        _make_player(db, 'Alice')
        db.commit()

        resp = client.get(
            '/stats/head-to-head', params={'player1': 'Ghost', 'player2': 'Alice'}
        )
        assert resp.status_code == 404

    def test_player2_not_found(self, client, db_session):
        db = db_session
        _make_player(db, 'Alice')
        db.commit()

        resp = client.get(
            '/stats/head-to-head', params={'player1': 'Alice', 'player2': 'Ghost'}
        )
        assert resp.status_code == 404

    def test_both_players_not_found(self, client):
        resp = client.get(
            '/stats/head-to-head', params={'player1': 'Ghost1', 'player2': 'Ghost2'}
        )
        assert resp.status_code == 404


class TestHeadToHeadCaseInsensitive:
    """Players are matched case-insensitively."""

    def test_case_insensitive_lookup(self, client, db_session):
        db = db_session
        _make_player(db, 'Alice')
        _make_player(db, 'Bob')
        db.commit()

        resp = client.get(
            '/stats/head-to-head', params={'player1': 'ALICE', 'player2': 'bob'}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data['player1_name'] == 'Alice'
        assert data['player2_name'] == 'Bob'


class TestHeadToHeadNoSharedHands:
    """Both players exist but never played together."""

    def test_returns_zeros(self, client, db_session):
        db = db_session
        _make_player(db, 'Alice')
        _make_player(db, 'Bob')
        db.commit()

        resp = client.get(
            '/stats/head-to-head', params={'player1': 'Alice', 'player2': 'Bob'}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data['shared_hands_count'] == 0
        assert data['showdown_count'] == 0
        assert data['player1_showdown_wins'] == 0
        assert data['player2_showdown_wins'] == 0
        assert data['player1_fold_count'] == 0
        assert data['player2_fold_count'] == 0
        assert data['player1_fold_rate'] == 0.0
        assert data['player2_fold_rate'] == 0.0
        assert data['street_breakdown'] == []


class TestHeadToHeadShowdownStats:
    """Showdown = both players have a non-fold result (won or lost)."""

    def test_showdown_counts(self, client, db_session):
        db = db_session
        game = _make_game(db)
        alice = _make_player(db, 'Alice')
        bob = _make_player(db, 'Bob')

        # Hand 1: showdown — Alice wins, Bob loses (river)
        h1 = _make_hand(
            db, game.game_id, 1, flop=('Ah', 'Kd', 'Qc'), turn='Js', river='Ts'
        )
        _make_player_hand(db, h1.hand_id, alice.player_id, result='won')
        _make_player_hand(db, h1.hand_id, bob.player_id, result='lost')

        # Hand 2: showdown — Bob wins, Alice loses (river)
        h2 = _make_hand(
            db, game.game_id, 2, flop=('2h', '3d', '4c'), turn='5s', river='6s'
        )
        _make_player_hand(db, h2.hand_id, alice.player_id, result='lost')
        _make_player_hand(db, h2.hand_id, bob.player_id, result='won')

        # Hand 3: NOT showdown — Alice folds
        h3 = _make_hand(db, game.game_id, 3, flop=('7h', '8d', '9c'))
        _make_player_hand(db, h3.hand_id, alice.player_id, result='folded')
        _make_player_hand(db, h3.hand_id, bob.player_id, result='won')

        db.commit()

        resp = client.get(
            '/stats/head-to-head', params={'player1': 'Alice', 'player2': 'Bob'}
        )
        assert resp.status_code == 200
        data = resp.json()

        assert data['shared_hands_count'] == 3
        assert data['showdown_count'] == 2
        assert data['player1_showdown_wins'] == 1
        assert data['player2_showdown_wins'] == 1


class TestHeadToHeadFoldBehavior:
    """Fold stats count how often each player folded in shared hands."""

    def test_fold_counts_and_rates(self, client, db_session):
        db = db_session
        game = _make_game(db)
        alice = _make_player(db, 'Alice')
        bob = _make_player(db, 'Bob')

        # 4 shared hands: Alice folds in 3, Bob folds in 1
        for i in range(1, 5):
            h = _make_hand(db, game.game_id, i)
            if i <= 3:
                _make_player_hand(db, h.hand_id, alice.player_id, result='folded')
                _make_player_hand(db, h.hand_id, bob.player_id, result='won')
            else:
                _make_player_hand(db, h.hand_id, alice.player_id, result='won')
                _make_player_hand(db, h.hand_id, bob.player_id, result='folded')

        db.commit()

        resp = client.get(
            '/stats/head-to-head', params={'player1': 'Alice', 'player2': 'Bob'}
        )
        data = resp.json()

        assert data['player1_fold_count'] == 3
        assert data['player2_fold_count'] == 1
        assert data['player1_fold_rate'] == 75.0  # 3/4 * 100
        assert data['player2_fold_rate'] == 25.0  # 1/4 * 100


class TestHeadToHeadStreetBreakdown:
    """Street breakdown: how many shared hands ended at each street, with wins per player."""

    def test_street_breakdown_by_community_cards(self, client, db_session):
        db = db_session
        game = _make_game(db)
        alice = _make_player(db, 'Alice')
        bob = _make_player(db, 'Bob')

        # Hand 1: preflop (no community cards) — Alice wins
        h1 = _make_hand(db, game.game_id, 1)
        _make_player_hand(db, h1.hand_id, alice.player_id, result='won')
        _make_player_hand(db, h1.hand_id, bob.player_id, result='folded')

        # Hand 2: flop — Bob wins
        h2 = _make_hand(db, game.game_id, 2, flop=('Ah', 'Kd', 'Qc'))
        _make_player_hand(db, h2.hand_id, alice.player_id, result='folded')
        _make_player_hand(db, h2.hand_id, bob.player_id, result='won')

        # Hand 3: turn — Alice wins
        h3 = _make_hand(db, game.game_id, 3, flop=('2h', '3d', '4c'), turn='5s')
        _make_player_hand(db, h3.hand_id, alice.player_id, result='won')
        _make_player_hand(db, h3.hand_id, bob.player_id, result='lost')

        # Hand 4: river — Bob wins
        h4 = _make_hand(
            db, game.game_id, 4, flop=('6h', '7d', '8c'), turn='9s', river='Ts'
        )
        _make_player_hand(db, h4.hand_id, alice.player_id, result='lost')
        _make_player_hand(db, h4.hand_id, bob.player_id, result='won')

        # Hand 5: river — Alice wins
        h5 = _make_hand(
            db, game.game_id, 5, flop=('Jh', 'Qd', 'Kc'), turn='As', river='2s'
        )
        _make_player_hand(db, h5.hand_id, alice.player_id, result='won')
        _make_player_hand(db, h5.hand_id, bob.player_id, result='lost')

        db.commit()

        resp = client.get(
            '/stats/head-to-head', params={'player1': 'Alice', 'player2': 'Bob'}
        )
        data = resp.json()

        breakdown = {s['street']: s for s in data['street_breakdown']}
        assert breakdown['preflop'] == {
            'street': 'preflop',
            'hands_ended': 1,
            'player1_wins': 1,
            'player2_wins': 0,
        }
        assert breakdown['flop'] == {
            'street': 'flop',
            'hands_ended': 1,
            'player1_wins': 0,
            'player2_wins': 1,
        }
        assert breakdown['turn'] == {
            'street': 'turn',
            'hands_ended': 1,
            'player1_wins': 1,
            'player2_wins': 0,
        }
        assert breakdown['river'] == {
            'street': 'river',
            'hands_ended': 2,
            'player1_wins': 1,
            'player2_wins': 1,
        }

    def test_street_order_is_preflop_flop_turn_river(self, client, db_session):
        db = db_session
        game = _make_game(db)
        alice = _make_player(db, 'Alice')
        bob = _make_player(db, 'Bob')

        # Create hands at river, preflop, flop (out of order)
        h1 = _make_hand(
            db, game.game_id, 1, flop=('Ah', 'Kd', 'Qc'), turn='Js', river='Ts'
        )
        _make_player_hand(db, h1.hand_id, alice.player_id, result='won')
        _make_player_hand(db, h1.hand_id, bob.player_id, result='lost')

        h2 = _make_hand(db, game.game_id, 2)
        _make_player_hand(db, h2.hand_id, alice.player_id, result='won')
        _make_player_hand(db, h2.hand_id, bob.player_id, result='folded')

        h3 = _make_hand(db, game.game_id, 3, flop=('2h', '3d', '4c'))
        _make_player_hand(db, h3.hand_id, alice.player_id, result='folded')
        _make_player_hand(db, h3.hand_id, bob.player_id, result='won')

        db.commit()

        resp = client.get(
            '/stats/head-to-head', params={'player1': 'Alice', 'player2': 'Bob'}
        )
        data = resp.json()

        streets = [s['street'] for s in data['street_breakdown']]
        assert streets == ['preflop', 'flop', 'river']


class TestHeadToHeadFullScenario:
    """Integration test with a mix of outcomes."""

    def test_full_rivalry_stats(self, client, db_session):
        db = db_session
        game = _make_game(db)
        alice = _make_player(db, 'Alice')
        bob = _make_player(db, 'Bob')

        # Hand 1: preflop fold by Bob → Alice wins
        h1 = _make_hand(db, game.game_id, 1)
        _make_player_hand(db, h1.hand_id, alice.player_id, result='won')
        _make_player_hand(db, h1.hand_id, bob.player_id, result='folded')

        # Hand 2: river showdown → Bob wins
        h2 = _make_hand(
            db, game.game_id, 2, flop=('Ah', 'Kd', 'Qc'), turn='Js', river='Ts'
        )
        _make_player_hand(db, h2.hand_id, alice.player_id, result='lost')
        _make_player_hand(db, h2.hand_id, bob.player_id, result='won')

        # Hand 3: flop fold by Alice → Bob wins
        h3 = _make_hand(db, game.game_id, 3, flop=('2h', '3d', '4c'))
        _make_player_hand(db, h3.hand_id, alice.player_id, result='folded')
        _make_player_hand(db, h3.hand_id, bob.player_id, result='won')

        # Hand 4: river showdown → Alice wins
        h4 = _make_hand(
            db, game.game_id, 4, flop=('5h', '6d', '7c'), turn='8s', river='9s'
        )
        _make_player_hand(db, h4.hand_id, alice.player_id, result='won')
        _make_player_hand(db, h4.hand_id, bob.player_id, result='lost')

        db.commit()

        resp = client.get(
            '/stats/head-to-head', params={'player1': 'Alice', 'player2': 'Bob'}
        )
        assert resp.status_code == 200
        data = resp.json()

        assert data['player1_name'] == 'Alice'
        assert data['player2_name'] == 'Bob'
        assert data['shared_hands_count'] == 4
        assert data['showdown_count'] == 2  # hands 2 and 4
        assert data['player1_showdown_wins'] == 1  # hand 4
        assert data['player2_showdown_wins'] == 1  # hand 2
        assert data['player1_fold_count'] == 1  # hand 3
        assert data['player2_fold_count'] == 1  # hand 1
        assert data['player1_fold_rate'] == 25.0
        assert data['player2_fold_rate'] == 25.0

        breakdown = {s['street']: s for s in data['street_breakdown']}
        assert breakdown['preflop']['hands_ended'] == 1
        assert breakdown['flop']['hands_ended'] == 1
        assert breakdown['river']['hands_ended'] == 2
