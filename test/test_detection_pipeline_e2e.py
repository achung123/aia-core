"""E2E pipeline test: upload -> detect -> confirm workflow.

Uses MockCardDetector (via a deterministic variant) and exercises the full
API pipeline through FastAPI TestClient. No model or GPU required.
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
from app.services.card_detector import CardDetector
from pydantic_models.app_models import DetectionResult

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


class DeterministicMockDetector:
    """A mock detector returning fixed, known detections for E2E tests.

    Returns 7 cards covering community (5) + 2 hole cards, each with
    known bbox values so we can assert on them.  Uses normalized coordinates
    (0-1 range) consistent with PositionAssigner defaults:
    - community_y region: [0.0, 0.4]
    - hole cards: y > 0.4
    """

    def detect(self, image_path: str) -> list[DetectionResult]:
        # 5 community cards: cy in [0.0, 0.4] range, sorted left-to-right
        community = [
            ('AS', 0.10, 0.10),   # flop_1
            ('KH', 0.20, 0.10),   # flop_2
            ('QD', 0.30, 0.10),   # flop_3
            ('JC', 0.45, 0.10),   # turn
            ('10S', 0.55, 0.10),  # river
        ]
        # 2 hole cards: cy > 0.4
        hole = [
            ('2H', 0.15, 0.60),   # hole_1
            ('3D', 0.25, 0.60),   # hole_2
        ]
        cards = community + hole
        return [
            DetectionResult(
                detected_value=card,
                confidence=0.95,
                bbox_x=bx,
                bbox_y=by,
                bbox_width=0.05,
                bbox_height=0.07,
            )
            for card, bx, by in cards
        ]


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
    app.dependency_overrides[get_card_detector] = lambda: DeterministicMockDetector()
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def game_id(client):
    """Create a game session with two players."""
    response = client.post(
        '/games',
        json={'game_date': '2026-03-11', 'player_names': ['Alice', 'Bob']},
    )
    assert response.status_code == 201
    return response.json()['game_id']


def _make_jpeg(size_bytes: int = 100) -> bytes:
    return b'\xff\xd8\xff\xe0' + b'\x00' * (size_bytes - 4)


# ── Upload Phase ────────────────────────────────────────────────────────


class TestE2EUploadPhase:
    """Step 1: Upload an image via the API."""

    def test_upload_returns_201(self, client, game_id):
        resp = client.post(
            f'/games/{game_id}/hands/image',
            files={'file': ('hand.jpg', _make_jpeg(), 'image/jpeg')},
        )
        assert resp.status_code == 201

    def test_upload_returns_processing_status(self, client, game_id):
        resp = client.post(
            f'/games/{game_id}/hands/image',
            files={'file': ('hand.jpg', _make_jpeg(), 'image/jpeg')},
        )
        assert resp.json()['status'] == 'processing'


# ── Detect Phase ────────────────────────────────────────────────────────


class TestE2EDetectPhase:
    """Step 2: GET detect results triggers detection and returns enriched response."""

    def _upload(self, client, game_id):
        resp = client.post(
            f'/games/{game_id}/hands/image',
            files={'file': ('hand.jpg', _make_jpeg(), 'image/jpeg')},
        )
        return resp.json()['upload_id']

    def test_detect_returns_200(self, client, game_id):
        upload_id = self._upload(client, game_id)
        resp = client.get(f'/games/{game_id}/hands/image/{upload_id}')
        assert resp.status_code == 200

    def test_detect_returns_7_detections(self, client, game_id):
        upload_id = self._upload(client, game_id)
        resp = client.get(f'/games/{game_id}/hands/image/{upload_id}')
        assert len(resp.json()['detections']) == 7

    def test_detect_status_becomes_detected(self, client, game_id):
        upload_id = self._upload(client, game_id)
        resp = client.get(f'/games/{game_id}/hands/image/{upload_id}')
        assert resp.json()['status'] == 'detected'

    def test_detect_card_detections_have_populated_bbox(self, client, game_id):
        """AC-3: CardDetection rows have populated bbox fields."""
        upload_id = self._upload(client, game_id)
        client.get(f'/games/{game_id}/hands/image/{upload_id}')
        with SessionLocal() as db:
            detections = (
                db.query(CardDetection)
                .filter(CardDetection.upload_id == upload_id)
                .all()
            )
            assert len(detections) == 7
            for d in detections:
                assert d.bbox_x is not None and d.bbox_x > 0
                assert d.bbox_y is not None and d.bbox_y > 0
                assert d.bbox_width is not None and d.bbox_width > 0
                assert d.bbox_height is not None and d.bbox_height > 0

    def test_detect_response_includes_bbox_fields(self, client, game_id):
        """AC-3: Response JSON includes bbox fields per detection."""
        upload_id = self._upload(client, game_id)
        resp = client.get(f'/games/{game_id}/hands/image/{upload_id}')
        for det in resp.json()['detections']:
            assert det['bbox_x'] is not None
            assert det['bbox_y'] is not None
            assert det['bbox_width'] is not None
            assert det['bbox_height'] is not None


# ── Confirm Phase ───────────────────────────────────────────────────────


class TestE2EConfirmPhase:
    """Step 3: Confirm detections, creating Hand and verifying corrections."""

    def _upload_and_detect(self, client, game_id):
        resp = client.post(
            f'/games/{game_id}/hands/image',
            files={'file': ('hand.jpg', _make_jpeg(), 'image/jpeg')},
        )
        upload_id = resp.json()['upload_id']
        det_resp = client.get(f'/games/{game_id}/hands/image/{upload_id}')
        assert det_resp.json()['status'] == 'detected'
        return upload_id

    def _confirm_payload_matching_detections(self):
        """Confirm payload that exactly matches detector output — no corrections expected."""
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

    def _confirm_payload_with_corrections(self):
        """Confirm payload where some cards differ from detected values.

        Detector returns: AS, KH, QD, JC, 10S, 2H, 3D
        This payload changes flop_1 from AS -> AH and hole card_1 from 2H -> 9C.
        """
        return {
            'community_cards': {
                'flop_1': {'rank': 'A', 'suit': 'H'},   # detected: AS -> confirmed: AH
                'flop_2': {'rank': 'K', 'suit': 'H'},
                'flop_3': {'rank': 'Q', 'suit': 'D'},
                'turn': {'rank': 'J', 'suit': 'C'},
                'river': {'rank': '10', 'suit': 'S'},
            },
            'player_hands': [
                {
                    'player_name': 'Alice',
                    'card_1': {'rank': '9', 'suit': 'C'},  # detected: 2H -> confirmed: 9C
                    'card_2': {'rank': '3', 'suit': 'D'},
                },
            ],
        }

    def test_confirm_returns_201(self, client, game_id):
        upload_id = self._upload_and_detect(client, game_id)
        resp = client.post(
            f'/games/{game_id}/hands/image/{upload_id}/confirm',
            json=self._confirm_payload_matching_detections(),
        )
        assert resp.status_code == 201

    def test_confirm_creates_hand_record(self, client, game_id):
        upload_id = self._upload_and_detect(client, game_id)
        resp = client.post(
            f'/games/{game_id}/hands/image/{upload_id}/confirm',
            json=self._confirm_payload_matching_detections(),
        )
        data = resp.json()
        assert 'hand_id' in data
        assert data['flop_1'] == 'AS'
        assert data['flop_2'] == 'KH'
        assert data['flop_3'] == 'QD'

    def test_confirm_sets_upload_status_confirmed(self, client, game_id):
        upload_id = self._upload_and_detect(client, game_id)
        client.post(
            f'/games/{game_id}/hands/image/{upload_id}/confirm',
            json=self._confirm_payload_matching_detections(),
        )
        with SessionLocal() as db:
            upload = (
                db.query(ImageUpload)
                .filter(ImageUpload.upload_id == upload_id)
                .first()
            )
            assert upload.status == 'confirmed'

    def test_no_corrections_when_confirmed_matches_detected(self, client, game_id):
        """AC-4: No correction records when confirmed == detected."""
        upload_id = self._upload_and_detect(client, game_id)
        client.post(
            f'/games/{game_id}/hands/image/{upload_id}/confirm',
            json=self._confirm_payload_matching_detections(),
        )
        with SessionLocal() as db:
            corrections = (
                db.query(DetectionCorrection)
                .filter(DetectionCorrection.upload_id == upload_id)
                .all()
            )
            assert len(corrections) == 0

    def test_corrections_created_when_confirmed_differs(self, client, game_id):
        """AC-4: Correction records created when confirmed != detected."""
        upload_id = self._upload_and_detect(client, game_id)
        client.post(
            f'/games/{game_id}/hands/image/{upload_id}/confirm',
            json=self._confirm_payload_with_corrections(),
        )
        with SessionLocal() as db:
            corrections = (
                db.query(DetectionCorrection)
                .filter(DetectionCorrection.upload_id == upload_id)
                .all()
            )
            assert len(corrections) >= 2
            correction_map = {c.card_position: c for c in corrections}
            # flop_1: AS -> AH
            assert 'flop_1' in correction_map
            assert correction_map['flop_1'].detected_value == 'AS'
            assert correction_map['flop_1'].corrected_value == 'AH'
            # hole_1: 2H -> 9C
            assert 'hole_1' in correction_map
            assert correction_map['hole_1'].detected_value == '2H'
            assert correction_map['hole_1'].corrected_value == '9C'

    def test_corrections_count_exact(self, client, game_id):
        """AC-4: Exactly 2 corrections for our 2 changed cards."""
        upload_id = self._upload_and_detect(client, game_id)
        client.post(
            f'/games/{game_id}/hands/image/{upload_id}/confirm',
            json=self._confirm_payload_with_corrections(),
        )
        with SessionLocal() as db:
            count = (
                db.query(DetectionCorrection)
                .filter(DetectionCorrection.upload_id == upload_id)
                .count()
            )
            assert count == 2


# ── Full Pipeline E2E ───────────────────────────────────────────────────


class TestE2EFullPipeline:
    """Complete upload → detect → confirm pipeline in a single flow."""

    def test_full_pipeline(self, client, game_id):
        """Exercise the complete pipeline and verify all steps."""
        # Step 1: Upload
        upload_resp = client.post(
            f'/games/{game_id}/hands/image',
            files={'file': ('hand.jpg', _make_jpeg(), 'image/jpeg')},
        )
        assert upload_resp.status_code == 201
        upload_id = upload_resp.json()['upload_id']

        # Step 2: Detect
        detect_resp = client.get(f'/games/{game_id}/hands/image/{upload_id}')
        assert detect_resp.status_code == 200
        detect_data = detect_resp.json()
        assert detect_data['status'] == 'detected'
        assert detect_data['card_count'] == 7

        # Verify bbox fields in response
        for det in detect_data['detections']:
            assert det['bbox_x'] is not None
            assert det['bbox_y'] is not None
            assert det['bbox_width'] is not None
            assert det['bbox_height'] is not None

        # Verify bbox fields in DB
        with SessionLocal() as db:
            db_detections = (
                db.query(CardDetection)
                .filter(CardDetection.upload_id == upload_id)
                .all()
            )
            for d in db_detections:
                assert d.bbox_x is not None and d.bbox_x > 0
                assert d.bbox_y is not None and d.bbox_y > 0
                assert d.bbox_width is not None and d.bbox_width > 0
                assert d.bbox_height is not None and d.bbox_height > 0

        # Step 3: Confirm with corrections (change flop_1 from AS -> AH)
        confirm_payload = {
            'community_cards': {
                'flop_1': {'rank': 'A', 'suit': 'H'},   # changed from AS
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
        confirm_resp = client.post(
            f'/games/{game_id}/hands/image/{upload_id}/confirm',
            json=confirm_payload,
        )
        assert confirm_resp.status_code == 201
        assert 'hand_id' in confirm_resp.json()

        # Verify upload status is now confirmed
        with SessionLocal() as db:
            upload = (
                db.query(ImageUpload)
                .filter(ImageUpload.upload_id == upload_id)
                .first()
            )
            assert upload.status == 'confirmed'

        # Verify correction record exists for flop_1 (AS -> AH)
        with SessionLocal() as db:
            corrections = (
                db.query(DetectionCorrection)
                .filter(DetectionCorrection.upload_id == upload_id)
                .all()
            )
            assert len(corrections) == 1
            assert corrections[0].card_position == 'flop_1'
            assert corrections[0].detected_value == 'AS'
            assert corrections[0].corrected_value == 'AH'
