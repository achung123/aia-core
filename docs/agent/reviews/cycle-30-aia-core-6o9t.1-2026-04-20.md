# Code Review Report — table-3d-revamp-010

**Loop Context:** Cycle 30 | Task: aia-core-6o9t.1 | Epic: aia-core-6o9t | Date: 2026-04-20

**Date:** 2026-04-20
**Target:** `frontend/src/scenes3d/components/{SeatHighlight,ChipStack,ChipInstances}.tsx`, `frontend/src/scenes3d/PokerTable.tsx`, `frontend/test/scenes3d/PokerTable.seatHighlights.test.tsx`
**Reviewer:** Scott (automated)

**Task:** H-1 (Cycle 29 carry-forward) — Dim folded seat's chip stack (T-018 AC-1 completion)
**Beads ID:** aia-core-6o9t.1

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 3 |
| LOW | 3 |
| **Total Findings** | **6** |

Verdict: H-1 is genuinely closed. Folded + committed seats now route through a dedicated dimmed `InstancedMesh` pool with material opacity = `FOLDED_CHIP_STACK_OPACITY` (0.3); non-folded seats and the pot remain opaque. The Cycle 29 M-1(b) probe gap (scene-level visibility into committed-chip opacity) is closed by the new `getDimmedMeshes()` probe plus three scene-level tests. No regressions detected to T-018 AC 2/3/4 or to T-007 (`<ChipInstances>` capacity model) or T-011 (chip-slide / `<FlyingChipSlug>`).

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| AC-1 | Folded seat dims pad + nameplate + **chip stack** | SATISFIED | `PokerTable.seatHighlights.test.tsx` — three new tests (dim routing, no over-dim, pot unaffected); probe asserts `dimmed.Black.material.opacity ≈ 0.3` | Upgraded from PARTIAL (Cycle 29) to SATISFIED. |
| AC-2 | Bet/raise glow on nameplate auto-clears 1500ms later | SATISFIED (no change) | `PokerTable.seatHighlights.test.tsx` bet-glow suite unchanged and passing | Not in scope for this bug fix; no regression. |
| AC-3 | Exactly one turn pulse ring; follows `currentSeat` | SATISFIED (no change) | Turn-pulse tests unchanged and passing | Not in scope; no regression. |
| AC-4 | `prefers-reduced-motion` disables animation (state-only coloring retained) | SATISFIED (no change) | Reduced-motion test unchanged and passing | Not in scope; no regression. |

---

## Findings

### [MEDIUM] M-1 — Dual-pool `<ChipInstances>` cannot represent mixed dim levels concurrently

**File:** `frontend/src/scenes3d/components/ChipInstances.tsx`
**Line(s):** ~305–330 (`flush` closure — `dimmedMaterialOpacity` computation)
**Category:** design

**Problem:**
The dimmed pool shares exactly one `MeshStandardMaterial` per denomination across every live dimmed `<ChipStack>`. When multiple stacks register with different `opacity` values, `flush()` takes the **minimum** (`if (stack.opacity < dimmedMaterialOpacity) ...`) and applies it to every chip in the dim pool — i.e., a seat that wanted `opacity=0.7` will render at `0.3` if any other seat is at `0.3`. Hank's own comment calls this out: *"today every caller passes the same `FOLDED_CHIP_STACK_OPACITY`, so this is effectively a constant; the `min` is defence-in-depth for future callers."* That's accurate, but the architecture (one material per denom per pool) forecloses the "future caller" case the comment reassures about. It also means any future feature (e.g., "showdown losers dim 0.5, folded dim 0.3" — a realistic S-3.x follow-up) cannot be layered on without either (a) a third pool, (b) refactoring the dim pool to per-stack materials, or (c) batching by opacity bucket.

**Suggested Fix:**
Not required for this bug. Track as a design note or a P2 follow-up beads issue. If/when a second dim consumer lands, prefer bucketing stacks by rounded opacity into N pools over per-stack materials (keeps draw-call bounds predictable). Alternatively, narrow `ChipStackProps.opacity` to `0.3 | 1` (a union) to make the API surface match the implementation's actual capability until a multi-level dim is truly needed.

**Impact:** Medium — today it is correct and race-free (every register/update/unregister re-runs the full `flush` over all stacks, no stale state). Future mixed-dim requirements will silently clamp to the darkest level, which would be a regression class of bug rather than an obvious failure.

---

### [MEDIUM] M-2 — Module-level probe globals leak across `<ChipInstances>` unmount

**File:** `frontend/src/scenes3d/components/ChipInstances.tsx`
**Line(s):** ~262–278 (`useLayoutEffect(() => { _latestMeshes = ...; _latestDimmedMeshes = ...; }, [pool, dimmedPool])`)
**Category:** correctness

**Problem:**
`_latestMeshes` and `_latestDimmedMeshes` are assigned on mount but are **never** nulled on unmount. The sibling `_latestStacks` has a correct cleanup path (`return () => { if (_latestStacks === stacks) _latestStacks = null; }`). After `<ChipInstances>` unmounts, `pool.dispose()` runs, yet the probe still returns the disposed meshes until someone calls `__getTestProbe().reset()`. A test that queries the probe after unmount without explicit reset would read disposed GPU resources and get misleading counts / opacity.

The existing test suite masks this by calling `__getChipInstancesProbe().reset()` in `afterEach`, but the inconsistency between `_latestStacks` (cleaned up) and `_latestMeshes`/`_latestDimmedMeshes` (not cleaned up) is a footgun for future test authors.

**Suggested Fix:**
Mirror the `_latestStacks` cleanup pattern:

```ts
useLayoutEffect(() => {
  const meshes = pool.getAllMeshes();
  const dimmedMeshes = dimmedPool.getAllMeshes();
  _latestMeshes = meshes;
  _latestDimmedMeshes = dimmedMeshes;
  return () => {
    if (_latestMeshes === meshes) _latestMeshes = null;
    if (_latestDimmedMeshes === dimmedMeshes) _latestDimmedMeshes = null;
  };
}, [pool, dimmedPool]);
```

**Impact:** Medium — not observable under the current test suite, but a latent source of confusing failures in tests that mount/unmount multiple `<ChipInstances>` or skip the `reset()` teardown.

---

### [MEDIUM] M-3 — Test probe (`__getTestProbe`, `getDimmedMeshes`) not gated to DEV/test builds

**File:** `frontend/src/scenes3d/components/ChipInstances.tsx`
**Line(s):** ~118–162 (export of `__getTestProbe`)
**Category:** design

**Problem:**
The prompt explicitly asked whether the new `getDimmedMeshes` probe is "appropriately gated to DEV/test only." Answer: **no.** The entire `__getTestProbe` (including the pre-existing `getMeshes` / `getStacks` and the new `getDimmedMeshes`) is exported unconditionally; `_latestMeshes` / `_latestDimmedMeshes` / `_latestStacks` module globals are assigned in production builds too. There is no `import.meta.env.DEV` or `process.env.NODE_ENV !== 'production'` guard. The double-underscore convention signals intent but does not prevent any code path from reading or calling it.

This matches the baseline set by the pre-existing probe, so it's a **consistency** issue rather than a **new** leak introduced by Cycle 30 — but since the review prompt flagged it explicitly, calling it out here.

**Suggested Fix:**
Either (a) wrap the probe body in `if (import.meta.env.DEV)` at export time (returns a stub in prod), or (b) explicitly accept the current posture by documenting that `__getTestProbe` is a whitelisted test API and tree-shaking / minification make the memory footprint negligible. Option (b) is the lower-effort choice and aligns with how the rest of the codebase handles test hooks. If adopted, add a one-line comment above the export stating "intentionally exposed in all builds; footprint is four refs and two maps."

**Impact:** Medium — no security exposure (it only reads live scene state, already reachable by anyone in the same process), but discoverable via the public bundle. A third-party consumer could monkey-patch against it.

---

### [LOW] L-1 — `ChipStack` JSDoc claims `(0, 1]` clamping but code only guards `> 0`

**File:** `frontend/src/scenes3d/components/ChipStack.tsx`
**Line(s):** ~14–22 (JSDoc), ~55 (`safeOpacity = Number.isFinite(opacity) && opacity > 0 ? opacity : 1`)
**Category:** convention

**Problem:**
JSDoc says *"Clamped to `(0, 1]` at the registry — values `<= 0` are treated as `1` (no dim)."* The implementation only enforces the lower bound; `opacity=1.5` passes through unchanged. Downstream behavior is still correct (any value `>= 1` causes `isDim = stack.opacity < 1` to be `false`, so the stack routes to the opaque pool and the oversized value is never read again), but the comment overstates the guarantee.

**Suggested Fix:**
Either actually clamp — `Math.min(1, Math.max(…, opacity))` — or change the JSDoc to *"values `<= 0` or non-finite are treated as `1`; values `> 1` are permitted and route to the opaque pool."*

**Impact:** Low — cosmetic / documentation fidelity only; no behavioral bug.

---

### [LOW] L-2 — Always-mounted dimmed pool adds 4 `InstancedMesh` scene-graph nodes even when nothing is folded

**File:** `frontend/src/scenes3d/components/ChipInstances.tsx`
**Line(s):** ~430–440 (second `DENOMINATIONS.map` rendering `<primitive object={dimmedPool.getMesh(…)}>`)
**Category:** design (performance)

**Problem:**
Cycle 30 doubles the chip `InstancedMesh` count from 4 → 8 always-mounted, even when no seat has folded. Three.js skips the draw call for `InstancedMesh` with `count = 0` (`WebGLRenderer` short-circuits on zero-count), so GPU cost is negligible. Scene-graph overhead is 4 extra `Object3D` traversals per frame — well within the performance budget.

Given the acceptance criteria (AC 1 completion), this is acceptable. Lazy-mounting the dimmed pool (only render its primitives when `anyDimmed` is true) would save four traversals per frame at the cost of material-state bookkeeping on toggle. Not worth the complexity today.

**Suggested Fix:**
None required. Consider a `useMemo`'d `hasAnyDimmed` derivation from the registry to conditionally render the `<primitive>` block if profile data ever flags the traversal as hot.

**Impact:** Low — no measurable performance regression; draw-call count remains effectively 4 when no seat is folded.

---

### [LOW] L-3 — `dimmedPool.setOpacity` skipped when last dim stack unregisters

**File:** `frontend/src/scenes3d/components/ChipInstances.tsx`
**Line(s):** ~345–350 (`if (anyDimmed) { dimmedPool.setOpacity(...) }`)
**Category:** design

**Problem:**
When the final folded seat transitions out of folded (or unmounts), `anyDimmed` is `false` and `setOpacity` is not called. The shared material retains whatever opacity the previous dim cycle set. This is harmless because `count = 0` → nothing draws, and the next dim cycle's `setOpacity` call is idempotent (updates only if different). But leaving "dead" state on a material is minor slop.

**Suggested Fix:**
Optional: reset to 1 when `!anyDimmed` (costs one `needsUpdate = true` per transition to all-unfolded). Not worth a change on its own.

**Impact:** Low — cosmetic state-hygiene issue only.

---

## Positives

- **Single source of truth for the dim constant.** `FOLDED_CHIP_STACK_OPACITY = FOLDED_PAD_OPACITY` is exported from `SeatHighlight.tsx` and consumed at the single call site in `PokerTable.tsx`. The JSDoc explains *why* they're coupled (chip stack is visually a sibling of the pad in the same local frame).
- **Pot stack correctly opaque.** Pot `<ChipStack>` passes no `opacity` prop — defaults to `1` — so pot is structurally incapable of ending up in the dim pool regardless of seat state. The third new test guards this invariant with "all-seats-folded + pot > 0".
- **Flush is race-free.** Every `register` / `update` / `unregister` re-iterates the entire stack registry and re-derives `anyDimmed` + `dimmedMaterialOpacity` from scratch. No incremental state to get stale.
- **Defensive clamping in `<ChipStack>`.** Non-finite / non-positive opacities are normalized to `1` before reaching the registry.
- **Test rigor matches Cycle 27 standard.** Three scene-level tests: the positive case (dim routing + opacity), a no-over-dim negative (non-folded never land in dim pool), and a pot-invariant (pot never dims). This is exactly the probe-backed coverage Cycle 29 flagged as missing.
- **No regression to chip-slide.** `FlyingChipSlug` continues to pass `<ChipStack amount position>` with no opacity prop — defaults to opaque pool. T-011 behavior untouched.

---

## Overall Assessment

**H-1 is closed.** The fix is minimal, localized, and correct: one new exported constant, one new `opacity?` prop on `<ChipStack>`, a sibling dimmed `InstancedMesh` pool in `<ChipInstances>`, and a single-line prop pass-through in `<PokerTable>`. The new test suite closes both the original AC-1 gap (chip-stack dim observable at the scene level) and the Cycle 29 M-1(b) probe gap (no way to inspect committed-chip opacity without matrix decoding).

Cycle 30 adds three MED and three LOW findings — all tolerable for an orchestration loop close-out. **None blocks closing `aia-core-6o9t.1`.** The strongest of the MED findings (M-1, mixed-dim-level limitation) should become a tracked follow-up if any future S-3.x story calls for a second dim consumer (e.g., showdown losers). M-2 (probe global cleanup) is trivial to fix and would tighten test isolation — worth bundling into whatever touches `ChipInstances` next.

**Recommendation:** Close the beads task (Anna to execute). Optionally file a P3 follow-up ("`<ChipInstances>` dim pool: per-stack opacity support") to track M-1 if the roadmap anticipates mixed-dim consumers.
