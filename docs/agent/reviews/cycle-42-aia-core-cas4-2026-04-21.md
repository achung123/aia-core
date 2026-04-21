# Cycle 42 — Code Review: `aia-core-cas4` (T-028)

**Cycle:** 42
**Epic:** table-3d-revamp-010
**Task:** T-028 — `useFPSMonitor` + auto-degrade with toast
**Beads ID:** `aia-core-cas4`
**Reviewer:** Scott (loop-review)
**Date:** 2026-04-21
**Commit state:** in-flight on `achung/revamp-table`

---

## Scope

Implement the auto-degrade FPS monitor called out by plan.md § "Quality
Tiers & Performance Budget" and tasks.md T-028. Hook samples R3F's
`useFrame`, maintains a 120-sample rolling window, and drops `qualityTier`
one level after 3 seconds of sustained sub-30fps. Emits a session-scoped
toast on real tier change. Respects the T-027 `manualOverride` flag.

## Files changed

| File | Action | Delta |
|---|---|---|
| [frontend/src/scenes3d/state/useFPSMonitor.ts](../../../frontend/src/scenes3d/state/useFPSMonitor.ts) | rewrote | stub → full `FPSMonitor` / `useFPSMonitor` + exported constants |
| [frontend/src/scenes3d/state/tableStore.ts](../../../frontend/src/scenes3d/state/tableStore.ts) | modified | added `tierToast` / `setTierToast` / `dismissTierToast` (not persisted) |
| [frontend/src/scenes3d/components/QualityToast.tsx](../../../frontend/src/scenes3d/components/QualityToast.tsx) | created | DOM-side toast surface, `role="status"`, dismiss button |
| [frontend/src/scenes3d/PokerTable.tsx](../../../frontend/src/scenes3d/PokerTable.tsx) | modified | mounts `<FPSMonitor />` inside the Canvas tree |
| [frontend/src/scenes3d/index.ts](../../../frontend/src/scenes3d/index.ts) | modified | re-exports `QualityToast`, `FPSMonitor`, hook constants |
| [frontend/test/scenes3d/useFPSMonitor.test.tsx](../../../frontend/test/scenes3d/useFPSMonitor.test.tsx) | created | 10 tests covering all 6 ACs + hysteresis + teardown + no-upgrade |
| [frontend/test/scenes3d/QualityToast.test.tsx](../../../frontend/test/scenes3d/QualityToast.test.tsx) | created | 3 tests — null → render → dismiss |
| [frontend/test/scenes3d/tableStore.toast.test.ts](../../../frontend/test/scenes3d/tableStore.toast.test.ts) | created | 3 tests — default, setters, non-persistence |

## Test delta

- Suite: 1921 → **1937** (+16).
- Lint delta on touched files: **0 new errors, 0 new warnings**. The one warning on [frontend/src/scenes3d/PokerTable.tsx](../../../frontend/src/scenes3d/PokerTable.tsx) line 162 predates this cycle and is outside the edits here.
- T-027 store suites (tableStore.quality, tableStore.replay, tableStore) stay green.

## AC mapping (T-028)

| AC | Requirement | Status | Evidence |
|---|---|---|---|
| 1 | Matches plan.md pseudocode (120-sample window, 3000ms sustained) | **SATISFIED** | `FPS_WINDOW_SAMPLES = 120`, `FPS_SUSTAINED_MS = 3000` constants in [useFPSMonitor.ts](../../../frontend/src/scenes3d/state/useFPSMonitor.ts); rolling-window shift at cap; counter increment `+= dtSec * 1000`. |
| 2 | Auto-drop only after 3s sustained <30fps | **SATISFIED** | `useFPSMonitor.test.tsx` "AC-2: does NOT drop until 3s..." — 2.5s is below threshold, +1s crosses it. |
| 3 | Toast on tier change, dismissible, canonical copy | **SATISFIED** | `TIER_TOAST_MESSAGE = 'Quality adjusted for smoother playback'`; [QualityToast.tsx](../../../frontend/src/scenes3d/components/QualityToast.tsx) exposes a `Dismiss` button wired to `dismissTierToast`; tests `QualityToast.test.tsx` cover render + dismiss + null-case; `useFPSMonitor.test.tsx` covers copy + re-raise-on-new-change. |
| 4 | `manualOverride=true` halts auto-degrade | **SATISFIED** | Hook reads `store.manualOverride` in the frame callback; `useFPSMonitor.test.tsx` "AC-4 respects manualOverride" drives 15s @ 20fps with override on, asserts tier + toast both untouched. |
| 5 | Never degrades below `low` | **SATISFIED** | `nextLowerTier('low') === 'low'`; guard `if (next !== store.qualityTier)` skips both `setTier` and `setTierToast` at the floor; test "AC-5 does not degrade below 'low'..." confirms. |
| 6 | 120 @ 20fps → 120 @ 60fps ⇒ exactly ONE tier drop | **SATISFIED** | Test "AC-6 canonical:" exercises the exact sequence; passes with the recovery-gate guard documented in-file. |

## Correctness

- **FPS averaging window (spec #1).** Samples pushed each frame, shifted out when length exceeds `FPS_WINDOW_SAMPLES = 120`. Average computed over the full current buffer. At 60fps this is a strict 2-second window; at lower instantaneous fps the window spans proportionally more wall time, but always holds the 120 most recent instantaneous-fps readings — matching plan.md's "120 samples" interpretation literally.
- **3-second hysteresis threshold (spec #2).** `sustainedMs` accumulates `dtSec * 1000` each sub-threshold frame and resets the moment the average climbs back to ≥30. The `>` comparison means a tick at *exactly* 3000ms does not yet fire — matches "sustained below for 3 continuous seconds" more strictly than `>=`.
- **`manualOverride` respected (spec #3).** Guarded at the source: when `manualOverride=true`, the `avg < threshold && !manualOverride` branch is skipped entirely and `sustainedMs` is reset via the `else` arm. Toast is never written. The T-027 settings-panel wire-up (Cycle 41) already sets `manualOverride=true` when the user picks a tier, so this AC is exercised end-to-end in the running app.
- **Toast fires on change only (spec #4).** `setTierToast` only runs inside the `if (next !== store.qualityTier)` branch, so an already-at-`low` degrade trigger is silent (verified by AC-5 test). A dedicated test ("re-raises the toast only on a NEW tier change after recovery") shows the flow: first drop fires toast, recovery clears the recovery gate, and a *subsequent* dip at the new tier fires a new toast. No per-frame spam.
- **Already-at-low no-op (spec #5).** Counter still increments during sub-threshold stretches at `low`, but when the threshold fires the `nextLowerTier(low) === 'low'` branch is an explicit no-op and neither the tier nor the toast are written. `awaitingRecovery` is still set, so the hook still enters the recovery gate — which is fine because the only observable effect it gates is the drop path, and the drop path is now permanently a no-op at the floor.
- **No oscillation / thrash (spec #6).** Downgrade-only: `nextLowerTier` is the only tier writer; no `nextHigherTier` path exists in this hook. Combined with the recovery gate, a single sustained sub-30fps stretch produces exactly one drop event (verified by the AC-6 test). The recovery gate closes a subtle bug in the plan.md pseudocode where residual sub-30fps samples still in the 120-sample window after a drop would otherwise push the counter back over 3000ms within ~4 frames of a tier-flip and fire a second drop off the same bad stretch. Documented in-file.
- **Teardown / cleanup (spec #7).** `useFrame` from `@react-three/fiber` manages subscription lifecycle — unmounting the `<FPSMonitor />` component releases the callback as part of the Canvas commit. The "teardown" test asserts no further store writes after unmount. Refs in the hook are stack-local and garbage-collect with the component.

## Security / convention / design

- **Security:** store action signatures are internal (not network-exposed). No user input is reflected into the toast — copy is a hard-coded constant. No XSS surface.
- **Conventions:**
  - File layout matches existing T-027 / T-030 patterns (`state/` for hooks that read the store; `components/` for DOM surfaces).
  - Canonical copy hoisted to `TIER_TOAST_MESSAGE` on the hook side, consumed by the store writer — `<QualityToast>` reads the message from the store rather than hard-coding it, matching how CameraPresetController-family components source constants.
  - Re-exports from [frontend/src/scenes3d/index.ts](../../../frontend/src/scenes3d/index.ts) follow the existing alphabetical-ish grouping by subsystem.
  - Ruff/eslint clean on touched files.
- **Design:**
  - Separation of concerns is clean: hook owns detection + policy; store owns state; DOM component owns presentation + dismiss. Consumers can swap out `<QualityToast>` for any other renderer without touching the hook.
  - `FPSMonitor` is a zero-render wrapper so callers don't have to remember to put the hook *inside* the Canvas — one less footgun.

## Findings

### CRITICAL (0)

_None._

### HIGH (0)

_None._

### MEDIUM (2)

- **M-1 — `<QualityToast>` not yet mounted into any consumer route.**
  **Location:** [frontend/src/dealer/TableView3D.tsx](../../../frontend/src/dealer/TableView3D.tsx), [frontend/src/views/PlaybackView.tsx](../../../frontend/src/views/PlaybackView.tsx), [frontend/src/views/PlayerView.tsx](../../../frontend/src/views/PlayerView.tsx) (per plan.md § Phase 6 consumer map).
  **Observation:** The `<QualityToast>` surface is exported from `scenes3d/index.ts` but no consumer renders it. The `<FPSMonitor />` side-effect runs and writes to the store, but a user on the current staging build would never see the notification.
  **Impact:** AC-3 ("Toast appears on tier change") is satisfied at the component + state layer but is not yet wired into any live route. End-to-end visibility will not land until the T-030 / T-031 / T-032 migrations (or a follow-up) mount `<QualityToast>` next to `<PokerCanvas>`.
  **Suggestion:** File a follow-up task under epic `aia-core-6o9t` — "Mount `<QualityToast>` in the three canvas host routes" — and treat as a non-blocking carry-forward for tasks.md.

- **M-2 — Rolling-window semantics drift slightly from the "2s rolling window" prose in plan.md.**
  **Location:** [frontend/src/scenes3d/state/useFPSMonitor.ts](../../../frontend/src/scenes3d/state/useFPSMonitor.ts) lines 59–66.
  **Observation:** plan.md describes "a 2-second rolling window of instantaneous FPS" but the implementation (and plan.md's own pseudocode) holds the 120 most recent samples regardless of wall time. At 20fps the window spans 6 real seconds, not 2. This is the same behavior the plan.md pseudocode encodes, and AC-1 explicitly pins "120 samples" — but the *prose* interpretation differs from the *code* interpretation.
  **Impact:** Not a correctness defect. A strict 2-second wall-time window would require tracking sample timestamps and popping by age; the current implementation trades wall-time fidelity for a cheap O(1) push/shift. No behavioral AC is violated.
  **Suggestion:** Keep as-is; file a spec clarification in tasks.md that plan.md's "2-second" prose refers to a 60fps-target time-box, not a strict sliding wall-time window. No code change.

### LOW (2)

- **L-1 — Hard-coded styles in `<QualityToast>`.**
  **Location:** [frontend/src/scenes3d/components/QualityToast.tsx](../../../frontend/src/scenes3d/components/QualityToast.tsx) lines 18–46.
  **Observation:** Inline `CSSProperties` literals duplicate the visual language of [frontend/src/dealer/ActiveHandDashboard.tsx](../../../frontend/src/dealer/ActiveHandDashboard.tsx)'s existing toast block (dark pill with white text). The codebase has no shared toast utility yet, so this is consistent with the existing dealer pattern, but both surfaces drift independently.
  **Suggestion:** When a second toast surface lands, extract a shared style token. Not blocking.

- **L-2 — `awaitingRecovery` flag is implicit in the `useRef` contract, not an explicit store field.**
  **Location:** [frontend/src/scenes3d/state/useFPSMonitor.ts](../../../frontend/src/scenes3d/state/useFPSMonitor.ts) line 58.
  **Observation:** The recovery-gate flag is a hook-local ref, which means re-mounting the `<FPSMonitor />` component resets it. In practice the component only mounts alongside the Canvas, so this is fine, but a naive consumer mounting two `<FPSMonitor />` instances (e.g. accidentally in a SessionReplayShell + PlaybackView migration) would get independent recovery gates. Not a bug today.
  **Suggestion:** No code change. Document on tasks.md if it resurfaces during migration.

## Suggested close reason

> T-028 implemented — `useFPSMonitor` hook + `<FPSMonitor />` R3F wrapper + `<QualityToast>` DOM surface + `tierToast` non-persisted store slice. Plan.md pseudocode faithfully realised (120-sample rolling window, 3000ms sustained threshold, `nextLowerTier` step). AC-6 canonical "exactly one drop" guaranteed by an added recovery-gate flag (one avg≥30 frame required between drops) that closes a latent re-trigger hole in the plan.md pseudocode. `manualOverride=true` fully halts auto-degrade (AC-4 exercised end-to-end via T-027 settings-panel wire-up from Cycle 41). Never degrades below `low`; never auto-upgrades. `<FPSMonitor />` mounted in `<PokerTable>`; `<QualityToast>` exported for consumer routes. Suite 1921 → 1937 (+16), lint delta 0. Cycle 42 review: 0 CRIT / 0 HIGH / 2 MED / 2 LOW — M-1 `<QualityToast>` not yet mounted in the three canvas host routes, M-2 plan.md prose-vs-pseudocode "2s rolling window" phrasing; both non-blocking carry-forwards in tasks.md per Anna contract. Review: docs/agent/reviews/cycle-42-aia-core-cas4-2026-04-21.md.

---

_This report was written by Scott (`loop-review --cycle 42`). Anna manages commit + close._
