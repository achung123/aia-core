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


@pytest.fixture
def db_session():
    """Provides a raw SQLAlchemy session bound to the same in-memory engine."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Default card pool for activating hands (must be unique per player)
_DEFAULT_CARDS = [
    ('Ah', 'Kd'),
    ('2c', '3c'),
    ('4s', '5s'),
    ('6h', '7d'),
    ('8c', '9c'),
    ('Ts', 'Jh'),
    ('Qd', '2s'),
    ('3h', '4d'),
]


def activate_hand(
    client_: TestClient, game_id: int, hand_json: dict, names: list[str] | None = None
):
    """Capture cards for all players so the hand transitions from awaiting_cards to preflop.

    Call this after start_hand to mimic all players submitting their hole cards.
    """
    hn = hand_json['hand_number']
    if names is None:
        # Derive names from the hand's player_hands
        phs = hand_json.get('player_hands', [])
        names = [ph['player_name'] for ph in phs]
    for i, name in enumerate(names):
        c1, c2 = _DEFAULT_CARDS[i % len(_DEFAULT_CARDS)]
        resp = client_.patch(
            f'/games/{game_id}/hands/{hn}/players/{name}',
            json={'card_1': c1, 'card_2': c2},
        )
        assert resp.status_code == 200, (
            f'Failed to capture cards for {name}: {resp.text}'
        )
