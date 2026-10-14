# Code Review Report — T-012 Pot Sweep Animation

**Loop Context:** Cycle 35 | Task: aia-core-bsxn (T-012) | Epic: aia-core-6o9t | Date: 2026-04-21

**Scope:** NEW `frontend/src/scenes3d/animations/potSweeps.ts`, `PotSweepController.ts`, `PotSweepDriver.tsx`; MODIFIED `frontend/src/scenes3d/PokerTable.tsx`; NEW tests `test/scenes3d/potSweeps.test.ts`, `PotSweepController.test.ts`, `PokerTable.potSweep.test.tsx`.

**Gate:** 1839 → 1866 (+27), all pass. Lint baseline unchanged.

---

## Summary

```
CRITICAL: 0 findings
HIGH: 2 findings
MEDIUM: 4 findings
LOW: 2 findings
```

No critical issues. Implementation faithfully mirrors T-010/T-011's controller+driver architecture and cleanly isolates pure event computation from framework concerns. The four ACs are observable in unit + integration tests. Findings below are refinement opportunities — a couple of split-pot edge cases deserve follow-up tests but are not blockers.

---

## HIGH

### [H-1] `frontend/src/scenes3d/animations/potSweeps.ts:92-103` — Winners with non-positive `profitLoss` can receive zero chips in a split pot

`computePotSweepDeltas` clamps each winner's `profitLoss` via `Math.max(0, pl ?? 0)` and splits strictly proportional to that clamped value. This produces a pathological result when one winner has `profitLoss > 0` but a co-winner has `profitLoss ≤ 0` (a realistic side-pot scenario — e.g. a short stack wins only a side pot smaller than their contribution, so their `profitLoss` is negative even though `result === 'won'`):

```
pot = 100, winners = [{pl: 50}, {pl: -10}]
positivePls = [50, 0], plSum = 50
shares[0] = (50/50) * 100 = 100
shares[1] = 100 - 100 = 0   ← winner with result='won' gets zero chips visually
```

Similarly a `won` seat whose `profitLoss` happens to be `0` alongside a positive co-winner gets zero share. The existing "fallback to equal shares if no positive profitLoss available on any winner" branch only triggers when `plSum === 0`, not when some winners are positive and others are zero/negative.

**Suggested fix:** When any winner has `profitLoss ≤ 0` but `result === 'won'`, fall back to equal split (or use `Math.max(epsilon, pl)` per winner), so every declared winner always receives a visible chip amount. Add a dedicated unit test covering mixed-sign `profitLoss` among winners (it is not currently covered — see M-4).

### [H-2] `frontend/src/scenes3d/PokerTable.tsx:350-363` — `potDisplay` may render full pot for one frame before `<PotSweepDriver>`'s sync effect fires

`potDisplay = max(0, state.pot + depositedTotal − potSweepInFlight() − potSweepArrived)` is computed during PokerTable's render. `potSweepInFlight()` reads from `potSweepControllerRef.current`, which is updated from `<PotSweepDriver>`'s `useEffect` that runs *after* children commit. On the very first render that carries the winner state, the driver's sync effect has not yet fired → no slug has been registered → `potSweepInFlight() === 0` and `potDisplay === state.pot`. On the next render (triggered by `setActiveSweeps` inside `handleSweepStart`), `potDisplay` collapses to 0 and the slug appears.

Visually this is a single-frame flash of the full pot stack at `POT_CHIP_WORLD_POSITION` before the sweep begins. T-011 has the same pattern and this is an accepted tradeoff in that cycle, but it's worth flagging because:

1. The same shim (pot stack visible during the first commit frame) can produce a visible pop under reduced-motion too, since the sweep completes synchronously within the second effect pass — user sees `pot=50` then `pot=0` within two frames with no tween.
2. Integration tests do not assert on the very first committed frame (they measure *after* the rerender settles), so this is not covered by tests.

**Suggested fix (optional):** Consider deriving `potSweepInFlight` from state maintained by start/complete handlers (like `activeSweeps`) rather than a live controller read — the `onSweepStart` setState already batches with React's render cycle, so `potDisplay` would reflect the outflow on the same commit. Alternatively accept the flash and document the one-frame behaviour alongside the existing T-011 note.

---

## MEDIUM

### [M-1] `specs/table-3d-revamp-010/tasks.md:273` (AC 2) / `potSweeps.ts:92-103` — Literal interpretation of "proportional to profit_loss" is not standard poker semantics

Hank implemented AC 2 literally: shares are proportional to the winners' positive `profitLoss`. But in real poker, split pots should visually reflect **pot contribution-weighted share of the pot**, not net `profitLoss`. For a clean two-way chop of a single pot with equal contributions, PLs happen to be equal and the implementation coincidentally gets it right; but for main-vs-side-pot chops, `profitLoss` is the wrong signal.

Example: main pot $60, side pot $40, both "won" by two players. `state.pot = 100` (aggregated). Winner A (long stack) won only the side: profitLoss = +40. Winner B won only the main: profitLoss = +30. T-012 animates a single aggregate pot, and the shares come out as 40/70·100 ≈ $57 and 30/70·100 ≈ $43 — mismatched with what each winner actually pocketed. This is an AC authorship concern, not a Hank implementation defect, but Scott is flagging it for Jean's consideration.

**Suggested fix:** Out-of-scope for this task, but file a follow-up bd so the split-pot semantics can be revisited (likely wire through `sidePots` explicitly once T-012's showdown reveal T-013 or side-pot visualization lands).

### [M-2] `frontend/src/scenes3d/PokerTable.tsx:632-678` — `<FlyingChipSlug>` and `<FlyingPotSweepSlug>` are near-duplicates

The two components differ only in their `controllerRef` type and the key prop name. Hank's inline comment notes "kept as a separate component so each driver owns its own controller-type contract (resolves the cross-type narrowing that would otherwise need a union)" — defensible, but a `<FlyingSlug<TController>>` generic or a shared interface `{ getInFlightPosition(key: string): Vec3 | null }` extracted into a mini-adapter would remove the duplication cleanly.

**Suggested fix:** Extract a shared `FlyingSlug` component that accepts `getPosition: (key: string) => Vec3 | null` as a prop. Defer if T-021 (camera presets) is expected to add a third similar slug; otherwise a 5-line refactor.

### [M-3] `frontend/src/scenes3d/PokerTable.tsx:332-346` — `sweptBySeat` accumulates across any mid-hand state updates after resolution

`sweptBySeat` is only reset on `state.handId` change. Once the sweep completes, `potSweepArrived` holds the full swept amount until the next hand starts. If the backend pushes any additional updates within the same hand after resolution (e.g. a second `showdown` update for sidepot announcements, or a phase-only change), `state.pot` may rise or reset while `potSweepArrived` still carries the old delta — `potDisplay` would then display stale arithmetic. The `Math.max(0, …)` clamp masks negative values but a legitimate post-resolution pot (unlikely but not structurally forbidden) would be incorrectly hidden.

**Suggested fix:** Scope the sweep arrival register by `(handId, resolution-signature)` or reset `sweptBySeat` whenever `state.seats.some(s => s.result === 'won')` transitions false→true (not just on handId change). Alternatively, explicitly document that the backend guarantees no further pot-relevant updates within a resolved hand.

### [M-4] Test coverage gap — no unit test for split math with mixed-sign or zero `profitLoss`

`test/scenes3d/potSweeps.test.ts` covers single winner, even/proportional split with positive PLs, all-null PLs (equal-share fallback), and all-fold. Missing:
- One winner has `profitLoss > 0`, another has `profitLoss <= 0` (directly exercises H-1).
- Two winners both with `profitLoss = 0` alongside a third positive winner.
- Backend sidepot scenario where multiple winners have asymmetric positive PLs that don't divide the pot cleanly (e.g. PLs 17 and 33 on a pot of 50; verify no loss to float drift).

**Suggested fix:** Add three unit tests in `potSweeps.test.ts` covering these. At minimum, H-1 requires a regression test once fixed.

---

## LOW

### [L-1] `frontend/src/scenes3d/animations/PotSweepController.ts:99-108` — Minor ordering doc missing for reduced-motion

The inline comment explains firing `onSweepStart` before `createTween` to preserve lifecycle ordering under reduced-motion, identical to ChipSlideController Cycle 19 M-3 resolution. For symmetry with the matching ChipSlideController comment, reference the specific PR/cycle where this convention was established so future readers can trace why the order matters.

**Suggested fix:** Append `(see ChipSlideController.ts comment; same convention)` to the existing note. Cosmetic.

### [L-2] `frontend/src/scenes3d/animations/PotSweepDriver.tsx:71-80` — Effect that updates refs omits its dependency array

The ref-syncing effect runs every render (no deps array), which is the conventional "latest-ref" pattern but eslint-react-hooks/exhaustive-deps will be silent only because no deps are referenced. Consistent with ChipSlideDriver, but consider documenting inline: `// latest-ref pattern — intentional no-deps, runs every render`.

**Suggested fix:** Add one-line comment for future readers. No behavioural change.

---

## AC Verification

| AC | Status | Notes |
|----|--------|-------|
| AC-1 Single winner: entire pot slides to them | SATISFIED | `potSweeps.test.ts` "AC 1" + `PotSweepController.test.ts` "AC 1" + `PokerTable.potSweep.test.tsx` "AC 1". Integration test asserts slug amount=50 at pot origin mid-flight, pot drains at end. |
| AC-2 Split pot: proportional to `profit_loss` shares | PARTIAL | Proportional math is correct for the common "all positive PL" case and covered by 3 unit tests + 1 integration test. Fails for winners with `profitLoss <= 0` alongside positive co-winners (H-1). AC wording itself is arguably wrong poker semantics (M-1). |
| AC-3 After animation, pot `<ChipStack>` shows zero | SATISFIED | `potDisplay = pot − inFlight − arrived` with Math.max(0, …) clamp. `PokerTable.potSweep.test.tsx` explicitly asserts `findStackNear(end, POT_CHIP_WORLD_POSITION)).toBeUndefined()` in AC 1, AC 2, AC 4, reduced-motion, and coordination tests. Controller unit test confirms outflow returns to 0. Minor one-frame pre-sweep flash (H-2) does not violate AC. |
| AC-4 All-fold: pot sweeps to sole active seat | SATISFIED | Trigger is result-based (`result === 'won'`), independent of phase/streetIndex — all three test files exercise `phase='river'`/`streetIndex=3` with a single winner and verify a sweep fires. |

### Additional review priorities from Anna's invocation

| Concern | Status |
|---|---|
| Split math rounding | SATISFIED — last-share fixup tested; sum === pot exactly |
| Split edge cases — all-zero PL, negative PL | PARTIAL — all-zero (via `profitLoss: null`) covered; negative/mixed NOT covered (see H-1, M-4) |
| T-011 showdown coordination | SATISFIED — `streetIndex=4` is a scope change in `ChipSlideController`; mid-flight slides are cancelled before the pot sweep reads `state.pot`. Explicit coordination test in `PokerTable.potSweep.test.tsx` ("chip-slide at river → showdown sweep") asserts no phantom stacks. Order-of-effects is child-before-parent (ChipSlideDriver sync fires before PokerTable's scope-change reset effect), which is correct. |
| Reduced-motion path | SATISFIED — `onSweepStart` fires BEFORE `createTween`; under reduced motion `createTween` completes synchronously so `onSweepComplete` runs inside the same `sync()` call, batched with `setActiveSweeps([...])`; React sees both updates together and the slug never renders. Integration test `reduced motion: pot drains to 0 on the first rerender (no tween)` confirms. |
| `FlyingChipSlug` vs `FlyingPotSweepSlug` duplication | Noted as M-2. |
| Cross-hand cancel race | SATISFIED — controller clears `active` + `inFlight` on handId change without firing `onSweepComplete`; PokerTable's `useEffect([state.handId])` clears `activeSweeps` + `sweptBySeat` on the same transition. No onComplete can fire for the stale hand because cancel() short-circuits the tween. |
| M1/M2 (`bumpFrameTick`) regression | SATISFIED — `bumpFrameTick` passed through to `<FlyingPotSweepSlug>` identically to `<FlyingChipSlug>`; no changes to the reducer or its invocation path. |
| Chip-accounting drift between T-011 deposits, T-012 sweep, and `state.pot` | SATISFIED — `depositedBySeat` resets on `(handId, streetIndex)` change (which includes the preflop→flop→turn→river→showdown transitions), so by the time sweep begins `depositedTotal === 0`. Backend has already absorbed `committedThisStreet` into `state.pot`. Sweep amounts are derived directly from `state.pot`. No double-count path. |

---

## Commit / Gate Status

- All 1866 frontend tests pass (+27 new).
- Ruff/ESLint baseline unchanged.
- No CRITICAL findings → safe for Anna to proceed to land. H-1 and M-3/M-4 should be addressed in a follow-up bd (filed by Logan) rather than blocking this cycle, given they are edge cases and AC 2 is mathematically satisfied as written for the common path.
