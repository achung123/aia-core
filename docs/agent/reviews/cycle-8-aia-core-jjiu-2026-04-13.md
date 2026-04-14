# Code Review Report — aia-core

**Date:** 2026-04-13
**Cycle:** 8
**Target:** `src/app/services/hand_state.py`, `src/app/routes/hands.py`, `test/test_hand_state_service.py`
**Reviewer:** Scott (automated)

**Task:** aia-core-jjiu — Extract hand state logic from hands.py into services/hand_state.py

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
| 1 | Extract 8 functions from hands.py into services/hand_state.py | SATISFIED | `src/app/services/hand_state.py` contains all 8 functions + PHASE_ORDER | Functions: get_active_seat_order, first_to_act_seat, next_seat, count_community_cards, can_advance_to_phase, get_actions_this_street, try_advance_phase, activate_preflop |
| 2 | Remove definitions from hands.py, replace with imports | SATISFIED | `src/app/routes/hands.py` L35-41 imports 5 functions; no stale `_prefix` definitions remain | 3 internal functions (count_community_cards, can_advance_to_phase, first_to_act_seat) correctly kept as service-internal |
| 3 | Rename from private (_prefix) to public | SATISFIED | All functions in hand_state.py use public names without underscore prefix | |
| 4 | Create test/test_hand_state_service.py with unit tests | SATISFIED | 33 tests across 8 test classes, all passing in 0.76s | Good coverage of happy paths, edge cases (wrap-around, empty seats, all-in exclusion), and boundary conditions |
| 5 | All tests pass, pre-commit clean | SATISFIED | 1461 tests pass; task closed with clean status | |
| 6 | No circular imports between services and routes | SATISFIED | Runtime import verification confirms no circular dependency; hand_state.py imports only from app.database.models and app.services.betting | |

---

## Findings

### [MEDIUM] `activate_preflop` does not guard against None sb_ph/bb_ph

**File:** `src/app/services/hand_state.py`
**Line(s):** 237-248
**Category:** correctness

**Problem:**
`activate_preflop()` queries for `sb_ph` and `bb_ph` via `.first()` which can return `None`. If either is `None`, the subsequent `sb_ph.player_hand_id` access on line 248 would raise `AttributeError`. This is a pre-existing issue carried from the original code — the extraction didn't introduce it. The caller in `hands.py` (L881) only invokes this after verifying `all_have_cards`, which provides an implicit guard, but the service function itself is unprotected for independent use.

**Code:**
```python
sb_ph = (
    db.query(PlayerHand)
    .filter(
        PlayerHand.hand_id == hand.hand_id,
        PlayerHand.player_id == hand.sb_player_id,
    )
    .first()
)
# ... sb_ph.player_hand_id used without None check
```

**Suggested Fix:**
Add early-return or raise `ValueError` if `sb_ph` or `bb_ph` is `None`. This would make the function safe for independent callers.

**Impact:** Low risk in current usage (caller pre-validates), but the function is now public and independently testable — a guard would prevent future misuse.

---

### [LOW] hands.py remains 1418 lines — "halves it" aspiration not met

**File:** `src/app/routes/hands.py`
**Line(s):** 1-1418
**Category:** design

**Problem:**
The task description stated "hands.py is 1300+ lines — this halves it." The extraction moved ~262 lines into `hand_state.py`, but hands.py is still 1418 lines (likely grew from intervening tasks before extraction). The net effect is roughly 15% reduction from pre-extraction size, not 50%.

**Suggested Fix:**
This is informational — further extractions (e.g., the status endpoint logic, community card update logic) would be needed for significant additional reduction. Consider follow-up tasks.

**Impact:** No functional impact. The extracted module is well-scoped and independently testable.

---

## Positives

- **Clean separation of concerns**: `hand_state.py` depends only on models and the betting service — no route-layer imports, no HTTP concerns.
- **Good API design**: Functions accept explicit `db`, `game_id`, `hand`, `state` parameters — no hidden dependencies or global state.
- **Effective caching pattern**: `seats_cache` and `actions_cache` keyword arguments on `next_seat()` and `try_advance_phase()` avoid redundant DB queries when callers already have the data.
- **Thorough test coverage**: 33 tests organized into 8 logical classes covering happy paths, boundary conditions (seat wrap-around, empty tables), state flags (all-in, folded, inactive), and the PHASE_ORDER constant.
- **Correct import surgery**: Only the 5 functions used by routes are imported; 3 internal helpers + PHASE_ORDER are kept service-internal. No stale references.

---

## Overall Assessment

The extraction is clean and well-executed. All 8 functions were correctly moved, imports were properly updated, and 33 targeted unit tests validate the game-state logic independently. No circular imports exist. The single MEDIUM finding is a pre-existing null-safety gap inherited from the original code — not introduced by this task. The LOW finding is purely informational about file size expectations.

**Verdict:** PASS — no blockers. Ready for next cycle.
