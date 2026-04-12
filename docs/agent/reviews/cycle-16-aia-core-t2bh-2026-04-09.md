# Code Review Report — dealer-viz-004

**Date:** 2026-04-09
**Target:** `frontend/src/api/client.js`, `frontend/src/dealer/DealerApp.jsx`, `frontend/src/dealer/DealerApp.test.jsx`
**Reviewer:** Scott (automated)
**Cycle:** 16

**Task:** T-013 — Per-player card collection flow
**Beads ID:** aia-core-t2bh

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
| 1 | Tapping a "playing" tile opens camera capture | SATISFIED | `DealerApp.test.jsx` "tapping a playing tile opens camera capture"; `DealerApp.jsx` L34-37 `handleTileSelect` sets `captureTarget`, which renders `CameraCapture` at L170 | — |
| 2 | After detection review + confirm, hole cards are PATCHed to the backend | SATISFIED | `DealerApp.test.jsx` "after confirm, addPlayerToHand is called for unrecorded player"; `DealerApp.jsx` L79-86 calls `addPlayerToHand` (new) or `updateHolecards` (retake) | — |
| 3 | Player state updates with card1, card2, and recorded: true | SATISFIED | `DealerApp.test.jsx` "player tile shows recorded after successful PATCH"; `DealerApp.jsx` L88-91 dispatches `SET_PLAYER_CARDS`; `dealerState.js` L36-40 sets `recorded: true` | State is only updated after successful PATCH — correct |
| 4 | Tapping a tile that already has cards opens review for re-capture (retake flow) | SATISFIED | `DealerApp.test.jsx` "tapping a recorded tile opens camera for retake" + "retake calls updateHolecards instead of addPlayerToHand" | — |
| 5 | Error handling shows toast on PATCH failure | SATISFIED | `DealerApp.test.jsx` "shows error toast on PATCH failure" + "does not update player state on PATCH failure"; `DealerApp.jsx` L93-95 `catch` sets `patchError`, rendered as toast at L165-167 | — |

---

## Findings

### [HIGH] handleSubmitHand creates a duplicate hand via createHand

**File:** `frontend/src/dealer/DealerApp.jsx`
**Line(s):** 112-127
**Category:** correctness

**Problem:**
`handleSubmitHand()` calls `createHand(state.gameId, payload)` with the assembled batch payload. However, `handleStartHand()` (L24-30) already calls `createHand(state.gameId, {})` to create an empty hand before per-player PATCH begins. If the user flow reaches `handleSubmitHand`, a **second** hand will be created on the backend with the full payload, duplicating the hand. This is the legacy batch-submit path that has not been updated for the incremental flow introduced by T-013.

**Code:**
```jsx
async function handleSubmitHand() {
    setSubmitError(null);
    const payload = assembleHandPayload(state);
    // ...
    await createHand(state.gameId, payload);   // Creates a SECOND hand
    dispatch({ type: 'RESET_HAND' });
}
```

**Suggested Fix:**
Either (a) remove `handleSubmitHand` and the "Submit Hand" button entirely (T-016 "Hand completion" will replace it with "Finish Hand"), or (b) change `handleSubmitHand` to call a finalization endpoint instead of `createHand`. Since T-016 is pending, the safest immediate fix is to guard the button or leave a TODO, but this should be addressed before the flow is user-facing.

**Impact:** If a user taps "Submit Hand" after individually PATCHing cards, the backend will contain a duplicate hand with the same data.

---

### [MEDIUM] Object URL memory leak on unmount

**File:** `frontend/src/dealer/DealerApp.jsx`
**Line(s):** 40, 56, 105
**Category:** design

**Problem:**
`URL.createObjectURL(file)` is called in `handleDetectionResult` (L40) and stored in `reviewData.imageUrl`. Revocation happens in `handleReviewConfirm` (L56) and `handleReviewRetake` (L105). However, if the component unmounts while `reviewData` holds an active object URL (e.g., user navigates away), the blob URL is never revoked, causing a memory leak. There is no `useEffect` cleanup.

**Suggested Fix:**
Add a cleanup effect:
```jsx
useEffect(() => {
  return () => {
    if (reviewData?.imageUrl) URL.revokeObjectURL(reviewData.imageUrl);
  };
}, [reviewData]);
```

**Impact:** Minor memory leak in edge cases; not user-visible but accumulates over long sessions.

---

### [MEDIUM] patchError toast not cleared on successful subsequent PATCH

**File:** `frontend/src/dealer/DealerApp.jsx`
**Line(s):** 35, 92
**Category:** correctness

**Problem:**
`patchError` is cleared when a tile is tapped (`handleTileSelect`, L35) and on a successful PATCH (L92). However, if the error toast is showing and the user completes a successful capture for a *different* player without explicitly tapping a tile first (e.g., if the UI flow bypasses `handleTileSelect`), the stale error toast could persist. In the current flow this is mitigated because tapping a tile always goes through `handleTileSelect`, but the coupling is implicit.

**Suggested Fix:**
Also clear `patchError` at the start of `handleReviewConfirm` to make the clearing explicit regardless of how the flow is entered.

**Impact:** Low risk in current flow; defensive improvement for future refactors.

---

### [LOW] Toast positioning relies on inline style object recreated each render

**File:** `frontend/src/dealer/DealerApp.jsx`
**Line(s):** 192-203
**Category:** convention

**Problem:**
`toastStyle` is defined as a module-level constant, which is correct. However, this style object uses `position: 'fixed'` with `left: '50%'` and `transform: 'translateX(-50%)'` without accounting for safe-area insets on mobile devices. The toast may be obscured by the bottom navigation bar on some phones.

**Suggested Fix:**
Add `bottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))'` for better mobile compatibility. Low priority.

**Impact:** Cosmetic — toast might be partially hidden on some mobile devices.

---

### [LOW] Test uses concrete hand_number value without asserting createHand response shape

**File:** `frontend/src/dealer/DealerApp.test.jsx`
**Line(s):** 94
**Category:** design

**Problem:**
`createHand.mockResolvedValue({ hand_number: 1 })` sets the mock return. The tests then assert `addPlayerToHand` is called with `(42, 1, ...)`. This couples the test to the mock's hardcoded value. If the response shape from the backend changes (e.g., `handNumber` instead of `hand_number`), the test would still pass (the mock bypasses the real mapping). This is acceptable for integration-level mocking but worth noting.

**Suggested Fix:**
No action needed now — this is standard mock practice. If a mapping layer is introduced between API response and state, add a unit test for the mapping.

**Impact:** None currently.

---

## Positives

- **Backend-first state update pattern:** `SET_PLAYER_CARDS` dispatch is only called after a successful PATCH response, preventing UI/backend state divergence. This is the correct optimistic-vs-pessimistic choice for a recording app.
- **Retake flow is clean:** The `isRetake` boolean derived from `player.recorded` correctly routes to `updateHolecards` (PATCH existing) vs `addPlayerToHand` (POST new). The backend endpoints match this contract.
- **URL encoding in client.js:** `encodeURIComponent(playerName)` is correctly applied in the `updateHolecards` path parameter, preventing URL injection.
- **XSS safety:** All user-controlled strings (`targetName`, `patchError`, card values) are rendered via Preact's JSX `{}` interpolation, which auto-escapes. No `dangerouslySetInnerHTML` usage. Error messages from the backend are text-only (the `request()` wrapper reads `response.text()`). No XSS vectors found.
- **Test coverage is thorough:** 9 tests cover the full happy path (create hand → capture → PATCH → state update), retake flow, error toast display, and state non-mutation on failure. Good negative testing.
- **`addPlayerToHand` client function** is clean — JSON body with `player_name` avoids path encoding issues.

---

## Overall Assessment

The per-player card collection flow is **well-implemented and well-tested**. All 5 acceptance criteria are SATISFIED with corresponding test evidence. The code is clean, follows existing patterns, and has no security vulnerabilities.

The one **HIGH** finding — `handleSubmitHand` creating a duplicate hand — is a pre-existing concern from the legacy batch flow that is now incompatible with the new incremental approach. It does not block this task (T-013) since T-016 (Hand completion & elimination logic) is expected to rework the submit/finish flow. However, it should be addressed or guarded before end-to-end testing.

No CRITICAL findings. Code is ready for the next task in the dependency chain (T-014: Outcome buttons).
