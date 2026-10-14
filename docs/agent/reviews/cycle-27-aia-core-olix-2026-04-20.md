**Loop Context:** Cycle 27 | Task: aia-core-olix (T-026) | Epic: aia-core-6o9t (table-3d-revamp-010) | Date: 2026-04-20

# Code Review Report — table-3d-revamp-010

**Date:** 2026-04-20
**Target:** `frontend/src/scenes3d/PokerTable.tsx` + `frontend/test/scenes3d/PokerTable.playerMode.test.tsx` (+ regression tweak to `PokerTable.test.tsx`)
**Reviewer:** Scott (automated)

**Task:** T-026 — Player-mode composition (no equity + camera lock)
**Beads ID:** aia-core-olix

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 1 |
| LOW | 4 |
| **Total Findings** | **5** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | No `<EquityBadge>` renders in player mode (viewer, opponents, or pot) and the equity endpoint is never called | SATISFIED | `PokerTable.tsx` L484–490 gates `<EquityBadges>` behind `resolveEquityOverlay(equityOverlay, viewer)`; `equityGuard.ts` L33–41 hard-returns `false` under `policy === 'player'`; T-020 adds a second gate in `useEquityQuery.enabled`. Test: `PokerTable.playerMode.test.tsx` L285–306 ("renders zero equity badges and fires zero fetches even with equityOverlay=true") | Dev warning emitted when caller opts-in. Layer 3 (ESLint rule) remains deferred to T-032 per standing epic plan. |
| 2 | Camera is locked to viewer seat POV | SATISFIED | `PokerTable.tsx` L116–141 — `resolveCameraPreset` unconditionally returns `{ kind: 'seat', seat: viewer.seat, seatCount }` under player policy regardless of caller `cameraPreset`; DEV warn on conflict. Tests: `PokerTable.playerMode.test.tsx` L159–251 (8 camera-lock tests) + updated `PokerTable.test.tsx` L360–376 | Fallback to `'default'` preset when `viewer.seat` is undefined is correct. |
| 3 | Nameplates / action highlights / blind markers render for all seats | PARTIAL | Nameplates + `<TableMarkers>` (dealer/SB/BB) asserted in `PokerTable.playerMode.test.tsx` L259–281. Action highlights are not asserted because component `T-018` (`aia-core-lpto`) is still open — see MED-1. | Cross-task gap, not a T-026 regression. |
| 4 | Preset toolbar is hidden | SATISFIED | `CameraPresetToolbar.tsx` L51 — early `return null` when `viewer.policy === 'player'`. Test: `PokerTable.playerMode.test.tsx` L315–324 ("renders null when viewer.policy === 'player'") | AC is satisfied at the toolbar component layer; individual consumer routes wiring `viewer` in is covered by T-030/T-031/T-032. |
| 5 | Integration test asserts zero network calls to the equity endpoint throughout a full player-mode hand lifecycle (preflop → showdown) | SATISFIED | `PokerTable.playerMode.test.tsx` L332–397 — re-renders `<PokerTable>` across all 5 phases; asserts `fetchEquity` called 0 times and zero `equity-badges` groups rendered | Uses react-query `retry: false` client; sanity assertion on 5 community cards at showdown. |

---

## Findings

### [MEDIUM] AC-3 "action highlights" dimension is not verified by any test and T-026 will close without evidence

**File:** `frontend/test/scenes3d/PokerTable.playerMode.test.tsx`
**Line(s):** 259–281
**Category:** correctness / traceability

**Problem:**
AC 3 reads "**Nameplates / action highlights / blind markers** render for all seats." The test covers nameplates and `<TableMarkers>` (dealer button, SB, BB) but says nothing about action highlights (fold dim / bet glow / turn pulse per S-3.3). This is structurally fine — T-018 (`aia-core-lpto`, action highlights) is still open, so there is no production surface to assert against — but closing T-026 against this AC will implicitly defer the "action highlights survive player mode" check to whenever T-018 lands, with no forcing function on record.

**Suggested Fix:**
Add an explicit carry-forward note to T-026's close reason: "AC 3 partially satisfied — action-highlights slice deferred to T-018 (`aia-core-lpto`); T-018 acceptance should add a dedicated regression asserting highlights still render under `viewer.policy === 'player'`." No code change required here; this is a traceability deliverable for Logan/Jean.

**Impact:** Small. The player-mode composition is functionally correct today because the action-highlight component does not yet exist to be gated off; the risk is that T-018 lands later without remembering to re-assert player-mode compatibility.

---

### [LOW] `resolveCameraPreset` accepts out-of-range `viewer.seat` silently

**File:** `frontend/src/scenes3d/PokerTable.tsx`
**Line(s):** 116–141
**Category:** correctness / defence-in-depth

**Problem:**
`if (typeof viewer.seat === 'number')` accepts any finite number including negatives or values `≥ seatCount`. `computeSeatPresetPose` / `computeSeatYawCenter` will then compute a nonsense world pose via modular seat geometry. Same class of silent-fallback bug as Cycle 14 L-1, which was just fixed for `unknown kind`.

**Suggested Fix:**
```ts
if (typeof viewer.seat === 'number' && viewer.seat >= 0 && viewer.seat < seatCount) {
  // ...seat lock path...
}
if (import.meta.env?.DEV) {
  console.warn('[PokerTable] viewer.policy="player" seat out of range; falling back to "default"', viewer.seat, seatCount);
}
return 'default';
```

**Impact:** Low — no shipping caller passes an out-of-range seat today, but the failure mode is a silent mis-aimed camera with no dev signal.

---

### [LOW] `onPresetChange` is silently suppressed under player policy with no dev signal

**File:** `frontend/src/scenes3d/PokerTable.tsx`
**Line(s):** 176–183 (prop destructuring) + 116–141 (preset resolution)
**Category:** convention / observability

**Problem:**
Under player policy the caller's `cameraPreset` is overridden with a DEV warning, but `onPresetChange` is never fired to tell the parent "your preset state is being ignored." If a future parent view mounts both the player `<PokerTable>` and an independent preset-state store (e.g. a shared Zustand slice), the two will drift with no feedback. The existing `_onPresetChange` rename already hints that the callback is intentionally dropped, but there is no symmetric dev warning.

**Suggested Fix:**
Consider a one-shot DEV warning when `onPresetChange != null && viewer?.policy === 'player'`, or document in `PokerTableProps` JSDoc that `onPresetChange` is a no-op under player policy. No behavior change needed.

**Impact:** Low — self-inflicted bug opportunity for future consumers, not a current regression.

---

### [LOW] Player-mode lockout at `<CameraPresetToolbar>` is only verified in component isolation, not at any call site

**File:** `frontend/test/scenes3d/PokerTable.playerMode.test.tsx`
**Line(s):** 315–324
**Category:** test quality

**Problem:**
AC 4 is proved by mounting `<CameraPresetToolbar>` directly with a `player` viewer. There is no integration test that proves any consumer route (playback, dealer embed, player route) actually threads `viewer` into the toolbar — so a future T-030/T-031/T-032 could forget to pass `viewer` and the lockout would silently break at runtime.

**Suggested Fix:**
When T-032 (player POV route) lands, add an integration assertion at `pages/TableView.tsx` test that confirms `<CameraPresetToolbar viewer={...}>` is either not rendered or receives a player-policy viewer. Track as a discovered-from issue against T-032.

**Impact:** Low — toolbar component-level contract is correct; only the wiring forcing-function is missing.

---

### [LOW] `PokerTable.playerMode.test.tsx` silently swallows all `console.warn` output, masking unintended future warnings

**File:** `frontend/test/scenes3d/PokerTable.playerMode.test.tsx`
**Line(s):** 89–92, 101
**Category:** test quality

**Problem:**
```ts
consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
```
The suite globally silences `console.warn` so noisy R3F output does not pollute test runs. A side effect: the DEV warnings that `resolveCameraPreset` and `equityGuard` emit (two of the load-bearing dev-signal behaviors introduced by T-026 and T-020 respectively) are never asserted on. A regression that deletes the warn would go undetected by this suite.

**Suggested Fix:**
Add one direct assertion that `console.warn` was called when `cameraPreset="topDown"` + `viewer.policy="player"` is mounted — e.g. `expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringMatching(/cameraPreset ignored/), expect.anything())`. Mirrors the dev-warning tests we already have in the equity-guard test module.

**Impact:** Low — the warnings are diagnostics, not user-facing behavior; absence of assertion weakens future regression protection only.

---

## Positives

- **Single-source-of-truth camera lock.** `resolveCameraPreset` is the only place the player-mode override lives, and it correctly handles: caller omits preset, caller passes the same seat (no warn), caller passes a different preset (warn + override), and `viewer.seat` undefined (default + warn).
- **Defence-in-depth for AC 1.** Equity overlay is gated in three places — the pure `resolveEquityOverlay` helper, the `<EquityBadges>` internal guard (T-020), and the `useEquityQuery.enabled` predicate. T-026 touches layer 1 only but inherits the full trio; AC 5's zero-fetch assertion confirms the composition works end-to-end.
- **Lifecycle test is the right shape.** The 5-phase re-render exercise is exactly the "full player-mode hand lifecycle" AC 5 asks for, and it uses the real react-query client instead of mocking `useEquityQuery` — so a future regression that forgets to gate the hook would fail here.
- **Regression update on `PokerTable.test.tsx` is minimal and targeted.** The existing player-policy yaw test was updated to assert the seat-centered clamp (vs. world-yaw 0), matching T-022 AC 2's pre-landed primitive; no other tests were touched.
- **1766/1766 green, +13 new.** No flaky-timer patterns, no unmocked fetches, no `waitFor` chains that depend on timer internals.

---

## Overall Assessment

T-026 is a clean, well-scoped composition task that correctly reuses the T-020 equity guard and the T-022 seat-POV primitives. Zero CRITICAL / zero HIGH findings. AC 1, 2, 4, 5 are fully satisfied; AC 3 is partial strictly because the "action highlights" dimension refers to T-018 which has not landed yet (MED-1 is a traceability note, not a code defect). The LOW findings are defence-in-depth nits (seat-index range validation, dev-warning assertion coverage, `onPresetChange` symmetry) that can be folded into future touches of `PokerTable.tsx` or tracked as discovered-from issues against T-032. **Recommend: land as-is; carry MED-1 and LOWs into tasks.md under the T-026 Cycle 27 block.**
