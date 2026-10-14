# Scott — Loop Code Review

- **Cycle:** 18
- **Epic:** `aia-core-6o9t` (table-3d-revamp-010)
- **Task:** `aia-core-i9s6` — T-015 "Zustand theme slice + settings panel UI"
- **Story:** S-2.6
- **Date:** 2026-04-18
- **Reviewer:** Scott (Cyclops)
- **Target files:**
  - [frontend/src/scenes3d/state/tableStore.ts](frontend/src/scenes3d/state/tableStore.ts)
  - [frontend/src/scenes3d/components/TableSettingsPanel.tsx](frontend/src/scenes3d/components/TableSettingsPanel.tsx)
  - [frontend/src/scenes3d/index.ts](frontend/src/scenes3d/index.ts#L35-L55)
  - [frontend/test/scenes3d/tableStore.test.ts](frontend/test/scenes3d/tableStore.test.ts)
  - [frontend/test/scenes3d/TableSettingsPanel.test.tsx](frontend/test/scenes3d/TableSettingsPanel.test.tsx)

---

## Summary

**Verdict: APPROVE CLOSE.** Zero CRITICAL, zero HIGH.

T-015 ships a clean, minimal theme slice with `persist` middleware, a DOM-overlay settings panel with correct a11y semantics, and 17 focused tests (suite 1592/1592). Three ACs are directly observable in-code-and-tests; AC 4 (mounted in dealer embed + playback routes) is legitimately blocked by T-030 and T-031 — both list T-015 as an explicit dependency. The deferral is the same structural pattern already accepted for the Cycle 14 toolbar (M4), not a new gap.

Two architectural observations worth tracking as MEDIUM follow-ups (plan-vs-impl drift on "subscribe from `<PokerTable>`"; missing `partialize`/`migrate` plan for future slices). Neither blocks close.

**Findings:** 0 CRITICAL · 0 HIGH · 3 MEDIUM · 4 LOW

---

## Acceptance-Criteria Mapping

| AC | Requirement | Evidence | Status |
|---|---|---|---|
| 1 | Three felt colors + two card backs + dark/light mode ship initially | `FELT_COLORS` (3), `CARD_BACKS` (2), `THEME_MODES=['dark','light']` at [tableStore.ts#L29-L47](frontend/src/scenes3d/state/tableStore.ts#L29-L47); asserted by `tableStore.test.ts` "ships exactly 3 felt colors…" | **MET** |
| 2 | Selection persists across reload | `persist` middleware with `name: 'aia-table-3d'` + `createJSONStorage(() => localStorage)` at [tableStore.ts#L74-L90](frontend/src/scenes3d/state/tableStore.ts#L74-L90); asserted by "persists theme to localStorage under the documented key" reading wrapped `{state,version}` envelope | **MET** |
| 3 | Theme change applies without remounting the canvas | `<TableSettingsPanel>` subscribes via Zustand selectors ([TableSettingsPanel.tsx#L37-L38](frontend/src/scenes3d/components/TableSettingsPanel.tsx#L37-L38)); "subscribers are notified without reconstructing the store" + "re-renders in response to external store changes" tests confirm subscribe-based update path | **MET (by proxy — see M2)** |
| 4 | Panel accessible from dealer embed + full-page playback routes | Component is exported via [index.ts#L35](frontend/src/scenes3d/index.ts#L35) but not yet mounted in any route; T-030 + T-031 both list T-015 as an explicit dep | **DEFERRED to T-030/T-031** |

AC 4 deferral is documented in the task table (tasks.md L46–47) and is consistent with the already-accepted deferral pattern for `<CameraPresetToolbar>` in Cycle 14.

---

## Findings

### CRITICAL
_None._

### HIGH
_None._

### MEDIUM

#### M1 — Plan-vs-impl drift: `<PokerTable>` no longer "subscribes to theme and passes values down"

- **Where:** [PokerTable.tsx#L198](frontend/src/scenes3d/PokerTable.tsx#L198), [plan.md § State Shape](specs/table-3d-revamp-010/plan.md#L594)
- **Observation:** T-015 task description says: _"`<PokerTable>` subscribes to theme and passes values down."_ The implementation instead keeps `theme` as an external prop on `<PokerTable>`; the store is only read inside `<TableSettingsPanel>`. That means today the settings panel changes the store but **nothing in the scene graph reacts** unless a consumer wires `useTableStore(s=>s.theme)` into `<PokerTable theme={…}>` at mount.
- **Why this is actually defensible (and why it's only MEDIUM):** keeping `<PokerTable>` pure-props is the better design. It preserves identity isolation (multiple canvases, Storybook fixtures, snapshot tests), avoids cross-canvas coupling through a module-level singleton (directly answering concern (c)), and keeps SSR-hydration risk out of the scene-graph component (concern (d)). But the task text is now stale.
- **Suggested fix:** in T-030 / T-031, wire `const theme = useTableStore(s => s.theme)` inside the route shell and pass to `<PokerTable theme={theme} />`. Add an explicit note under T-030/T-031 ACs that route shells own the store→props wiring. Consider updating the T-015 task description to match ("the settings panel writes to the slice; route shells read and forward to `<PokerTable>`").
- **Severity rationale:** doc/plan drift that is visible to downstream agents but causes no runtime bug; follow-up is structural, not a fix.

#### M2 — AC 3 is verified by subscribe-count proxy, not by canvas re-render

- **Where:** [tableStore.test.ts "subscribers are notified…"](frontend/test/scenes3d/tableStore.test.ts), [TableSettingsPanel.test.tsx "re-renders in response to external store changes"](frontend/test/scenes3d/TableSettingsPanel.test.tsx)
- **Observation:** the tests assert (a) Zustand emits on change and (b) the DOM panel re-renders in place. Neither mounts `<PokerCanvas>` + `<PokerTable>` and verifies the R3F scene updates `<Table feltColor>` without unmount. The actual "canvas does not remount" claim is only true transitively via M1's deferred wiring.
- **Suggested fix:** when T-030 lands, add an integration test that mounts the full route shell and asserts no remount of the R3F root (e.g., stable WebGLRenderer instance / stable `onReady` call count) across a `setTheme` call.
- **Severity rationale:** test is a fair proxy for the mechanism; but the canvas-level claim remains unverified in production paths until T-030.

#### M3 — `partialize` + `version: 1` have no written migration story

- **Where:** [tableStore.ts#L85-L89](frontend/src/scenes3d/state/tableStore.ts#L85-L89)
- **Observation:** the store reserves `version: 1` and partializes only `theme`. When T-021 adds `qualityTier` / `manualOverride` (and T-023b adds `replay` subset) the partialize shape will change. Zustand's default merge behavior will correctly fill missing keys from initial state, so **adding** slices is safe without a `migrate` function — but renaming/reshaping the `theme` object (e.g., `feltColor: string` → `feltColor: FeltColorId`) would silently ship broken state to existing users' localStorage. No `migrate(persistedState, version) => …` function, no written policy, no upgrade test.
- **Suggested fix:** add a 2-line comment under `version: 1` stating the contract ("bump and add `migrate: …` whenever the *shape* of `theme` changes; additive slice inclusion via partialize is compatible without a bump"). File a P3 follow-up to add a `migrate` scaffold + round-trip test the first time `partialize` is expanded (likely T-021).
- **Severity rationale:** no current-user breakage risk, but a latent footgun at the next shape change.

### LOW

- **L1 — Module-level singleton store & StrictMode:** `create()` is called once at module eval time, so React 18 StrictMode's double-mount does not double-construct the store; `useTableStore` reads consistent state. Worth a 1-line doc comment noting the singleton is intentional for cross-canvas user prefs (addresses concern (c)). ([tableStore.ts#L74](frontend/src/scenes3d/state/tableStore.ts#L74))
- **L2 — SSR hydration not currently a risk:** `createJSONStorage(() => localStorage)` is invoked lazily inside the factory; on a hypothetical SSR server render it would throw on first read unless guarded. Not consumed in SSR today (Vite SPA), but worth a `typeof window !== 'undefined'` guard before the epic reaches any SSR surface. Filing as LOW follow-up — not P1.
- **L3 — Test-harness `act()` wrapping:** the `act(() => useTableStore.getState().setTheme(...))` in `TableSettingsPanel.test.tsx` "re-renders in response to external store changes" is correct React 18+ testing hygiene (external-to-React update), not a reconciler correctness concern. No action.
- **L4 — `TABLE_STORE_PERSIST_KEY` is exported but not re-exported from `scenes3d/index.ts`:** it's only reachable via the deep path. Minor — add to the public barrel export so consumers (and the eventual migration tooling) don't reach past the module boundary. ([index.ts#L37-L55](frontend/src/scenes3d/index.ts#L37))

---

## Convention Checks

- ✅ Imports at top; no inline `getattr`-equivalent dynamic lookups.
- ✅ Ruff/eslint clean (verified scoped run in terminal — 0 warnings).
- ✅ Test filenames mirror source (`tableStore.test.ts`, `TableSettingsPanel.test.tsx`).
- ✅ `data-testid` + `aria-*` pattern matches the Cycle 14 toolbar.
- ✅ Pure-component convention: store stays outside the R3F scene graph (see M1 — this is a *good* deviation from the task text).
- ✅ 44×44 tap targets honored on all three radiogroups.
- ✅ `role="region"` + `aria-label` + `role="radiogroup"` + `aria-labelledby` satisfy AC 1 a11y requirements.

---

## Security

- ✅ No untrusted input reaches the DOM attributes beyond static option ids/labels.
- ✅ `persist` writes only `{theme}` — no session tokens, no PII, no game state.
- ✅ localStorage key is namespaced (`aia-table-3d`) so theme state cannot collide with auth/session keys.

---

## Recommendation

**APPROVE close of `aia-core-i9s6`.** Log M1/M2/M3 + L1–L4 as Cycle 18 ledger entries in `specs/table-3d-revamp-010/tasks.md`. M1 should be surfaced in the T-030/T-031 task descriptions before those are claimed, so Hank wires the store→prop read in the route shell rather than re-deriving.
