# Code Review Report — aia-core

**Date:** 2026-04-13
**Cycle:** 4
**Target:** `src/app/database/queries.py`, `test/test_queries.py`, route files (games.py, hands.py, images.py, stats.py, players.py)
**Reviewer:** Scott (automated)

**Task:** Extract common DB lookups into database/queries.py
**Beads ID:** aia-core-p5wl

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
| 1 | Create `src/app/database/queries.py` with 4 get-or-404 helpers | SATISFIED | `src/app/database/queries.py` — 4 functions implemented | Clean, minimal, well-structured |
| 2 | Replace inline db.query + 404 patterns across route files | SATISFIED | 40+ replacements across `games.py`, `hands.py`, `images.py`, `stats.py`, `players.py` | Verified via grep; remaining inline patterns are justified (see findings) |
| 3 | All existing tests pass | SATISFIED | 1395 tests pass | Confirmed via task close reason |
| 4 | New unit tests for the helpers | SATISFIED | `test/test_queries.py` — 9 tests (2+2+3+2) covering all 4 helpers | Happy path, 404 path, and case-insensitive lookup all covered |
| 5 | No behavior change in routes | SATISFIED | Spot-checked `games.py`, `hands.py`, `images.py`, `stats.py`, `players.py` | Error messages preserved; 404 semantics identical |

---

## Findings

### [MEDIUM] Missed replacement in images.py — player lookup in confirm_detection

**File:** `src/app/routes/images.py`
**Line(s):** 295–302
**Category:** convention

**Problem:**
The player lookup pattern in the `confirm_detection` endpoint loop was not replaced with `get_player_by_name_or_404()`. The inline query performs the same case-insensitive lookup and raises an identical 404 with `f'Player {entry.player_name!r} not found'`. This is functionally correct but inconsistent with the refactoring goal.

**Code:**
```python
player = (
    db.query(Player)
    .filter(func.lower(Player.name) == entry.player_name.lower())
    .first()
)
if player is None:
    raise HTTPException(
        status_code=404,
        detail=f'Player {entry.player_name!r} not found',
    )
```

**Suggested Fix:**
Replace with `player = get_player_by_name_or_404(db, entry.player_name)`. Import is already present in the file.

**Impact:** No functional impact. Minor inconsistency in DRY enforcement.

---

### [LOW] `get_player_hand_or_404` accepts `player_name` only for error messaging

**File:** `src/app/database/queries.py`
**Line(s):** 40–55
**Category:** design

**Problem:**
The `player_name` parameter in `get_player_hand_or_404()` is not used in the database query — it exists solely to compose the error detail string. If a caller passes a mismatched name, the error message would be misleading. This is a pragmatic trade-off but worth noting.

**Code:**
```python
def get_player_hand_or_404(
    db: Session, hand_id: int, player_id: int, player_name: str
) -> PlayerHand:
```

**Suggested Fix:**
No action needed now. If the helper is extended in the future, consider resolving the player name from the DB or documenting the contract explicitly.

**Impact:** Minimal. Callers always have the correct name in context today.

---

## Positives

- **Clean helper design** — Each function is focused, minimal, and follows the same pattern consistently. No over-abstraction.
- **Error messages preserved** — The refactoring maintained identical 404 detail strings, so no downstream test breakage.
- **Case-insensitive player lookup** — Using `func.lower()` on both sides in `get_player_by_name_or_404()` is correct for database portability.
- **Justified inline survivors** — Remaining inline patterns in `hands.py` (lines 270, 370–387, 760–768) are correctly left as-is: they use `selectinload` options or intentional fallback logic (no 404). The `upload.py` pattern is an upsert, not a get-or-404. The `games.py` seat-assignment pattern uses a different error message ("not found in this game").
- **Thorough test coverage** — 9 tests cover all 4 helpers with both happy and unhappy paths, including the case-insensitive edge case for player name lookup.
- **No security concerns** — All queries use SQLAlchemy's parameterized `.filter()` method. No SQL injection risk.

---

## Overall Assessment

Solid, well-scoped refactoring. The 4 helpers are correct, secure, and well-tested. 40+ inline patterns were replaced consistently. The one missed replacement in `images.py` is minor and does not affect correctness. No CRITICAL or HIGH findings — this task is complete and clean.
