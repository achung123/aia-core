# Code Review Report — aia-core

**Date:** 2026-04-12
**Target:** `frontend/src/dealer/ReviewScreen.tsx`, `frontend/src/dealer/ReviewScreen.test.tsx`
**Reviewer:** Scott (automated)
**Cycle:** 11

**Task:** ReviewScreen partial save on batch failure
**Beads ID:** aia-core-7ybn

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 1 |
| LOW | 2 |
| **Total Findings** | **3** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | Use Promise.allSettled to collect individual failures | SATISFIED | `ReviewScreen.tsx` L219 — `Promise.allSettled(mutations.map(...))` | Correctly replaces Promise.all; each settlement inspected individually |
| 2 | Dirty tracking prevents unchanged mutations from firing | SATISFIED | `ReviewScreen.tsx` L155–195 — `isDirty` checks compare `orig*` fields; tests in "dirty tracking for results" describe block | Results, hole cards, and community cards all have orig-vs-current checks |
| 3 | Retry skips already-succeeded mutations | PARTIAL | `ReviewScreen.tsx` L225–232 — `savedResults`, `savedHolecards`, `communitySaved` gates | Works for first retry, but post-failure re-edits to already-saved fields are silently dropped (see finding M-1) |
| 4 | Error message names specific failed calls | SATISFIED | `ReviewScreen.tsx` L240 — `failed.push(m.label)` with labels like `"Alice result"`, `"community cards"` | Tested in "reports specific failed calls on partial failure" |
| 5 | Tests cover partial failure scenarios | SATISFIED | 5 new tests across `partial save failure` and `dirty tracking for results` describe blocks; all 26 tests pass | Minor gap: no holecards retry test (see finding L-1) |

---

## Findings

### [MEDIUM] M-1 — Post-failure re-edit to already-saved field is silently dropped

**File:** `frontend/src/dealer/ReviewScreen.tsx`
**Line(s):** 155–160, 167–172, 197
**Category:** correctness

**Problem:**
After a partial failure, the UI remains fully interactive — the user can edit any field. If the user changes a field that was already saved in the previous attempt (e.g., changes Alice's result from "lost" to "folded" after Alice's result was successfully saved as "lost" in the first attempt), the retry will skip that mutation because `savedResults.has('Alice')` is `true`. The new edit is silently lost. If all remaining mutations succeed, `onSaved()` fires and the component unmounts, so the user never learns their second edit was discarded.

**Code:**
```typescript
// L155-160 — result dirty check
const isDirty = p.result !== p.origResult || p.outcomeStreet !== p.origOutcomeStreet;
if (isDirty && !savedResults.has(p.name)) {
  mutations.push({ ... });
}
```

**Suggested Fix:**
Clear the player from `savedResults` / `savedHolecards` (or reset `communitySaved`) whenever the user edits a field that was already saved. For example, in `handleResultChange`:
```typescript
function handleResultChange(name: string, result: string) {
  setEditPlayers((prev) => prev.map((p) => (p.name === name ? { ...p, result } : p)));
  setSavedResults((prev) => { const next = new Set(prev); next.delete(name); return next; });
}
```
Apply the same pattern to `handleStreetChange`, `handleCardSelect` (for player cards), and community card edits.

**Impact:** Silent data loss in edge case: partial failure → user edits saved field → retry → edit is dropped.

---

### [LOW] L-1 — No partial-failure retry test for holecards mutations

**File:** `frontend/src/dealer/ReviewScreen.test.tsx`
**Line(s):** (missing)
**Category:** correctness (test gap)

**Problem:**
The test suite covers retry-after-partial-failure for player results and community cards, but there is no test verifying that holecards mutations are skipped on retry when they succeeded in the previous attempt. The implementation uses the same `savedHolecards` Set pattern, so this is unlikely to be buggy, but it is an untested dimension.

**Suggested Fix:**
Add a test to the "partial save failure" describe block that makes a holecards edit + a result edit, fails the result, succeeds the holecards, then retries and asserts `updateHolecards` is not called again.

**Impact:** Low risk — code follows the same pattern as tested paths, but leaves a coverage gap.

---

### [LOW] L-2 — Console warnings in test output: act() and style shorthand conflicts

**File:** `frontend/src/dealer/ReviewScreen.test.tsx`
**Line(s):** (test runner output)
**Category:** convention

**Problem:**
Tests emit two types of warnings:
1. `"The current testing environment is not configured to support act(...)"` — happy-dom does not fully implement the React act() API
2. `"Removing a style property during rerender (borderColor) when a conflicting property is set (border)"` — `resultButton` uses `border` shorthand while `resultButtonActive` overrides `borderColor`, causing a style conflict

**Suggested Fix:**
1. Consider upgrading to jsdom or configuring happy-dom to suppress act() warnings
2. In `resultButtonActive`, replace `borderColor: '#4f46e5'` with `border: '1px solid #4f46e5'` (matching the shorthand)

**Impact:** Noisy test output; no functional impact. The style conflict could cause minor visual glitches during re-renders.

---

## Positives

- **Promise.allSettled usage is correct and well-structured.** The `LabeledMutation` interface cleanly maps each mutation to a label, type, and optional player name. The iteration over `results` and `mutations` arrays is index-aligned and handles all three mutation types.
- **Dirty tracking is thorough.** Original values are captured in `useState` initializers and compared against current values. Three independent tracking dimensions (results, holecards, community) with separate saved-state ensure minimal redundant API calls.
- **Error messages are specific and actionable.** The `failed.push(m.label)` pattern gives users clear visibility into what went wrong ("Save failed for: Alice result, community cards").
- **Tests are well-structured and comprehensive.** The 5 new tests cover the key scenarios: partial failure error reporting, result retry safety, and community retry safety. The mock setup using `mockImplementation` with player-name routing is elegant.
- **Button disabling during save prevents double-submission.** `disabled={saving}` on both Confirm and Cancel buttons is correctly applied.

---

## Overall Assessment

The bug fix is **solid and well-implemented**. The core approach — `Promise.allSettled` + per-mutation labeling + saved-state tracking — is the right pattern for handling partial batch failures. The error messages give users clear information, and retry correctly skips succeeded mutations in the common case.

The one substantive concern (M-1) is a **post-failure re-edit edge case** where edits to already-saved fields are silently dropped on retry. This requires a specific user flow (partial fail → edit saved field → retry) and is unlikely in normal usage, but it is a real data loss path. The fix is straightforward: clear the saved flag when the user edits a previously-saved field.

The two LOW findings are minor gaps in test coverage and console noise.

**Verdict:** No CRITICAL findings. Code is safe to ship with M-1 tracked as a follow-up fix.
