"""Tests for T-013: Detector configuration and dependency injection."""

from unittest.mock import patch, MagicMock

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, StaticPool
from sqlalchemy.orm import sessionmaker

from app.database.database_models import Base as LegacyBase
from app.database.models import Base as ModelsBase
from app.database.session import get_db
from app.main import app
from app.routes.images import get_card_detector
from app.services.card_detector import MockCardDetector, YOLOCardDetector
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


@pytest.fixture(autouse=True)
def clear_detector_cache():
    """Clear the lru_cache on get_card_detector between tests."""
    yield
    if hasattr(get_card_detector, 'cache_clear'):
        get_card_detector.cache_clear()


@pytest.fixture
def client():
    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def game_id(client):
    response = client.post(
        '/games',
        json={'game_date': '2026-03-11', 'player_names': ['Adam', 'Gil']},
    )
    assert response.status_code == 201
    return response.json()['game_id']


def _make_jpeg(size_bytes: int = 100) -> bytes:
    return b'\xff\xd8\xff\xe0' + b'\x00' * (size_bytes - 4)


# ── AC1: Reads environment variables ────────────────────────────────────


class TestDetectorEnvVars:
    """AC1: get_card_detector reads CARD_DETECTOR_BACKEND, MODEL_PATH, CONFIDENCE."""

    def test_default_backend_is_mock(self, monkeypatch):
        """Default CARD_DETECTOR_BACKEND returns MockCardDetector."""
        monkeypatch.delenv('CARD_DETECTOR_BACKEND', raising=False)
        monkeypatch.delenv('CARD_DETECTOR_MODEL_PATH', raising=False)
        monkeypatch.delenv('CARD_DETECTOR_CONFIDENCE', raising=False)
        get_card_detector.cache_clear()
        detector = get_card_detector()
        assert isinstance(detector, MockCardDetector)

    def test_explicit_mock_backend(self, monkeypatch):
        """CARD_DETECTOR_BACKEND=mock returns MockCardDetector."""
        monkeypatch.setenv('CARD_DETECTOR_BACKEND', 'mock')
        get_card_detector.cache_clear()
        detector = get_card_detector()
        assert isinstance(detector, MockCardDetector)

    def test_reads_confidence_from_env(self, monkeypatch, tmp_path):
        """CARD_DETECTOR_CONFIDENCE is passed to YOLOCardDetector."""
        model_file = tmp_path / 'model.pt'
        model_file.write_bytes(b'fake')
        monkeypatch.setenv('CARD_DETECTOR_BACKEND', 'yolo')
        monkeypatch.setenv('CARD_DETECTOR_MODEL_PATH', str(model_file))
        monkeypatch.setenv('CARD_DETECTOR_CONFIDENCE', '0.7')
        get_card_detector.cache_clear()
        with patch('app.routes.images.YOLOCardDetector') as mock_yolo:
            mock_yolo.return_value = MagicMock(spec=YOLOCardDetector)
            get_card_detector()
            mock_yolo.assert_called_once_with(
                model_path=str(model_file), confidence_threshold=0.7
            )

    def test_reads_model_path_from_env(self, monkeypatch, tmp_path):
        """CARD_DETECTOR_MODEL_PATH is used for YOLOCardDetector."""
        model_file = tmp_path / 'custom_model.pt'
        model_file.write_bytes(b'fake')
        monkeypatch.setenv('CARD_DETECTOR_BACKEND', 'yolo')
        monkeypatch.setenv('CARD_DETECTOR_MODEL_PATH', str(model_file))
        get_card_detector.cache_clear()
        with patch('app.routes.images.YOLOCardDetector') as mock_yolo:
            mock_yolo.return_value = MagicMock(spec=YOLOCardDetector)
            get_card_detector()
            mock_yolo.assert_called_once_with(
                model_path=str(model_file), confidence_threshold=0.5
            )


# ── AC2: backend=yolo → YOLOCardDetector ────────────────────────────────


class TestYoloBackend:
    """AC2: backend=yolo returns YOLOCardDetector."""

    def test_yolo_backend_creates_yolo_detector(self, monkeypatch, tmp_path):
        """CARD_DETECTOR_BACKEND=yolo instantiates YOLOCardDetector."""
        model_file = tmp_path / 'model.pt'
        model_file.write_bytes(b'fake')
        monkeypatch.setenv('CARD_DETECTOR_BACKEND', 'yolo')
        monkeypatch.setenv('CARD_DETECTOR_MODEL_PATH', str(model_file))
        get_card_detector.cache_clear()
        with patch('app.routes.images.YOLOCardDetector') as mock_yolo:
            mock_instance = MagicMock(spec=YOLOCardDetector)
            mock_yolo.return_value = mock_instance
            detector = get_card_detector()
            assert detector is mock_instance


# ── AC3: Missing model file raises error ─────────────────────────────────


class TestMissingModelFile:
    """AC3: Missing model file on yolo backend raises startup-visible error."""

    def test_yolo_missing_model_raises_file_not_found(self, monkeypatch):
        """FileNotFoundError when YOLO model path doesn't exist."""
        monkeypatch.setenv('CARD_DETECTOR_BACKEND', 'yolo')
        monkeypatch.setenv('CARD_DETECTOR_MODEL_PATH', '/nonexistent/model.pt')
        get_card_detector.cache_clear()
        with pytest.raises(FileNotFoundError, match='model.pt'):
            get_card_detector()

    def test_unknown_backend_raises_value_error(self, monkeypatch):
        """ValueError for unrecognized backend name."""
        monkeypatch.setenv('CARD_DETECTOR_BACKEND', 'invalid')
        get_card_detector.cache_clear()
        with pytest.raises(ValueError, match='invalid'):
            get_card_detector()


# ── AC4: Detector cached via lru_cache ───────────────────────────────────


class TestDetectorCaching:
    """AC4: Detector is created once and cached."""

    def test_detector_cached_same_instance(self, monkeypatch):
        """Calling get_card_detector() twice returns the same instance."""
        monkeypatch.delenv('CARD_DETECTOR_BACKEND', raising=False)
        get_card_detector.cache_clear()
        d1 = get_card_detector()
        d2 = get_card_detector()
        assert d1 is d2

    def test_has_cache_clear(self):
        """get_card_detector has cache_clear (evidence of lru_cache)."""
        assert hasattr(get_card_detector, 'cache_clear')


# ── AC5: Existing test overrides continue to work ────────────────────────


class TestExistingOverrides:
    """AC5: dependency_overrides[get_card_detector] still works."""

    def test_override_still_works(self, client, game_id):
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

        upload_resp = client.post(
            f'/games/{game_id}/hands/image',
            files={'file': ('test.jpg', _make_jpeg(), 'image/jpeg')},
        )
        upload_id = upload_resp.json()['upload_id']
        response = client.get(f'/games/{game_id}/hands/image/{upload_id}')
        data = response.json()
        assert len(data['detections']) == 1
        assert data['detections'][0]['detected_value'] == 'AS'
