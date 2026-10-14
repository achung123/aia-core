"""The app brings an out-of-date database up to date before serving."""

import sqlite3
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config

from app.database.migrate import ensure_database_is_current

BACKEND = Path(__file__).parents[1]


def _upgrade(database: Path, revision: str) -> None:
    config = Config(str(BACKEND / 'alembic.ini'))
    config.set_main_option('script_location', str(BACKEND / 'alembic'))
    config.set_main_option('sqlalchemy.url', f'sqlite:///{database}')
    command.upgrade(config, revision)


def _seed_old_game(database: Path) -> None:
    connection = sqlite3.connect(database)
    connection.execute(
        'INSERT INTO game_sessions (game_id, game_date, status, small_blind, big_blind, '
        'blind_timer_minutes, blind_timer_paused, default_buy_in) '
        "VALUES (1, '2026-10-14', 'active', 0.1, 0.2, 15, 0, 20.0)"
    )
    connection.commit()
    connection.close()


@pytest.fixture
def old_database(tmp_path):
    database = tmp_path / 'poker.db'
    _upgrade(database, 'c3d9e8a1f5b2')  # the revision before money became cents
    _seed_old_game(database)
    return database


class TestEnsureDatabaseIsCurrent:
    def test_migrates_an_old_database_and_converts_its_money(
        self, old_database, tmp_path
    ):
        backups = tmp_path / 'backups'
        result = ensure_database_is_current(f'sqlite:///{old_database}', backups)

        assert result is not None
        connection = sqlite3.connect(old_database)
        assert connection.execute(
            'SELECT small_blind, big_blind, default_buy_in FROM game_sessions'
        ).fetchone() == (10, 20, 2000)
        connection.close()

    def test_takes_a_backup_of_the_old_data_first(self, old_database, tmp_path):
        backups = tmp_path / 'backups'
        ensure_database_is_current(f'sqlite:///{old_database}', backups)

        copies = list(backups.glob('poker-*.db'))
        assert len(copies) == 1
        connection = sqlite3.connect(copies[0])
        # the copy still has the old dollar values
        assert connection.execute(
            'SELECT small_blind FROM game_sessions'
        ).fetchone() == (0.1,)
        connection.close()

    def test_does_nothing_when_already_current(self, old_database, tmp_path):
        backups = tmp_path / 'backups'
        ensure_database_is_current(f'sqlite:///{old_database}', backups)
        before = len(list(backups.glob('poker-*.db')))

        assert ensure_database_is_current(f'sqlite:///{old_database}', backups) is None
        assert len(list(backups.glob('poker-*.db'))) == before

    def test_does_not_run_twice_over_the_same_money(self, old_database, tmp_path):
        url = f'sqlite:///{old_database}'
        ensure_database_is_current(url, tmp_path / 'b')
        ensure_database_is_current(url, tmp_path / 'b')
        connection = sqlite3.connect(old_database)
        assert connection.execute(
            'SELECT small_blind FROM game_sessions'
        ).fetchone() == (10,)
        connection.close()

    def test_leaves_a_database_without_migration_history_alone(self, tmp_path):
        database = tmp_path / 'unmanaged.db'
        connection = sqlite3.connect(database)
        connection.execute('CREATE TABLE game_sessions (small_blind REAL)')
        connection.execute('INSERT INTO game_sessions VALUES (0.1)')
        connection.commit()
        connection.close()

        assert (
            ensure_database_is_current(f'sqlite:///{database}', tmp_path / 'b') is None
        )
        connection = sqlite3.connect(database)
        assert connection.execute(
            'SELECT small_blind FROM game_sessions'
        ).fetchone() == (0.1,)
        connection.close()

    @pytest.mark.parametrize('url', ['sqlite:///:memory:', 'postgresql://u@h/db'])
    def test_ignores_databases_that_are_not_files(self, url, tmp_path):
        assert ensure_database_is_current(url, tmp_path) is None

    def test_a_missing_file_is_left_for_the_migrations_to_create(self, tmp_path):
        assert (
            ensure_database_is_current(f'sqlite:///{tmp_path / "new.db"}', tmp_path)
            is None
        )
