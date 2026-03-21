"""Tests for T-040: Card Detection pipeline integration."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, StaticPool
from sqlalchemy.orm import sessionmaker

from app.database.database_models import Base as LegacyBase
from app.database.models import Base as ModelsBase, CardDetection, ImageUpload
from app.database.session import get_db
from app.main import app
from app.routes.images import get_card_detector
from app.services.card_detector import CardDetector, MockCardDetector
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
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def game_id(client):
    """Create a game session and return its ID."""
    response = client.post(
        '/games',
        json={'game_date': '2026-03-11', 'player_names': ['Adam', 'Gil']},
    )
    assert response.status_code == 201
    return response.json()['game_id']


def _make_jpeg(size_bytes: int = 100) -> bytes:
    return b'\xff\xd8\xff\xe0' + b'\x00' * (size_bytes - 4)


def _upload_image(client, game_id):
    """Upload a test image and return the response JSON."""
    response = client.post(
        f'/games/{game_id}/hands/image',
        files={'file': ('hand.jpg', _make_jpeg(), 'image/jpeg')},
    )
    assert response.status_code == 201
    return response.json()


# ── CardDetection Model Tests ──────────────────────────────────────────


class TestCardDetectionModel:
    """AC-1/AC-3: CardDetection SQLAlchemy model exists with required columns."""

    def test_card_detection_has_detection_id_pk(self):
        assert hasattr(CardDetection, 'detection_id')

    def test_card_detection_has_upload_id_fk(self):
        col = CardDetection.__table__.columns['upload_id']
        fk_targets = [fk.target_fullname for fk in col.foreign_keys]
        assert 'image_uploads.upload_id' in fk_targets

    def test_card_detection_has_card_position(self):
        assert hasattr(CardDetection, 'card_position')

    def test_card_detection_has_detected_value(self):
        assert hasattr(CardDetection, 'detected_value')

    def test_card_detection_has_confidence(self):
        assert hasattr(CardDetection, 'confidence')

    def test_card_detection_has_bbox_columns(self):
        for col_name in ('bbox_x', 'bbox_y', 'bbox_width', 'bbox_height'):
            assert hasattr(CardDetection, col_name)

    def test_card_detection_has_created_at(self):
        assert hasattr(CardDetection, 'created_at')

    def test_card_detection_table_name(self):
        assert CardDetection.__tablename__ == 'card_detections'

    def test_card_detection_bbox_nullable(self):
        """Bounding box columns should be nullable."""
        table = CardDetection.__table__
        for col_name in ('bbox_x', 'bbox_y', 'bbox_width', 'bbox_height'):
            assert table.columns[col_name].nullable is True


# ── CardDetector Protocol Tests ─────────────────────────────────────────


class TestCardDetectorProtocol:
    """AC-1: CardDetector protocol defines a detect method."""

    def test_card_detector_is_protocol(self):
        # Protocol classes have _is_protocol attribute
        assert getattr(CardDetector, '_is_protocol', False) is True

    def test_card_detector_has_detect_method(self):
        assert hasattr(CardDetector, 'detect')


# ── MockCardDetector Tests ──────────────────────────────────────────────


class TestMockCardDetector:
    """AC-2: MockCardDetector returns plausible stub results."""

    def test_mock_returns_list(self):
        detector = MockCardDetector()
        results = detector.detect('fake/path.jpg')
        assert isinstance(results, list)

    def test_mock_returns_variable_card_count(self):
        """Mock generates 5-9 cards per call, not a fixed 7."""
        detector = MockCardDetector()
        results = detector.detect('fake/path.jpg')
        assert 5 <= len(results) <= 9

    def test_mock_returns_detection_result_instances(self):
        """Each result should be a DetectionResult instance."""
        detector = MockCardDetector()
        results = detector.detect('fake/path.jpg')
        for r in results:
            assert isinstance(r, DetectionResult)

    def test_mock_card_position_is_none(self):
        """Detector does not set card_position — remains None."""
        detector = MockCardDetector()
        results = detector.detect('fake/path.jpg')
        for r in results:
            assert r.card_position is None

    def test_mock_has_bounding_boxes(self):
        """Each result has positive bounding box values."""
        detector = MockCardDetector()
        results = detector.detect('fake/path.jpg')
        for r in results:
            assert r.bbox_x >= 0
            assert r.bbox_y >= 0
            assert r.bbox_width > 0
            assert r.bbox_height > 0

    def test_mock_has_detected_value(self):
        detector = MockCardDetector()
        results = detector.detect('fake/path.jpg')
        for r in results:
            assert r.detected_value is not None
            assert len(r.detected_value) >= 2

    def test_mock_has_confidence_scores(self):
        detector = MockCardDetector()
        results = detector.detect('fake/path.jpg')
        for r in results:
            assert 0.75 <= r.confidence <= 0.99

    def test_mock_values_are_valid_cards(self):
        """Every detected_value should be a valid card string like 'AS', 'KH'."""
        valid_ranks = {'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'}
        valid_suits = {'S', 'H', 'D', 'C'}
        detector = MockCardDetector()
        results = detector.detect('fake/path.jpg')
        for r in results:
            val = r.detected_value
            rank = val[:-1]
            suit = val[-1]
            assert rank in valid_ranks, f'Invalid rank: {rank}'
            assert suit in valid_suits, f'Invalid suit: {suit}'

    def test_mock_no_duplicate_cards(self):
        """Stub results should not contain duplicate cards."""
        detector = MockCardDetector()
        results = detector.detect('fake/path.jpg')
        values = [r.detected_value for r in results]
        assert len(values) == len(set(values))

    def test_mock_implements_protocol(self):
        """MockCardDetector should be structurally compatible with CardDetector."""
        detector = MockCardDetector()
        assert hasattr(detector, 'detect')


# ── GET Detection Results Endpoint Tests ────────────────────────────────


class TestGetDetectionResults:
    """AC-4: GET /games/{game_id}/hands/image/{upload_id} returns detection results."""

    def test_get_detection_results_returns_200(self, client, game_id):
        upload = _upload_image(client, game_id)
        upload_id = upload['upload_id']
        response = client.get(f'/games/{game_id}/hands/image/{upload_id}')
        assert response.status_code == 200

    def test_get_detection_results_has_detections(self, client, game_id):
        upload = _upload_image(client, game_id)
        upload_id = upload['upload_id']
        response = client.get(f'/games/{game_id}/hands/image/{upload_id}')
        data = response.json()
        assert 'detections' in data

    def test_get_detection_results_has_variable_detections(self, client, game_id):
        upload = _upload_image(client, game_id)
        upload_id = upload['upload_id']
        response = client.get(f'/games/{game_id}/hands/image/{upload_id}')
        data = response.json()
        assert 5 <= len(data['detections']) <= 9

    def test_get_detection_results_has_upload_id(self, client, game_id):
        upload = _upload_image(client, game_id)
        upload_id = upload['upload_id']
        response = client.get(f'/games/{game_id}/hands/image/{upload_id}')
        data = response.json()
        assert data['upload_id'] == upload_id

    def test_get_detection_results_has_status(self, client, game_id):
        upload = _upload_image(client, game_id)
        upload_id = upload['upload_id']
        response = client.get(f'/games/{game_id}/hands/image/{upload_id}')
        data = response.json()
        assert data['status'] == 'detected'

    def test_detection_result_has_card_position(self, client, game_id):
        upload = _upload_image(client, game_id)
        upload_id = upload['upload_id']
        response = client.get(f'/games/{game_id}/hands/image/{upload_id}')
        data = response.json()
        for d in data['detections']:
            assert 'card_position' in d

    def test_detection_result_has_detected_value(self, client, game_id):
        upload = _upload_image(client, game_id)
        upload_id = upload['upload_id']
        response = client.get(f'/games/{game_id}/hands/image/{upload_id}')
        data = response.json()
        for d in data['detections']:
            assert 'detected_value' in d

    def test_detection_result_has_confidence(self, client, game_id):
        upload = _upload_image(client, game_id)
        upload_id = upload['upload_id']
        response = client.get(f'/games/{game_id}/hands/image/{upload_id}')
        data = response.json()
        for d in data['detections']:
            assert 'confidence' in d
            assert 0.0 <= d['confidence'] <= 1.0

    def test_get_nonexistent_upload_returns_404(self, client, game_id):
        response = client.get(f'/games/{game_id}/hands/image/999')
        assert response.status_code == 404

    def test_get_wrong_game_returns_404(self, client, game_id):
        upload = _upload_image(client, game_id)
        upload_id = upload['upload_id']
        response = client.get(f'/games/999/hands/image/{upload_id}')
        assert response.status_code == 404


# ── Upload Status Update Tests ──────────────────────────────────────────


class TestUploadStatusUpdate:
    """AC-5: ImageUpload.status updated to 'detected' after processing."""

    def test_upload_status_becomes_detected(self, client, game_id):
        upload = _upload_image(client, game_id)
        upload_id = upload['upload_id']
        # GET triggers detection and status update
        response = client.get(f'/games/{game_id}/hands/image/{upload_id}')
        assert response.json()['status'] == 'detected'

    def test_detections_stored_in_database(self, client, game_id):
        upload = _upload_image(client, game_id)
        upload_id = upload['upload_id']
        # Trigger detection
        client.get(f'/games/{game_id}/hands/image/{upload_id}')
        # Verify persisted
        with SessionLocal() as db:
            detections = (
                db.query(CardDetection)
                .filter(CardDetection.upload_id == upload_id)
                .all()
            )
            assert 5 <= len(detections) <= 9

    def test_second_get_returns_same_results(self, client, game_id):
        """Idempotent: second GET should return same stored detections, not re-detect."""
        upload = _upload_image(client, game_id)
        upload_id = upload['upload_id']
        r1 = client.get(f'/games/{game_id}/hands/image/{upload_id}')
        r2 = client.get(f'/games/{game_id}/hands/image/{upload_id}')
        assert r1.json()['detections'] == r2.json()['detections']

    def test_second_get_does_not_duplicate_detections(self, client, game_id):
        upload = _upload_image(client, game_id)
        upload_id = upload['upload_id']
        r1 = client.get(f'/games/{game_id}/hands/image/{upload_id}')
        first_count = len(r1.json()['detections'])
        client.get(f'/games/{game_id}/hands/image/{upload_id}')
        with SessionLocal() as db:
            count = (
                db.query(CardDetection)
                .filter(CardDetection.upload_id == upload_id)
                .count()
            )
            assert count == first_count


# ── Dependency Injection Tests ──────────────────────────────────────────


class TestCardDetectorDependencyInjection:
    """T-040-H1: CardDetector uses FastAPI DI, not module-level singleton."""

    def test_get_card_detector_returns_card_detector(self):
        """get_card_detector dependency returns a CardDetector-compatible instance."""
        detector = get_card_detector()
        assert isinstance(detector, CardDetector)

    def test_get_card_detector_returns_mock_by_default(self):
        """Default dependency returns MockCardDetector."""
        detector = get_card_detector()
        assert isinstance(detector, MockCardDetector)

    def test_override_card_detector_in_test(self, game_id):
        """Tests can inject a custom detector via dependency_overrides."""

        class FixedDetector:
            def detect(self, image_path: str) -> list[DetectionResult]:
                return [
                    DetectionResult(
                        detected_value='AS',
                        confidence=0.99,
                        bbox_x=100.0,
                        bbox_y=50.0,
                        bbox_width=60.0,
                        bbox_height=80.0,
                    ),
                ]

        app.dependency_overrides[get_card_detector] = lambda: FixedDetector()
        app.dependency_overrides[get_db] = override_get_db
        test_client = TestClient(app)
        try:
            upload = _upload_image(test_client, game_id)
            upload_id = upload['upload_id']
            response = test_client.get(f'/games/{game_id}/hands/image/{upload_id}')
            data = response.json()
            assert len(data['detections']) == 1
            assert data['detections'][0]['detected_value'] == 'AS'
            assert data['detections'][0]['confidence'] == 0.99
        finally:
            app.dependency_overrides.clear()

    def test_no_module_level_detector_singleton(self):
        """images module should NOT have a _detector module-level variable."""
        import app.routes.images as images_mod

        assert not hasattr(images_mod, '_detector')


# ── Detect() Error Handling Tests (aia-core-3my.2) ─────────────────────


class TestDetectErrorHandling:
    """aia-core-3my.2: detect() failure must set status='failed' and rollback partial rows."""

    def _make_failing_detector(self):
        """Return a detector whose detect() always raises RuntimeError."""

        class FailingDetector:
            def detect(self, image_path: str) -> list[DetectionResult]:
                raise RuntimeError('Simulated detection failure')

        return FailingDetector()

    def _make_partial_failing_detector(self):
        """Return a detector that raises after returning partial results (shouldn't happen
        since detect returns all-at-once, but guards against future streaming changes)."""

        class PartialFailDetector:
            def detect(self, image_path: str) -> list[DetectionResult]:
                raise OSError('Corrupt image file')

        return PartialFailDetector()

    def _setup_client_with_detector(self, detector):
        app.dependency_overrides[get_card_detector] = lambda: detector
        app.dependency_overrides[get_db] = override_get_db
        return TestClient(app)

    def test_detect_failure_returns_500(self, game_id):
        """When detect() raises, the endpoint should return 500."""
        test_client = self._setup_client_with_detector(self._make_failing_detector())
        try:
            upload = _upload_image(test_client, game_id)
            upload_id = upload['upload_id']
            response = test_client.get(f'/games/{game_id}/hands/image/{upload_id}')
            assert response.status_code == 500
        finally:
            app.dependency_overrides.clear()

    def test_detect_failure_sets_status_failed(self, game_id):
        """When detect() raises, upload.status must be set to 'failed'."""
        test_client = self._setup_client_with_detector(self._make_failing_detector())
        try:
            upload = _upload_image(test_client, game_id)
            upload_id = upload['upload_id']
            # Trigger the failing detection
            test_client.get(f'/games/{game_id}/hands/image/{upload_id}')
            # Verify status in DB
            with SessionLocal() as db:
                record = (
                    db.query(ImageUpload)
                    .filter(ImageUpload.upload_id == upload_id)
                    .first()
                )
                assert record is not None
                assert record.status == 'failed'
        finally:
            app.dependency_overrides.clear()

    def test_detect_failure_rolls_back_partial_detections(self, game_id):
        """When detect() raises, no CardDetection rows should remain in DB."""
        test_client = self._setup_client_with_detector(self._make_failing_detector())
        try:
            upload = _upload_image(test_client, game_id)
            upload_id = upload['upload_id']
            test_client.get(f'/games/{game_id}/hands/image/{upload_id}')
            with SessionLocal() as db:
                count = (
                    db.query(CardDetection)
                    .filter(CardDetection.upload_id == upload_id)
                    .count()
                )
                assert count == 0
        finally:
            app.dependency_overrides.clear()

    def test_detect_failure_subsequent_get_returns_failed_status(self, game_id):
        """After detection failure, a subsequent GET should show status='failed'."""
        test_client = self._setup_client_with_detector(self._make_failing_detector())
        try:
            upload = _upload_image(test_client, game_id)
            upload_id = upload['upload_id']
            # First GET triggers and fails
            test_client.get(f'/games/{game_id}/hands/image/{upload_id}')
            # Now swap to a working detector and GET again
            app.dependency_overrides[get_card_detector] = lambda: MockCardDetector()
            response = test_client.get(f'/games/{game_id}/hands/image/{upload_id}')
            data = response.json()
            assert data['status'] == 'failed'
        finally:
            app.dependency_overrides.clear()

    def test_detect_failure_error_message_in_response(self, game_id):
        """The 500 response should include a meaningful error detail."""
        test_client = self._setup_client_with_detector(self._make_failing_detector())
        try:
            upload = _upload_image(test_client, game_id)
            upload_id = upload['upload_id']
            response = test_client.get(f'/games/{game_id}/hands/image/{upload_id}')
            assert response.status_code == 500
            data = response.json()
            assert 'detail' in data
        finally:
            app.dependency_overrides.clear()

    def test_oserror_during_detect_sets_status_failed(self, game_id):
        """OSError (e.g., file not found) during detect() sets status='failed'."""
        test_client = self._setup_client_with_detector(
            self._make_partial_failing_detector()
        )
        try:
            upload = _upload_image(test_client, game_id)
            upload_id = upload['upload_id']
            response = test_client.get(f'/games/{game_id}/hands/image/{upload_id}')
            assert response.status_code == 500
            with SessionLocal() as db:
                record = (
                    db.query(ImageUpload)
                    .filter(ImageUpload.upload_id == upload_id)
                    .first()
                )
                assert record.status == 'failed'
        finally:
            app.dependency_overrides.clear()


# ── Unique Constraint & Concurrent Request Tests (aia-core-3my.3) ──────


class TestCardDetectionUniqueConstraint:
    """aia-core-3my.3: UniqueConstraint on (upload_id, card_position) prevents duplicates."""

    def test_unique_constraint_exists_on_model(self):
        """CardDetection model should have a UniqueConstraint on (upload_id, card_position)."""
        table = CardDetection.__table__
        unique_constraints = [
            c
            for c in table.constraints
            if hasattr(c, 'columns')
            and {col.name for col in c.columns} == {'upload_id', 'card_position'}
        ]
        assert len(unique_constraints) == 1

    def test_duplicate_upload_card_position_raises_integrity_error(self):
        """Inserting two rows with the same (upload_id, card_position) should raise IntegrityError."""
        from datetime import date

        from sqlalchemy.exc import IntegrityError as SAIntegrityError

        with SessionLocal() as db:
            from app.database.models import GameSession, ImageUpload

            game = GameSession(game_date=date(2026, 3, 11))
            db.add(game)
            db.flush()
            upload = ImageUpload(
                game_id=game.game_id, file_path='/tmp/test.jpg', status='processing'
            )
            db.add(upload)
            db.flush()

            d1 = CardDetection(
                upload_id=upload.upload_id,
                card_position='community_1',
                detected_value='AS',
                confidence=0.95,
            )
            d2 = CardDetection(
                upload_id=upload.upload_id,
                card_position='community_1',
                detected_value='KH',
                confidence=0.85,
            )
            db.add(d1)
            db.flush()
            db.add(d2)
            with pytest.raises(SAIntegrityError):
                db.flush()
            db.rollback()

    def test_different_positions_same_upload_allowed(self):
        """Different card_position values for the same upload should succeed."""
        from datetime import date

        with SessionLocal() as db:
            from app.database.models import GameSession, ImageUpload

            game = GameSession(game_date=date(2026, 3, 11))
            db.add(game)
            db.flush()
            upload = ImageUpload(
                game_id=game.game_id, file_path='/tmp/test.jpg', status='processing'
            )
            db.add(upload)
            db.flush()

            d1 = CardDetection(
                upload_id=upload.upload_id,
                card_position='community_1',
                detected_value='AS',
                confidence=0.95,
            )
            d2 = CardDetection(
                upload_id=upload.upload_id,
                card_position='community_2',
                detected_value='KH',
                confidence=0.85,
            )
            db.add_all([d1, d2])
            db.flush()  # Should not raise
            assert d1.detection_id is not None
            assert d2.detection_id is not None
            db.rollback()


class TestConcurrentDetectionRaceCondition:
    """aia-core-3my.3: Endpoint handles race condition when concurrent requests both detect."""

    def test_concurrent_detect_returns_200_not_500(self, game_id):
        """If a concurrent request already inserted detections, the endpoint should
        catch IntegrityError and return the existing detections (200), not 500."""
        app.dependency_overrides[get_db] = override_get_db
        app.dependency_overrides[get_card_detector] = lambda: MockCardDetector()
        test_client = TestClient(app)
        try:
            upload = _upload_image(test_client, game_id)
            upload_id = upload['upload_id']

            # Simulate the race: manually insert detections (as if a concurrent request did)
            with SessionLocal() as db:
                detector = MockCardDetector()
                results = detector.detect('fake/path.jpg')
                for i, r in enumerate(results, 1):
                    db.add(
                        CardDetection(
                            upload_id=upload_id,
                            card_position=f'card_{i}',
                            detected_value=r.detected_value,
                            confidence=r.confidence,
                        )
                    )
                upload_rec = (
                    db.query(ImageUpload)
                    .filter(ImageUpload.upload_id == upload_id)
                    .first()
                )
                upload_rec.status = 'detected'
                db.commit()

            # Now the endpoint request should see 'detected' and just return existing rows
            response = test_client.get(f'/games/{game_id}/hands/image/{upload_id}')
            assert response.status_code == 200
            data = response.json()
            assert 5 <= len(data['detections']) <= 9
        finally:
            app.dependency_overrides.clear()

    def test_integrity_error_during_commit_returns_existing_detections(self, game_id):
        """If commit raises IntegrityError (concurrent insert), endpoint should
        rollback, re-query, and return the existing detections instead of 500."""

        call_count = 0

        class RaceSimulatingDetector:
            """A detector that inserts duplicate rows via a side-channel to trigger
            IntegrityError when the endpoint tries to commit."""

            def detect(self, image_path: str) -> list[DetectionResult]:
                nonlocal call_count
                call_count += 1
                base_results = MockCardDetector().detect(image_path)
                # Side-channel: insert detections directly, simulating concurrent request
                with SessionLocal() as side_db:
                    upload = side_db.query(ImageUpload).first()
                    for i, r in enumerate(base_results, 1):
                        side_db.add(
                            CardDetection(
                                upload_id=upload.upload_id,
                                card_position=f'card_{i}',
                                detected_value=r.detected_value,
                                confidence=r.confidence,
                            )
                        )
                    upload.status = 'detected'
                    side_db.commit()
                return base_results

        app.dependency_overrides[get_db] = override_get_db
        app.dependency_overrides[get_card_detector] = lambda: RaceSimulatingDetector()
        test_client = TestClient(app)
        try:
            upload = _upload_image(test_client, game_id)
            upload_id = upload['upload_id']
            response = test_client.get(f'/games/{game_id}/hands/image/{upload_id}')
            assert response.status_code == 200
            data = response.json()
            assert 5 <= len(data['detections']) <= 9
            assert data['status'] == 'detected'
        finally:
            app.dependency_overrides.clear()


# ── T-014: Enriched Detection Response Tests ───────────────────────────


def _make_fixed_detector():
    """Return a detector with deterministic results for T-014 tests."""

    class FixedDetector:
        def detect(self, image_path: str) -> list[DetectionResult]:
            return [
                DetectionResult(
                    detected_value='AS',
                    confidence=0.95,
                    bbox_x=100.0,
                    bbox_y=50.0,
                    bbox_width=60.0,
                    bbox_height=80.0,
                ),
                DetectionResult(
                    detected_value='KH',
                    confidence=0.90,
                    bbox_x=200.0,
                    bbox_y=55.0,
                    bbox_width=60.0,
                    bbox_height=80.0,
                ),
                DetectionResult(
                    detected_value='QD',
                    confidence=0.85,
                    bbox_x=300.0,
                    bbox_y=60.0,
                    bbox_width=60.0,
                    bbox_height=80.0,
                ),
            ]

    return FixedDetector()


def _make_valid_jpeg(width: int = 640, height: int = 480) -> bytes:
    """Create a minimal valid JPEG with known dimensions."""
    from io import BytesIO

    from PIL import Image

    img = Image.new('RGB', (width, height), color=(0, 128, 0))
    buf = BytesIO()
    img.save(buf, format='JPEG')
    return buf.getvalue()


def _upload_valid_image(client, game_id, width=640, height=480):
    """Upload a valid JPEG with known dimensions and return the response JSON."""
    data = _make_valid_jpeg(width, height)
    response = client.post(
        f'/games/{game_id}/hands/image',
        files={'file': ('hand.jpg', data, 'image/jpeg')},
    )
    assert response.status_code == 201
    return response.json()


class TestEnrichedDetectionResponse:
    """T-014: Updated detection results endpoint response with bbox, position, dimensions."""

    def _setup_client(self, detector=None):
        app.dependency_overrides[get_db] = override_get_db
        if detector is not None:
            app.dependency_overrides[get_card_detector] = lambda: detector
        return TestClient(app)

    # ── AC-1: Handler calls detector.detect() then PositionAssigner.assign() ──

    def test_position_assigner_called_card_positions_assigned(self, game_id):
        """After detection, card_position values should come from PositionAssigner."""
        client = self._setup_client(_make_fixed_detector())
        try:
            upload = _upload_valid_image(client, game_id)
            r = client.get(f'/games/{game_id}/hands/image/{upload["upload_id"]}')
            data = r.json()
            positions = [d['card_position'] for d in data['detections']]
            # PositionAssigner assigns positions (not just fallback card_1 from index)
            for pos in positions:
                assert pos is not None
                assert len(pos) > 0
        finally:
            app.dependency_overrides.clear()

    # ── AC-2: CardDetection rows stored with bbox and card_position ──

    def test_db_stores_bbox_fields(self, game_id):
        """CardDetection rows must have bbox_x, bbox_y, bbox_width, bbox_height."""
        client = self._setup_client(_make_fixed_detector())
        try:
            upload = _upload_valid_image(client, game_id)
            client.get(f'/games/{game_id}/hands/image/{upload["upload_id"]}')
            with SessionLocal() as db:
                detections = (
                    db.query(CardDetection)
                    .filter(CardDetection.upload_id == upload['upload_id'])
                    .all()
                )
                assert len(detections) == 3
                for d in detections:
                    assert d.bbox_x is not None
                    assert d.bbox_y is not None
                    assert d.bbox_width is not None
                    assert d.bbox_height is not None
        finally:
            app.dependency_overrides.clear()

    def test_db_stores_position_confidence(self, game_id):
        """CardDetection rows must have position_confidence stored."""
        client = self._setup_client(_make_fixed_detector())
        try:
            upload = _upload_valid_image(client, game_id)
            client.get(f'/games/{game_id}/hands/image/{upload["upload_id"]}')
            with SessionLocal() as db:
                detections = (
                    db.query(CardDetection)
                    .filter(CardDetection.upload_id == upload['upload_id'])
                    .all()
                )
                for d in detections:
                    assert d.position_confidence is not None
                    assert d.position_confidence in ('high', 'low', 'unassigned')
        finally:
            app.dependency_overrides.clear()

    # ── AC-3: Response includes bbox per detection ──

    def test_response_detections_have_bbox_fields(self, game_id):
        """Each detection in response must include bbox_x/y/width/height."""
        client = self._setup_client(_make_fixed_detector())
        try:
            upload = _upload_valid_image(client, game_id)
            r = client.get(f'/games/{game_id}/hands/image/{upload["upload_id"]}')
            for d in r.json()['detections']:
                assert 'bbox_x' in d
                assert 'bbox_y' in d
                assert 'bbox_width' in d
                assert 'bbox_height' in d
        finally:
            app.dependency_overrides.clear()

    # ── AC-4: Response includes position_confidence per detection ──

    def test_response_detections_have_position_confidence(self, game_id):
        """Each detection in response must include position_confidence."""
        client = self._setup_client(_make_fixed_detector())
        try:
            upload = _upload_valid_image(client, game_id)
            r = client.get(f'/games/{game_id}/hands/image/{upload["upload_id"]}')
            for d in r.json()['detections']:
                assert 'position_confidence' in d
                assert d['position_confidence'] in ('high', 'low', 'unassigned')
        finally:
            app.dependency_overrides.clear()

    # ── AC-5: Response includes card_count, image_width, image_height ──

    def test_response_includes_card_count(self, game_id):
        """Top-level response must include card_count."""
        client = self._setup_client(_make_fixed_detector())
        try:
            upload = _upload_valid_image(client, game_id)
            r = client.get(f'/games/{game_id}/hands/image/{upload["upload_id"]}')
            data = r.json()
            assert 'card_count' in data
            assert data['card_count'] == 3
        finally:
            app.dependency_overrides.clear()

    def test_response_includes_image_width(self, game_id):
        """Top-level response must include image_width."""
        client = self._setup_client(_make_fixed_detector())
        try:
            upload = _upload_valid_image(client, game_id, width=800, height=600)
            r = client.get(f'/games/{game_id}/hands/image/{upload["upload_id"]}')
            data = r.json()
            assert 'image_width' in data
            assert data['image_width'] == 800
        finally:
            app.dependency_overrides.clear()

    def test_response_includes_image_height(self, game_id):
        """Top-level response must include image_height."""
        client = self._setup_client(_make_fixed_detector())
        try:
            upload = _upload_valid_image(client, game_id, width=800, height=600)
            r = client.get(f'/games/{game_id}/hands/image/{upload["upload_id"]}')
            data = r.json()
            assert 'image_height' in data
            assert data['image_height'] == 600
        finally:
            app.dependency_overrides.clear()

    # ── AC-6: Bbox in pixel units ──

    def test_bbox_values_match_detector_output(self, game_id):
        """Bbox coordinates should be the exact pixel values from DetectionResult."""
        client = self._setup_client(_make_fixed_detector())
        try:
            upload = _upload_valid_image(client, game_id)
            r = client.get(f'/games/{game_id}/hands/image/{upload["upload_id"]}')
            detections = r.json()['detections']
            # Find the AS detection
            as_det = [d for d in detections if d['detected_value'] == 'AS']
            assert len(as_det) == 1
            assert as_det[0]['bbox_x'] == 100.0
            assert as_det[0]['bbox_y'] == 50.0
            assert as_det[0]['bbox_width'] == 60.0
            assert as_det[0]['bbox_height'] == 80.0
        finally:
            app.dependency_overrides.clear()

    # ── Re-detection idempotency with enriched fields ──

    def test_second_get_still_returns_enriched_fields(self, game_id):
        """Second GET (no re-detection) should still include enriched fields."""
        client = self._setup_client(_make_fixed_detector())
        try:
            upload = _upload_valid_image(client, game_id)
            uid = upload['upload_id']
            client.get(f'/games/{game_id}/hands/image/{uid}')
            r2 = client.get(f'/games/{game_id}/hands/image/{uid}')
            data = r2.json()
            assert 'card_count' in data
            assert 'image_width' in data
            assert 'image_height' in data
            for d in data['detections']:
                assert 'position_confidence' in d
        finally:
            app.dependency_overrides.clear()
