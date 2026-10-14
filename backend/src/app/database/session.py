"""Shared database engine, session factory, and FastAPI dependency."""

import os

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.environ.get('DATABASE_URL', 'sqlite:///./poker.db')

_connection_arguments = (
    {'check_same_thread': False} if DATABASE_URL.startswith('sqlite') else {}
)

engine = create_engine(DATABASE_URL, connect_args=_connection_arguments)


def configure_sqlite(dbapi_connection, _connection_record=None) -> None:
    """Settings that keep SQLite dependable with several phones writing.

    - WAL lets readers carry on while a write is in progress, instead of
      polls and actions colliding with "database is locked".
    - busy_timeout makes a second writer wait briefly rather than fail.
    - synchronous=NORMAL is the durable setting recommended with WAL: a
      committed hand survives an application crash.
    """
    cursor = dbapi_connection.cursor()
    try:
        cursor.execute('PRAGMA journal_mode=WAL')
        cursor.execute('PRAGMA synchronous=NORMAL')
        cursor.execute('PRAGMA busy_timeout=5000')
    finally:
        cursor.close()


if DATABASE_URL.startswith('sqlite') and ':memory:' not in DATABASE_URL:
    event.listen(engine, 'connect', configure_sqlite)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
