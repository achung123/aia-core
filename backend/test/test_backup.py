"""Rolling online backups of the SQLite database."""

import sqlite3
import threading
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

from app.services import backup


def make_database(path: Path, rows: int = 3, wal: bool = True) -> None:
    connection = sqlite3.connect(path)
    if wal:
        connection.execute('PRAGMA journal_mode=WAL')
    connection.execute(
        'CREATE TABLE IF NOT EXISTS hands (id INTEGER PRIMARY KEY, note TEXT)'
    )
    for index in range(rows):
        connection.execute('INSERT INTO hands (note) VALUES (?)', (f'hand {index}',))
    connection.commit()
    connection.close()


def read_notes(path: Path) -> list[str]:
    connection = sqlite3.connect(path)
    try:
        return [
            row[0] for row in connection.execute('SELECT note FROM hands ORDER BY id')
        ]
    finally:
        connection.close()


NOW = datetime(2026, 10, 14, 21, 30, 0, tzinfo=timezone.utc)


class TestDatabaseFileFromUrl:
    @pytest.mark.parametrize(
        ('url', 'expected'),
        [
            ('sqlite:////app/data/poker.db', Path('/app/data/poker.db')),
            ('sqlite:///./poker.db', Path('./poker.db')),
            ('sqlite:///relative.db', Path('relative.db')),
            ('sqlite:///:memory:', None),
            ('sqlite://', None),
            ('postgresql://user@host/db', None),
        ],
    )
    def test_extracts_the_file_or_nothing(self, url, expected):
        assert backup.database_file_from_url(url) == expected


class TestTakeBackup:
    def test_copies_every_row_into_a_valid_database(self, tmp_path):
        source = tmp_path / 'poker.db'
        make_database(source, rows=5)
        destination = tmp_path / 'backups'

        result = backup.take_backup(source, destination, NOW)

        assert result.parent == destination
        assert result.name == 'poker-20261014-213000.db'
        assert read_notes(result) == [f'hand {i}' for i in range(5)]

    def test_captures_changes_still_sitting_in_the_write_ahead_log(self, tmp_path):
        source = tmp_path / 'poker.db'
        make_database(source, rows=1)
        # An open connection with an uncheckpointed committed write
        writer = sqlite3.connect(source)
        writer.execute("INSERT INTO hands (note) VALUES ('latest')")
        writer.commit()
        try:
            result = backup.take_backup(source, tmp_path / 'backups', NOW)
            assert read_notes(result) == ['hand 0', 'latest']
        finally:
            writer.close()

    def test_a_backup_is_taken_while_the_database_is_being_written(self, tmp_path):
        source = tmp_path / 'poker.db'
        make_database(source, rows=1)
        stop = threading.Event()

        def write_forever():
            connection = sqlite3.connect(source, timeout=5)
            while not stop.is_set():
                connection.execute("INSERT INTO hands (note) VALUES ('x')")
                connection.commit()
            connection.close()

        writer = threading.Thread(target=write_forever)
        writer.start()
        try:
            result = backup.take_backup(source, tmp_path / 'backups', NOW)
        finally:
            stop.set()
            writer.join()
        connection = sqlite3.connect(result)
        try:
            assert connection.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
        finally:
            connection.close()

    def test_leaves_no_partial_file_behind_on_failure(self, tmp_path):
        source = tmp_path / 'missing.db'
        destination = tmp_path / 'backups'
        with pytest.raises(FileNotFoundError):
            backup.take_backup(source, destination, NOW)
        assert not list(destination.glob('*')) if destination.exists() else True

    def test_does_not_modify_the_source(self, tmp_path):
        source = tmp_path / 'poker.db'
        make_database(source, rows=2)
        before = read_notes(source)
        backup.take_backup(source, tmp_path / 'backups', NOW)
        assert read_notes(source) == before


class TestPrune:
    def make_files(self, folder: Path, moments: list[datetime]) -> None:
        folder.mkdir(parents=True, exist_ok=True)
        for moment in moments:
            (folder / f'poker-{moment:%Y%m%d-%H%M%S}.db').write_bytes(b'x')

    def names(self, folder: Path) -> list[str]:
        return sorted(path.name for path in folder.glob('poker-*.db'))

    def test_keeps_the_most_recent_ones(self, tmp_path):
        moments = [NOW - timedelta(hours=hour) for hour in range(10)]
        self.make_files(tmp_path, moments)
        removed = backup.prune_backups(tmp_path, keep_recent=4, keep_daily=0)
        assert len(removed) == 6
        assert self.names(tmp_path) == sorted(
            f'poker-{m:%Y%m%d-%H%M%S}.db' for m in moments[:4]
        )

    def test_also_keeps_the_last_backup_of_each_recent_day(self, tmp_path):
        moments = [
            NOW,
            NOW - timedelta(hours=1),
            NOW - timedelta(days=1, hours=2),
            NOW - timedelta(days=1, hours=3),
            NOW - timedelta(days=2, hours=1),
            NOW - timedelta(days=40),
        ]
        self.make_files(tmp_path, moments)
        backup.prune_backups(tmp_path, keep_recent=1, keep_daily=3)
        kept = self.names(tmp_path)
        # newest overall, plus the newest of each of the last three days
        assert f'poker-{moments[0]:%Y%m%d-%H%M%S}.db' in kept
        assert f'poker-{moments[2]:%Y%m%d-%H%M%S}.db' in kept
        assert f'poker-{moments[4]:%Y%m%d-%H%M%S}.db' in kept
        assert f'poker-{moments[1]:%Y%m%d-%H%M%S}.db' not in kept
        assert f'poker-{moments[3]:%Y%m%d-%H%M%S}.db' not in kept
        assert f'poker-{moments[5]:%Y%m%d-%H%M%S}.db' not in kept

    def test_never_touches_files_that_are_not_backups(self, tmp_path):
        self.make_files(tmp_path, [NOW - timedelta(hours=h) for h in range(5)])
        (tmp_path / 'notes.txt').write_text('keep me')
        (tmp_path / 'poker.db').write_bytes(b'live?')
        backup.prune_backups(tmp_path, keep_recent=1, keep_daily=0)
        assert (tmp_path / 'notes.txt').exists()
        assert (tmp_path / 'poker.db').exists()


class TestBackupCycle:
    def test_skips_when_nothing_changed_since_the_last_backup(self, tmp_path):
        source = tmp_path / 'poker.db'
        make_database(source)
        destination = tmp_path / 'backups'
        state = backup.BackupState()

        first = backup.run_backup_cycle(source, destination, state, now=NOW)
        second = backup.run_backup_cycle(
            source, destination, state, now=NOW + timedelta(hours=1)
        )

        assert first is not None
        assert second is None
        assert len(list(destination.glob('poker-*.db'))) == 1

    def test_backs_up_again_after_a_change(self, tmp_path):
        source = tmp_path / 'poker.db'
        make_database(source)
        destination = tmp_path / 'backups'
        state = backup.BackupState()
        backup.run_backup_cycle(source, destination, state, now=NOW)

        connection = sqlite3.connect(source)
        connection.execute("INSERT INTO hands (note) VALUES ('new')")
        connection.commit()
        connection.close()

        result = backup.run_backup_cycle(
            source, destination, state, now=NOW + timedelta(hours=1)
        )
        assert result is not None
        assert 'new' in read_notes(result)

    def test_a_missing_database_is_not_an_error(self, tmp_path):
        state = backup.BackupState()
        assert (
            backup.run_backup_cycle(
                tmp_path / 'nope.db', tmp_path / 'b', state, now=NOW
            )
            is None
        )

    def test_prunes_after_each_backup(self, tmp_path):
        source = tmp_path / 'poker.db'
        make_database(source)
        destination = tmp_path / 'backups'
        destination.mkdir()
        for hour in range(1, 8):
            moment = NOW - timedelta(hours=hour)
            (destination / f'poker-{moment:%Y%m%d-%H%M%S}.db').write_bytes(b'x')
        backup.run_backup_cycle(
            source,
            destination,
            backup.BackupState(),
            now=NOW,
            keep_recent=3,
            keep_daily=0,
        )
        assert len(list(destination.glob('poker-*.db'))) == 3


class TestStartedFromTheApp:
    def test_does_nothing_unless_a_folder_is_configured(self, monkeypatch):
        from app.main import _start_backups

        monkeypatch.delenv('AIA_BACKUP_DIR', raising=False)
        assert _start_backups() is None

    def test_does_nothing_for_an_in_memory_database(self, monkeypatch, tmp_path):
        from app.main import _start_backups

        monkeypatch.setenv('AIA_BACKUP_DIR', str(tmp_path / 'backups'))
        monkeypatch.setattr('app.database.session.DATABASE_URL', 'sqlite:///:memory:')
        assert _start_backups() is None

    def test_writes_a_backup_in_the_background_and_stops_when_told(
        self, monkeypatch, tmp_path
    ):
        import time

        from app.main import _start_backups

        source = tmp_path / 'poker.db'
        make_database(source, rows=2)
        destination = tmp_path / 'backups'
        monkeypatch.setenv('AIA_BACKUP_DIR', str(destination))
        monkeypatch.setenv('AIA_BACKUP_STARTUP_DELAY_SECONDS', '0')
        monkeypatch.setenv('AIA_BACKUP_INTERVAL_SECONDS', '3600')
        monkeypatch.setattr('app.database.session.DATABASE_URL', f'sqlite:///{source}')

        stop = _start_backups()
        try:
            assert stop is not None
            deadline = time.time() + 5
            while time.time() < deadline and not list(destination.glob('poker-*.db')):
                time.sleep(0.05)
            written = list(destination.glob('poker-*.db'))
            assert len(written) == 1
            assert read_notes(written[0]) == ['hand 0', 'hand 1']
        finally:
            if stop is not None:
                stop.set()
