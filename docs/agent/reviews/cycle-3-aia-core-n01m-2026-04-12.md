# Code Review Report — alpha-patch-009

**Date:** 2026-04-12
**Cycle:** 3
**Target:** Bug fix for negative action amounts (`aia-core-n01m`)
**Reviewer:** Scott (automated)

**Task:** Bug: negative action amounts accepted in betting API
**Beads ID:** aia-core-n01m
**Epic:** alpha-patch-009

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
| 1 | Negative amounts on PlayerActionCreate are rejected with 422 | SATISFIED | `PlayerActionCreate.amount` uses `Field(default=None, ge=0)` at `app_models.py:500`; test `test_negative_amount_returns_422` confirms 422 | One-line Pydantic constraint, enforceable at the FastAPI boundary |

---

## Findings

### [MEDIUM] BlindsUpdate accepts negative blind values

**File:** `src/pydantic_models/app_models.py`
**Line(s):** 455–456
**Category:** security

**Problem:**
`BlindsUpdate.small_blind` and `BlindsUpdate.big_blind` are `float | None` with no `ge=0` constraint. A malicious or buggy client could set blinds to negative values, which would corrupt pot calculations downstream (since the betting service trusts `hand_state.small_blind` and `hand_state.big_blind` when posting blinds).

**Code:**
```python
class BlindsUpdate(BaseModel):
    small_blind: float | None = None
    big_blind: float | None = None
```

**Suggested Fix:**
Apply the same `Field(ge=0)` pattern:
```python
small_blind: float | None = Field(default=None, ge=0)
big_blind: float | None = Field(default=None, ge=0)
```

**Impact:** Negative blinds would cause negative pot values and break downstream betting logic. Same class of bug as `aia-core-n01m`. Should be filed as a separate issue.

---

### [LOW] Test does not assert on the 422 error detail message

**File:** `test/test_betting_state_machine.py`
**Line(s):** 68–72
**Category:** correctness

**Problem:**
The test verifies the response status code is 422 but does not check the error detail payload. Asserting on the specific validation error (e.g., that it mentions `amount` and the `ge` constraint) would guard against false positives where 422 is returned for a different validation failure.

**Code:**
```python
def test_negative_amount_returns_422(self, client):
    """A negative amount on a player action must be rejected by validation."""
    game_id = _create_game(client, ['Alice', 'Bob', 'Charlie'])
    _start_hand(client, game_id)
    current = _current(client, game_id)
    resp = _act(client, game_id, current, 'call', amount=-5.0)
    assert resp.status_code == 422
```

**Suggested Fix:**
Add an assertion on the response body:
```python
assert resp.status_code == 422
detail = resp.json()['detail']
assert any('amount' in str(e.get('loc', '')) for e in detail)
```

**Impact:** Minor — the test is correct as written; this would only improve diagnostic specificity.

---

## Positives

- **Minimal, targeted fix** — a single `Field(ge=0)` addition solves the bug at the Pydantic validation boundary, before any business logic runs. This is the ideal layer for input validation.
- **Regression test added** — the test creates a realistic game state and exercises the real API endpoint, confirming the constraint fires through FastAPI's request parsing.
- **Existing `RebuyCreate.amount` already uses `Field(gt=0)`** — the codebase has a precedent for numeric constraints on monetary fields, so this fix is consistent with the existing pattern.

---

## Overall Assessment

The fix is **correct and sufficient** for the stated bug. The `ge=0` constraint on `PlayerActionCreate.amount` prevents negative values at the API boundary via Pydantic validation, and the regression test confirms the behavior end-to-end.

One **MEDIUM** finding: `BlindsUpdate` has the same class of vulnerability (no `ge=0` on blind amounts). This should be addressed in a follow-up issue since it's outside the scope of this bug fix.

**Verdict:** Clean — no CRITICAL or HIGH findings. The fix can ship as-is.
