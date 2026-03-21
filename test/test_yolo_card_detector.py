"""Tests for YOLOCardDetector service."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from app.services.card_detector import CardDetector, YOLOCardDetector
from pydantic_models.app_models import DetectionResult


class TestYOLOCardDetectorProtocol:
    """YOLOCardDetector must satisfy the CardDetector protocol."""

    def test_implements_card_detector_protocol(self):
        with patch('app.services.card_detector.YOLO') as mock_yolo_cls:
            mock_yolo_cls.return_value = MagicMock()
            detector = YOLOCardDetector(model_path='/fake/model.pt')
            assert isinstance(detector, CardDetector)


class TestYOLOCardDetectorConstructor:
    """Constructor behavior."""

    def test_default_confidence_threshold(self):
        with patch('app.services.card_detector.YOLO') as mock_yolo_cls:
            mock_yolo_cls.return_value = MagicMock()
            detector = YOLOCardDetector(model_path='/fake/model.pt')
            assert detector.confidence_threshold == 0.5

    def test_custom_confidence_threshold(self):
        with patch('app.services.card_detector.YOLO') as mock_yolo_cls:
            mock_yolo_cls.return_value = MagicMock()
            detector = YOLOCardDetector(
                model_path='/fake/model.pt', confidence_threshold=0.8
            )
            assert detector.confidence_threshold == 0.8

    def test_loads_model_via_ultralytics(self):
        with patch('app.services.card_detector.YOLO') as mock_yolo_cls:
            mock_yolo_cls.return_value = MagicMock()
            YOLOCardDetector(model_path='/fake/model.pt')
            mock_yolo_cls.assert_called_once_with('/fake/model.pt')

    def test_file_not_found_error_when_model_missing(self):
        with patch('app.services.card_detector.YOLO') as mock_yolo_cls:
            mock_yolo_cls.side_effect = FileNotFoundError('model not found')
            with pytest.raises(FileNotFoundError):
                YOLOCardDetector(model_path='/nonexistent/model.pt')


class TestYOLOCardDetectorDetect:
    """detect() method behavior."""

    @staticmethod
    def _make_mock_result(
        boxes_data: list[tuple[float, float, float, float, float, int]],
    ):
        """Build a mock YOLO Results object.

        Each tuple: (x1, y1, x2, y2, confidence, class_id)
        """
        import torch

        if not boxes_data:
            mock_result = MagicMock()
            mock_result.boxes.xyxy = torch.empty(0, 4)
            mock_result.boxes.conf = torch.empty(0)
            mock_result.boxes.cls = torch.empty(0)
            return mock_result

        xyxy = torch.tensor([[b[0], b[1], b[2], b[3]] for b in boxes_data])
        conf = torch.tensor([b[4] for b in boxes_data])
        cls = torch.tensor([float(b[5]) for b in boxes_data])

        mock_result = MagicMock()
        mock_result.boxes.xyxy = xyxy
        mock_result.boxes.conf = conf
        mock_result.boxes.cls = cls
        return mock_result

    def test_detect_returns_list_of_detection_results(self):
        # class_id 0 = "10 of clubs" -> "10C"
        mock_result = self._make_mock_result([(10, 20, 110, 160, 0.95, 0)])

        with patch('app.services.card_detector.YOLO') as mock_yolo_cls:
            mock_model = MagicMock()
            mock_model.predict.return_value = [mock_result]
            mock_yolo_cls.return_value = mock_model

            detector = YOLOCardDetector(model_path='/fake/model.pt')
            results = detector.detect('test_image.jpg')

        assert isinstance(results, list)
        assert len(results) == 1
        assert isinstance(results[0], DetectionResult)

    def test_detect_extracts_bbox_as_x_y_width_height(self):
        # xyxy: (10, 20, 110, 160) -> x=10, y=20, w=100, h=140
        mock_result = self._make_mock_result([(10.0, 20.0, 110.0, 160.0, 0.95, 0)])

        with patch('app.services.card_detector.YOLO') as mock_yolo_cls:
            mock_model = MagicMock()
            mock_model.predict.return_value = [mock_result]
            mock_yolo_cls.return_value = mock_model

            detector = YOLOCardDetector(model_path='/fake/model.pt')
            results = detector.detect('test_image.jpg')

        r = results[0]
        assert r.bbox_x == pytest.approx(10.0)
        assert r.bbox_y == pytest.approx(20.0)
        assert r.bbox_width == pytest.approx(100.0)
        assert r.bbox_height == pytest.approx(140.0)

    def test_detect_converts_class_id_to_aia_notation(self):
        # class_id 0 = "10 of clubs" -> "10C"
        mock_result = self._make_mock_result([(10, 20, 110, 160, 0.95, 0)])

        with patch('app.services.card_detector.YOLO') as mock_yolo_cls:
            mock_model = MagicMock()
            mock_model.predict.return_value = [mock_result]
            mock_yolo_cls.return_value = mock_model

            detector = YOLOCardDetector(model_path='/fake/model.pt')
            results = detector.detect('test_image.jpg')

        assert results[0].detected_value == '10C'

    def test_detect_extracts_confidence(self):
        mock_result = self._make_mock_result([(10, 20, 110, 160, 0.87, 0)])

        with patch('app.services.card_detector.YOLO') as mock_yolo_cls:
            mock_model = MagicMock()
            mock_model.predict.return_value = [mock_result]
            mock_yolo_cls.return_value = mock_model

            detector = YOLOCardDetector(model_path='/fake/model.pt')
            results = detector.detect('test_image.jpg')

        assert results[0].confidence == pytest.approx(0.87, abs=0.01)

    def test_detect_filters_by_confidence_threshold(self):
        mock_result = self._make_mock_result(
            [
                (10, 20, 110, 160, 0.95, 0),  # above threshold
                (50, 60, 150, 200, 0.30, 4),  # below threshold
            ]
        )

        with patch('app.services.card_detector.YOLO') as mock_yolo_cls:
            mock_model = MagicMock()
            mock_model.predict.return_value = [mock_result]
            mock_yolo_cls.return_value = mock_model

            detector = YOLOCardDetector(
                model_path='/fake/model.pt', confidence_threshold=0.5
            )
            results = detector.detect('test_image.jpg')

        assert len(results) == 1
        assert results[0].detected_value == '10C'

    def test_detect_multiple_cards(self):
        # class_id 0 = "10C", class_id 21 = "ace of diamonds" = "AD"
        mock_result = self._make_mock_result(
            [
                (10, 20, 110, 160, 0.95, 0),
                (200, 50, 300, 200, 0.80, 21),
            ]
        )

        with patch('app.services.card_detector.YOLO') as mock_yolo_cls:
            mock_model = MagicMock()
            mock_model.predict.return_value = [mock_result]
            mock_yolo_cls.return_value = mock_model

            detector = YOLOCardDetector(model_path='/fake/model.pt')
            results = detector.detect('test_image.jpg')

        assert len(results) == 2
        values = {r.detected_value for r in results}
        assert '10C' in values

    def test_detect_empty_results(self):
        mock_result = self._make_mock_result([])

        with patch('app.services.card_detector.YOLO') as mock_yolo_cls:
            mock_model = MagicMock()
            mock_model.predict.return_value = [mock_result]
            mock_yolo_cls.return_value = mock_model

            detector = YOLOCardDetector(model_path='/fake/model.pt')
            results = detector.detect('test_image.jpg')

        assert results == []

    def test_detect_card_position_is_none(self):
        mock_result = self._make_mock_result([(10, 20, 110, 160, 0.95, 0)])

        with patch('app.services.card_detector.YOLO') as mock_yolo_cls:
            mock_model = MagicMock()
            mock_model.predict.return_value = [mock_result]
            mock_yolo_cls.return_value = mock_model

            detector = YOLOCardDetector(model_path='/fake/model.pt')
            results = detector.detect('test_image.jpg')

        assert results[0].card_position is None

    def test_detect_raises_value_error_for_unreadable_image(self):
        with patch('app.services.card_detector.YOLO') as mock_yolo_cls:
            mock_model = MagicMock()
            mock_model.predict.side_effect = Exception('cannot read image')
            mock_yolo_cls.return_value = mock_model

            detector = YOLOCardDetector(model_path='/fake/model.pt')
            with pytest.raises(ValueError, match='unreadable'):
                detector.detect('bad_image.jpg')

    def test_detect_passes_image_path_to_predict(self):
        mock_result = self._make_mock_result([])

        with patch('app.services.card_detector.YOLO') as mock_yolo_cls:
            mock_model = MagicMock()
            mock_model.predict.return_value = [mock_result]
            mock_yolo_cls.return_value = mock_model

            detector = YOLOCardDetector(model_path='/fake/model.pt')
            detector.detect('my_image.jpg')

        mock_model.predict.assert_called_once_with('my_image.jpg', verbose=False)
