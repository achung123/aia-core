# Code Review Report — table-3d-revamp-010

**Date:** 2026-04-18
**Target:** T-022 Seat-POV camera preset — `yawCenter` pitch/zoom/pan override in `<CameraRig>` + 3 new boundary tests
**Reviewer:** Scott (automated, loop-review)
**Cycle:** 24
**Epic / Beads ID:** aia-core-yyn0

**Task:** T-022 — Seat-POV camera preset with constrained orbit
**Spec refs:** S-4.2, S-5.2
**Prior cycle:** Cycle 14 (MED-1 seat yaw clamp, LOW-1 silent seat fallback)

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 0 |
| LOW | 3 |
| **Total Findings** | **3** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | Selecting a seat animates the camera to behind it | SATISFIED | [frontend/src/scenes3d/animations/cameraPresets.ts](frontend/src/scenes3d/animations/cameraPresets.ts#L85-L113) `computeSeatPresetPose` + machine tween in `createCameraPresetState`; [frontend/src/scenes3d/components/CameraPresetController.tsx](frontend/src/scenes3d/components/CameraPresetController.tsx#L100-L112) wires it into the rig; tests in [frontend/test/scenes3d/cameraPresets.test.ts](frontend/test/scenes3d/cameraPresets.test.ts) and [frontend/test/scenes3d/CameraPresetController.test.tsx](frontend/test/scenes3d/CameraPresetController.test.tsx) | Primitive pre-existed (Cycle 14); no regression. |
| 2 | Orbit is constrained (±30° yaw, limited pitch, tighter zoom) | SATISFIED | [frontend/src/scenes3d/components/CameraRig.tsx](frontend/src/scenes3d/components/CameraRig.tsx#L175-L191) `seatPov` branch forces `minPolarAngle` / `maxPolarAngle` / `minDistance` / `maxDistance` / `enablePan` to `PLAYER_CAMERA_CONFIG` values when `yawCenter != null`; yaw clamp = `yawCenter ± π/6`; tests [frontend/test/scenes3d/CameraRig.test.tsx](frontend/test/scenes3d/CameraRig.test.tsx#L239-L262) — 3 new assertions for pitch, zoom, pan | This cycle closed the gap where a spectator selecting seat POV retained spectator pitch/zoom. |
| 3 | Double-tap resets to default seat POV | DEFERRED | Not implemented; tracked for T-026 player-mode composition | Gesture layer + "prior preset" memory naturally belong with player-mode assembly. **Same precedent as T-015 AC 4** (Cycle 18 — route-level theme consumption deferred to T-030/T-031). Acceptable. |
| 4 | Player mode hides toolbar + locks camera | DEFERRED | Not implemented; tracked for T-026 | Wiring depends on `visibilityPolicy === 'player'` routing that T-026 owns per tasks.md § T-026. Acceptable. |

---

## Findings

### [LOW] Cycle 14 LOW-1 resolution lacks a test asserting the dev warn fires

**File:** `frontend/src/scenes3d/PokerTable.tsx`
**Line(s):** 107–123
**Category:** convention (test coverage)

**Problem:**
Cycle 14 L-1 asked for `resolveCameraPreset` in `PokerTable.tsx` to emit a dev-mode `console.warn` instead of silently falling back to `'default'` on unknown preset kinds. The warn is wired correctly:

```ts
if (import.meta.env?.DEV) {
  // eslint-disable-next-line no-console
  console.warn('[PokerTable] Unknown cameraPreset; falling back to "default"', p);
}
```

— but no test asserts the warn fires. A grep of `frontend/test/` turns up zero matches for the warn string or an assertion on this fallback path. Future refactors that restructure `resolveCameraPreset` could silently regress to the pre-Cycle-14 behavior without failing CI.

**Suggested Fix:**
Add a single unit test in `frontend/test/scenes3d/PokerTable.test.tsx` that mounts `<PokerTable>` with a fabricated unknown `cameraPreset` (cast via `as unknown as TableCameraPreset`), spies `console.warn`, and asserts it was called with a message matching `/Unknown cameraPreset/`.

**Impact:** Resolution of Cycle 14 L-1 is behaviorally present in production but not regression-guarded.

---

### [LOW] Seat-POV `yawCenter` override unconditionally adopts `PLAYER_CAMERA_CONFIG` pitch/zoom/pan for spectator viewers

**File:** `frontend/src/scenes3d/components/CameraRig.tsx`
**Line(s):** 175–191
**Category:** design / spec interpretation

**Problem:**
When `yawCenter != null`, the rig now forces `minPolarAngle`, `maxPolarAngle`, `minDistance`, `maxDistance`, and `enablePan = false` to `PLAYER_CAMERA_CONFIG` values regardless of viewer policy. Spec mapping:

- **S-4.2 AC 2** ("constrained to small left/right rotation … no flipping behind the seat") — clearly spec'd for **all** seat POV invocations. The yaw + pan + pitch overrides are directly justified.
- **S-5.2 AC 2** ("zoom range is tightened to prevent seeing behind opponents") — spec'd explicitly **for player mode** (`visibilityPolicy === 'player'`). The implementation applies the tightened zoom to spectator-invoked seat POV as well.

A spectator deliberately picking seat POV from the toolbar (e.g., playback review) reasonably might want seat framing while still being able to dolly out for context. The current implementation denies that.

**Code:**
```ts
const seatPov = yawCenter != null;
const minDistance = seatPov ? PLAYER_CAMERA_CONFIG.orbit.minDistance : o.minDistance;
const maxDistance = seatPov ? PLAYER_CAMERA_CONFIG.orbit.maxDistance : o.maxDistance;
```

**Suggested Fix:**
Two acceptable paths:
1. **Keep as-is (current)** — argue seat POV is a single, consistent "you are at the table" experience; document the intent in the existing comment block (which already calls out the design choice — strengthen it to reference S-5.2 AC 2 explicitly and note spectator seat-POV inherits player-mode zoom by design).
2. **Split** — pass `applyPlayerConstraints: boolean` (or derive from `viewer?.policy === 'player'`) so spectator seat POV keeps the spectator zoom band while still clamping yaw/pitch/pan.

Path 1 is the current direction and is defensible; recommend confirming with product on T-026 landing. Path 2 is a one-line follow-up if product disagrees.

**Impact:** Behaviorally strict but not spec-violating. Surfaces as a UX conversation when T-031 (playback) wires the toolbar.

---

### [LOW] Seat-POV orbit assertions are boundary-only (props forwarded to a mocked `<OrbitControls>`)

**File:** `frontend/test/scenes3d/CameraRig.test.tsx`
**Line(s):** 13–22, 239–262
**Category:** test design

**Problem:**
All three new T-022 tests mock `@react-three/drei`'s `OrbitControls` as a `<div>` that captures props via `orbitPropsSpy`, then assert the prop values. This proves `<CameraRig>` forwards the right numbers to the boundary, but does **not** prove drei's `OrbitControls` interprets `minPolarAngle` / `maxPolarAngle` / `minDistance` / `maxDistance` / `enablePan` the way the code comment claims. If a future drei major release renames a prop or changes default merging, the tests stay green while the camera diverges in the real `<Canvas>`.

This matches the existing project convention (the pre-existing spectator/player assertions in the same file use the same pattern, as do `PokerTable.test.tsx`, `CameraPresetController.test.tsx`, etc.). Divergence risk is inherent to happy-dom + mocked drei and is not specific to this cycle.

**Suggested Fix:**
Not actionable within T-022 scope. Defer to the epic-level follow-up already accumulating (see Cycle 13 "driver robustness" recommendation). If/when a Playwright smoke harness lands for the 3D scenes, add one real-drei assertion that yaw input past `yawCenter + π/6` is clamped.

**Impact:** Test suite proves contract-level correctness; real-behavior divergence is guarded only by the same inherited pattern used across the entire `scenes3d/` test layer.

---

## Positives

- **Cycle 14 follow-through is clean.** MED-1 (seat-specific yaw clamp via `yawCenter`) and LOW-1 (silent seat fallback → dev warn) are both resolved in code; the warn is correctly gated on `import.meta.env?.DEV`.
- **Gap-closing change is minimal and well-commented.** The `seatPov` branch in [CameraRig.tsx](frontend/src/scenes3d/components/CameraRig.tsx#L170-L191) has a clear multi-line rationale explaining *why* pitch/zoom/pan override regardless of viewer policy (task AC 2, toolbar-invoked seat POV running with spectator viewer). Reviewer-friendly.
- **AC deferrals are explicit.** ACs 3 & 4 routed to T-026 with clear dependency on the player-mode composition already spec'd in tasks.md § T-026 — no orphaned responsibility. This tracks the same precedent as T-015 AC 4 → T-030/T-031 (Cycle 18), which closed without issue.
- **Test coverage is the right shape for the change.** The 3 new assertions (pitch, zoom, pan) target exactly the behavior introduced this cycle; `yawCenter != null` → `PLAYER_CAMERA_CONFIG` override is now regression-guarded.
- **Suite is fully green.** 1727/1727. Lint clean.

---

## Overall Assessment

**0 CRITICAL, 0 HIGH. Approve close.**

T-022 AC 1 + AC 2 are satisfied end-to-end. The yawCenter pitch/zoom/pan override closes the real gap from Cycle 14 (spectator-invoked seat POV previously kept spectator clamps). AC 3 + AC 4 deferrals to T-026 follow established epic precedent (T-015 AC 4 → Cycle 18 close) and map cleanly onto the player-mode composition task.

The three LOW findings are follow-up flavor: a missed warn test for the Cycle 14 resolution, a spec-interpretation nuance on whether spectator seat POV should inherit `PLAYER_CAMERA_CONFIG`'s tightened zoom, and the inherent boundary-assertion limitation of the drei-mocked test strategy. None block close. Recommend filing the first as a one-test follow-up against the epic; the second is a product confirmation at T-026 time; the third rolls into the existing "driver robustness / real-drei harness" epic follow-up.
