"""Card detection protocol and implementations."""

from __future__ import annotations

import os
import random
from typing import Protocol, runtime_checkable


@runtime_checkable
class CardDetector(Protocol):
    """Protocol for card detection from poker table images."""

    def detect(self, image_path: str) -> list[dict]:
        """Detect cards in the given image.

        Returns a list of dicts with keys:
            card_position, detected_value, confidence
        """
        ...


class MockCardDetector:
    """Stub card detector returning plausible random results."""

    _RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
    _SUITS = ['S', 'H', 'D', 'C']

    def detect(self, image_path: str) -> list[dict]:
        deck = [f'{r}{s}' for r in self._RANKS for s in self._SUITS]
        chosen = random.sample(deck, 7)

        positions = [
            'community_1',
            'community_2',
            'community_3',
            'community_4',
            'community_5',
            'hole_1',
            'hole_2',
        ]

        return [
            {
                'card_position': pos,
                'detected_value': card,
                'confidence': round(random.uniform(0.75, 0.99), 4),
            }
            for pos, card in zip(positions, chosen, strict=False)
        ]


class YoloCardDetector:
    """Card detector using a YOLOv8 model trained on playing cards.

    Uses multi-scale inference to handle images where cards appear at
    different sizes (close-up photos vs. overhead table shots).
    """

    _DEFAULT_SCALES: tuple[int, ...] = (480, 640)

    def __init__(
        self,
        weights_path: str,
        confidence_threshold: float = 0.20,
        scales: tuple[int, ...] | None = None,
    ) -> None:
        if not os.path.exists(weights_path):
            raise FileNotFoundError(f'Model weights not found: {weights_path}')
        from ultralytics import YOLO

        self._model = YOLO(weights_path)
        self._confidence_threshold = confidence_threshold
        self._scales = scales or self._DEFAULT_SCALES

    def detect(self, image_path: str) -> list[dict]:
        if not os.path.exists(image_path):
            raise FileNotFoundError(f'Image not found: {image_path}')

        raw_detections: list[dict] = []
        for scale in self._scales:
            results = self._model(
                image_path,
                conf=self._confidence_threshold,
                imgsz=scale,
                verbose=False,
            )
            for r in results:
                for box in r.boxes:
                    cls_id = int(box.cls[0])
                    conf = round(float(box.conf[0]), 4)
                    label = r.names[cls_id]
                    x1, y1, x2, y2 = box.xyxy[0].tolist()
                    raw_detections.append(
                        {
                            'detected_value': label,
                            'confidence': conf,
                            'bbox_x': round(x1, 2),
                            'bbox_y': round(y1, 2),
                            'bbox_width': round(x2 - x1, 2),
                            'bbox_height': round(y2 - y1, 2),
                        }
                    )

        # Deduplicate: keep highest confidence detection per card value
        best_per_card: dict[str, dict] = {}
        for det in raw_detections:
            val = det['detected_value']
            if (
                val not in best_per_card
                or det['confidence'] > best_per_card[val]['confidence']
            ):
                best_per_card[val] = det

        # Sort by confidence descending, assign sequential positions
        sorted_dets = sorted(
            best_per_card.values(), key=lambda d: d['confidence'], reverse=True
        )
        for i, det in enumerate(sorted_dets):
            det['card_position'] = f'card_{i + 1}'

        return sorted_dets
