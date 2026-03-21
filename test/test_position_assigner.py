"""Tests for PositionAssigner service."""

from app.services.position_assigner import PositionAssigner
from pydantic_models.app_models import DetectionResult


def _det(
    value: str, bbox_x: float, bbox_y: float, w: float = 0.05, h: float = 0.07
) -> DetectionResult:
    """Helper to build a DetectionResult with normalized coords."""
    return DetectionResult(
        detected_value=value,
        confidence=0.95,
        bbox_x=bbox_x,
        bbox_y=bbox_y,
        bbox_width=w,
        bbox_height=h,
    )


class TestPositionAssignerConstructor:
    def test_default_parameters(self):
        pa = PositionAssigner()
        assert pa.community_y_min == 0.0
        assert pa.community_y_max == 0.4
        assert pa.min_community_cards == 3

    def test_custom_parameters(self):
        pa = PositionAssigner(
            community_y_min=0.1, community_y_max=0.5, min_community_cards=4
        )
        assert pa.community_y_min == 0.1
        assert pa.community_y_max == 0.5
        assert pa.min_community_cards == 4


class TestAssignEmptyAndSingle:
    def test_empty_list_returns_empty(self):
        pa = PositionAssigner()
        result = pa.assign([], 1920, 1080)
        assert result == []

    def test_single_card_fallback(self):
        """Single card -> card_1 with position_confidence='unassigned'."""
        pa = PositionAssigner()
        detections = [_det('Ah', 0.5, 0.2)]
        result = pa.assign(detections, 1920, 1080)
        assert len(result) == 1
        assert result[0].card_position == 'card_1'
        assert result[0].position_confidence == 'unassigned'


class TestCommunityCardAssignment:
    def test_five_community_cards_left_to_right(self):
        """5 cards in community region -> flop_1, flop_2, flop_3, turn, river ordered left-to-right."""
        pa = PositionAssigner()
        # All in community y-range (center y < 0.4), spread across x
        detections = [
            _det('Ah', 0.8, 0.1),  # rightmost
            _det('Kh', 0.2, 0.1),  # leftmost
            _det('Qh', 0.6, 0.15),  # middle-right
            _det('Jh', 0.4, 0.12),  # center
            _det('Th', 0.1, 0.1),  # far left
        ]
        result = pa.assign(detections, 1920, 1080)
        assert len(result) == 5
        positions = [(r.card_position, r.detected_value) for r in result]
        # Sorted left-to-right by bbox_x center
        assert positions == [
            ('flop_1', 'Th'),
            ('flop_2', 'Kh'),
            ('flop_3', 'Jh'),
            ('turn', 'Qh'),
            ('river', 'Ah'),
        ]
        for r in result:
            assert r.position_confidence in ('high', 'low')

    def test_three_community_cards_threshold(self):
        """Exactly 3 community cards meets the min_community_cards threshold -> flop only."""
        pa = PositionAssigner()
        detections = [
            _det('Ah', 0.5, 0.1),
            _det('Kh', 0.3, 0.15),
            _det('Qh', 0.7, 0.1),
        ]
        result = pa.assign(detections, 1920, 1080)
        positions = [r.card_position for r in result]
        assert positions == ['flop_1', 'flop_2', 'flop_3']

    def test_four_community_cards_flop_plus_turn(self):
        """4 cards in community region -> flop_1, flop_2, flop_3, turn."""
        pa = PositionAssigner()
        detections = [
            _det('Ah', 0.2, 0.1),
            _det('Kh', 0.4, 0.1),
            _det('Qh', 0.6, 0.1),
            _det('Jh', 0.8, 0.1),
        ]
        result = pa.assign(detections, 1920, 1080)
        positions = [r.card_position for r in result]
        assert positions == ['flop_1', 'flop_2', 'flop_3', 'turn']

    def test_more_than_five_community_overflow_to_hole(self):
        """6+ cards in community zone -> first 5 get street labels, extras become hole cards."""
        pa = PositionAssigner()
        detections = [
            _det('Ah', 0.1, 0.1),
            _det('Kh', 0.2, 0.1),
            _det('Qh', 0.3, 0.1),
            _det('Jh', 0.4, 0.1),
            _det('Th', 0.5, 0.1),
            _det('9h', 0.6, 0.1),  # overflow
        ]
        result = pa.assign(detections, 1920, 1080)
        positions = [r.card_position for r in result]
        assert positions == ['flop_1', 'flop_2', 'flop_3', 'turn', 'river', 'hole_1']


class TestHoleCardAssignment:
    def test_community_and_hole_cards(self):
        """Cards below community region -> hole_1, hole_2, ... left-to-right."""
        pa = PositionAssigner()
        detections = [
            # 3 community cards (y center in [0.0, 0.4))
            _det('Ah', 0.3, 0.1),
            _det('Kh', 0.5, 0.1),
            _det('Qh', 0.7, 0.1),
            # 2 hole cards (y center >= 0.4)
            _det('2s', 0.6, 0.6),
            _det('3s', 0.4, 0.6),
        ]
        result = pa.assign(detections, 1920, 1080)
        community = [
            r
            for r in result
            if r.card_position and not r.card_position.startswith('hole')
        ]
        holes = [
            r for r in result if r.card_position and r.card_position.startswith('hole')
        ]
        assert len(community) == 3
        assert [r.card_position for r in community] == ['flop_1', 'flop_2', 'flop_3']
        assert len(holes) == 2
        assert holes[0].card_position == 'hole_1'
        assert holes[0].detected_value == '3s'  # left
        assert holes[1].card_position == 'hole_2'
        assert holes[1].detected_value == '2s'  # right


class TestFallbackBehavior:
    def test_below_min_community_triggers_fallback(self):
        """<3 cards in community region -> all cards become card_1, card_2, ... unassigned."""
        pa = PositionAssigner()
        detections = [
            _det('Ah', 0.3, 0.1),  # would be community but only 2
            _det('Kh', 0.7, 0.1),  # would be community but only 2
            _det('2s', 0.5, 0.6),  # below community
        ]
        result = pa.assign(detections, 1920, 1080)
        assert len(result) == 3
        positions = [r.card_position for r in result]
        assert positions == ['card_1', 'card_2', 'card_3']
        for r in result:
            assert r.position_confidence == 'unassigned'

    def test_two_cards_in_community_region_fallback(self):
        """2 cards in community y-range but below threshold -> fallback."""
        pa = PositionAssigner()
        detections = [
            _det('Ah', 0.3, 0.2),
            _det('Kh', 0.7, 0.2),
        ]
        result = pa.assign(detections, 1920, 1080)
        assert result[0].card_position == 'card_1'
        assert result[1].card_position == 'card_2'
        for r in result:
            assert r.position_confidence == 'unassigned'


class TestPositionConfidence:
    def test_high_confidence_center_of_community(self):
        """Card well within community y range -> position_confidence='high'."""
        pa = PositionAssigner()
        # y center = 0.2, well within [0.0, 0.4]
        detections = [
            _det('Ah', 0.1, 0.15),
            _det('Kh', 0.3, 0.15),
            _det('Qh', 0.5, 0.15),
        ]
        result = pa.assign(detections, 1920, 1080)
        for r in result:
            assert r.position_confidence == 'high'

    def test_low_confidence_near_boundary(self):
        """Card near the community/hole boundary -> position_confidence='low'."""
        pa = PositionAssigner()
        # bbox_y=0.345, h=0.07 -> center_y=0.38, distance to 0.4 = 0.02 < 0.05 margin
        detections = [
            _det('Ah', 0.1, 0.345),
            _det('Kh', 0.3, 0.345),
            _det('Qh', 0.5, 0.345),
        ]
        result = pa.assign(detections, 1920, 1080)
        for r in result:
            assert r.position_confidence == 'low'

    def test_hole_card_high_confidence(self):
        """Hole card well below boundary -> position_confidence='high'."""
        pa = PositionAssigner()
        detections = [
            _det('Ah', 0.1, 0.1),
            _det('Kh', 0.3, 0.1),
            _det('Qh', 0.5, 0.1),
            _det('2s', 0.4, 0.7),  # well below
        ]
        result = pa.assign(detections, 1920, 1080)
        holes = [
            r for r in result if r.card_position and r.card_position.startswith('hole')
        ]
        assert len(holes) == 1
        assert holes[0].position_confidence == 'high'


class TestOriginalUnmodified:
    def test_original_detections_not_mutated(self):
        """assign() should not mutate the original DetectionResult objects."""
        pa = PositionAssigner()
        original = _det('Ah', 0.5, 0.2)
        detections = [original]
        result = pa.assign(detections, 1920, 1080)
        assert original.card_position is None
        assert original.position_confidence is None
        assert result[0].card_position is not None
