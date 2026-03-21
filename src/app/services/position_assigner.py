"""PositionAssigner: spatial heuristic for card position labeling.

Assigns Texas Hold'em position labels:
- Community cards: flop_1, flop_2, flop_3, turn, river (max 5)
- Hole cards: hole_1, hole_2, ... (2 per player, pairing resolved at confirm)
"""

from __future__ import annotations

from pydantic_models.app_models import DetectionResult

# Distance from the community boundary considered "borderline"
_BOUNDARY_MARGIN = 0.05

# Texas Hold'em community card position labels in dealing order (left-to-right)
_COMMUNITY_LABELS = ["flop_1", "flop_2", "flop_3", "turn", "river"]
_MAX_COMMUNITY = len(_COMMUNITY_LABELS)  # 5


class PositionAssigner:
    """Assigns card_position labels based on bounding-box coordinates.

    Community cards have their bbox_y center within [community_y_min, community_y_max].
    They are labeled using Texas Hold'em street names left-to-right:
    flop_1, flop_2, flop_3, turn, river (max 5 community cards).
    Remaining cards are labeled hole_1, hole_2, … left-to-right.

    If fewer than min_community_cards fall in the community region, the heuristic
    falls back to generic card_1, card_2, … with position_confidence="unassigned".
    """

    def __init__(
        self,
        community_y_min: float = 0.0,
        community_y_max: float = 0.4,
        min_community_cards: int = 3,
    ) -> None:
        self.community_y_min = community_y_min
        self.community_y_max = community_y_max
        self.min_community_cards = min_community_cards

    def assign(
        self,
        detections: list[DetectionResult],
        image_width: int,
        image_height: int,
    ) -> list[DetectionResult]:
        """Return new DetectionResult list with position fields populated."""
        if not detections:
            return []

        community: list[tuple[float, DetectionResult]] = []
        hole: list[tuple[float, DetectionResult]] = []

        for det in detections:
            cx = det.bbox_x + det.bbox_width / 2
            cy = det.bbox_y + det.bbox_height / 2
            if self.community_y_min <= cy <= self.community_y_max:
                community.append((cx, det))
            else:
                hole.append((cx, det))

        # Fallback: not enough community cards to be confident in layout
        if len(community) < self.min_community_cards:
            all_sorted = sorted(community + hole, key=lambda t: t[0])
            return [
                det.model_copy(
                    update={
                        "card_position": f"card_{i + 1}",
                        "position_confidence": "unassigned",
                    }
                )
                for i, (_cx, det) in enumerate(all_sorted)
            ]

        # Sort each group left-to-right
        community.sort(key=lambda t: t[0])
        hole.sort(key=lambda t: t[0])

        # Cap community cards at 5 (Texas Hold'em max); overflow to hole cards
        if len(community) > _MAX_COMMUNITY:
            overflow = community[_MAX_COMMUNITY:]
            community = community[:_MAX_COMMUNITY]
            hole = sorted(hole + overflow, key=lambda t: t[0])

        results: list[DetectionResult] = []
        for i, (_cx, det) in enumerate(community):
            results.append(
                det.model_copy(
                    update={
                        "card_position": _COMMUNITY_LABELS[i],
                        "position_confidence": self._confidence(det, is_community=True),
                    }
                )
            )
        for i, (_cx, det) in enumerate(hole):
            results.append(
                det.model_copy(
                    update={
                        "card_position": f"hole_{i + 1}",
                        "position_confidence": self._confidence(det, is_community=False),
                    }
                )
            )
        return results

    def _confidence(self, det: DetectionResult, *, is_community: bool) -> str:
        """Determine position confidence based on distance from the boundary."""
        cy = det.bbox_y + det.bbox_height / 2
        distance = abs(cy - self.community_y_max)
        if distance < _BOUNDARY_MARGIN:
            return "low"
        return "high"
