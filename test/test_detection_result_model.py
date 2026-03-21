import pytest
from pydantic import ValidationError

from pydantic_models.app_models import DetectionResult


class TestDetectionResultValid:
    def test_minimal_valid(self):
        dr = DetectionResult(
            detected_value='AS',
            confidence=0.95,
            bbox_x=10.0,
            bbox_y=20.0,
            bbox_width=50.0,
            bbox_height=70.0,
        )
        assert dr.detected_value == 'AS'
        assert dr.confidence == 0.95
        assert dr.bbox_x == 10.0
        assert dr.bbox_y == 20.0
        assert dr.bbox_width == 50.0
        assert dr.bbox_height == 70.0
        assert dr.card_position is None
        assert dr.position_confidence is None

    def test_with_optional_fields(self):
        dr = DetectionResult(
            detected_value='KH',
            confidence=0.88,
            bbox_x=0.0,
            bbox_y=0.0,
            bbox_width=100.0,
            bbox_height=100.0,
            card_position='community_1',
            position_confidence='high',
        )
        assert dr.card_position == 'community_1'
        assert dr.position_confidence == 'high'

    def test_confidence_zero(self):
        dr = DetectionResult(
            detected_value='2C',
            confidence=0.0,
            bbox_x=0.0,
            bbox_y=0.0,
            bbox_width=1.0,
            bbox_height=1.0,
        )
        assert dr.confidence == 0.0

    def test_confidence_one(self):
        dr = DetectionResult(
            detected_value='2C',
            confidence=1.0,
            bbox_x=0.0,
            bbox_y=0.0,
            bbox_width=1.0,
            bbox_height=1.0,
        )
        assert dr.confidence == 1.0

    def test_bbox_xy_zero(self):
        dr = DetectionResult(
            detected_value='QD',
            confidence=0.5,
            bbox_x=0.0,
            bbox_y=0.0,
            bbox_width=10.0,
            bbox_height=10.0,
        )
        assert dr.bbox_x == 0.0
        assert dr.bbox_y == 0.0

    def test_model_dump(self):
        dr = DetectionResult(
            detected_value='10S',
            confidence=0.75,
            bbox_x=5.0,
            bbox_y=10.0,
            bbox_width=30.0,
            bbox_height=40.0,
            card_position='hole_1',
            position_confidence='low',
        )
        d = dr.model_dump()
        assert d['detected_value'] == '10S'
        assert d['confidence'] == 0.75
        assert d['card_position'] == 'hole_1'
        assert d['position_confidence'] == 'low'


class TestDetectionResultInvalid:
    def test_confidence_below_zero(self):
        with pytest.raises(ValidationError):
            DetectionResult(
                detected_value='AS',
                confidence=-0.1,
                bbox_x=0.0,
                bbox_y=0.0,
                bbox_width=10.0,
                bbox_height=10.0,
            )

    def test_confidence_above_one(self):
        with pytest.raises(ValidationError):
            DetectionResult(
                detected_value='AS',
                confidence=1.1,
                bbox_x=0.0,
                bbox_y=0.0,
                bbox_width=10.0,
                bbox_height=10.0,
            )

    def test_bbox_width_zero(self):
        with pytest.raises(ValidationError):
            DetectionResult(
                detected_value='AS',
                confidence=0.5,
                bbox_x=0.0,
                bbox_y=0.0,
                bbox_width=0.0,
                bbox_height=10.0,
            )

    def test_bbox_height_zero(self):
        with pytest.raises(ValidationError):
            DetectionResult(
                detected_value='AS',
                confidence=0.5,
                bbox_x=0.0,
                bbox_y=0.0,
                bbox_width=10.0,
                bbox_height=0.0,
            )

    def test_bbox_width_negative(self):
        with pytest.raises(ValidationError):
            DetectionResult(
                detected_value='AS',
                confidence=0.5,
                bbox_x=0.0,
                bbox_y=0.0,
                bbox_width=-5.0,
                bbox_height=10.0,
            )

    def test_bbox_height_negative(self):
        with pytest.raises(ValidationError):
            DetectionResult(
                detected_value='AS',
                confidence=0.5,
                bbox_x=0.0,
                bbox_y=0.0,
                bbox_width=10.0,
                bbox_height=-5.0,
            )

    def test_missing_detected_value(self):
        with pytest.raises(ValidationError):
            DetectionResult(
                confidence=0.5,
                bbox_x=0.0,
                bbox_y=0.0,
                bbox_width=10.0,
                bbox_height=10.0,
            )

    def test_missing_confidence(self):
        with pytest.raises(ValidationError):
            DetectionResult(
                detected_value='AS',
                bbox_x=0.0,
                bbox_y=0.0,
                bbox_width=10.0,
                bbox_height=10.0,
            )
