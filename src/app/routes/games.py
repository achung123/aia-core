"""Games router - handles game-related endpoints."""

from fastapi import APIRouter

router = APIRouter(prefix='/games', tags=['games'])
