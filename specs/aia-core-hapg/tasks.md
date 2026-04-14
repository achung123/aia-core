# Tasks — AIA Core HAPG (Pydantic Schema Split)

**Project ID:** aia-core-hapg
**Date:** 2026-04-13
**Status:** Cycle 1 Review Complete

---

## Bugs / Findings

Findings from Scott's code review of Cycle 1 (`aia-core-hapg`).

| # | Severity | Summary | Source |
|---|---|---|---|
| F-1 | CRITICAL | River showdown test regression blocks clean commit | aia-core-hapg |
| F-2 | HIGH | Route and test imports not updated to domain modules | aia-core-hapg |
| F-3 | MEDIUM | No `__all__` defined in new domain modules | aia-core-hapg |
| F-4 | MEDIUM | Split verification tests only cover `player_schemas` | aia-core-hapg |
| F-5 | LOW | Beads close reason understates work done | aia-core-hapg |

---

### F-1 — Test regression: river showdown transition (CRITICAL)

**Severity:** CRITICAL
**Source:** aia-core-hapg

`test_river_showdown_transition::test_showdown_after_river_has_no_current_player` fails with the current uncommitted changes. The root cause is concurrent changes to `hands.py` / `test_river_showdown_transition.py`, NOT the schema split itself. However, the working tree carries a regression that blocks a clean commit.

**Resolution criteria:**
1. `test_showdown_after_river_has_no_current_player` passes with all working-tree changes applied
2. Root cause in `hands.py` or test file is identified and fixed
3. Full test suite (`uv run pytest test/`) passes clean

---

### F-2 — Route and test imports not updated to domain modules (HIGH)

**Severity:** HIGH
**Source:** aia-core-hapg

All 7 route files and all test files still import from `pydantic_models.app_models` instead of the new domain-specific modules. The task description explicitly requires "Update all imports across routes and tests" — this acceptance criterion is **not satisfied**.

**Resolution criteria:**
1. Every route file imports from the appropriate domain module (e.g., `pydantic_models.player_schemas`)
2. Every test file imports from the appropriate domain module
3. No remaining imports of split-out classes from `pydantic_models.app_models` (re-exports via `__init__.py` are acceptable for backward compat, but direct usage in src/test should target the domain module)
4. Full test suite passes after import migration

---

### F-3 — No `__all__` in new domain modules (MEDIUM)

**Severity:** MEDIUM
**Source:** aia-core-hapg

None of the 8 new domain modules define `__all__`. The wildcard `import *` in `app_models.py` re-exports all names including transitive imports (`BaseModel`, `Field`, `datetime`, etc.), polluting the module namespace.

**Resolution criteria:**
1. Each new domain module defines `__all__` listing only its public classes/types
2. `app_models.py` re-export is verified to surface only intended names

---

### F-4 — Split verification tests incomplete (MEDIUM)

**Severity:** MEDIUM
**Source:** aia-core-hapg

`test_player_schemas_split.py` only covers the 10 `player_schemas` classes. No direct-import verification tests exist for the other 7 new domain modules.

**Resolution criteria:**
1. Each of the 8 domain modules has at least one test verifying direct import works
2. Tests confirm expected classes are importable from the domain module

---

### F-5 — Beads close reason understates work (LOW)

**Severity:** LOW
**Source:** aia-core-hapg

The beads close reason does not adequately describe the scope of changes made. Cosmetic — update when closing the corrective cycle.

**Resolution criteria:**
1. Close reason updated to reflect actual deliverables
