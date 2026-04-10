import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, StaticPool
from sqlalchemy.orm import sessionmaker

from app.database.models import Base
from app.database.session import get_db
from app.main import app

DATABASE_URL = 'sqlite:///:memory:'  # In-memory database for testing
engine = create_engine(
    DATABASE_URL, connect_args={'check_same_thread': False}, poolclass=StaticPool
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(scope='function', autouse=True)
def setup_and_teardown_db():
    """Automatically creates and drops tables for each test."""
    Base.metadata.create_all(bind=engine)  # Setup database tables
    yield  # Run the test
    Base.metadata.drop_all(bind=engine)  # Cleanup after the test


@pytest.fixture
def client():
    """Provides a test client for FastAPI with overridden database."""
    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()
