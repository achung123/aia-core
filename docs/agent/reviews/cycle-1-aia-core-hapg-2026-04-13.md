# Code Review Report — aia-core (Cycle 1)

**Date:** 2026-04-13
**Target:** Split monolithic Pydantic schema file into domain modules
**Reviewer:** Scott (automated)
**Cycle:** 1
**Epic:** alpha-feedback-008

**Task:** aia-core-hapg — Split monolithic Pydantic schema file into domain modules
**Beads ID:** aia-core-hapg

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 1 |
| HIGH | 1 |
| MEDIUM | 2 |
| LOW | 1 |
| **Total Findings** | **5** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | Split app_models.py into domain modules | SATISFIED | 8 new modules created: common.py, csv_schemas.py, detection_schemas.py, game_schemas.py, hand_schemas.py, player_schemas.py, search_schemas.py, stats_schemas.py | All 53 original classes accounted for across modules |
| 2 | game_schemas.py created | SATISFIED | src/pydantic_models/game_schemas.py — 6 classes | GameSessionCreate, GameSessionListItem, GameSessionResponse, CompleteGameRequest, BlindsResponse, BlindsUpdate |
| 3 | hand_schemas.py created | SATISFIED | src/pydantic_models/hand_schemas.py — 18 classes | Includes hand, action, community card, and hand-status schemas |
| 4 | stats_schemas.py created | SATISFIED | src/pydantic_models/stats_schemas.py — 5 classes | PlayerStatsResponse, LeaderboardMetric, LeaderboardEntry, GameStatsPlayerEntry, GameStatsResponse |
| 5 | detection_schemas.py created | SATISFIED | src/pydantic_models/detection_schemas.py — 5 classes | ConfirmCommunityCards, ConfirmPlayerEntry, ConfirmDetectionRequest, PlayerEquityEntry, EquityResponse |
| 6 | player_schemas.py created | SATISFIED | src/pydantic_models/player_schemas.py — 10 classes | PlayerInfo, RebuyCreate, RebuyResponse, PlayerCreate, PlayerResponse, AddPlayerToGameRequest, AddPlayerToGameResponse, PlayerStatusUpdate, PlayerStatusResponse, SeatAssignmentRequest |
| 7 | Update all imports across routes and tests | NOT SATISFIED | All 7 route files still import from pydantic_models.app_models | No route or test file was updated to use domain-specific imports |
| 8 | Backward compatibility maintained | SATISFIED | src/pydantic_models/app_models.py re-exports all via wildcard imports; 1385 existing tests pass | app_models.py is now a 10-line re-export shim |

---

## Findings

### [CRITICAL] Pre-existing test failure exposed — test_river_showdown_transition

**File:** `test/test_river_showdown_transition.py`
**Line(s):** 69
**Category:** correctness

**Problem:**
`test_showdown_after_river_has_no_current_player` fails with the current uncommitted changes (AssertionError: expected `'flop'`, got `'preflop'`). This test passes on the committed HEAD, so it's a regression introduced by concurrent uncommitted changes in `src/app/routes/hands.py` or `test/test_river_showdown_transition.py` — NOT by the schema split itself. However, the task was closed claiming "All 1386 tests pass" — this is no longer accurate.

**Suggested Fix:**
This needs investigation by Hank. The schema split is not the cause, but the overall uncommitted working tree has a regression. The concurrent changes to `hands.py` and `test_river_showdown_transition.py` need to be reconciled.

**Impact:** The failing test blocks a clean commit of the schema split work.

---

### [HIGH] Route and test imports not updated to use domain modules

**File:** `src/app/routes/games.py`, `src/app/routes/hands.py`, `src/app/routes/players.py`, `src/app/routes/stats.py`, `src/app/routes/search.py`, `src/app/routes/upload.py`, `src/app/routes/images.py`
**Line(s):** Import lines in each file
**Category:** design

**Problem:**
The task description explicitly requires "Update all imports across routes and tests." All 7 route files and all test files (except the new `test_player_schemas_split.py`) still import from `pydantic_models.app_models` rather than from the domain-specific modules. While the wildcard re-exports in `app_models.py` make this functionally correct, it defeats the key benefit of the split: making dependency relationships explicit and enabling future removal of the monolithic shim.

**Code:**
```python
# src/app/routes/games.py line 26 — current
from pydantic_models.app_models import (
    GameSessionCreate, GameSessionListItem, GameSessionResponse, ...
)
# should be:
from pydantic_models.game_schemas import (
    GameSessionCreate, GameSessionListItem, GameSessionResponse, ...
)
```

**Suggested Fix:**
Update each route file and test file to import from the appropriate domain module instead of `app_models`. This can be done incrementally, one module at a time. Keep `app_models.py` as a backward-compat shim until all imports are migrated.

**Impact:** Without updating imports, the split provides no real architectural benefit — consumers still couple to the monolithic module. If `app_models.py` is removed in the future, all consumers would break at once rather than already pointing at the correct module.

---

### [MEDIUM] No `__all__` defined in domain modules — wildcard re-exports pollute namespace

**File:** `src/pydantic_models/app_models.py`
**Line(s):** 1–10
**Category:** convention

**Problem:**
`app_models.py` uses `from pydantic_models.X import *` for all 8 domain modules. None of the domain modules define `__all__`, so every public name from each module — including re-imported names like `BaseModel`, `Field`, `datetime`, `Enum`, `ConfigDict` — gets pulled into `app_models`. This makes `dir(app_models)` noisy and could cause subtle issues if two modules ever define identically named symbols.

**Suggested Fix:**
Add `__all__` to each domain module listing only its public API (classes and type aliases). For example:
```python
# player_schemas.py
__all__ = [
    "PlayerInfo", "RebuyCreate", "RebuyResponse", "PlayerCreate",
    "PlayerResponse", "AddPlayerToGameRequest", "AddPlayerToGameResponse",
    "PlayerStatusUpdate", "PlayerStatusResponse", "SeatAssignmentRequest",
]
```

**Impact:** Low risk currently since there are no actual name collisions, but good practice for maintainability.

---

### [MEDIUM] Split verification tests only cover player_schemas — other 7 modules have no direct-import tests

**File:** `test/test_player_schemas_split.py`
**Line(s):** entire file
**Category:** correctness

**Problem:**
The new test file verifies that all 10 `player_schemas` classes are importable directly and via the `app_models` backward-compat shim. However, no analogous tests exist for the other 7 new modules (`common`, `csv_schemas`, `detection_schemas`, `game_schemas`, `hand_schemas`, `search_schemas`, `stats_schemas`). While existing tests exercise these classes indirectly via `app_models`, there is no explicit test that `from pydantic_models.hand_schemas import HandCreate` works correctly.

**Suggested Fix:**
Add a single test file (e.g., `test_schema_split_imports.py`) that parameterizes over all 8 modules and all expected class names, verifying each is importable from both the domain module and `app_models`.

**Impact:** If a future refactor breaks one of the non-player modules, it would not be caught by the dedicated split tests.

---

### [LOW] Beads close reason is misleading about scope of work

**File:** N/A (beads metadata)
**Line(s):** N/A
**Category:** convention

**Problem:**
The close reason states: "Created player_schemas.py with 10 player-related classes extracted from game_schemas.py." In reality, the full split was performed — 8 new modules were created containing all 53 original classes, and `app_models.py` was replaced with a re-export shim. The close reason understates the work done and could confuse future readers reviewing task history.

**Suggested Fix:**
Reopen and re-close with an accurate close reason, or accept the inaccuracy as a minor documentation gap.

**Impact:** Misleading task history; low practical impact.

---

## Positives

- **Complete split achieved.** All 53 original classes and type aliases have been correctly distributed across 8 well-named domain modules. The module boundaries are sensible (common, csv, detection, game, hand, player, search, stats).
- **Clean dependency graph.** No circular imports exist. The dependency DAG is: `common` → (nothing); `csv_schemas`, `stats_schemas` → (nothing); `player_schemas`, `detection_schemas`, `hand_schemas` → `common`; `game_schemas` → `common`, `player_schemas`; `search_schemas` → `hand_schemas`.
- **Backward compatibility preserved.** The `app_models.py` re-export shim ensures all 1385 pre-existing tests pass without modification.
- **Additional modules beyond spec.** A `common.py` module was wisely created for shared enums (`ResultEnum`, `StreetEnum`, `ActionEnum`) and the `Card` model, plus `csv_schemas.py` and `search_schemas.py` — providing cleaner separation than the original 5-module plan.
- **Player schemas test quality.** The 21 tests in `test_player_schemas_split.py` are well-structured with both direct-import and backward-compat sections, and include basic validation checks (e.g., rejecting zero RebuyCreate amount).

---

## Overall Assessment

The schema split itself is well-executed — the module decomposition is clean, domain boundaries are sensible, there are no circular imports, and backward compatibility is fully preserved. However, the task is **incomplete** relative to its stated acceptance criteria: imports in route files and tests were not updated to use the new domain modules. This is the key gap that needs to be addressed in a follow-up cycle.

The CRITICAL finding is a pre-existing regression in the working tree unrelated to the schema split, but it blocks a clean commit.

**Recommended next steps:**
1. Fix the `test_river_showdown_transition` regression (separate task — not schema-related)
2. Update route imports to use domain modules (HIGH priority, completes the task AC)
3. Add `__all__` to domain modules (MEDIUM, quick improvement)
4. Add split-verification tests for remaining 7 modules (MEDIUM, improves coverage)
