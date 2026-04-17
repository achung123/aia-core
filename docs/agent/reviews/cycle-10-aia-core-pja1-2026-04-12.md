# Code Review Report — alpha-feedback-008

**Date:** 2026-04-12
**Cycle:** 10
**Target:** `frontend/src/dealer/ReviewScreen.tsx`, `frontend/src/dealer/ReviewScreen.test.tsx`, `frontend/src/dealer/DealerApp.tsx`, `frontend/src/dealer/DealerApp.test.tsx`
**Reviewer:** Scott (automated)

**Task:** T-025 — Full editable dealer review screen
**Beads ID:** aia-core-pja1

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 1 |
| MEDIUM | 3 |
| LOW | 2 |
| **Total Findings** | **6** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | Displays community cards (editable via CardPicker), each player's hole cards, proposed result, outcome street | SATISFIED | `ReviewScreen.test.tsx` — "renders community cards", "renders player hole cards", "renders result buttons", "renders outcome street dropdown" | Community cards, hole cards, result buttons, and street dropdown all rendered and verified |
| 2 | Dealer can tap any card to edit it; change any result via buttons | SATISFIED | `ReviewScreen.test.tsx` — "tapping a community card opens CardPicker", "selecting a card from CardPicker updates the community card", "tapping a player card opens CardPicker", "clicking a result button changes the player result" | CardPicker opens on tap for both community and player cards; result buttons toggle correctly |
| 3 | Dealer can change outcome street per player via dropdown | SATISFIED | `ReviewScreen.test.tsx` — "changing the dropdown updates the outcome street" | Dropdown with preflop/flop/turn/river options; change events update state |
| 4 | Confirm & Save batches changes: patchPlayerResult() + updateCommunityCards() if edited | SATISFIED | `ReviewScreen.test.tsx` — "calls patchPlayerResult for each player", "calls updateCommunityCards when community cards are edited", "does not call updateCommunityCards when community cards are unchanged", "calls updateHolecards when player cards are edited" | All three API functions called correctly; community + hole cards only when dirty |
| 5 | Cancel returns to active hand without saving | SATISFIED | `ReviewScreen.test.tsx` — "calls onCancel without making any API calls"; `DealerApp.tsx` L446: `onCancel={() => setStep('activeHand')}` | No API calls on cancel; step set to activeHand |
| 6 | Component test covers render, editing, and save flow | SATISFIED | `ReviewScreen.test.tsx` — 21 tests across 7 describe blocks covering rendering, community card editing, player card editing, result editing, street editing, save flow, and cancel flow | Comprehensive coverage including error case |

---

## Findings

### [HIGH] Partial save on batch failure — some mutations persist while error is shown

**File:** `frontend/src/dealer/ReviewScreen.tsx`
**Line(s):** 139–176
**Category:** correctness

**Problem:**
`handleSave` fires all API calls in a single `Promise.all`. If the second `patchPlayerResult` call fails but the first succeeds, the first mutation is already persisted server-side. The user sees an error and can retry, but the retry will re-submit the already-saved mutations, potentially causing unnecessary API traffic. More critically, `updateHolecards` and `updateCommunityCards` are interleaved—a community card update could succeed while a player result fails, leaving the hand in an inconsistent half-saved state with no rollback mechanism.

**Code:**
```typescript
await Promise.all([
  ...resultPromises,
  ...holeCardPromises,
  ...(communityPromise ? [communityPromise] : []),
]);
```

**Suggested Fix:**
Consider using `Promise.allSettled` to collect individual results, then report which specific calls failed. Alternatively, sequence the calls (results first, then cards) and stop on first failure with a clear message about what was saved. For a poker session app the risk is moderate—idempotent PATCHes make retries safe—but the UX could be confusing.

**Impact:** On transient network errors, the hand could end up in a partially saved state. The dealer would need to retry, which works because PATCHes are idempotent, but the error message doesn't indicate which calls failed.

---

### [MEDIUM] Missing `handed_back` result option — valid ResultEnum value not selectable

**File:** `frontend/src/dealer/ReviewScreen.tsx`
**Line(s):** 56
**Category:** correctness

**Problem:**
`RESULT_OPTIONS` is defined as `['won', 'lost', 'folded']` but `ResultEnum` (in `api/types.ts` L5) includes `'handed_back'` as a fourth valid value. If a player's status is `'handed_back'` when the review screen opens, no result button will be highlighted (none match), and the dealer cannot select `handed_back` from the UI. The save will still send whatever result is in state, but the visual feedback is broken.

**Code:**
```typescript
const RESULT_OPTIONS: ResultEnum[] = ['won', 'lost', 'folded'];
```

**Suggested Fix:**
Either add `'handed_back'` to `RESULT_OPTIONS` or confirm with the product spec that `handed_back` is not a valid outcome at the review screen stage and add a comment explaining the intentional omission.

**Impact:** Players with `handed_back` status would show no active result button on the review screen, potentially confusing the dealer.

---

### [MEDIUM] All player results patched unconditionally — no dirty check for results

**File:** `frontend/src/dealer/ReviewScreen.tsx`
**Line(s):** 140–146
**Category:** design

**Problem:**
Hole cards and community cards are only sent to the API when they've changed (dirty check against `origCard1`/`origCard2` and `origCommunity`). However, `patchPlayerResult` is called for *every* player on every save, even if the result and outcome street haven't changed. This is inconsistent with the dirty-tracking pattern used elsewhere in the same function.

**Code:**
```typescript
const resultPromises = editPlayers.map((p) =>
  patchPlayerResult(gameId, handId, p.name, {
    result: p.result as ResultEnum,
    outcome_street: (p.outcomeStreet || null) as StreetEnum | null,
  }),
);
```

**Suggested Fix:**
Track original result and outcome street in `EditablePlayer` (similar to `origCard1`/`origCard2`) and only call `patchPlayerResult` for players whose result or outcome street actually changed.

**Impact:** Unnecessary API calls on every save. In a 9-player hand, that's 9 PATCH requests even if only one result was edited. Functionally correct (idempotent PATCHes) but wasteful.

---

### [MEDIUM] No integration test for cancel button returning to activeHand

**File:** `frontend/src/dealer/DealerApp.test.tsx`
**Line(s):** N/A (missing test)
**Category:** correctness

**Problem:**
The DealerApp integration tests verify that the review screen renders and that "Confirm & Save" works, but there is no test that clicks `review-cancel-btn` and asserts the app returns to the `activeHand` step. The cancel button is only confirmed to exist (L213: `expect(container.querySelector('[data-testid="review-cancel-btn"]')).not.toBeNull()`), but its click behavior is never exercised at the integration level.

**Suggested Fix:**
Add a DealerApp integration test that sets state to `review`, clicks `review-cancel-btn`, and asserts that the active hand dashboard reappears.

**Impact:** The cancel path is tested in ReviewScreen unit tests (onCancel callback is called), but the integration-level wiring (`setStep('activeHand')`) is not verified.

---

### [LOW] CSS shorthand/longhand conflict causes console warnings in tests

**File:** `frontend/src/dealer/ReviewScreen.tsx`
**Line(s):** 380, 395
**Category:** convention

**Problem:**
The `resultButtonActive` style sets `borderColor: '#4f46e5'` while the base `resultButton` sets `border: '1px solid #4b5563'`. When both are merged via spread, the shorthand (`border`) and longhand (`borderColor`) conflict, triggering a React warning in test output: *"Removing a style property during rerender (borderColor) when a conflicting property is set (border) can lead to styling bugs."*

**Code:**
```typescript
resultButton: {
  border: '1px solid #4b5563',      // shorthand
},
resultButtonActive: {
  borderColor: '#4f46e5',            // longhand — conflicts with shorthand
},
```

**Suggested Fix:**
Use consistent longhand properties in the base style (`borderWidth`, `borderStyle`, `borderColor`) or override the full shorthand in the active state.

**Impact:** Console noise in tests; potential rendering inconsistency in some browsers.

---

### [LOW] `act(...)` warnings in test output indicate improper async wrapping

**File:** `frontend/src/dealer/ReviewScreen.test.tsx`
**Line(s):** Throughout save tests
**Category:** convention

**Problem:**
Multiple tests produce the stderr warning: *"The current testing environment is not configured to support act(...)."* This is a happy-dom limitation with React 18's `act()` utility. The tests still pass and assertions are correct, but the console noise makes it harder to spot real warnings.

**Suggested Fix:**
This is a known happy-dom limitation. Consider adding a `vi.spyOn(console, 'error').mockImplementation(...)` in a `beforeEach` for the save tests, or switch to jsdom if the warnings become problematic. No code change strictly required.

**Impact:** Noisy test output only; no functional impact.

---

## Positives

- **Clean separation of concerns**: ReviewScreen is a pure presentational component with no store dependency — it receives all data via props and communicates back through `onSaved`/`onCancel` callbacks. This makes it highly testable and reusable.
- **Effective dirty tracking for cards**: Both community cards and player hole cards track original values and only fire API calls when changes are detected. This is a smart optimization.
- **Thorough test coverage**: 21 tests across 7 describe blocks cover rendering, all edit paths (community cards, player cards, results, outcome street), the save flow (with and without changes), error handling, and the cancel flow. Each AC is directly exercised.
- **CardPicker is XSS-safe**: All card values come from hardcoded `RANKS` and `SUITS` arrays — no user-provided strings are rendered into the DOM. The `onSelect` callback passes only pre-defined card codes.
- **Proper loading/error states**: The save button shows "Saving…" and is disabled during the async operation. Errors are caught and displayed in a visible error banner. The cancel button is also disabled during save to prevent navigation during mutation.
- **Accessible result buttons**: Using `aria-pressed` for toggle state is correct semantics for a button group acting as a toggle.

---

## Overall Assessment

The ReviewScreen implementation is solid and meets all 6 acceptance criteria. The component is well-structured, testable, and the test suite is comprehensive. No CRITICAL findings. The one HIGH finding (partial save on batch failure) is a real concern but mitigated by the idempotent nature of the PATCH endpoints — a retry will converge to the correct state. The MEDIUM findings are worth addressing in a follow-up task but do not block the current work. The code is ready for production use with the understanding that the batch save has no transactional guarantee.
