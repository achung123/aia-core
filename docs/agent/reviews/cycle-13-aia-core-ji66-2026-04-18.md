# Code Review Report — Cycle 13

**Date:** 2026-04-18
**Cycle:** 13
**Target:** `aia-core-ji66` — P1 bug-fix: Wire deal animations into `<Card>` via `useFrame` driver
**Epic:** `aia-core-6o9t` — table-3d-revamp-010
**Reviewer:** Scott (automated, loop-review)

**Task:** T-010 (deal animation observable ACs) — bug-fix scope
**Beads ID:** `aia-core-ji66`
**Prior cycle reference:** BUG-CYCLE12-01 (docs/agent/reviews/cycle-12-aia-core-c8xh-2026-04-18.md)

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 2 |
| MEDIUM | 5 |
| LOW | 6 |
| **Total Findings** | **13** |

**Headline:** Core architecture (pure controller + R3F driver + registry) is clean and the AC-shaped unit tests pass — but two real correctness bugs slipped through because production-layout math and the cancel-on-absent policy are only exercised against synthetic stubs. Cycle 12 HIGH is **partially** remediated: primitives are now wired, but observable-on-canvas verification remains deferred.

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | Sequential flop reveal, all 3 community cards land within 500 ms | PARTIAL | [DealAnimationController.test.ts#L105-L166](frontend/test/scenes3d/DealAnimationController.test.ts#L105-L166) | Verified at controller layer using a stub `DealLayout`. Production `communityTargetPosition` never exercised (see H-2). |
| 2 | Hole-deal tween starts follow dealer-rotation order (SB-first, two passes) | PARTIAL | [DealAnimationController.test.ts#L175-L201](frontend/test/scenes3d/DealAnimationController.test.ts#L175-L201) | Asserts start order via `onTweenStart`; largely restates [`holeDealOrder` primitive coverage](frontend/src/scenes3d/animations/dealCards.ts#L106-L124). Final hole-card world Y is wrong (H-1), so "rotation order correct" is true but "card lands at correct pose" is not. |
| 3 | Reduced motion ⇒ cards teleport to target within first frame | SATISFIED | [DealAnimationController.test.ts#L212-L236](frontend/test/scenes3d/DealAnimationController.test.ts#L212-L236) | Snap-on-sync verified; further ticks confirmed no-op. |
| 4 | Rapid state toggles ⇒ no stale in-flight tweens | NOT SATISFIED | [DealAnimationController.test.ts#L247-L284](frontend/test/scenes3d/DealAnimationController.test.ts#L247-L284) | Only the hand-id change case is pinned. The intra-hand phase-progression case (hole-deal still running when flop arrives) exposes H-2 — hole tweens get cancelled instead of completing. |

---

## Findings

### [HIGH] H-1 — Hole-card animation target Y ignores seat-anchor offset (0.02 world units low)

**File:** `frontend/src/scenes3d/animations/DealAnimationDriver.tsx`
**Line(s):** 83-105 (`holeTargetPosition`)
**Category:** correctness

**Problem:**
The render path for a hole card is three nested groups:

1. `<Seat>` — translated to `[sx, 0, sz]`, Y-rotated by `phi`
2. `<group name="seat-anchor" position={[0, SEAT_PAD_THICKNESS=0.02, 0]}>`
3. `<group name="hole-card-wrap-*" position={[±HOLE_CARD_SPREAD_X, HOLE_CARD_Y=0.02, HOLE_CARD_LOCAL_Z]}>`

World Y of the rendered resting pose = `0 + 0.02 + 0.02 = 0.04`.

`holeTargetPosition`, however, computes:

```ts
const [sx, sy, sz] = computeSeatPosition(seatIndex, seatCount); // sy = 0
...
const wy = sy + ly;   // ly = HOLE_CARD_Y = 0.02  →  wy = 0.02
```

It skips the 0.02 contribution from `<seat-anchor>`. When the hole-deal tween completes, the card is left at parent-local `worldToLocal([..., 0.02, ...])` — i.e. **0.02 world units below** the community cards and the static JSX prop. The tween's static prop is overwritten by the final `obj.position.set(...)` write, so React does not "snap back".

**Code:**
```ts
// DealAnimationDriver.tsx L94-L104
const [sx, sy, sz] = computeSeatPosition(seatIndex, seatCount);
const phi = computeSeatRotationY(seatIndex, seatCount);
const lx = holeSlot === 0 ? -HOLE_CARD_SPREAD_X : HOLE_CARD_SPREAD_X;
const ly = HOLE_CARD_Y;
const lz = HOLE_CARD_LOCAL_Z;
...
const wy = sy + ly;   // ← MISSING + SEAT_PAD_THICKNESS
```

**Suggested Fix:**
Either add the seat-anchor offset explicitly:

```ts
import { SEAT_PAD_THICKNESS } from '../components/Seat';
...
const wy = sy + SEAT_PAD_THICKNESS + ly;
```

or (preferred) compose the target from the same render-time constants by factoring the seat-local→world helper into `tableLayout.ts` and using it from both `<PokerTable>` and the driver so the two cannot drift. See L-1.

**Impact:** Every hole card ends 2 cm below the felt height used everywhere else in the scene. Invisible at default camera distance but immediately visible in a seat-POV shot (T-022) or the replay scrubber (T-023). Root cause is H-2 (no integration test against production layout).

---

### [HIGH] H-2 — Cancel-on-absent-key cancels live hole tweens when the flop arrives

**File:** `frontend/src/scenes3d/animations/DealAnimationController.ts`
**Line(s):** 80-90 (cancel loop inside `sync`)
**Category:** correctness

**Problem:**
The cancel policy is "any tween whose key is absent from the **new event set** is cancelled". The new event set for a `preflop → flop` transition within the **same** hand is only `{community:H:0, community:H:1, community:H:2}` — it carries **no** hole keys (hole events are gated on `enteringPreflop`). If any hole-deal tween is still in-flight when the flop arrives, its key `hole:H:seat:slot` is not in `newKeys` → it is cancelled mid-flight, leaving the hole card stranded wherever the cancel happened in parent-local coordinates.

This is precisely the concurrent-transition scenario called out in focus (d), and AC 4's existing test does not cover it — the test only exercises a cross-hand transition, where cancelling old hand N hole keys is the correct behavior.

**Code:**
```ts
// DealAnimationController.ts L80-L88
const newKeys = new Set(events.map((e) => e.key));
for (const [key, tween] of this.active) {
  if (!newKeys.has(key)) {
    tween.cancel();
    this.active.delete(key);
  }
}
```

**Suggested Fix:**
The cancel criterion should be "key belongs to a **superseded** hand / street", not "key is absent from the latest delta". Two viable shapes:

1. **Scope cancel by handId:** only cancel keys whose `handId` segment differs from `next.handId`. Keeps concurrent intra-hand animations alive.
2. **Cancel only overlapping keys:** cancel in-flight tween `k` iff `k ∈ newKeys` (same card is being re-dealt — e.g. replay scrub). This is what AC 4's "no stale meshes" literally requires.

Option (1) matches the user-visible contract ("old hands are gone; new hand's phases layer naturally") and is the smaller change.

Add a regression test in the AC 4 suite: `prev = preflop`, sync to `flop` while `tick` is partway through the 4th hole tween; assert every `hole:*` key remains in `getActiveKeys()` and completes at its scheduled time.

**Impact:** On a fast-dealing table or during replay scrubbing, hole cards will stop moving mid-air the instant the flop state enters. Directly violates AC 4's intent ("rapid-toggle no stale meshes" — here, the toggle is the normal street progression, and we *create* a stale position rather than avoiding one).

---

### [MEDIUM] M-1 — Tautology risk: AC 2 & AC 3 tests largely restate primitive-level behavior

**File:** `frontend/test/scenes3d/DealAnimationController.test.ts`
**Line(s):** 175-201 (AC 2), 212-236 (AC 3)
**Category:** design (test)

**Problem:**
Focus (a) is real:

- **AC 2** asserts `onTweenStart` order matches the dealer-rotation computed by `holeDealOrder`. That is exactly what `dealCards.ts :: holeDealOrder` and `computeDealSequence` already guarantee (and are already pinned at the primitive layer). The controller's AC 2 contribution is "starts tweens in the order `computeDealSequence` emits them" — true by construction of a `for (const event of events)` loop. The test passes even if the controller never wrote a single position.
- **AC 3** asserts reduced-motion tweens snap. That is `createTween`'s documented behavior when `reducedMotion: true`. The controller just passes the flag through.

Neither test would fail if the driver's scene-graph wiring (`buildTarget`, registry, `worldToLocal`) silently broke — and in fact H-1 shows the wiring *is* slightly broken and both tests still pass.

**Suggested Fix:**
Add at least one integration-level test that renders a `<Canvas>`-free but R3F-compatible scene (e.g. `@react-three/test-renderer`) and asserts the live `THREE.Object3D.position` vector of a specific hole / community card converges to the production-layout target after `advanceFrames(n)`. This is the test that would have caught H-1 and is the sibling of the Canvas smoke test explicitly deferred in this fix.

**Impact:** AC-level confidence is weaker than the green test count implies. Two of the four ACs effectively retest primitives that already had tests, leaving the driver-layer behavior unpinned.

---

### [MEDIUM] M-2 — Deferred Canvas smoke test covers the exact gap Cycle 12 HIGH flagged

**File:** `frontend/src/scenes3d/animations/` (coverage gap)
**Line(s):** n/a
**Category:** design (test)

**Problem:**
BUG-CYCLE12-01 (HIGH) was: *"no consumer wires primitives into the scene graph; ACs are observably unverified on canvas."* This fix adds the consumer (✓) but the ACs are **still** only verified at the pure-controller layer with a stub `DealTarget` and a stub layout. `buildTarget`'s `worldToLocal` math, the registry's ref-callback lifecycle, and the production `holeTargetPosition` / `communityTargetPosition` helpers have **zero** automated coverage.

The justification ("happy-dom cannot acquire a GL context, so we chose a pure-controller test") is pragmatic for a raw WebGL `<Canvas>` smoke — but `@react-three/test-renderer` runs without a GL context, which is already part of this repo's stack for other scenes3d tests. The R3F-level test is available; the decision was to skip it, not that it was impossible.

**Suggested Fix:**
File a follow-up (`@logan` queue, P1, child of the epic): "Add R3F integration test for `<DealAnimationDriver>` using `@react-three/test-renderer`; assert live object positions match production layout after simulated frames." Scope:
- Mount `<PokerTable state=...>` inside a test renderer.
- Advance the clock; inspect `scene.getObjectByName('hole-card-wrap-0').position` resolved to world Y.
- Pin the AC 1 total-duration and AC 4 intra-hand non-cancellation from the scene graph.

Do **not** re-open Cycle 12 HIGH — mark it "partially remediated (wiring landed, observable pinning deferred to follow-up)" in `tasks.md`.

**Impact:** Two correctness bugs (H-1, H-2) would have been caught at write-time had this test existed. Risk is compounded for T-013 (showdown reveal) and T-023 (replay scrubber), which will consume the same driver.

---

### [MEDIUM] M-3 — StrictMode mount/cleanup/mount lifecycle for `<DealAnimationDriver>` is unpinned

**File:** `frontend/src/scenes3d/animations/DealAnimationDriver.tsx`
**Line(s):** 142-166 (`useMemo` controller + two `useEffect`s + `useFrame`)
**Category:** correctness (robustness)

**Problem:**
Cycle 10 (PokerTable `onReady`) and Cycle 11 (StrictMode regression for `onReady`) established that every top-level effect in `scenes3d/` must be verified under `<React.StrictMode>` mount → cleanup → mount. The driver has three hooks that participate in that lifecycle:

1. `useMemo(() => new DealAnimationController(...), [])` — React explicitly does **not** guarantee memo preservation across StrictMode's double-invoke. A new controller instance may appear on the second mount.
2. `useEffect(() => controller.sync(...), [controller, syncInputs])` — fires `sync` on each mount.
3. `useEffect(() => () => controller.reset(), [controller])` — cleanup resets the controller.

Tracing it through: mount 1 → sync fires hole deal → cleanup resets & cancels → mount 2 → sync fires hole deal again. Net observable: deal animation plays twice in dev. Not stranded, but on a real production state change mid-StrictMode-remount, the interaction becomes opaque. There is no regression test.

**Suggested Fix:**
Add a test analogous to [`PokerTable.test.tsx`'s StrictMode onReady pin](frontend/test/scenes3d/PokerTable.test.tsx): wrap `<DealAnimationDriver>` in `<StrictMode>` inside an R3F test renderer, sync into preflop, assert exactly-once-per-tween `onTweenStart` **after** the doubled mount settles — or, equivalently, assert `getActiveKeys().size` matches the expected hole-deal count. Fix via a `mountedRef` sentinel if needed, mirroring the Cycle 11 fix.

**Impact:** Low probability of user-facing damage, high probability of silent duplicate work per state change in dev and an eventual bug that takes a cycle to diagnose — exactly the Cycle 11 pattern.

---

### [MEDIUM] M-4 — Ref mutation during render: `reducedMotionRef.current = reducedMotion`

**File:** `frontend/src/scenes3d/animations/DealAnimationDriver.tsx`
**Line(s):** 140-141
**Category:** convention (React)

**Problem:**
```ts
const reducedMotion = useReducedMotion();
const reducedMotionRef = useRef(reducedMotion);
reducedMotionRef.current = reducedMotion;  // ← mutation during render
```

Writing to a ref during the render phase is one of the [documented React anti-patterns](https://react.dev/reference/react/useRef#caveats): under concurrent rendering a render may be discarded, but the side effect on the ref persists. For a boolean snapshot this is practically harmless, but it establishes a pattern that will cause subtle tears when new drivers copy it.

**Suggested Fix:**
Move the assignment into `useEffect`:

```ts
const reducedMotionRef = useRef(reducedMotion);
useEffect(() => { reducedMotionRef.current = reducedMotion; }, [reducedMotion]);
```

Controller's `reducedMotion: () => reducedMotionRef.current` getter keeps working unchanged.

**Impact:** Latent; concurrent-rendering regressions only. Pattern hygiene matters because three future drivers (showdown reveal, chip-movement, preset-tween) will copy this file.

---

### [MEDIUM] M-5 — Unmount-mid-tween: registry delete leaves tween live with `getTarget` forever returning `null`

**File:** `frontend/src/scenes3d/animations/DealAnimationDriver.tsx`
**Line(s):** 42-55 (`registerDealTarget` cleanup) + `DealAnimationController.ts` L95-L114 (tween construction captures target)
**Category:** correctness (edge case)

**Problem:**
`createTween` is called once per event and passes the `target` (resolved by a single `getTarget(event.key)` at sync time) into a closed `onUpdate`. If the underlying `<group ref>` unmounts during flight (e.g. a seat folds mid-street and `renderHole` flips to `false`), the ref callback clears the registry entry but:

1. The tween's `onUpdate` closure still holds the old `DealTarget` wrapper.
2. That wrapper holds a stale `THREE.Object3D` whose `parent` is now `null` (R3F detaches on unmount).
3. `parent.worldToLocal(...)` in `buildTarget.setPosition` is guarded only by `typeof parent.worldToLocal === 'function'` — when `parent === null`, the guard falls through to the `else` branch and writes a **world** position into the detached object's `position`. Invisible effect (object is detached), but when the seat re-renders, the static JSX position re-applies and the card appears at the correct resting position — so no user-visible break today.

The risk is latent: a follow-up that reuses the same Object3D instance (e.g. object pooling, which `ChipInstances` already does for chips) will re-attach an object whose `position` was last written as a world-coordinate.

**Suggested Fix:**
Guard the driver by re-resolving the target on each tick, or cancel the tween when its registry entry clears. Simplest: change the controller to resolve the target **per-frame** via `opts.getTarget(key)` inside the tween's `onUpdate`, skipping the write when `null`:

```ts
onUpdate: (v) => {
  const t = this.opts.getTarget(event.key);
  t?.setPosition(v[0], v[1], v[2]);
},
```

This adds one Map lookup per active tween per frame — negligible for ≤9 cards.

**Impact:** No current user-visible bug; will bite when object pooling lands. Worth pinning now.

---

### [LOW] L-1 — Seat-local→world math duplicated across `holeTargetPosition` and `seatCommitChipWorldPosition`

**File:** `frontend/src/scenes3d/animations/DealAnimationDriver.tsx` (L94-L104), `frontend/src/scenes3d/PokerTable.tsx` (L86-L97)
**Category:** design

Both manually apply a Y-rotation to a seat-local offset. Extract `seatLocalToWorld(seatIndex, seatCount, [lx, ly, lz])` into `tableLayout.ts` and use it from both sites; this is also the natural place to add `SEAT_PAD_THICKNESS` once for the H-1 fix.

---

### [LOW] L-2 — `DealTarget.setRotation` is defined but never called

**File:** `frontend/src/scenes3d/animations/DealAnimationController.ts` L33-L37

The controller never produces a rotation tween (`DealEvent` has no `rotation` field). Either drop the method from the interface and `buildTarget` until T-013 (showdown flip) needs it, or add a comment documenting it as reserved. Current state is dead-capability surface that test-doubles (`StubTarget`) must implement for no reason.

---

### [LOW] L-3 — `computeDealSequence`'s `layout.deckPosition` override is unused by the driver

**File:** `frontend/src/scenes3d/animations/dealCards.ts` L57-L58, L130

Only the test suite uses it (via `makeLayout` overrides that I note never actually set it). Consider whether the override pays for itself in flexibility; otherwise simplify.

---

### [LOW] L-4 — Comment drift: controller comment says "createTween has already fired onComplete above"

**File:** `frontend/src/scenes3d/animations/DealAnimationController.ts` L107-L109

The comment references `onComplete` firing before `active.set` is reached. The actual logic relies on `tween.done` being `true` for zero-duration tweens; `onComplete` does try to `this.active.delete(event.key)` but the key was never added (so the delete is a no-op). The behavior is correct; the comment phrasing implies a specific ordering that isn't quite what's happening. Rewrite as: "Zero-duration / reduced-motion tweens complete synchronously during `createTween`; `done` is already true, so skip registering in `active`."

---

### [LOW] L-5 — `sync(null, layout)` as a "prime" call is undocumented in the public API

**File:** `frontend/src/scenes3d/animations/DealAnimationController.ts` L70-L75

The contract of `sync(null, layout)` — seed the controller without firing events — is only discoverable by reading the body. The driver calls `sync(state, layout)` with a non-null state on mount, so the seed path is only reached by tests. Either document it on the method signature or rename the seed path to `prime()`.

---

### [LOW] L-6 — `chipCapacity` / `readyFiredRef` unrelated but co-located in `<PokerTable>`

**File:** `frontend/src/scenes3d/PokerTable.tsx`

Unrelated to this cycle but noted while reviewing: several prop-reserved markers (`_equityOverlay`, `_cameraPreset`, `_onPresetChange`) and the `readyFiredRef` sentinel crowd the file. Defer to a future `PokerTable` refactor task; not blocking.

---

## Positives

- **Pure controller + thin R3F wrapper** is the right factoring. Unit-testing the controller synchronously sidesteps the GL-context barrier cleanly for the logic half of the problem.
- **Identity-memoized `sync`** (`if (this.prev === next) return`) directly addresses Cycle 12 LOW-6 and has a dedicated test that would fail if the guard were removed.
- **`worldToLocal` via `parent.worldToLocal(obj.position)`** is the right primitive for mixing world-space tween targets with arbitrarily-nested parent groups (modulo H-1's missed 0.02 offset).
- **`registerDealTarget` ref-callback with explicit delete on `null`** is correct React patterns; cleanup happens on unmount without a separate effect.
- **`onTweenStart` test-only hook** gives the tests a seam without coupling production code to test state.
- AC 4's test for hand-id change transitions is a genuine behavioral pin beyond what the primitives provide.

---

## Overall Assessment

The architectural split (pure `DealAnimationController` + R3F `<DealAnimationDriver>` + target registry) is the right shape and will pay off for T-013/T-023. Cycle 12 HIGH is **partially remediated** — primitives are now wired, but the observable-on-canvas verification that the Cycle 12 finding fundamentally called for is still deferred, and that gap directly caused both HIGH findings this cycle:

- **H-1** (hole target Y off by `SEAT_PAD_THICKNESS`) would have been caught by a single R3F integration assertion against production `holeTargetPosition`.
- **H-2** (cancel-on-absent cancels live hole tweens when the flop arrives during hole deal) invalidates AC 4's intent in a case no existing test covers.

**Recommended pecking order for the next cycle:**
1. Fix H-2 in `DealAnimationController.sync` — scope cancel to superseded `handId`, add regression test for "flop during hole-deal preserves hole tweens".
2. Fix H-1 by factoring a shared `seatLocalToWorld` helper and importing `SEAT_PAD_THICKNESS` from `<Seat>` (or moving it into `tableLayout.ts`). Add layout-parity assertion: `holeTargetPosition(i, n, s)` equals the world-traversal of the actual scene-graph at rest.
3. File P1 follow-up for M-2 (R3F integration test via `@react-three/test-renderer`). This is the durable answer for Cycle 12's original concern and will prevent the next round of this class of bug.
4. M-3/M-4/M-5 can be batched into a "driver robustness" pass alongside step 3.

Do **not** re-open `BUG-CYCLE12-01`. Instead, record these as new follow-ups owned by this fix's parent (epic `aia-core-6o9t`).

Because this report contains 2 HIGH findings, Scott is **not** creating a commit. `aia-core-ji66` should remain open until H-1 and H-2 are resolved.

---

## Cycle 13 — Re-review (post H-1 / H-2 fix pass)

**Reviewed:** 2026-04-18
**Reviewer:** Scott (automated, loop-review — re-review)
**Scope:** Verify H-1 (hole-target Y) and H-2 (cancel-on-absent) fixes; revisit prior MEDIUM/LOW findings; surface any new HIGH introduced by the `shouldCancel` predicate; reassess AC 4.

### Summary — Re-review

| Severity | This pass | Δ vs first pass |
|---|---|---|
| CRITICAL | 0 | = |
| HIGH | 0 | −2 ✓ |
| MEDIUM | 3 | −2 |
| LOW | 4 | −2 |
| **Total** | **7** | **−6** |

**Headline:** Both HIGH findings are genuinely fixed, not papered over. H-1 is resolved by a proper helper extraction (`seatAnchorLocalToWorld`) with a render-graph parity test that fails loudly on any future drift; H-2 is resolved by a small, well-specified `shouldCancel` predicate with direct unit tests and a mid-flight integration test. AC 4 moves from NOT SATISFIED → SATISFIED. No new HIGH introduced. Zero remaining HIGH → **approve close**.

### Focus-area verdicts

**(a) Are H-1 and H-2 genuinely fixed?**

- **H-1 — SATISFIED, not shallow.**
  - `SEAT_PAD_THICKNESS` lives in [tableLayout.ts](frontend/src/scenes3d/components/tableLayout.ts#L32) (canonical) and is imported by `<Seat>` ([components/Seat.tsx](frontend/src/scenes3d/components/Seat.tsx#L6)) so the render path and the helper reference the same constant — no possibility of numeric drift.
  - `holeTargetPosition` now delegates entirely to [`seatAnchorLocalToWorld`](frontend/src/scenes3d/components/tableLayout.ts#L104-L121); no local re-implementation of the seat-local→world math remains in the driver. This was exactly the shape recommended under H-1 / L-1.
  - The scene-graph parity test at [tableLayout.test.ts#L140-L179](frontend/test/scenes3d/tableLayout.test.ts#L140-L179) constructs the exact three-level `<Seat>` → `<seat-anchor>` → child hierarchy with real `THREE.Group` objects, calls `child.getWorldPosition()`, and asserts it equals `seatAnchorLocalToWorld(...)` to 1e-10 tolerance for four non-trivial local offsets across all 9 seats. This is a load-bearing parity pin — if anyone changes either the render path or the helper without the other, this fails.
  - The integration test at [DealAnimationDriver.integration.test.tsx#L575-L643](frontend/test/scenes3d/DealAnimationDriver.integration.test.tsx#L575-L643) parametrises over `seatCount ∈ {2, 4, 6, 9, 10}`, snapshots render-time world pose, runs a reduced-motion sync, and asserts post-sync world pose equals the pre-snapshot to 1e-10. Includes the explicit `y > 0.03` sentinel that regresses if `SEAT_PAD_THICKNESS` ever drops out of the helper. Exactly what was asked for.
  - No AC test was weakened to make this pass — the prior AC 2 test [at DealAnimationController.test.ts#L175-L201](frontend/test/scenes3d/DealAnimationController.test.ts#L175-L201) is unchanged; new coverage is purely additive.

- **H-2 — SATISFIED, not shallow.**
  - Cancel logic now routes through the pure `shouldCancel(existingKey, newKeys, prevHandId, nextHandId)` predicate at [DealAnimationController.ts#L80-L91](frontend/src/scenes3d/animations/DealAnimationController.ts#L80-L91), exported and unit-tested in isolation at [DealAnimationController.test.ts#L365-L392](frontend/test/scenes3d/DealAnimationController.test.ts#L365-L392).
  - The predicate's three branches are each covered: (i) cross-hand → cancel, (ii) same-hand absent-key → keep, (iii) same-hand present-key → cancel (intentional re-deal), plus the priming no-op branch. Regression-to-fail verified by Hank.
  - The end-to-end regression — preflop hole deal tweens mid-flight at t=200ms, then sync to flop (same handId) — is pinned at both the controller level ([DealAnimationController.test.ts#L395-L436](frontend/test/scenes3d/DealAnimationController.test.ts#L395-L436)) and the integration level ([DealAnimationDriver.integration.test.tsx#L650+](frontend/test/scenes3d/DealAnimationDriver.integration.test.tsx#L650)) with real `THREE.Object3D` traversal.
  - Same-hand re-deal of the same key is explicitly tested and still supersedes the old tween, so the fix did not tilt too far in the other direction.

**(b) Prior MEDIUM / LOW disposition**

| Finding | Status | Evidence |
|---|---|---|
| M-1 (AC 2/3 tautology) | **RESOLVED** | Integration suite at [DealAnimationDriver.integration.test.tsx](frontend/test/scenes3d/DealAnimationDriver.integration.test.tsx) now exercises production `holeTargetPosition` / `communityTargetPosition` against real `Object3D` traversal. The tests are no longer a restatement of primitives; they would catch the exact class of bug H-1 represented. |
| M-2 (deferred Canvas smoke) | **RESOLVED (equivalent coverage)** | The integration test builds the production scene graph directly in raw `three` rather than via `@react-three/test-renderer`, which is equivalent for the "does the driver move real `Object3D`s to the production target" question M-2 was asking. File a LOW-priority follow-up only if R3F-internal behaviour (hooks order, `invalidate()`, etc.) needs separate coverage. |
| M-3 (StrictMode lifecycle unpinned) | **UNCHANGED** | `useMemo` controller + dual `useEffect` pattern in [DealAnimationDriver.tsx#L142-L166](frontend/src/scenes3d/animations/DealAnimationDriver.tsx#L142-L166) is untouched; no StrictMode regression test added. Keep as MEDIUM — same risk profile as before. |
| M-4 (ref mutation during render) | **UNCHANGED** | Line [DealAnimationDriver.tsx#L139](frontend/src/scenes3d/animations/DealAnimationDriver.tsx#L139) still writes `reducedMotionRef.current = reducedMotion;` during render. Keep as MEDIUM. |
| M-5 (unmount-mid-tween) | **UNCHANGED** | `buildTarget` still captures the `Object3D` reference at sync time; tween `onUpdate` closure holds the stale wrapper after unmount. Keep as MEDIUM. |
| L-1 (seat-local→world math duplicated) | **RESOLVED** | Fully subsumed by the H-1 helper extraction — the helper is the single source of truth. |
| L-2 (unused `setRotation`) | **UNCHANGED** | Still present on `DealTarget`; still unused by the controller. |
| L-3 (unused `layout.deckPosition`) | **UNCHANGED** | No change. |
| L-4 (comment drift) | **UNCHANGED** | Comment at `DealAnimationController.ts#L148` still says "createTween has already fired onComplete above". |
| L-5 (`sync(null, layout)` undocumented) | **PARTIALLY RESOLVED** | JSDoc at [DealAnimationController.ts#L104-L108](frontend/src/scenes3d/animations/DealAnimationController.ts#L104-L108) now documents the prime path inline ("Caller is priming the controller..."). Good enough for close; full `prime()` rename still optional. |
| L-6 (unrelated PokerTable crowding) | **UNCHANGED** | Explicitly out of scope for this bug. |

**(c) New HIGH introduced by `shouldCancel`?**

**None.** Edge cases walked:

- **`handId` undefined:** `TableState.handId` is typed `number` (not optional), and `prevHandId` is derived via `this.prev?.handId ?? null`. The `null` branch is explicitly tested and falls through to "keep" — safe. `nextHandId` is always defined by type.
- **`awaiting_cards` sentinel priming:** The "supersedes" test at [DealAnimationController.test.ts#L437-L488](frontend/test/scenes3d/DealAnimationController.test.ts#L437-L488) drives `awaiting_cards → preflop → awaiting_cards → preflop` on the same hand and asserts the second preflop replaces the first preflop's tweens correctly. Covered.
- **Re-deal during cross-hand transition:** `prevHand=10` in-flight tweens carry key prefix `hole:10:...`; new-hand-11 events carry key prefix `hole:11:...` — no overlap by construction of the key schema. Cross-hand branch returns `true` for every existing key → all hand-10 tweens cancelled, hand-11 tweens spawn fresh. Correct and covered by the existing cross-hand test.
- **Same-hand with empty delta (state-object-identity change but no events emitted):** `newKeys` is empty, `prevHand === nextHand`, predicate returns `false` for every key (absent from `newKeys`) → nothing cancelled. No stranding, no restart. Correct fallout; not explicitly tested but follows trivially from the predicate definition.

**(d) AC 4 status**

**SATISFIED** (was NOT SATISFIED).

Evidence:
- Cross-hand supersede (old hand's keys cancelled on new `handId`): [DealAnimationController.test.ts#L247-L284](frontend/test/scenes3d/DealAnimationController.test.ts#L247-L284) (pre-existing).
- Same-hand phase progression does **not** strand in-flight tweens: [DealAnimationController.test.ts#L395-L436](frontend/test/scenes3d/DealAnimationController.test.ts#L395-L436) and integration [DealAnimationDriver.integration.test.tsx#L650+](frontend/test/scenes3d/DealAnimationDriver.integration.test.tsx#L650).
- Same-hand intentional re-deal still supersedes (no orphan tween accumulation): [DealAnimationController.test.ts#L437-L488](frontend/test/scenes3d/DealAnimationController.test.ts#L437-L488).

The three branches of the rapid-toggle contract (cross-hand supersede, same-hand preserve, same-hand re-deal supersede) are each pinned. AC 4's "no stale in-flight tweens" is now a proper behavioural pin rather than a partial one.

### Remaining findings (carried forward as-is)

- **[MEDIUM] M-3** — StrictMode lifecycle for `<DealAnimationDriver>` unpinned. No severity change.
- **[MEDIUM] M-4** — Ref mutation during render at [DealAnimationDriver.tsx#L139](frontend/src/scenes3d/animations/DealAnimationDriver.tsx#L139). No severity change.
- **[MEDIUM] M-5** — Unmount-mid-tween leaves stale `DealTarget` closure. No severity change.
- **[LOW] L-2** — `DealTarget.setRotation` unused. No change.
- **[LOW] L-3** — `layout.deckPosition` override unused by driver. No change.
- **[LOW] L-4** — Controller comment drift at zero-duration branch. No change.
- **[LOW] L-6** — `<PokerTable>` unrelated crowding; deferred. No change.

(Former M-1, M-2, L-1, L-5 resolved; see table above.)

### Environmental note

On the first re-run of the full frontend suite I observed 1 flaky failure in an unrelated `DealerApp` test (act()/async warnings in `happy-dom`). A second run came back clean at 1484/1484. The flake is pre-existing and unrelated to this fix; mentioning it here only so the "1484 green" claim is fully reproducible. Not a blocker for close.

### Decision

- **0 CRITICAL, 0 HIGH** remaining.
- Both previously-HIGH bugs are genuinely fixed with load-bearing regression tests.
- AC 4 is defensibly SATISFIED.
- No new HIGH introduced by the predicate.
- **Approve close of `aia-core-ji66`.** Remaining 3 MEDIUM + 4 LOW findings roll forward to Hank's follow-up list in `specs/table-3d-revamp-010/tasks.md` (driver robustness pass: StrictMode pin + ref-mutation-in-effect + per-frame target resolve).

Because this re-review pass contains zero CRITICAL findings, Scott may create a commit summarising the re-review outcome.
