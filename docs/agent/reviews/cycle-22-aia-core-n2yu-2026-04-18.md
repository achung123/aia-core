# Code Review — Cycle 22 · aia-core-n2yu (T-025)

**Target:** T-025 — Apply visibility policy through `<Card>` faceUp
**Epic:** aia-core-6o9t (table-3d-revamp-010)
**Beads ID:** aia-core-n2yu
**Reviewer:** Scott (Cyclops)
**Date:** 2026-04-18
**Cycle:** 22

---

## Scope

- [frontend/src/scenes3d/PokerTable.tsx](frontend/src/scenes3d/PokerTable.tsx) — `<Seats>` loop now gates hole-card visibility through `canSee()`; own-seat id nulling when `faceUp=false`.
- [frontend/src/scenes3d/components/Card.tsx](frontend/src/scenes3d/components/Card.tsx) — adds `data-testid="card-face-up"|"card-face-down"` alongside existing `data-face-up` and `userData.faceUp` hooks.
- [frontend/src/scenes3d/state/visibilityPolicy.ts](frontend/src/scenes3d/state/visibilityPolicy.ts) — MED-2 security-model comment added; logic unchanged.
- [frontend/test/scenes3d/PokerTable.test.tsx](frontend/test/scenes3d/PokerTable.test.tsx) — 7 new wiring tests (block at L177+).
- [frontend/test/scenes3d/state/visibilityPolicy.test.ts](frontend/test/scenes3d/state/visibilityPolicy.test.ts) — unit-level canSee matrix (phases × policies × fold).

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 3 |
| LOW | 4 |

Implementation is clean. Security-in-depth via `id={null}` is correctly layered on top of `Card`'s existing `resolveCanonicalId(..., faceUp)` fallback to `BACK_KEY`, giving a genuine double gate. `canSee()` unit tests exercise all 6 `TableStatePhase` values × both policies × both fold states. Suite green at 1672/1672. No blockers — approve close.

---

## Findings by Severity

### CRITICAL — 0

_None._

### HIGH — 0

_None._

### MEDIUM

**MED-1 — AC 1 wiring coverage is vacuous for folded opponents.**
`specs/table-3d-revamp-010/tasks.md` T-025 AC 1 is "folded opponents never revealed." The wiring test at [PokerTable.test.tsx L521-546](frontend/test/scenes3d/PokerTable.test.tsx#L521-L546) correctly documents that T-009's `renderHole = seat.isActive && !seat.folded` short-circuits folded seats to zero cards, but that makes the `for (const c of all)` loop iterate zero times for `seat-1` — the assertion never executes. AC 1's T-025 contract (i.e. "even if we *did* render a folded opponent's cards, `canSee` would return false") is only covered by the unit-level `canSee` matrix in [visibilityPolicy.test.ts L126-139](frontend/test/scenes3d/state/visibilityPolicy.test.ts#L126-L139). That is acceptable — the unit test is the stronger contract — but the wiring test should either:

- assert explicitly that `holeCardsOfSeat(container, 1)` is `[]` for the folded seat (documenting the T-009 interaction rather than silently passing an empty loop), or
- be deleted in favour of a comment pointing at the unit test.

As written, the test reads as if it exercises the T-025 path but does not. Answer to focus question (b): trivial satisfaction is acceptable _given_ the unit-level contract test, but the wiring test should make the invariant explicit rather than relying on a vacuous loop.

**MED-2 — `data-testid` on `<Card>` mesh is a test-only concern bled into production.**
[Card.tsx L135-137](frontend/src/scenes3d/components/Card.tsx#L135-L137) emits three redundant visibility hooks on every card mesh:

```tsx
data-card-id={canonicalId}
data-face-up={String(faceUp)}
data-testid={faceUp ? 'card-face-up' : 'card-face-down'}
userData={{ cardId: canonicalId, faceUp, tier }}
```

Previous cycles settled on `userData` as the production hook (consumed by animation drivers, equity badges, etc.) and `data-face-up` as the DOM-scraping hook for happy-dom tests. `data-testid` is a fourth mechanism that encodes boolean state in a string value — tests that read it (e.g. [PokerTable.test.tsx L492, L565](frontend/test/scenes3d/PokerTable.test.tsx#L492)) duplicate what `data-face-up` already expresses. Answer to focus question (d): this is a coupling leak in the sense that it adds a redundant production attribute for test convenience. Recommend standardising on `data-face-up` for DOM-scraping tests and dropping `data-testid` from `<Card>` entirely, or — if `data-testid` is intended to be T-055's integration hook — documenting that intent in a JSDoc comment on `<Card>` so future contributors know not to remove it. File a follow-up.

**MED-3 — Wiring tests exercise only a subset of phases.**
[PokerTable.test.tsx](frontend/test/scenes3d/PokerTable.test.tsx) T-025 block covers `preflop`, `flop`, `turn`, `showdown`. `awaiting_cards` and `river` are not exercised end-to-end. The `canSee` unit matrix covers all six, so the policy contract is sound, but a regression that broke the wiring specifically on `river` or `awaiting_cards` (e.g. a future refactor that special-cased phases in the seat loop) would not be caught by wiring tests. Answer to focus question (e): unit level is exhaustive; wiring level is pragmatic-but-partial. Accept with a follow-up to parameterize the existing wiring tests over all `ALL_PHASES` / `PRE_SHOWDOWN_PHASES` constants already exported from the unit file.

### LOW

**LOW-1 — `holeId` closure recomputed per seat per render.**
[PokerTable.tsx L338-339](frontend/src/scenes3d/PokerTable.tsx#L338-L339) declares `const holeId = (slot: 0 | 1) => ...` inside the `state.seats.map` callback. Fine for readability; trivially eliminable by inlining the two expressions. Not worth changing alone; note for next refactor.

**LOW-2 — `viewerSeat` fallback logic duplicated from `canSee` semantics.**
[PokerTable.tsx L330-333](frontend/src/scenes3d/PokerTable.tsx#L330-L333) computes `viewerSeat = viewer?.policy === 'player' && typeof viewer.seat === 'number' ? viewer.seat : null`. `canSee` already handles `viewerSeat=null` correctly under `player` policy (see unit test "treats viewerSeat=null as non-owner in player policy" at [visibilityPolicy.test.ts L174-204](frontend/test/scenes3d/state/visibilityPolicy.test.ts#L174)), so the `typeof viewer.seat === 'number'` guard is defensive redundancy. Keep as defence in depth, but a short inline comment noting "`canSee` tolerates null viewerSeat; this guard is a type-narrowing convenience" would prevent a future contributor from "simplifying" it away.

**LOW-3 — `viewer` prop not propagated to `Nameplates` / `DealAnimationDriver` / `ChipSlideDriver`.**
Answer to focus question (f): by design none of those consumers need the viewer — nameplates expose only public info (name + stack), deal animations tween back-faced cards to seat anchors where the static `<Card>` decides face resolution via `faceUp`, and chip slides tween public amounts. No coupling leak, no gap. Document this explicitly in `PokerTable.tsx` JSDoc to preempt the "did we forget to pass viewer?" review question in future cycles.

**LOW-4 — `viewerPolicy: viewer?.policy ?? 'spectator'` computed twice per render.**
Once in the scene-root `userData` at [PokerTable.tsx L293](frontend/src/scenes3d/PokerTable.tsx#L293) and again inside the seats map at [L329](frontend/src/scenes3d/PokerTable.tsx#L329). Hoist to a single `const viewerPolicy = viewer?.policy ?? 'spectator'` near the top of the component body. Also answers focus question (c): the default `'spectator'` is the correct fail-safe — any route that forgets to pass `viewer` will hide hole cards until showdown, which is the secure default. Good call.

---

## Answers to Focus Questions

**(a) Security-in-depth — does `id={null}` actually prevent face data reaching the render tree?**
Yes, confirmed solid. Two layers in the client, one on the server:

1. `<Seats>` loop computes `faceUp = canSee(...)`; when false, `holeId(slot)` returns `null` before `<Card>` ever receives the id string.
2. `<Card>` then runs `resolveCanonicalId(null, false)` at [Card.tsx L80-84](frontend/src/scenes3d/components/Card.tsx#L80-L84) which unconditionally returns `BACK_KEY`, and the UV-baking `useLayoutEffect` at [Card.tsx L117-123](frontend/src/scenes3d/components/Card.tsx#L117-L123) uses `resolveCardUV(id, faceUp)` — so even if `id` leaked through, the UV would still be the back cell.
3. The server-side dealer-API gate documented in the MED-2 comment on [visibilityPolicy.ts L10-17](frontend/src/scenes3d/state/visibilityPolicy.ts#L10-L17) remains the trust boundary.

The face-id string genuinely never enters the render tree (nor `userData`, nor `data-card-id`) for an unauthorized viewer. Verified by inspecting test `spectator policy: all hole cards face-down pre-showdown` at [PokerTable.test.tsx L569-588](frontend/test/scenes3d/PokerTable.test.tsx#L569) which asserts `data-face-up='false'` on all seat cards — and the parallel test at L521+ that checks `data-card-id='back'` for opponent cards.

**(b) Folded opponent AC 1 trivially satisfied** — see MED-1. Acceptable given unit coverage, but wiring test should be made explicit.

**(c) Default viewer = spectator** — sensible fail-safe. See LOW-4.

**(d) `data-testid` strategy** — see MED-2. Redundant with `data-face-up`; coupling concern is minor but real.

**(e) Phase coverage** — unit tests exhaustive; wiring tests partial. See MED-3.

**(f) Viewer propagation** — correctly scoped to camera + seats only. See LOW-3.

---

## Acceptance Criteria Mapping

| AC | Status | Evidence |
|---|---|---|
| AC 1 — Folded opponents never revealed | COVERED (via unit) | [visibilityPolicy.test.ts L126-139](frontend/test/scenes3d/state/visibilityPolicy.test.ts#L126-L139); wiring test vacuous (see MED-1). |
| AC 2 — Non-folded opponents reveal at showdown (both policies) | COVERED | [PokerTable.test.tsx L548-566](frontend/test/scenes3d/PokerTable.test.tsx#L548-L566) + spectator at L588-611. |
| AC 3 — Own cards always face-up under player policy | COVERED | [PokerTable.test.tsx L477-496](frontend/test/scenes3d/PokerTable.test.tsx#L477-L496); unit matrix all phases at [visibilityPolicy.test.ts L92-123](frontend/test/scenes3d/state/visibilityPolicy.test.ts#L92-L123). |
| AC 4 — Opponents hidden pre-showdown | COVERED | [PokerTable.test.tsx L498-519](frontend/test/scenes3d/PokerTable.test.tsx#L498-L519); spectator equivalent at L569-588. |

All four ACs have passing tests. No gaps that block close.

---

## Recommendation

**Approve close.** 0 HIGH, 0 CRITICAL. Record MED-1 / MED-2 / MED-3 and LOW-1..4 as follow-ups in `specs/table-3d-revamp-010/tasks.md` Cycle 22 ledger.
