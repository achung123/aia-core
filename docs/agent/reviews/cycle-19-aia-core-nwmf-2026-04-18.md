# Code Review Report — Cycle 19 / aia-core-nwmf (T-011)

- **Cycle:** 19
- **Epic:** aia-core-6o9t (table-3d-revamp-010)
- **Task:** aia-core-nwmf — T-011 Chip-slide animation (seat → pot) on bets/calls/raises
- **Spec:** [specs/table-3d-revamp-010/tasks.md § T-011](../../../specs/table-3d-revamp-010/tasks.md#L247)
- **Reviewer:** Scott
- **Date:** 2026-04-18
- **Target files reviewed:**
  - [frontend/src/scenes3d/animations/chipSlides.ts](../../../frontend/src/scenes3d/animations/chipSlides.ts)
  - [frontend/src/scenes3d/animations/ChipSlideController.ts](../../../frontend/src/scenes3d/animations/ChipSlideController.ts)
  - [frontend/src/scenes3d/animations/ChipSlideDriver.tsx](../../../frontend/src/scenes3d/animations/ChipSlideDriver.tsx)
  - [frontend/src/scenes3d/components/tableLayout.ts](../../../frontend/src/scenes3d/components/tableLayout.ts) (seatCommitChipWorldPosition hoist)
  - [frontend/src/scenes3d/PokerTable.tsx](../../../frontend/src/scenes3d/PokerTable.tsx) (consumption site — confirmed NOT wiring the driver)
  - [frontend/test/scenes3d/chipSlides.test.ts](../../../frontend/test/scenes3d/chipSlides.test.ts)
  - [frontend/test/scenes3d/ChipSlideController.test.ts](../../../frontend/test/scenes3d/ChipSlideController.test.ts)
  - [frontend/test/scenes3d/tableLayout.test.ts](../../../frontend/test/scenes3d/tableLayout.test.ts) (parity test)

## Verdict

**1 HIGH, 3 MEDIUM, 4 LOW. Not clean for close-as-green, but the HIGH is a scope-boundary issue, not a defect in shipped code.**

The primitives Hank shipped are correct, well-isolated, and well-tested in isolation. But exactly as Hank flagged, the **visual render-layer wiring is absent**: `<PokerTable>` never mounts `<ChipSlideDriver>`, never consumes `getInFlightAmountForSeat` / `getInFlightPotAmount`, and never renders an in-flight chip slug from `getInFlightPosition(key)`. Seat commit stacks still read `seat.committedThisStreet` directly; pot still reads `state.pot` directly. **Zero chips are observably moving on canvas.** The spec text "Originating `<ChipStack>` shrinks immediately; pot grows on arrival" is false at runtime today.

This is structurally identical to Cycle 12's T-010 ("primitives shipped, driver deferred"), which we closed by filing a P1 follow-up bug with `discovered-from:aia-core-ji66` and treating the driver as the next cycle's work. **Same precedent applies.** Close T-011, file the driver as a new P1 bug, let it become Cycle 20.

---

## Findings

### HIGH

#### H-1 — ACs 1/2/4 are not observable in-canvas; `<ChipSlideDriver>` not mounted by `<PokerTable>`

- **Severity:** HIGH
- **Location:** [frontend/src/scenes3d/PokerTable.tsx](../../../frontend/src/scenes3d/PokerTable.tsx#L200-L266) — render body lacks any `<ChipSlideDriver>` tag; seat `<ChipStack amount={seat.committedThisStreet} />` and pot `<ChipStack amount={state.pot} />` bypass the controller.
- **Spec:** T-011 body text — "Originating `<ChipStack>` shrinks immediately; pot grows on arrival" — and ACs 1 ("Increasing `committedThisStreet` triggers the slide animation"), 2 ("Multiple concurrent slides from different seats do not collide visually"), 4 ("A test with two seats firing simultaneous bets asserts both animations start and complete").
- **Problem:**
  - AC 1 passes as a unit assertion on `ChipSlideController`, but nothing flies across the 3D scene. The spec's phrasing is observable ("animate a chip-slug from the seat's stack to the pot over ~400ms"); a unit test on the controller's `getActiveKeys().size === 1` is not equivalent to "the user sees a slide."
  - AC 2 ("do not collide visually") is definitionally about rendered output, not controller bookkeeping. With no render consumer, nothing is drawn and therefore nothing can collide or not-collide.
  - AC 4 is phrased "a test with two seats firing simultaneous bets asserts both animations start and complete" — the controller test meets the letter (two tweens, two completes), but the spec's intent (S-2.2) is two visible slides landing in the pot.
- **Precedent:** Cycle 12's T-010 shipped `DealAnimationController` + `DealAnimationDriver` without scene-graph consumption. Scott filed HIGH, Anna opened P1 bug `aia-core-ji66` with `discovered-from`, T-010 closed as "primitives-complete," Cycle 13 wired the driver. Duplicate `aia-core-8cdj` was later superseded. The same shape applies here; the driver's integration into `<PokerTable>` is the next cycle's deliverable.
- **Recommendation:** **Close T-011 / aia-core-nwmf as "primitives complete"** and **file a new P1 bug** with:
  - **Title:** "Wire `<ChipSlideDriver>` into `<PokerTable>` — make T-011 ACs observable on canvas"
  - **Dependencies:** `discovered-from:aia-core-nwmf`, `parent:aia-core-6o9t`
  - **Scope bullets:**
    1. Mount `<ChipSlideDriver>` inside `<PokerTable>`; publish the controller via `onController` into local state.
    2. Subtract `controller.getInFlightAmountForSeat(seatIndex)` from the seat commit `<ChipStack>` so the origin shrinks immediately.
    3. Subtract `controller.getInFlightPotAmount()` from the pot `<ChipStack>` and render an `<InstancedMesh>`-backed or single-slug chip at `controller.getInFlightPosition(key)` for each active key (render it on the felt so the pot "grows on arrival" is a literal single-frame arrival).
    4. Add two integration tests (via `@react-three/test-renderer` or the existing R3F scene probe) that assert: (a) immediately after a commit-delta sync, the origin seat ChipStack amount drops by the delta; (b) at `t = CHIP_SLIDE_DURATION_MS + 1ms`, the pot ChipStack amount has grown by the delta; (c) two concurrent bets (AC 2/4) both land.
    5. Handle the street-transition in-flight edge (see M-2 below) so seat-ChipStack subtraction never goes negative if a slide is still mid-flight when `committedThisStreet` resets.

---

### MEDIUM

#### M-1 — Pure-primitive tests are anchored to a synthetic layout, never to real table geometry

- **Severity:** MEDIUM
- **Location:** [frontend/test/scenes3d/chipSlides.test.ts](../../../frontend/test/scenes3d/chipSlides.test.ts#L58-L62), [frontend/test/scenes3d/ChipSlideController.test.ts](../../../frontend/test/scenes3d/ChipSlideController.test.ts#L55-L59) — both tests use `seatOrigin: (i) => [i, 0, 0]; potTarget: () => [0, 0, -1]`.
- **Problem:** The tests exercise the diff + bookkeeping surface, but they assert exactly what's plugged in. Nothing in the existing suite binds the controller's output to `seatCommitChipWorldPosition` + `POT_CHIP_WORLD_POSITION`. Per the question (b): they're not strictly tautological — they do verify diff semantics, fold-guard, street/hand-reset, sequence counters, reduced-motion, and cross-hand cancel — but they do not anchor to the spec's **geometric** behavior (a slide from the seat's actual chip stack to the actual pot cluster). Once the render layer is wired in the follow-up bug, that gap closes naturally.
- **Recommendation:** In the follow-up bug, add one end-to-end test that constructs `buildPokerTableChipSlideLayout(seatCount)`, runs a two-seat commit-increase sync, and asserts `getInFlightPosition(key)` starts at `seatCommitChipWorldPosition(seatIndex, seatCount)` and ends at `POT_CHIP_WORLD_POSITION`. No change needed to shipped code for this cycle.

#### M-2 — `inFlight` bookkeeping persists across street transitions by design; when render wiring lands, seat-ChipStack subtraction risks going negative

- **Severity:** MEDIUM
- **Location:** [frontend/src/scenes3d/animations/ChipSlideController.ts](../../../frontend/src/scenes3d/animations/ChipSlideController.ts#L95-L100) — street-change branch resets `seqBySeat` + `seqScope` but *intentionally* lets in-flight tweens finish naturally. The jsdoc on `computeChipSlideDeltas` ("any residual in-flight slides from the previous street finish naturally") confirms this is deliberate.
- **Problem:** Correct for this cycle (controller contract), but dangerous for the follow-up. If `committedThisStreet` resets to 0 at street advance while a slide is still mid-flight, the render-layer recipe "`displayedCommit = seat.committedThisStreet − controller.getInFlightAmountForSeat(i)`" yields `0 − delta = negative`. Cycle 13 H-2 hit a similar cross-scope bookkeeping bug.
- **Recommendation:** Either clamp at the render consumer (`Math.max(0, seat.committedThisStreet − inFlight)`), or have the controller *also* clear `inFlight` on street transitions (letting tweens finish visually as a flying-slug-only effect). Decide in the follow-up bug; I'd lean toward "clear inFlight on street change and let the slug keep flying to the pot" — cleaner invariant, no negative-subtraction risk, and the slug visual still lands.

#### M-3 — Under reduced-motion, `onSlideStart` fires *after* `onSlideComplete`

- **Severity:** MEDIUM
- **Location:** [frontend/src/scenes3d/animations/ChipSlideController.ts](../../../frontend/src/scenes3d/animations/ChipSlideController.ts#L117-L146) — the order in `sync` is: `inFlight.set` → `createTween({...})` (which under `reducedMotion` synchronously invokes `onComplete` → `inFlight.delete` + `opts.onSlideComplete`) → `opts.onSlideStart?.(key, d)`.
- **Problem:** Any downstream consumer that assumes start-before-complete (an animation sequence viewer, a logger, a test spy that expects a specific ordering) will see completes before starts in reduced-motion mode. The existing reduced-motion test only asserts `completed` — so the regression surface is silent.
- **Recommendation:** Fire `onSlideStart` **before** constructing the tween (move the callback two lines up). Also add a reduced-motion test asserting `started` is fired and ordering is `start → complete`. Non-blocking for this cycle; note it for the follow-up.

---

### LOW

#### L-1 — `POT_CHIP_WORLD_POSITION` still duplicates `PokerTable.POT_CHIP_POSITION` as an untested literal

- **Severity:** LOW
- **Location:** [frontend/src/scenes3d/animations/ChipSlideDriver.tsx](../../../frontend/src/scenes3d/animations/ChipSlideDriver.tsx#L18-L23) exports `POT_CHIP_WORLD_POSITION: Vec3 = [0, 0, -0.9]`; [frontend/src/scenes3d/PokerTable.tsx](../../../frontend/src/scenes3d/PokerTable.tsx#L86) separately declares `POT_CHIP_POSITION: [number, number, number] = [0, 0, -0.9]`.
- **Problem:** Same drift risk Cycle 13 L-1 flagged for `seatCommitChipWorldPosition` before this cycle's hoist. If someone nudges the pot position in one spot, tween target and render pose desync silently — no parity test catches it.
- **Recommendation:** In the follow-up bug (when `<PokerTable>` starts consuming the driver), hoist both into `tableLayout.ts` as `POT_CHIP_WORLD_POSITION` and delete the duplicate.

#### L-2 — `<ChipSlideDriver>` `onController` fires per-instance under React 18 StrictMode (twice in dev)

- **Severity:** LOW
- **Location:** [frontend/src/scenes3d/animations/ChipSlideDriver.tsx](../../../frontend/src/scenes3d/animations/ChipSlideDriver.tsx#L92-L105) — mount-only `useEffect` constructs the controller and calls `onControllerRef.current?.(c)`. No StrictMode dedupe sentinel.
- **Problem:** StrictMode dev mounts effects twice → `onController` gets called with instance A, then the cleanup resets A, then a second call delivers instance B. If the parent stores the instance in `useState` and kicks off logic from it, the A reference is stale. Cycle 11 fixed the analogous bug in `<PokerTable>` `onReady` with a `readyFiredRef` sentinel — but that pattern **can't** be used here directly because the controller's identity legitimately changes when the component remounts. The right fix is: the parent's `onController` handler must treat `c` as the current instance (store in a ref that updates on each callback), not as a one-shot.
- **Recommendation:** Document "onController may fire once per driver lifetime; store in a ref, not in useState" on the prop JSDoc. No code change for this cycle.

#### L-3 — `chipSlides.ts` "missing prev seat → no event" branch has jsdoc but no test

- **Severity:** LOW
- **Location:** [frontend/src/scenes3d/animations/chipSlides.ts](../../../frontend/src/scenes3d/animations/chipSlides.ts#L106) — `if (prevCommit === undefined) continue;`
- **Problem:** Edge case is documented in the function header but not exercised by `chipSlides.test.ts`. Low-probability regression risk (mid-hand seat insertions), but one `{ prev: [seat 0 only], next: [seat 0, seat 1 with committed:50] }` test would pin the behavior.
- **Recommendation:** Add the test in the follow-up bug's test pass.

#### L-4 — `CHIP_SLIDE_DURATION_MS = 400` is a bare constant; spec says "~400ms"

- **Severity:** LOW
- **Location:** [frontend/src/scenes3d/animations/chipSlides.ts](../../../frontend/src/scenes3d/animations/chipSlides.ts#L17)
- **Problem:** Matches the spec; no defect. Future T-027 quality tiers may want to vary this by tier (Low: skip animation; High: slightly longer). Note for T-027 scope.

---

## AC Mapping — T-011

| AC | Text | Primitive (controller-level) | Observable (scene-graph) | Verdict |
|---|---|---|---|---|
| 1 | Increasing `committedThisStreet` triggers the slide animation | ✅ [ChipSlideController.test.ts lines 64-103](../../../frontend/test/scenes3d/ChipSlideController.test.ts#L64-L103) | ❌ no `<ChipSlideDriver>` in `<PokerTable>` | **PARTIAL** — see H-1 |
| 2 | Multiple concurrent slides from different seats do not collide visually | ✅ [ChipSlideController.test.ts lines 111-139](../../../frontend/test/scenes3d/ChipSlideController.test.ts#L111-L139) (distinct keys, distinct origins) | ❌ not rendered | **PARTIAL** — see H-1 |
| 3 | Fold does not trigger chip motion | ✅ [chipSlides.test.ts lines 138-174](../../../frontend/test/scenes3d/chipSlides.test.ts#L138-L174), [ChipSlideController.test.ts lines 147-165](../../../frontend/test/scenes3d/ChipSlideController.test.ts#L147-L165) | ✅ (no-op case, nothing to render anyway) | **COVERED** |
| 4 | A test with two seats firing simultaneous bets asserts both animations start and complete | ✅ [ChipSlideController.test.ts lines 173-201](../../../frontend/test/scenes3d/ChipSlideController.test.ts#L173-L201) | ❌ no in-canvas two-slide assertion | **PARTIAL** — see H-1 |

**Side ACs from the spec body:**
- "Originating `<ChipStack>` shrinks immediately" → **UNVERIFIED in-canvas**. Controller exposes `getInFlightAmountForSeat`, but `<PokerTable>` never subtracts it.
- "Pot grows on arrival" → **UNVERIFIED in-canvas**. Controller exposes `getInFlightPotAmount` + `onSlideComplete`, but `<PokerTable>` never consumes either.

---

## Answers to Review Focus Questions

**(a) Does the deferred visual wiring make AC 1-4 observably unverified on canvas, same as Cycle 12's T-010 situation?**

Yes. ACs 1, 2, and 4 are satisfied *at the primitive layer only*; the spec phrasing ("animate a chip-slug from the seat's stack to the pot") is observable, and no pixel moves. AC 3 (fold) is fully covered — it's a no-op assertion that doesn't require a render layer.

**Precedent:** Cycle 12's T-010 shipped `DealAnimationController` + `DealAnimationDriver` with no `<Card>` consumer. Scott filed HIGH; Anna filed P1 bug `aia-core-ji66` with `discovered-from`; T-010 closed; Cycle 13 became the driver wiring. The same shape applies here. **Recommend: close T-011 / aia-core-nwmf; file P1 follow-up with `discovered-from:aia-core-nwmf`.**

**(b) Are the controller tests tautological vs. observably anchored?**

Not tautological — they verify real diff + bookkeeping semantics (fold guard, hand/street resets, per-seat sequence counters, cross-hand cancel, reduced-motion synchronous completion). But they are *geometrically* synthetic — the layout is `(i) => [i, 0, 0]`, not `seatCommitChipWorldPosition(i, n)`. The end-to-end anchoring is the follow-up bug's job. See M-1.

**(c) Cancel-on-absent logic — any same-street / cross-hand edge cases?**

Cross-hand: correct — `prevHandId !== null && prevHandId !== nextHandId` cancels everything, and `computeChipSlideDeltas` separately guards `prev.handId !== next.handId → []` so a fresh hand never spawns phantom slides. Matches Cycle 13 H-2's fix pattern.

Same-street (see M-2): `inFlight` persists across street resets. Not wrong at the primitive layer, but will need render-layer handling. Not a defect in this cycle's deliverable.

**(d) Reduced motion:** Correct for the spec ("pot appears to receive chips instantly"). Found one ordering quirk — `onSlideStart` fires after `onSlideComplete` (M-3). Minor.

**(e) Concurrent seats (AC 4) have distinct keys:** Yes. Keys are `chip:${hand}:${street}:${seat}:${seq}` with per-seat sequence counters that increment on *every* new delta within a (hand, street) scope. Two seats committing simultaneously produce `chip:42:0:0:1` and `chip:42:0:1:1` — distinct seat-index segments. A single seat re-raising within the same street produces `…:0:1` then `…:0:2` — distinct sequence segments. Test coverage is tight.

**(f) `seatCommitChipWorldPosition` hoist + parity test:** Strong. The hoist routes through `seatAnchorLocalToWorld`, which already has its own scene-graph parity sentinel against a real `THREE.Group` hierarchy ([tableLayout.test.ts lines 142-177](../../../frontend/test/scenes3d/tableLayout.test.ts#L142-L177)). The new parity test ([tableLayout.test.ts lines 179-202](../../../frontend/test/scenes3d/tableLayout.test.ts#L179-L202)) asserts bit-for-bit against the **legacy ad-hoc formula** (`[sx + sin(phi)*z, sy, sz + cos(phi)*z]`) — so any future drift in `seatAnchorLocalToWorld` would break parity, which is the desired behavior. This is the same anti-regression pattern Cycle 13 H-1 established. Resolves Cycle 13 LOW L-1 as claimed. Solid.

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 1 |
| MEDIUM | 3 |
| LOW | 4 |

**Recommendation — mirror Cycle 12 precedent:**
1. **Close** aia-core-nwmf / T-011 with closure note: "Primitives complete (diff + controller + R3F driver + 23 tests). Visual wiring of `<ChipSlideDriver>` into `<PokerTable>` deferred per Cycle 12 precedent; filed as follow-up P1 bug `discovered-from:aia-core-nwmf`."
2. **File** new P1 bug with the scope bullets listed under H-1.
3. M-2 and M-3 fold into the follow-up bug's scope; M-1, L-1, L-3 are test-tightening that naturally belong to the follow-up; L-2, L-4 record in tasks.md Cycle 19 ledger as standing notes.
4. Do **not** commit — this is a loop-review; Anna manages commits.
