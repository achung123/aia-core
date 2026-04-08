"""Tests for T-042: Detection Correction feedback storage.

Covers:
- DetectionCorrection model existence and schema
- Corrections stored when confirmed value != detected value
- No correction stored when confirmed value matches detected value
- GET /images/corrections returns correction history
- Full pipeline: upload -> detect -> confirm with corrections -> verify corrections
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, StaticPool
from sqlalchemy.orm import sessionmaker

from app.database.database_models import Base as LegacyBase
from app.database.models import (
    Base as ModelsBase,
    CardDetection,
    DetectionCorrection,
    ImageUpload,
)
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
    """Create a game session with two players and return the game_id."""
    response = client.post(
        '/games',
        json={'game_date': '2026-03-11', 'player_names': ['Alice', 'Bob']},
    )
    assert response.status_code == 201
    return response.json()['game_id']


def _make_jpeg(size_bytes: int = 100) -> bytes:
    return b'\xff\xd8\xff\xe0' + b'\x00' * (size_bytes - 4)


def _seed_detections(upload_id: int):
    """Insert deterministic CardDetection rows for an upload.

    Positions and values matching MockCardDetector format:
        community_1=AS, community_2=KH, community_3=QD,
        community_4=JC, community_5=10S, hole_1=2H, hole_2=3D
    """
    with SessionLocal() as db:
        detections = [
            ('community_1', 'AS', 0.95),
            ('community_2', 'KH', 0.93),
            ('community_3', 'QD', 0.91),
            ('community_4', 'JC', 0.89),
            ('community_5', '10S', 0.87),
            ('hole_1', '2H', 0.85),
            ('hole_2', '3D', 0.83),
        ]
        for pos, val, conf in detections:
            db.add(
                CardDetection(
                    upload_id=upload_id,
                    card_position=pos,
                    detected_value=val,
                    confidence=conf,
                )
            )
        # Set upload status to 'detected' so confirm endpoint accepts it
        upload = (
            db.query(ImageUpload).filter(ImageUpload.upload_id == upload_id).first()
        )
        upload.status = 'detected'
        db.commit()


def _upload_image(client, game_id):
    """Upload an image and return the upload_id (status will be 'processing')."""
    resp = client.post(
        f'/games/{game_id}/hands/image',
        files={'file': ('hand.jpg', _make_jpeg(), 'image/jpeg')},
    )
    assert resp.status_code == 201
    return resp.json()['upload_id']


def _confirm_matching_payload():
    """Payload where confirmed values exactly match _seed_detections values."""
    return {
        'community_cards': {
            'flop_1': {'rank': 'A', 'suit': 'S'},
            'flop_2': {'rank': 'K', 'suit': 'H'},
            'flop_3': {'rank': 'Q', 'suit': 'D'},
            'turn': {'rank': 'J', 'suit': 'C'},
            'river': {'rank': '10', 'suit': 'S'},
        },
        'player_hands': [
            {
                'player_name': 'Alice',
                'card_1': {'rank': '2', 'suit': 'H'},
                'card_2': {'rank': '3', 'suit': 'D'},
            },
        ],
    }


def _confirm_different_payload():
    """Payload where some confirmed values differ from _seed_detections values.

    Changes from seeded detections:
        community_1: AS -> 9S  (corrected)
        community_2: KH -> KH  (unchanged)
        community_3: QD -> QD  (unchanged)
        community_4: JC -> JC  (unchanged)
        community_5: 10S -> 10S (unchanged)
        hole_1 (Alice card_1): 2H -> 7H (corrected)
        hole_2 (Alice card_2): 3D -> 3D (unchanged)
    """
    return {
        'community_cards': {
            'flop_1': {'rank': '9', 'suit': 'S'},  # was AS
            'flop_2': {'rank': 'K', 'suit': 'H'},
            'flop_3': {'rank': 'Q', 'suit': 'D'},
            'turn': {'rank': 'J', 'suit': 'C'},
            'river': {'rank': '10', 'suit': 'S'},
        },
        'player_hands': [
            {
                'player_name': 'Alice',
                'card_1': {'rank': '7', 'suit': 'H'},  # was 2H
                'card_2': {'rank': '3', 'suit': 'D'},
            },
        ],
    }


# ── Model: DetectionCorrection schema ──────────────────────────────────


class TestDetectionCorrectionModel:
    """DetectionCorrection model has the right columns and constraints."""

    def test_model_has_correction_id_column(self):
        assert hasattr(DetectionCorrection, 'correction_id')

    def test_model_has_upload_id_column(self):
        assert hasattr(DetectionCorrection, 'upload_id')

    def test_model_has_card_position_column(self):
        assert hasattr(DetectionCorrection, 'card_position')

    def test_model_has_detected_value_column(self):
        assert hasattr(DetectionCorrection, 'detected_value')

    def test_model_has_corrected_value_column(self):
        assert hasattr(DetectionCorrection, 'corrected_value')

    def test_model_has_created_at_column(self):
        assert hasattr(DetectionCorrection, 'created_at')

    def test_correction_id_is_primary_key(self):
        col = DetectionCorrection.__table__.columns['correction_id']
        assert col.primary_key is True

    def test_upload_id_is_not_nullable(self):
        col = DetectionCorrection.__table__.columns['upload_id']
        assert col.nullable is False

    def test_upload_id_has_fk_to_image_uploads(self):
        col = DetectionCorrection.__table__.columns['upload_id']
        fk_targets = [fk.target_fullname for fk in col.foreign_keys]
        assert 'image_uploads.upload_id' in fk_targets

    def test_card_position_not_nullable(self):
        col = DetectionCorrection.__table__.columns['card_position']
        assert col.nullable is False

    def test_detected_value_not_nullable(self):
        col = DetectionCorrection.__table__.columns['detected_value']
        assert col.nullable is False

    def test_corrected_value_not_nullable(self):
        col = DetectionCorrection.__table__.columns['corrected_value']
        assert col.nullable is False


# ── Corrections stored on mismatch ─────────────────────────────────────


class TestCorrectionsStoredOnMismatch:
    """When confirmed cards differ from detected cards, corrections are stored."""

    def test_corrections_created_when_values_differ(self, client, game_id):
        upload_id = _upload_image(client, game_id)
        _seed_detections(upload_id)
        resp = client.post(
            f'/games/{game_id}/hands/image/{upload_id}/confirm',
            json=_confirm_different_payload(),
        )
        assert resp.status_code == 201
        with SessionLocal() as db:
            corrections = (
                db.query(DetectionCorrection)
                .filter(DetectionCorrection.upload_id == upload_id)
                .all()
            )
            assert len(corrections) == 2

    def test_correction_has_correct_detected_value(self, client, game_id):
        upload_id = _upload_image(client, game_id)
        _seed_detections(upload_id)
        client.post(
            f'/games/{game_id}/hands/image/{upload_id}/confirm',
            json=_confirm_different_payload(),
        )
        with SessionLocal() as db:
            correction = (
                db.query(DetectionCorrection)
                .filter(
                    DetectionCorrection.upload_id == upload_id,
                    DetectionCorrection.card_position == 'community_1',
                )
                .first()
            )
            assert correction is not None
            assert correction.detected_value == 'AS'

    def test_correction_has_correct_corrected_value(self, client, game_id):
        upload_id = _upload_image(client, game_id)
        _seed_detections(upload_id)
        client.post(
            f'/games/{game_id}/hands/image/{upload_id}/confirm',
            json=_confirm_different_payload(),
        )
        with SessionLocal() as db:
            correction = (
                db.query(DetectionCorrection)
                .filter(
                    DetectionCorrection.upload_id == upload_id,
                    DetectionCorrection.card_position == 'community_1',
                )
                .first()
            )
            assert correction.corrected_value == '9S'

    def test_hole_card_correction_stored(self, client, game_id):
        upload_id = _upload_image(client, game_id)
        _seed_detections(upload_id)
        client.post(
            f'/games/{game_id}/hands/image/{upload_id}/confirm',
            json=_confirm_different_payload(),
        )
        with SessionLocal() as db:
            correction = (
                db.query(DetectionCorrection)
                .filter(
                    DetectionCorrection.upload_id == upload_id,
                    DetectionCorrection.card_position == 'hole_1',
                )
                .first()
            )
            assert correction is not None
            assert correction.detected_value == '2H'
            assert correction.corrected_value == '7H'

    def test_correction_has_created_at(self, client, game_id):
        upload_id = _upload_image(client, game_id)
        _seed_detections(upload_id)
        client.post(
            f'/games/{game_id}/hands/image/{upload_id}/confirm',
            json=_confirm_different_payload(),
        )
        with SessionLocal() as db:
            correction = (
                db.query(DetectionCorrection)
                .filter(DetectionCorrection.upload_id == upload_id)
                .first()
            )
            assert correction.created_at is not None


# ── No corrections when values match ───────────────────────────────────


class TestNoCorrectionsOnMatch:
    """When confirmed values match detected values, no corrections are stored."""

    def test_no_corrections_when_all_match(self, client, game_id):
        upload_id = _upload_image(client, game_id)
        _seed_detections(upload_id)
        resp = client.post(
            f'/games/{game_id}/hands/image/{upload_id}/confirm',
            json=_confirm_matching_payload(),
        )
        assert resp.status_code == 201
        with SessionLocal() as db:
            corrections = (
                db.query(DetectionCorrection)
                .filter(DetectionCorrection.upload_id == upload_id)
                .all()
            )
            assert len(corrections) == 0


# ── GET /images/corrections endpoint ───────────────────────────────────


class TestGetCorrections:
    """GET /images/corrections returns full correction history."""

    def test_empty_corrections_list(self, client):
        resp = client.get('/images/corrections')
        assert resp.status_code == 200
        assert resp.json() == []

    def test_corrections_returned_after_confirm(self, client, game_id):
        upload_id = _upload_image(client, game_id)
        _seed_detections(upload_id)
        client.post(
            f'/games/{game_id}/hands/image/{upload_id}/confirm',
            json=_confirm_different_payload(),
        )
        resp = client.get('/images/corrections')
        assert resp.status_code == 200
        corrections = resp.json()
        assert len(corrections) == 2

    def test_correction_response_has_required_fields(self, client, game_id):
        upload_id = _upload_image(client, game_id)
        _seed_detections(upload_id)
        client.post(
            f'/games/{game_id}/hands/image/{upload_id}/confirm',
            json=_confirm_different_payload(),
        )
        resp = client.get('/images/corrections')
        corrections = resp.json()
        entry = corrections[0]
        assert 'correction_id' in entry
        assert 'upload_id' in entry
        assert 'card_position' in entry
        assert 'detected_value' in entry
        assert 'corrected_value' in entry
        assert 'created_at' in entry

    def test_corrections_from_multiple_uploads(self, client, game_id):
        """Corrections from two separate uploads both appear."""
        # First upload + confirm with corrections
        upload_id_1 = _upload_image(client, game_id)
        _seed_detections(upload_id_1)
        client.post(
            f'/games/{game_id}/hands/image/{upload_id_1}/confirm',
            json=_confirm_different_payload(),
        )
        # Second upload + confirm with different corrections
        upload_id_2 = _upload_image(client, game_id)
        # Re-seed detections for second upload with different values
        with SessionLocal() as db:
            db.add(
                CardDetection(
                    upload_id=upload_id_2,
                    card_position='community_1',
                    detected_value='5C',
                    confidence=0.90,
                )
            )
            db.add(
                CardDetection(
                    upload_id=upload_id_2,
                    card_position='community_2',
                    detected_value='6D',
                    confidence=0.88,
                )
            )
            db.add(
                CardDetection(
                    upload_id=upload_id_2,
                    card_position='community_3',
                    detected_value='8S',
                    confidence=0.86,
                )
            )
            upload = (
                db.query(ImageUpload)
                .filter(ImageUpload.upload_id == upload_id_2)
                .first()
            )
            upload.status = 'detected'
            db.commit()
        payload2 = {
            'community_cards': {
                'flop_1': {'rank': '4', 'suit': 'C'},  # was 5C -> correction
                'flop_2': {'rank': '6', 'suit': 'D'},  # matches
                'flop_3': {'rank': '8', 'suit': 'S'},  # matches
            },
            'player_hands': [
                {
                    'player_name': 'Bob',
                    'card_1': {'rank': '2', 'suit': 'C'},
                    'card_2': {'rank': 'A', 'suit': 'D'},
                },
            ],
        }
        resp2 = client.post(
            f'/games/{game_id}/hands/image/{upload_id_2}/confirm',
            json=payload2,
        )
        assert resp2.status_code == 201
        resp = client.get('/images/corrections')
        corrections = resp.json()
        # 2 from first upload + 1 from second upload = 3
        assert len(corrections) == 3


# ── Full pipeline test ──────────────────────────────────────────────────


class TestFullPipeline:
    """Full pipeline: upload -> detect -> confirm with corrections -> verify."""

    def test_full_pipeline_upload_detect_correct_retrieve(self, client, game_id):
        # 1. Upload image
        upload_id = _upload_image(client, game_id)

        # 2. Seed deterministic detections (simulating detection step)
        _seed_detections(upload_id)

        # 3. Confirm with corrections (community_1 and hole_1 changed)
        payload = _confirm_different_payload()
        resp = client.post(
            f'/games/{game_id}/hands/image/{upload_id}/confirm',
            json=payload,
        )
        assert resp.status_code == 201
        hand_data = resp.json()
        assert hand_data['flop_1'] == '9S'  # corrected from AS

        # 4. Verify corrections stored
        with SessionLocal() as db:
            corrections = (
                db.query(DetectionCorrection)
                .filter(DetectionCorrection.upload_id == upload_id)
                .order_by(DetectionCorrection.card_position)
                .all()
            )
            assert len(corrections) == 2
            community_corr = next(
                c for c in corrections if c.card_position == 'community_1'
            )
            assert community_corr.detected_value == 'AS'
            assert community_corr.corrected_value == '9S'
            hole_corr = next(c for c in corrections if c.card_position == 'hole_1')
            assert hole_corr.detected_value == '2H'
            assert hole_corr.corrected_value == '7H'

        # 5. Retrieve corrections via API
        resp = client.get('/images/corrections')
        assert resp.status_code == 200
        api_corrections = resp.json()
        assert len(api_corrections) == 2
        positions = {c['card_position'] for c in api_corrections}
        assert positions == {'community_1', 'hole_1'}
