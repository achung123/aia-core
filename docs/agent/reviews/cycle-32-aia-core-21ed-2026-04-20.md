**Loop Context:** Cycle 32 | Task: aia-core-21ed (T-030) | Epic: aia-core-6o9t | Date: 2026-04-20

# Code Review Report — table-3d-revamp-010

**Date:** 2026-04-20
**Target:** `frontend/src/dealer/TableView3D.tsx`, `frontend/test/dealer/TableView3D.test.tsx`, `frontend/src/dealer/ActiveHandDashboard.tsx`, `frontend/test/dealer/ActiveHandDashboard.test.tsx`
**Reviewer:** Scott (automated, loop-review cycle 32)

**Task:** T-030 — Migrate `TableView3D.tsx` (dealer embed) to `<PokerTable>`
**Beads ID:** aia-core-21ed

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 1 |
| MEDIUM | 3 |
| LOW | 4 |
| **Total Findings** | **8** |

Gates: 1808 → 1813 (+5), all pass. Lint clean on touched files.

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| AC-1 | `<PokerTable>` with `viewer.policy='spectator'`, `equityOverlay={true}`, no `<SessionReplayShell>` | SATISFIED | `TableView3D.tsx:79-84`; tests `threads viewer.policy="spectator"`, `threads equityOverlay={true}`, `every <PokerTable> render receives…` | Every-render assertions cover re-renders during polling. |
| AC-2 | Cycle-11 behavioral guarantees (canvas renders, updates on new hand, no leak on mount/unmount) | SATISFIED | tests `renders a canvas element on mount`, `scene updates when a new hand arrives via polling`, `does not leak / throw on repeated mount/unmount cycles` | 3× mount/unmount loop is a light stand-in for WebGL-leak coverage; acceptable given `<Canvas>` is mocked. |
| AC-3 | Container sizing `min(400px, 50vh)` preserved | SATISFIED | `TableView3D.tsx:91-95`; test `applies min(400px, 50vh) height and width:100%` | Height is verified via source-text regex because happy-dom drops `min()`; see L-1. |
| AC-4 | `externalResize:true` semantics preserved — `<PokerCanvas>` does NOT attach its own window resize listener; sizing follows container `ResizeObserver` | PARTIAL | test `does not import createPokerScene (source-level check)` also asserts no `new ResizeObserver` and no `window.addEventListener('resize')` in this file | Source-only negative assertions. Spec wording presupposed the imperative path; in the declarative composition, R3F's `<Canvas>` owns resize via its own internal `ResizeObserver`, so behaviour is preserved — but no runtime test confirms it. See L-2. |
| AC-5 | Equity badges, action highlights, and theme all active | PARTIAL | equity: SATISFIED via `fires /equity fetch once table state is available` + `EquityBadge overlay actually receives enabled=true…`; action highlights: implicit via `<PokerTable>` + `tableState` (not explicitly asserted at this layer); **theme: NOT wired** | T-030 spec call-site (tasks.md L629-636) threads `theme={theme}` and `qualityTier={qualityTier}`; implementation omits both. Cycle 14 `MED-1` explicitly required route-level `useTableStore(s => s.theme)` wiring inside T-030. See H-1. |

---

## Findings

### [HIGH] H-1 — `theme` and `qualityTier` props not forwarded to `<PokerTable>` (AC-5 partial)

**File:** `frontend/src/dealer/TableView3D.tsx`
**Line(s):** 79-85
**Category:** correctness / spec-conformance

**Problem:**
T-030's call-site example (tasks.md L629-636) and AC-5 both require `theme` to be "active" in the dealer embed. Cycle 14's MED-1 (tasks.md L1621, L1654) explicitly assigned the route-level `useTableStore(s => s.theme)` wiring to **T-030 and T-031**. The current implementation renders:

```tsx
<PokerTable
  state={tableState}
  viewer={SPECTATOR_VIEWER}
  equityOverlay={true}
  cameraPreset="topDown"
/>
```

— with neither `theme` nor `qualityTier`. `<PokerTable>` defaults `qualityTier` to `'medium'` and treats `theme` as optional, so nothing breaks, but:
1. AC-5 is only PARTIAL (theme toggle in `<TableSettingsPanel>` has no effect on the dealer embed).
2. The follow-on T-031 / T-032 migrations will copy this pattern and perpetuate the gap.
3. There is no test asserting that `props.theme` / `props.qualityTier` reach `<PokerTable>`.

**Suggested Fix:**
Either (a) thread the store slice now —
```tsx
import { useTableStore } from '<slice-path>';
const theme = useTableStore((s) => s.theme);
const qualityTier = useTableStore((s) => s.qualityTier);
// …
<PokerTable … theme={theme} qualityTier={qualityTier} />
```
and add two prop-threading assertions to the AC-5 block —
or (b) explicitly defer to a follow-up task and amend tasks.md T-030 AC-5 so the spec and the implementation agree. Do not leave the gap silent.

**Impact:** Dealer-side theme/quality selections appear active in the settings panel but are ignored by the embedded 3D view; hard to diagnose from the UI. Also blocks Cycle 14 MED-1 from being closed.

---

### [MEDIUM] M-1 — `<PokerTable>` test double re-implements equity-guard wiring (drift risk)

**File:** `frontend/test/dealer/TableView3D.test.tsx`
**Line(s):** 56-78
**Category:** design / test fragility

**Problem:**
The `PokerTable` mock records props AND directly invokes `resolveEquityOverlay(...)` + `useEquityQuery(...)` inside the mock's render body. This is a deliberate Cycle 27 L-3 carry-forward — it proves that *if* `<PokerTable>` composes the guard + hook, then the viewer/overlay props threaded by `TableView3D` will cause `fetchEquity` to fire. Strengths:

- The test fails if `TableView3D` ever threads `viewer.policy='player'` (regression net for AC-5 and for the equity-policy enforcement contract).
- It exercises real `resolveEquityOverlay` + the real `useEquityQuery` wrapper against a mocked `fetchEquity`, so the guard + query-gate layers are covered at the consumer boundary.

Weaknesses:

- The mock re-implements `<PokerTable>`'s internal wiring contract. If the real `<PokerTable>` later adds additional gating (e.g. hole-card count — already hinted at in `equityGuard.ts` L11 and `EquityBadge.tsx` L12), the mock will continue to fire `fetchEquity` unconditionally and the test will pass even as production behaviour diverges.
- The assertion `fetchEquity.mock.calls[0]).toEqual([42, 1])` pins the current `fetchEquity(gameId, handNumber)` signature; any future signature change to `fetchEquity` propagates noise into this consumer test.

**Suggested Fix:**
Keep the test, but (a) add a short comment in the mock marking it "mirror of `<PokerTable>`'s equity composition — update both together", and (b) open a follow-up to collapse this consumer-level net into a single integration test that renders the real `<PokerTable>` against jsdom/WebGL-stub once T-033 removes the imperative path. Track as discovered-from aia-core-21ed.

**Impact:** Medium maintenance risk; no current correctness failure.

---

### [MEDIUM] M-2 — Redundant `/equity` fetches: parent effect + embedded `useEquityQuery`

**File:** `frontend/src/dealer/ActiveHandDashboard.tsx`
**Line(s):** 97-105
**Category:** design / efficiency

**Problem:**
When `viewMode === '3d'` the parent runs:

```tsx
useEffect(() => {
  if (viewMode !== '3d' || !gameId || !handNumber) { setEquityEntries([]); return; }
  fetchEquity(gameId, handNumber).then(...).catch(...);
}, [viewMode, gameId, handNumber, community]);
```

Independently, the embedded `<TableView3D>` → `<PokerTable>` → `useEquityQuery` also fetches `/equity` on the same (gameId, handNumber, streetIndex). Both calls target the same backend; they do not share react-query cache because the parent uses a raw `fetch`.

- Duplicate network traffic (2× every street change).
- The parent's effect depends on `community` (five scalar board slots) and will refire on *any* board tweak even when the street hasn't advanced — more aggressive than the embedded `streetIndex`-keyed query.
- The parent's equity-row UI below the canvas duplicates information already shown by the in-scene `<EquityBadges>`.

**Suggested Fix:**
Either (a) drop the parent effect + equity-row and rely on the in-scene badges (cleanest, aligned with T-033 "delete dead helpers"), or (b) migrate the parent to `useEquityQuery` so both call sites share the react-query cache. Track as a discovered-from follow-up scoped to T-033.

**Impact:** Wasted requests (2×/street) during dealer recording; not a correctness bug.

---

### [MEDIUM] M-3 — Data drift between parent `hands3D` (one-shot) and embedded `TableView3D` (10s poll)

**File:** `frontend/src/dealer/ActiveHandDashboard.tsx`
**Line(s):** 87, 334
**Category:** correctness

**Problem:**
`hands3D` is fetched exactly once, when the user clicks **3D View**:

```tsx
onClick={() => { setViewMode('3d'); fetchHands(gameId).then(setHands3D).catch(() => {}); }}
```

It is the only input to the sibling `<StreetScrubber>` (board cards for the "last hand"). Meanwhile `<TableView3D>` internally polls hands every 10 s via `useHandPolling` and auto-advances to the latest hand. As soon as a new hand is dealt:

- `<TableView3D>` updates to hand N+1.
- The sibling `<StreetScrubber>` continues to show hand N's board (stale) until the user toggles away and back.

This is a user-visible divergence inside the same panel. There is no "double polling" concern (parent is not on an interval), but the lack of polling in the parent is precisely the drift source.

**Suggested Fix:**
Have `<TableView3D>` surface its `hands`/`latestHand` upwards (render prop / onHandsChange callback / shared store slice) so the sibling `<StreetScrubber>` tracks the same data, or move both consumers onto a shared `useHandPolling` hoisted to the parent. Either resolves the drift and removes the duplicate `fetchHands` call. File as discovered-from aia-core-21ed.

**Impact:** User-visible staleness of the sibling scrubber while the 3D view shows the newer hand.

---

### [LOW] L-1 — AC-3 height assertion uses source-file regex (fragile)

**File:** `frontend/test/dealer/TableView3D.test.tsx`
**Line(s):** 267-277
**Category:** test fragility

**Problem:** Since happy-dom strips `min(...)`, the test reads `src/dealer/TableView3D.tsx` and regex-matches `/height:\s*'min\(400px,\s*50vh\)'/`. Any reformat to double quotes, template literals, or a named constant (e.g. `const HEIGHT = 'min(400px, 50vh)'`) will break the test even though the behaviour is unchanged. The in-code comment acknowledges the workaround.

**Suggested Fix:** Either (a) extract the height into an exported constant (`export const CONTAINER_HEIGHT = 'min(400px, 50vh)'`) and import it in the test, or (b) switch this suite to `jsdom` with CSS parsing enabled for this one test. Minor — accept as-is for now, revisit if the file needs churn.

---

### [LOW] L-2 — AC-4 is verified only at source-string level

**File:** `frontend/test/dealer/TableView3D.test.tsx`
**Line(s):** 283-295
**Category:** test coverage

**Problem:** The test reads `TableView3D.tsx` and asserts that the strings `createPokerScene`, `new ResizeObserver`, and `window.addEventListener('resize'` do not appear. It does not runtime-verify that no resize listener is attached (e.g. a spy on `window.addEventListener`). The spec's "follows container's `ResizeObserver`" clause is not directly tested — R3F's `<Canvas>` is mocked away.

**Suggested Fix:** Add a runtime spy (`const addSpy = vi.spyOn(window, 'addEventListener'); renderView(); expect(addSpy.mock.calls.filter(c => c[0] === 'resize')).toHaveLength(0);`). Low priority — the declarative path structurally cannot attach such a listener from `TableView3D` itself.

---

### [LOW] L-3 — `gameId === 0` not excluded from `useQuery({ enabled })`

**File:** `frontend/src/dealer/TableView3D.tsx`
**Line(s):** 41
**Category:** correctness (edge case)

**Problem:** `enabled: gameId !== null && gameId !== undefined` — since `gameId` is typed `number`, neither `null` nor `undefined` is reachable without type cheating, and `0` would pass through. If callers ever sneak a `0`, `fetchGame(0)` fires and 404s. Not reachable today — `ActiveHandDashboard` is the only caller and always forwards a real `gameId`.

**Suggested Fix:** Simplify to `enabled: Number.isFinite(gameId) && gameId > 0`, or drop the guard (type system already forbids null/undefined).

---

### [LOW] L-4 — `useTableStateQuery` referenced by spec but not present in codebase

**File:** `specs/table-3d-revamp-010/tasks.md` L627 (and T-031/T-032 task descriptions)
**Category:** spec / planning

**Problem:** The user's review brief flagged an "unused `useTableStateQuery` stub". I searched `frontend/**` (including ignored files) and found **no such symbol** in the codebase. The T-030 spec ("wrap with `useTableStateQuery({ gameId, handNumber, viewer, equityOverlay: true, live: true })`") describes a helper that was never built; Hank composed the equivalent behaviour from `useHandPolling` + `useQuery(['game', …])` + `handsToTableState` directly, which is a valid inlining.

**Suggested Fix:** Either create the helper before T-031 / T-032 (both reference it in their task bodies, and duplicating the inline composition three times will accrue drift), or amend the task descriptions to drop the `useTableStateQuery` reference and document the current composition pattern as canonical. Route to Jean via a discovered-from link on aia-core-21ed.

---

## Positives

- `SPECTATOR_VIEWER` declared at module scope — stable identity benefits `handsToTableState`'s memo key and `<PokerTable>`'s downstream memos. No React-identity pitfalls: the object is frozen-in-practice (never mutated) and shared across all renders and mount/unmount cycles.
- `<PokerTable>`-prop test suite asserts spectator policy and `equityOverlay=true` on **every** recorded render — a strong regression net against future polling changes that could toggle viewer mid-session.
- `useHandPolling` is delegated to identically to the player-POV route (`pages/TableView.tsx`) — good symmetry.
- The `initial-load advance` effect correctly guards `latest !== scrubIndex` to avoid set-state loops.
- Lint clean on touched files despite the pre-existing repo lint debt.

---

## Overall Assessment

T-030 is **substantially correct**. ACs 1–3 are cleanly SATISFIED with strong test coverage. The imperative `createPokerScene` path is gone from the dealer embed, unblocking T-033. The one meaningful gap is **AC-5's "theme active" clause** (H-1) — neither `theme` nor `qualityTier` is forwarded, so Cycle 14 MED-1 carries forward into T-031 / T-032 unresolved. The three MEDIUMs are pre-existing architectural redundancies exposed (not caused) by this migration: parent/child double-fetching of equity, one-shot-vs-polling hand data, and a test double that mirrors production wiring. All three are appropriate discovered-from follow-ups rather than blockers for T-030.

**Recommendation:** Address H-1 before closing — either wire theme/qualityTier (~10 LOC + 2 assertions) or amend the spec and explicitly file the deferral. M-1/M-2/M-3 → file as discovered-from, land during T-033 cleanup. L-1…L-4 → roll forward.

