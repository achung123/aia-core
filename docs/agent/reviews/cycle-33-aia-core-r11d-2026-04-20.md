# Code Review Report — table-3d-revamp-010

**Date:** 2026-04-20
**Cycle:** 33
**Target:** `frontend/src/dealer/TableView3D.tsx` + `frontend/test/dealer/TableView3D.test.tsx` (theme-only forwarding)
**Reviewer:** Scott (automated, `loop-review`)

**Task:** T-030 (AC-5, theme dimension) — Forward `theme` from `TableView3D` route to `<PokerTable>`
**Beads ID:** aia-core-r11d
**Parent cycle:** [Cycle 32 — aia-core-21ed](../../../specs/table-3d-revamp-010/tasks.md) — H-1(a) unblocked half

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 1 |
| LOW | 2 |
| **Total Findings** | **3** |

Gates: suite 1813 → 1814 (+1), all pass. Lint clean on both touched files.

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| T-030 AC-5 (theme dimension) | Theme from `useTableStore` reaches `<PokerTable>` in dealer embed | **SATISFIED** | [frontend/src/dealer/TableView3D.tsx#L46](../../../frontend/src/dealer/TableView3D.tsx#L46) selector; [#L87](../../../frontend/src/dealer/TableView3D.tsx#L87) prop forward; test [frontend/test/dealer/TableView3D.test.tsx#L248-L263](../../../frontend/test/dealer/TableView3D.test.tsx#L248) | Cycle 32 H-1(a) closed |
| T-030 AC-5 (qualityTier dimension) | qualityTier forwarded | **DEFERRED** | `useTableStore` has no `qualityTier` slice yet (T-027 `aia-core-y39z`, blocked) | Tracked as H-1(b) `aia-core-t4dp` — out of scope for r11d |
| Cycle 32 AC-1 (viewer/equityOverlay/state props) | No regression | **SATISFIED** | existing `pokerTablePropsSpy` suites untouched; new test sits inside same `describe` and passes | `viewer`, `equityOverlay`, `cameraPreset`, `state` still threaded as before |
| Cycle 32 AC-2 (behavioral guarantees) | No regression | **SATISFIED** | canvas render / polling advance / mount-unmount loop tests unchanged and green | |
| Cycle 32 AC-3 (container sizing) | No regression | **SATISFIED** | container style unchanged (`width:100%`, `min(400px, 50vh)` height literal) | |

---

## Findings

### [MEDIUM] M-1 — Theme test mutates shared `useTableStore` without symmetric setup/teardown

**File:** `frontend/test/dealer/TableView3D.test.tsx`
**Line(s):** ~248–263 (the new "threads theme from useTableStore" test)
**Category:** test isolation / drift risk

**Problem:**
The new test calls `useTableStore.getState().setTheme(customTheme)` before `renderView()` and then inline-resets at the end of the test body with `useTableStore.getState().setTheme(DEFAULT_THEME)`. `useTableStore` is a persisted Zustand singleton shared across every test in this file (and across test files that import it). If any assertion in the test throws before the reset line executes, the store is left with `customTheme` for the remainder of the run — including for the other `describe('TableView3D — <PokerTable> prop threading (AC-1)')` tests that follow in the same block, which today only assert `viewer`/`equityOverlay`/`state` but could flake in the future on theme-sensitive assertions or on snapshot-style comparisons. The existing `beforeEach` (`vi.clearAllMocks(); cleanup();`) does not touch Zustand state.

**Suggested Fix:**
Wrap the mutation in a try/finally, or move the reset into an `afterEach` scoped to this describe block:

```ts
afterEach(() => {
  useTableStore.getState().setTheme(DEFAULT_THEME);
});
```

This also protects against persisted state leaking into sibling test files under Vitest's default single-worker reuse.

**Impact:** Low today (no other test reads theme), but this pattern becomes a latent flake source as soon as more theme-aware assertions are added downstream (e.g., T-031 / T-033).

---

### [LOW] L-1 — No negative test for `qualityTier` prop

**File:** `frontend/test/dealer/TableView3D.test.tsx`
**Line(s):** prop-threading `describe`
**Category:** test depth

**Problem:**
The H-1 split (r11d = theme only, t4dp = qualityTier blocked on T-027) is documented in prod via the comment at [TableView3D.tsx#L41-L45](../../../frontend/src/dealer/TableView3D.tsx#L41). However, no test asserts that `qualityTier` is **not** threaded today. If someone adds `qualityTier={qualityTier}` before the store slice lands in T-027, the prop would silently be `undefined` at runtime and the split contract would drift.

**Suggested Fix:**
Add a one-line `expect(latestPokerTableProps()).not.toHaveProperty('qualityTier')` assertion — or a comment-only note if the team prefers not to lock absence.

**Impact:** Protects the T-027 ordering contract; very cheap insurance.

---

### [LOW] L-2 — Store `TableTheme` shape narrower than `PokerTableTheme` (no `railColor`)

**File:** `frontend/src/dealer/TableView3D.tsx` + `frontend/src/scenes3d/state/tableStore.ts`
**Line(s):** store L49-L61; forward at `TableView3D.tsx#L87`
**Category:** spec drift / design

**Problem:**
`<PokerTable>`'s `PokerTableTheme` has an optional `railColor?: string` field ([PokerTable.tsx#L64](../../../frontend/src/scenes3d/PokerTable.tsx#L64)) which is used by the inner `<Table feltColor={theme?.feltColor} railColor={theme?.railColor} />` render ([#L350](../../../frontend/src/scenes3d/PokerTable.tsx#L350)). The store's `TableTheme` has no `railColor` field, so the dealer embed will always render with `theme.railColor === undefined`. The T-015 tasks.md call-site lists only `(mode, feltColor, cardBack)` for the slice, so this is consistent with spec — but it means `<PokerTable>`'s rail-color prop is dead for every consumer that wires through the store.

**Suggested Fix:**
Route back to Jean to decide: either (a) extend the store slice with `railColor` (tracked as a separate task), or (b) drop `railColor` from `PokerTableTheme` and derive the rail color from the felt color / mode inside `<Table>`. Not blocking r11d.

**Impact:** Cosmetic for now; matters if rail customization is ever user-facing.

---

## Positives

- Comment block at [TableView3D.tsx#L41-L45](../../../frontend/src/dealer/TableView3D.tsx#L41) precisely documents both the wiring *and* the intentional omission of `qualityTier` with a pointer to T-027 — future readers will not re-report H-1(b) as a bug.
- Selector `useTableStore((s) => s.theme)` uses the correct per-slice shape — `setTheme`'s partial-merge spread (`{...s.theme, ...partial}`) creates a new reference on change, so React subscribes correctly; no stale-closure risk.
- The new prop-threading test cleanly follows the established Cycle 32 pattern (custom value set → render → `latestPokerTableProps()` assert) with no test double changes — minimal surface area for regressions.
- Type compatibility between the store's `TableTheme` and `<PokerTable>`'s `PokerTableTheme` is structurally sound (store's required `mode/feltColor/cardBack` satisfy PokerTable's optional fields; `CardBackId` literal type narrows to `string` cleanly).

---

## Overall Assessment

Surgical, on-scope fix for the Cycle 32 H-1(a) carry-forward. Theme now flows store → route → `<PokerTable>` in the dealer embed, and T-030 AC-5 (theme dimension) is **SATISFIED**. The H-1(b) qualityTier half is correctly deferred to `aia-core-t4dp` pending T-027. No regression to Cycle 32 AC-1/2/3. Cycle 32 AC-4 (no runtime `resize` spy) remains open as **L-2** carry-forward — not a regression introduced by this cycle.

Zero CRITICAL, zero HIGH. **M-1** (test-state isolation) is the only finding worth proactive cleanup; **L-1 / L-2** are roll-forward tracking items. Safe for Logan to close `aia-core-r11d`.
