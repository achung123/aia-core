"""Tests for the image detection pipeline with YoloCardDetector wired into the API."""

import os
import shutil

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.models import Base
from app.database.session import get_db
from app.main import app
from app.routes.images import get_card_detector

WEIGHTS_PATH = os.path.join(os.path.dirname(__file__), '..', 'models', 'best.pt')
TEST_IMAGE = os.path.join(os.path.dirname(__file__), 'data', 'AcetoFive.JPG')

pytestmark = pytest.mark.skipif(
    not os.path.exists(WEIGHTS_PATH),
    reason='Model weights not found at models/best.pt',
)

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


def override_get_card_detector():
    from app.services.card_detector import YoloCardDetector

    return YoloCardDetector(WEIGHTS_PATH)


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_card_detector] = override_get_card_detector
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def game_id(client):
    resp = client.post(
        '/games',
        json={'game_date': '2026-04-08', 'player_names': ['Alice', 'Bob']},
    )
    assert resp.status_code == 201
    return resp.json()['game_id']


@pytest.fixture
def upload_id(client, game_id):
    """Upload AcetoFive.JPG and return the upload_id."""
    with open(TEST_IMAGE, 'rb') as f:
        resp = client.post(
            f'/games/{game_id}/hands/image',
            files={'file': ('AcetoFive.JPG', f, 'image/jpeg')},
        )
    assert resp.status_code == 201
    return resp.json()['upload_id']


@pytest.fixture(autouse=True)
def cleanup_uploads():
    yield
    if os.path.exists('uploads'):
        shutil.rmtree('uploads')


class TestImageDetectionPipeline:
    """End-to-end tests: upload image → get detection results with real YOLO model."""

    def test_upload_then_detect_returns_real_cards(self, client, game_id, upload_id):
        resp = client.get(f'/games/{game_id}/hands/image/{upload_id}')
        assert resp.status_code == 200
        data = resp.json()
        assert data['status'] == 'detected'
        assert len(data['detections']) > 0

        detected_values = {d['detected_value'] for d in data['detections']}
        expected = {'As', '2d', '3s', '4h', '5c'}
        assert expected.issubset(detected_values), (
            f'Missing: {expected - detected_values}. Got: {detected_values}'
        )

    def test_detections_have_no_duplicates(self, client, game_id, upload_id):
        resp = client.get(f'/games/{game_id}/hands/image/{upload_id}')
        data = resp.json()
        values = [d['detected_value'] for d in data['detections']]
        assert len(values) == len(set(values))

    def test_detections_have_bounding_boxes(self, client, game_id, upload_id):
        resp = client.get(f'/games/{game_id}/hands/image/{upload_id}')
        data = resp.json()
        for d in data['detections']:
            assert d['bbox_x'] is not None
            assert d['bbox_y'] is not None
            assert d['bbox_width'] is not None
            assert d['bbox_height'] is not None

    def test_detections_have_confidence_scores(self, client, game_id, upload_id):
        resp = client.get(f'/games/{game_id}/hands/image/{upload_id}')
        data = resp.json()
        for d in data['detections']:
            assert 0.0 < d['confidence'] <= 1.0

    def test_second_get_uses_cached_results(self, client, game_id, upload_id):
        """Getting detection results twice should return the same data (no re-run)."""
        resp1 = client.get(f'/games/{game_id}/hands/image/{upload_id}')
        resp2 = client.get(f'/games/{game_id}/hands/image/{upload_id}')
        assert resp1.json() == resp2.json()
