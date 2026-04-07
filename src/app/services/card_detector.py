"""Card detection protocol and implementations."""

from __future__ import annotations

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
            for pos, card in zip(positions, chosen)
        ]
