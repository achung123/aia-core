# Code Review Report — aia-core

**Date:** 2026-04-12
**Cycle:** 2
**Target:** PlayerHandAction model, migration, and tests
**Reviewer:** Scott (automated)

**Task:** T-003 — Alembic migration — player_hand_actions table
**Beads ID:** aia-core-7jw1

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 2 |
| LOW | 1 |
| **Total Findings** | **3** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | Table schema: action_id (PK auto), player_hand_id (FK → player_hands.player_hand_id, not null), street (String, not null), action (String, not null), amount (Float, nullable), created_at (DateTime, default utcnow) | SATISFIED | `src/app/database/models.py` L107-L122; migration L24-L33; 14 schema tests in `TestPlayerHandActionModelExists` + `TestPlayerHandActionSchema` | All columns, types, constraints, and defaults match spec |
| 2 | PlayerHandAction model defined in models.py with relationship to PlayerHand | SATISFIED | `src/app/database/models.py` L105-L122; `test_player_hand_action_model.py::TestPlayerHandActionRelationships` | Model correctly placed alongside other models |
| 3 | Relationship: PlayerHand.actions ↔ PlayerHandAction.player_hand | SATISFIED | `models.py` L101 (`actions` on PlayerHand), L122 (`player_hand` on PlayerHandAction); 4 relationship tests | Bidirectional navigation verified in tests |
| 4 | Migration applies cleanly; uv run pytest test/ passes | SATISFIED | Single Alembic head `4d88a1c3a8d4`; 992 tests pass, 0 failures | Full suite green |

---

## Findings

### [MEDIUM] M-1: `server_default` on `created_at` diverges from project convention

**File:** `src/app/database/models.py`
**Line(s):** 117-120
**Category:** convention

**Problem:**
`PlayerHandAction.created_at` specifies both a Python-level `default` and a `server_default` with a SQLite `strftime` expression. Every other model in the file (Player, GameSession, Hand, PlayerHand, ImageUpload, CardDetection, DetectionCorrection) uses only the Python-level `default=lambda: datetime.now(timezone.utc)`. The dual-default approach is not wrong — it's arguably more robust — but it introduces an inconsistency across the codebase.

**Code:**
```python
created_at = Column(
    DateTime,
    default=lambda: datetime.now(timezone.utc),
    server_default=text("(strftime('%Y-%m-%dT%H:%M:%f', 'now'))"),
)
```

**Suggested Fix:**
Either (a) remove the `server_default` to match the existing convention, or (b) adopt `server_default` on all models in a separate task. Option (a) is lower risk for this PR.

**Impact:** No functional issue. Consistency concern only. If the project migrates away from SQLite, the `strftime` expression would need updating.

---

### [MEDIUM] M-2: Test file defines its own `db_session` fixture instead of using conftest

**File:** `test/test_player_hand_action_model.py`
**Line(s):** 15-35
**Category:** convention

**Problem:**
The test file creates a standalone `db_session` fixture with explicit `PRAGMA foreign_keys=ON`. The project conftest (`test/conftest.py`) provides a shared `setup_and_teardown_db` fixture plus `client`. The custom fixture is justified here because conftest doesn't enable FK enforcement, and several tests require it. However, the pattern diverges from other test files and duplicates session setup logic.

**Suggested Fix:**
This is acceptable as-is since conftest doesn't enable FK pragma and these tests specifically need it. Consider adding a shared `db_session_with_fk` fixture to conftest in a future task to avoid per-file duplication if more model tests need FK enforcement.

**Impact:** Maintenance cost if the DB setup changes (e.g., switching engines). Functional correctness is not affected.

---

### [LOW] L-1: `created_at` column is `nullable=True` in migration

**File:** `alembic/versions/4d88a1c3a8d4_add_player_hand_actions_table.py`
**Line(s):** 31
**Category:** design

**Problem:**
The `created_at` column is `nullable=True` in the migration (Alembic autogenerate default). While the `server_default` ensures a value is always populated, the column technically allows NULL. Other tables in the initial migration also have `created_at` as `nullable=True` with a similar pattern, so this is consistent — but it's worth noting that a `NOT NULL` constraint would be stricter.

**Code:**
```python
sa.Column('created_at', sa.DateTime(), server_default=sa.text("(strftime('%Y-%m-%dT%H:%M:%f', 'now'))"), nullable=True),
```

**Suggested Fix:**
No change needed for this PR — matches existing convention. A future task could tighten all `created_at` columns to `nullable=False` across the schema.

**Impact:** No practical risk since defaults always populate the value.

---

## Positives

- **Clean model definition** — follows existing column naming, type choices, and relationship patterns exactly
- **Well-structured migration** — proper upgrade/downgrade, correct revision chain, single head maintained
- **Thorough test coverage** — 22 tests organized into clear groups (existence, schema, CRUD, relationships) covering all ACs
- **FK enforcement in tests** — custom fixture correctly enables `PRAGMA foreign_keys=ON` to validate referential integrity, which the standard conftest doesn't do
- **All 992 tests pass** — no regressions introduced

---

## Overall Assessment

The implementation is **clean and correct**. All four acceptance criteria are fully satisfied. The model, migration, and tests are well-aligned. No CRITICAL or HIGH findings. The three findings (two MEDIUM, one LOW) are convention-level concerns that don't affect correctness or security. No code changes are required before closing this task.
