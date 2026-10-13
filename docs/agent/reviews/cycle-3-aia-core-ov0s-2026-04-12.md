# Code Review Report — aia-core-ov0s

**Date:** 2026-04-12
**Cycle:** 3
**Target:** Bug fix — blind timer resume preserves remaining time
**Reviewer:** Scott (automated)

**Task:** T-012 (AC-4 fix) — Blind timer resume resets full duration instead of preserving remaining time
**Beads ID:** aia-core-ov0s
**Epic:** alpha-feedback-008

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
| 1 | Add column to store remaining time on pause | SATISFIED | `src/app/database/models.py` L49: `blind_timer_remaining_seconds = Column(Integer, nullable=True)` | Nullable Integer column; Alembic migration `e08af6081a61` adds it correctly |
| 2 | On pause: compute and store remaining_seconds | SATISFIED | `src/app/routes/games.py` L237-243: elapsed/total/remaining calculation with `max(0, ...)` clamp | Test `test_pause_stores_remaining_seconds` validates ~420s for 3min elapsed on 10min timer |
| 3 | On resume: use remaining_seconds to compute adjusted started_at | SATISFIED | `src/app/routes/games.py` L246-254: `elapsed_before_pause = total - remaining; started_at = now - elapsed` | Test `test_resume_preserves_remaining_time` validates 4min elapsed preserved across pause/resume |
| 4 | Advancing blinds clears remaining_seconds | SATISFIED | `src/app/routes/games.py` L260-262: `blind_timer_remaining_seconds = None` in `blinds_changed` block | Prevents stale remaining_seconds from a prior pause |
| 5 | GET /blinds includes remaining_seconds in response | SATISFIED | `src/pydantic_models/app_models.py` L410: `blind_timer_remaining_seconds: int | None = None` | Test `test_get_blinds_returns_remaining_seconds_field` confirms field presence |
| 6 | Tests cover pause/resume remaining time | SATISFIED | 3 new tests in `TestPauseResumeRemainingTime` + 1 updated `TestResumeBlinds` | 12/12 tests passing |

---

## Findings

### [MEDIUM] F-001: Reducing blind_timer_minutes while paused can set started_at in the future

**File:** `src/app/routes/games.py`
**Line(s):** 246-254
**Category:** correctness

**Problem:**
If a user pauses the timer, then separately reduces `blind_timer_minutes` (which does NOT trigger `blinds_changed`), `remaining_seconds` can exceed the new total duration. On resume, `elapsed_before_pause = total - remaining_seconds` becomes negative, setting `started_at` to a point in the future. The frontend would then display more remaining time than the total blind duration.

Example: 10-min timer running for 4 min → pause (360s remaining) → PATCH `blind_timer_minutes: 4` (240s total) → resume: `elapsed = 240 - 360 = -120`, `started_at = now + 120s`.

**Code:**
```python
total = game.blind_timer_minutes * 60
elapsed_before_pause = total - game.blind_timer_remaining_seconds
game.blind_timer_started_at = now - timedelta(seconds=elapsed_before_pause)
```

**Suggested Fix:**
Clamp `elapsed_before_pause` to `max(0, ...)`, or clamp `remaining_seconds` to not exceed the current total on resume:
```python
total = game.blind_timer_minutes * 60
remaining = min(game.blind_timer_remaining_seconds, total)
elapsed_before_pause = total - remaining
game.blind_timer_started_at = now - timedelta(seconds=elapsed_before_pause)
```

**Impact:** Timer UI shows incorrect remaining time after reducing blind duration while paused. Low probability in normal gameplay but possible via API.

---

### [LOW] F-002: Missing edge-case test coverage

**File:** `test/test_blinds_api.py`
**Line(s):** (entire file)
**Category:** correctness

**Problem:**
The following scenarios are not covered by tests:
1. **Double pause** — sending `blind_timer_paused: true` when already paused (should be no-op, remaining_seconds should NOT be recomputed)
2. **Double resume** — sending `blind_timer_paused: false` when already unpaused (should be no-op)
3. **Pause with no started timer** — pausing when `blind_timer_started_at` is None (e.g., game just created, no blinds advanced yet)
4. **Timer-minutes change while paused** — reducing `blind_timer_minutes` while remaining_seconds is set (the F-001 scenario)

**Suggested Fix:**
Add test cases for each scenario to prevent regressions. The production code handles cases 1-3 correctly today; these tests would document and protect that behavior.

**Impact:** Low immediate risk — the code handles these paths correctly. But without tests, future refactors could silently break them.

---

### [LOW] F-003: Test helper `_set_started_at` uses fragile DB access pattern

**File:** `test/test_blinds_api.py`
**Line(s):** 148-163
**Category:** convention

**Problem:**
The `_set_started_at` helper accesses the test DB via `__import__('app.database.session', fromlist=['get_db'])` and `client.app.dependency_overrides[...]`, then calls `next(db_gen())` without properly exhausting the generator. The `finally` block in the overridden `get_db` only runs on garbage collection, not deterministically.

**Code:**
```python
db_gen = client.app.dependency_overrides[
    __import__('app.database.session', fromlist=['get_db']).get_db
]
db = next(db_gen())
```

**Suggested Fix:**
Import `get_db` directly and use a context pattern:
```python
from app.database.session import get_db

gen = client.app.dependency_overrides[get_db]()
db = next(gen)
try:
    game = db.query(GameSession).filter(...).first()
    game.blind_timer_started_at = started_at
    db.commit()
finally:
    try:
        next(gen)
    except StopIteration:
        pass
```
Or simpler: import `SessionLocal` from conftest directly, since all tests share the same `StaticPool` engine.

**Impact:** Cosmetic / maintainability. Works correctly today due to CPython's reference counting, but is fragile under PyPy or if the cleanup logic in `override_get_db` becomes more complex.

---

## Positives

1. **Correct math** — The pause/resume arithmetic is sound: `remaining = total - elapsed` on pause, `started_at = now - (total - remaining)` on resume. The `max(0, ...)` clamp on pause prevents negative remaining.
2. **Clean state management** — `blinds_changed` block correctly resets `remaining_seconds` to None, preventing stale values from a prior pause from leaking through.
3. **Good separation** — `remaining_seconds` is stored on the model but is NOT exposed in `BlindsUpdate` (not user-settable), only in `BlindsResponse` (read-only). This is the right design.
4. **Well-structured tests** — The `_set_started_at` helper enables deterministic timing tests by backdating `started_at`. Tolerance windows (±5s) account for test execution time without being fragile.
5. **Migration** — Uses `batch_alter_table` for SQLite compatibility. Clean upgrade/downgrade. Nullable column avoids breaking existing rows.
6. **Guard clauses** — Both pause and resume check for `started_at is not None` before computing, safely handling the case where the timer was never started.

---

## Overall Assessment

The bug fix is **solid and correctly addresses the reported issue**. The core pause/resume logic is mathematically sound, well-guarded, and properly tested. The Alembic migration is clean, and the Pydantic model change is appropriately scoped.

The one MEDIUM finding (F-001) is an edge case that requires a specific sequence of API calls unlikely in normal gameplay but worth addressing with a one-line clamp. The two LOW findings are test-quality improvements that would strengthen the test suite.

**Verdict:** No critical issues. Implementation is correct and ready for production.
