# Code Review Report — alpha-patch-009

**Date:** 2026-04-12
**Cycle:** 13
**Target:** Seat picker UI + dealer bet verification frontend (10 files)
**Reviewer:** Scott (automated)

**Task:** T-004 — Seat picker UI + dealer bet verification frontend
**Beads ID:** aia-core-vrdu

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 1 |
| MEDIUM | 3 |
| LOW | 3 |
| **Total Findings** | **7** |

**Tests:** 130 / 130 pass across the 4 test files (SeatPicker: 9, PlayerApp seat step: 7, GamePlayerManagement: 5, ActiveHandDashboard bet verification: 11, plus existing tests).

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | SeatPicker renders 10 seats in oval; occupied=disabled; open=tappable | SATISFIED | `SeatPicker.tsx` L34-67; `SeatPicker.test.tsx` — 9 tests including partial data fill-to-10, disabled/enabled checks, aria-labels | Oval uses trigonometric positioning; always renders 10 seats even with sparse input |
| 2 | Player: seat picker after name; API call on select; Skip proceeds without | SATISFIED | `PlayerApp.tsx` `handleSelectPlayer()` → `seatPick` step; `handleSeatSelect()` calls `assignPlayerSeat`; `handleSeatSkip()` advances to playing | 3 tests cover: seat step appears, API call, skip bypass |
| 3 | Player: rejoin highlights existing seat; reassign works | SATISFIED | `PlayerApp.tsx` L186-190 sets `playerSeat` from `playersInfo`; SeatPicker `currentPlayerSeat` prop highlights; `PlayerApp.test.tsx` "highlights current seat on rejoin" + "reassigns seat" tests | Border style `4f46e5` verified in test |
| 4 | Dealer: seat numbers shown; reassign opens picker; 409 conflict error | SATISFIED | `GamePlayerManagement.tsx` seat badge + reassign button + SeatPicker panel; `GamePlayerManagement.test.tsx` — seat display, reassign panel open/close, API call, 409 error tests | 5 new tests |
| 5 | Dealer bet verification: current player display; confirm/override buttons | SATISFIED | `ActiveHandDashboard.tsx` bet-verify-panel with "Turn: {name}" / "Waiting for turn…"; confirm-action-btn + override-action-btn; `ActiveHandDashboard.test.tsx` — 11 tests | Pot display and legal actions also shown |
| 6 | Override: inline editor for action type + amount; submission advances turn | SATISFIED | `ActiveHandDashboard.tsx` override-form with select + number input + submit; `handleOverrideSubmit()` calls `recordPlayerAction`; test verifies raise with custom amount | Override form closes on success |
| 7 | Vitest tests cover all flows | SATISFIED | 130 tests pass across 4 test files | No gaps in critical flows |

---

## Findings

### [HIGH] Confirm action uses potentially incorrect amount for raise

**File:** `frontend/src/dealer/ActiveHandDashboard.tsx`
**Line(s):** 103-109
**Category:** correctness

**Problem:**
`handleConfirmAction()` defaults to `legalActions[0]` as the action and uses `amountToCall ?? 0` as the amount for `call`, `bet`, and `raise`. When the first legal action is `raise`, the amount sent will be `amountToCall` — the call amount, not a raise amount. This could produce an incorrect or confusing action record. A raise amount must exceed the call amount.

**Code:**
```typescript
const action = legalActions[0] as ActionEnum;
const amount = (action === 'call' || action === 'bet' || action === 'raise')
  ? (amountToCall ?? 0) : undefined;
```

**Suggested Fix:**
For "Confirm", only auto-submit if the first legal action is `call`, `check`, or `fold` (actions with deterministic amounts). For `bet`/`raise`, open the override form instead so the dealer must specify the amount. Alternatively, display which action + amount will be confirmed and let the dealer visually verify before clicking.

**Impact:** Dealer could accidentally confirm a raise at the wrong amount, recording an invalid action that the backend may reject (or worse, accept).

---

### [MEDIUM] Race condition — seat buttons not disabled during API call

**File:** `frontend/src/player/PlayerApp.tsx`
**Line(s):** 194-208
**Category:** design

**Problem:**
`handleSeatSelect()` sets `seatLoading = true` during the API call but does not pass `seatLoading` to `SeatPicker` to disable all open seat buttons. A fast double-tap could fire two concurrent `assignPlayerSeat` calls.

**Code:**
```typescript
function handleSeatSelect(seatNumber: number) {
  if (!gameId || !playerName) return;
  setSeatLoading(true);
  // ... but SeatPicker buttons remain enabled
```

**Suggested Fix:**
Pass a `disabled` prop to `SeatPicker` (or temporarily pass an empty `onSelect` callback) while `seatLoading` is true. Alternatively, add a guard at the top: `if (seatLoading) return;`.

**Impact:** Low probability, but could cause a 409 conflict or duplicate requests.

---

### [MEDIUM] Race condition in dealer seat reassignment

**File:** `frontend/src/dealer/GamePlayerManagement.tsx`
**Line(s):** 69-80
**Category:** design

**Problem:**
`handleReassignSeat()` does not disable the SeatPicker during the async API call. Rapid clicks could fire concurrent reassignment requests.

**Suggested Fix:**
Add a `reassignLoading` state and disable the SeatPicker while the API call is in flight, similar to the `adding` state pattern already used for the "Add Player" button.

**Impact:** Low probability, but could produce inconsistent seat state.

---

### [MEDIUM] Override amount not validated client-side

**File:** `frontend/src/dealer/ActiveHandDashboard.tsx`
**Line(s):** 116-127
**Category:** correctness

**Problem:**
`handleOverrideSubmit()` parses `overrideAmount` with `parseFloat()` and sends it directly. While the HTML `<input type="number" min="0">` prevents negative input in the UI, the JS handler doesn't validate:
- That a `bet`/`raise` has an amount > 0
- That a `fold`/`check` has no amount
- That the amount is not unreasonably large

The backend validates this, but a clear client-side validation message would improve UX.

**Suggested Fix:**
Add minimal validation: require amount > 0 for `bet`/`raise`/`call`, and disable/clear amount for `fold`/`check`. Show inline error before submitting.

**Impact:** Poor UX — dealer submits, gets a cryptic server error instead of clear client feedback.

---

### [LOW] `seatError` not clearable without selecting a new seat

**File:** `frontend/src/player/PlayerApp.tsx`
**Line(s):** 200-205
**Category:** design

**Problem:**
When `handleSeatSelect` fails (e.g., 409), the error is shown (`seatError`) but the only way to clear it is to select another seat (which resets it) or skip. A dismiss/retry mechanism is missing.

**Suggested Fix:**
Consider clearing `seatError` when the user taps any seat button, or add a small dismiss button.

**Impact:** Minor UX friction.

---

### [LOW] SeatPicker accessibility — missing ARIA group role

**File:** `frontend/src/components/SeatPicker.tsx`
**Line(s):** 35-45
**Category:** design

**Problem:**
The seat picker container div has `data-testid="seat-picker"` but no ARIA `role` (e.g., `role="group"` or `role="radiogroup"`) or `aria-label` to describe the interactive group to screen readers. Individual seats have `aria-label`, which is good.

**Suggested Fix:**
Add `role="group"` and `aria-label="Seat selection"` to the container div.

**Impact:** Screen reader users may not understand the grouping context.

---

### [LOW] Player name in player tiles rendered without length/character constraints

**File:** `frontend/src/dealer/GamePlayerManagement.tsx`
**Line(s):** 100-104
**Category:** design

**Problem:**
Player names are rendered in flex rows without text truncation. Very long player names could break layout. The `SeatPicker` handles this with `textOverflow: 'ellipsis'` but `GamePlayerManagement` does not.

**Suggested Fix:**
Add `overflow: hidden; textOverflow: 'ellipsis'; whiteSpace: 'nowrap'; maxWidth` to the name `<span>` in the player row.

**Impact:** Layout breakage with edge-case long names. No XSS risk — React auto-escapes all text content.

---

## Positives

- **Clean component architecture.** `SeatPicker` is a reusable presentational component, correctly separated from business logic. Both PlayerApp and GamePlayerManagement consume it with different callbacks.
- **Thorough test coverage.** 130 tests across 4 files cover all AC paths including error states, edge cases (partial seat data, 409 conflict), and accessibility labels.
- **No XSS vulnerabilities.** All player names are rendered via JSX (React auto-escaping). No `dangerouslySetInnerHTML`, no string interpolation into HTML. URL parameters use proper `encodeURIComponent`/`decodeURIComponent`.
- **Consistent API patterns.** `assignPlayerSeat` follows the same `request<T>()` pattern with `encodeURIComponent` for path parameters. Error handling matches existing patterns.
- **Optimistic updates with rollback.** `GamePlayerManagement` toggles use optimistic updates with error rollback — an established pattern in the codebase.
- **Accessibility basics.** SeatPicker has `aria-label` on every seat button, 44px minimum touch targets, and visible focus indicators.

---

## Overall Assessment

Solid implementation that satisfies all 7 acceptance criteria. 130 tests pass with no failures. No CRITICAL findings.

The HIGH finding (confirm action default amount for raise) is the most impactful — it could cause incorrect bet records. The three MEDIUM findings (two race conditions and missing client-side validation) are low-risk but worth addressing in a follow-up. The LOW findings are minor UX/accessibility polish.

**Verdict:** PASS — no critical issues. Recommend addressing the HIGH finding in a follow-up task.
