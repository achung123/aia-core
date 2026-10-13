# Code Review Report — aia-core

**Date:** 2026-04-12
**Cycle:** 4
**Target:** Blind fields on game_sessions (model, migration, tests)
**Reviewer:** Scott (automated)

**Task:** T-004 — Alembic migration — blind fields on game_sessions
**Beads ID:** aia-core-m70e

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
| 1 | small_blind Float default 0.10, big_blind Float default 0.20 | SATISFIED | `src/app/database/models.py` L40-41; `test/test_blind_fields.py::TestBlindFieldDefaults::test_small_blind_defaults_to_0_10`, `test_big_blind_defaults_to_0_20` | Model defaults and migration server_defaults both correct |
| 2 | blind_timer_minutes Integer default 15, blind_timer_paused Boolean default false | SATISFIED | `src/app/database/models.py` L42-43; `test/test_blind_fields.py::TestBlindFieldDefaults::test_blind_timer_minutes_defaults_to_15`, `test_blind_timer_paused_defaults_to_false` | |
| 3 | blind_timer_started_at DateTime nullable | SATISFIED | `src/app/database/models.py` L44; `test/test_blind_fields.py::TestBlindFieldDefaults::test_blind_timer_started_at_defaults_to_none` | |
| 4 | Existing games get default values; migration applies cleanly | SATISFIED | `alembic/versions/e1cc346116d4_add_blind_fields_to_game_sessions.py` — all 5 columns use `server_default` in upgrade, batch mode for SQLite compat | Migration uses `batch_alter_table` correctly; server_defaults ensure existing rows are populated |
| 5 | uv run pytest test/ passes | SATISFIED | 16/16 tests pass in `test/test_blind_fields.py`; full suite reported 1018 passed at task close | |

---

## Findings

### [MEDIUM] Pydantic schemas do not expose blind fields

**File:** `src/pydantic_models/app_models.py`
**Line(s):** 117-141
**Category:** design

**Problem:**
`GameSessionCreate`, `GameSessionListItem`, and `GameSessionResponse` do not include the new blind columns. The API currently has no way to set blind values when creating a game or retrieve them in responses. Clients cannot configure blinds through the REST API.

**Suggested Fix:**
Add blind fields to the Pydantic schemas in a follow-up task:
- `GameSessionCreate`: optional `small_blind`, `big_blind`, `blind_timer_minutes` fields with defaults matching the model
- `GameSessionResponse` / `GameSessionListItem`: include the blind fields so they are returned to clients

**Impact:** Blind fields exist in the DB but are invisible to the API layer. This is acceptable if Pydantic schema updates are planned as a separate task, but should be tracked.

---

### [LOW] Tautological assertion in type test

**File:** `test/test_blind_fields.py`
**Line(s):** 67
**Category:** correctness

**Problem:**
```python
assert isinstance(col.type, type(col.type))  # exists
```
`isinstance(x, type(x))` is always `True` for any object. This assertion provides no value — it can never fail. The comment says "exists" but the column's existence is already guaranteed by the `next()` call on line 66, which would raise `StopIteration` if the column were missing.

**Suggested Fix:**
Remove the tautological assertion. The meaningful assertion is on line 68 (`assert 'FLOAT' in str(col.type).upper() ...`) which already validates the type. The other type tests (lines 73, 79, 85, 91) correctly omit this pattern.

**Impact:** No functional impact — the test still validates the type via the string assertion on the next line. This is purely a dead assertion.

---

## Positives

- **Migration is well-structured**: Uses `batch_alter_table` for SQLite compatibility, includes proper `server_default` values for all non-nullable columns, and has a correct reverse-order downgrade path.
- **Boolean server_default uses `sa.text('0')`**: Correctly handles SQLite's integer-based boolean storage rather than using a string `'false'` which SQLite wouldn't interpret correctly.
- **Test coverage is thorough**: 16 tests organized into 4 logical groups (existence, types, defaults, explicit values) provide complete coverage of the new columns.
- **`pytest.approx` for float comparisons**: Correctly avoids floating-point equality pitfalls in default value tests.
- **Migration chain is valid**: `down_revision = '52d3d811056e'` correctly links to the previous migration (`add_sb_bb_player_ids_to_hands`).

---

## Overall Assessment

Clean implementation with no critical or high-severity issues. The model columns, migration, and tests are correct and well-aligned. The only actionable item is the missing Pydantic schema updates (MEDIUM), which should be tracked as a follow-up task to expose blind fields through the API. The tautological assertion (LOW) is cosmetic. **Approved for merge.**
