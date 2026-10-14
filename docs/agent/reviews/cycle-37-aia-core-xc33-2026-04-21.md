# Code Review Report — H-2 potDisplay one-frame flash (aia-core-xc33)

**Loop Context:** Cycle 37 | Task: aia-core-xc33 | Epic: aia-core-6o9t (T-012 lineage) | Discovered-from: aia-core-bsxn (Cycle 35) | Date: 2026-04-21

**Scope:** MODIFIED [frontend/src/scenes3d/PokerTable.tsx](frontend/src/scenes3d/PokerTable.tsx#L42); MODIFIED test [frontend/test/scenes3d/PokerTable.potSweep.test.tsx](frontend/test/scenes3d/PokerTable.potSweep.test.tsx).

**Gate:** 1866 → 1872 (+6; +1 from H-2 regression test, +5 from concurrent sqi1 landing in Cycle 36). All 1872 pass. Lint delta: unchanged (1 pre-existing `no-console` unused-directive warning in [PokerTable.tsx:159](frontend/src/scenes3d/PokerTable.tsx#L159) — identical before and after H-2 fix).

---

## Summary

```
CRITICAL: 0 findings
HIGH: 0 findings
MEDIUM: 2 findings
LOW: 2 findings
```

No critical/high issues. The fix correctly eliminates the first-commit full-pot flash by (a) deriving in-flight outflow from React state (`activeSweeps` sum) during the steady-state tween and (b) falling back to an inline `computePotSweepDeltas(prev, state, layout)` diff on the transitional render before `<PotSweepDriver>`'s post-commit sync effect has fired. Test coverage is targeted and precise — a Profiler-based commit snapshot observes the exact frame where the bug manifested and asserts the pot ChipStack's stable `id` is either unmounted or carries amount 0 on every post-winner-state commit. Four T-012 ACs and the reduced-motion path are preserved. Findings below are minor.

---

## MEDIUM

### [M-1] `frontend/src/scenes3d/PokerTable.tsx:331-350` — Same latent flash in T-011 `inFlightForSeat` path (intentional out-of-scope)

T-011's chip-slide uses the identical ref-read pattern Hank just replaced here:
```ts
const inFlightForSeat = (seatIndex: number): number => {
  return controllerRef.current?.getInFlightAmountForSeat(seatIndex) ?? 0;
};
// ...
const display = Math.max(
  0,
  seat.committedThisStreet - inFlightForSeat(seat.seatIndex) - deposited,
);
```
On the first commit after a bet lands at a seat, `controllerRef.current.getInFlightAmountForSeat` returns 0 until `<ChipSlideDriver>`'s post-commit sync effect fires — so `display === seat.committedThisStreet` briefly, producing a symmetric flash before the chip slides out. Cycle 35 H-2 and the xc33 description both flagged this as "the same pattern"; the xc33 acceptance criteria explicitly marks it as a review-or-document-divergence item. Hank correctly scoped this fix to the pot-sweep path only, leaving T-011 untouched as instructed.

**Suggested fix:** File a follow-up beads bug (child of aia-core-6o9t) to apply the same `activeSlides`-summed + inline-deltas pattern to `inFlightForSeat`. Reference [chipSlides.ts](frontend/src/scenes3d/animations/chipSlides.ts)'s `computeChipSlideDeltas` (pure) and mirror the `activeSweeps.length > 0 ? sum : inline-diff` branching from this fix. Not a blocker for xc33 close.

### [M-2] `frontend/src/scenes3d/PokerTable.tsx:417-447` — Inline `computePotSweepDeltas` is evaluated on *every* render while tween is inactive

`potSweepInFlight` is memoised on `[activeSweeps.length, activeSweepTotal, prevStateForDiff, state, potSweepLayout]`. Under steady state (no tween in progress), `activeSweeps.length === 0`, so the memo falls into the inline-deltas branch. `prevStateRef.current` is updated via a post-commit `useEffect`, so on the render immediately following any `state` prop change, `prevStateForDiff !== state` and the memo re-runs `computePotSweepDeltas(...)`. For a typical hand (hundreds of state snapshots), that's hundreds of `computePotSweepDeltas` calls, each iterating `state.seats` and doing small scalar math. Cost is negligible in practice (the function is O(seats) ≈ O(9)) but it is work that could be fully skipped when `!state.seats.some(s => s.result === 'won')` — the short-circuit condition the pure function itself checks near the top.

**Suggested fix:** Optional early-return before calling `computePotSweepDeltas`:
```ts
if (!state.seats.some((s) => s.result === 'won')) return 0;
```
Or accept the ~9-iteration cost and keep the current shape. Cosmetic performance — no user-visible impact.

---

## LOW

### [L-1] `frontend/src/scenes3d/PokerTable.tsx:422-425` — `prevStateRef` update effect has no explanatory comment

The pattern of capturing `prevStateRef.current` into a local `prevStateForDiff` at the top of render and then assigning `state` to the ref in a post-commit `useEffect` is a classic "previous value" hook. Future readers unfamiliar with the flash scenario may be confused why the ref is not updated during render (the answer: we need the pre-transition snapshot for the inline deltas during the transition render — updating in render would always give `prev === state` and collapse the fallback). A one-line inline comment referencing H-2 / Cycle 37 would prevent a future refactor from "simplifying" this into a render-time assignment and silently resurrecting the flash.

**Suggested fix:** Add `// Ref mutated in useEffect (not render) so the transitional render sees the pre-winner snapshot — see H-2 / Cycle 37 regression.` above the `useEffect`.

### [L-2] `frontend/test/scenes3d/PokerTable.potSweep.test.tsx` — Regression test does not exercise the reduced-motion transitional commit

The H-2 regression test asserts no full-pot flash on the standard (tweened) path. The reduced-motion path also has a transitional render (activeSweeps=[] on first commit, then setState-batched empty after same-pass start+complete), and the existing reduced-motion test asserts the final settled state but not the intermediate Profiler commits. The fix protects both paths by construction (both flow through the same `potSweepInFlight` memo), but a second Profiler-instrumented case with `installReducedMotion(true)` would lock down the invariant.

**Suggested fix:** Add a sibling test in the same `describe` block that calls `installReducedMotion(true)` before render and asserts the same Profiler invariant. Not blocking — the underlying code path is unified so both are covered by the fix's structure.

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| AC-1 | Pot `<ChipStack>` transitions smoothly from pre-winner value to post-sweep value without a one-frame full-pot render at winner-state commit | SATISFIED | [PokerTable.potSweep.test.tsx — "first commit post-winner-state has no full-pot stack at pot origin"](frontend/test/scenes3d/PokerTable.potSweep.test.tsx). Profiler observes every commit; pot stack (stable id) never renders at amount=50 after winner state applied. | Red→green confirmed (red: "expected 50 to be 0", green: pass). |
| AC-2 | Regression test asserts `potDisplay` never equals full pot on any committed frame after `hasWinners === true` | SATISFIED | Same test — iterates `postCommits` and asserts `potStackStill.amount === 0` (or stack unmounted) for every commit. | Assertion message explicitly references H-2 / xc33. |
| AC-3 | Under `prefers-reduced-motion`, pot transitions directly from pre-sweep value to 0 without same-commit intermediate full-pot render | SATISFIED | Existing "reduced motion: pot drains to 0 on the first rerender (no tween)" test still passes. The fix's inline-deltas branch makes the transitional render already-zero regardless of whether the tween is sync (reduced-motion) or async. | See L-2 for optional Profiler-tightened coverage. |
| AC-4 | T-011 `committedThisStreet` outflow path reviewed; same fix applied *or* intentional divergence documented | PARTIAL | T-011 reviewed in Cycle 37 (see M-1). Fix NOT applied — Hank scoped per invocation. Divergence is intentional for this cycle; follow-up beads should be filed before land. | The xc33 description accepts "reviewed OR applied"; reviewed+filed-as-followup satisfies the spirit but leaves the latent T-011 flash in place. |

---

## Additional Review Priorities (from Anna's invocation)

| Concern | Status |
|---|---|
| 1. Flash actually eliminated at first commit | SATISFIED — Profiler-based regression test observes every commit's `_latestStacks` snapshot and confirms the pot stack's stable id is torn down (or zero) before any paint. Red test confirmed the bug (commit #0: amount=50); green test confirms the fix. |
| 2. No regression to T-012 AC-1 / AC-3 / AC-4 or Cycle 35 H-1 (mixed-sign split fallback) | SATISFIED — all 7 tests in [PokerTable.potSweep.test.tsx](frontend/test/scenes3d/PokerTable.potSweep.test.tsx) pass unchanged (AC-1 single winner, AC-2 split, AC-4 all-fold, reduced motion, driver mount, T-011 coordination, H-2 regression). H-1's `allPositive` fallback lives in [potSweeps.ts:96-103](frontend/src/scenes3d/animations/potSweeps.ts#L96) — untouched. |
| 3. No new render-loop / re-render storm from moving outflow to React state | SATISFIED — `activeSweeps` only mutates on sweep start (one setState) and sweep complete (one setState per completion). `potSweepInFlight` useMemo re-runs only when `[activeSweeps.length, activeSweepTotal, prevStateForDiff, state, potSweepLayout]` change — same cadence as before (the old ref-read recomputed every render anyway). `prevStateRef` is a ref, not state — assignment does not trigger render. No new setState paths, no added dependency that ticks per frame. `useFrame`-driven re-renders (via `bumpFrameTick`) are unchanged. |
| 4. Reduced-motion path still correct | SATISFIED — under reduced motion, `createTween` completes synchronously inside `controller.sync`, so `onSweepStart` + `onSweepComplete` both fire in the same effect pass. React batches `setActiveSweeps([slug])` then `setActiveSweeps([])` + `setSweptBySeat({seat: amount})`; the second render sees `activeSweeps=[]` + `sweptBySeat={seat: amount}`. `potSweepInFlight` memo falls into the inline-deltas branch, but `prevStateRef` has already been updated to `state` by the sibling useEffect, so `computePotSweepDeltas(state, state, layout)` correctly returns `[]` (same-handId short-circuit in pure function). `potDisplay = pot + 0 − 0 − pot = 0`. Test confirms. |
| 5. Interaction with T-011 chip-slide — any new issue from split approach? | NO NEW ISSUE — chip-slide uses its own `controllerRef` + `activeSlides` + `depositedBySeat` triad; the H-2 fix adds a parallel `prevStateRef` / inline-deltas pattern to pot-sweep only. There is no shared mutable state between the two paths. Existing "chip-slide at river → showdown sweep" coordination test still passes (scope-cancel on streetIndex change is controller-side, unaffected by the render-level memo change). M-1 flags that T-011 retains the symmetric latent flash and should be patched separately; that's a pre-existing bug, not a new issue introduced here. |

---

## Positives

- **Test-first discipline** — regression test written and confirmed red (amount=50) before any production edit, then green after the fix. The Profiler-based commit snapshot is the most precise way to observe the one-frame bug and stable-id tracking cleanly disambiguates the pot ChipStack from the slug ChipStack (both render at identical world position).
- **Pure-function reuse** — `computePotSweepDeltas` is imported directly from [potSweeps.ts](frontend/src/scenes3d/animations/potSweeps.ts) rather than duplicating the winner-detection / split-math logic; the pure module is the single source of truth for "what sweeps will fire on the next sync". Zero divergence risk between render-path estimate and driver-path reality.
- **Branching is conservative** — the `activeSweeps.length > 0` gate ensures the inline diff fallback only runs on the transitional render; once the driver has taken over (and `prevStateRef` has caught up), `activeSweeps` is the authoritative read. No dual-counting.
- **Comments are scoped and tied to the bug ID** — the `H-2 (aia-core-xc33)` anchor comment explains *why* the computation is dual-sourced, making future maintainers less likely to "simplify" the memo and resurrect the flash.
- **No drive-by refactor** — T-011 chip-slide code explicitly untouched per invocation scope; flagged as M-1 follow-up.

---

## Overall Assessment

**Disposition:** APPROVE for close — zero critical/high findings, fix is minimal and surgical, test coverage is the tightest available for this class of render-timing bug, no regressions across 1872 tests, lint unchanged.

**Before close, Logan should:**
1. File a follow-up beads bug for M-1 (T-011 symmetric chip-slide flash) as `discovered-from: aia-core-xc33`, `parent: aia-core-6o9t`, priority P1.
2. Close aia-core-xc33 with a reason that (a) confirms H-2 eliminated, (b) references this Cycle 37 report, (c) links the new T-011 follow-up bead.

**Suggested close reason:**
> H-2 pot-display first-commit full-pot flash eliminated — `potSweepInFlight` now derives from React state (`activeSweeps` sum) with an inline `computePotSweepDeltas(prev, state, layout)` fallback for the transitional render, so the pot ChipStack's stable id either unmounts or carries amount 0 on the very first commit carrying `result === 'won'`. Profiler-based regression test added to `PokerTable.potSweep.test.tsx` observes every commit and asserts the invariant (red: amount=50 pre-fix → green post-fix). T-012 AC-1/3/4 + Cycle 35 H-1 (mixed-sign split fallback) + reduced-motion path all preserved (7/7 potSweep tests pass, full suite 1872/1872). Lint unchanged. T-011 `inFlightForSeat` has the symmetric latent flash — reviewed, not fixed in this cycle per invocation scope, filed as follow-up. See docs/agent/reviews/cycle-37-aia-core-xc33-2026-04-21.md.

---

## Anna-Parseable Findings Block

```yaml
cycle: 37
task: aia-core-xc33
epic: aia-core-6o9t
date: 2026-04-21
counts:
  critical: 0
  high: 0
  medium: 2
  low: 2
findings:
  - id: M-1
    severity: MEDIUM
    file: frontend/src/scenes3d/PokerTable.tsx
    lines: 331-350
    title: T-011 inFlightForSeat has same latent flash (out-of-scope, follow-up)
    blocker: false
  - id: M-2
    severity: MEDIUM
    file: frontend/src/scenes3d/PokerTable.tsx
    lines: 417-447
    title: Inline computePotSweepDeltas runs every render while tween inactive
    blocker: false
  - id: L-1
    severity: LOW
    file: frontend/src/scenes3d/PokerTable.tsx
    lines: 422-425
    title: prevStateRef update effect lacks explanatory comment
    blocker: false
  - id: L-2
    severity: LOW
    file: frontend/test/scenes3d/PokerTable.potSweep.test.tsx
    title: Reduced-motion path not Profiler-instrumented in regression test
    blocker: false
ac_status:
  AC-1: SATISFIED
  AC-2: SATISFIED
  AC-3: SATISFIED
  AC-4: PARTIAL  # T-011 reviewed, not fixed — file follow-up beads before close
disposition: APPROVE
gate:
  tests_before: 1866
  tests_after: 1872
  tests_added: 1
  tests_pass: 1872
  lint_delta: unchanged
```
