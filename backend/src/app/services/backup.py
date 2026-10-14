"""Rolling online backups of the SQLite database.

A game night's data is one file. These backups are taken while the app is
running — SQLite's online backup copies a consistent snapshot even with
writers active — so nobody has to stop the stack to be safe.

Policy: a snapshot every interval, skipped when nothing has changed, keeping
the most recent N plus the last snapshot of each of the last D days.
"""

from __future__ import annotations

import logging
import os
import re
import sqlite3
import threading
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

logger = logging.getLogger('app.backup')

BACKUP_PREFIX = 'poker-'
_BACKUP_NAME = re.compile(r'^poker-(\d{8})-(\d{6})\.db$')

DEFAULT_INTERVAL_SECONDS = 3600
DEFAULT_KEEP_RECENT = 48
DEFAULT_KEEP_DAILY = 14
# Let startup, migrations and the first requests settle before the first copy
STARTUP_DELAY_SECONDS = 60


def database_file_from_url(url: str) -> Path | None:
    """The file behind a SQLite URL, or None for memory and other databases."""
    match = re.match(r'^sqlite:///(.+)$', url)
    if match is None:
        return None
    target = match.group(1)
    if target == ':memory:' or target.startswith(':memory:'):
        return None
    return Path(target)


def take_backup(source: Path, destination_dir: Path, now: datetime) -> Path:
    """Copy `source` into `destination_dir` and check the copy is sound."""
    if not source.exists():
        raise FileNotFoundError(f'Database not found: {source}')
    destination_dir.mkdir(parents=True, exist_ok=True)
    name = f'{BACKUP_PREFIX}{now:%Y%m%d-%H%M%S}.db'
    final = destination_dir / name
    partial = destination_dir / f'{name}.partial'
    partial.unlink(missing_ok=True)

    source_connection = sqlite3.connect(f'file:{source}?mode=ro', uri=True, timeout=10)
    try:
        target_connection = sqlite3.connect(partial)
        try:
            source_connection.backup(target_connection)
            verdict = target_connection.execute('PRAGMA integrity_check').fetchone()[0]
        finally:
            target_connection.close()
    except Exception:
        partial.unlink(missing_ok=True)
        raise
    finally:
        source_connection.close()

    if verdict != 'ok':
        partial.unlink(missing_ok=True)
        raise RuntimeError(f'Backup failed its integrity check: {verdict}')
    os.replace(partial, final)
    return final


def _backup_moment(path: Path) -> datetime | None:
    match = _BACKUP_NAME.match(path.name)
    if match is None:
        return None
    return datetime.strptime(match.group(1) + match.group(2), '%Y%m%d%H%M%S')


def prune_backups(
    destination_dir: Path,
    keep_recent: int = DEFAULT_KEEP_RECENT,
    keep_daily: int = DEFAULT_KEEP_DAILY,
) -> list[Path]:
    """Delete old backups; returns what was removed. Other files are left alone."""
    dated = [
        (moment, path)
        for path in destination_dir.glob(f'{BACKUP_PREFIX}*.db')
        if (moment := _backup_moment(path)) is not None
    ]
    dated.sort(key=lambda item: item[0], reverse=True)

    keep: set[Path] = {path for _moment, path in dated[: max(keep_recent, 0)]}
    seen_days: list = []
    for moment, path in dated:
        day = moment.date()
        if day in seen_days:
            continue
        if len(seen_days) >= keep_daily:
            break
        seen_days.append(day)
        keep.add(path)  # newest backup of that day (list is newest-first)

    removed = []
    for _moment, path in dated:
        if path not in keep:
            path.unlink(missing_ok=True)
            removed.append(path)
    return removed


@dataclass
class BackupState:
    """What the database looked like at the last backup."""

    signature: tuple | None = None


def _signature(source: Path) -> tuple:
    parts = []
    for candidate in (source, source.with_name(source.name + '-wal')):
        try:
            stat = candidate.stat()
        except FileNotFoundError:
            parts.append(None)
            continue
        # Merely opening a WAL database creates an empty log file; that is
        # not a change to the data.
        if candidate is not source and stat.st_size == 0:
            parts.append(None)
            continue
        parts.append((stat.st_mtime_ns, stat.st_size))
    return tuple(parts)


def run_backup_cycle(
    source: Path,
    destination_dir: Path,
    state: BackupState,
    now: datetime | None = None,
    keep_recent: int = DEFAULT_KEEP_RECENT,
    keep_daily: int = DEFAULT_KEEP_DAILY,
) -> Path | None:
    """One round: back up if the database changed, then prune. None if skipped."""
    if not source.exists():
        return None
    signature = _signature(source)
    if signature == state.signature:
        return None
    moment = now or datetime.now(timezone.utc)
    result = take_backup(source, destination_dir, moment)
    state.signature = signature
    prune_backups(destination_dir, keep_recent, keep_daily)
    return result


def start_backup_thread(
    source: Path,
    destination_dir: Path,
    interval_seconds: float = DEFAULT_INTERVAL_SECONDS,
    startup_delay_seconds: float = STARTUP_DELAY_SECONDS,
    keep_recent: int = DEFAULT_KEEP_RECENT,
    keep_daily: int = DEFAULT_KEEP_DAILY,
) -> threading.Event:
    """Run backups in the background until the returned event is set."""
    stop = threading.Event()
    state = BackupState()

    def loop() -> None:
        if stop.wait(startup_delay_seconds):
            return
        while not stop.is_set():
            try:
                result = run_backup_cycle(
                    source,
                    destination_dir,
                    state,
                    keep_recent=keep_recent,
                    keep_daily=keep_daily,
                )
                if result is not None:
                    logger.info('Database backup written: %s', result.name)
            except Exception:  # noqa: BLE001 - one bad round must not end backups
                logger.exception('Database backup failed; will retry')
            stop.wait(interval_seconds)

    threading.Thread(target=loop, name='db-backup', daemon=True).start()
    return stop
