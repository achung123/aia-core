# Code Review Report — alpha-feedback-008

**Date:** 2026-04-12
**Cycle:** 17
**Target:** `frontend/src/dealer/ChipPicker.tsx`, `frontend/src/dealer/ChipPicker.test.tsx`
**Reviewer:** Scott (automated)

**Task:** T-029 — Chip picker component
**Beads ID:** aia-core-htof

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 1 |
| MEDIUM | 0 |
| LOW | 1 |
| **Total Findings** | **2** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | Five circular buttons: White ($0.10), Red ($0.20), Green ($0.30), Blue ($0.40), Black ($0.50) | SATISFIED | `ChipPicker.tsx` L16-22 defines CHIPS array; test "renders five chip buttons with correct labels" confirms all five `data-testid` elements | |
| 2 | Each button color-coded and labeled with denomination | SATISFIED | `ChipPicker.tsx` L48-59 applies `bg`/`color` from CHIPS; tests "chips are color-coded" and "displays denomination text" verify | |
| 3 | Tapping adds denomination to running total | SATISFIED | `ChipPicker.tsx` L27 `handleChipTap`; tests "tapping a chip adds", "tapping multiple chips accumulates", "tapping the same chip multiple times" | |
| 4 | Clear resets to $0.00; Confirm triggers onConfirm(amount) callback | SATISFIED | `ChipPicker.tsx` L31 `handleClear`, L35 `handleConfirm`; tests "Clear button resets total" and "Confirm button calls onConfirm with accumulated amount" | |
| 5 | Mobile-first: min 56px diameter buttons | SATISFIED | `ChipPicker.tsx` L101-102 `minWidth: '56px'`, `minHeight: '56px'`; test "chips have min 56px dimensions" verifies | |
| 6 | React Testing Library test verifies tapping, clearing, confirm callback | SATISFIED | `ChipPicker.test.tsx` — 16 tests covering tap, accumulation, clear, confirm, cancel, colors, sizing | |

---

## Findings

### [HIGH] Missing floating-point precision regression test

**File:** `frontend/src/dealer/ChipPicker.test.tsx`
**Line(s):** N/A (missing test)
**Category:** correctness

**Problem:**
The `handleChipTap` function in `ChipPicker.tsx` L28 uses `Math.round((prev + value) * 100) / 100` to defend against IEEE 754 floating-point imprecision. This is the correct fix — but no test would break if the rounding were removed.

The existing confirm test (L82-87) clicks $0.30 + $0.20 and asserts `onConfirm(0.5)`. These values don't trigger floating-point errors (`0.3 + 0.2 === 0.5` in JS). The accumulation display test (L63-68) clicks $0.10 + $0.20 + $0.50 and checks the *display text* `"$0.80"`, which `toFixed(2)` would format correctly even from the imprecise `0.8000000000000000004`.

A test that clicks $0.10 three times and then confirms would catch the issue: without `Math.round`, the state would be `0.30000000000000004` and `onConfirm` would receive that imprecise value instead of `0.3`. No existing test does this.

**Suggested Fix:**
Add a test that accumulates values triggering IEEE 754 imprecision, then asserts the exact numeric value passed to `onConfirm`:

```tsx
it('onConfirm receives a precise value after accumulation that would cause float error', () => {
  const onConfirm = vi.fn();
  render(<ChipPicker onConfirm={onConfirm} />);
  fireEvent.click(screen.getByTestId('chip-0.10'));
  fireEvent.click(screen.getByTestId('chip-0.10'));
  fireEvent.click(screen.getByTestId('chip-0.10'));
  fireEvent.click(screen.getByTestId('chip-confirm'));
  expect(onConfirm).toHaveBeenCalledWith(0.3);  // fails without Math.round
});
```

**Impact:** If the `Math.round` guard is accidentally removed in a future refactor, the downstream API (T-030 player actions) would receive imprecise dollar amounts like `0.30000000000000004`, potentially causing comparison failures or display bugs server-side.

---

### [LOW] Cancel button missing `minHeight` for touch target consistency

**File:** `frontend/src/dealer/ChipPicker.tsx`
**Line(s):** 129-136
**Category:** design

**Problem:**
The Clear and Confirm buttons both set `minHeight: '48px'` (L120, L128), meeting Google Material's recommended 48px touch target. The Cancel button (L129-136) has `padding: '0.75rem 1.5rem'` and `fontSize: '1rem'` which likely renders close to 48px, but lacks an explicit `minHeight` guarantee — inconsistent with the other action buttons.

**Code:**
```tsx
cancelButton: {
    marginTop: '1rem',
    padding: '0.75rem 1.5rem',
    fontSize: '1rem',
    background: '#1e1f2b',
    border: '1px solid #2e303a',
    borderRadius: '12px',
    cursor: 'pointer',
    color: '#e2e8f0',
    // missing: minHeight: '48px'
  },
```

**Suggested Fix:**
Add `minHeight: '48px'` to the `cancelButton` style object.

**Impact:** Minor — on devices with unusual font rendering, the cancel button may fall below the recommended minimum touch target size.

---

## Positives

- **Floating-point defense done right**: The `Math.round((prev + value) * 100) / 100` pattern in `handleChipTap` is the correct way to handle currency arithmetic in JS. Many implementations get this wrong.
- **Clean props interface**: `ChipPickerProps` follows the same `onAction` / `onCancel` convention as `CardPicker`, `OutcomeButtons`, and other sibling components. The optional `onCancel` with conditional rendering is a nice reusable pattern.
- **Thorough test coverage**: 16 tests covering rendering, interaction, accumulation, reset, callbacks, conditional rendering, color contrast, and mobile sizing — well above the AC requirements.
- **Accessibility-conscious color contrast**: White chip gets dark text (`#111827`), all others get white text. Dedicated tests verify this.
- **Consistent codebase style**: Inline styles via `Record<string, React.CSSProperties>`, named export, `data-testid` attributes — all match existing dealer component conventions.

---

## Overall Assessment

The ChipPicker implementation is clean, focused, and well-tested. All 6 acceptance criteria are **SATISFIED**. The component follows established patterns in the dealer module and handles the primary technical risk (floating-point arithmetic) correctly.

The one **HIGH** finding is a test gap, not a production bug — the `Math.round` defense works correctly, but lacks a regression test. This should be addressed before T-030 (player action buttons) builds on top of ChipPicker, as it would make the rounding logic appear untested and vulnerable to casual removal.

No CRITICAL findings. The implementation is ready for use by downstream tasks.
