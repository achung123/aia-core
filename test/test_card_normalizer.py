"""Tests for CardNormalizer service."""

import pytest

from app.services.card_class_map import class_id_to_card
from app.services.card_normalizer import CardNormalizer
from pydantic_models.app_models import DetectionResult


class TestNormalize:
    """Tests for CardNormalizer.normalize()."""

    @pytest.mark.parametrize("class_id", range(52))
    def test_normalize_all_52_cards(self, class_id: int):
        """Every valid class ID should return the same result as class_id_to_card."""
        normalizer = CardNormalizer()
        expected = class_id_to_card(class_id)
        assert normalizer.normalize(class_id) == expected

    def test_normalize_specific_examples(self):
        normalizer = CardNormalizer()
        # class 0 = "10 of clubs" = 10C
        assert normalizer.normalize(0) == "10C"
        # class 39 = "ace of spades" = AS
        assert normalizer.normalize(39) == "AS"

    @pytest.mark.parametrize("bad_id", [-1, 52, 999, -100])
    def test_normalize_out_of_range_raises_value_error(self, bad_id: int):
        normalizer = CardNormalizer()
        with pytest.raises(ValueError):
            normalizer.normalize(bad_id)


class TestNormalizeResults:
    """Tests for CardNormalizer.normalize_results()."""

    def test_normalize_results_converts_detected_values(self):
        normalizer = CardNormalizer()
        detections = [
            DetectionResult(
                detected_value="0",
                confidence=0.95,
                bbox_x=10.0,
                bbox_y=20.0,
                bbox_width=50.0,
                bbox_height=70.0,
            ),
            DetectionResult(
                detected_value="39",
                confidence=0.85,
                bbox_x=100.0,
                bbox_y=200.0,
                bbox_width=50.0,
                bbox_height=70.0,
            ),
        ]
        results = normalizer.normalize_results(detections)
        assert results[0].detected_value == "10C"
        assert results[1].detected_value == "AS"

    def test_normalize_results_preserves_other_fields(self):
        normalizer = CardNormalizer()
        detections = [
            DetectionResult(
                detected_value="4",
                confidence=0.9,
                bbox_x=1.0,
                bbox_y=2.0,
                bbox_width=3.0,
                bbox_height=4.0,
                card_position="community",
                position_confidence="high",
            ),
        ]
        results = normalizer.normalize_results(detections)
        r = results[0]
        assert r.confidence == 0.9
        assert r.bbox_x == 1.0
        assert r.bbox_y == 2.0
        assert r.bbox_width == 3.0
        assert r.bbox_height == 4.0
        assert r.card_position == "community"
        assert r.position_confidence == "high"

    def test_normalize_results_empty_list(self):
        normalizer = CardNormalizer()
        assert normalizer.normalize_results([]) == []

    def test_normalize_results_does_not_mutate_input(self):
        normalizer = CardNormalizer()
        original = DetectionResult(
            detected_value="0",
            confidence=0.95,
            bbox_x=10.0,
            bbox_y=20.0,
            bbox_width=50.0,
            bbox_height=70.0,
        )
        detections = [original]
        normalizer.normalize_results(detections)
        # Original should be unchanged
        assert original.detected_value == "0"

    def test_normalize_results_returns_list_of_detection_result(self):
        normalizer = CardNormalizer()
        detections = [
            DetectionResult(
                detected_value="0",
                confidence=0.95,
                bbox_x=10.0,
                bbox_y=20.0,
                bbox_width=50.0,
                bbox_height=70.0,
            ),
        ]
        results = normalizer.normalize_results(detections)
        assert isinstance(results, list)
        assert all(isinstance(r, DetectionResult) for r in results)
