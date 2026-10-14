# Code Review Report — aia-core / table-3d-revamp-010

**Date:** 2026-04-21
**Cycle:** 46
**Target:** T-033 — Delete `pokerScene.ts`, its tests, and dead helpers
**Reviewer:** Scott (automated, loop-review)

**Task:** T-033 — Delete `pokerScene.ts`, its tests, and dead helpers
**Beads ID:** aia-core-wohq

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH     | 1 |
| MEDIUM   | 1 |
| LOW      | 2 |
| **Total Findings** | **4** |

**Outcome:** Phase B blocked on pre-check — no files deleted, no prod changes. Full frontend suite still green at 1970/1970. Task remains `in_progress` (claimed by achung80); not closed.

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| AC-1 | `frontend/src/scenes/pokerScene.ts` removed | NOT SATISFIED | File still present; deletion gated on H-1 | — |
| AC-2 | `frontend/test/scenes/pokerScene.test.ts` removed | NOT SATISFIED | File still present; deletion gated on H-1 | — |
| AC-3 | `grep -r "pokerScene\|createPokerScene" frontend/src frontend/test` returns no matches | NOT SATISFIED | Live importer at [frontend/src/dealer/DealerPreview.tsx](frontend/src/dealer/DealerPreview.tsx#L2) + [#L116](frontend/src/dealer/DealerPreview.tsx#L116); plus doc/comment refs in [frontend/README.md](frontend/README.md#L148-L168), [frontend/src/scenes3d/components/tableLayout.ts](frontend/src/scenes3d/components/tableLayout.ts#L7), [frontend/src/scenes3d/components/Table.tsx](frontend/src/scenes3d/components/Table.tsx#L29), [frontend/src/scenes3d/components/CardAtlas.ts](frontend/src/scenes3d/components/CardAtlas.ts#L261) | Live-code hit is the blocker; comments are benign |
| AC-4 | Each scene helper deleted only if grep confirms zero external refs | NOT SATISFIED | Helpers each retain own sibling test as only importer (expected — deleted together) **but** `tableGeometry.ts` / `cards.ts` still named-dropped from `scenes3d/` comments (benign). Blocker is AC-3's live importer, not helpers | — |
| AC-5 | Full frontend suite passes | N/A (no change) | `vitest run` → 1970/1970 green as baseline | No delta — nothing deleted |
| AC-6 | Backend suite sanity green | N/A (no change) | Not run — no backend touched | Out of scope for this cycle; unchanged |

---

## Findings

### H-1 — Live importer of `pokerScene.ts` blocks T-033 deletion

- **Severity:** HIGH
- **File:** [frontend/src/dealer/DealerPreview.tsx](frontend/src/dealer/DealerPreview.tsx#L2)
- **Description:** `DealerPreview.tsx` imports `createPokerScene` from `../scenes/pokerScene.ts` at line 2 and invokes it at [line 116](frontend/src/dealer/DealerPreview.tsx#L116) inside an `useEffect` that mounts the imperative scene on canvas expand. It also imports `calculateEquity` from `../poker/evaluator` at [line 3](frontend/src/dealer/DealerPreview.tsx#L3) / used at [line 87](frontend/src/dealer/DealerPreview.tsx#L87). This module is not listed as migrated in any closed task (T-030 covered `TableView3D.tsx`, T-031 covered `views/PlaybackView.tsx`, T-032 covered `pages/TableView.tsx`). Deleting `pokerScene.ts` / helpers / `calculateEquity` now would break the `DealerPreview.tsx` import graph and its 9-test suite ([frontend/test/dealer/DealerPreview.test.tsx](frontend/test/dealer/DealerPreview.test.tsx)).
- **Impact:** AC-3 cannot return zero matches while this importer lives. The T-033 acceptance criteria are unsatisfiable as written.
- **Recommended fix:** File a new beads task (discovered-from aia-core-wohq) to either (a) migrate `DealerPreview.tsx` to the declarative `<PokerTable>` + `<EquityBadges>` stack (matching the T-030/T-031/T-032 pattern) or (b) delete `DealerPreview.tsx` + its test if TableView3D has fully superseded it (grep shows zero `src/` importers — it appears orphaned at the app boundary). Only then re-open T-033. Do **not** re-migrate as part of this task per the caller contract.

### M-1 — Orphaned consumer suggests dead-code path, not a spec gap

- **Severity:** MEDIUM
- **File:** [frontend/src/dealer/DealerPreview.tsx](frontend/src/dealer/DealerPreview.tsx)
- **Description:** `grep -r "DealerPreview" frontend/src` returns only the self-definition — no `src/` module imports `DealerPreview`. Only the sibling test file renders it. Combined with the T-030 dealer-embed migration having landed via `TableView3D.tsx` + the declarative `<PokerTable>`, `DealerPreview.tsx` appears to be an orphaned legacy surface kept alive purely by its own test. This means H-1's blocker is almost certainly a **tree-shakable dead module**, not a missing migration — but Jean's tasks.md does not explicitly call this out, so the T-033 pre-check correctly refuses to delete.
- **Recommended fix:** Route to Jean to decide: "delete DealerPreview + test" vs "migrate to <PokerTable>". Either resolution unblocks T-033. Add as a discovered-from task against aia-core-wohq.

### L-1 — Stale doc references to deleted-in-spirit modules

- **Severity:** LOW
- **Files:** [frontend/README.md](frontend/README.md#L148-L168), [frontend/src/scenes3d/components/tableLayout.ts](frontend/src/scenes3d/components/tableLayout.ts#L7), [frontend/src/scenes3d/components/Table.tsx](frontend/src/scenes3d/components/Table.tsx#L29), [frontend/src/scenes3d/components/CardAtlas.ts](frontend/src/scenes3d/components/CardAtlas.ts#L261)
- **Description:** README documents `scenes/table.js`, `scenes/tableGeometry.js`, `scenes/cards.js`, `scenes/holeCards.js`, `scenes/communityCards.js`, `scenes/chipStacks.js` as live architecture. Three `scenes3d/` source files carry comments that cite `scenes/tableGeometry.ts` / `scenes/cards.ts` as their port origin. These will become dangling once T-033 lands.
- **Recommended fix:** Fold into T-034 (docs) plus a single-line comment sweep in the three `scenes3d/` files. Non-blocking.

### L-2 — Sibling test files exercise only about-to-be-deleted surfaces

- **Severity:** LOW
- **Files:** [frontend/test/scenes/tableGeometry.test.ts](frontend/test/scenes/tableGeometry.test.ts), [frontend/test/scenes/chipStacks.test.ts](frontend/test/scenes/chipStacks.test.ts), [frontend/test/scenes/holeCards.test.ts](frontend/test/scenes/holeCards.test.ts), [frontend/test/scenes/communityCards.test.ts](frontend/test/scenes/communityCards.test.ts), [frontend/test/scenes/seatCamera.test.ts](frontend/test/scenes/seatCamera.test.ts), [frontend/test/scenes/showdown.test.ts](frontend/test/scenes/showdown.test.ts), [frontend/test/scenes/cards.test.ts](frontend/test/scenes/cards.test.ts), [frontend/test/scenes/table.test.ts](frontend/test/scenes/table.test.ts)
- **Description:** Each helper listed in T-033 has a sibling test file in `frontend/test/scenes/`. These tests are the only importers of the helpers (modulo cross-imports like `table.test.ts` → `seatCamera.ts`). All will be deleted alongside the helpers. Confirming the bundle of "source + test" is self-contained so that deletion is atomic.
- **Recommended fix:** None — informational; these get swept out with the helpers in the follow-up T-033 run. Included here for Hank's checklist.

---

## Pre-Check Verification

| Pre-check | Result |
|---|---|
| `grep -r "pokerScene" frontend/src --include=*.tsx --include=*.ts` | 5 hits in `src/scenes/pokerScene.ts` (self) + **4 hits in `src/dealer/DealerPreview.tsx`** (external, live) |
| `grep -r "createPokerScene\|updatePokerScene" frontend/src` | 1 hit in `pokerScene.ts` self-def + **2 hits in `DealerPreview.tsx`** (import + call site) |
| `grep -r "calculateEquity" frontend/src` | Self-def in `poker/evaluator.ts` (L122) + **2 live-code hits in `DealerPreview.tsx`** (L3 import, L87 call); ESLint rule `no-equity-in-player.js` references the name as a guard token (benign) |

**Verdict:** Pre-check failed on importer presence; Phase B halted per caller contract ("If any importers remain, STOP and report — do not delete live code").

---

## Test Results

- Frontend suite: **1970 passed / 1970 total** (baseline, no change)
- Lint delta: **0** (no files edited)
- Backend suite: not run (scope unchanged; no backend touch)

---

## Positives

- `DealerPreview.tsx` is the single live importer — no diffuse cleanup required; one migration/delete decision unblocks the entire T-033 deletion set.
- Helper files and their tests form a clean deletion bundle: each helper has exactly one sibling test and zero non-self importers (modulo `table.test.ts` → `seatCamera.ts`, which is internal to the deletion set).
- Declarative migration is otherwise complete: `TableView3D.tsx`, `views/PlaybackView.tsx`, and `pages/TableView.tsx` all compose `<PokerTable>` end-to-end.

---

## Summary

T-033 is structurally correct but **cannot land today**. One orphaned-looking module (`DealerPreview.tsx`) retains a direct import of `createPokerScene` and an indirect one of `calculateEquity`. The caller contract forbids migrating consumers inside this task, so Phase B was halted with zero file changes. Suggested next step: route H-1 / M-1 to Jean for a migrate-vs-delete call on `DealerPreview.tsx`, file the resulting work as a beads task with `discovered-from: aia-core-wohq`, then re-open T-033 after that lands. L-1 + L-2 are non-blocking carry-forwards consistent with the Anna-contract tasks.md ledger pattern.

**Recommended close reason (when eventually closed):** do NOT close aia-core-wohq this cycle. Leave in `in_progress` pending the DealerPreview decision. If Jean approves delete-path for DealerPreview, re-run T-033 and close with a single combined deletion commit.
