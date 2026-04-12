# Code Review Report — dealer-viz-004

**Date:** 2026-04-09
**Cycle:** 19
**Target:** T-016 Hand completion & elimination logic + aia-core-yauz fix
**Reviewer:** Scott (automated)

**Task:** T-016 — Hand completion & elimination logic
**Beads ID:** aia-core-bzt1
**Bug Fix:** aia-core-yauz — handleSubmitHand creates duplicate hand in incremental flow

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
| AC-1 | "Finish Hand" button appears when community cards + ≥1 outcome recorded | SATISFIED | `DealerApp.jsx` L196–199 (`canFinish` computed), `DealerApp.test.jsx` "shows Finish Hand button when community cards + at least one outcome recorded" | Correctly requires both conditions via `canFinish` |
| AC-2 | Confirmation dialog lists players that will be marked as eliminated | SATISFIED | `DealerApp.jsx` L275–289 (dialog renders uncaptured list), `DealerApp.test.jsx` "shows confirmation dialog listing uncaptured players" | Lists all `status === 'playing'` players |
| AC-3 | After confirm, eliminated players are POSTed to backend with null cards and null result | SATISFIED | `DealerApp.jsx` L173–180 (`doFinishHand` loop), `DealerApp.test.jsx` "confirming finish POSTs uncaptured players with null cards and null result" | Correctly sends `{ player_name, card_1: null, card_2: null, result: null }` |
| AC-4 | Dealer returns to hand dashboard with incremented hand count | SATISFIED | `DealerApp.jsx` L182 (`FINISH_HAND` dispatch), `dealerState.js` L82–89 (increments `handCount`), `DealerApp.test.jsx` "confirming finish dispatches FINISH_HAND and returns to dashboard with incremented count" | State reset and navigation both verified |
| AC-5 | Community cards are required before finishing (alert if missing) | SATISFIED | `DealerApp.jsx` L161–163 (`handleFinishHand` checks `state.community.recorded`), `DealerApp.test.jsx` "does not show Finish Hand button when outcome recorded but no community cards" | Uses both `alert()` guard and `canFinish` to prevent premature finish |
| AC-yauz | Legacy `handleSubmitHand` removed — no duplicate hand creation | SATISFIED | `DealerApp.jsx` — function absent, `DealerApp.test.jsx` "does not show legacy Submit Hand button" | Verified via grep: no `handleSubmitHand` in dealer components |

---

## Findings

### [HIGH] Sequential POST for uncaptured players has no partial-failure recovery

**File:** `frontend/src/dealer/DealerApp.jsx`
**Line(s):** 173–180
**Category:** correctness

**Problem:**
`doFinishHand` iterates over uncaptured players with a sequential `for...of` loop, calling `addPlayerToHand` for each. If the POST succeeds for the first player but fails for the second, the first player is persisted on the backend but the hand is not finished — leaving the hand in an inconsistent state. The `catch` block sets `finishError` but the dialog remains open, so the user can retry, which would attempt to POST *all* uncaptured players again, causing a duplicate-player error for the already-posted one.

**Code:**
```javascript
async function doFinishHand(uncapturedPlayers) {
    setFinishing(true);
    setFinishError(null);
    try {
      for (const p of uncapturedPlayers) {
        await addPlayerToHand(state.gameId, state.currentHandId, {
          player_name: p.name,
          card_1: null,
          card_2: null,
          result: null,
        });
      }
      dispatch({ type: 'FINISH_HAND' });
```

**Suggested Fix:**
Track which players have been successfully POSTed (e.g., filter out already-posted players on retry), or use `Promise.allSettled` and report partial failures. Alternatively, filter the uncaptured list against already-posted players before each retry attempt.

**Impact:** In games with >1 uncaptured player, a network blip mid-loop leaves the hand half-finished with no clean retry path. In practice with 2-player test fixtures this is rare, but real poker games have 6–10 players.

---

### [MEDIUM] `alert()` called for missing community cards is untestable

**File:** `frontend/src/dealer/DealerApp.jsx`
**Line(s):** 161–163
**Category:** design

**Problem:**
`handleFinishHand` uses `alert()` as a guard when community cards are not recorded. `alert()` is a blocking browser API that cannot be asserted in happy-dom/vitest tests. The test suite verifies the guard indirectly by checking that the Finish Hand button is not rendered when `canFinish` is false — but the `alert()` code path itself is unreachable when the button is hidden, making it dead code under the current UI logic.

**Code:**
```javascript
function handleFinishHand() {
    if (!state.community.recorded) {
      alert('Community cards must be recorded before finishing the hand.');
      return;
    }
```

**Suggested Fix:**
Either (a) remove the `alert()` guard since `canFinish` already prevents the button from appearing, or (b) replace `alert()` with a state-driven error message (e.g., set `finishError`) that can be tested. Keeping both guards is defensive-in-depth but the `alert()` branch is currently dead.

**Impact:** Low functional impact — the UI already prevents the invalid state. This is a code hygiene concern.

---

### [MEDIUM] `canFinish` does not guard against zero-player edge case meaningfully

**File:** `frontend/src/dealer/DealerApp.jsx`
**Line(s):** 196–199
**Category:** correctness

**Problem:**
`canFinish` includes `state.players.length > 0`, which is always true once a game is created (players come from game creation). This guard adds no real protection. However, if state were ever corrupted to have zero players, `state.players.some(...)` would return `false` anyway, making the length check redundant rather than harmful.

**Code:**
```javascript
const canFinish =
    state.community.recorded &&
    state.players.length > 0 &&
    state.players.some((p) => p.status !== 'playing');
```

**Suggested Fix:**
No action needed — this is defensive and not harmful. Noting for awareness.

**Impact:** None — the check is redundant but safe.

---

### [LOW] Confirmation dialog doesn't show player count

**File:** `frontend/src/dealer/DealerApp.jsx`
**Line(s):** 275–289
**Category:** design

**Problem:**
The confirmation dialog says "The following players have not been captured and will be recorded with no cards:" followed by a list, but does not show a count. In a large game, the dealer might not scan the full list. A count header like "(3 players)" would improve UX.

**Suggested Fix:**
Add a count to the dialog text, e.g., `The following ${uncaptured.length} player(s) have not been captured...`

**Impact:** Minor UX improvement, no functional impact.

---

### [LOW] `PlayerGrid` does not have `data-testid` on the Finish Hand button

**File:** `frontend/src/dealer/PlayerGrid.jsx`
**Line(s):** 38–43
**Category:** convention

**Problem:**
All other interactive elements in `PlayerGrid` have `data-testid` attributes (e.g., `table-tile`, `player-tile-*`, `outcome-btn-*`), but the Finish Hand button does not. Tests locate it via `findButton(container, 'Finish Hand')` (text match), which is more fragile than `data-testid` selectors.

**Code:**
```jsx
<button
  style={styles.finishButton}
  onClick={onFinishHand}
>
  Finish Hand
</button>
```

**Suggested Fix:**
Add `data-testid="finish-hand-btn"` for consistency with the rest of the component.

**Impact:** Test robustness only — no functional impact.

---

## Positives

1. **Clean legacy removal** — `handleSubmitHand` and `SUBMIT_HAND` are fully excised from the dealer components. The negative-assertion test ("does not show legacy Submit Hand button") is a smart guard against regression.

2. **Thorough test coverage for finish flow** — 7 new tests cover all key paths: button visibility conditions (3 negative cases + 1 positive), dialog display, cancel, confirm with uncaptured POST, dashboard return with count increment, skip-dialog-when-all-captured, and legacy removal.

3. **Correct elimination POST payload** — `{ player_name, card_1: null, card_2: null, result: null }` matches the backend `addPlayerToHand` schema exactly.

4. **Good state management** — `FINISH_HAND` in reducer properly resets `currentHandId`, player states, community cards, increments `handCount`, and navigates to dashboard. No state leaks.

5. **Proper error handling on finish** — `finishError` is rendered in the dialog, buttons are disabled while `finishing` is true, and the dialog stays open for retry on failure.

6. **`encodeURIComponent` on player names** in API client — prevents injection via player names with special characters.

---

## Overall Assessment

The T-016 implementation and aia-core-yauz fix are solid. All 5 acceptance criteria are satisfied and verified by tests. The legacy `handleSubmitHand` that caused duplicate hand creation is fully removed. The one HIGH finding — partial-failure recovery during multi-player elimination POSTing — is a real edge case that would surface in larger games with unreliable networks, but is not a blocker for the current milestone. All 92 frontend tests pass.

**Recommendation:** Proceed. File a follow-up issue for the partial-failure recovery (HIGH finding) to address before T-024 end-to-end smoke testing.
