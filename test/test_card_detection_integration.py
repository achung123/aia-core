"""Integration test: YOLOCardDetector with real model and test image.

Requires:
- A trained YOLO model at models/card_detector_v1.pt (or CARD_DETECTOR_MODEL_PATH)
- test/data/hand.jpg

Marked with @pytest.mark.integration — skipped when model file is absent.
"""

import os

import pytest

from pydantic_models.app_models import DetectionResult

MODEL_PATH = os.environ.get('CARD_DETECTOR_MODEL_PATH', 'models/card_detector_v1.pt')
IMAGE_PATH = os.path.join(os.path.dirname(__file__), 'data', 'hand.jpg')

skip_no_model = pytest.mark.skipif(
    not os.path.isfile(MODEL_PATH),
    reason=f'YOLO model not found at {MODEL_PATH}',
)


@pytest.mark.integration
@skip_no_model
class TestYOLOCardDetectorIntegration:
    """Integration tests that load Y OLOCardDetector with a real model."""

    def test_detect_returns_list(self):
        from app.services.card_detector import YOLOCardDetector

        detector = YOLOCardDetector(MODEL_PATH)
        results = detector.detect(IMAGE_PATH)
        assert isinstance(results, list)

    def test_detect_returns_detection_results(self):
        from app.services.card_detector import YOLOCardDetector

        detector = YOLOCardDetector(MODEL_PATH)
        results = detector.detect(IMAGE_PATH)
        assert len(results) > 0, 'Expected at least one detection from hand.jpg'
        for r in results:
            assert isinstance(r, DetectionResult)

    def test_detect_results_have_valid_fields(self):
        from app.services.card_detector import YOLOCardDetector

        detector = YOLOCardDetector(MODEL_PATH)
        results = detector.detect(IMAGE_PATH)
        for r in results:
            assert r.detected_value is not None
            assert len(r.detected_value) >= 2
            assert 0.0 <= r.confidence <= 1.0
            assert r.bbox_x >= 0
            assert r.bbox_y >= 0
            assert r.bbox_width > 0
            assert r.bbox_height > 0

    def test_detect_results_have_no_card_position(self):
        """Detector does not assign card_position — that's PositionAssigner's job."""
        from app.services.card_detector import YOLOCardDetector

        detector = YOLOCardDetector(MODEL_PATH)
        results = detector.detect(IMAGE_PATH)
        for r in results:
            assert r.card_position is None

    def test_detect_results_have_normalized_card_notation(self):
        """detected_value should be RankSuit like 'AS', 'KH', '10D'."""
        from app.services.card_detector import YOLOCardDetector

        valid_ranks = {'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'}
        valid_suits = {'S', 'H', 'D', 'C'}

        detector = YOLOCardDetector(MODEL_PATH)
        results = detector.detect(IMAGE_PATH)
        for r in results:
            rank = r.detected_value[:-1]
            suit = r.detected_value[-1]
            assert rank in valid_ranks, f'Invalid rank: {rank} in {r.detected_value}'
            assert suit in valid_suits, f'Invalid suit: {suit} in {r.detected_value}'
