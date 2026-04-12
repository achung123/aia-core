# Code Review Report — dealer-interface-003

**Date:** 2026-04-07
**Target:** `frontend/src/dealer/HandDashboard.jsx`, `frontend/src/dealer/DealerApp.jsx`
**Reviewer:** Scott (automated)
**Cycle:** 5
**Epic:** dealer-interface-003

**Task:** T-006 — Build Hand Dashboard view
**Beads ID:** aia-core-a3b

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 0 |
| LOW | 2 |
| **Total Findings** | **2** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | Game date and player names are displayed | SATISFIED | `HandDashboard.jsx` L11–L23: renders `gameDate` in a span and maps `players` array to styled chips | — |
| 2 | Hand count shows the number of submitted hands | SATISFIED | `HandDashboard.jsx` L25–L27: renders "Hands recorded: {handCount}"; `DealerApp.jsx` L8: `handCount` state initialized to 0 with setter | Increment logic deferred to T-013 (hand submission); wiring is correctly prepared |
| 3 | Button text reflects whether it's the first hand or a subsequent one | SATISFIED | `HandDashboard.jsx` L4: `handCount === 0 ? 'Enter First Hand' : 'Add New Hand'` | — |
| 4 | Tapping the button transitions to the Player Grid | SATISFIED | `HandDashboard.jsx` L29: button `onClick={onStartHand}`; `DealerApp.jsx` L15–L17: `handleStartHand` sets step to `'playerGrid'` | — |

---

## Findings

### [LOW] Unnecessary `h` import in HandDashboard.jsx

**File:** `frontend/src/dealer/HandDashboard.jsx`
**Line(s):** 1
**Category:** convention

**Problem:**
`HandDashboard.jsx` explicitly imports `import { h } from 'preact'` but `@preact/preset-vite` (configured in `vite.config.js`) auto-injects the JSX factory. `DealerApp.jsx` correctly omits this import, creating an inconsistency between the two new files.

**Code:**
```jsx
import { h } from 'preact';
```

**Suggested Fix:**
Remove the `h` import to match `DealerApp.jsx` and rely on the Vite preset's automatic injection. Alternatively, add the import to `DealerApp.jsx` for consistency — but removing it from both is the idiomatic approach with `@preact/preset-vite`.

**Impact:** No runtime effect; purely a consistency concern between files created in the same task.

---

### [LOW] Step transition is one-way with no return path from playerGrid

**File:** `frontend/src/dealer/DealerApp.jsx`
**Line(s):** 35–37
**Category:** design

**Problem:**
Once the step transitions to `'playerGrid'`, there is no mechanism to return to `'dashboard'`. This is expected — T-007 (Player Grid) and T-013 (hand submission) will implement the return path per S-3.2. However, the current placeholder (`<p>Player Grid — coming soon</p>`) provides no way to navigate back during development/testing.

**Code:**
```jsx
{step === 'playerGrid' && (
  <p>Player Grid — coming soon</p>
)}
```

**Suggested Fix:**
No action required for T-006 scope. When T-007 is implemented, ensure a back/cancel action transitions step back to `'dashboard'`. For developer convenience, a temporary back button in the placeholder could help manual testing during intermediate cycles.

**Impact:** No user impact in the current build; the placeholder is unreachable without first creating a game. Future tasks will address the return flow.

---

## Positives

- **Clean component decomposition**: `HandDashboard` is a pure presentational component with no internal state — all data flows via props from `DealerApp`. This makes it easy to test and reason about.
- **Correct step-based state machine**: `DealerApp` uses a simple string-based step (`'create' → 'dashboard' → 'playerGrid'`) which is readable and avoids premature complexity before T-008 introduces `useReducer`.
- **Safe rendering**: Player names are rendered as JSX text nodes (auto-escaped), avoiding XSS. No `dangerouslySetInnerHTML` usage.
- **Mobile-friendly layout**: `maxWidth: 480px`, full-width button with adequate padding (`0.75rem`), flex-wrap chip container with gap — all appropriate for the mobile-first target.
- **Proper guard on render**: `step === 'dashboard' && game &&` prevents `HandDashboard` from rendering with null game state.
- **Future-ready wiring**: `handCount` state and its setter are established in `DealerApp`, ready for T-013 to wire the increment on hand submission.

---

## Overall Assessment

T-006 is cleanly implemented. All four acceptance criteria are satisfied. The `HandDashboard` component is well-structured as a stateless presentational component receiving props from `DealerApp`. The step-based navigation in `DealerApp` is simple and correct for the current scope. No security, correctness, or design issues were found. Two low-severity observations are noted for consistency and future awareness. **This task passes review.**
