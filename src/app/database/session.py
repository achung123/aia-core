"""Shared database engine, session factory, and FastAPI dependency."""

import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.environ.get('DATABASE_URL', 'sqlite:///./poker.db')

_connect_args = (
    {'check_same_thread': False} if DATABASE_URL.startswith('sqlite') else {}
)

engine = create_engine(DATABASE_URL, connect_args=_connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
