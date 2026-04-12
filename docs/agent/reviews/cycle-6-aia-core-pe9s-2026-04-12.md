# Code Review Report — alpha-feedback-008

**Date:** 2026-04-12
**Cycle:** 6
**Target:** `frontend/src/dealer/HandDashboard.tsx`, `frontend/src/dealer/HandDashboard.test.tsx`, `frontend/src/dealer/DealerApp.test.tsx`, `frontend/src/dealer/GameSelectorIntegration.test.tsx`
**Reviewer:** Scott (automated)

**Task:** T-020 — One-button Start Hand UI
**Beads ID:** aia-core-pe9s

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
| 1 | Start Hand button calls `startHand(gameId)` | SATISFIED | `HandDashboard.tsx` L71–76 calls `startHand(gameId)`; test "Start Hand button calls startHand(gameId) and transitions on success" verifies with `expect(mockedStartHand).toHaveBeenCalledWith(42)` | — |
| 2 | On success, transitions to Active Hand step | SATISFIED | `HandDashboard.tsx` L73 calls `onSelectHand(result.hand_number)` on success; `DealerApp.tsx` L117–124 `handleSelectHand` fetches hand data and transitions to `activeHand`; DealerApp.test.tsx "clicking Start Hand calls startHand on the backend" and "after hand creation, transitions to activeHand" both verify | — |
| 3 | Button shows loading state during API call | SATISFIED | `HandDashboard.tsx` L69–77 sets `starting` state, button shows "Starting…" text and `disabled` attribute; test "Start Hand button shows loading state during API call" verifies text and disabled attribute | — |
| 4 | Error message displayed if start fails | SATISFIED | `HandDashboard.tsx` L74 catches error, sets `startError`; L130–132 renders `start-hand-error` div; test "Start Hand button shows error message when API fails" verifies error display and button re-enabled | — |
| 5 | Component test verifies the flow (mocked API) | SATISFIED | 4 dedicated Start Hand tests in `HandDashboard.test.tsx` (success, loading, error, disabled-during-loading); integration tests in `DealerApp.test.tsx` verify full flow through store | — |

---

## Findings

### [MEDIUM] No double-click guard beyond disabled attribute

**File:** `frontend/src/dealer/HandDashboard.tsx`
**Line(s):** 68–77
**Category:** correctness

**Problem:**
The `handleStartHand` function relies solely on the `disabled` HTML attribute to prevent concurrent calls. While the `disabled` attribute does prevent normal clicks, there is a subtle race window: if a user clicks the button before React re-renders with `starting=true` (the state update is async), two `startHand()` calls could fire. In practice, React batches state updates and the `disabled` attribute blocks DOM events, so this is unlikely in real usage — but a defensive guard at the top of the function (`if (starting) return;`) would be more robust.

**Code:**
```tsx
async function handleStartHand() {
    setStarting(true);
    setStartError(null);
    try {
      const result = await startHand(gameId);
      onSelectHand(result.hand_number);
    } catch (err) {
      setStartError((err as Error).message || 'Failed to start hand');
    } finally {
      setStarting(false);
    }
  }
```

**Suggested Fix:**
Add an early return guard:
```tsx
async function handleStartHand() {
    if (starting) return;
    setStarting(true);
    // ...rest unchanged
```

**Impact:** Very low probability race condition. The disabled attribute provides adequate protection in nearly all scenarios, but an explicit guard is a standard defensive pattern.

---

### [MEDIUM] `startError` not cleared when a new hand is successfully started or the user navigates away

**File:** `frontend/src/dealer/HandDashboard.tsx`
**Line(s):** 69, 130–132
**Category:** correctness

**Problem:**
If the user clicks Start Hand, gets an error, then clicks Start Hand again, the error IS cleared (line 70 `setStartError(null)`). However, the error persists visually even if the user navigates to a different hand by clicking a hand row, then comes back (component re-mounts, so this is actually fine due to fresh local state). This is a non-issue in practice because local state resets on mount. Noting for completeness — no action required.

**Suggested Fix:** No action needed — component-local state resets on remount.

**Impact:** None in practice.

---

### [LOW] `handleStartHand` defined inside the render path after an early return

**File:** `frontend/src/dealer/HandDashboard.tsx`
**Line(s):** 68–77
**Category:** convention

**Problem:**
The `handleStartHand` async function is defined inside the component body after the early-return guards (loading/error states). This means it's only created when the component reaches the main render path. While this works correctly, it's inconsistent with the `handleEndGame` function which is also defined after the guard. Both patterns are fine functionally, but if the component grows, moving handlers before early returns (or extracting to custom hooks) would improve readability.

**Impact:** Minor readability concern. No functional impact.

---

### [LOW] Test mock for `QRCodeDisplay` references `.jsx` extension while source uses `.tsx`

**File:** `frontend/src/dealer/HandDashboard.test.tsx`
**Line(s):** 13
**Category:** convention

**Problem:**
The mock declaration uses `vi.mock('./QRCodeDisplay.jsx', ...)` but the actual file import in `HandDashboard.tsx` (line 3) uses `'./QRCodeDisplay.tsx'`. This works because Vitest resolves both to the same module, but the inconsistency could confuse future contributors.

**Code:**
```tsx
vi.mock('./QRCodeDisplay.jsx', () => ({   // .jsx
```
vs
```tsx
import { QRCodeDisplay } from './QRCodeDisplay.tsx';  // .tsx
```

**Suggested Fix:** Change the mock to `vi.mock('./QRCodeDisplay.tsx', ...)` for consistency.

**Impact:** No functional impact. Minor convention inconsistency.

---

## Positives

- **Clean async pattern:** The `handleStartHand` function follows the standard loading/error/finally pattern used throughout the codebase (`handleEndGame` uses the same structure). Consistent and readable.
- **Thorough test coverage:** 4 dedicated tests for the Start Hand feature cover success, loading state, error display, and double-click prevention — all well-structured.
- **Proper disabled state:** The button correctly shows "Starting…" text and is disabled during the API call, matching the mobile-first UX intent.
- **Integration tests updated:** Both `DealerApp.test.tsx` and `GameSelectorIntegration.test.tsx` verify the full flow from dashboard through to activeHand, ensuring the wiring between `HandDashboard` → `DealerApp` → `dealerStore` is correct.
- **No security concerns:** The `startHand(gameId)` call uses a numeric `gameId` passed as a prop — no user-controlled strings are interpolated into API paths without encoding. The `request()` helper in `client.ts` properly throws on non-2xx responses.
- **All 79 tests pass** across the 3 reviewed test files (3 passed, 0 failed).

---

## Overall Assessment

The implementation of T-020 (One-button Start Hand UI) is clean, correct, and well-tested. All 5 acceptance criteria are fully satisfied. The Start Hand button properly calls `startHand(gameId)`, transitions to activeHand on success, shows loading state, displays errors, and has comprehensive test coverage.

No CRITICAL or HIGH findings. Two MEDIUM findings are both low-risk (one is a theoretical race condition mitigated by React's rendering model, the other is a non-issue on inspection). Two LOW findings are purely stylistic.

**Verdict: PASS — ready for next cycle.**
