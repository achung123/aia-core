# Code Review Report — alpha-patch-009

**Date:** 2026-04-12
**Target:** Bug fix for bet/raise all-in detection (`aia-core-ibuc`)
**Reviewer:** Scott (automated)
**Cycle:** 6
**Epic:** alpha-patch-009

**Task:** aia-core-ibuc — Bug: bet/raise all-ins not detected for side pot calculation
**Beads ID:** aia-core-ibuc
**Parent:** aia-core-ndtd (T-002 — Betting state machine backend)

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

The task description defines the bug and fix approach: "Accept `is_all_in` flag from client or add stack tracking."

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | Bet all-in sets `is_all_in` on `PlayerHand` | SATISFIED | `src/app/routes/hands.py` L1570-1571; `test_bet_all_in_sets_flag` | Explicit flag honored for bet action |
| 2 | Raise all-in sets `is_all_in` on `PlayerHand` | SATISFIED | `src/app/routes/hands.py` L1570-1571; `test_raise_all_in_creates_side_pots` | Explicit flag honored for raise action |
| 3 | Call-for-less auto-detection preserved | SATISFIED | `src/app/routes/hands.py` L1572-1574; `test_call_for_less_auto_detected` | `elif` fallback correctly kept |
| 4 | Side pots computed correctly for bet/raise all-ins | SATISFIED | `test_bet_all_in_sets_flag`, `test_raise_all_in_creates_side_pots` | Side pot list is non-empty when all-in player present |

---

## Findings

### [MEDIUM-1] Client-trusted `is_all_in` flag with no server-side stack validation

**File:** `src/app/routes/hands.py`
**Line(s):** 1570-1571
**Category:** design

**Problem:**
The `is_all_in` flag is accepted from the client with no server-side validation that the player's remaining stack is actually zero. A buggy or malicious client could send `is_all_in=True` on a $1 bet when the player has $500 remaining, triggering incorrect side-pot creation and affecting pot distribution for all players.

**Code:**
```python
if payload.is_all_in:
    player_hand.is_all_in = True
```

**Suggested Fix:**
This is acknowledged in the task description as a pragmatic choice — the system currently has no stack/chip tracking to validate against. When stack tracking is added (future work), add validation: `if payload.is_all_in and player_remaining_stack > 0: raise HTTPException(400, ...)`. For now, document this trust assumption.

**Impact:** Incorrect side pot calculations if client sends bad data. Low risk in controlled alpha environment but should be addressed when stack tracking lands.

---

### [MEDIUM-2] No test for multi-way all-in scenario (bet + raise)

**File:** `test/test_bet_raise_all_in.py`
**Line(s):** entire file
**Category:** correctness

**Problem:**
All 6 tests have at most one player going all-in per hand. There is no test where two players go all-in at different amounts (e.g., UTG bets all-in for $5, SB raises all-in for $10) which would exercise the multi-tier side pot logic. This is the canonical side-pot scenario that the original bug affected.

**Suggested Fix:**
Add a test where player A bets all-in for $X, player B raises all-in for $Y (Y > X), and player C calls. Assert that side_pots contains two entries with correct eligible player lists and amounts.

**Impact:** Multi-way all-in is the highest-risk scenario for side pot correctness. Without a test, regressions in `compute_side_pots()` for this case would go undetected.

---

### [LOW-1] `is_all_in` flag silently accepted on fold/check actions

**File:** `src/app/routes/hands.py`
**Line(s):** 1570-1571
**Category:** convention

**Problem:**
Sending `is_all_in=True` with a `fold` or `check` action will still set `player_hand.is_all_in = True`, which is semantically nonsensical. A fold-while-all-in or check-while-all-in should not mark the player for side-pot eligibility.

**Code:**
```python
if payload.is_all_in:
    player_hand.is_all_in = True
```

**Suggested Fix:**
Guard with action type: `if payload.is_all_in and payload.action in ('bet', 'raise', 'call'):`. Low priority since clients shouldn't send this combination, and a folded player is excluded from side pots by the `non_folded_ids` filter anyway.

**Impact:** Minimal in practice — folded players are excluded from side pots regardless. A check-while-all-in is internally contradictory but harmless.

---

### [LOW-2] Test helper `_act()` defaults `is_all_in=False` without testing that default

**File:** `test/test_bet_raise_all_in.py`
**Line(s):** 34-44
**Category:** convention

**Problem:**
The `_act()` helper defaults `is_all_in=False` and only includes the field in the payload when `True`. There's no explicit test that sending `is_all_in=False` (or omitting it) does NOT set the all-in flag — this is only implicitly covered by other test files.

**Suggested Fix:**
Minor — existing tests in `test_betting_state_machine.py` and others already cover the non-all-in path. No action needed unless the test file is meant to be self-contained.

**Impact:** None. Coverage exists indirectly.

---

## Positives

- **Clean `if`/`elif` structure** — The explicit flag check followed by the auto-detection fallback is easy to read and maintain. The precedence is correct: explicit flag wins over heuristic.
- **Backward compatible** — `is_all_in` defaults to `False` in the Pydantic model, so existing clients that don't send the field continue to work with auto-detection.
- **Good test organization** — Three test classes (`TestBetAllIn`, `TestRaiseAllIn`, `TestCallAllInFallback`) clearly map to the three action types affected. Test names are descriptive.
- **Minimal change surface** — Only 4 lines of production code changed (1 field + 3 lines of logic). The fix is tightly scoped to the bug.

---

## Overall Assessment

The fix correctly addresses the reported bug: bet/raise all-ins are now detectable via an explicit `is_all_in` client flag, and the existing call-for-less auto-detection is preserved as a fallback. All 6 new tests pass. The implementation is minimal and backward-compatible.

**No CRITICAL or HIGH findings.** The two MEDIUM findings are:
1. A design-level concern about trusting the client flag (acknowledged trade-off given no stack tracking)
2. A test gap for multi-way all-in scenarios

Both are acceptable for the current alpha stage. Recommend filing a follow-up task for multi-way all-in test coverage when stack tracking work begins.
