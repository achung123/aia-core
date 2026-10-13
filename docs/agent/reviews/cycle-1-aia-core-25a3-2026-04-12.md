# Code Review Report — aia-core

**Date:** 2026-04-12
**Target:** `aia-core-25a3 — Alembic migration: is_active on game_players`
**Reviewer:** Scott (automated)
**Cycle:** 1
**Epic:** alpha-feedback-008

**Task:** T-001 — Alembic migration — is_active on game_players
**Beads ID:** aia-core-25a3

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 1 |
| LOW | 2 |
| **Total Findings** | **3** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | `alembic revision --autogenerate` produces a valid migration | SATISFIED | `alembic/versions/2b5508c850b1_add_is_active_to_game_players.py` exists with correct upgrade/downgrade | Migration uses `batch_alter_table` (correct for SQLite) |
| 2 | `alembic upgrade head` succeeds; existing rows get `is_active = true` | SATISFIED | Migration uses `server_default=sa.text('1')` on a NOT NULL column — existing rows receive `1` (true) | Verified via code inspection |
| 3 | GamePlayer model has `is_active = Column(Boolean, default=True, nullable=False)` | SATISFIED | `src/app/database/models.py` line 53 | Exact match to spec |
| 4 | `uv run pytest test/` passes | SATISFIED | 970 passed, 1 warning in 54.43s | Full suite green |

---

## Findings

### [MEDIUM] Model/migration server_default drift

**File:** `src/app/database/models.py`
**Line(s):** 53
**Category:** correctness

**Problem:**
The model declares `default=True` (Python-side ORM default) but has no `server_default`. The migration adds the column with `server_default=sa.text('1')` (database-side default). After the migration runs, the database schema carries a `server_default` that the model does not declare. A future `alembic revision --autogenerate` will detect this drift and generate a migration to **remove** the `server_default`, which could break subsequent `ADD COLUMN ... NOT NULL` operations or surprise the team.

**Code:**
```python
# models.py — missing server_default
is_active = Column(Boolean, default=True, nullable=False)

# migration — has server_default
sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('1'))
```

**Suggested Fix:**
Add `server_default=sa.text('1')` to the model column to keep model and migration in sync:
```python
is_active = Column(Boolean, default=True, server_default=sa.text('1'), nullable=False)
```

**Impact:** Future autogenerate may produce an unwanted migration removing the server_default.

---

### [LOW] Unused `client` fixture in tests

**File:** `test/test_game_player_is_active.py`
**Line(s):** 16, 37
**Category:** convention

**Problem:**
`test_game_player_is_active_defaults_to_true(client)` and `test_game_player_is_active_can_be_set_false(client)` accept the `client` fixture but never use it for HTTP calls. The `setup_and_teardown_db` autouse fixture already creates/drops tables, so `client` is unnecessary overhead and misleading to readers.

**Code:**
```python
def test_game_player_is_active_defaults_to_true(client):
    # client never referenced in body
```

**Suggested Fix:**
Remove the `client` parameter from both test functions.

**Impact:** Minor readability improvement; no functional risk.

---

### [LOW] Direct `SessionLocal` import instead of fixture

**File:** `test/test_game_player_is_active.py`
**Line(s):** 18, 39
**Category:** convention

**Problem:**
Both tests import `SessionLocal` from `conftest` inside the function body (`from conftest import SessionLocal`) and manually manage session lifecycle (`db.close()` in a `try/finally`). The existing codebase pattern for DB tests is to either use the `client` fixture with HTTP calls or parameterize with a DB session fixture. Direct import from `conftest` is non-standard.

**Code:**
```python
from conftest import SessionLocal
db = SessionLocal()
try:
    # ...
finally:
    db.close()
```

**Suggested Fix:**
Create a `db_session` fixture in conftest (or use the existing override pattern) and inject it into these tests, eliminating the manual session management.

**Impact:** Minor consistency concern; no functional risk.

---

## Positives

- **Migration is well-structured**: Uses `batch_alter_table` for SQLite compatibility, includes both `upgrade()` and `downgrade()`, and correctly uses `server_default` so existing rows are backfilled with `true`.
- **Test coverage is good**: All three tests target meaningful behavior — column existence, default value, and explicit override — covering the core acceptance criteria.
- **Model change is minimal and correct**: Single-line addition, matches the spec exactly, no unnecessary changes to surrounding code.

---

## Overall Assessment

The implementation is **correct and complete**. All four acceptance criteria are satisfied, the full test suite passes (970 tests), and the migration is properly structured for SQLite. The single MEDIUM finding (server_default drift) is a preventive concern for future autogenerate consistency, not a current bug. The two LOW findings are minor convention deviations. No CRITICAL or HIGH issues — this task is ready to unblock its dependents.
