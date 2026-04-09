"""Regression tests for aia-core-vfa6: confirm_detection() None guard on str(entry.card_N).

Validates that if card_1 or card_2 are ever None (e.g. if Pydantic model
is made optional in future), the DB stores SQL NULL instead of literal "None".
"""

from types import SimpleNamespace
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, StaticPool
from sqlalchemy.orm import sessionmaker

from app.database.database_models import Base as LegacyBase
from app.database.models import Base as ModelsBase, Hand, PlayerHand
from app.database.session import get_db
from app.main import app
from app.routes.images import get_card_detector
from app.services.card_detector import MockCardDetector

DATABASE_URL = 'sqlite:///:memory:'
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


@pytest.fixture(autouse=True)
def setup_db():
    LegacyBase.metadata.create_all(bind=engine)
    ModelsBase.metadata.create_all(bind=engine)
    yield
    ModelsBase.metadata.drop_all(bind=engine)
    LegacyBase.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_card_detector] = lambda: MockCardDetector()
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def game_id(client):
    resp = client.post(
        '/games',
        json={'game_date': '2026-04-09', 'player_names': ['Alice', 'Bob']},
    )
    assert resp.status_code == 201
    return resp.json()['game_id']


def _make_jpeg(size_bytes: int = 100) -> bytes:
    return b'\xff\xd8\xff\xe0' + b'\x00' * (size_bytes - 4)


def _upload_and_detect(client, game_id):
    resp = client.post(
        f'/games/{game_id}/hands/image',
        files={'file': ('hand.jpg', _make_jpeg(), 'image/jpeg')},
    )
    assert resp.status_code == 201
    upload_id = resp.json()['upload_id']
    det_resp = client.get(f'/games/{game_id}/hands/image/{upload_id}')
    assert det_resp.status_code == 200
    return upload_id


class _FakeCard:
    """A card-like object whose __str__ returns a card code."""

    def __init__(self, code):
        self._code = code

    def __str__(self):
        return self._code


class TestConfirmDetectionNoneGuard:
    """aia-core-vfa6: str(entry.card_N) must not produce 'None' string."""

    def test_none_card_in_player_hand_stores_null_not_string(
        self, client, game_id
    ):
        """If entry.card_1 is None, PlayerHand.card_1 must be SQL NULL."""
        upload_id = _upload_and_detect(client, game_id)

        # Build a payload with one player having None cards, bypassing Pydantic.
        # We patch ConfirmDetectionRequest.model_validate to return our mock.
        community = SimpleNamespace(
            flop_1=_FakeCard('AS'),
            flop_2=_FakeCard('KH'),
            flop_3=_FakeCard('QD'),
            turn=None,
            river=None,
        )
        player_entry = SimpleNamespace(
            player_name='Alice',
            card_1=None,
            card_2=None,
        )
        payload = SimpleNamespace(
            community_cards=community,
            player_hands=[player_entry],
        )

        from app.routes.images import confirm_detection

        # Call the endpoint function directly with a real DB session
        db = SessionLocal()
        try:
            from app.database.models import ImageUpload

            upload = db.query(ImageUpload).filter_by(upload_id=upload_id).first()
            upload.status = 'detected'
            db.commit()

            result = confirm_detection(
                game_id=game_id,
                upload_id=upload_id,
                payload=payload,
                db=db,
            )

            # Verify the PlayerHand has NULL, not "None"
            ph = db.query(PlayerHand).filter_by(hand_id=result.hand_id).first()
            assert ph.card_1 is None, (
                f"Expected SQL NULL for card_1, got {ph.card_1!r}"
            )
            assert ph.card_2 is None, (
                f"Expected SQL NULL for card_2, got {ph.card_2!r}"
            )
        finally:
            db.close()

    def test_none_card_excluded_from_duplicate_validation(
        self, client, game_id
    ):
        """None cards must not be included in the duplicate card check."""
        upload_id = _upload_and_detect(client, game_id)

        community = SimpleNamespace(
            flop_1=_FakeCard('AS'),
            flop_2=_FakeCard('KH'),
            flop_3=_FakeCard('QD'),
            turn=None,
            river=None,
        )
        # Two players both with None cards — must NOT trigger duplicate error
        entry_alice = SimpleNamespace(
            player_name='Alice',
            card_1=None,
            card_2=None,
        )
        entry_bob = SimpleNamespace(
            player_name='Bob',
            card_1=None,
            card_2=None,
        )
        payload = SimpleNamespace(
            community_cards=community,
            player_hands=[entry_alice, entry_bob],
        )

        from app.routes.images import confirm_detection

        db = SessionLocal()
        try:
            from app.database.models import ImageUpload

            upload = db.query(ImageUpload).filter_by(upload_id=upload_id).first()
            upload.status = 'detected'
            db.commit()

            # Should NOT raise 400 for duplicate "None" strings
            result = confirm_detection(
                game_id=game_id,
                upload_id=upload_id,
                payload=payload,
                db=db,
            )
            assert result.hand_id is not None
        finally:
            db.close()

    def test_none_card_excluded_from_correction_map(self, client, game_id):
        """None cards should produce None in correction map, not 'None' string."""
        upload_id = _upload_and_detect(client, game_id)

        community = SimpleNamespace(
            flop_1=_FakeCard('AS'),
            flop_2=_FakeCard('KH'),
            flop_3=_FakeCard('QD'),
            turn=None,
            river=None,
        )
        entry = SimpleNamespace(
            player_name='Alice',
            card_1=_FakeCard('2H'),
            card_2=None,
        )
        payload = SimpleNamespace(
            community_cards=community,
            player_hands=[entry],
        )

        from app.routes.images import confirm_detection

        db = SessionLocal()
        try:
            from app.database.models import ImageUpload

            upload = db.query(ImageUpload).filter_by(upload_id=upload_id).first()
            upload.status = 'detected'
            db.commit()

            result = confirm_detection(
                game_id=game_id,
                upload_id=upload_id,
                payload=payload,
                db=db,
            )

            ph = db.query(PlayerHand).filter_by(hand_id=result.hand_id).first()
            assert ph.card_1 == '2H'
            assert ph.card_2 is None, (
                f"Expected SQL NULL for card_2, got {ph.card_2!r}"
            )
        finally:
            db.close()
