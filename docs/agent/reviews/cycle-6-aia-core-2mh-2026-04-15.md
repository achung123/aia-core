# Code Review Report — aia-core

**Date:** 2026-04-15
**Target:** `backend/src/app/routes/stats.py`, `backend/test/test_highlights_api.py`
**Reviewer:** Scott (automated)
**Cycle:** 6

**Task:** Game highlights endpoint
**Beads ID:** aia-core-2mh

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 1 |
| LOW | 3 |
| **Total Findings** | **4** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | Returns an array of GameHighlight objects | SATISFIED | `response_model=list[GameHighlight]` at stats.py L636; `GameHighlight` schema at stats_schemas.py L97 | |
| 2 | Selection criteria: most non-fold players; river with 3+ active; first hand in longest win streak | SATISFIED | stats.py L651–L756 implements all three; tests `TestMostAction`, `TestRiverShowdown`, `TestStreakStart` verify | |
| 3 | Returns 1-5 highlights; empty for games with < 3 hands | SATISFIED | `if len(hands) < 3: return []` at L647; `return highlights[:5]` at L758; `TestHighlightsMinHands` and `TestHighlightsCap` verify | |
| 4 | Returns 404 if the game does not exist | SATISFIED | `get_game_or_404(db, game_id)` at L643; `TestHighlights404` verifies | |

---

## Findings

### [MEDIUM] Duplicate hand numbers across highlight types

**File:** `backend/src/app/routes/stats.py`
**Line(s):** 651–700
**Category:** correctness

**Problem:**
A hand that has the most non-fold players AND reached the river with 3+ active players will appear twice in the highlights array — once as `most_action` and once as `river_showdown`. This consumes two of the five available slots for the same physical hand, reducing the variety of highlights returned to the user.

**Code:**
```python
# most_action picks the best hand (line 656–672)
if non_fold > best_action_count:
    best_action_count = non_fold
    best_action_hand = hand

# river_showdown iterates ALL hands, including the one already picked (line 682–700)
for hand in hands:
    if hand.river is None:
        continue
    active = sum(...)
    if active >= 3:
        highlights.append(...)
```

**Suggested Fix:**
Track the `best_action_hand.hand_id` and skip it in the river_showdown loop:
```python
most_action_hand_id = best_action_hand.hand_id if best_action_hand else None
for hand in hands:
    if hand.hand_id == most_action_hand_id:
        continue
    ...
```

**Impact:** Users may see the same hand described twice in different ways, reducing the value of the highlights feature.

---

### [LOW] `highlight_type` is an untyped string

**File:** `backend/src/pydantic_models/stats_schemas.py`
**Line(s):** 99
**Category:** design

**Problem:**
`highlight_type: str` accepts any string. Using `Literal['most_action', 'river_showdown', 'streak_start']` or a `StrEnum` would provide stronger type safety for API consumers and documentation.

**Suggested Fix:**
```python
from typing import Literal

class GameHighlight(BaseModel):
    hand_number: int
    highlight_type: Literal['most_action', 'river_showdown', 'streak_start']
    description: str
```

**Impact:** Minor — no runtime risk, but weakens API contract clarity.

---

### [LOW] No test for game with 0 hands

**File:** `backend/test/test_highlights_api.py`
**Category:** coverage

**Problem:**
The `< 3 hands` boundary is tested with 2 hands but not with 0 hands (empty game session). While the code path is identical, the 0-hand case is a distinct real-world scenario (game just created, no hands played yet).

**Suggested Fix:**
Add a test that creates a game with no hands and asserts `200` with `[]`.

**Impact:** Minor coverage gap.

---

### [LOW] No test for single hand qualifying for multiple highlight types

**File:** `backend/test/test_highlights_api.py`
**Category:** coverage

**Problem:**
No test creates a scenario where the same hand is the `most_action` winner AND a `river_showdown` candidate. This would reveal the MEDIUM finding above and document whether duplicate hand numbers in the response are intended behavior.

**Suggested Fix:**
Add a test with a river hand that also has the highest non-fold count, and assert on the expected number of highlights and unique hand numbers.

**Impact:** Missing test for an observable interaction between highlight types.

---

## Positives

- Clean implementation that follows existing patterns in the stats router
- Eager loading via `joinedload` prevents N+1 query issues
- Correct handling of `HANDED_BACK` results excluded from all counts
- Streak detection logic is well-structured with per-player tracking
- Good test coverage: 8 tests covering 404, min-hands, each highlight type, cap, and combined output
- `get_game_or_404` reuse is consistent with other endpoints

---

## Overall Assessment

The implementation is solid and all 8 tests pass. The endpoint correctly implements all three highlight types, the 1–5 cap, the < 3 hands guard, and 404 for missing games. The single MEDIUM finding (duplicate hand numbers) is a design gap rather than a bug — it produces valid output but could reduce highlight variety. The three LOW findings are minor typing and coverage improvements. No critical or high-severity issues found.

**(C: 0, H: 0, M: 1, L: 3)**
