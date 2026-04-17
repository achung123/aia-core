# Code Review Report — aia-core

**Date:** 2026-04-15
**Target:** `backend/src/app/database/queries.py`, `backend/test/test_shared_hands_query.py`
**Reviewer:** Scott (automated)
**Cycle:** 2

**Task:** Shared hands query helper
**Beads ID:** aia-core-x8z

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
| 1 | Function lives in `src/app/database/queries.py` | SATISFIED | `queries.py` L59-79 — `get_shared_hands` defined | File already existed with other helpers; function appended cleanly |
| 2 | Returns `list[tuple[Hand, PlayerHand_p1, PlayerHand_p2]]` | SATISFIED | `queries.py` L61 return type annotation; test assertions compare tuples of `(Hand, PlayerHand, PlayerHand)` | Type annotation and runtime behaviour match |
| 3 | "Participated" means a PlayerHand record exists (regardless of result) | SATISFIED | Inner joins on `PlayerHand` ensure only hands with both records survive; `TestGetSharedHandsFoldVsWin` validates result values (`fold`, `win`, `None`) don't affect inclusion | Correct by construction — no filter on `result` |
| 4 | Results ordered by `hand_number` ascending within each game | SATISFIED | `queries.py` L77 `.order_by(Hand.game_id, Hand.hand_number)`; `test_ordering_by_hand_number_ascending` creates hands out of order and asserts sorted output | Ordering by `game_id` first is a correct enhancement for multi-game results |
| 5 | Unit tests with 3 scenarios: both present, one absent, fold vs win | SATISFIED | `TestGetSharedHandsBothPresent` (2 tests), `TestGetSharedHandsOneAbsent` (1 test), `TestGetSharedHandsFoldVsWin` (1 test) — 4 tests total across 3 scenario classes | All 4 tests pass |

---

## Findings

### [LOW] No multi-game ordering test

**File:** `backend/test/test_shared_hands_query.py`
**Line(s):** N/A (missing test)
**Category:** coverage gap

**Problem:**
The production code orders by `(Hand.game_id, Hand.hand_number)`, which is the correct behaviour for cross-game queries. However, all tests use a single game session. There is no test verifying that hands from multiple games are grouped and ordered correctly (game_id ascending, then hand_number ascending within each game).

**Suggested Fix:**
Add a test that creates two games with interleaved hand numbers and asserts the results are ordered by `game_id` first, then `hand_number`.

**Impact:** Low — the ordering clause is straightforward and unlikely to regress, but a dedicated test would lock down the multi-game sort contract.

---

## Positives

- **Clean use of `aliased()`** — Two aliases of `PlayerHand` is the idiomatic SQLAlchemy pattern for self-referencing joins. Avoids subqueries or raw SQL.
- **No raw SQL, no injection surface** — All filtering uses parameterised ORM expressions.
- **Matches codebase conventions** — Import style, function placement in `queries.py`, docstring format, and test structure (helper factories, class-based scenario grouping, `db_session` fixture) are all consistent with the existing project.
- **Well-structured tests** — Each scenario is isolated in its own class with a clear docstring. Factory helpers (`_make_game`, `_make_player`, etc.) keep test bodies readable.
- **Return type is annotated** — `list[tuple[Hand, PlayerHand, PlayerHand]]` makes the contract explicit for callers.

---

## Overall Assessment

Solid, minimal implementation. The query is correct — inner joins on aliased `PlayerHand` tables naturally enforce the "both participated" requirement, and the `order_by(game_id, hand_number)` clause handles multi-game ordering. Tests cover all three required scenarios with 4 well-structured test cases. No security concerns. The single LOW finding (missing multi-game ordering test) is a gap worth noting but not blocking.

**Verdict:** Clean — no critical issues.
