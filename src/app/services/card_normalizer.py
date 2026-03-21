"""CardNormalizer service — translates YOLO class IDs to AIA card notation."""

from __future__ import annotations

from app.services.card_class_map import class_id_to_card
from pydantic_models.app_models import DetectionResult


class CardNormalizer:
    """Converts YOLO class IDs to AIA card notation strings."""

    def normalize(self, class_id: int) -> str:
        """Return the AIA notation string for a YOLO class index.

        Raises ValueError if class_id is not in 0–51.
        """
        return class_id_to_card(class_id)

    def normalize_results(
        self, detections: list[DetectionResult]
    ) -> list[DetectionResult]:
        """Return a new list of DetectionResult with detected_value converted to AIA notation.

        Each detection's detected_value is interpreted as a YOLO class ID (string of int)
        and replaced with the corresponding AIA card notation.
        """
        return [
            detection.model_copy(
                update={"detected_value": self.normalize(int(detection.detected_value))}
            )
            for detection in detections
        ]
