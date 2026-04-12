# Code Review Report — alpha-feedback-008

**Date:** 2026-04-12
**Cycle:** 28
**Target:** `frontend/src/api/types.ts`, `frontend/src/dealer/DetectionReview.tsx`, `frontend/src/dealer/DetectionReview.test.tsx`
**Reviewer:** Scott (automated)

**Task:** T-051 — Top-N OCR predictions in detection correction UI
**Beads ID:** aia-core-9c4m

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
| 1 | When dealer taps detected card to correct it, show 3-5 alternatives with confidence % | SATISFIED | `DetectionReview.tsx` L60-66, test "shows alternatives panel when tapping a card that has alternatives" and "renders each alternative with confidence percentage" | Alternatives shown on tap; confidence rendered as `Math.round(alt.confidence * 100)%` |
| 2 | Each alternative is a tappable card face (min 48px) | SATISFIED | `DetectionReview.tsx` L228-232 (`minWidth: '48px'`, `minHeight: '48px'`), test "renders each alternative with confidence percentage and min 48px touch target" | Alt buttons enforce 48px minimum. Test explicitly asserts `minWidth` and `minHeight` on each button. |
| 3 | More/All Cards button expands to full CardPicker | SATISFIED | `DetectionReview.tsx` L77-80 `handleAllCards()`, test "shows 'All Cards' button that opens full CardPicker" | Button transfers index from `altIndex` to `pickerIndex`, closes alternatives, opens CardPicker. |
| 4 | If backend has no confidence scores, fall back to CardPicker directly | SATISFIED | `DetectionReview.tsx` L63-66 (else-branch on `alternatives`), test "falls back to CardPicker directly when card has no alternatives" | When `card.alternatives` is undefined or empty, tapping goes straight to CardPicker. |
| 5 | Alternatives horizontally scrollable on mobile | SATISFIED | `DetectionReview.tsx` styles `altScroll` (`overflowX: 'auto'`, `maxWidth: '100%'`, `flexShrink: 0`), test "alternatives container is horizontally scrollable" | Inner scroll container with `flexShrink: 0` children enables horizontal scroll. |
| 6 | React Testing Library test verifies rendering and fallback | SATISFIED | `DetectionReview.test.tsx` — 6 tests in "top-N alternatives" describe block, 17 total passing | Full coverage of alternatives panel show, alt selection, All Cards fallback, direct CardPicker fallback, scrollability, and touch targets. |

---

## Findings

### [MEDIUM] "All Cards" button does not meet 48px minimum touch target

**File:** `frontend/src/dealer/DetectionReview.tsx`
**Line(s):** 239-247
**Category:** design

**Problem:**
The "All Cards" button in the alternatives panel has `padding: '0.5rem 1rem'` and `fontSize: '0.85rem'` but no `minHeight` or `minWidth` constraint. At default browser font size (16px), the computed height is approximately 30-32px — well below the WCAG 2.5.8 / Apple HIG recommended 44-48px minimum touch target. On mobile devices this button is harder to tap accurately.

**Code:**
```typescript
allCardsButton: {
    padding: '0.5rem 1rem',
    fontSize: '0.85rem',
    fontWeight: '600',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    background: '#fff',
    color: '#4f46e5',
    cursor: 'pointer',
},
```

**Suggested Fix:**
Add `minHeight: '48px'` and `minWidth: '48px'` to `allCardsButton` style, consistent with the alt buttons and main action buttons.

**Impact:** Reduced tap accuracy on mobile for a secondary but important action.

---

### [LOW] Scrollability test asserts on outer wrapper instead of inner scroll container

**File:** `frontend/src/dealer/DetectionReview.test.tsx`
**Line(s):** 268-273
**Category:** correctness

**Problem:**
The test "alternatives container is horizontally scrollable" checks `panel.style.overflowX` on the `alternatives-panel` div (the outer `altPanel` wrapper). The actual horizontal scrolling occurs on the inner `altScroll` div, which has `overflowX: 'auto'`, `maxWidth: '100%'`, and `flexShrink: 0` children. The test passes because both elements coincidentally have `overflowX: auto`, but it validates the wrong element.

**Code:**
```typescript
const panel = screen.getByTestId('alternatives-panel');
expect(panel.style.overflowX).toBe('auto');
```

**Suggested Fix:**
Add a `data-testid="alt-scroll"` to the inner scroll div and assert on that element, or assert on the first child of the panel.

**Impact:** Low — the test passes and the feature works correctly. The assertion is coincidentally correct but targets the wrong DOM node.

---

## Positives

- **Clean type extension**: `CardAlternative` and the optional `alternatives` field on `CardDetectionEntry` are forward-compatible with the backend — no breaking changes, and the fallback logic handles the absent-alternatives case gracefully.
- **State management is correct**: The `altIndex` / `pickerIndex` interplay is well-designed — only one panel shows at a time, and `handleAllCards` correctly transfers the card index from alt-mode to picker-mode.
- **Thorough test coverage**: 6 dedicated tests cover all alternative-related ACs — rendering, selection, fallback, scroll, and touch targets. All 17 tests pass (212ms).
- **Touch targets on alt buttons are explicitly tested**: The test directly inspects `minWidth` / `minHeight` style properties, providing a regression guard.
- **Consistent inline style patterns**: New styles match the existing naming/structure conventions of the component.

---

## Overall Assessment

The implementation cleanly satisfies all 6 acceptance criteria. The alternatives panel, confidence display, selection flow, fallback to CardPicker, and horizontal scrollability all work correctly and are well-tested. Two minor findings (the "All Cards" button touch target and a slightly misaimed test assertion) are non-blocking. No critical or high-severity issues. Ready to ship.
