# Code Review Report — aia-core

**Date:** 2026-04-15
**Target:** `GET /stats/head-to-head` endpoint (aia-core-4v2)
**Reviewer:** Scott (automated)
**Cycle:** 4

**Task:** Head-to-head endpoint
**Beads ID:** aia-core-4v2

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 2 |
| LOW | 2 |
| **Total Findings** | **4** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | Uses get_shared_hands() to find all hands where both players participated | SATISFIED | `backend/src/app/routes/stats.py` L339 — `shared = get_shared_hands(db, p1.player_id, p2.player_id)` | Correct usage with player IDs from resolved Player objects |
| 2 | Computes showdown stats (hands where both players have a non-fold result) | SATISFIED | `backend/src/app/routes/stats.py` L353-358 — checks both results against `_SHOWDOWN_RESULTS = {WON, LOST}` | Verified by `TestHeadToHeadShowdownStats` |
| 3 | Computes fold behavior (how often each player folded in shared hands) | SATISFIED | `backend/src/app/routes/stats.py` L347-350 — counts folds; L375-376 — computes rates with div-by-zero guard | Verified by `TestHeadToHeadFoldBehavior` |
| 4 | Computes street-level breakdown: how many shared hands ended at each street, with win/loss per player | SATISFIED | `backend/src/app/routes/stats.py` L360-370 — street aggregation via `_determine_street()`; L372 — ordered by `_STREET_ORDER` | Verified by `TestHeadToHeadStreetBreakdown` (2 tests) |
| 5 | Players matched case-insensitively; returns 404 if either does not exist | SATISFIED | `backend/src/app/database/queries.py` L29-35 — `func.lower()` comparison; raises HTTPException(404) | Verified by `TestHeadToHead404` (3 tests) and `TestHeadToHeadCaseInsensitive` |
| 6 | Returns the HeadToHeadResponse schema | SATISFIED | `backend/src/app/routes/stats.py` L333 — `response_model=HeadToHeadResponse`; L374-385 — constructs response with all required fields | Schema at `backend/src/pydantic_models/stats_schemas.py` L74-85 |

---

## Findings

### [MEDIUM] M-1: In-progress and HANDED_BACK hands included in shared count

**File:** `backend/src/app/routes/stats.py`
**Line(s):** 339-340
**Category:** design

**Problem:**
`get_shared_hands()` returns all hands where both players have a `PlayerHand` row, including hands with `result=None` (in-progress) or `result=HANDED_BACK`. These inflate `shared_hands_count` and street `hands_ended`, diluting fold rates. Other stats endpoints (`get_player_stats`, `get_leaderboard`) consistently filter out `result IS NULL` and `result != HANDED_BACK`.

**Code:**
```python
shared = get_shared_hands(db, p1.player_id, p2.player_id)
total = len(shared)
```

**Suggested Fix:**
Filter the `shared` list after retrieval (or add a filtered variant of `get_shared_hands`) to exclude hands where either player's result is `None` or `HANDED_BACK`:
```python
shared = [
    (h, ph1, ph2) for h, ph1, ph2 in get_shared_hands(db, p1.player_id, p2.player_id)
    if ph1.result is not None and ph1.result != ResultEnum.HANDED_BACK
    and ph2.result is not None and ph2.result != ResultEnum.HANDED_BACK
]
```

**Impact:** Fold rates and shared_hands_count could be slightly inaccurate when in-progress or handed-back hands exist. Low practical risk since these are transient states, but inconsistent with other endpoints.

---

### [MEDIUM] M-2: No guard against same-player query

**File:** `backend/src/app/routes/stats.py`
**Line(s):** 334-337
**Category:** correctness

**Problem:**
If a client sends `?player1=Alice&player2=Alice`, `get_shared_hands` performs a self-join where `ph1` and `ph2` resolve to the same `PlayerHand` rows. Every hand Alice played appears as a "shared hand" with herself, producing meaningless showdown/fold/street stats (e.g., 100% showdowns where Alice both wins and loses).

**Code:**
```python
p1 = get_player_by_name_or_404(db, player1)
p2 = get_player_by_name_or_404(db, player2)
```

**Suggested Fix:**
Add a guard after resolving both players:
```python
if p1.player_id == p2.player_id:
    raise HTTPException(status_code=400, detail='player1 and player2 must be different')
```

**Impact:** Returns semantically invalid data for same-player queries. No security risk, but confusing for API consumers.

---

### [LOW] L-1: No test for in-progress hands (result=None)

**File:** `backend/test/test_head_to_head_api.py`
**Category:** coverage gap

**Problem:**
All test scenarios seed `PlayerHand` rows with explicit results (`won`, `lost`, `folded`). There is no test verifying behavior when one or both players have `result=None` on a shared hand. If M-1 is addressed, a test should verify the filtering.

**Impact:** Untested edge case. Low practical risk since M-1 is a design concern, not a crash.

---

### [LOW] L-2: No test for same-player query

**File:** `backend/test/test_head_to_head_api.py`
**Category:** coverage gap

**Problem:**
No test exercises the `player1 == player2` scenario. If M-2 is addressed with a 400 guard, a test should verify it.

**Impact:** Untested edge case. No crash risk, but self-comparison data is semantically meaningless.

---

## Positives

- **Clean separation:** `_determine_street()` and `_SHOWDOWN_RESULTS` are well-extracted helpers — clear, testable, and easy to reuse.
- **Division-by-zero handling:** Fold rate calculation properly guards `if total > 0 else 0.0`.
- **Street ordering:** Using `_STREET_ORDER` list comprehension to enforce canonical order (preflop → flop → turn → river) while omitting empty streets is elegant.
- **Thorough test coverage:** 10 tests across 6 test classes covering all 6 ACs. The `TestHeadToHeadFullScenario` integration test exercises the full interplay of showdowns, folds, and street breakdown in one scenario.
- **Consistent patterns:** The endpoint follows the same structure as neighboring endpoints (dependency injection, `get_*_or_404` reuse, Pydantic response model).
- **No N+1 queries:** `get_shared_hands` loads everything in a single joined query; the loop only operates on in-memory objects.

---

## Overall Assessment

The implementation is solid and all 6 acceptance criteria are satisfied with good test coverage. The two MEDIUM findings (unfiltered in-progress/HANDED_BACK hands and missing same-player guard) are design hardening issues rather than correctness bugs — they affect edge cases unlikely to occur in normal usage. The two LOW findings are corresponding coverage gaps for those edge cases.

**Verdict:** No CRITICAL or HIGH findings. Implementation is approved for this cycle.

**(C: 0, H: 0, M: 2, L: 2)**
