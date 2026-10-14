"""Money is stored as whole cents; Python and the API keep using dollars."""

import sqlite3
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config

from app.database.models import GamePlayer, GameSession, Hand, Money

BACKEND = Path(__file__).parents[1]


class TestMoneyType:
    @pytest.mark.parametrize(
        ('dollars', 'cents'),
        [
            (0.1, 10),
            (0.2, 20),
            (0.30000000000000004, 30),
            (1.005, 101),
            (12.345, 1235),
            (0, 0),
            (-0.4, -40),
        ],
    )
    def test_rounds_to_the_cent_on_the_way_in(self, dollars, cents):
        assert Money().process_bind_param(dollars, None) == cents

    @pytest.mark.parametrize(
        ('cents', 'dollars'),
        [(10, 0.1), (30, 0.3), (1999, 19.99), (0, 0.0), (-40, -0.4)],
    )
    def test_comes_back_as_clean_dollars(self, cents, dollars):
        assert Money().process_result_value(cents, None) == dollars

    def test_none_stays_none(self):
        assert Money().process_bind_param(None, None) is None
        assert Money().process_result_value(None, None) is None


class TestStoredAsCents:
    def test_the_database_holds_integers(self, db_session):
        game = GameSession(
            game_date=__import__('datetime').date(2026, 10, 14),
            small_blind=0.1,
            big_blind=0.2,
        )
        db_session.add(game)
        db_session.flush()
        db_session.add(
            GamePlayer(
                game_id=game.game_id, player_id=1, buy_in=20.0, current_chips=19.9
            )
        )
        db_session.commit()

        raw = (
            db_session.connection()
            .exec_driver_sql('SELECT small_blind, big_blind FROM game_sessions')
            .fetchone()
        )
        assert raw == (10, 20)
        assert type(raw[0]) is int

        db_session.expire_all()
        reloaded = db_session.query(GameSession).one()
        assert (reloaded.small_blind, reloaded.big_blind) == (0.1, 0.2)

    def test_repeated_additions_stay_exact(self, db_session):
        game = GameSession(game_date=__import__('datetime').date(2026, 10, 14))
        db_session.add(game)
        db_session.flush()
        hand = Hand(game_id=game.game_id, hand_number=1)
        db_session.add(hand)
        db_session.commit()
        for _ in range(30):
            hand.pot = (hand.pot or 0) + 0.1
            db_session.commit()
        db_session.expire_all()
        assert db_session.query(Hand).one().pot == 3.0

    def test_database_side_sums_are_exact_and_in_dollars(self, db_session):
        from sqlalchemy import func

        game = GameSession(game_date=__import__('datetime').date(2026, 10, 14))
        db_session.add(game)
        db_session.flush()
        for player_id, amount in enumerate((0.1, 0.2, 0.7, 1.15), start=1):
            db_session.add(
                GamePlayer(game_id=game.game_id, player_id=player_id, buy_in=amount)
            )
        db_session.flush()
        total = db_session.query(func.sum(GamePlayer.buy_in)).scalar()
        assert total == 2.15

    def test_comparisons_use_dollars(self, db_session):
        game = GameSession(game_date=__import__('datetime').date(2026, 10, 14))
        db_session.add(game)
        db_session.flush()
        db_session.add(GamePlayer(game_id=game.game_id, player_id=1, buy_in=5.0))
        db_session.add(GamePlayer(game_id=game.game_id, player_id=2, buy_in=0.5))
        db_session.commit()
        big = db_session.query(GamePlayer).filter(GamePlayer.buy_in > 1.0).all()
        assert [row.player_id for row in big] == [1]


class TestMigration:
    @pytest.fixture
    def config(self, tmp_path, monkeypatch):
        database = tmp_path / 'migrate.db'
        monkeypatch.setenv('DATABASE_URL', f'sqlite:///{database}')
        cfg = Config(str(BACKEND / 'alembic.ini'))
        cfg.set_main_option('script_location', str(BACKEND / 'alembic'))
        return cfg, database

    def test_existing_dollar_floats_become_cents_and_back(self, config):
        cfg, database = config
        command.upgrade(cfg, 'c3d9e8a1f5b2')

        connection = sqlite3.connect(database)
        connection.execute(
            'INSERT INTO game_sessions (game_id, game_date, status, small_blind, big_blind, '
            'blind_timer_minutes, blind_timer_paused, default_buy_in) '
            "VALUES (1, '2026-10-14', 'active', 0.1, 0.2, 15, 0, 20.0)"
        )
        connection.execute("INSERT INTO players (player_id, name) VALUES (1, 'Ann')")
        connection.execute(
            'INSERT INTO game_players (game_id, player_id, is_active, buy_in, current_chips) '
            'VALUES (1, 1, 1, 20.0, 19.699999999999996)'
        )
        connection.execute(
            'INSERT INTO hands (hand_id, game_id, hand_number, pot, side_pots) '
            "VALUES (1, 1, 1, 0.30000000000000004, '[]')"
        )
        connection.execute(
            'INSERT INTO player_hands (player_hand_id, hand_id, player_id, profit_loss, is_all_in) '
            'VALUES (1, 1, 1, -0.2, 0)'
        )
        connection.commit()
        connection.close()

        command.upgrade(cfg, 'd5f2a7b9c0e4')

        connection = sqlite3.connect(database)
        assert connection.execute(
            'SELECT small_blind, big_blind, default_buy_in FROM game_sessions'
        ).fetchone() == (10, 20, 2000)
        assert connection.execute(
            'SELECT buy_in, current_chips FROM game_players'
        ).fetchone() == (2000, 1970)
        assert connection.execute('SELECT pot FROM hands').fetchone() == (30,)
        assert connection.execute(
            'SELECT profit_loss FROM player_hands'
        ).fetchone() == (-20,)
        assert connection.execute(
            'SELECT chips_credited FROM player_hands'
        ).fetchone() == (None,)
        connection.close()

        command.downgrade(cfg, 'c3d9e8a1f5b2')

        connection = sqlite3.connect(database)
        assert connection.execute(
            'SELECT small_blind, big_blind FROM game_sessions'
        ).fetchone() == (0.1, 0.2)
        assert connection.execute(
            'SELECT current_chips FROM game_players'
        ).fetchone() == (19.7,)
        assert connection.execute('SELECT pot FROM hands').fetchone() == (0.3,)
        connection.close()

    def test_an_empty_database_migrates_cleanly(self, config):
        cfg, _database = config
        command.upgrade(cfg, 'head')
