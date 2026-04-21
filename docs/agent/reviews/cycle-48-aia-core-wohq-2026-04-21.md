# Code Review Report — table-3d-revamp-010

**Date:** 2026-04-21
**Target:** `aia-core-wohq` — T-033 Delete `pokerScene.ts`, its tests, and dead helpers
**Reviewer:** Scott (automated, loop-review Cycle 48)

**Task:** T-033 — Delete `pokerScene.ts`, its tests, and dead helpers
**Beads ID:** aia-core-wohq
**Cycle:** 48 (retry after Cycle 46 HALT; Cycle 47 cleared the DealerPreview pre-gate via deletion)

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 2 |
| LOW | 2 |
| **Total Findings** | **4** |

**Disposition:** Clean bill of health for T-033. All deletions in the T-033 spec list are complete, zero live importers remain, full frontend suite is green (1844/1844), lint delta on touched files is 0. The four findings are non-blocking follow-ups / documentation carry-forwards.

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | `frontend/src/scenes/pokerScene.ts` removed | SATISFIED | `ls frontend/src/scenes` → dir no longer exists; file absent from repo | Entire `scenes/` directory removed (all 9 files) |
| 2 | `frontend/test/scenes/pokerScene.test.ts` removed | SATISFIED | `ls frontend/test/scenes` → dir no longer exists | Entire `test/scenes/` directory removed (all 9 test files) |
| 3 | `grep -r "pokerScene\|createPokerScene" frontend/src frontend/test` returns no matches | PARTIAL — by design | 0 live code refs; residual string hits are **intentional negative assertions** in `frontend/test/views/PlaybackView.test.tsx`, `frontend/test/dealer/TableView3D.test.tsx`, `frontend/test/pages/TableView.test.tsx` plus one lineage comment in `frontend/test/scenes3d/tableLayout.test.ts:54` | The surviving matches are regex literals that *prove* AC-3 holds (tests assert the strings are absent from the SUT source). Interpreted strictly the AC fails; interpreted by intent (no live importers) it is fully satisfied. Documented here, not filed to beads — cosmetic choice for T-034 to revisit if the docs update wants them pattern-obfuscated. |
| 4 | Each scene helper file deleted only if `grep -r <filename-stem>` confirms zero external references | SATISFIED | Pre-check ran for all 9 helpers; only self-file hits + historical doc-comment mentions found. All 9 helpers deleted. Doc comments in `Table.tsx:29`, `tableLayout.ts:7`, `CardAtlas.ts:261`, `tableLayout.test.ts:55` updated to past-tense lineage notes (folding in Cycle 46 L-1) | No production code imported any helper |
| 5 | Full frontend test suite passes (`cd frontend && npm test`) | SATISFIED | `npx vitest run` → **Test Files 118 passed / Tests 1844 passed**, 17.84s, 0 failures | Previous baseline 1954 → 1844 (Δ = −110 tests, expected: deleted 9 scene tests + 1 evaluator test covering ~110 cases) |
| 6 | Full backend suite still passes (sanity) | NOT APPLICABLE (unchanged) | No backend files touched; no backend code imports any deleted frontend module | Skipped per "sanity check, unchanged" |

---

## Findings

### [MEDIUM] AC-3 literal-grep tension with negative-assertion test strings

**File:** `frontend/test/views/PlaybackView.test.tsx` (L14-15, L357, L361-363), `frontend/test/dealer/TableView3D.test.tsx` (L14, L359, L365-366), `frontend/test/pages/TableView.test.tsx` (L280, L286)
**Line(s):** See above
**Category:** convention

**Problem:**
AC-3 requires `grep -r "pokerScene\|createPokerScene" frontend/src frontend/test` to return *no matches*. Three test files contain these strings as *negative assertions* (regex patterns that verify the SUT source does NOT import the legacy module). Literal interpretation of AC-3 fails; intent interpretation passes.

**Suggested Fix:**
Two options for T-034 or a follow-up:
1. Rewrite the negative assertions to use string-builder patterns that don't contain the literal keyword (e.g. `'create' + 'PokerScene'` or a const array of forbidden substrings built at runtime).
2. Amend AC-3 in `specs/table-3d-revamp-010/tasks.md` T-033 to exclude `frontend/test/**/*.test.{ts,tsx}` guards, since the guards are themselves the enforcement mechanism.

**Impact:** Cosmetic — does not affect runtime correctness or test reliability. Will re-surface any time a reviewer re-runs the literal AC-3 grep.

---

### [MEDIUM] `handCategory` / `HandRank` / `EquityResult` / `Card` types deleted with evaluator.ts — verify no downstream consumer was missed

**File:** (previously) `frontend/src/poker/evaluator.ts`
**Line(s):** n/a
**Category:** correctness

**Problem:**
The T-033 spec authorizes deleting `calculateEquity` if unreferenced but says "otherwise leave it." Phase B pre-check found zero `frontend/src/` importers of **any** exported symbol from `evaluator.ts` (`calculateEquity`, `handCategory`, `HandRank`, `EquityResult`, `Card`, `InternalCard`). Under the user's directive — "If the entire evaluator.ts is orphaned, delete the whole file" — the entire file was deleted along with its test. This deletion is wider than the strictly-literal T-033 spec phrasing.

**Code:** (deleted) `frontend/src/poker/evaluator.ts` + `frontend/test/poker/evaluator.test.ts` + empty dirs `frontend/src/poker/` and `frontend/test/poker/`

**Suggested Fix:**
Spot-check once more before the next push:
- `grep -rn "handCategory\|HandRank\|EquityResult\|InternalCard" frontend/ --include="*.ts" --include="*.tsx"` — confirmed zero residual hits during Phase B pre-check.
- If analytics-dashboard-007 or any post-T-033 work wants to re-surface category naming, restore from git history rather than re-implementing.

**Impact:** Low — build passes, types were never exported to any router, equity is now server-side only (via `fetchEquity` + `useEquityQuery`). Call out for Logan's close note so Jean knows the poker/ directory is gone in case T-034 (docs) references it.

---

### [LOW] Dealer test files still carry dangling imports / residues after vi.mock strip

**File:** `frontend/test/dealer/DealerApp.test.tsx`, `frontend/test/dealer/GameSelectorIntegration.test.tsx`
**Line(s):** N/A — whole-file context
**Category:** convention

**Problem:**
Phase B removed two `vi.mock()` blocks (`'../../src/scenes/pokerScene.ts'` and `'../../src/poker/evaluator.js'`) from each file. No downstream test assertion actually depended on those mocks' return values, but the surrounding file still carries stale imports / type references that may have been there to support the mocks. A future reader might wonder why those mocks existed.

**Suggested Fix:**
Drive-by during the next dealer-test touch: remove any `import type { EquityResult } from '.../poker/evaluator'` (none found during this review, but worth a re-grep) and add a one-line comment where the vi.mock block used to be, e.g. `// pokerScene / evaluator mocks removed in T-033 (Cycle 48)`. Not required — tests are green without it.

**Impact:** Zero runtime — purely reader-comprehension.

---

### [LOW] Stale doc/comment references to deleted scene helpers outside the 3 files already updated

**File:** `frontend/test/scenes3d/tableLayout.test.ts:54` (describe-block string "matches the legacy pokerScene seat layout"), general `docs/frontend/architecture.md` (if it mentions `pokerScene`, `tableGeometry`, etc.)
**Line(s):** See above
**Category:** convention

**Problem:**
Phase B folded in Cycle 46 L-1 by updating lineage comments in 4 files (`Table.tsx`, `tableLayout.ts`, `CardAtlas.ts`, `tableLayout.test.ts` comment at L55). But the *test description string* at L54 ("matches the legacy pokerScene seat layout for a 10-seat table") still names the now-deleted module. `docs/frontend/architecture.md` was not audited this cycle — that is explicitly T-034's scope.

**Suggested Fix:**
Defer to **T-034** (explicitly named owner of `docs/frontend/architecture.md` 3D-section rewrite). Optionally fold the test-description string update into T-034 as well to keep doc-language alignment in one place.

**Impact:** Zero runtime; style consistency only.

---

## Positives

- **Clean pre-check discipline** — Phase B ran the mandated `pokerScene` / `createPokerScene` / `updatePokerScene` / `calculateEquity` greps, plus an explicit per-helper grep for all 9 scene files, before deleting anything. Result: zero live importers, giving a defensible delete decision.
- **Dead-mock cleanup bundled in** — The two `vi.mock()` blocks for deleted modules in `DealerApp.test.tsx` and `GameSelectorIntegration.test.tsx` would have triggered vitest "cannot resolve module" errors without cleanup. Phase B caught and fixed these proactively.
- **Cycle 46 L-1 folded in (partial)** — 4 lineage doc-comments were updated to past-tense, reducing T-034's surface area.
- **Directory-level removal** — Empty `frontend/src/scenes/`, `frontend/src/poker/`, `frontend/test/scenes/`, `frontend/test/poker/` directories were `rmdir`'d, leaving the tree tidy.
- **Suite stability** — 1844/1844 green in 17.84s with zero flakes; −110 test-count delta matches the 10 deleted test files exactly (no collateral suite damage).
- **Cycle 47 carry-forward resolved** — Cycle 47 M-1 (`calculateEquity` soft orphan) is now closed by deletion of the entire `poker/evaluator.ts` module.

---

## Cycle Carry-Forward Resolution Check

| Prior Cycle | Finding | Status After Cycle 48 |
|---|---|---|
| Cycle 46 H-1 (→ aia-core-pvkr) | `DealerPreview.tsx` orphaned migration gate | RESOLVED in Cycle 47 (file deleted) — unblocked T-033 |
| Cycle 46 L-1 | Stale doc refs to `pokerScene` / scene helpers in live source | PARTIALLY RESOLVED — 4 files updated (`Table.tsx`, `tableLayout.ts`, `CardAtlas.ts`, `tableLayout.test.ts` L55 comment). `docs/frontend/architecture.md` + test-description strings deferred to **T-034** |
| Cycle 47 M-1 | `calculateEquity` soft orphan (would need T-033 decision) | RESOLVED — entire `evaluator.ts` + test deleted (zero src/ consumers) |

---

## Overall Assessment

T-033 is **implementation-complete and review-clean**. All 10 spec-listed source files and their tests are deleted; all 4 empty directories removed; 2 stale vi.mock blocks scrubbed from dealer tests; 4 lineage comments updated to past-tense. Full suite passes 1844/1844; lint delta on touched files is 0.

The two MEDIUM findings are **interpretation** issues (AC-3 literal-grep tension, wider-than-literal evaluator.ts deletion) — both are defensible readings of the spec and user-directive, and neither blocks close. The two LOW findings are cosmetic carry-forwards to T-034.

**Recommendation:** Close `aia-core-wohq` with a close reason noting the 4 findings and the T-034 deferrals. **Do NOT file any of these findings to beads** per the Anna LOW-findings-in-tasks.md contract — record all four in `specs/table-3d-revamp-010/tasks.md` Bugs/Findings ledger under "Cycle 48 — aia-core-wohq".

**Next task candidate:** T-034 (docs update) — now fully unblocked and has a natural scope extension from the Cycle 48 findings (AC-3 string-obfuscation option, `docs/frontend/architecture.md` rewrite, test-description lineage strings).
