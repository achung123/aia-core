"""Tests for YoloCardDetector — real YOLO inference on card images."""

import os

import pytest


# Skip entire module if model weights are not available
WEIGHTS_PATH = os.path.join(os.path.dirname(__file__), '..', 'models', 'best.pt')
pytestmark = pytest.mark.skipif(
    not os.path.exists(WEIGHTS_PATH),
    reason='Model weights not found at models/best.pt',
)


@pytest.fixture
def detector():
    from app.services.card_detector import YoloCardDetector

    return YoloCardDetector(WEIGHTS_PATH)


@pytest.fixture
def test_image():
    path = os.path.join(os.path.dirname(__file__), 'data', 'AcetoFive.JPG')
    assert os.path.exists(path), f'Test image not found: {path}'
    return path


class TestYoloCardDetector:
    """Unit tests for YoloCardDetector with real model weights."""

    def test_detect_returns_list_of_dicts(self, detector, test_image):
        results = detector.detect(test_image)
        assert isinstance(results, list)
        assert len(results) > 0
        for r in results:
            assert isinstance(r, dict)

    def test_detect_result_has_required_keys(self, detector, test_image):
        results = detector.detect(test_image)
        required_keys = {'card_position', 'detected_value', 'confidence'}
        for r in results:
            assert required_keys.issubset(r.keys())

    def test_detect_result_has_bbox_keys(self, detector, test_image):
        results = detector.detect(test_image)
        bbox_keys = {'bbox_x', 'bbox_y', 'bbox_width', 'bbox_height'}
        for r in results:
            assert bbox_keys.issubset(r.keys())

    def test_detect_confidence_is_float_between_0_and_1(self, detector, test_image):
        results = detector.detect(test_image)
        for r in results:
            assert isinstance(r['confidence'], float)
            assert 0.0 <= r['confidence'] <= 1.0

    def test_detect_finds_known_cards_in_ace_to_five(self, detector, test_image):
        """AcetoFive.JPG contains As, 2d, 3s, 4h, 5c — the model should find them."""
        results = detector.detect(test_image)
        detected_values = {r['detected_value'] for r in results}
        expected = {'As', '2d', '3s', '4h', '5c'}
        # All 5 known cards should be detected
        assert expected.issubset(detected_values), (
            f'Missing cards: {expected - detected_values}. '
            f'Detected: {detected_values}'
        )

    def test_detect_deduplicates_overlapping_boxes(self, detector, test_image):
        """Each unique card value should appear at most once after NMS."""
        results = detector.detect(test_image)
        values = [r['detected_value'] for r in results]
        assert len(values) == len(set(values)), (
            f'Duplicate detections found: {values}'
        )

    def test_detect_card_positions_are_sequential(self, detector, test_image):
        """Card positions should be card_1, card_2, ... in order of confidence."""
        results = detector.detect(test_image)
        for i, r in enumerate(results):
            assert r['card_position'] == f'card_{i + 1}'

    def test_detect_results_ordered_by_confidence_descending(self, detector, test_image):
        results = detector.detect(test_image)
        confidences = [r['confidence'] for r in results]
        assert confidences == sorted(confidences, reverse=True)

    def test_detect_respects_confidence_threshold(self):
        from app.services.card_detector import YoloCardDetector

        detector = YoloCardDetector(WEIGHTS_PATH, confidence_threshold=0.90)
        test_img = os.path.join(os.path.dirname(__file__), 'data', 'AcetoFive.JPG')
        results = detector.detect(test_img)
        for r in results:
            assert r['confidence'] >= 0.90

    def test_detect_nonexistent_image_raises(self, detector):
        with pytest.raises(FileNotFoundError):
            detector.detect('/nonexistent/image.jpg')

    def test_satisfies_card_detector_protocol(self, detector):
        from app.services.card_detector import CardDetector

        assert isinstance(detector, CardDetector)
