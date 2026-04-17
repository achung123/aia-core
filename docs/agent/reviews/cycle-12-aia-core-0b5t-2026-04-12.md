# Code Review Report — alpha-feedback-008

**Date:** 2026-04-12
**Cycle:** 12
**Target:** `frontend/src/dealer/ReviewScreen.tsx`, `frontend/src/dealer/ReviewScreen.test.tsx`, `frontend/src/dealer/DealerApp.test.tsx`
**Reviewer:** Scott (automated)

**Task:** T-026 — End hand flow with terminal state check
**Beads ID:** aia-core-0b5t

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
| 1 | Finish Hand disabled until all players have a result | SATISFIED | `ReviewScreen.tsx` L101 (`allTerminal` gate) + L358 (`disabled={!allTerminal}`); tests in `ReviewScreen.test.tsx` L408–L447 (AC1 describe block: disabled when non-terminal, enabled when all terminal, transitions after manual set) | `allTerminal` computed from `TERMINAL_RESULTS` includes won/lost/folded — correct |
| 2 | Players with null cards and null result auto-assigned result = folded before save | SATISFIED | `ReviewScreen.tsx` L63–L64 (`isAutoFold` logic); tests in `ReviewScreen.test.tsx` L336–L406 (AC2 describe block: 5 tests covering auto-fold for handed_back, playing, no-auto-fold with cards, no-auto-fold with terminal, API save) | Auto-fold condition: `!p.card1 && !p.card2 && !TERMINAL_RESULTS.includes(p.status)` — slightly stricter than AC wording ("null result") but correctly handles more states (playing, handed_back); acceptable |
| 3 | Confirmation dialog summarizes outcomes before committing | SATISFIED | `ReviewScreen.tsx` L365–L381 (dialog rendering with player list); tests in `ReviewScreen.test.tsx` L453–L494 (AC3 describe block: shows dialog, cancel doesn't save, confirm triggers save, after-finish calls onSaved) | Dialog lists each player's name and result — correct |
| 4 | After finish, dealer returns to Game Dashboard; hand count increments | SATISFIED | `DealerApp.tsx` L445 `onSaved={() => finishHand()}`; `dealerStore.ts` L199–L207 (`finishHand` resets hand, increments `handCount`, sets `currentStep: 'dashboard'`); integration test in `DealerApp.test.tsx` L219–L244 confirms review → Finish → dashboard transition | Hand count incremented, state fully reset, step transitions to dashboard |
| 5 | Test verifies auto-fold logic and terminal-state gating | SATISFIED | `ReviewScreen.test.tsx` has 5 auto-fold tests (AC2 block) + 4 gating tests (AC1 block) + 4 dialog tests (AC3 block) = 13 new test cases | Comprehensive coverage of the specified scenarios |

---

## Findings

### [MEDIUM] Auto-fold does not handle partial-card edge case (one card null, one present)

**File:** `frontend/src/dealer/ReviewScreen.tsx`
**Line(s):** 63–64
**Category:** correctness

**Problem:**
The auto-fold condition is `!p.card1 && !p.card2 && !TERMINAL_RESULTS.includes(p.status)`. This requires **both** cards to be null. A player with one card captured (`card1: 'Ah'`, `card2: null`) and a non-terminal status (e.g. `'playing'`) would not be auto-folded, nor would they show a result — the dealer must manually assign a result for the Finish Hand button to become enabled.

This is defensible behavior (a player with one card captured is an ambiguous case the dealer should resolve), but it is untested. No test covers the `card1: 'Ah', card2: null, status: 'playing'` scenario to verify the expected behavior.

**Code:**
```tsx
const isAutoFold = !p.card1 && !p.card2 && !TERMINAL_RESULTS.includes(p.status);
```

**Suggested Fix:**
Add a test case in the AC2 describe block confirming that partial-card players are NOT auto-folded (documenting the intentional design decision), e.g.:
```tsx
it('does NOT auto-fold players with one card captured', () => { ... });
```

**Impact:** Untested edge case — low risk but could confuse future maintainers.

---

### [MEDIUM] No test for empty player list edge case

**File:** `frontend/src/dealer/ReviewScreen.test.tsx`
**Line(s):** (missing)
**Category:** correctness

**Problem:**
There is no test for what happens when `players` is an empty array (or all players are `not_playing`). In this scenario:
- `editPlayers` would be empty
- `allTerminal` would be `true` (vacuously — `[].every(...)` returns `true`)
- The Finish Hand button would be enabled immediately
- The confirmation dialog would show an empty outcomes list

This is likely harmless (the hand has no players to save), but the vacuous-truth behavior of `allTerminal` on an empty list could be surprising. It should be documented with a test.

**Code:**
```tsx
const allTerminal = editPlayers.every((p) => TERMINAL_RESULTS.includes(p.result));
```

**Suggested Fix:**
Add a test verifying behavior with an empty player list (all `not_playing`), confirming that Finish Hand is enabled and `onSaved` is called immediately with no API calls. If this behavior is undesirable, add a guard like `editPlayers.length > 0 && allTerminal`.

**Impact:** Edge case — unlikely in practice but could surface in degenerate scenarios.

---

### [LOW] Confirmation dialog does not show outcome street per player

**File:** `frontend/src/dealer/ReviewScreen.tsx`
**Line(s):** 370–373
**Category:** design

**Problem:**
The confirmation dialog lists each player as `{name}: {result}` but does not include the outcome street (e.g., "Alice: won on river"). The AC says "summarizes outcomes," which could reasonably include the street. The current implementation satisfies the minimum requirement but could be more informative.

**Code:**
```tsx
{editPlayers.map((p) => (
  <li key={p.name}>{p.name}: {p.result}</li>
))}
```

**Suggested Fix:**
Optionally append the outcome street: `{p.name}: {p.result}{p.outcomeStreet ? ` on ${p.outcomeStreet}` : ''}`. This is a UX enhancement, not a bug.

**Impact:** Minor UX improvement — no functional impact.

---

### [LOW] `savedResults` / `savedHolecards` / `communitySaved` state survives across dialog open/close cycles

**File:** `frontend/src/dealer/ReviewScreen.tsx`
**Line(s):** 102–104
**Category:** design

**Problem:**
The partial-save tracking state (`savedResults`, `savedHolecards`, `communitySaved`) persists across multiple Finish Hand → Cancel → Finish Hand cycles within the same ReviewScreen mount. This is actually the **correct** behavior for partial-failure retry (if a mutation succeeded, it shouldn't be re-sent). However, there is no explicit test for the scenario where a user opens the confirmation dialog, cancels, then re-opens it — verifying that previously succeeded mutations are still tracked.

The existing "retry after partial failure" tests in the `partial save failure` describe block do cover the core retry logic, so this is a nice-to-have rather than a gap.

**Suggested Fix:**
No code change needed. Optionally add a test that cancels the dialog mid-flow and re-opens it to confirm state continuity.

**Impact:** Negligible — existing retry tests provide adequate coverage.

---

## Positives

- **Auto-fold logic is clean and well-placed** — computed once during state initialization, not re-computed on every render. The `TERMINAL_RESULTS` constant ensures consistency.
- **Terminal gating is simple and correct** — `editPlayers.every(...)` is the right approach, and the button `disabled` state is correctly derived.
- **Partial-save tracking is production-quality** — the `savedResults`/`savedHolecards`/`communitySaved` pattern with `Promise.allSettled` properly handles partial failures and enables idempotent retry. This is above-average engineering for a feature of this scope.
- **Confirmation dialog pattern is solid** — two-step flow (`showFinishConfirm` → `handleConfirmFinish`) prevents accidental saves.
- **Test coverage is comprehensive** — 13 new tests across 5 describe blocks map cleanly to all 5 acceptance criteria. Test names are descriptive and test data is well-structured via the `makeProps()` helper.
- **Integration test updated correctly** — `DealerApp.test.tsx` now includes the dialog confirmation step in the review→dashboard transition test, maintaining consistency with the new flow.

---

## Overall Assessment

The implementation cleanly satisfies all 5 acceptance criteria. No CRITICAL or HIGH findings. The two MEDIUM findings are untested edge cases (partial cards, empty player list) that represent defensive gaps rather than bugs — both would benefit from test documentation but do not block the feature. The two LOW findings are minor UX and test completeness suggestions.

**Verdict: PASS — clean implementation with no blocking issues.**
