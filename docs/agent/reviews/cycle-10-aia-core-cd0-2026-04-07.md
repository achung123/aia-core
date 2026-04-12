# Code Review Report — dealer-interface-003

**Date:** 2026-04-07
**Cycle:** 10
**Epic:** dealer-interface-003 (aia-core-8w0)
**Target:** `frontend/src/dealer/DetectionReview.jsx`, `frontend/src/dealer/DealerApp.jsx`, `frontend/src/dealer/CameraCapture.jsx`
**Reviewer:** Scott (automated)

**Task:** T-011 — Build Detection Review display
**Beads ID:** aia-core-cd0

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
| 1 | The uploaded photo is displayed for reference | SATISFIED | DetectionReview.jsx L28 — `<img src={imageUrl}>` renders blob URL; DealerApp.jsx L31 creates it via `URL.createObjectURL(file)` | Blob URL cleanup handled on confirm (L47) and retake (L65) |
| 2 | Detected cards are shown with rank, suit symbol, and confidence percentage | SATISFIED | DetectionReview.jsx L36–42 — `formatCard()` extracts rank/suit symbol from `detected_value`, confidence shown as `Math.round(d.confidence * 100)` percentage | Suit map covers h/s/d/c → ♥♠♦♣ |
| 3 | Card count matches the expected mode (2 for player, 3–5 for community) | PARTIAL | DetectionReview.jsx L14–16 — `expectedMin`/`expectedMax` computed correctly; warning shown L30–33 when count is wrong | Warning is displayed but Confirm is **not disabled** on wrong count — user can submit mismatched card counts. See finding M-001 |
| 4 | "Confirm" dispatches cards to state and navigates back to Player Grid | SATISFIED | DetectionReview.jsx L19–21 calls `onConfirm(targetName, cardValues)`; DealerApp.jsx L46–67 dispatches `SET_PLAYER_CARDS` or `SET_COMMUNITY_CARDS` then sets step to `playerGrid` | Reducer in dealerState.js handles both action types correctly |

---

## Findings

### [MEDIUM] M-001 — Confirm button not disabled on card count mismatch

**File:** `frontend/src/dealer/DetectionReview.jsx`
**Line(s):** 47–51
**Category:** correctness

**Problem:**
The `countOk` variable is computed (L16) and used to display a warning (L30–33), but the Confirm button is only disabled when `cards.length === 0` (L51). A dealer can confirm with 1 card for a player (expects 2) or 6+ cards for community (expects 3–5). The `countOk` variable is never used to gate the button.

**Code:**
```jsx
<button
  style={cards.length === 0 ? { ...styles.confirmButton, opacity: 0.5 } : styles.confirmButton}
  onClick={handleConfirm}
  disabled={cards.length === 0}
>
```

**Suggested Fix:**
Disable the Confirm button when `!countOk` instead of `cards.length === 0`, or at minimum make the visual opacity change reflect the count validation:
```jsx
disabled={!countOk}
```
If intentionally allowing override (e.g., the model detected an extra card but the dealer knows it's fine), document this as a design decision and consider a secondary "Confirm Anyway" interaction.

**Impact:** Dealers can submit hands with wrong card counts, which may produce invalid hand records downstream.

---

### [MEDIUM] M-002 — Blob URL leak on component unmount during review step

**File:** `frontend/src/dealer/DealerApp.jsx`
**Line(s):** 31, 47, 65
**Category:** design

**Problem:**
The blob URL created via `URL.createObjectURL(file)` in `handleDetectionResult` (L31) is correctly revoked in both `handleReviewConfirm` (L47) and `handleReviewRetake` (L65). However, if the user navigates away from the Dealer route (e.g., clicks "Playback" or "Data" in the nav) while `reviewData` holds a blob URL, it is never revoked. This is a minor memory leak — one blob URL per abandoned review.

**Suggested Fix:**
Add a cleanup effect in `DealerApp` that revokes the blob URL on unmount:
```jsx
useEffect(() => {
  return () => {
    if (reviewData?.imageUrl) URL.revokeObjectURL(reviewData.imageUrl);
  };
}, [reviewData]);
```
Or use `useEffect` with a cleanup return that revokes on component teardown.

**Impact:** Minor memory leak. Single blob URL per occurrence, cleaned up on page unload. Low practical impact but worth addressing for correctness.

---

### [LOW] L-001 — `formatCard` does not handle malformed `detected_value`

**File:** `frontend/src/dealer/DetectionReview.jsx`
**Line(s):** 4–8
**Category:** correctness

**Problem:**
If `detected_value` is an empty string or `undefined`, `slice(-1)` and `slice(0, -1)` produce empty strings. The card renders as an empty span with no visual content. While this won't crash, it produces a confusing empty card tile.

**Code:**
```jsx
function formatCard(detectedValue) {
  const suit = detectedValue.slice(-1).toLowerCase();
  const rank = detectedValue.slice(0, -1).toUpperCase();
  const symbol = SUIT_MAP[suit] || suit;
  return { rank, suit: symbol };
}
```

**Suggested Fix:**
Add a guard or fallback:
```jsx
function formatCard(detectedValue) {
  if (!detectedValue || detectedValue.length < 2) return { rank: '?', suit: '?' };
  // ...existing logic
}
```

**Impact:** Poor UX on malformed detection data; no crash or security issue.

---

### [LOW] L-002 — Array index used as React key

**File:** `frontend/src/dealer/DetectionReview.jsx`
**Line(s):** 37
**Category:** convention

**Problem:**
`key={i}` uses the array index as the key for card elements. Since the detection list is display-only and never reordered or filtered in this component, this is acceptable. However, if card correction (T-012) allows removing/replacing cards in this same list, index keys would cause incorrect reconciliation.

**Suggested Fix:**
Use `d.detected_value` or a composite key like `${d.detected_value}-${i}` for safer key stability when T-012 lands.

**Impact:** No current issue; preventive note for T-012 integration.

---

## Positives

- **Clean blob URL lifecycle**: Both exit paths (confirm and retake) properly revoke the blob URL, avoiding the most common memory leak pattern with `createObjectURL`.
- **Clear separation of concerns**: `DetectionReview` is a pure presentational component — it receives data via props and delegates actions via callbacks. No API calls or side effects.
- **Correct reducer integration**: `handleReviewConfirm` correctly maps card values into the right shape for both `SET_PLAYER_CARDS` and `SET_COMMUNITY_CARDS`, with `|| null` handling for missing positions.
- **Retake flow preserves context**: `handleReviewRetake` captures the target name before clearing review data, then re-opens the camera for the same target. Smooth UX.
- **Consistent styling**: Inline style objects match the pattern established by other dealer components (`PlayerGrid`, `CameraCapture`, `GameCreateForm`).
- **Security**: No XSS risk — all dynamic content is rendered via JSX text nodes (auto-escaped by Preact). Blob URLs are same-origin and cannot execute scripts.

---

## Overall Assessment

The implementation satisfies all four acceptance criteria (AC-3 is partial due to the non-enforced card count validation). The code is clean, well-structured, and consistent with existing dealer components. No CRITICAL or HIGH findings.

The two MEDIUM findings are:
1. **M-001** should be addressed before T-012 (Card Correction) or T-013 (Hand Submission), since invalid card counts flowing into hand submission could produce bad data.
2. **M-002** is a minor edge case that can be addressed in a follow-up.

**Recommendation:** Fix M-001 (disable Confirm on bad count) before the next cycle that builds on this component.
