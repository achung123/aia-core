# Code Review Report — alpha-feedback-008

**Date:** 2026-04-12
**Target:** Blind management endpoints (GET + PATCH)
**Reviewer:** Scott (automated)
**Cycle:** 9

**Task:** T-012 — Blind management endpoints (GET + PATCH)
**Beads ID:** aia-core-glk0

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 1 |
| MEDIUM | 2 |
| LOW | 1 |
| **Total Findings** | **4** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | GET returns { small_blind, big_blind, blind_timer_minutes, blind_timer_paused, blind_timer_started_at } | SATISFIED | `test_blinds_api.py::TestGetBlinds::test_get_blinds_returns_defaults` asserts all 5 fields | BlindsResponse model matches spec |
| 2 | PATCH accepts partial updates for any blind field | SATISFIED | `test_blinds_api.py::TestPatchBlindsPartialUpdate::test_patch_blind_timer_minutes_only` — sends single field, verifies others unchanged | Pydantic `None` sentinel pattern works correctly |
| 3 | Updating small_blind or big_blind resets blind_timer_started_at to now | SATISFIED | `test_blinds_api.py::TestAdvanceBlinds` — 3 tests cover small, big, and both | Timer reset and pause=False logic at lines 235–237 of games.py |
| 4 | Pausing stores implicit remaining time; resuming adjusts blind_timer_started_at | PARTIAL | `test_pause_sets_flag` and `test_resume_adjusts_started_at` exercise the paths | Resume sets started_at=now, which resets full duration. See HIGH finding #1 |
| 5 | Tests cover: read, advance blinds, pause, resume, partial update | SATISFIED | 9 tests across 5 test classes | All scenarios exercised |
| 6 | uv run pytest test/ passes | SATISFIED | 1058 passed, 0 failed | Full suite confirmed |

---

## Findings

### [HIGH] Resume logic resets full timer duration instead of preserving remaining time

**File:** `src/app/routes/games.py`
**Line(s):** 226–231
**Category:** correctness

**Problem:**
AC-4 specifies that pausing "stores the implicit remaining time" and resuming "adjusts blind_timer_started_at" to continue from where it left off. The current resume branch sets `blind_timer_started_at = now`, which gives the client a full `blind_timer_minutes` remaining — effectively resetting the timer regardless of how much time elapsed before the pause.

Example: Timer is 15 min, started at T0. Paused at T0+10min (5 min remaining). Resumed at T0+20min. Code sets `started_at = T0+20min`, so client computes 15 min remaining instead of 5.

The root cause is that the pause timestamp is never stored. Without knowing *when* the timer was paused, the server cannot compute elapsed time on resume.

**Code:**
```python
elif not payload.blind_timer_paused and was_paused:
    # Resuming: adjust blind_timer_started_at forward so the
    # remaining time restarts from where it was paused
    if game.blind_timer_started_at is not None:
        game.blind_timer_started_at = now
    game.blind_timer_paused = False
```

**Suggested Fix:**
Either:
1. Add a `blind_timer_paused_at` DateTime column. On pause, store `now`. On resume, compute `elapsed = paused_at - started_at` and set `started_at = now - elapsed`.
2. Or add a `blind_timer_remaining_seconds` Integer column. On pause, compute and store remaining. On resume, set `started_at = now - (timer_minutes*60 - remaining_seconds)`.

Option 1 is simpler and aligns with the existing schema pattern.

**Impact:** Pause/resume always gives a full timer restart. Low real-world severity for a poker game (dealer can manually adjust), but contradicts spec.

---

### [MEDIUM] No validation for negative or zero blind amounts

**File:** `src/pydantic_models/app_models.py`
**Line(s):** 406–407
**Category:** correctness

**Problem:**
`BlindsUpdate.small_blind` and `BlindsUpdate.big_blind` are `float | None` with no constraints. A client can send `{"small_blind": -5.0}` or `{"small_blind": 0}` and the server will accept and persist it. Negative blinds are nonsensical in poker. The existing codebase uses `Field()` with constraints elsewhere (e.g., `min_length=1` on `player_names`).

**Code:**
```python
class BlindsUpdate(BaseModel):
    small_blind: float | None = None
    big_blind: float | None = None
    blind_timer_minutes: int | None = None
    blind_timer_paused: bool | None = None
```

**Suggested Fix:**
```python
small_blind: float | None = Field(default=None, gt=0)
big_blind: float | None = Field(default=None, gt=0)
```

**Impact:** Invalid data can be persisted; downstream consumers (frontend timer, stats) may behave unexpectedly.

---

### [MEDIUM] No validation for negative or zero timer minutes

**File:** `src/pydantic_models/app_models.py`
**Line(s):** 408
**Category:** correctness

**Problem:**
`blind_timer_minutes` accepts any integer including 0 and negative values. A 0-minute timer or negative timer is meaningless and could cause divide-by-zero or negative countdown on the frontend.

**Suggested Fix:**
```python
blind_timer_minutes: int | None = Field(default=None, gt=0)
```

**Impact:** Similar to blind amounts — invalid timer values can be persisted.

---

### [LOW] Simultaneous blind change + pause in same PATCH silently overrides pause

**File:** `src/app/routes/games.py`
**Line(s):** 221–237
**Category:** design

**Problem:**
If a client sends `{"small_blind": 0.50, "blind_timer_paused": true}`, the pause logic at line 224 sets `blind_timer_paused = True`, but then the `blinds_changed` block at line 236 sets `blind_timer_paused = False`. The pause is silently dropped. While arguably correct (advancing blinds implies a running timer), the behavior is implicit and could confuse API consumers.

**Code:**
```python
# Pause logic runs first
if payload.blind_timer_paused and not was_paused:
    game.blind_timer_paused = True
...
# Blind change wins
if blinds_changed:
    game.blind_timer_started_at = now
    game.blind_timer_paused = False
```

**Suggested Fix:**
Consider documenting this precedence in the API response or raising a 422 if both blind amounts and pause=True are sent in the same request. Alternatively, a brief comment explaining the intentional override is sufficient.

**Impact:** Minor — unlikely real-world scenario, but API behavior is non-obvious.

---

## Positives

- **Clean TDD structure**: 9 tests organized into 5 classes that map directly to acceptance criteria. Easy to trace coverage.
- **Idiomatic partial update**: Using Pydantic `None` sentinels for optional fields is the correct FastAPI pattern.
- **Consistent patterns**: Follows existing endpoint conventions — same 404 handling, same `Annotated[Session, Depends(get_db)]` pattern, same response model approach.
- **Secure by default**: SQLAlchemy ORM queries prevent SQL injection; Pydantic validates types; `game_id: int` in path prevents type confusion.
- **Good test helpers**: `_create_game()` and `_utcnow_naive()` reduce test boilerplate without over-abstracting.

---

## Overall Assessment

The implementation is solid and production-ready for the core read/write flows. The GET and PATCH endpoints follow existing codebase conventions, tests are well-organized, and all 1058 tests pass.

The one **HIGH** finding — the resume logic not preserving remaining time — is a functional gap against AC-4. It requires a schema addition (pause timestamp or remaining seconds) and should be addressed in a follow-up task. The two **MEDIUM** findings (missing input validation) are straightforward `Field()` additions that would bring the new models in line with existing validation patterns.

No CRITICAL issues found.
