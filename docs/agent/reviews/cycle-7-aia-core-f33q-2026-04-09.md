# Code Review Report — dealer-viz-004

**Date:** 2026-04-09
**Target:** `src/app/services/equity.py` (lines 130-134), `test/test_equity.py` (TestEdgeCasePlayerCounts)
**Reviewer:** Scott (automated)
**Cycle:** 7

**Task:** B-013 — calculate_equity() crashes on empty player list
**Beads ID:** aia-core-f33q

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 0 |
| LOW | 1 |
| **Total Findings** | **1** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | `calculate_equity([])` does not crash; returns `[]` | SATISFIED | `test/test_equity.py::TestEdgeCasePlayerCounts::test_zero_players_returns_empty_list` | Guard at line 133 returns `[]` |
| 2 | `calculate_equity([single_player])` returns `[1.0]` without running simulation | SATISFIED | `test/test_equity.py::TestEdgeCasePlayerCounts::test_one_player_returns_full_equity` | Guard at line 135 returns `[1.0]` |
| 3 | fix includes test coverage for edge cases | SATISFIED | 4 tests in `TestEdgeCasePlayerCounts` class | Covers 0 players (with/without community), 1 player (with/without community) |

---

## Findings

### [LOW] L-1 — Unused variable `B5` in module scope

**File:** `src/app/services/equity.py`
**Line(s):** 18
**Category:** convention

**Problem:**
`B5 = B ** 5` is defined at module scope but never used anywhere in the file. This was noted in the Cycle 6 review as well.

**Code:**
```python
B5 = B ** 5
```

**Suggested Fix:**
Remove the unused constant, or defer to a future cleanup task.

**Impact:** No functional impact. Minor code cleanliness issue.

---

## Positives

- **Guard placement is correct.** The early returns are positioned immediately after `num_players = len(player_hole_cards)`, before any card conversion or deck building. This avoids unnecessary work and prevents the `max(scores)` crash in `_eval_board`.
- **Semantically sound return values.** `[]` for zero players and `[1.0]` for one player correctly preserve the invariants documented in the docstring: "List of floats (one per player) representing equity (0.0–1.0), summing to 1.0."
- **Tests are thorough and well-structured.** The 4 new tests cover both the base case (no community cards) and the with-community-cards variant for each guard branch, confirming the early returns are hit regardless of board state.
- **No regressions.** All 18 equity tests pass (verified via `uv run pytest test/test_equity.py -v`).

---

## Overall Assessment

**CLEAN.** The bug fix is minimal, correct, and well-tested. The early return guards at lines 132-135 of `equity.py` directly address the `ValueError` from `max()` on an empty list. The four new tests in `TestEdgeCasePlayerCounts` cover all combinations of 0/1 players with and without community cards. No critical, high, or medium issues found. The single LOW finding (unused `B5` constant) is a pre-existing issue from the original port and does not affect this change.
