# Code Review Report — aia-core (Cycle 14)

**Date:** 2026-04-12
**Target:** `frontend/src/dealer/ActiveHandDashboard.tsx`, `frontend/src/dealer/ActiveHandDashboard.test.tsx`
**Reviewer:** Scott (automated)
**Cycle:** 14

**Task:** Bug: dealer confirm action uses call amount for raise actions
**Beads ID:** aia-core-zdpj

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 1 |
| LOW | 2 |
| **Total Findings** | **3** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | For bet/raise, open override form instead of auto-submitting | SATISFIED | `handleConfirmAction()` lines 108–112 check `action === 'bet' \|\| action === 'raise'` and route to override form | Correct routing; pre-fills `overrideAction` with the detected action type |
| 2 | Fold/check auto-confirm without opening override | SATISFIED | `handleConfirmAction()` lines 113–126 proceed to `recordPlayerAction` for non-bet/non-raise actions | Amount correctly computed: `call` uses `amountToCall`, others pass `null` |
| 3 | Tests cover fold/check auto-confirm and bet/raise override routing | SATISFIED | 4 new tests at end of test file cover all 4 action types | See LOW-2 for pre-fill gap |

---

## Findings

### [MEDIUM] M-1: `call` action sends `amountToCall ?? 0` — zero-amount call could be valid but ambiguous

**File:** `frontend/src/dealer/ActiveHandDashboard.tsx`
**Line(s):** 114
**Category:** correctness

**Problem:**
When the first legal action is `call`, the amount defaults to `amountToCall ?? 0`. If `amountToCall` is `undefined` (prop not provided), this sends `amount: 0` to the backend. A zero-dollar call is semantically equivalent to a check — the backend may accept it, but it could create confusing action records. This is pre-existing behavior (not introduced by this fix) but worth flagging since this code path was touched.

**Code:**
```ts
const amount = action === 'call' ? (amountToCall ?? 0) : undefined;
```

**Suggested Fix:**
Consider guarding: if `amountToCall` is `undefined` or `0` for a `call`, skip the amount or warn the dealer. Alternatively, document that `amountToCall` is required when `call` is a legal action.

**Impact:** Low risk — the backend likely validates this, and props should always be populated when a call is legal. No immediate breakage.

---

### [LOW] L-1: Override form pre-fills action but tests don't verify the pre-filled value

**File:** `frontend/src/dealer/ActiveHandDashboard.test.tsx`
**Line(s):** ~500–520
**Category:** test completeness

**Problem:**
The two new tests ("opens override form instead of auto-submitting when default action is raise/bet") verify that the override form opens and `recordPlayerAction` is not called. They do **not** verify that the `override-action-select` element is pre-filled with the correct action (`raise` or `bet`). If the pre-fill logic regressed, these tests would still pass.

**Suggested Fix:**
Add an assertion in each test:
```ts
expect((screen.getByTestId('override-action-select') as HTMLSelectElement).value).toBe('raise');
```

**Impact:** Minor test quality gap — the production code is correct, but a regression in pre-fill would go undetected.

---

### [LOW] L-2: `check` amount sent as `null` (via `undefined ?? null`) — correct but implicit

**File:** `frontend/src/dealer/ActiveHandDashboard.tsx`
**Line(s):** 114–115
**Category:** convention

**Problem:**
For `check` and `fold`, the ternary `action === 'call' ? (amountToCall ?? 0) : undefined` produces `undefined`, then `amount ?? null` converts it to `null`. The logic is correct but the indirection makes it harder to read at a glance.

**Suggested Fix:**
No change required. Could optionally be rewritten for clarity:
```ts
const amount = action === 'call' ? (amountToCall ?? 0) : null;
```

**Impact:** Readability only. No functional concern.

---

## Positives

- **Fix is surgical and correct.** The two-line guard (`action === 'bet' || action === 'raise'`) at the top of `handleConfirmAction` cleanly separates amount-required actions from auto-confirmable ones. No over-engineering.
- **Pre-fill is thoughtful.** `setOverrideAction(action)` ensures the override form starts with the right action type, reducing dealer clicks.
- **Tests cover all four action branches.** Fold auto-confirm, check auto-confirm, bet→override, raise→override are all exercised. The `check` test also sets `amountToCall: 0` which validates the edge case.
- **Existing tests remain stable.** The pre-existing "confirm calls recordPlayerAction with first legal action" test still works because its `legalActions[0]` is `call`, which is unaffected by the new guard.

---

## Overall Assessment

The fix correctly addresses the bug described in aia-core-zdpj. The routing logic is sound: fold/check auto-submit, call auto-submits with `amountToCall`, and bet/raise redirect to the override form where the dealer must enter an explicit amount. No critical or high-severity issues found. The three findings are all advisory — one medium pre-existing ambiguity and two low-severity test/readability notes.

**Verdict:** Clean. No blockers.
