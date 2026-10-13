# Code Review Report — alpha-feedback-008

**Date:** 2026-04-12
**Target:** `aia-core-d22b` — Update GameSessionResponse for active status
**Reviewer:** Scott (automated)
**Cycle:** 5

**Task:** T-007 — Update GameSessionResponse for active status
**Beads ID:** aia-core-d22b

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 1 |
| LOW | 1 |
| **Total Findings** | **2** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | `GameSessionResponse.player_names` is replaced or augmented with `players: list[{ name: str, is_active: bool }]` | SATISFIED | `src/pydantic_models/app_models.py` L140-142: `PlayerInfo` model; L151: `players: list[PlayerInfo] = []` in `GameSessionResponse`; `src/app/routes/games.py` L41-49: `_build_players()` helper called in all 4 endpoints | `player_names` kept alongside `players` for backward compat |
| 2 | Backward compatibility maintained | SATISFIED | `src/pydantic_models/app_models.py` L150: `player_names: list[str]` retained; `test/test_game_session_players_field.py` L45-47, L74-77: backward compat tests for create and get | Both fields present in all responses |
| 3 | Tests verify the new response shape | SATISFIED | `test/test_game_session_players_field.py`: 12 tests across 4 classes covering create, get, complete, reactivate endpoints | Good coverage of field presence, shape, values, and deactivation |
| 4 | `uv run pytest test/` passes | SATISFIED | 12/12 new tests pass; 1144 total reported at close | Verified locally |

---

## Findings

### [MEDIUM] `GameSessionListItem` does not include per-player active/inactive information

**File:** `src/pydantic_models/app_models.py`
**Line(s):** 129-136
**Category:** design

**Problem:**
The `list_game_sessions` endpoint (`GET /games`) returns `GameSessionListItem`, which includes `player_count: int` but not the `players` list with active/inactive status. Consumers listing games cannot see how many players are active vs inactive without fetching each game individually. This is not a violation of the task AC (which targets `GameSessionResponse` only), but may warrant a follow-up if the frontend needs active counts in list views.

**Code:**
```python
class GameSessionListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    game_id: int
    game_date: date
    status: str
    player_count: int
    hand_count: int
    winners: list[str] = []
```

**Suggested Fix:**
Consider adding `active_player_count: int` to `GameSessionListItem` in a follow-up task if the frontend needs this data in list views.

**Impact:** No functional impact on current task. Potential follow-up for UX completeness.

---

### [LOW] `_build_players()` query has no deterministic ordering

**File:** `src/app/routes/games.py`
**Line(s):** 41-49
**Category:** convention

**Problem:**
The `_build_players()` helper query does not include an `order_by()` clause. The order of players in the `players` list could vary between requests, making API responses non-deterministic. The existing tests correctly use set/dict comparisons and don't rely on ordering, so this doesn't cause test failures.

**Code:**
```python
def _build_players(db: Session, game_id: int) -> list[PlayerInfo]:
    rows = (
        db.query(Player.name, GamePlayer.is_active)
        .join(GamePlayer, GamePlayer.player_id == Player.player_id)
        .filter(GamePlayer.game_id == game_id)
        .all()
    )
    return [PlayerInfo(name=r.name, is_active=r.is_active) for r in rows]
```

**Suggested Fix:**
Add `.order_by(Player.name)` or `.order_by(GamePlayer.player_id)` to ensure consistent ordering across requests.

**Impact:** Non-deterministic response ordering; no functional bug but may cause flaky frontend rendering.

---

## Positives

- **Clean helper extraction** — `_build_players()` follows the same pattern as `_parse_winners()`, keeping endpoints concise and DRY.
- **All 4 `GameSessionResponse` endpoints updated** — create, get, complete, and reactivate all include the `players` field. No endpoint was missed.
- **Backward compatibility preserved** — `player_names` field is retained alongside the new `players` field, avoiding breaking changes for existing consumers.
- **Test quality** — 12 tests organized into 4 clear classes covering each endpoint, with shape validation, value assertions, deactivation reflection, and backward compat checks. Tests avoid order-dependence via set/dict comparisons.
- **Minimal, focused diff** — Changes are tightly scoped to the task: one new model, one helper, four endpoint updates, one test file.

---

## Overall Assessment

The implementation is clean, correct, and well-tested. All 4 acceptance criteria are satisfied. Zero CRITICAL or HIGH findings. The two findings (MEDIUM on list endpoint gap, LOW on query ordering) are minor and appropriate for follow-up tasks rather than blockers. The code follows existing project conventions and maintains backward compatibility as required.
