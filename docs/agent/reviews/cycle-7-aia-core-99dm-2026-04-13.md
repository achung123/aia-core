# Code Review Report — aia-core (Cycle 7)

**Date:** 2026-04-13
**Target:** `src/app/services/evaluator.py`, `src/app/services/equity.py`, `src/app/services/hand_ranking.py`, `test/test_evaluator.py`
**Reviewer:** Scott (automated)
**Cycle:** 7

**Task:** Unify duplicate hand evaluation engines
**Beads ID:** aia-core-99dm

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
| 1 | Extract shared evaluator into `services/evaluator.py` with RANK_VAL, SUIT_VAL, classify5, score, eval5, best_hand, best_score | SATISFIED | `src/app/services/evaluator.py` — all 7 symbols exported | Clean single-module extraction |
| 2 | `equity.py` imports from evaluator, no duplicate evaluation logic | SATISFIED | `equity.py` L8 — imports `RANK_VAL, SUIT_VAL, best_score`; grep confirms no local `classify5`/`eval5` definitions | Only `combinations` import remains for exhaustive board enumeration (separate concern) |
| 3 | `hand_ranking.py` imports from evaluator, no duplicate evaluation logic | SATISFIED | `hand_ranking.py` L5 — imports `RANK_VAL, SUIT_VAL, best_hand`; grep confirms no local classification logic | `_parse_card` and `describe_hand` remain as module-specific logic (correct) |
| 4 | SUIT_VAL supports both cases | SATISFIED | `evaluator.py` L27 — both `'h'`/`'H'` etc. present; `test_evaluator.py::TestConstants::test_suit_val_case_insensitive` | — |
| 5 | All existing tests pass | SATISFIED | 1428 tests pass; 72 evaluator+equity+hand_ranking tests verified in this review | Zero regressions |
| 6 | New test coverage for shared evaluator | SATISFIED | `test/test_evaluator.py` — 25 tests covering all 9 hand categories, scoring, eval5, best_hand, best_score | See MEDIUM finding for one edge case gap |

---

## Findings

### [MEDIUM] Missing test for wheel straight flush

**File:** `test/test_evaluator.py`
**Line(s):** (not present — missing test)
**Category:** correctness (test gap)

**Problem:**
The test suite covers wheel straights (A-2-3-4-5 off-suit) and regular straight flushes, but does not test the wheel straight flush (A-2-3-4-5 of the same suit). This edge case exercises both the wheel detection path (`ranks[0] == 12 and ranks[1] == 3`) and the flush+straight combination simultaneously. Manual trace confirms the code handles it correctly (returns `(8, [3])`), but there is no regression guard.

**Suggested Fix:**
Add a test case to `TestClassify5`:
```python
def test_wheel_straight_flush(self):
    # Ah 2h 3h 4h 5h
    cat, kickers = classify5(_c(12, 0), _c(0, 0), _c(1, 0), _c(2, 0), _c(3, 0))
    assert cat == 8
    assert kickers[0] == 3  # wheel high is 5 (value 3)
```

**Impact:** Low risk — code is correct, but a future refactor could break this path without detection.

---

### [LOW] Cryptic constant name `_B`

**File:** `src/app/services/evaluator.py`
**Line(s):** 29
**Category:** convention

**Problem:**
`_B = 14` is used as the base for the scoring polynomial. The name `_B` is not self-documenting; a reader must find the comment or trace the usage to understand its purpose.

**Suggested Fix:**
Rename to `_SCORE_BASE` or similar.

**Impact:** Readability only — no functional impact.

---

## Positives

- **Clean extraction:** The shared evaluator is well-structured with clear sections (constants → classify5 → scoring → best-of-N) and a good module docstring.
- **Correct poker logic:** All 9 hand categories verified including wheel detection, flush kicker ordering, and group_rank sorting by (count, rank) descending.
- **No duplicate code remains:** Both `equity.py` and `hand_ranking.py` exclusively import from `evaluator.py` — grep confirms zero local definitions of evaluation functions or lookup dicts.
- **Scoring is collision-free:** Base 14 with max rank value 12 ensures category boundaries never overlap ($14^5 = 537{,}824 > 12 \times (14^4 + 14^3 + 14^2 + 14 + 1) = 460{,}980$).
- **Consistent kicker handling:** The `score()` function's 5-slot padding with zeros works correctly because all hands within the same category produce the same number of meaningful kickers.
- **Good test structure:** 25 tests organized by class per function, covering all categories, ordering, and cross-function consistency.

---

## Overall Assessment

The refactoring is clean, correct, and well-tested. Duplicate evaluation logic has been fully eliminated. The shared evaluator correctly classifies all 9 poker hand categories, and the scoring function is mathematically sound. No critical or high-severity issues found. The two findings are minor: one test gap for an edge case (wheel straight flush) and one naming convention nit. This task is complete and meets all acceptance criteria.
