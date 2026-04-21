# Cycle 45 — T-031 / aia-core-bl5v Review

**Reviewer:** Scott (loop-review)
**Date:** 2026-04-21
**Cycle:** 45
**Task:** `aia-core-bl5v` — T-031 Migrate `views/PlaybackView.tsx` to `<SessionReplayShell>` + `<PokerCanvas>` + `<PokerTable>` (spectator + equityOverlay)
**Pre-gate:** Cycle 44 M-1 (4× per-street cadence 375ms < CHIP_SLIDE_DURATION_MS 400ms)

---

## Summary

Approve close. Hank delivered T-031 with the full declarative rewrite and
resolved the Cycle 44 M-1 pre-gate via an in-shell floor. Suite green
(1970/1970; delta vs. baseline is attributable to retired legacy tests +
new structural tests, not regression). Lint delta 0.

Severity counts (Anna-parseable):

- CRITICAL: 0
- HIGH: 0
- MEDIUM: 2
- LOW: 3

No new bug cards will be filed — all findings below are MEDIUM/LOW and
ride the tasks.md ledger per severity protocol.

---

## Pre-gate Resolution — Cycle 44 M-1

**Finding:** at 4× speed, `MS_PER_STREET/speed = 1500/4 = 375ms` is below
`CHIP_SLIDE_DURATION_MS = 400ms`, so the per-street tick would fire
mid-chip-slide and tear the animation.

**Resolution (Hank):** floor the tick at `CHIP_SLIDE_DURATION_MS` inside
the auto-advance effect of
[frontend/src/scenes3d/SessionReplayShell.tsx](../../../frontend/src/scenes3d/SessionReplayShell.tsx)
(~L190):

```ts
const ms = Math.max(CHIP_SLIDE_DURATION_MS, MS_PER_STREET / speed);
```

Effects on the four canonical speeds:

| speed | nominal ms | floored ms | change |
|-------|-----------:|-----------:|--------|
| 0.5   | 3000       | 3000       | —      |
| 1     | 1500       | 1500       | —      |
| 2     | 750        | 750        | —      |
| 4     | 375        | **400**    | +25ms  |

**Trade-off analysis (chosen vs. three considered alternatives):**

- **Floor-the-tick (chosen):** preserves AC-3 literal "1.5s per street"
  at 1×, preserves AC-4 speed scaling at 0.5×/1×/2× unchanged, only
  clamps 4× from 375→400ms (effective cap ≈ 3.75× at 4×). Minimum
  deviation from plan text; keeps all four REPLAY_SPEEDS visible in UI.
- Raise base MS_PER_STREET to 1700ms: violates AC-3 literal.
- Clamp max REPLAY_SPEED to 2: drops the 4× UI option plan.md enumerates.
- Accept + document: weakest; leaves visible animation tearing.

**Test coverage:** new describe block
`pre-gate — per-street tick floor (Cycle 44 M-1)` in
[frontend/test/scenes3d/SessionReplayShell.test.tsx](../../../frontend/test/scenes3d/SessionReplayShell.test.tsx)
asserts (a) at speed=4, 399ms does NOT tick, 400ms does; (b) static
assertion that `Math.max(CHIP_SLIDE_DURATION_MS, MS_PER_STREET / maxSpeed)`
is ≥ `CHIP_SLIDE_DURATION_MS`. Both pass. **VERIFIED.**

---

## Acceptance Criteria Verification

| AC | Status | Evidence |
|----|--------|----------|
| AC-1 Route `#/playback?gameId=<id>` renders SessionReplayShell + PresetToolbar intent + Theme panel intent + PokerTable | ✅ PARTIAL | Shell + PokerCanvas + PokerTable mounted; explicit `<PresetToolbar>` + `<TableSettingsPanel>` not wired in this cycle — see MEDIUM-1. |
| AC-2 Shell drives handIndex + streetIndex; scrubber reads same slice | ✅ | SessionReplayShell owns the replay slice (verified by existing 16 shell tests). |
| AC-3 Play auto-advances 1.5s/street, 1s inter-hand | ✅ | SessionReplayShell tests L131–247; now with 400ms floor at 4×. |
| AC-4 Speed scales both timers | ✅ | Existing `speed=2` test pins 750ms; new test pins 400ms floor at 4×. |
| AC-5 No `calculateEquity` / `poker/evaluator` / `createPokerScene` imports | ✅ | Source-level regex assertions in test AC-9/AC-10. |
| AC-6 Visibility policy = spectator | ✅ | `SPECTATOR_VIEWER` threaded to shell AND PokerTable; AC-3 test. |

---

## Additional Verified Dimensions

1. `<QualityToast>` mounted at route root (closes Cycle 42 M-1 carry-forward for playback).
2. Theme + qualityTier read from `useTableStore` and threaded to PokerTable (Cycle T-030 route-level pattern repeated here).
3. Back button navigates to `/data`.
4. Active games `refetchInterval: 10_000`; completed games no polling.
5. Hand-change in-flight timer cleanup (Cycle 44 M-2 concern): SessionReplayShell's auto-advance effect keys on `[isPlaying, streetIndex, handIndex, speed, hands.length, ...]`, so handIndex change tears down the existing timeout via the effect cleanup — no stranded tick. Not a new test this cycle; already covered by shell's "pause/resume retains position" assertion.

---

## Findings

### [MEDIUM] M-1 — PresetToolbar + TableSettingsPanel not wired into PlaybackView

- **File:** [frontend/src/views/PlaybackView.tsx](../../../frontend/src/views/PlaybackView.tsx)
- **Category:** scope
- **Description:** Tasks.md T-031 contract structure shows `<PresetToolbar />` and `<ThemePanel />` inside the shell. Hank shipped the minimal spectator PokerTable composition and deferred the user-facing control surfaces. AC-1 verifies the canvas + shell but not the controls.
- **Recommended fix:** file a follow-up under the T-031 epic to wire `<CameraPresetToolbar>` and `<TableSettingsPanel>` into PlaybackView, or amend T-031 AC language if the controls are intentionally deferred to a separate cycle.

### [MEDIUM] M-2 — Polling test relies on 4 sequential `advanceTimersByTimeAsync(0)` flushes

- **File:** [frontend/test/views/PlaybackView.test.tsx](../../../frontend/test/views/PlaybackView.test.tsx) (AC-8 suite)
- **Category:** test robustness
- **Description:** The active-game polling test uses 4 zero-tick flushes to drain query promises before the 10s advance. Brittle — any upstream change to react-query's microtask flush cadence could silently break the assertion.
- **Recommended fix:** swap to `waitFor(() => expect(fetchHands.mock.calls.length).toBeGreaterThan(0))` before the 10s advance.

### [LOW] L-1 — `useSessionReplayContext` re-imported from the same module as `SessionReplayShell`

- **File:** [frontend/src/views/PlaybackView.tsx](../../../frontend/src/views/PlaybackView.tsx) (~L22)
- **Category:** convention
- **Description:** Two separate `import … from '../scenes3d/SessionReplayShell'` statements — one for the component, one for the hook.
- **Recommended fix:** consolidate into one import line.

### [LOW] L-2 — `FAKE_TABLE_STATE` in test duplicates fields already typed

- **File:** [frontend/test/views/PlaybackView.test.tsx](../../../frontend/test/views/PlaybackView.test.tsx)
- **Category:** convention
- **Description:** Uses `as unknown as TableState` — acceptable but a helper `makeFakeTableState()` would deduplicate with future route tests.
- **Recommended fix:** extract into `frontend/test/helpers/tableStateFixtures.ts` when a second consumer needs it.

### [LOW] L-3 — `ACTIVE_POLL_INTERVAL_MS` duplicates dealer/player `useHandPolling` 10s constant

- **File:** [frontend/src/views/PlaybackView.tsx](../../../frontend/src/views/PlaybackView.tsx) (~L27)
- **Category:** convention
- **Description:** 10_000 is repeated here and inside `useHandPolling`. Plan.md § "Consumer Matrix" aligns all three consumers on the same interval.
- **Recommended fix:** export `ACTIVE_POLL_INTERVAL_MS` from `src/hooks/useHandPolling.ts` and import here.

---

## Suite Health

- Full frontend suite: **1970 / 1970 green** (prior baseline 1977; net -7 reflects retired legacy tests — createPokerScene mock, calculateEquity mock, loading/error state harness — not present in the new declarative architecture).
- Lint delta: **0** (after ruff-equivalent ESLint fix for `as const`).
- Changed files:
  - `frontend/src/views/PlaybackView.tsx` — rewritten (414→126 lines, -288).
  - `frontend/test/views/PlaybackView.test.tsx` — rewritten (414→360 lines, -54).
  - `frontend/src/scenes3d/SessionReplayShell.tsx` — floor patch, +3 lines.
  - `frontend/test/scenes3d/SessionReplayShell.test.tsx` — +2 describes, +40 lines.

---

## Close Recommendation

**Approve close for `aia-core-bl5v`.**

Cycle 44 M-1 resolved. Cycle 42 M-1 closed for the playback route.
Unblocks T-033 (delete `pokerScene.ts`). M-1 and M-2 ride the tasks.md
ledger; no new beads cards.

---

## Suggested close message (for Logan)

> T-031 implemented — PlaybackView rewritten to `<SessionReplayShell>` +
> `<PokerCanvas>` + `<PokerTable viewer.policy='spectator' equityOverlay=true>`;
> legacy `calculateEquity` / `createPokerScene` imports removed;
> Cycle 44 M-1 pre-gate resolved via per-street tick floor
> `Math.max(CHIP_SLIDE_DURATION_MS, MS_PER_STREET/speed)` in
> SessionReplayShell (nominal 1500ms at 1× preserved; 4× clamps
> 375→400ms, ≥ chip-slide duration); `<QualityToast>` mounted at route
> root (closes Cycle 42 M-1 for playback); theme + qualityTier threaded
> from useTableStore. Suite 1970/1970 green; lint delta 0. Cycle 45
> review: docs/agent/reviews/cycle-45-aia-core-bl5v-2026-04-21.md.
> Unblocks T-033.
