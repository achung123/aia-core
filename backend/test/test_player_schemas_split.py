"""Tests verifying the player_schemas module split.

Ensures player-related schemas are importable from both
pydantic_models.player_schemas (new) and pydantic_models.app_models (backward compat).
"""

from datetime import datetime

import pytest
from pydantic import ValidationError


class TestPlayerSchemasDirectImport:
    """Verify classes are importable from pydantic_models.player_schemas."""

    def test_import_player_create(self):
        from pydantic_models.player_schemas import PlayerCreate

        p = PlayerCreate(name='Alice')
        assert p.name == 'Alice'

    def test_import_player_response(self):
        from pydantic_models.player_schemas import PlayerResponse

        p = PlayerResponse(player_id=1, name='Alice', created_at=datetime(2026, 1, 1))
        assert p.player_id == 1

    def test_import_player_info(self):
        from pydantic_models.player_schemas import PlayerInfo

        p = PlayerInfo(name='Bob', is_active=True)
        assert p.is_active is True

    def test_import_rebuy_create(self):
        from pydantic_models.player_schemas import RebuyCreate

        r = RebuyCreate(amount=50.0)
        assert r.amount == 50.0

    def test_import_rebuy_create_rejects_zero(self):
        from pydantic_models.player_schemas import RebuyCreate

        with pytest.raises(ValidationError):
            RebuyCreate(amount=0)

    def test_import_rebuy_response(self):
        from pydantic_models.player_schemas import RebuyResponse

        r = RebuyResponse(
            rebuy_id=1,
            game_id=1,
            player_id=1,
            amount=50.0,
            created_at=datetime(2026, 1, 1),
        )
        assert r.rebuy_id == 1

    def test_import_add_player_to_game_request(self):
        from pydantic_models.player_schemas import AddPlayerToGameRequest

        req = AddPlayerToGameRequest(player_name='Alice')
        assert req.player_name == 'Alice'

    def test_import_add_player_to_game_response(self):
        from pydantic_models.player_schemas import AddPlayerToGameResponse

        resp = AddPlayerToGameResponse(player_name='Alice', is_active=True)
        assert resp.player_name == 'Alice'

    def test_import_player_status_update(self):
        from pydantic_models.player_schemas import PlayerStatusUpdate

        u = PlayerStatusUpdate(is_active=False)
        assert u.is_active is False

    def test_import_player_status_response(self):
        from pydantic_models.player_schemas import PlayerStatusResponse

        r = PlayerStatusResponse(player_name='Alice', is_active=True)
        assert r.player_name == 'Alice'

    def test_import_seat_assignment_request(self):
        from pydantic_models.player_schemas import SeatAssignmentRequest

        s = SeatAssignmentRequest(seat_number=3)
        assert s.seat_number == 3


class TestPlayerSchemasBackwardCompat:
    """Verify all player classes are still importable from app_models."""

    def test_backward_compat_player_create(self):
        from pydantic_models.app_models import PlayerCreate

        assert PlayerCreate(name='X').name == 'X'

    def test_backward_compat_player_response(self):
        from pydantic_models.app_models import PlayerResponse

        assert PlayerResponse is not None

    def test_backward_compat_player_info(self):
        from pydantic_models.app_models import PlayerInfo

        assert PlayerInfo is not None

    def test_backward_compat_rebuy_create(self):
        from pydantic_models.app_models import RebuyCreate

        assert RebuyCreate is not None

    def test_backward_compat_rebuy_response(self):
        from pydantic_models.app_models import RebuyResponse

        assert RebuyResponse is not None

    def test_backward_compat_add_player_request(self):
        from pydantic_models.app_models import AddPlayerToGameRequest

        assert AddPlayerToGameRequest is not None

    def test_backward_compat_add_player_response(self):
        from pydantic_models.app_models import AddPlayerToGameResponse

        assert AddPlayerToGameResponse is not None

    def test_backward_compat_player_status_update(self):
        from pydantic_models.app_models import PlayerStatusUpdate

        assert PlayerStatusUpdate is not None

    def test_backward_compat_player_status_response(self):
        from pydantic_models.app_models import PlayerStatusResponse

        assert PlayerStatusResponse is not None

    def test_backward_compat_seat_assignment(self):
        from pydantic_models.app_models import SeatAssignmentRequest

        assert SeatAssignmentRequest is not None
