from __future__ import annotations

from pydantic import BaseModel


class CSVCommitSummary(BaseModel):
    games_created: int
    hands_created: int
    players_created: int
    players_matched: int


class ZipCommitSummary(BaseModel):
    games_created: int
    hands_created: int
    players_created: int
    players_matched: int
    actions_created: int
    rebuys_created: int
