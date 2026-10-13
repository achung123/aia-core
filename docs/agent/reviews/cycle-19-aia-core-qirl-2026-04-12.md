# Code Review Report — aia-core

**Date:** 2026-04-12
**Target:** `frontend/src/components/ (SessionForm, PlayerManagement, HandRecordForm, HandEditForm, cardUtils)`
**Reviewer:** Scott (automated)
**Cycle:** 19

**Task:** T-018 — Convert vanilla DOM components to TSX (batch 1: forms)
**Beads ID:** aia-core-qirl

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
| 1 | All form .js files converted to .tsx with typed props, handlers, state | SATISFIED | SessionForm.tsx, PlayerManagement.tsx, HandRecordForm.tsx, HandEditForm.tsx all export typed React components with explicit interfaces (SessionFormProps, HandRecordFormProps, HandEditFormProps) and typed state | cardUtils.ts extracted as shared utility with typed exports |
| 2 | Form validation with duplicate card detection | SATISFIED | cardUtils.ts:`findDuplicateCards()`, `isValidCard()`, `normalizeCard()`; both form components run `runDuplicateCheck` on blur and on submit; HandRecordForm.test.tsx tests duplicate/invalid/required errors | Comprehensive on-blur + on-submit validation |
| 3 | Tests pass, no regressions | SATISFIED | 38/38 tests pass (5 test files); vitest run confirms zero failures | Full coverage of render, loading, error, submit, validation paths |

---

## Findings

### [MEDIUM] M-1: `setSubmitting(false)` missing from success path in HandEditForm

**File:** `frontend/src/components/HandEditForm.tsx`
**Line(s):** 199–286
**Category:** correctness

**Problem:**
`HandEditForm.handleSubmit` calls `setSubmitting(true)` at line 199 but only calls `setSubmitting(false)` inside the `catch` block (line 285). The `HandRecordForm` correctly uses `finally { setSubmitting(false) }`. If `onSave` does not unmount the component, the Save button remains permanently disabled.

**Code:**
```tsx
// HandEditForm.tsx – catch block only
} catch (err) {
  setFormError(err instanceof Error ? err.message : String(err));
  setSubmitting(false);  // only here, not in finally
}
```

**Suggested Fix:**
Wrap in `try/catch/finally` like HandRecordForm does, or add `setSubmitting(false)` after the `onSave` call.

**Impact:** Save button stuck in disabled state if the parent doesn't unmount the form on save.

---

### [MEDIUM] M-2: Stale closure over `playerRows` / `community` in blur handlers

**File:** `frontend/src/components/HandRecordForm.tsx`, `frontend/src/components/HandEditForm.tsx`
**Line(s):** HandRecordForm:113–119, HandEditForm:118–124
**Category:** design

**Problem:**
`handleCommunityBlur` uses a `setCommunity` updater that receives fresh `community` via `prev`, but references `playerRows` from the outer closure. Symmetrically, `handlePlayerCardBlur` gets fresh `playerRows` via `setPlayerRows` updater but references `community` from the closure. If both handlers fire in rapid succession within the same render frame, the duplicate check could use stale data.

In practice this is unlikely because blur events are sequential (user can only focus one field at a time), but it's a latent correctness concern.

**Suggested Fix:**
Use refs (`useRef`) to hold the latest `playerRows` and `community`, or consolidate both into a single `useReducer` so all state is available atomically.

**Impact:** Very low practical risk; theoretical stale-data race in duplicate detection during rapid interactions.

---

### [LOW] L-1: Duplicated types and helpers across HandRecordForm and HandEditForm

**File:** `frontend/src/components/HandRecordForm.tsx`, `frontend/src/components/HandEditForm.tsx`
**Line(s):** HandRecordForm:18–54, HandEditForm:14–53
**Category:** design

**Problem:**
`CardFieldState`, `validateCardField`, `hasAnyError`, `toFieldId`, and `renderCardField` are near-identical in both files. This is fine for a first conversion pass but creates maintenance risk as the two copies drift.

**Suggested Fix:**
Extract shared types and helpers into `cardUtils.ts` or a new `cardFieldHelpers.ts` in a follow-up task.

**Impact:** Maintenance burden; no functional issue.

---

### [LOW] L-2: `toFieldId` defined but narrowly used — regex could be tighter

**File:** `frontend/src/components/HandRecordForm.tsx`, `frontend/src/components/HandEditForm.tsx`
**Line(s):** HandRecordForm:37, HandEditForm:33
**Category:** convention

**Problem:**
`toFieldId` strips all non-alphanumeric characters from player names to build HTML `id` attributes. This works but could produce collisions for names that differ only in special characters (e.g., "O'Brien" and "OBrien"). Not a bug for typical poker player names, but worth noting.

**Suggested Fix:**
No action needed now; consider a more robust slug if exotic player names are expected.

**Impact:** Negligible.

---

## Positives

- **Clean typed props and state:** All four components export explicit TypeScript interfaces. State is well-structured with discriminated unions (`PlayerLoadState` in SessionForm) and per-field validation state (`CardFieldState`).
- **Shared card validation logic:** `cardUtils.ts` is correctly extracted as a pure-function utility with full test coverage (7 tests covering valid/invalid/normalize/duplicates).
- **Comprehensive test suite:** 38 tests across 5 files covering render, loading, error, submit success, submit failure, validation errors, duplicate detection, and user interactions. All pass.
- **Good error handling:** 409 conflict errors are caught and translated to user-friendly messages. Server errors surface inline. Callback errors (`onSuccess`, `onSave`) are caught with `try/catch` to prevent unhandled rejections.
- **No XSS vectors:** No `dangerouslySetInnerHTML`, `innerHTML`, `eval`, or raw HTML injection. All user input flows through React's controlled component model.
- **Correct API integration:** Components use the typed `client.ts` functions and match the existing API contract. HandEditForm correctly diff-checks before PATCHing, avoiding unnecessary API calls.

---

## Overall Assessment

The batch-1 form conversions are solid. All three acceptance criteria are satisfied — the four form components are properly typed TSX with validation, duplicate card detection, and 38 passing tests. No CRITICAL or HIGH findings. The two MEDIUM findings (missing `finally` in HandEditForm submit and stale closures in blur handlers) are worth addressing in a follow-up but don't block this task. Code quality, test coverage, and API integration are all good.
