# Code Review Report — aia-core-9sbm

**Date:** 2026-04-12
**Cycle:** 19
**Target:** `frontend/src/player/PlayerActionButtons.tsx`, `frontend/src/player/PlayerActionButtons.test.tsx`, `frontend/src/player/PlayerApp.tsx`
**Reviewer:** Scott (automated)

**Task:** T-030 — Player action buttons (fold/check/call/bet/raise)
**Beads ID:** aia-core-9sbm

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 1 |
| MEDIUM | 2 |
| LOW | 2 |
| **Total Findings** | **5** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | After submitting hole cards, player sees 5 buttons: Fold, Check, Call, Bet, Raise | SATISFIED | `PlayerApp.tsx` L352–357 renders `<PlayerActionButtons>` when `playerStatus === 'joined'`; test "renders all 5 action buttons" confirms all 5 test IDs present | — |
| 2 | Fold calls recordPlayerAction() with action:fold and shows Folded state | SATISFIED | `PlayerActionButtons.tsx` L72 onClick calls `handleAction('fold')`; test "Fold calls recordPlayerAction with action:fold and street:preflop" verifies params | Folded visual state managed by `PlayerStatusView` via polling — correct separation |
| 3 | Check calls with action:check; Call with action:call | SATISFIED | Lines 78, 84 wire onClick to `handleAction('check')` and `handleAction('call')`; two dedicated tests verify exact API params | — |
| 4 | Bet/Raise opens ChipPicker; on confirm calls with amount | SATISFIED | Lines 90, 97 set `chipAction` state; render L54–61 shows `<ChipPicker>` when `chipAction` is set; tests verify full flow including chip selection and confirm | Error path has a bug — see HIGH finding |
| 5 | After acting, buttons disabled until new community cards appear | SATISFIED | `hasActed` state + `useEffect` on `communityCardCount`; tests "buttons are disabled after acting" and "buttons re-enable when communityCardCount changes" | — |
| 6 | Street auto-determined from community card count | SATISFIED | `getStreet()` function + 5 unit tests + 3 integration tests sending correct street to API | — |
| 7 | Test covers all action flows | SATISFIED | 20 tests covering all buttons, ChipPicker integration, disable/re-enable, street mapping, error handling, and styling | Missing Bet/Raise error path test — see LOW finding |

---

## Findings

### [HIGH] Bet/Raise API failure leaves ChipPicker visible with no error feedback

**File:** `frontend/src/player/PlayerActionButtons.tsx`
**Line(s):** 40–48
**Category:** correctness

**Problem:**
When a Bet or Raise API call fails, the `catch` block sets `error` state but does **not** clear `chipAction`. The render logic (lines 53–61) shows ChipPicker when `chipAction` is non-null, and the error message (line 65) only renders in the else branch. Result: after a Bet/Raise failure, the user sees ChipPicker again with no indication the action failed. The error is silently swallowed from the user's perspective.

**Code:**
```tsx
// Lines 40-48
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Action failed';
      setError(message);
      // BUG: chipAction is NOT cleared here
      // ChipPicker will still be shown, hiding the error message
    }
```

**Suggested Fix:**
Add `setChipAction(null)` in the catch block so the user returns to the action buttons view where the error message is visible. Alternatively, render the error inside the ChipPicker branch.

```tsx
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Action failed';
      setError(message);
      setChipAction(null);
    }
```

**Impact:** Users cannot see that their Bet/Raise failed and have no prompt to retry. They see ChipPicker again and may re-submit, or get confused.

---

### [MEDIUM] No double-tap guard — rapid clicks can fire duplicate API calls

**File:** `frontend/src/player/PlayerActionButtons.tsx`
**Line(s):** 36–48
**Category:** correctness

**Problem:**
`handleAction()` is async. Between the button click and `setHasActed(true)` resolving (after the await), buttons remain enabled. A rapid double-tap fires two `recordPlayerAction()` calls, recording duplicate actions on the backend. The backend POST endpoint creates a new action record each time — no idempotency guard.

**Code:**
```tsx
  async function handleAction(action: ActionEnum, amount?: number) {
    setError(null);
    try {
      await recordPlayerAction(/* ... */);  // <-- gap between click and setHasActed
      setHasActed(true);
```

**Suggested Fix:**
Add an `isSubmitting` ref or state that's set immediately on click and checked before firing:

```tsx
const [isSubmitting, setIsSubmitting] = useState(false);

async function handleAction(action: ActionEnum, amount?: number) {
  if (isSubmitting) return;
  setIsSubmitting(true);
  // ... existing logic ...
  finally { setIsSubmitting(false); }
}
```

Then use `disabled={hasActed || isSubmitting}` on buttons.

**Impact:** Duplicate action records in the database for the same street. Relatively low likelihood on desktop but common on mobile touch interfaces.

---

### [MEDIUM] Bet/Raise allows $0.00 amount submission

**File:** `frontend/src/player/PlayerActionButtons.tsx`
**Line(s):** 56
**Category:** correctness

**Problem:**
ChipPicker allows confirming with a total of `$0.00` (no chips tapped). The `onConfirm` callback passes `0` to `handleAction`, which sends `amount: 0` to the backend. A bet or raise of $0 is semantically invalid in poker. While the backend may reject this (if it validates amount > 0), the frontend provides no guard.

**Code:**
```tsx
<ChipPicker
  onConfirm={(amount) => handleAction(chipAction, amount)}  // amount can be 0
  onCancel={() => setChipAction(null)}
/>
```

**Suggested Fix:**
Either disable the Confirm button in ChipPicker when total is 0 (preferred — fix in ChipPicker itself), or guard in the onConfirm callback:

```tsx
onConfirm={(amount) => { if (amount > 0) handleAction(chipAction, amount); }}
```

**Impact:** Confusing UX — user can submit a $0 bet. Backend likely rejects it, triggering the (hidden) error from the HIGH finding above.

---

### [LOW] Disabled buttons lack visual styling

**File:** `frontend/src/player/PlayerActionButtons.tsx`
**Line(s):** 107–122
**Category:** design

**Problem:**
When `hasActed` is true, buttons are disabled via the HTML `disabled` attribute but no visual style change is applied (no opacity reduction, greyed-out color, etc.). Browser defaults vary, and on mobile Safari the disabled state is especially subtle.

**Suggested Fix:**
Add a conditional style or CSS class for disabled state:

```tsx
style={{ ...styles.button, ...(hasActed && { opacity: 0.5, cursor: 'not-allowed' }) }}
```

**Impact:** Minor UX issue — player may not realize buttons are disabled after acting.

---

### [LOW] No test for Bet/Raise API failure path

**File:** `frontend/src/player/PlayerActionButtons.test.tsx`
**Line(s):** N/A (missing test)
**Category:** correctness

**Problem:**
The error-handling test (line 186) only covers the Fold button failure path. There is no test for when a Bet/Raise confirm triggers an API failure. Adding this test would have exposed the HIGH finding (chipAction not cleared, error hidden).

**Suggested Fix:**
Add a test that: clicks Bet → selects chips → confirms → API rejects → asserts error is visible and user can retry.

**Impact:** Low immediate impact, but the missing test allowed the HIGH bug to ship undetected.

---

## Positives

- **Clean component design** — `PlayerActionButtons` is well-scoped with a clear props interface and no unnecessary coupling to parent state.
- **Exported `getStreet()` pure function** — Separating street logic into a testable pure function is good design. It has 5 unit tests with solid edge-case coverage.
- **Thorough AC coverage** — 20 tests cover all 7 acceptance criteria, all 5 action types, ChipPicker integration, disable/re-enable lifecycle, and street auto-detection.
- **Correct TypeScript usage** — Types are properly imported and used from `api/types.ts` (`StreetEnum`, `ActionEnum`). No `any` types.
- **Idiomatic React** — `useEffect` dependency on `communityCardCount` to reset `hasActed` is the correct pattern for street-change re-enablement.
- **Good separation of concerns** — PlayerApp correctly gates action buttons behind `playerStatus === 'joined'` and passes all required props including the polled `communityCardCount`.

---

## Overall Assessment

The implementation satisfies all 7 acceptance criteria. The component is well-structured, properly typed, and thoroughly tested for the happy paths. The **one HIGH finding** (Bet/Raise error silently swallowed) should be fixed before the integration test task (aia-core-6pai) begins, as it would cause flaky behavior in failure scenarios. The two MEDIUM findings (double-tap race condition, $0 amount) are worth addressing but are not blockers. All 20 tests pass green.

**Recommended next steps:**
1. Fix HIGH: Add `setChipAction(null)` to the catch block in `handleAction()`
2. Fix MEDIUM: Add `isSubmitting` guard to prevent duplicate API calls
3. Add test for Bet/Raise error path to prevent regression
