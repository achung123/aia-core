# Code Review Report — table-3d-revamp-010

**Date:** 2026-04-18
**Cycle:** 12
**Target:** `frontend/src/scenes3d/animations/tweens.ts`, `frontend/src/scenes3d/animations/dealCards.ts`, `frontend/src/scenes3d/state/useReducedMotion.ts` (+ companion tests)
**Reviewer:** Scott (automated, loop-review)

**Task:** T-010 — Card deal + flip animation module with reduced-motion
**Beads ID:** aia-core-c8xh
**Epic:** table-3d-revamp-010

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 1 |
| MEDIUM | 3 |
| LOW | 4 |
| **Total Findings** | **8** |

**Headline:** The module core is high-quality — pure, deterministic, thoroughly tested (48 new tests, 1452/1452 suite green). However, T-010 as written in `tasks.md` specifies user-facing card animation behavior ("newly revealed cards animate from a deck position to their slot and flip face-up"), and **no card in the scene graph is currently driven by these primitives**. All four ACs are therefore PARTIAL — the building blocks are correct, but no observable animation exists. Hank's deferral is a defensible *split*, not a completion: a follow-up task must be filed and T-010 should not be closed until the `<Card>` / `<PokerTable>` driver lands (or T-010 is re-scoped by Jean).

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | `preflop → flop` animates three flop cards sequentially within 500ms total. | PARTIAL | [dealCards.ts L178-L200](frontend/src/scenes3d/animations/dealCards.ts#L178-L200); [dealCards.test.ts L134-L140](frontend/test/scenes3d/dealCards.test.ts#L134-L140) | Schedule is correct (`staggerStarts` pins last-card end at exactly 500ms) but no mesh in the scene consumes the events. No card actually moves. |
| 2 | Hole-card deal animates in dealer rotation order. | PARTIAL | [dealCards.ts L103-L121](frontend/src/scenes3d/animations/dealCards.ts#L103-L121); [dealCards.test.ts L127-L135](frontend/test/scenes3d/dealCards.test.ts#L127-L135) | `holeDealOrder` is correct (SB first, wraps forward, skips folded/inactive). Not wired to any seat. |
| 3 | With `prefers-reduced-motion`, cards appear instantly at their final positions. | PARTIAL | [tweens.ts L82-L96](frontend/src/scenes3d/animations/tweens.ts#L82-L96); [useReducedMotion.ts L49-L54](frontend/src/scenes3d/state/useReducedMotion.ts#L49-L54) | `createTween({reducedMotion:true})` fires `onUpdate(to)` + `onComplete` synchronously; `useReducedMotion` is SSR-safe and Safari-<14 compatible. But no `<Card>` consumes the hook — cards render at prop `position`, not at event `to`. |
| 4 | Rapid street toggles during an in-flight animation do not leave stale card meshes. | PARTIAL | [dealCards.ts L44-L50, L203-L212](frontend/src/scenes3d/animations/dealCards.ts#L44-L50); [dealCards.test.ts L246-L299](frontend/test/scenes3d/dealCards.test.ts#L246-L299) | Key scheme (`community:${handId}:${slot}`, `hole:${handId}:${seatIndex}:${slot}`) is stable and unique; street regressions correctly emit `[]`. But "stale *meshes*" is a scene-graph assertion that cannot be verified without an integrated driver. |

---

## Findings

### [HIGH] T-010 ACs describe observable animation behavior; deferral leaves them unverified in the scene

**File:** `frontend/src/scenes3d/animations/dealCards.ts`, `frontend/src/scenes3d/components/Card.tsx`
**Line(s):** dealCards.ts L12-L14; Card.tsx L95-L142
**Category:** design / scope

**Problem:**
T-010's ACs in [tasks.md L234-L244](specs/table-3d-revamp-010/tasks.md#L234-L244) describe what happens on the table: cards "animate", "appear instantly" under reduced motion, do "not leave stale card meshes". `spec.md § S-2.1` reinforces: "cards **fly in and flip**". Hank's deferral ships the deterministic core without any consumer — `computeDealSequence` is not referenced anywhere outside its own file ([grep confirmed](frontend/src/scenes3d/animations/dealCards.ts#L138)), `<Card>` still renders at its `position` prop with no tween driver ([Card.tsx L95-L142](frontend/src/scenes3d/components/Card.tsx#L95-L142)), and no `useFrame` hook wraps `createTween`.

Hank's argument — "plan.md says tweens run inside `useFrame` via refs, not React state, so the API surface is already animation-ready" — is correct about *how* the driver must be built, but does not address *whether* the driver is part of T-010. `plan.md § Animation Engine` shows a `useTween` hook (not `createTween`), and the task description is "Implement `animations/dealCards.ts`. On street transitions, newly revealed cards animate..." — the present-tense "animate" is the AC, not the hook's existence.

**Suggested Fix:**
Pick one:
1. File a follow-up task (e.g., T-010b / new bd issue) — "Wire `computeDealSequence` + `createTween` into `<Card>` via `useTween` + `useFrame`; verify ACs 1–4 with R3F render tests" — mark it as a **blocker** for T-013 (showdown reveal depends on card flip) and T-023 (replay scrubber). **Do not close T-010** until the driver lands, or
2. Reopen the task with Jean to formally re-scope T-010 as "animation primitives only" and renumber the integration work.

**Impact:** Without the driver, no user observes card motion. T-013 (Story S-2.4 showdown reveal) and T-023 (S-4.3 replay scrubber) both depend on T-010 and cannot consume an unwired module. Closing T-010 now risks the integration gap being absorbed silently into a later task with weaker ACs.

---

### [MEDIUM] Hole-deal schedule exceeds spec S-2.1 AC 1's 500ms budget for ≥ 5 active seats

**File:** `frontend/src/scenes3d/animations/dealCards.ts`
**Line(s):** L155-L175
**Category:** correctness / spec conformance

**Problem:**
Hole deal stagger is a fixed 80ms per card × 2 passes × N seats. With the last tween's end = `(2N − 1) × 80 + 120`:

| N seats | Last end (ms) |
|---|---|
| 4 | 680 |
| 6 | 1000 |
| 9 | 1480 |

`spec.md § S-2.1 AC 1` reads: "Transitioning `TableState.street` from one value to the next animates the newly revealed card(s) from the deck position to the table, then flips face-up over ≤ 500ms total." Read literally, the `awaiting_cards → preflop` transition (which reveals hole cards) violates this for every table ≥ 5 seats. `tasks.md T-010 AC 1` narrows the 500ms bound to "preflop → flop", which is consistent with the flop-only budget encoded by `DEAL_STREET_TOTAL_MS`.

The spec and task AC are in tension. The implementation follows the task AC interpretation (community-only 500ms budget, hole deal uncapped).

**Suggested Fix:**
Surface the ambiguity to Jean. Options:
- Confirm `S-2.1 AC 1` applies to community streets only and tighten the spec wording; hole-deal timing moves to its own AC.
- Or, add a hole-deal total budget (e.g., 600–800ms) and compress `DEAL_HOLE_STAGGER_MS` via `staggerStarts` when seat count is high.

**Impact:** Not a bug in the module, but a latent ambiguity that will re-surface when an integration test asserts "hole deal completes in ≤ 500ms" against `spec.md`.

---

### [MEDIUM] Driver consumer contract for AC 4 (cancel in-flight on key absence) is not documented or enforced

**File:** `frontend/src/scenes3d/animations/dealCards.ts`
**Line(s):** L44-L50, L138-L213
**Category:** design

**Problem:**
`computeDealSequence` guarantees:
- Street regressions → `[]`
- Identity transitions → `[]`
- Stable `key` across repeat calls for the same transition

But AC 4 ("rapid street toggles... do not leave stale card meshes") ultimately depends on the driver implementing the rule: *"for every previously-active key not in the new event set, cancel its in-flight tween."* That contract is stated nowhere in the source — the JSDoc on `DealEvent.key` ([L44-L50](frontend/src/scenes3d/animations/dealCards.ts#L44-L50)) says "drivers should reuse or cancel", which is permissive, not prescriptive. There is also no helper API (e.g., `diffEvents(prevEvents, nextEvents): { start, cancel, reuse }`) that encodes this for future driver authors.

**Suggested Fix:**
Either (a) extend the module JSDoc with a concrete "Driver Contract" block that spells out the cancellation rule and how `handId` rotations (every key prefix changes) should be handled, or (b) provide a pure `diffDealEvents(prev, next)` helper in the same file that computes the cancel/reuse/start partition.

**Impact:** The integration author (same or later agent) has to re-derive the cancel semantics from scratch and may implement a different contract, quietly breaking AC 4 at scene level.

---

### [MEDIUM] `reducedMotion` shortcut short-circuits `delayMs` silently

**File:** `frontend/src/scenes3d/animations/tweens.ts`
**Line(s):** L82-L96
**Category:** correctness

**Problem:**
`createTween({ from, to, durationMs, delayMs: 200, reducedMotion: true, onUpdate, onComplete })` jumps to `to` and fires `onComplete` immediately, ignoring the 200ms delay. The current call-sites (`computeDealSequence` schedules delays via `startMs`, not `delayMs`) do not hit this path, but downstream consumers (`chipMotion.ts`, camera presets) may pass `delayMs` for choreography and will be surprised that under reduced motion everything collapses into the same synchronous microtask.

This is arguably *correct* ("reduced motion = no motion = no waiting"), but the behavior is not documented and differs from some libraries (e.g., framer-motion) that preserve scheduled delays even with `prefers-reduced-motion`.

**Suggested Fix:**
Add a one-line JSDoc note on `reducedMotion` explicitly stating "also collapses `delayMs` to 0", or introduce an explicit option (e.g., `preserveDelayUnderReducedMotion?: boolean`) if any caller legitimately needs the latter.

**Impact:** Low risk today (no consumer uses `delayMs` + `reducedMotion` together), but pre-emptive clarification avoids a surprising regression when `chipMotion.ts` (T-011) wires up.

---

### [LOW] `createTween` does not guard against `onUpdate` / `onComplete` throwing

**File:** `frontend/src/scenes3d/animations/tweens.ts`
**Line(s):** L128-L147, L155-L163
**Category:** correctness

**Problem:**
If `onUpdate` throws mid-tick, `done` is not set and `cancelled` is not set — subsequent `tick()` calls will re-enter the failing branch. Similarly, a throwing `onComplete` leaves `done=true` but the side effect is partial. For a `useFrame`-driven loop, one throwing consumer takes down every subsequent frame for every other tween sharing the loop.

**Suggested Fix:**
Either document that `onUpdate`/`onComplete` must not throw, or wrap in try/catch and mark the handle `cancelled` on error.

**Impact:** Minor — pure tests don't exercise this. Matters once a driver is live.

---

### [LOW] `computeDealSequence` re-emits events when drivers re-call on the same transition (same-key churn)

**File:** `frontend/src/scenes3d/animations/dealCards.ts`
**Line(s):** L138-L213
**Category:** design

**Problem:**
The function is pure, so calling it twice for `(preflop → flop)` yields identical event lists with identical keys ([dealCards.test.ts L255-L262](frontend/test/scenes3d/dealCards.test.ts#L255-L262)). A naïve driver that effects on *any* non-empty return will re-start a tween that's already in flight, or re-start one that already completed (thinking "key is already known, fine"). The test titled `rapid street toggles do not produce duplicate community events` asserts list equality but not that a driver would not re-animate.

**Suggested Fix:**
Consider exposing the "diff helper" proposed in the MEDIUM finding above, or at minimum document that drivers should `useMemo` the event list by `[prev, next]` identity (or state-equality keys) and not by calling the function on every render.

**Impact:** Won't manifest until the driver lands. A well-written driver will memoize; a poorly-written one will churn.

---

### [LOW] `useReducedMotion` legacy branch uses optional chaining that silently no-ops if `addListener` is absent

**File:** `frontend/src/scenes3d/state/useReducedMotion.ts`
**Line(s):** L35-L37
**Category:** defensive

**Problem:**
```ts
mql.addListener?.(handler);
return () => mql.removeListener?.(handler);
```
If a browser returns an `MediaQueryList` that supports neither `addEventListener` nor `addListener` (vanishingly rare — some headless environments), the hook silently never updates and never throws. The test at [useReducedMotion.test.tsx L125-L133](frontend/test/scenes3d/useReducedMotion.test.tsx#L125-L133) covers `matchMedia: undefined` but not the "object-returned, no listeners" path.

**Suggested Fix:**
Either add a dev-only warning when both listener APIs are missing, or leave as-is and document that such environments get a static snapshot. Not actionable today.

**Impact:** Negligible for real users; worth a one-line comment noting the graceful-degradation intent.

---

### [LOW] `DealEvent` has no card identity (`cardId`), forcing drivers to re-derive from `TableState.community` / `seats[i].holeCards`

**File:** `frontend/src/scenes3d/animations/dealCards.ts`
**Line(s):** L33-L51
**Category:** design / ergonomics

**Problem:**
Events carry `slotIndex`, `seatIndex`, `from`, `to`, and timing — but not which card face should flip up on arrival. The driver must cross-reference `next.community[slotIndex]` or `next.seats[seatIndex].holeCards[slotIndex]` to resolve the id. That's not incorrect, but it couples drivers to `TableState` shape that the pure module otherwise abstracts cleanly (the whole point of passing `layout` resolvers was to keep positions out of the module).

**Suggested Fix:**
Consider adding `cardId?: string | null` to `DealEvent`, populated by the sequencer from `next.community[slot]` / `next.seats[seat].holeCards[slot]`. Keeps the driver a one-prop-read on the event.

**Impact:** Ergonomic, not blocking. Defer unless the integration author finds the cross-reference awkward.

---

## Positives

- **Exceptional test depth:** 48 new tests, full suite 1452/1452 passing. `dealCards.test.ts` covers every branch of `computeDealSequence` (new hand, `awaiting_cards → preflop`, flop/turn/river, skipped streets, partial-community-in-prev, identity, regression, key stability) and `tweens.test.ts` covers initial-`from` emit, delay, reducedMotion shortcut, completion tick reporting, cancel, zero-duration, and vec3 support.
- **Pure/driver split is a clean architectural call.** The decision to ship `createTween` as a framework-free primitive rather than a `useFrame`-coupled hook makes every tween deterministically testable — the delta to adding `useTween` later is a small wrapper.
- **`useReducedMotion` is textbook `useSyncExternalStore` usage** — SSR-safe snapshot, server snapshot constant, Safari-<14 `addListener` fallback, clean unsubscribe.
- **`staggerStarts` timing math is load-bearing and correct:** test at [dealCards.test.ts L87-L97](frontend/test/scenes3d/dealCards.test.ts#L87-L97) pins the invariant that the last flop card's tween end lands *exactly* at `DEAL_STREET_TOTAL_MS`.
- **Key scheme design is sound:** prefixing with `handId` means hand resets naturally invalidate every prior key, and per-slot/seat suffixing gives drivers precise cancellation granularity once they consume it.
- **Layout-injection pattern (`DealLayout`):** keeps `computeDealSequence` completely free of seat/felt geometry, enabling the forthcoming `<PokerTable>` driver to compose this with `seatTransforms.ts` without modifying the animation module.

---

## Overall Assessment

The module-level code Hank shipped is staff-quality: pure, deterministic, exhaustively tested, and architected cleanly for the eventual `useFrame`-driven consumer. **Zero critical or correctness-blocking issues in the code as written.**

The **single HIGH finding is a scope call, not a code defect**: T-010's ACs are written as observable animation behavior, and without a driver, none of them can be observed on the canvas. Hank's deferral is the right way to *split* the work, but it is not a *completion* of T-010 as the task is currently worded. Recommended path:

1. **Do not close `aia-core-c8xh` yet.** File a P1 follow-up beads issue — "Wire `computeDealSequence` + `createTween` into `<Card>` / `<PokerTable>` via `useFrame` driver hook (blocks T-013, T-023)" — and link it via `discovered-from:aia-core-c8xh`.
2. Keep T-010 claimed by Hank (or re-open), pull the follow-up into the same cycle if Anna's budget allows, or advance to the next loop with the follow-up queued ready.
3. Before closing, log the three MEDIUM findings (hole-deal 500ms spec ambiguity, driver-contract documentation gap, reduced-motion × delayMs semantics) into `tasks.md § Cycle 12` as deferred follow-ups the same way prior cycles have done.

The foundation is excellent. The last mile is what the ACs are actually about.
