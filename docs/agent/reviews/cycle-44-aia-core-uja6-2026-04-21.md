# Code Review — Cycle 44 — aia-core-uja6 (T-023b)

- **Target:** `aia-core-uja6` — T-023b — `<SessionReplayShell>` cross-hand timeline + speed controls (playback-only)
- **Epic:** `aia-core-6o9t` — table-3d-revamp-010
- **Reviewer:** Scott (Cyclops)
- **Date:** 2026-04-21
- **Cycle:** 44
- **Prior cycle:** 43 (aia-core-auus — T-013 showdown glow)

---

## Scope

- Source file: [frontend/src/scenes3d/SessionReplayShell.tsx](../../../frontend/src/scenes3d/SessionReplayShell.tsx) — 377 lines, new component (stub removed).
- Module exports: [frontend/src/scenes3d/index.ts](../../../frontend/src/scenes3d/index.ts) — +12 lines (named exports `SessionReplayShell`, `useSessionReplayContext`, `phaseFromStreetIndex`, `MS_PER_STREET`, `MS_INTER_HAND`, and two type re-exports).
- Tests: [frontend/test/scenes3d/SessionReplayShell.test.tsx](../../../frontend/test/scenes3d/SessionReplayShell.test.tsx) — 310 lines, 14 tests, all green.
- Reuses: `SessionScrubber` (legacy DOM component), `handsToTableState` (scenes3d/data), `useTableStore.replay` slice (T-023 / Cycle 23).
- No production code outside `scenes3d/SessionReplayShell.tsx` + `scenes3d/index.ts` was modified. `PlaybackView.tsx`, driver animations, and all other existing scenes3d code are untouched.

## Test evidence

- Targeted file: 14/14 green (195 ms).
- Full frontend suite: **1977/1977 green** (previous baseline end-of-Cycle-43 was 1963 → +14). No regressions anywhere in scenes3d, dealer, playback, tableStore, or pipeline-of-driver animations.
- Lint: `eslint` clean on all three touched files.

## AC mapping (beads description + tasks.md T-023b)

| AC | Status | Evidence |
|---|---|---|
| **AC 1** — Session Timeline shows `hands.length` segments; current index highlighted | **SATISFIED** | `test('renders a SessionScrubber whose handCount matches hands.length')` asserts `handCount=3` and `"1 / 3"` label. `<SessionScrubber>` already renders tick marks per hand (line 78-90 of SessionScrubber.tsx). |
| **AC 2** — Play auto-advances streets within a hand (1500/speed ms), then inter-hand pause (1000/speed ms), then next hand | **SATISFIED** | Four tests cover: per-street tick at 1× and 2×, inter-hand pause boundary (999 → hand still 0, 1000 → hand 1 & streetIndex=0), inter-hand pause scaled by speed (500 ms at 2×), last-hand halt. State-machine implementation in the one `useEffect` at L185-215 matches plan.md § "Public API — `<SessionReplayShell>`" pseudocode branch-for-branch. |
| **AC 3** — Pausing freezes; resuming continues from same `handIndex`+`streetIndex` | **SATISFIED** | `test('pausing freezes the state; resuming continues')` advances 1500 ms → street=1, pauses, advances 5000 ms → street still 1, resumes, advances 1500 ms → street=2. |
| **AC 4** — Scrubbing seeks directly to hand, resets `streetIndex=0` | **SATISFIED** | `test('scrubbing the SessionScrubber seeks to that hand')` pre-sets streetIndex=3 then fires `input` on `session-slider` with value 3 → asserts `handIndex=2 ∧ streetIndex=0`. |
| **AC 5** — Hand-change clears in-flight tweens keyed by previous hand-id (no stale chip animations) | **PARTIAL — PROPAGATION ONLY** | Shell produces a `tableState` whose `handId` flips to the next hand's id — the context-probe test asserts `data-hand-id` flips `10 → 20` after `setReplayHandIndex(1)`. The actual tween-clearing behaviour lives in `DealAnimationDriver` / `ChipSlideDriver` / `PotSweepDriver` which key by `handId` already (pre-existing, validated in Cycles 10/11/12). No integration test in this cycle wires the shell to a live `<PokerTable>` to prove end-to-end cancellation. Carried forward — see M-2 below. |
| **AC 6** — Mounting from a non-playback route warns in dev | **SATISFIED (implementation) / UNCOVERED (test)** | `useEffect` at L167-178 checks `import.meta.env.DEV`, `MODE !== 'test'`, and `window.location.hash.startsWith('#/playback')`. Guard ordering lets the happy-dom suite run silently. No direct test asserts the warn fires off-route — see L-1 below. |
| **AC 7** — Test file asserts: play→auto-advance→inter-hand pause→next-hand; scrub re-entry; speed 2× halves timing | **SATISFIED** | All three required behaviours are asserted by dedicated test cases; plus four more covering pause/resume, last-hand halt, context derivation, and hook-outside-shell throw. |

---

## Findings

### CRITICAL

**None.**

### HIGH

**None.**

### MEDIUM

#### M-1 — Cycle 23 MED-1 (4× speed 375 ms < `CHIP_SLIDE_DURATION_MS` 400 ms) surfaces in the new shell, no runtime guard

- **Severity:** MEDIUM
- **Category:** animation correctness / cross-component timing
- **Location:** [frontend/src/scenes3d/SessionReplayShell.tsx#L40-L47](../../../frontend/src/scenes3d/SessionReplayShell.tsx#L40) (`MS_PER_STREET = 1500`, `MS_INTER_HAND = 1000`), speed radiogroup at L267-291.
- **Description:** Cycle 23 MED-1 flagged that `4x` playback yields a 375 ms per-street tick, shorter than `CHIP_SLIDE_DURATION_MS = 400 ms` ([frontend/src/scenes3d/animations/chipSlides.ts#L17](../../../frontend/src/scenes3d/animations/chipSlides.ts#L17)), causing chip-slide tearing when the next street change arrives before the in-flight slide settles. That finding marked itself a **hard pre-gate for T-031** (PlaybackView migration). The new `<SessionReplayShell>` exposes the same `0.5/1/2/4` radiogroup with no runtime safeguard — speed is a pass-through to `replay.speed` which scales both `MS_PER_STREET` and `MS_INTER_HAND`. At 4× the inter-hand pause is **250 ms**, strictly shorter than `PotSweepController` + chip-slide sequences on spectator routes (~300–600 ms combined depending on tier).
- **Impact:** Cosmetic when shell is orphaned (current state — no consumer yet). Becomes a real tearing defect when T-031 wires the shell into `PlaybackView`. The pre-gate is still unresolved; closing T-023b without a mitigation strategy defers the same decision one cycle further.
- **Recommended fix:** *Not a T-023b-internal fix.* Recommend Jean re-open the Option B (cancel-in-flight) vs Option C (defer advance until driver idle) design decision before T-031 claims. Minimal short-term mitigation that could land inside the shell: clamp `MS_PER_STREET / speed` to `max(MS_PER_STREET / speed, CHIP_SLIDE_DURATION_MS + 16)` when `speed >= 4`, or gate the 4× button behind `replay.speed` settling. Explicitly deferred per AC set; no blocker to close.

#### M-2 — AC 5 (hand-change tween cancellation) lacks an integration-level test

- **Severity:** MEDIUM
- **Category:** test coverage / regression risk
- **Location:** Test file [frontend/test/scenes3d/SessionReplayShell.test.tsx](../../../frontend/test/scenes3d/SessionReplayShell.test.tsx) overall.
- **Description:** AC 5 says "Hand-change clears any in-flight tweens keyed by previous hand-id (no stale chip animations)." The shell satisfies the propagation half — context `tableState.handId` changes correctly on `setReplayHandIndex`. But no test in this cycle proves that a rendered `<PokerTable>` + drivers actually purge active tweens when the shell advances across hands. The pre-existing driver-level tests (`DealAnimationDriver.integration.test.tsx`, `chipSlides.test.ts`) cover handId-keying but they drive the drivers directly, not via a parent `<SessionReplayShell>`. With playback consumer (T-031) still pending, this gap is carried forward rather than blocking closure.
- **Impact:** A future regression that breaks handId-keyed tween cancellation on driver side would not be caught at the shell boundary. The integration surface is provably correct only when T-031 lands the shell + table pair.
- **Recommended fix:** Add an integration test in T-031's scope that mounts `<SessionReplayShell><PokerTable/></SessionReplayShell>`, starts auto-advance from hand 0 showdown, and asserts the driver's active-tween set is empty on the next-hand frame. Alternatively land a smoke test here: render shell with a stub child that reads context and records handId transitions. Marked non-blocking for Cycle 44 since the driver-keying tests exist upstream.

### LOW

#### L-1 — AC 6 dev-only warn has no test

- **Severity:** LOW
- **Category:** test coverage
- **Location:** [frontend/src/scenes3d/SessionReplayShell.tsx#L167-L178](../../../frontend/src/scenes3d/SessionReplayShell.tsx#L167)
- **Description:** The off-route warn in AC 6 is implemented and intentionally suppressed in `MODE === 'test'` so the suite stays clean. There is no test that: (a) stubs `import.meta.env.MODE` away from `'test'` + sets `window.location.hash = '#/other'` and spies `console.warn`; or (b) asserts the warn is suppressed on `#/playback`. AC 6 explicitly says "not a hard error, to keep tests flexible" so this is cosmetic, but the behaviour is wholly untested.
- **Recommended fix:** Add two cases using `vi.stubEnv('MODE','development')` + `vi.spyOn(console,'warn')` + `window.location.hash` manipulation. ~10 lines; land in the next touch on this file.

#### L-2 — Scrub does not auto-pause; no explicit decision recorded

- **Severity:** LOW
- **Category:** UX contract
- **Location:** [frontend/src/scenes3d/SessionReplayShell.tsx#L249-L253](../../../frontend/src/scenes3d/SessionReplayShell.tsx#L249) (`onScrubHand`).
- **Description:** When the user scrubs while auto-advance is running, the shell resets `handIndex` + `streetIndex=0` but leaves `isPlaying=true`, so the per-street timer immediately resumes from the new hand. tasks.md AC 4 is silent on the pause behaviour; `<HandScrubberPanel>` behaves identically in bindToReplay mode. Reasonable default, but worth calling out before T-031 UX review.
- **Recommended fix:** None for closure. Route to Jean if T-031 user testing wants scrub-to-pause semantics.

#### L-3 — `game` prop is an undocumented extension beyond plan.md § "Public API"

- **Severity:** LOW
- **Category:** spec/plan drift
- **Location:** [frontend/src/scenes3d/SessionReplayShell.tsx#L99-L108](../../../frontend/src/scenes3d/SessionReplayShell.tsx#L99) (prop doc-comment), plan.md L219-230.
- **Description:** plan.md § "Public API" sketches the shell props as `{ gameId, hands, initialHandIndex, initialSpeed }`. Implementation adds a required `game: GameSessionResponse` prop because `handsToTableState` needs the seat map (see responsibility 5 of tasks.md T-023b, which explicitly calls `handsToTableState`). The deviation is documented in an inline comment and the implementation is correct — plan.md needs an amendment.
- **Recommended fix:** Jean: amend plan.md § "Public API — `<SessionReplayShell>`" to include `game: GameSessionResponse`. Two-line doc-level change.

---

## Anna-parseable summary

```
CYCLE: 44
TARGET: aia-core-uja6
TASK: T-023b
STATUS: GREEN
CRITICAL: 0
HIGH: 0
MEDIUM: 2
LOW: 3
TESTS: 1977/1977 (+14)
LINT: clean (0 delta)
ACS_SATISFIED: AC1, AC2, AC3, AC4, AC6, AC7
ACS_PARTIAL: AC5 (propagation only; integration test deferred to T-031)
PROD_FILES_TOUCHED: frontend/src/scenes3d/SessionReplayShell.tsx, frontend/src/scenes3d/index.ts
TEST_FILES_TOUCHED: frontend/test/scenes3d/SessionReplayShell.test.tsx
FILE_BUG_CARDS: 0
CYCLE_23_MED1_STATUS: still unresolved; surfaces again in T-023b (M-1). Hard pre-gate for T-031 remains in force.
RECOMMEND_CLOSE: yes — no blockers; both MEDIUMs are deferred-not-defective, all findings tracked in tasks.md per the Anna contract.
```

---

## Recommendation

**Close `aia-core-uja6`.** Both MEDIUMs are carry-forwards, not defects in the landed code:

- **M-1** repeats Cycle 23 MED-1 verbatim — shell faithfully surfaces the speed radiogroup the spec mandates; the chip-slide timing conflict is a cross-component design decision that already had "hard pre-gate for T-031" status and is not a Cycle 44 regression.
- **M-2** is a downstream integration gap that only becomes testable when T-031 mounts the shell inside `<PokerTable>`; driver-level keying is independently covered.

All findings live in tasks.md Cycle 44 ledger per the Anna contract; **no beads Filed Bug Cards**. `phaseFromStreetIndex` (Cycle 23 LOW-4, "land before first consumer") is **resolved by this cycle** — exported from both `SessionReplayShell.tsx` and `scenes3d/index.ts`.

Suggested close reason: see Phase D.
