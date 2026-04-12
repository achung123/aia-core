# Code Review Report — alpha-feedback-008

**Date:** 2026-04-12
**Target:** `ActiveHandDashboard` composite component + store + type changes
**Reviewer:** Scott (automated)

**Task:** T-021 — Active Hand Dashboard (tiles + board + blind bar)
**Beads ID:** aia-core-wgq4

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 3 |
| LOW | 4 |
| **Total Findings** | **7** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | Player tiles show name, participation status, and last action | SATISFIED | `ActiveHandDashboard.test.tsx` — "renders player tiles with name and status" | Verifies all 4 players including outcomeStreet display |
| 2 | Tile colors use the existing `statusColors` mapping | SATISFIED | `ActiveHandDashboard.test.tsx` — "sets tile background color based on player status" | Checks playing, folded, won, joined colors |
| 3 | Board area shows 5 slots filled as captured | SATISFIED | `ActiveHandDashboard.test.tsx` — 3 tests: empty, flop, and full board | Verifies all 5 slots across 3 states |
| 4 | Blind info bar shows current level and SB/BB player names | SATISFIED | `ActiveHandDashboard.test.tsx` — "fetches and displays blind levels" + "renders blind info bar with SB/BB player names" + null edge case | Also verifies graceful degradation when SB/BB names are null |
| 5 | Take Flop / Turn / River buttons shown (wired in T-022) | SATISFIED | `ActiveHandDashboard.test.tsx` — renders street buttons + disable/enable logic | Turn disabled until flop recorded; river disabled until turn recorded |
| 6 | Showdown button shown (wired in T-024) | SATISFIED | `ActiveHandDashboard.test.tsx` — "renders Showdown button" | Button renders; `onShowdown` not wired (expected per AC) |
| 7 | Polling via `fetchHandStatus()` every 3 seconds | SATISFIED | `DealerApp.test.tsx` — 8 polling tests: start, interval, status mapping, stop on nav, stop on unmount, error resilience, recovery, stale data guard | Comprehensive polling coverage |
| 8 | Component test verifies tile rendering and status display | SATISFIED | `ActiveHandDashboard.test.tsx` — 17 tests | Covers all sub-ACs including callbacks |

---

## Findings

### [MEDIUM] Stale closure on `players` in polling useEffect

**File:** `frontend/src/dealer/DealerApp.tsx`
**Line(s):** 57–88
**Category:** correctness

**Problem:**
The polling `useEffect` captures `players` from its closure but does not include it in the dependency array `[currentStep, gameId, currentHandId]`. The `poll()` function uses `players` to check `needsCards` and to guard `setPlayerCards`, but this reference is stale — it reflects the player state from when the effect was set up, not the current state.

**Code:**
```tsx
const needsCards = joinedPlayers.some((jp) => {
  const local = players.find((lp) => lp.name === jp.name);
  return local && !local.card1 && !local.card2;
});
```

**Suggested Fix:**
Read `players` from `useDealerStore.getState().players` inside the `poll()` callback instead of closing over the reactive variable. This gives access to the latest state without adding `players` to the dep array (which would restart the interval on every player change).

**Impact:** Could cause unnecessary `fetchHand` calls and redundant `setPlayerCards` updates. Not user-visible due to idempotent state writes, but inefficient and a potential source of subtle bugs as the feature grows.

---

### [MEDIUM] `onShowdown` callback prop not wired in DealerApp

**File:** `frontend/src/dealer/DealerApp.tsx`
**Line(s):** 356–365
**Category:** design

**Problem:**
`ActiveHandDashboard` accepts an optional `onShowdown` prop, and the Showdown button calls `onShowdown?.()`. However, `DealerApp` never passes `onShowdown` to the component. The button renders but is inert — a user tapping it gets zero feedback.

**Code:**
```tsx
<ActiveHandDashboard
  gameId={gameId}
  ...
  // onShowdown not passed
/>
```

**Suggested Fix:**
This is expected per AC6 ("wired in T-024"). Consider adding a visual indicator (grayed out or "Coming soon" tooltip) so users don't think the button is broken. Alternatively, pass a no-op handler that shows a toast "Showdown not yet available."

**Impact:** User confusion — tapping a styled button with no result. Low risk since the AC explicitly defers wiring.

---

### [MEDIUM] Mock path inconsistency in GameSelectorIntegration.test.tsx

**File:** `frontend/src/dealer/GameSelectorIntegration.test.tsx`
**Line(s):** 5
**Category:** convention

**Problem:**
The `vi.mock()` call uses `'../api/client.js'` while all other test files and actual imports use `'../api/client.ts'`. Vitest resolves both to the same module currently, but this inconsistency could break under different module resolution settings.

**Code:**
```ts
vi.mock('../api/client.js', () => ({
```

**Suggested Fix:**
Change to `vi.mock('../api/client.ts', () => ({` to match the import path convention used everywhere else.

**Impact:** Fragile test setup — could break on Vitest configuration changes or version upgrades.

---

### [LOW] Missing `idle` status in `statusColors` map

**File:** `frontend/src/dealer/ActiveHandDashboard.tsx`
**Line(s):** 4–12
**Category:** correctness

**Problem:**
`statusColors` does not include an `idle` entry. When a player has `status: 'idle'` (common from polling), the lookup returns `undefined` and the fallback `|| '#ffffff'` in the template provides white — which happens to match the `playing` color. The `formatStatus()` function maps `idle → 'playing'`. This works but is implicit.

**Suggested Fix:**
Add `idle: '#ffffff'` to the `statusColors` map for explicitness.

**Impact:** Cosmetic — no visible bug today, but future color changes to `playing` would silently miss `idle`.

---

### [LOW] No AbortController cleanup for blind fetch

**File:** `frontend/src/dealer/ActiveHandDashboard.tsx`
**Line(s):** 55–58
**Category:** correctness

**Problem:**
The `useEffect` that calls `fetchBlinds(gameId)` has no cleanup function. If the component unmounts before the promise resolves, `setBlinds()` is called on an unmounted component. React 18 silently ignores this, so no crash occurs, but it's a pattern violation.

**Code:**
```tsx
useEffect(() => {
  fetchBlinds(gameId)
    .then((data) => setBlinds({ ... }))
    .catch(() => { /* ignore */ });
}, [gameId]);
```

**Suggested Fix:**
Add an AbortController or a boolean `mounted` ref that gates the `setBlinds` call.

**Impact:** No user-visible issue in React 18. Could produce warnings in React strict mode or future React versions.

---

### [LOW] `newHand`/`finishHand` don't reset `sbPlayerName`/`bbPlayerName`

**File:** `frontend/src/stores/dealerStore.ts`
**Line(s):** 161–173
**Category:** design

**Problem:**
When `newHand()` or `finishHand()` runs, the store resets `currentHandId`, `players`, `community`, and `currentStep` — but not `sbPlayerName` or `bbPlayerName`. These stale values persist until the next `loadHand()` call.

**Suggested Fix:**
Add `sbPlayerName: null, bbPlayerName: null` to the `newHand` and `finishHand` state resets.

**Impact:** Not user-visible because the step transitions to `dashboard` and `loadHand()` sets new values before reaching `activeHand` again. However, stale state could cause confusion in debugging or future features that read these fields outside the `activeHand` step.

---

### [LOW] Unit tests don't cover `onDirectOutcome`/`onMarkNotPlaying` callbacks

**File:** `frontend/src/dealer/ActiveHandDashboard.test.tsx`
**Line(s):** (not present)
**Category:** design

**Problem:**
The ActiveHandDashboard unit tests don't verify that the `onDirectOutcome` and `onMarkNotPlaying` callback props fire when the outcome/sit-out buttons are clicked. These flows are covered at the integration level in `DealerApp.test.tsx`, but the component-level test suite misses them.

**Suggested Fix:**
Add 2 tests: one rendering a `handed_back` player and verifying the 📋 outcome button fires `onDirectOutcome`, and one rendering a `playing` player and verifying the "Sit Out" button fires `onMarkNotPlaying`.

**Impact:** Minor — coverage exists at integration level. Unit-level coverage would improve regression safety for component refactors.

---

## Positives

- **Clean separation of concerns**: `ActiveHandDashboard` is a pure presentational component that receives all data via props. Polling, API calls, and state management live in `DealerApp`. This is excellent architecture for testability and reuse.
- **Comprehensive polling tests**: 8 tests in `DealerApp.test.tsx` cover start, interval, cleanup on navigation, cleanup on unmount, error resilience, recovery, status mapping, and stale data guards. This is thorough.
- **Proper AbortController + clearInterval cleanup** in the polling `useEffect` — no memory leak in the polling path.
- **Type alignment**: `HandResponse` in `frontend/src/api/types.ts` matches the backend `HandResponse` Pydantic model exactly, including the new `sb_player_name` and `bb_player_name` fields.
- **Progressive disclosure**: Street buttons are correctly chained (flop → turn → river) with disabled states, preventing out-of-order card capture.
- **`LoadHandPayload`** in the store correctly reads `sb_player_name`/`bb_player_name` from hand data, keeping the store consistent.
- **All 70 tests pass** (17 new ActiveHandDashboard + 53 DealerApp + integration).

---

## Overall Assessment

The implementation fully satisfies all 8 acceptance criteria for T-021. The architecture is clean — `ActiveHandDashboard` as a prop-driven presentational component with all state management in the Zustand store and orchestration in `DealerApp`. No CRITICAL or HIGH findings. The 3 MEDIUM findings (stale closure in polling, inert Showdown button, mock path inconsistency) are low-risk and can be addressed in follow-up tasks. The type additions to `api/types.ts` and the store state shape are consistent with the backend schema. Tests are comprehensive with strong coverage of edge cases, error handling, and polling lifecycle.

**Recommendation:** Ship as-is. File the stale-closure fix and mock-path cleanup as LOW-priority follow-ups.
