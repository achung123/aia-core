# Code Review Report — alpha-feedback-008

**Date:** 2026-04-12
**Cycle:** 4
**Target:** Rebuild DealerApp shell (single-mode, mobile-first)
**Reviewer:** Scott (automated)

**Task:** T-018 — Rebuild DealerApp shell (single-mode, mobile-first)
**Beads ID:** aia-core-d1b6
**Epic:** alpha-feedback-008

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 1 |
| MEDIUM | 1 |
| LOW | 3 |
| **Total Findings** | **5** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | Steps: gameSelector → dashboard → activeHand → review | SATISFIED | `DealerApp.tsx` L378–432: four `currentStep ===` conditional blocks render each step; `dealerStore.ts` L90: `initialState.currentStep = 'gameSelector'` | `create` sub-step also handled as part of gameSelector flow |
| 2 | Each step renders corresponding child component | SATISFIED | gameSelector → `<GameSelector>`, create → `<GameCreateForm>`, dashboard → `<HandDashboard>`, activeHand → `<PlayerGrid>` + overlays, review → hand summary div | Verified by 7 new tests in `DealerApp.test.tsx` |
| 3 | Navigation clear and one-thumb accessible | SATISFIED | `DealerApp.tsx` L456–477: fixed bottom nav with `minHeight: 44px` touch targets, `position: fixed; bottom: 0`, 4 labeled buttons | Minor CSS conflict (see LOW-3) |
| 4 | State management uses Zustand store | SATISFIED | `dealerStore.ts`: full `create<DealerState & DealerActions>()` with `persist` middleware on `sessionStorage`; DealerApp consumes via `useDealerStore()` | Legacy reducer in `dealerState.ts` maintained in parallel for backward compat |
| 5 | RTL tests pass, npm run build succeeds | SATISFIED | 614 tests pass (45 files), `vite build` succeeds (893 KB bundle) | `tsc --noEmit` shows 4 task-related warnings (TS6133 unused vars) — non-blocking for Vite build |

---

## Findings

### [HIGH] restoreState normalizes 'review' to 'activeHand' — semantic mismatch with new 4-step flow

**File:** `frontend/src/stores/dealerStore.ts`
**Line(s):** 206–210
**Category:** correctness

**Problem:**
`restoreState` normalizes `currentStep === 'review'` to `'activeHand'`. This was correct when 'review' referred to the ephemeral detection-review overlay (which depends on local state). Now that 'review' is a legitimate step 4 in the 4-step flow (hand summary), this normalization would incorrectly snap users from the review step back to activeHand if `restoreState` is ever invoked.

The same issue exists in the legacy reducer (`dealerState.ts` L249–254).

Currently `restoreState` is not called anywhere in production code, so this is **latent** — but the semantic mismatch will become a bug when the action is used (e.g., for cross-tab sync or manual state recovery).

**Code:**
```ts
restoreState: (payload) =>
  set((state) => {
    const restored = { ...state, ...payload };
    if (restored.currentStep === 'review' || restored.currentStep === 'outcome') {
      restored.currentStep = 'activeHand';
    }
    return restored;
  }),
```

**Suggested Fix:**
Remove `'review'` from the normalization check. Only `'outcome'` (and any other ephemeral overlay steps) should be normalized:
```ts
if (restored.currentStep === 'outcome') {
  restored.currentStep = 'activeHand';
}
```
Update the corresponding tests in `dealerStore.test.ts` and `dealerState.test.ts`.

**Impact:** Latent bug — will break review step persistence if `restoreState` is called while on step 4.

---

### [MEDIUM] "Next Hand" and "Back to Dashboard" buttons on review step are functionally identical

**File:** `frontend/src/dealer/DealerApp.tsx`
**Line(s):** 419–431
**Category:** design

**Problem:**
Both the "Next Hand" (`data-testid="next-hand-btn"`) and "Back to Dashboard" (`data-testid="review-back-btn"`) buttons call `finishHand()`, which resets all hand state and navigates to `dashboard`. The two buttons are visually distinct (primary vs secondary styling) but perform the exact same action, which is confusing UX.

**Code:**
```tsx
<button data-testid="next-hand-btn" style={primaryButtonStyle}
  onClick={() => finishHand()}>
  Next Hand
</button>
<button data-testid="review-back-btn" style={secondaryButtonStyle}
  onClick={() => finishHand()}>
  Back to Dashboard
</button>
```

**Suggested Fix:**
Either (a) make "Next Hand" call `finishHand()` and then immediately create a new hand (`createHand()`), or (b) consolidate into a single "Done" button if there's no functional difference intended. If the intent is to provide two separate navigation paths, distinguish them clearly.

**Impact:** Misleading UX — user expects different behavior from differently labeled buttons.

---

### [LOW] Unused state setters: `setFinishError` and `setFinishing`

**File:** `frontend/src/dealer/DealerApp.tsx`
**Line(s):** 40–41
**Category:** convention

**Problem:**
`setFinishError` and `setFinishing` are declared via `useState` but their setters are never called. The state variables `finishError` and `finishing` are read in JSX (lines 445, 447, 450, 452) but will always be their initial values (`null` and `false`), making those code paths dead. TypeScript reports TS6133.

**Suggested Fix:**
Remove both `useState` declarations and their references in the JSX if the async finish flow was intentionally removed. If the flow will be re-added later, suppress with a TODO comment.

**Impact:** Dead code; causes TypeScript warnings.

---

### [LOW] Unused import: `act` in dealerStore.test.ts

**File:** `frontend/src/stores/dealerStore.test.ts`
**Line(s):** 8
**Category:** convention

**Problem:**
`const act = useDealerStore.getState;` is declared but never referenced. TypeScript reports TS6133.

**Suggested Fix:**
Remove the unused `act` alias.

**Impact:** Dead code; causes TypeScript warning.

---

### [LOW] CSS shorthand/longhand conflict in bottom nav styles

**File:** `frontend/src/dealer/DealerApp.tsx`
**Line(s):** 581, 588
**Category:** convention

**Problem:**
`navItemStyle` sets `border: 'none'` (shorthand) while `navItemActiveStyle` sets `borderTop: '2px solid #818cf8'` (longhand). When React applies the active style, it produces a console warning: "Removing a style property during rerender (borderTop) when a conflicting property is set (border) can lead to styling bugs."

**Suggested Fix:**
Replace `border: 'none'` in `navItemStyle` with explicit longhand properties (`borderTop: 'none', borderRight: 'none', borderBottom: 'none', borderLeft: 'none'`), or use `borderTop: 'none'` plus a separate reset and let `navItemActiveStyle` override only `borderTop`.

**Impact:** Console warnings in development; potential subtle styling bugs on re-render.

---

## Positives

- **Clean 4-step architecture**: The step flow is immediately readable in the JSX — each step has a clearly labeled conditional block with a comment header.
- **Overlay pattern within activeHand**: Camera capture, detection review, and outcome selection render as overlays within the activeHand step rather than as separate steps, keeping the navigation model simple.
- **Bottom nav with proper disabled states**: Dashboard is disabled when no game is selected, Hand is disabled when no hand is active, Review is disabled when not on review — preventing navigation to invalid states.
- **Polling logic scoped correctly**: The `useEffect` for hand status polling only activates on `activeHand` step with both `gameId` and `currentHandId` present, with proper `AbortController` cleanup.
- **Strong test coverage**: 7 new tests for the 4-step shell cover rendering of each step, navigation highlighting, and the review-to-dashboard transition. Existing integration tests updated to match new step names.
- **State persistence via Zustand `persist`**: Session storage persistence is properly configured with `createJSONStorage(() => sessionStorage)`, allowing state to survive page refreshes.

---

## Overall Assessment

The DealerApp restructure to a 4-step flow is well-executed. The architecture is clean, the 4 steps are clearly rendered, the mobile bottom nav has appropriate touch targets (≥44px), and state management is cleanly wired through Zustand. All 614 tests pass and the Vite production build succeeds.

**1 HIGH finding** (latent `restoreState` normalization bug) should be addressed before any future work uses `restoreState` — it's not urgent since the action isn't called in production today. The **MEDIUM** finding about identical review buttons should be clarified for UX consistency. The 3 **LOW** findings are dead code / style nits.

No CRITICAL findings. The implementation satisfies all 5 acceptance criteria.
