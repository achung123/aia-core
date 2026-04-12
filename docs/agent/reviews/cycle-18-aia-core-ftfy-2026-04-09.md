# Code Review Report — dealer-viz-004

**Date:** 2026-04-09
**Cycle:** 18
**Target:** `frontend/src/dealer/DealerApp.jsx`, `frontend/src/dealer/DealerApp.test.jsx`
**Reviewer:** Scott (automated)

**Task:** T-015 — Community card capture PATCH wiring
**Beads ID:** aia-core-ftfy

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
| 1 | Tapping Table tile opens camera for 3-5 cards | SATISFIED | `DealerApp.test.jsx` — "tapping Table tile opens camera capture for community cards" | `captureTarget` set to `'community'`, CameraCapture rendered |
| 2 | After confirm, community cards PATCHed | SATISFIED | `DealerApp.test.jsx` — "after confirm, updateCommunityCards is called with correct payload" | Payload shape `{flop_1, flop_2, flop_3, turn, river}` matches backend `CommunityCardsUpdate` |
| 3 | Table tile shows checkmark | SATISFIED | `DealerApp.test.jsx` — "Table tile shows checkmark after successful PATCH" | ✅ only rendered after `SET_COMMUNITY_CARDS` dispatch, which only fires on success |
| 4 | PATCH validates no duplicate cards with player cards | SATISFIED | Backend `edit_community_cards` in `src/app/routes/hands.py:177` builds full card set and validates | Frontend tests: "shows error toast on community PATCH failure" and "does not update community state on PATCH failure" confirm error propagation |

---

## Findings

### [MEDIUM] Review data cleared before async PATCH completes

**File:** `frontend/src/dealer/DealerApp.jsx`
**Line(s):** 76
**Category:** design

**Problem:**
`setReviewData(null)` is called before `await updateCommunityCards(...)`. If the PATCH fails, the user cannot return to the detection review — they must start a new capture. This is consistent with the player-card branch (same pattern), but means detection results are lost on failure.

**Code:**
```jsx
setReviewData(null);
try {
  await updateCommunityCards(state.gameId, state.currentHandId, communityPayload);
  dispatch({ type: 'SET_COMMUNITY_CARDS', payload: { ... } });
```

**Suggested Fix:**
Move `setReviewData(null)` inside the `try` block after the successful PATCH, or accept this as intentional (retake-on-failure pattern). No change required if the UX design is retake-only.

**Impact:** User experience on PATCH failure — detection results are discarded, requiring a re-capture instead of a retry. Low severity in practice since the error toast guides the user.

---

### [LOW] Inconsistent null-coercion for required flop fields

**File:** `frontend/src/dealer/DealerApp.jsx`
**Line(s):** 69-73
**Category:** correctness

**Problem:**
The community payload uses `cardValues[0] || null` for all five fields. For `flop_1`, `flop_2`, and `flop_3`, the backend schema `CommunityCardsUpdate` declares these as required `Card` (no `None` default). Sending `null` for any flop field would result in a 422 validation error. This is technically safe because the capture flow ensures 3+ cards, but the `|| null` coercion masks the implicit contract.

**Code:**
```jsx
const communityPayload = {
  flop_1: cardValues[0] || null,
  flop_2: cardValues[1] || null,
  flop_3: cardValues[2] || null,
  turn: cardValues[3] || null,
  river: cardValues[4] || null,
};
```

**Suggested Fix:**
No immediate action needed — the camera capture and detection review enforce >= 3 cards for community mode. This is a documentation-level concern. If defensive coding is desired, assert `cardValues.length >= 3` before building the payload.

**Impact:** Negligible — the upstream flow prevents this state. Noted for future maintainability.

---

## Positives

- **PATCH-before-dispatch pattern**: `updateCommunityCards` is awaited before `SET_COMMUNITY_CARDS` dispatch, ensuring UI state only updates on backend success. Error path correctly skips the dispatch.
- **Error toast reuse**: Community PATCH errors surface via the same `patchError` toast used for player card errors — consistent UX.
- **Payload shape matches backend**: `{flop_1, flop_2, flop_3, turn, river}` aligns exactly with `CommunityCardsUpdate` Pydantic model.
- **Comprehensive test coverage**: All 5 new tests cover the happy path (PATCH call, ✅ rendering), error path (toast shown, state not updated), and entry point (Table tile → camera). Mocks are correctly wired.
- **Memory leak prevention**: `URL.revokeObjectURL` is called at the top of `handleReviewConfirm` before any async work.

---

## Overall Assessment

Clean implementation. The community card PATCH wiring follows the same proven pattern as the player card flow — PATCH first, dispatch on success, toast on failure. All four acceptance criteria are satisfied with direct test evidence. No critical or high-severity findings. The two minor findings (review data cleared before async, null-coercion on required fields) are consistent with existing patterns and pose no functional risk. Ready to proceed to T-016.
