# Code Review Report — alpha-feedback-008

**Date:** 2026-04-12
**Cycle:** 7
**Target:** `GET /games/{game_id}/hands/{hand_number}/actions`
**Reviewer:** Scott (automated)

**Task:** T-010 — Retrieve hand actions endpoint
**Beads ID:** aia-core-qd2p

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 1 |
| LOW | 0 |
| **Total Findings** | **1** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | Returns array of { player_name, street, action, amount, created_at } ordered by created_at | SATISFIED | `test_returns_actions_ordered_by_created_at`, `test_action_fields_are_correct` in test/test_get_hand_actions_api.py | Fields match HandActionResponse; ordering verified by timestamp sort assertion |
| 2 | Includes player name resolved from PlayerHand -> Player | SATISFIED | `test_actions_contain_player_name` in test/test_get_hand_actions_api.py; hands.py L148 `a.player_hand.player.name` | Name resolution traverses PlayerHandAction -> PlayerHand -> Player correctly |
| 3 | Returns empty list for hand with no actions; 404 for missing game/hand | SATISFIED | `test_returns_empty_list_when_no_actions`, `test_returns_404_for_missing_game`, `test_returns_404_for_missing_hand` | Game 404 checked before hand lookup (L125-L126 before L128-L133) |
| 4 | Tests verify ordering, empty case, and 404s | SATISFIED | 6 tests across 3 test classes | Full coverage of stated criteria |
| 5 | uv run pytest test/ passes | SATISFIED | 1157 tests passing per close reason; 6/6 hand-actions tests confirmed passing | — |

---

## Findings

### [MEDIUM] N+1 lazy-load on player_hand and player relationships

**File:** `src/app/routes/hands.py`
**Line(s):** 146-152
**Category:** design

**Problem:**
The query at L138-144 joins `PlayerHand` for filtering but does not eagerly load the `player_hand` or `player` relationships. The list comprehension at L146-152 accesses `a.player_hand.player.name` for each action, triggering two lazy-load queries per action row (one for `PlayerHand`, one for `Player`). For N actions, this produces up to 2N+1 SQL statements.

The codebase already uses `joinedload` in `src/app/routes/stats.py` (L37), making eager loading an established convention.

**Code:**
```python
actions = (
    db.query(PlayerHandAction)
    .join(PlayerHand, PlayerHandAction.player_hand_id == PlayerHand.player_hand_id)
    .filter(PlayerHand.hand_id == hand.hand_id)
    .order_by(PlayerHandAction.created_at)
    .all()
)

return [
    HandActionResponse(
        player_name=a.player_hand.player.name,  # 2 lazy loads per iteration
        ...
    )
    for a in actions
]
```

**Suggested Fix:**
Add `joinedload` options to eagerly fetch the relationship chain in a single query:
```python
from sqlalchemy.orm import joinedload

actions = (
    db.query(PlayerHandAction)
    .join(PlayerHand, PlayerHandAction.player_hand_id == PlayerHand.player_hand_id)
    .options(
        joinedload(PlayerHandAction.player_hand).joinedload(PlayerHand.player)
    )
    .filter(PlayerHand.hand_id == hand.hand_id)
    .order_by(PlayerHandAction.created_at)
    .all()
)
```

**Impact:** Low practical impact for typical poker hands (~10-20 actions per hand), but diverges from the eager-loading pattern established elsewhere in the codebase and would degrade if action counts grow.

---

## Positives

- **Correct 404 ordering** — Game existence is validated before the hand lookup, preventing orphan-hand false positives and matching the pattern used by every other endpoint in the file.
- **Clean Pydantic model** — `HandActionResponse` is minimal, uses `ConfigDict(from_attributes=True)`, and mirrors the response shape exactly. `amount` is correctly `float | None`.
- **Well-structured tests** — 6 tests organized into 3 logical classes (ordering, empty case, 404s). Each test is focused, uses the shared `_seed_game_with_hand` helper, and asserts specific fields rather than snapshot-matching entire responses.
- **Consistent patterns** — Route signature, dependency injection, 404 guard structure, and naming all match the existing endpoints in `hands.py`.
- **No security issues** — All inputs are path parameters typed as `int`/`int`; no injection vectors. No sensitive data exposed.

---

## Overall Assessment

The implementation is clean, correct, and well-tested. All 5 acceptance criteria are **SATISFIED**. The single MEDIUM finding (N+1 lazy loading) is a performance convention gap that should be addressed in a follow-up but is not a correctness or security issue. No CRITICAL or HIGH findings.
