# Code Review Report — Cycle 3

| Field | Value |
|---|---|
| **Target** | `aia-core-lgcl` — Route and test imports not migrated to domain-specific Pydantic modules |
| **Cycle** | 3 |
| **Reviewer** | Scott |
| **Date** | 2026-04-13 |

---

## Summary

All 7 route files and 7 test files have been successfully migrated from `pydantic_models.app_models` monolithic imports to domain-specific module imports. No stale `from pydantic_models.app_models import` lines remain in any route file. The only remaining `app_models` imports are in `test/test_player_schemas_split.py`, which is intentional — those tests verify backward-compatibility re-exports.

All domain mappings are correct:
- Detection/camera schemas → `detection_schemas`
- Hand CRUD schemas → `hand_schemas`
- Game session schemas → `game_schemas`
- Player schemas → `player_schemas`
- Search/pagination schemas → `search_schemas`
- Stats/leaderboard schemas → `stats_schemas`
- Shared enums/models (Card, ResultEnum) → `common`
- CSV schemas → `csv_schemas`

Backward-compat shim in `app_models.py` re-exports all domain modules via wildcard imports.

1386 tests pass. Lint clean.

---

## Findings

### CRITICAL

None.

### HIGH

None.

### MEDIUM

**M-1: `EquityResponse` placed in `detection_schemas` rather than a more fitting module**
- **File:** [src/pydantic_models/detection_schemas.py](src/pydantic_models/detection_schemas.py#L37)
- **Description:** `EquityResponse` and `PlayerEquityEntry` model equity calculation results, not card detection. They are semantically better suited to a dedicated `equity_schemas` module or `hand_schemas`. Currently imported in `hands.py` as `from pydantic_models.detection_schemas import EquityResponse`.
- **Impact:** Misleading module boundaries; developers looking for equity schemas won't intuit `detection_schemas`.
- **Note:** This is a **pre-existing** design choice from the original module split, not introduced by this migration. Flagged for awareness only.
- **Suggested fix:** Future task to move `EquityResponse` and `PlayerEquityEntry` to `hand_schemas` or a new `equity_schemas` module.

### LOW

None.

---

## Acceptance Criteria Mapping

| Criterion | Status | Evidence |
|---|---|---|
| Route files import from domain-specific modules instead of `app_models` | **PASS** | Grep for `from pydantic_models.app_models import` in `src/app/routes/` returns zero matches |
| Test files import from domain-specific modules | **PASS** | All 7 test files verified; only `test_player_schemas_split.py` retains `app_models` imports (intentional backward-compat) |
| Domain mapping is correct (classes come from the right module) | **PASS** | Spot-checked all 7 route files — each import traces to the correct domain module definition |
| Backward-compat re-exports preserved | **PASS** | `app_models.py` uses wildcard re-exports from all domain modules |
| All tests pass | **PASS** | 1386 tests pass |
| Lint clean | **PASS** | Confirmed |

---

## Verdict

**CLEAN** — Zero critical or high findings. One pre-existing medium observation noted for future improvement.
