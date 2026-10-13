# Code Review Report — alpha-feedback-008

**Date:** 2026-04-12
**Target:** `src/app/routes/hands.py` (record_player_action), `test/test_fold_action_sets_result.py`
**Reviewer:** Scott (automated)
**Cycle:** 6

**Task:** T-011 — Fold action auto-sets player result
**Beads ID:** aia-core-s3df

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
| 1 | Recording `{ "action": "fold" }` also sets `PlayerHand.result = 'folded'` | SATISFIED | `test_fold_sets_player_hand_result_to_folded` — asserts `alice_ph['result'] == 'folded'` after POST fold | Implementation at `hands.py` L1118: `player_hand.result = 'folded'` |
| 2 | Subsequent GET of the hand shows the player as folded | SATISFIED | `test_get_hand_shows_folded_player` — GETs hand after fold and asserts Alice folded, Bob unaffected | |
| 3 | Recording fold on an already-folded player returns 400 ('already folded') | SATISFIED | `test_duplicate_fold_returns_400` — second fold returns 400, detail contains 'already folded' | Guard at `hands.py` L1114-1117 |
| 4 | Non-fold actions do not modify the result field | SATISFIED | `test_non_fold_action_leaves_result_none` parametrized for check, call, bet, raise — all assert `result is None` | |
| 5 | Tests verify the side-effect and the duplicate guard | SATISFIED | 7 tests cover fold side-effect (AC-1, AC-2), duplicate guard (AC-3), and non-fold neutrality (AC-4 × 4 actions) | |
| 6 | `uv run pytest test/` passes | SATISFIED | All 7 new tests pass; task closed with 1151 tests passing | |

---

## Findings

### [MEDIUM] Fold does not set `outcome_street`

**File:** `src/app/routes/hands.py`
**Line(s):** 1114-1118
**Category:** correctness

**Problem:**
When a fold action auto-sets `player_hand.result = 'folded'`, the corresponding `outcome_street` is not populated. The street on which the fold occurred is available in `payload.street` but is not written to `player_hand.outcome_street`.

This creates an inconsistency: if results are later submitted via the `update_player_results` endpoint, that endpoint's cross-validation logic (lines 931-938) collects `outcome_street` from folded players to enforce street ordering. A fold recorded via the action endpoint will be invisible to those checks because `outcome_street` is `None`.

**Code:**
```python
if payload.action == 'fold':
    if player_hand.result == 'folded':
        raise HTTPException(
            status_code=400,
            detail=f'Player {player_name!r} has already folded',
        )
    player_hand.result = 'folded'
    # outcome_street is not set here
```

**Suggested Fix:**
```python
if payload.action == 'fold':
    if player_hand.result == 'folded':
        raise HTTPException(
            status_code=400,
            detail=f'Player {player_name!r} has already folded',
        )
    player_hand.result = 'folded'
    player_hand.outcome_street = payload.street
```

**Impact:** Downstream result validation may not enforce street ordering correctly when folds are recorded via the action endpoint rather than the results endpoint. This is a data consistency gap, not a crash.

---

### [MEDIUM] Fold after other terminal states silently overwrites result

**File:** `src/app/routes/hands.py`
**Line(s):** 1114-1118
**Category:** correctness

**Problem:**
The fold guard only checks `player_hand.result == 'folded'`. If the player's result has already been set to `'won'` or `'lost'` (via the `update_player_results` endpoint), a subsequent fold action will silently overwrite the result to `'folded'`. This is almost certainly unintended — a player who has already won or lost a hand should not be foldable.

**Code:**
```python
if payload.action == 'fold':
    if player_hand.result == 'folded':
        raise HTTPException(...)
    player_hand.result = 'folded'
```

**Suggested Fix:**
```python
if payload.action == 'fold':
    if player_hand.result is not None:
        raise HTTPException(
            status_code=400,
            detail=f'Player {player_name!r} already has result {player_hand.result!r}',
        )
    player_hand.result = 'folded'
```

**Impact:** A mis-sequenced API call could silently corrupt hand results — changing a winner to folded. Low probability in normal dealer flow, but unguarded.

---

## Positives

- **Clean, minimal implementation** — the fold logic is exactly 5 lines, placed precisely where it belongs (after player_hand lookup, before action creation)
- **Good guard placement** — the fold-guard checks `player_hand.result` before recording the action, preventing the action row from being created for invalid folds
- **Thorough test coverage** — 7 tests map 1:1 to acceptance criteria; the parametrized non-fold test efficiently covers 4 action types
- **Case sensitivity handled by Pydantic** — `ActionEnum` constrains input to `'fold'` exactly; `'Fold'` or `'FOLD'` are rejected at the validation layer before reaching the endpoint
- **Test structure matches project convention** — own DB setup (consistent with `test_player_actions_api.py` and other test files)

---

## Overall Assessment

The implementation satisfies all 6 acceptance criteria cleanly. No CRITICAL or HIGH issues. Two MEDIUM findings identify data consistency gaps that should be addressed in a follow-up task:

1. **outcome_street not set on fold** — straightforward one-line fix plus a test addition
2. **Fold overwrites non-null results** — widen the guard from `== 'folded'` to `is not None`

Both are edge cases unlikely to occur in normal dealer flow but represent logical correctness gaps. Recommend filing a follow-up task for these two fixes.
