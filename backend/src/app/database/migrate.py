"""Bring the database up to the schema this code expects, before serving.

Some migrations change how stored values are interpreted (money moved from
float dollars to integer cents). New code against an old database would not
fail — it would read 0.30 as $0.003. So the app checks at startup, takes a
backup of the file first, and migrates, rather than relying on someone
remembering a flag.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from pathlib import Path

from alembic import command
from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine

from app.services.backup import database_file_from_url, take_backup

logger = logging.getLogger('app.migrate')

_BACKEND_ROOT = Path(__file__).resolve().parents[3]


def _alembic_config(database_url: str, root: Path) -> Config:
    config = Config(str(root / 'alembic.ini'))
    config.set_main_option('script_location', str(root / 'alembic'))
    config.set_main_option('sqlalchemy.url', database_url)
    return config


def ensure_database_is_current(
    database_url: str,
    backup_dir: Path | None = None,
    root: Path = _BACKEND_ROOT,
) -> str | None:
    """Migrate a SQLite file to head if it is behind. Returns the new revision.

    Returns None when nothing was done: not a SQLite file, no file yet (the
    migrations create it), not managed by Alembic, or already current.
    """
    source = database_file_from_url(database_url)
    if source is None or not source.exists():
        return None
    if not (root / 'alembic.ini').exists():
        logger.warning('No alembic.ini under %s; not checking the schema', root)
        return None

    config = _alembic_config(database_url, root)
    head = ScriptDirectory.from_config(config).get_current_head()

    engine = create_engine(database_url)
    try:
        with engine.connect() as connection:
            current = MigrationContext.configure(connection).get_current_revision()
    finally:
        engine.dispose()

    if current is None:
        logger.warning(
            '%s has no migration history; leaving its schema alone', source.name
        )
        return None
    if current == head:
        return None

    stamp = datetime.now(timezone.utc)
    safety_dir = backup_dir or source.parent
    try:
        copy = take_backup(source, safety_dir, stamp)
        logger.warning(
            'Database is at %s, code expects %s. Backed up to %s, migrating.',
            current,
            head,
            copy,
        )
    except Exception:  # noqa: BLE001
        # Without a safe copy do not touch the data; refuse to start instead
        # of risking a half-applied migration with nothing to go back to.
        logger.exception('Could not back up the database before migrating')
        raise

    command.upgrade(config, 'head')
    logger.warning('Database migrated to %s', head)
    return head
