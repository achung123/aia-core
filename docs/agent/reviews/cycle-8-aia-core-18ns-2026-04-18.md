# Code Review Report — table-3d-revamp-010

**Date:** 2026-04-18
**Cycle:** 8
**Target:** T-007 — `<ChipStack>` with shared `InstancedMesh`
**Reviewer:** Scott (automated, loop-review)

**Task:** T-007 — Implement `<ChipStack>` with shared `InstancedMesh`
**Beads ID:** aia-core-18ns
**Epic:** table-3d-revamp-010
**Story Ref:** S-1.4

Files under review:
- [frontend/src/scenes3d/components/ChipInstances.tsx](frontend/src/scenes3d/components/ChipInstances.tsx)
- [frontend/src/scenes3d/components/ChipStack.tsx](frontend/src/scenes3d/components/ChipStack.tsx)
- [frontend/test/scenes3d/ChipStack.test.tsx](frontend/test/scenes3d/ChipStack.test.tsx)

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 4 |
| LOW | 5 |
| **Total Findings** | **9** |

Full suite: 1361/1361 pass; scoped lint clean; all four ACs satisfied.

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | `<ChipInstances>` allocates 4 `InstancedMesh` objects with a capacity budget | SATISFIED | [ChipInstances.tsx L149-L164](frontend/src/scenes3d/components/ChipInstances.tsx#L149-L164); test "allocates exactly 4 InstancedMesh objects" | `ChipMeshPool` creates one `InstancedMesh(geo, mat, capacity)` per denom in `DENOMINATIONS` |
| 2 | `<ChipStack amount position>` decomposes `x` into denominations using existing chip constants and writes matrices | SATISFIED | [ChipInstances.tsx L58-L83](frontend/src/scenes3d/components/ChipInstances.tsx#L58-L83) and [L247-L285](frontend/src/scenes3d/components/ChipInstances.tsx#L247-L285); test "decomposes amount and writes matrices into each denomination mesh" | `chipCountsFor` is pure and tested; `flush()` calls `pool.writeMatrix` per chip |
| 3 | Updating one stack's amount does not reallocate the mesh | SATISFIED | [ChipInstances.tsx L222-L223](frontend/src/scenes3d/components/ChipInstances.tsx#L222-L223); test "changing a stack amount updates count without recreating the mesh" and "keeps the same InstancedMesh instances across many prop changes" | Test explicitly asserts object-identity (`toBe`) preservation |
| 4 | Draw-call count stays constant (4) regardless of `<ChipStack>` count | SATISFIED | Four `<primitive>` children rendered by `<ChipInstances>` ([ChipInstances.tsx L305-L311](frontend/src/scenes3d/components/ChipInstances.tsx#L305-L311)); test "draw-call count stays at 4 regardless of the number of <ChipStack> instances" | Meshes created once in `ChipMeshPool` ctor; stacks only write matrices |

---

## Findings

### [MEDIUM] Silent overflow past per-denom cap for large amounts

**File:** `frontend/src/scenes3d/components/ChipInstances.tsx`
**Line(s):** 58-83
**Category:** correctness

**Problem:**
`chipCountsFor(amount, cap)` greedily consumes largest-first with each denom capped at `cap`. The remainder after all denoms are exhausted is silently dropped. The maximum displayable value at `cap=20` is `20 * (1.00 + 0.50 + 0.25 + 0.10) = $37.00`. Any amount beyond that renders as $37 worth of chips with no warning, test, or telemetry. Amounts like `$100` pot totals (realistic for this project) will visually display as the 20/20/20/20 ceiling.

**Code:**
```ts
for (let i = DENOMINATIONS.length - 1; i >= 0; i--) {
  const { name, value } = DENOMINATIONS[i];
  const cents = Math.round(value * 100);
  if (cents <= 0) continue;
  const n = Math.min(Math.floor(remaining / cents), cap);
  counts[name] = n;
  remaining -= n * cents;
}
return counts;
```

**Suggested Fix:**
Either (a) allow the smallest denom to "overflow" its cap to absorb the remainder so the displayed stack always represents the real amount, or (b) detect `remaining > 0` at the end and log a one-time `console.warn` in dev mode with the lost value. Add a test that covers `amount=50, cap=20` asserting the visible total equals the real amount (or exercises the overflow contract explicitly).

**Impact:** Pots and large stacks render as under-valued chip piles with no indication to the user or developer. Not a correctness bug relative to T-007 ACs, but a behavioral gap for S-1.4 "amount → chip stack" intent that will surface as soon as T-009/T-011 start feeding realistic pot amounts.

---

### [MEDIUM] StrictMode double-mount disposes GPU buffers mid-lifecycle

**File:** `frontend/src/scenes3d/components/ChipInstances.tsx`
**Line(s):** 230-235
**Category:** correctness

**Problem:**
The app runs under `<StrictMode>` ([frontend/src/main.tsx L13](frontend/src/main.tsx#L13)). In dev, Strict intentionally runs `mount → cleanup → mount` on every mount. `useState(() => new ChipMeshPool(capacity))` preserves the same pool across the fake remount, but the disposal `useLayoutEffect` (L230-L235) fires its cleanup between the two mount phases and calls `pool.dispose()` on the live pool. After the fake remount the same (now-disposed) pool is used again. Three.js recovers because `dispose()` only dispatches a release event and the CPU-side `instanceMatrix.array` persists, so buffers re-upload on the next render — but this is fragile, wastes one GPU upload cycle per HMR/Strict cycle, and masks a real ordering bug.

**Code:**
```ts
const [pool] = useState(() => new ChipMeshPool(capacity));

useLayoutEffect(() => {
  return () => {
    pool.dispose();
  };
}, [pool]);
```

**Suggested Fix:**
Bind the pool's lifetime to a ref plus a one-shot disposal on true unmount (e.g. use `useEffect` with a `didUnmount` sentinel, or construct the pool inside the `useLayoutEffect` so its creation and disposal are paired). Alternatively, make `ChipMeshPool.dispose()` idempotent and lazily re-allocate geometry/materials if they've been disposed. Add a test that mounts under Strict-semantics (render twice with an intermediate cleanup) and asserts the meshes are still usable.

**Impact:** No visible bug in happy-dom (no WebGL). In dev, HMR/Strict will produce one extra GPU re-upload per remount. In a future change that makes `ChipMeshPool.dispose()` release more aggressively (e.g. nulls references), this becomes a hard crash.

---

### [MEDIUM] O(N²) flush on cascading mount/update

**File:** `frontend/src/scenes3d/components/ChipInstances.tsx`
**Line(s):** 288-304
**Category:** design / performance

**Problem:**
Each `register`/`update`/`unregister` call synchronously invokes `flush()`, which iterates every registered stack and rewrites every matrix. When `<PokerTable>` mounts N stacks, `<ChipStack>` fires two `useLayoutEffect` hooks per mount (one register + one update — see the "Double flush on mount" finding below), producing roughly `2N` flushes each doing `O(N * chips_per_stack)` work, i.e. `O(N²)` per top-level render. At N=10 (9 seats + pot) with ~20 chips per stack that's ~4000 matrix writes on a single render; it is fine today but will become noticeable during animations (T-011/T-012) that mutate many stacks per frame.

**Suggested Fix:**
Debounce `flush()` to a microtask or R3F frame boundary — set a `dirty` flag in the registry methods and run one flush per tick via `queueMicrotask` or R3F's `useFrame`. Preserve synchronous flush only for the unmount path where visual lag would be noticeable.

**Impact:** Current scale (≤10 stacks) is fine. Becomes a real cost when T-011 starts mutating `committedThisStreet` each frame for the slide animation.

---

### [MEDIUM] `yIndex` advances on capacity overflow, producing floating chips

**File:** `frontend/src/scenes3d/components/ChipInstances.tsx`
**Line(s):** 266-273
**Category:** correctness

**Problem:**
Inside `flush()`, when `slot >= pool.capacity` the chip is silently dropped but `yIndex++` still runs. A subsequent chip of a different denom within the same stack therefore sits at a higher `y` than it should, creating a visible floating-chip gap. The overflow is also silent — no dev warning.

**Code:**
```ts
if (slot >= pool.capacity) {
  yIndex++;
  continue;
}
```

**Suggested Fix:**
Either `continue` without incrementing `yIndex` (so dropped chips don't leave vertical gaps), or `break` out of the entire stack loop when any denom exhausts the pool budget. Emit a one-time `console.warn` in dev when this branch is hit.

**Impact:** Only triggers when total chip count across all stacks exceeds 200 per denom — unlikely at current scale but a latent visual bug.

---

### [LOW] Double flush on mount (register + update)

**File:** `frontend/src/scenes3d/components/ChipStack.tsx`
**Line(s):** 44-60
**Category:** design

**Problem:**
`<ChipStack>` has two separate `useLayoutEffect` hooks — one that registers on mount with `[registry, id]` deps, and one that updates on every prop change. Both run on initial mount, producing `register(id, props)` immediately followed by `update(id, props)` with identical values. Each invokes `flush()`, doubling mount-time work.

**Suggested Fix:**
Collapse into a single effect with deps `[registry, id, amount, px, py, pz, cap]` that calls `registry.register(id, …)` on first run and uses a ref-tracked `mounted` flag to switch to `update` thereafter, plus the cleanup that calls `unregister`. Or have `register` itself be idempotent and drop the separate update effect (since register/update have identical bodies).

**Impact:** Minor — extra O(N) matrix write at mount. No observable defect.

---

### [LOW] Module-level mutable state leaks across `<ChipInstances>` instances

**File:** `frontend/src/scenes3d/components/ChipInstances.tsx`
**Line(s):** 108, 114
**Category:** design

**Problem:**
`_latestMeshes` and `_stackIdCounter` are module-scoped. Mounting two `<ChipInstances>` in one app (e.g. a picture-in-picture spectator view, or during navigation transitions) causes the test probe to point at the most recently mounted one, and stack IDs are globally unique across unrelated scenes. This is acceptable because only one `<ChipInstances>` should exist per scene today, but the pattern is fragile.

**Suggested Fix:**
Attach `_latestMeshes` to the registry object itself (e.g. `(registry as any).__probeMeshes = pool.getAllMeshes()`) and scope `__getTestProbe()` to accept a registry or resolve it via context in test helpers. Move `_stackIdCounter` into component state (`useId()` is a perfect fit — stable across renders, unique per instance).

**Impact:** Future-proofing concern; no current bug.

---

### [LOW] `__getTestProbe` exported from production bundle

**File:** `frontend/src/scenes3d/components/ChipInstances.tsx`
**Line(s):** 117-130
**Category:** design / convention

**Problem:**
`__getTestProbe` is a top-level named export alongside production APIs (`ChipInstances`, `chipCountsFor`, `DENOMINATIONS`). It ships in the production bundle and exposes internal `InstancedMesh` handles to any caller. It is acceptable as a test hook, but the double-underscore convention is only a convention, not a guard.

**Suggested Fix:**
Gate the export behind `if (import.meta.env.MODE !== 'production')` — either `export const __getTestProbe = import.meta.env.PROD ? undefined : …` or move it to a sibling `ChipInstances.__test__.ts` that imports module-local refs. Alternatively, have Vite tree-shake it via a `/* @__PURE__ */` hint or `__DEV__` gate.

**Impact:** A few hundred bytes of dead code in the prod bundle and a small attack surface (internal scene state reachable from the browser console). Not a security hole on its own.

---

### [LOW] `cap` default duplicated in two files

**File:** `frontend/src/scenes3d/components/ChipStack.tsx`
**Line(s):** 48, 58
**Category:** convention

**Problem:**
`<ChipStack>` hard-codes `cap ?? 20` in two places; `<ChipInstances>` exposes `DEFAULT_CHIP_CAP = 20` ([ChipInstances.tsx L42](frontend/src/scenes3d/components/ChipInstances.tsx#L42)) but does not export it. If the default is raised in one place, the other silently diverges.

**Suggested Fix:**
Export `DEFAULT_CHIP_CAP` from `ChipInstances.tsx` and import it in `ChipStack.tsx`, or pass the default through the registry so `<ChipStack>` doesn't need to know it.

**Impact:** Maintenance hazard only.

---

### [LOW] No-provider no-op path is silent

**File:** `frontend/src/scenes3d/components/ChipStack.tsx`
**Line(s):** 45, 55
**Category:** design

**Problem:**
When `<ChipStack>` is rendered without a `<ChipInstances>` ancestor, it silently does nothing. This is correct per the documented contract (and tested), but there is no dev-mode warning — a typo in the provider hierarchy will produce an invisible scene with no diagnostic.

**Suggested Fix:**
Add a `console.warn` in dev (`import.meta.env.DEV`) when `registry == null` on first render of a `<ChipStack>`. One warning per component instance is sufficient.

**Impact:** Debuggability; not correctness.

---

## Positives

- **Pure decomposition function in cents** — `chipCountsFor` avoids floating-point drift by converting to cents up-front; tests cover 0, whole dollars, mixed amounts, sub-denomination, and cap-respect paths.
- **Identity-preserving mesh reuse** — the test "keeps the same InstancedMesh instances across many prop changes" explicitly asserts `toBe` on the mesh references across 5 prop mutations; this nails AC 3.
- **Clean context/provider boundary** — `<ChipStack>` correctly degrades to a no-op when rendered outside `<ChipInstances>`, and the public surface (`amount`, `position`, `cap`) is minimal and matches the spec.
- **`ChipMeshPool` class boundary** — encapsulating three.js mutations inside a class sidesteps the `react-hooks/immutability` trap cleanly; the comment in the source explains why.
- **Realistic stack ordering** — largest denominations at the bottom of the visual stack matches real-world poker etiquette; tested by the position-matrix assertion.
- **Probe pattern for WebGL-free tests** — `__getTestProbe()` elegantly makes the mesh internals inspectable in happy-dom where no renderer exists; the reset method keeps tests isolated.
- **Scoped `useLayoutEffect` with scalar deps** — `px/py/pz` extracted as scalars (rather than array identity) correctly avoids spurious re-registrations when parents pass fresh `[x,y,z]` literals.

---

## Overall Assessment

T-007 is implementation-complete: all four ACs are satisfied with direct test evidence, the full frontend suite is green, and the design matches `plan.md §"Chip Instancing"` including the four-`InstancedMesh` denomination scheme, the greedy cents-based decomposition, and the scene-level provider pattern. No CRITICAL or HIGH findings.

The MEDIUM findings cluster around behavior at scale and edge cases (cap overflow, StrictMode remount, O(N²) flush, `yIndex` drift on budget exhaustion). None blocks T-007's close-out; most will be forced into focus by downstream tasks (T-009 integration, T-011 chip-slide animations, and realistic pot amounts). Recommend filing a follow-up beads issue `discovered-from:aia-core-18ns` that bundles the four MEDIUM items so they aren't lost, and proceeding to close T-007 as-is.

The LOW findings are polish — pattern hygiene around module-level state, bundle hygiene for the test probe, default duplication, and dev-mode diagnostics. Safe to defer.

**Recommendation:** Accept and close T-007. File one follow-up for the MEDIUM cluster before starting T-009.
