import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, StaticPool
from sqlalchemy.orm import sessionmaker

from app.database.database_models import Base, Game, Community
from app.main import app
from app.routes.game import _get_db

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
    app.dependency_overrides[_get_db] = override_get_db
    return TestClient(app)


@pytest.fixture
def game_setup():
    """Sets up a game in the database for testing."""
    with SessionLocal() as db:
        game = Game(game_date='01-10-2023', winner='', players='Adam,Matt,Zain')
        db.add(game)
        db.commit()


@pytest.fixture
def community_setup():
    """Sets up a community in the database for testing."""
    with SessionLocal() as db:
        community_flop = Community(
            game_date='01-10-2023',
            hand_number=1,
            flop_card_0='AS',
            flop_card_1='KH',
            flop_card_2='2D',
            turn_card='None',
            river_card='None',
            players='Gil,Adam,Zain,Matt',
        )
        db.add(community_flop)
        db.commit()
