# Code Review Report — alpha-feedback-008

**Date:** 2026-04-12
**Cycle:** 30
**Target:** `frontend/src/pages/TableView.tsx`, `frontend/src/pages/TableView.test.tsx`, `frontend/src/components/SessionScrubber.tsx`
**Reviewer:** Scott (automated)

**Task:** T-035 — Player game scrubber (range slider)
**Beads ID:** aia-core-b32p

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
| 1 | Range slider with min=1, max=total hands | SATISFIED | `SessionScrubber.tsx` L101-L104: `min={1} max={handCount}`; test assertion `slider.min === '1'`, `slider.max === '3'` | |
| 2 | Dragging loads selected hand and updates 3D scene | SATISFIED | `TableView.tsx` L296-L300: `handleScrubberChange` calls `updateSceneForHand`; test "changing the scrubber updates the 3D scene with selected hand" verifies `mockSceneUpdate` called with correct card data | |
| 3 | Label shows Hand X / Y | SATISFIED | `SessionScrubber.tsx` L111: `Hand {currentHand} / {handCount}`; test asserts `'Hand 3 / 3'` and regex `/^Hand \d+ \/ \d+$/` | |
| 4 | Defaults to latest hand | SATISFIED | `TableView.tsx` L322-L323: sorts ascending, picks `sorted[sorted.length - 1]`; test "scrubber defaults to the latest hand number" checks label is `'Hand 3 / 3'` | |
| 5 | Touch-friendly: min 48px slider thumb | SATISFIED | `SessionScrubber.tsx` L49-L64: CSS sets `width: 48px; height: 48px` on both `-webkit-slider-thumb` and `-moz-range-thumb`; test checks `styleTag.textContent.includes('48px')` | |

---

## Findings

### [MEDIUM] Hand number / slider index conflation

**File:** `frontend/src/pages/TableView.tsx`
**Line(s):** 296-300, 315-323
**Category:** correctness

**Problem:**
The `SessionScrubber` receives `handCount={hands.length}` as `max` and `currentHand={currentHandNumber}` as `value`, making the slider range `[1, hands.length]`. However, `currentHandNumber` is set to the actual `hand_number` field from the API (line 323), and `handleScrubberChange` looks up hands via `hands.find(h => h.hand_number === handNumber)` (line 298). This conflates a 1-based positional index with the domain `hand_number`.

If hand numbers are ever non-contiguous (e.g., hand deletion creates gaps like `[2, 5, 8]`), the slider max would be 3 but the default value would be 8 (out of range), and scrubbing to position 1 would look for `hand_number === 1` which doesn't exist — silently failing to update the scene.

**Code:**
```tsx
// Line 322-323 — value comes from domain hand_number
const latest = sorted[sorted.length - 1];
setCurrentHandNumber(latest.hand_number);

// Line 298 — lookup assumes slider value == hand_number
const hand = hands.find(h => h.hand_number === handNumber);
```

**Suggested Fix:**
Map slider position (1-based array index) to actual `hand_number` via the sorted array, e.g., `hands[sliderValue - 1]`. Or pass an array of hand numbers to the scrubber and let it use actual values as min/max.

**Impact:** Not a runtime bug today — hand numbers are sequential from 1 within a game. Becomes a silent failure if hand deletion or non-1-based numbering is introduced.

---

### [LOW] Silent no-op when hand not found during scrub

**File:** `frontend/src/pages/TableView.tsx`
**Line(s):** 297-300
**Category:** correctness

**Problem:**
`handleScrubberChange` silently does nothing when `hands.find()` returns `undefined`. Combined with the hand-number conflation above, this means a scrub to a non-existent hand number updates the state (`setCurrentHandNumber`) but skips the scene update — leaving the UI label and 3D scene out of sync.

**Code:**
```tsx
const hand = hands.find(h => h.hand_number === handNumber);
if (hand) {
  updateSceneForHand(hand);
}
```

**Suggested Fix:**
Add a `console.warn` in the else branch, or use index-based lookup to make the failure impossible.

**Impact:** Cosmetic — label and scene could diverge, but only under the non-contiguous hand number scenario.

---

## Positives

- **Sorting is correct**: ascending sort by `hand_number` with last-element default-to-latest is clean and unambiguous.
- **Scene update on scrub is well-wired**: the `handleScrubberChange` → `updateSceneForHand` chain correctly rebuilds `cardData` and `streetIndex` for the selected hand.
- **Test coverage is thorough**: 8 scrubber-specific tests cover all 5 ACs directly — slider range, default value, label format, scene update on change, empty-state guard, and touch-friendly styling.
- **SessionScrubber component is well-isolated**: purely presentational, no side effects, easy to test independently.
- **AbortController on fetch**: properly cancels in-flight requests when the component unmounts or deps change.

---

## Overall Assessment

All 5 acceptance criteria are **SATISFIED**. The implementation is clean and the test suite covers every AC with targeted assertions. Two minor findings (MEDIUM + LOW) flag a latent fragility around hand-number/index conflation that is harmless today but could surface if hand numbering becomes non-contiguous. No CRITICAL or HIGH issues — ship-ready.
