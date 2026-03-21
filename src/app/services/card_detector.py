"""Card detection protocol and implementations."""

from __future__ import annotations

import random
from typing import Protocol, runtime_checkable

from pydantic_models.app_models import DetectionResult


@runtime_checkable
class CardDetector(Protocol):
    """Protocol for card detection from poker table images."""

    def detect(self, image_path: str) -> list[DetectionResult]:
        """Detect cards in the given image.

        Returns a list of DetectionResult objects with detected_value,
        confidence, and bounding box fields populated. card_position is
        not set by the detector — it is assigned downstream by PositionAssigner.
        """
        ...


class MockCardDetector:
    """Stub card detector returning plausible random results."""

    _RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
    _SUITS = ['S', 'H', 'D', 'C']

    def detect(self, image_path: str) -> list[DetectionResult]:
        deck = [f'{r}{s}' for r in self._RANKS for s in self._SUITS]
        num_cards = random.randint(5, 9)
        chosen = random.sample(deck, num_cards)

        return [
            DetectionResult(
                detected_value=card,
                confidence=round(random.uniform(0.75, 0.99), 4),
                bbox_x=round(random.uniform(50, 800), 1),
                bbox_y=round(random.uniform(50, 600), 1),
                bbox_width=round(random.uniform(40, 100), 1),
                bbox_height=round(random.uniform(60, 140), 1),
            )
            for card in chosen
        ]
