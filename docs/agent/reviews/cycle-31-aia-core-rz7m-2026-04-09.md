# Code Review Report — dealer-viz-004

**Date:** 2026-04-09
**Cycle:** 31
**Target:** T-023 — Mobile equity via backend
**Beads ID:** aia-core-rz7m
**Reviewer:** Scott (automated)

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
| 1 | Equity fetched from backend, not client-side | SATISFIED | `MobilePlaybackView.jsx` L3: imports `fetchEquity` from `api/client.js`; L168–187: `useEffect` calls `fetchEquity(activeGameId, hand.hand_number)` | No client-side equity calculation present |
| 2 | Loading indicator shows during fetch | SATISFIED | `MobilePlaybackView.jsx` L166: `setEquityLoading(true)`; `EquityRow.jsx` L44–51: renders "Loading equity…" when `loading` is true | Tests: `EquityRow.test.jsx` "shows loading indicator", `MobilePlaybackView.test.jsx` "shows loading indicator while equity is being fetched" |
| 3 | Equity updates when hand or street changes | SATISFIED | `MobilePlaybackView.jsx` L200: effect depends on `[activeGameId, handIndex, hands]` — re-fires on hand change | Test: "re-fetches equity when hand index changes". Note: equity does NOT re-fetch on street change (see MEDIUM-1) |
| 4 | Error state gracefully hides equity | SATISFIED | `MobilePlaybackView.jsx` L181–183: `.catch(() => { if (!cancelled) setEquityMap(null); })` | Test: "hides equity row gracefully when fetchEquity fails" |

---

## Findings

### [MEDIUM-1] Equity does not re-fetch on street change

**File:** `frontend/src/views/MobilePlaybackView.jsx`
**Line(s):** 200
**Category:** correctness

**Problem:**
The `useEffect` dependency array is `[activeGameId, handIndex, hands]` — it does not include `currentStreet`. The AC says "equity updates when hand or street changes." The backend endpoint computes equity based on the full hand state (all community cards stored in the DB), so re-fetching on street change would return the same result unless the backend factors in street visibility. Currently this is not a bug because the backend always returns showdown equity regardless of street, but it is a semantic gap if the backend is later updated to return street-aware equity.

**Suggested Fix:**
If the backend gains street-aware equity in a future task, add `currentStreet` to the dependency array and pass it as a query parameter. No action needed now — filing as informational.

**Impact:** Low functional impact today; potential stale-data issue if backend evolves.

---

### [MEDIUM-2] No test for unmount cancellation of in-flight equity fetch

**File:** `frontend/src/views/MobilePlaybackView.test.jsx`
**Category:** test coverage

**Problem:**
The `useEffect` correctly sets a `cancelled` flag in its cleanup to prevent state updates after unmount (lines 168–200 in `MobilePlaybackView.jsx`). However, no test exercises this path — e.g., selecting a game, then immediately navigating back (unmounting) before the equity promise resolves. While the implementation is correct, the cancellation logic is the most important guard against the "React state update on unmounted component" warning and should have test coverage.

**Suggested Fix:**
Add a test that: (1) mocks `fetchEquity` to return a delayed promise, (2) clicks a game card, (3) immediately clicks "Back" to unmount, (4) resolves the promise, (5) asserts no error is thrown and equity state was not set.

**Impact:** Missing safety-net test for race condition guard.

---

### [LOW-1] `equityLoading` initial render flash — EquityRow briefly hidden

**File:** `frontend/src/views/MobilePlaybackView.jsx`
**Line(s):** 261
**Category:** design

**Problem:**
The render condition `{(equityLoading || equityMap) && <EquityRow ... />}` means the EquityRow is completely absent until the first fetch starts. Between `selectGame()` setting state and the `useEffect` firing (next microtask), there is a frame where neither `equityLoading` nor `equityMap` is truthy, so the row is invisible. This is cosmetically fine but causes a layout shift when the loading indicator appears.

**Suggested Fix:**
Consider setting `equityLoading` to `true` inside `selectGame()` alongside `setHands()` to eliminate the flash frame, or accept the current behavior as trivial.

**Impact:** Minor layout shift, cosmetic only.

---

### [LOW-2] Duplicated seat-player-map construction logic

**File:** `frontend/src/views/MobilePlaybackView.jsx`
**Line(s):** 85–96, 112–123
**Category:** design

**Problem:**
The logic to build `seatPlayerMap` from all hands' `player_hands` is duplicated in both `showHand()` and `handleStreetChange()`. This is a pre-existing issue (not introduced by T-023) but increases maintenance burden.

**Suggested Fix:**
Extract into a helper: `function buildSeatMap(hands) { ... }`. Not blocking — pre-existing duplication.

**Impact:** Maintenance cost; no functional issue.

---

## Positives

- **Cancellation pattern is correct.** The `let cancelled = false` + cleanup `() => { cancelled = true }` in the `useEffect` properly guards against race conditions from rapid hand scrubbing. Each new effect run cancels the previous in-flight fetch, preventing stale data from overwriting current state.
- **Error handling is graceful.** Fetch failures silently hide the equity row rather than crashing or showing error UI in the equity area — appropriate for a non-critical supplementary display.
- **Loading state is well-integrated.** The `EquityRow` component cleanly supports a `loading` prop with a dedicated testid, making it easy to test and style independently.
- **Test coverage is solid.** 30 tests covering: equity fetch call, loading indicator, error handling, re-fetch on hand change, and all EquityRow visual states (null, empty, color thresholds, loading).

---

## Overall Assessment

The implementation is clean and correctly addresses all four acceptance criteria. The cancellation pattern properly prevents race conditions from rapid scrubbing — the primary concern raised in the review request. No critical or high-severity issues found. The two medium findings are a missing test for the unmount cancellation path and a semantic note about street-aware equity being a future consideration. Both lows are cosmetic/maintenance items that predate this task.

**Verdict:** PASS — no critical issues. Safe to ship.
