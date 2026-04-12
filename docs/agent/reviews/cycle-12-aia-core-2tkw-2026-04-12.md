# Code Review Report — alpha-feedback-008

**Date:** 2026-04-12
**Cycle:** 12
**Target:** Bug fix for `RebuyCreate.amount` accepting zero and negative values
**Reviewer:** Scott (automated)

**Task:** T-048 (parent) — Re-buy/buyback recording & listing endpoints
**Beads ID:** aia-core-2tkw — Bug: RebuyCreate.amount accepts zero and negative values

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 2 |
| LOW | 0 |
| **Total Findings** | **2** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | `RebuyCreate.amount` rejects negative values with 422 | SATISFIED | `test/test_rebuy_api.py` — `test_post_rebuy_negative_amount_422` | `Field(gt=0)` at `src/pydantic_models/app_models.py:149` |
| 2 | `RebuyCreate.amount` rejects zero values with 422 | SATISFIED | `test/test_rebuy_api.py` — `test_post_rebuy_zero_amount_422` | `gt=0` correctly excludes 0 |
| 3 | All tests pass | SATISFIED | Close reason: 1199 passed, 0 failed | — |

---

## Findings

### [MEDIUM] F-001: `GameSessionCreate.player_buy_ins` and `AddPlayerToGameRequest.buy_in` accept negative values

**File:** `src/pydantic_models/app_models.py`
**Line(s):** 125, 455
**Category:** correctness

**Problem:**
`GameSessionCreate.player_buy_ins` is `dict[str, float] | None` with no per-value constraint, and `AddPlayerToGameRequest.buy_in` is `float | None` with no `gt=0` guard. A client can create a game session or add a player with a negative buy-in (e.g., `{"player_buy_ins": {"Alice": -100}}`). This is the same class of bug that aia-core-2tkw fixed for rebuys.

**Code:**
```python
# Line 125
player_buy_ins: dict[str, float] | None = None

# Line 455
buy_in: float | None = None
```

**Suggested Fix:**
Add a `model_validator` or `Annotated` constraint to ensure buy-in values are `> 0` when provided. For the dict, a model validator that checks all values would work. For `AddPlayerToGameRequest.buy_in`, a `Field(gt=0)` with `Optional` handling.

**Impact:** Invalid game state — negative buy-in records corrupt player stats calculations.

---

### [MEDIUM] F-002: `PlayerActionCreate.amount` accepts negative values

**File:** `src/pydantic_models/app_models.py`
**Line(s):** 479
**Category:** correctness

**Problem:**
`PlayerActionCreate.amount` is `float | None` with no positivity constraint. For bet/raise actions, a negative amount is nonsensical and could corrupt hand action records.

**Code:**
```python
# Line 479
amount: float | None = None
```

**Suggested Fix:**
Add `Field(gt=0)` when `amount` is provided. Since fold/check actions have `amount=None`, the nullable nature is fine, but when a value is present it should be positive: `amount: float | None = Field(default=None, gt=0)`.

**Impact:** Negative bet/raise amounts corrupt action history and any downstream analysis.

---

## Positives

- **Correct constraint choice**: `Field(gt=0)` is the right Pydantic idiom — it excludes both zero and negatives in a single declaration.
- **Clean, minimal fix**: Only the affected field was changed; no extraneous modifications.
- **Good test coverage**: Both boundary cases (zero and negative) are tested explicitly with assertion on the 422 status code.
- **Tests follow existing patterns**: The two new tests sit naturally in the existing `TestPostRebuy` class and use the same `_create_game_with_player` helper.

---

## Overall Assessment

The bug fix is **correct and complete**. `Field(gt=0)` on `RebuyCreate.amount` closes the reported vulnerability with no side effects. The two new tests directly verify the fix at both boundaries.

Two MEDIUM findings identify the same class of missing validation on sibling monetary fields (`player_buy_ins`, `buy_in`, `PlayerActionCreate.amount`). These should be filed as separate issues and addressed in a follow-up pass — they are not blockers for this fix.

**Verdict:** PASS — no CRITICAL or HIGH findings. Fix is clean.
