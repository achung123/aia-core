# Code Review Report — aia-core (Cycle 5)

**Date:** 2026-04-13
**Target:** ORM cascade deletes — `src/app/database/models.py`, `src/app/routes/games.py`, `src/app/routes/hands.py`, `test/test_cascade_deletes.py`
**Reviewer:** Scott (automated)
**Cycle:** 5
**Task:** aia-core-54mw — Add cascade deletes on ORM relationships

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 3 |
| LOW | 2 |
| **Total Findings** | **5** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| AC-1 | `cascade='all, delete-orphan'` on GameSession→Hand | SATISFIED | `src/app/database/models.py` L51-53 | Correctly defined |
| AC-2 | `cascade='all, delete-orphan'` on Hand→PlayerHand | SATISFIED | `src/app/database/models.py` L96-98 | Correctly defined |
| AC-3 | `cascade='all, delete-orphan'` on PlayerHand→PlayerHandAction | SATISFIED | `src/app/database/models.py` L123-125 | Correctly defined |
| AC-4 | `cascade='all, delete-orphan'` on Hand→HandState | SATISFIED | `src/app/database/models.py` L99-101 | `uselist=False` correct for 1:1 |
| AC-5 | Remove manual cascade delete code from `delete_game()` | SATISFIED | `src/app/routes/games.py` L392-403 | Manual hand/player_hand/action/state deletes removed; Rebuy and GamePlayer manual deletes correctly retained |
| AC-6 | Remove manual cascade delete code from `delete_hand()` | SATISFIED | `src/app/routes/hands.py` L1247-1258 | Reduced to `db.delete(hand)` + commit |
| AC-7 | Test verification | SATISFIED | `test/test_cascade_deletes.py` — 6 tests | Covers game cascade, hand cascade, sibling isolation, orphan removal |

---

## Findings

### [MEDIUM] M-1: Rebuy has no ORM relationship — cannot benefit from cascade

**File:** `src/app/database/models.py`
**Line(s):** 218-227 (Rebuy class) and `src/app/routes/games.py` L402
**Category:** design

**Problem:**
The `Rebuy` model has a `ForeignKey('game_sessions.game_id')` but `GameSession` has no `rebuys` relationship. Consequently, `delete_game()` must manually delete rebuys with `db.query(Rebuy).filter(Rebuy.game_id == game_id).delete()`. This is inconsistent with the cascade pattern applied to the rest of the hierarchy and means a future developer adding another delete path for games could forget the manual Rebuy cleanup.

**Suggested Fix:**
Add a relationship to `GameSession`:
```python
rebuys = relationship('Rebuy', back_populates='game_session', cascade='all, delete-orphan')
```
And a corresponding `back_populates` on `Rebuy`. Then remove the manual delete line from `delete_game()`.

**Impact:** Orphaned Rebuy rows if a new delete path is introduced without the manual cleanup.

---

### [MEDIUM] M-2: `test_cascade_deletes_player_hands` does not verify player_hands deletion

**File:** `test/test_cascade_deletes.py`
**Line(s):** 89-96
**Category:** correctness

**Problem:**
The test is named `test_cascade_deletes_player_hands` but its assertions only check that the game returns 404 after deletion. It does not query the `player_hands` table to confirm rows were actually removed. This makes the test misleading — it duplicates the intent of `test_cascade_deletes_hands` without verifying its namesake claim. The thorough verification is done in `test_cascade_deletes_all_children_via_orm`, so this test adds a false sense of coverage.

**Suggested Fix:**
Either (a) add a direct DB query verifying `PlayerHand` rows with matching `hand_id`s are gone, or (b) rename the test to reflect what it actually asserts (e.g., `test_delete_game_returns_404_after_delete`).

**Impact:** Misleading test name could mask a regression if the thorough ORM test is later removed or skipped.

---

### [MEDIUM] M-3: No `PRAGMA foreign_keys = ON` on production SQLite engine

**File:** `src/app/database/session.py`
**Line(s):** 14
**Category:** correctness

**Problem:**
SQLite disables foreign key enforcement by default. The production engine in `session.py` is created without an event listener to execute `PRAGMA foreign_keys = ON`. While ORM-level cascade (`db.delete()`) works regardless because SQLAlchemy issues the child deletes in Python, any raw SQL `DELETE` or bulk `db.query(...).delete()` that bypasses the ORM (like the manual Rebuy/GamePlayer deletes in `delete_game()`) will not enforce FK constraints at the DB level. This is a pre-existing issue (tracked as T-050) but is directly relevant to cascade delete correctness.

**Suggested Fix:**
Add an event listener on the engine:
```python
from sqlalchemy import event

@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()
```

**Impact:** DB-level FK constraints are unenforced; raw SQL deletes could leave orphaned rows.

---

### [LOW] L-1: Test file duplicates conftest DB setup pattern

**File:** `test/test_cascade_deletes.py`
**Line(s):** 19-44
**Category:** convention

**Problem:**
The test file creates its own engine, session factory, `_override_get_db`, and `setup_db` fixture instead of using the shared `conftest.py` fixtures (`setup_and_teardown_db`, `client`). This diverges from the pattern used by the majority of test files in the project.

**Suggested Fix:**
Remove the custom DB setup and use the conftest fixtures directly. The `_get_db()` helper for direct DB queries can use `conftest.SessionLocal` instead.

**Impact:** Maintenance burden — changes to the shared test DB setup won't apply to this file.

---

### [LOW] L-2: `_get_db()` helper does not use context manager pattern

**File:** `test/test_cascade_deletes.py`
**Line(s):** 69-71
**Category:** convention

**Problem:**
The `_get_db()` function returns a raw session that must be manually closed in a `try/finally` block at every call site. A context manager (`@contextmanager`) would be safer and more Pythonic.

**Suggested Fix:**
```python
from contextlib import contextmanager

@contextmanager
def _get_db():
    db = _SessionLocal()
    try:
        yield db
    finally:
        db.close()
```
Then use `with _get_db() as db:` at call sites.

**Impact:** Minor — risk of leaked sessions if a test fails before reaching `db.close()`.

---

## Positives

- **Cascade definitions are correct and complete** for the 4 targeted relationships — `all, delete-orphan` is the right choice, and `uselist=False` is properly set on the 1:1 `Hand.state` relationship
- **`delete_hand()` is now clean** — reduced to `db.delete(hand)` + `db.commit()`, which is the ideal ORM pattern
- **`delete_game()` correctly retains** manual deletes for `Rebuy` and `GamePlayer` which lack cascade relationships — no premature removal
- **Orphan removal test** (`test_removing_hand_from_game_deletes_orphan`) is a thoughtful addition that verifies `delete-orphan` behavior beyond simple parent deletion
- **`test_cascade_deletes_all_children_via_orm`** provides thorough DB-level verification of the full cascade chain including `PlayerHandAction`
- **Sibling isolation test** confirms deleting one hand doesn't affect others — good regression guard
- **1401 tests pass** — no regressions introduced

---

## Overall Assessment

The implementation is **solid and correctly scoped**. All 4 targeted ORM relationships have proper cascade definitions, the delete functions were appropriately simplified, and the test coverage is meaningful. No CRITICAL or HIGH issues found.

The 3 MEDIUM findings are all improvement opportunities rather than bugs:
1. **Rebuy relationship gap** is the most actionable — adding a cascade relationship would eliminate the last manual delete and complete the pattern
2. **Misleading test name** should be fixed to avoid confusion
3. **PRAGMA foreign_keys** is a pre-existing gap (T-050) with broader scope than this task

Recommendation: Close aia-core-54mw as complete. File a follow-up for M-1 (Rebuy cascade relationship) if desired.
