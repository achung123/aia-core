# Code Review — Cycle 40 — aia-core-t4dp (H-1(b) qualityTier wiring)

**Reviewer:** Scott (Cyclops)
**Date:** 2026-04-21
**Epic:** table-3d-revamp-010
**Cycle:** 40
**Target beads:** aia-core-t4dp
**Jean task reference:** T-030 AC-5 (qualityTier dimension); sibling of `aia-core-r11d` (theme dim, closed)
**Blocked-by (now resolved):** `aia-core-y39z` (T-027 quality-tier slice)

---

## Scope

Implementation under review:

| File | Change |
|---|---|
| [frontend/src/dealer/TableView3D.tsx](frontend/src/dealer/TableView3D.tsx) | Added `const qualityTier = useTableStore((s) => s.qualityTier);` selector (L45) and `qualityTier={qualityTier}` prop on `<PokerTable>` (L93). Updated the store→props comment to reflect that the T-027 slice now exists. |
| [frontend/test/dealer/TableView3D.test.tsx](frontend/test/dealer/TableView3D.test.tsx) | Extended `types` import with `QualityTier`; appended a new `describe('TableView3D — qualityTier prop threading (aia-core-t4dp)')` block with 3 tests asserting store→props wiring at `high`, `low`, and `medium`. |

Unchanged on purpose (explicitly out of scope per bug description): `<PokerTable>` render internals, `Table.tsx` / `CardAtlas.ts` inline tier literals, `<Canvas shadows>` runtime enablement.

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

Bug description ACs (verbatim from `bd show aia-core-t4dp`):

| AC # | Criterion | Status | Evidence |
|---|---|---|---|
| AC-1 | T-030 AC-5 "theme all active" fully SATISFIED for `qualityTier` dimension once `aia-core-r11d` (theme) + this bug both land. | **SATISFIED** | `TableView3D.tsx:45` reads `qualityTier` from store; `TableView3D.tsx:93` forwards to `<PokerTable>`. Paired with closed `aia-core-r11d` theme wiring (`TableView3D.tsx:44` + `theme={theme}` prop), both dimensions now flow store → dealer embed. |
| AC-2 | Cycle 32 H-1 fully resolved across both bugs. | **SATISFIED** | H-1(a) (theme) closed under `aia-core-r11d`; H-1(b) (qualityTier) satisfied here. No residual Cycle 32 H-1 fragments remain open. |
| AC-3 | Changing `qualityTier` in the store is reflected in the dealer embed's `<PokerTable>`. | **SATISFIED** | Test "threads qualityTier from useTableStore to <PokerTable>" sets `setTier('high')` pre-render and asserts `props.qualityTier === 'high'`. "reflects qualityTier changes on re-render (store → props)" pins `low`. Zustand's existing subscribe semantics (validated in `tableStore.quality.test.ts` under Cycle 39 AC-2) guarantee the selector re-fires on `setTier`. |
| AC-4 | `frontend/test/dealer/TableView3D.test.tsx` has a new assertion covering `qualityTier` wiring. | **SATISFIED** | 3 new tests added in the `aia-core-t4dp` describe block (`tests 17–19`). |
| AC-5 | Full frontend test suite green. | **SATISFIED** | 123 files / 1912 tests passing (baseline 1909 from Cycle 39 + 3 new). Lint clean on both touched files. |

---

## Test Deltas

| | Before (Cycle 39 close) | After | Delta |
|---|---|---|---|
| Total test files | 123 | 123 | 0 |
| Total tests | 1909 | 1912 | +3 |
| Failures | 0 | 0 | 0 |
| Lint errors (touched files) | 0 | 0 | 0 |
| Lint warnings (touched files) | 0 | 0 | 0 |

Red→Green verified: pre-change test run showed 3 failures in the new describe block with `Received: undefined` against the expected tier values (confirming the wiring was absent and the tests fail for the right reason).

---

## Review Checklist Results

### 1. Selector reads T-027 slice correctly

**PASS.** `useTableStore((s) => s.qualityTier)` matches the slice shape landed in Cycle 39 (`tableStore.ts:104` — `qualityTier: QualityTier`). The selector is a plain field read (no deep destructuring, no object allocation), so Zustand's default `Object.is` equality short-circuits re-renders — consistent with the sibling `theme` selector on the preceding line.

### 2. Prop threaded to `<PokerTable>`

**PASS.** `<PokerTable qualityTier={qualityTier} …>` aligns with the declared prop on `PokerTable.tsx:82` (`qualityTier?: QualityTier`). Prop ordering — `state`, `viewer`, `theme`, `qualityTier`, `equityOverlay`, `cameraPreset` — groups the two store-derived visual props (`theme`, `qualityTier`) together, matching the read-site ordering at L44–L45. Clean.

### 3. Test asserts the wiring

**PASS.** 3 assertions cover the wiring from three angles:
- `high` set, asserted on latest `PokerTable` props.
- `low` set, asserted on latest `PokerTable` props (guards against a hardcoded default slipping through).
- `medium` set, asserted across **every** `PokerTable` render call (guards against a stale initial-render prop not updating — the same pattern used by the theme and `equityOverlay` "every render" tests earlier in the file).

Each test saves/restores the prior tier via `useTableStore.getState().setTier(prevTier)`, matching the sibling theme test's reset idiom — no cross-test bleed.

### 4. No regression to theme wiring or other TableView3D behavior

**PASS.** Diff is strictly additive at the route layer:
- theme selector unchanged (L44).
- `<PokerTable>` `theme`, `viewer`, `state`, `equityOverlay`, `cameraPreset` props unchanged.
- `useHandPolling`, `useEffect` auto-advance, `handsToTableState` memo, `SPECTATOR_VIEWER` constant all untouched.
- No changes to `PokerCanvas` / `PokerTable` internals.

Full suite (1912/1912) passes — all prior TableView3D describe blocks (smoke, AC-1 theme threading, AC-2 behavioral guarantees, AC-3 container sizing, AC-4 legacy-removed, AC-5 equity overlay) stay green.

### 5. Other open qualityTier consumers that now need migration?

Cycle 38 M-2 (canvas-level `<Canvas shadows>` enablement) and Cycle 39 L-2 (`PokerTable.tsx` / `CardAtlas.ts` inline tier literals) were both flagged in prior reviews as "owner: T-038 / aia-core-t4dp". **However**, the `aia-core-t4dp` beads description (re-read this cycle via `bd show`) is narrowly scoped to 3 work items — all route-level store→props forwarding — and contains **no reference** to `PokerTable.tsx` / `CardAtlas.ts` / `<Canvas shadows>` migration. The bug's acceptance criteria are exclusively about the dealer-embed route wiring, and are all SATISFIED by the narrow change landed this cycle.

Per the bug's explicit scope, call-site migration is **NOT on the hook for this bug's AC** and is **explicitly deferred to T-038** (the tier-gating task, not yet carried by an open beads issue per Cycle 39 M-1). See M-1 below.

---

## Findings

### [MEDIUM] M-1 — Scope drift between `aia-core-t4dp` beads description and Cycle 38/39 review owner references

**File:** cross-cutting — `specs/table-3d-revamp-010/tasks.md` (Cycle 38/39 ledger rows) and beads `aia-core-t4dp` description
**Category:** design (ownership ambiguity)

**Problem:**
Prior Scott reviews routinely cite "T-038 / `aia-core-t4dp`" as the carrier for **three** related pieces of work:
1. Route-level `qualityTier` forwarding (the bug this cycle just closed — narrow scope).
2. `PokerTable.tsx` / `CardAtlas.ts` inline tier-derived literals migration (Cycle 39 L-2).
3. Canvas-level `<Canvas shadows>` conditional enablement (Cycle 38 M-2).

Re-reading `bd show aia-core-t4dp` confirms the description only covers (1). Closing this cycle without a successor beads task leaves (2) and (3) with **no open carrier** — the same silent-slip pattern Cycle 39 M-1 flagged for T-027 AC-4.

**Suggested Fix:**
Jean triage — either extend `aia-core-t4dp` post-close into a new T-038 beads task covering items (2) + (3) and the pending Cycle 39 M-1 (`TableSettingsPanel` tier dropdown), or file a fresh `T-038` bug referencing Cycle 38 M-2 + Cycle 39 L-2 + Cycle 39 M-1 as its acceptance basis. Do not re-open `aia-core-t4dp` — its narrow scope is satisfied.

**Impact:**
Without an open carrier, the runtime render path keeps the Cycle 38 tier drift (`PokerTable.tsx` L488 still hardcodes `resolution={qualityTier === 'high' ? 256 : 64}` instead of reading from `QUALITY_TIER_SETTINGS[tier]`), shadow gating remains contract-only not runtime-active, and the user-facing tier dropdown stays unshipped. Plan.md § "Quality Tiers" goals stay only half-fulfilled.

**Non-blocking for close:** Per Anna contract (MED/LOW → tasks.md only, no beads filings this cycle). `aia-core-t4dp` close reason should explicitly call this out so Logan/Jean can triage next.

---

### [LOW] L-1 — `qualityTier` selector could be colocated with `theme` in a single selector for atomicity (cosmetic)

**File:** [frontend/src/dealer/TableView3D.tsx](frontend/src/dealer/TableView3D.tsx)
**Line(s):** 44–45
**Category:** convention / design

**Problem:**
Two separate `useTableStore` calls produce two store subscriptions; a single selector returning `{ theme, qualityTier }` with a shallow-equality compare could consolidate them. This is the same pattern Zustand's own docs recommend for related fields.

**Suggested Fix:**
Not this cycle. If ever touched, use `useShallow` from `zustand/react/shallow`:
```ts
const { theme, qualityTier } = useTableStore(
  useShallow((s) => ({ theme: s.theme, qualityTier: s.qualityTier })),
);
```

**Impact:**
Zero runtime impact today — both selectors re-fire only on the relevant slice change, and `<PokerTable>` already treats prop changes cheaply (memoized internals). Current pattern matches the sibling theme selector idiom and is strictly more readable. Cosmetic only.

---

### [LOW] L-2 — New test block lacks a `mount` negative (wrong-store → wrong-prop) symmetric case

**File:** [frontend/test/dealer/TableView3D.test.tsx](frontend/test/dealer/TableView3D.test.tsx)
**Line(s):** 417–448
**Category:** test-hygiene

**Problem:**
The 3 new tests each set a tier and observe the **same** tier on the props. They do not verify the selector is actually reading from the store (vs. e.g. being hardcoded to the default). The sibling theme test uses a custom non-default object (`feltColor: '#7a1a3a'`) which is inherently non-default, so a hardcoded regression would be caught. The tier tests set `'high'`, `'low'`, `'medium'` — any of these could coincidentally equal the store's default tier on a given viewport. For happy-dom (no `window.innerWidth` heuristic), the default is typically `high`, so the `high` test is weakest.

**Suggested Fix:**
Not blocking. If tightened, add a single test that:
1. Reads `useTableStore.getState().qualityTier` as `baseline`.
2. Picks a different tier (`baseline === 'high' ? 'low' : 'high'`).
3. Asserts the prop reflects that different tier.

This would fail under a regression where the selector became `() => 'high'` or similar.

**Impact:**
Low — the 3-tier coverage already triangulates the wiring because at least two of the three fixtures differ from any given default. The `low` test in particular would catch a hardcoded-`high` regression. Defense-in-depth only.

---

## Positives

- **Minimal, surgical diff.** Exactly the 3 work items in the bug description: 1 selector, 1 prop, 3 tests. No drive-by refactors.
- **Comment updated, not deleted.** The old route-level comment referenced T-027 as a blocker; the new comment explicitly calls out both `aia-core-r11d` (theme) and `aia-core-t4dp` (qualityTier) by ID, giving future readers a traceable history of how the two halves of Cycle 32 H-1 landed.
- **Tests follow the established pattern.** The new describe block mirrors the structure of the existing AC-1 theme threading block — same mock spy, same `latestPokerTableProps()` helper, same `setTier(prevTier)` reset idiom — so a reader who understands the theme block understands this block immediately.
- **Red→Green discipline.** 3 tests failed with `expected X / Received: undefined` pre-fix, validating that the wiring was genuinely absent before the production change.
- **Zero lint / zero regression.** `eslint` clean on both touched files; full suite 1912/1912.

---

## Overall Assessment

**aia-core-t4dp is ready to close.** All 5 ACs (from the bug description) are SATISFIED. The production change is a minimal 2-line addition + comment refresh, backed by 3 targeted tests that exercise the store→props wiring across three tier values. No regressions; no lint drift; no scope creep.

**The one non-trivial issue (M-1) is a meta-finding about beads-task ownership**, not about this bug's code. Cycle 38 M-2 (canvas-shadow enablement), Cycle 39 L-2 (`PokerTable.tsx` / `CardAtlas.ts` call-site literal migration), and Cycle 39 M-1 (`TableSettingsPanel` tier dropdown) were all referenced as "T-038 / `aia-core-t4dp`" in prior review ledgers, but the `aia-core-t4dp` description only covers the route-level forwarding that just landed. Closing this bug without a fresh T-038 beads issue risks silent slippage. This is a Jean/Logan triage item, not a blocker for close.

**Recommended close reason:** T-030 AC-5 "theme all active" now fully SATISFIED across both dimensions (theme via `aia-core-r11d`, qualityTier via this bug). Cycle 32 H-1 fully resolved. Scope was deliberately narrow (3 work items from the beads description) — call-site migration (Cycle 38 M-2, Cycle 39 L-2) and `TableSettingsPanel` tier dropdown (Cycle 39 M-1) require a fresh T-038 beads task; flagged in Cycle 40 M-1 for Jean triage.

**Carry-forward targets (Cycle 40):**
- **M-1** — T-038 carrier gap (Cycle 38 M-2 + Cycle 39 L-2 + Cycle 39 M-1 all cluster here; `aia-core-t4dp` only covered the route-level slice). Needs Jean triage post-close.
- **L-1** — `useShallow` consolidation of theme + qualityTier selectors in `TableView3D.tsx` (cosmetic, cluster with next dealer-embed touch).
- **L-2** — stronger negative-case assertion in the new `aia-core-t4dp` describe block (test-hygiene, optional).

**Still open carry-forward:** All prior Cycle 32–39 items as documented in the respective cycle ledgers — no changes this cycle.

No beads filings this cycle per Anna contract (all findings MEDIUM / LOW). M-1 is the substantive Jean/Logan triage hand-off.

