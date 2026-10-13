# Code Review Report — alpha-feedback-008

**Date:** 2026-04-12
**Cycle:** 3
**Target:** Remove legacy handPayload submission flow
**Reviewer:** Scott (automated)

**Task:** T-016 — Remove legacy handPayload submission flow
**Beads ID:** aia-core-jjd9

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 1 |
| HIGH | 0 |
| MEDIUM | 1 |
| LOW | 0 |
| **Total Findings** | **2** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | handPayload.ts deleted or reduced to incremental-flow helpers only | SATISFIED | `frontend/src/dealer/handPayload.ts` absent from disk; `git status` shows unstaged deletion | File is gone on disk but deletion is **not committed** — see CRITICAL finding |
| 2 | Submit Hand button removed from dealer UI | SATISFIED | `frontend/src/components/HandRecordForm.tsx` absent from disk; no imports reference it | HandRecordForm was the sole Submit Hand UI; deletion confirmed |
| 3 | handPayload.test.ts updated or removed | SATISFIED | `frontend/src/dealer/handPayload.test.ts` absent from disk; `git status` shows unstaged deletion | Same uncommitted state as AC-1 |
| 4 | npm run build succeeds with zero TS errors | SATISFIED | `npm run build` completes; Vite produces `dist/` successfully | 11 pre-existing strict-mode TS errors unrelated to this task; `vite build` uses a looser check and succeeds |
| 5 | 607 tests pass, 0 fail | SATISFIED | `npx vitest run` → 45 files, 607 passed, 0 failed | Backend also clean: 1206 passed |

---

## Findings

### [CRITICAL] File deletions are not staged or committed

**File(s):** `frontend/src/dealer/handPayload.ts`, `frontend/src/dealer/handPayload.test.ts`, `frontend/src/components/HandRecordForm.tsx`, `frontend/src/components/HandRecordForm.test.tsx`
**Category:** correctness

**Problem:**
All four files have been physically deleted from the working tree, but `git status` shows them as **"Changes not staged for commit: deleted"**. The beads task was closed with a reason stating the work is done, but the deletions were never staged (`git add`) or committed. If the branch is reset, rebased, or another developer pulls, these files will reappear.

```
$ git ls-files -- "frontend/src/dealer/handPayload*" "frontend/src/components/HandRecordForm*"
frontend/src/components/HandRecordForm.test.tsx
frontend/src/components/HandRecordForm.tsx
frontend/src/dealer/handPayload.test.ts
frontend/src/dealer/handPayload.ts
```

**Suggested Fix:**
```bash
git rm frontend/src/dealer/handPayload.ts \
       frontend/src/dealer/handPayload.test.ts \
       frontend/src/components/HandRecordForm.tsx \
       frontend/src/components/HandRecordForm.test.tsx
git commit -m "T-016: remove legacy handPayload + HandRecordForm (aia-core-jjd9)"
```

**Impact:** High — the task's core deliverable (file deletion) is not persisted in version control. A `git checkout` or `git stash pop` would undo all the work.

---

### [MEDIUM] Duplicate LoadHandPayload interface definition

**File:** `frontend/src/stores/dealerStore.ts` (line 54) and `frontend/src/dealer/dealerState.ts` (line 24)
**Category:** design

**Problem:**
The `LoadHandPayload` interface is identically defined in both `dealerStore.ts` and `dealerState.ts`. This is a pre-existing duplication (not introduced by this task) but is worth noting since `handPayload.ts` is being removed and this is a natural time to consolidate payload-related types. Both definitions have identical shapes including `hand_number`, community card fields, and `player_hands` array.

**Suggested Fix:**
Define `LoadHandPayload` in one canonical location (e.g., `dealerStore.ts` since it's the Zustand store) and import it in `dealerState.ts`. This is out of scope for T-016 but should be tracked as follow-up work.

**Impact:** Low — no runtime issue; purely a maintainability concern.

---

## Positives

- **Clean separation verified**: `LoadHandPayload` (loading existing hand data for display/editing) is genuinely distinct from the deleted `assembleHandPayload` (batch submission of a new hand). The kept interface maps API response data into store state; the deleted function mapped store state into an API request. Correct decision to keep it.
- **No orphaned imports**: grep confirms zero live imports of `handPayload`, `assembleHandPayload`, `validateNoDuplicates`, or `HandRecordForm` in any file on disk.
- **Retained utilities confirmed used**: `cardUtils.ts` is imported by `HandEditForm.tsx` and its test. `createHand`/`updateHolecards` in `api/client.ts` are used by `PlayerApp`, `DataView`, `HandEditForm`, and their tests. No over-deletion.
- **Test suite fully green**: 607 frontend tests and 1206 backend tests pass with zero failures.
- **Build succeeds**: `npm run build` produces the production bundle without errors.

---

## Overall Assessment

The implementation correctly identifies and removes the legacy batch hand submission flow. The right files were deleted, the right files were kept, and there is no collateral damage to imports, tests, or build.

**However, the deletions were never committed to git.** This is a CRITICAL finding because the task's entire purpose — removing these files — is not persisted. A single `git checkout .` would undo everything. The fix is straightforward: stage the deletions and commit.

The duplicate `LoadHandPayload` definition is a pre-existing issue and should be tracked separately.

**Verdict: 1 CRITICAL finding — do NOT merge until the deletions are committed.**
