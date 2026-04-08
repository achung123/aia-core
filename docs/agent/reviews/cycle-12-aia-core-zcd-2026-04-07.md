# Code Review Report — dealer-interface-003

**Date:** 2026-04-07
**Cycle:** 12
**Target:** `frontend/src/dealer/CardPicker.jsx`, `frontend/src/dealer/DetectionReview.jsx`
**Reviewer:** Scott (automated)

**Task:** T-012 — Build Card Correction picker
**Beads ID:** aia-core-zcd
**Epic:** aia-core-8w0 (Dealer Interface — Phase 3)

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
| 1 | Tapping a card label opens the 52-card picker | SATISFIED | `DetectionReview.jsx` L58: `onClick={() => setPickerIndex(i)}` on each card div; L67–70: renders `<CardPicker>` when `pickerIndex !== null` | Clean conditional rendering |
| 2 | Selecting a card replaces the detection in local state | SATISFIED | `DetectionReview.jsx` L28–31: `handlePickerSelect` stores correction in `corrections` state; L25–27: `getCorrectedValue` returns corrected value or original | Corrected values also forwarded via `handleConfirm` at L33–36 |
| 3 | Corrected cards have a distinct visual indicator | SATISFIED | `DetectionReview.jsx` L56: orange border (`borderColor: '#ea580c'`) applied via `isCorrected` check; L60: confidence text replaced with "corrected" label | Two visual cues: border color + text change |
| 4 | The picker dismisses after selection | SATISFIED | `DetectionReview.jsx` L30: `setPickerIndex(null)` called at end of `handlePickerSelect`; `CardPicker.jsx` L13: overlay click also calls `onClose` | Both dismiss paths work |
| 5 | All 52 standard cards are available (A-K × ♠♥♦♣) | SATISFIED | `CardPicker.jsx` L1–5: 4 suits (s, h, d, c); L8: 13 ranks (A, 2–10, J, Q, K); 4 × 13 = 52 buttons rendered in grid | Verified complete deck |

---

## Findings

### [MEDIUM] Card labels use `<div>` instead of `<button>` — not focusable

**File:** `frontend/src/dealer/DetectionReview.jsx`
**Line(s):** 53–62
**Category:** design (accessibility)

**Problem:**
Each detected card is rendered as a `<div>` with an `onClick` handler. Non-semantic elements are not keyboard-focusable and don't announce as interactive to assistive technologies. While this is a mobile-first dealer UI where keyboard use is unlikely, it's still a gap if the app is ever used on desktop or with switch controls.

**Code:**
```jsx
<div key={i} style={labelStyle} onClick={() => setPickerIndex(i)}>
```

**Suggested Fix:**
Replace `<div>` with `<button>` and add `type="button"`. The existing inline styles already handle appearance, so the visual change would be minimal (just reset the default button styles).

```jsx
<button key={i} type="button" style={labelStyle} onClick={() => setPickerIndex(i)}>
```

**Impact:** Low for current mobile-only use case. Would become more relevant if the UI is accessed on desktop.

---

### [MEDIUM] No duplicate card prevention across detection slots

**File:** `frontend/src/dealer/DetectionReview.jsx`
**Line(s):** 28–31
**Category:** design

**Problem:**
The picker allows selecting any of the 52 cards regardless of what's already selected for other detection slots. This means a user could correct two different detections to the same card (e.g., two Ace of Spades), producing an invalid poker hand that the backend would need to catch.

**Code:**
```jsx
function handlePickerSelect(cardCode) {
  setCorrections((prev) => ({ ...prev, [pickerIndex]: cardCode }));
  setPickerIndex(null);
}
```

**Suggested Fix:**
Compute the set of already-used card codes and either disable or visually grey out those cards in `CardPicker`. This would require passing a `disabledCards` prop to `CardPicker`.

**Impact:** Medium — invalid hands could be submitted. The backend may reject them, but front-end validation would improve UX. Consider as a follow-up task.

---

### [LOW] No Escape key to dismiss the picker modal

**File:** `frontend/src/dealer/CardPicker.jsx`
**Line(s):** 10–36
**Category:** design (UX)

**Problem:**
The picker modal can be dismissed by clicking the overlay background but not by pressing the Escape key. This is a standard expectation for modal/overlay components.

**Suggested Fix:**
Add a `useEffect` in `CardPicker` that listens for `keydown` events and calls `onClose()` on Escape. Low priority given the mobile-first context.

**Impact:** Minimal for mobile. Nice-to-have for desktop usage.

---

### [LOW] Correcting a card back to the original value still shows "corrected" indicator

**File:** `frontend/src/dealer/DetectionReview.jsx`
**Line(s):** 55–56
**Category:** correctness (minor UX)

**Problem:**
The `isCorrected` check uses `i in corrections`, so if a user opens the picker and selects the same card as the original detection, the card still displays with an orange border and "corrected" label even though the effective value hasn't changed.

**Code:**
```jsx
const isCorrected = i in corrections;
```

**Suggested Fix:**
Compare the correction value to the original detection value:
```jsx
const isCorrected = corrections[i] != null && corrections[i] !== cards[i]?.detected_value;
```

**Impact:** Cosmetic only — the confirmed payload is still correct.

---

## Positives

- **Complete 52-card grid** — All 4 suits × 13 ranks rendered correctly with appropriate color coding (red for hearts/diamonds, dark for spades/clubs)
- **Mobile touch targets** — Card buttons have `minWidth: 44px` and `minHeight: 44px`, meeting the recommended 44px minimum touch target size
- **Clean modal pattern** — Overlay click-to-dismiss correctly uses `e.target === e.currentTarget` to avoid closing when clicking inside the modal
- **Consistent card code format** — `CardPicker` produces codes in the same `rank + suit` format (e.g., `As`, `10h`) that `DetectionReview.formatCard()` can parse
- **State isolation** — Corrections are kept in local component state and only merged into the confirmed payload on explicit confirm, keeping the global state clean
- **Responsive layout** — `maxWidth: 95vw`, `maxHeight: 90vh` with overflow scroll handles small viewports well
- **Clean prop API** — `CardPicker` takes only `onSelect` and `onClose`, making it straightforward to reuse

---

## Overall Assessment

The implementation fully satisfies all 5 acceptance criteria. Both `CardPicker.jsx` and the modifications to `DetectionReview.jsx` are clean, well-structured, and consistent with the existing codebase patterns (inline styles, Preact hooks, functional components). No security issues or critical bugs were found.

The two MEDIUM findings (accessibility of card labels, duplicate card prevention) are design improvements that would be appropriate as follow-up tasks rather than blockers. The two LOW findings are minor UX polish items.

**Verdict:** PASS — no critical or high findings. Clean for commit.
