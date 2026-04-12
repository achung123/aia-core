# Code Review Report — aia-core

**Date:** 2026-04-12
**Cycle:** 16
**Target:** `frontend/src/dealer/DealerApp.tsx`, `frontend/src/dealer/DealerApp.test.tsx`
**Reviewer:** Scott (automated)

**Task:** T-016 — Convert DealerApp shell to TSX
**Beads ID:** aia-core-s0tm

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
| 1 | DealerApp.tsx exists, compiles with strict TS, and renders correctly | SATISFIED | `frontend/src/dealer/DealerApp.tsx` exists; `tsc --noEmit` produces zero errors for this file; 44/44 tests pass with correct rendering | — |
| 2 | useReducer replaced with Zustand store hooks (useDealerStore) | SATISFIED | `DealerApp.tsx` L27-34 destructures from `useDealerStore()`; grep for `useReducer` returns zero hits in the file | — |
| 3 | No manual sessionStorage logic (persist middleware handles it) | SATISFIED | grep for `sessionStorage` returns zero hits in `DealerApp.tsx`; persist middleware configured in `stores/dealerStore.ts` L274-277 | — |
| 4 | All child imports reference .tsx files | SATISFIED | Lines 7-15 import `GameSelector.tsx`, `GameCreateForm.tsx`, `HandDashboard.tsx`, `PlayerGrid.tsx`, `CameraCapture.tsx`, `DetectionReview.tsx`, `OutcomeButtons.tsx`, `DealerPreview.tsx`, `QRCodeDisplay.tsx` — all `.tsx` | — |
| 5 | Tests converted to .test.tsx and pass | SATISFIED | `DealerApp.test.tsx` exists; vitest run reports 44 passed, 0 failed | — |

---

## Findings

### [MEDIUM] Test file mocks a `.jsx` module path

**File:** `frontend/src/dealer/DealerApp.test.tsx`
**Line(s):** 89
**Category:** convention

**Problem:**
The test mocks `../mobile/StreetScrubber.jsx` — this is currently correct since `StreetScrubber.jsx` has not yet been converted to TSX. However, when that future task converts `StreetScrubber` to `.tsx`, this mock path will silently stop matching and the mock will be ineffective. This is a forward-compatibility note, not a current bug.

**Code:**
```tsx
vi.mock('../mobile/StreetScrubber.jsx', () => ({
  StreetScrubber: () => null,
  STREETS: ['Pre-Flop', 'Flop', 'Turn', 'River', 'Showdown'],
}));
```

**Suggested Fix:**
No action needed now. When StreetScrubber is converted to TSX (a separate task), update this mock path accordingly.

**Impact:** None currently; potential silent test mock failure during future StreetScrubber conversion.

---

### [LOW] `act(...)` warnings in stderr during polling tests

**File:** `frontend/src/dealer/DealerApp.test.tsx`
**Line(s):** 1086-1180 (polling test block)
**Category:** correctness

**Problem:**
Several tests in the "hand status polling" describe block emit `The current testing environment is not configured to support act(...)` warnings. These occur in tests that switch from `vi.useFakeTimers()` to `vi.useRealTimers()` mid-block, causing React's `act()` wrapper to lose context. Tests still pass, but the warnings indicate state updates happening outside `act()` boundaries.

**Suggested Fix:**
Can be addressed in a follow-up by wrapping the timer-switching tests' async operations more carefully, or by splitting into separate describe blocks with consistent timer modes.

**Impact:** Cosmetic only — no test failures or incorrect assertions.

---

## Positives

- **Clean Zustand migration**: All `useReducer` state and `dispatch()` calls replaced with typed Zustand selectors and actions. The store interface (`DealerState & DealerActions`) provides strong typing.
- **No sessionStorage leakage**: Zero manual `sessionStorage.getItem/setItem` calls — persist middleware in `dealerStore.ts` handles storage transparently.
- **Comprehensive test coverage**: 44 tests covering hand creation, player card capture, retake, community card PATCH, outcome flow (won/folded/lost), finish hand with confirmation dialog, polling for participation mode, error recovery, and edge cases.
- **Proper cleanup**: `useEffect` cleanup functions abort fetch controllers and clear intervals; test `afterEach` unmounts roots and clears sessionStorage.
- **Type-safe interfaces**: `ReviewData`, `DetectionMode`, `OutcomeResult`, `OutcomeStreet`, and `GameMode` all typed via imports or local interfaces.
- **Error handling**: All API calls wrapped in try/catch with user-facing error messages surfaced through `patchError`/`outcomeError`/`finishError` state.

---

## Overall Assessment

The DealerApp shell conversion from JSX to TSX is **complete and clean**. All five acceptance criteria are satisfied. The component compiles without TypeScript errors, uses Zustand exclusively (no useReducer, no manual sessionStorage), imports all children as `.tsx`, and passes all 44 tests. The two findings are minor: a forward-compatibility note about a `.jsx` mock path (which is correct today), and cosmetic `act()` warnings in polling tests. No blockers or regressions.
