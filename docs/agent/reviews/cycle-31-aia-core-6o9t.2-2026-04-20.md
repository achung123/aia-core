**Loop Context:** Cycle 31 | Task: aia-core-6o9t.2 | Epic: aia-core-6o9t | Date: 2026-04-20

# Code Review Report — table-3d-revamp-010

**Date:** 2026-04-20
**Target:** `frontend/src/scenes3d/components/SeatHighlight.tsx` (+ companion tests)
**Reviewer:** Scott (automated)

**Task:** H-2 — Billboard `<BetGlowOverlay>` plane to camera
**Beads ID:** aia-core-6o9t.2
**Discovered-from:** aia-core-lpto (T-018 / S-3.3 AC-2, closed Cycle 29)

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 1 |
| LOW | 3 |
| **Total Findings** | **4** |

Gate: 1803 → 1808 (+5), all green. Lint clean on modified files.

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| AC-1 | Glow plane camera-facing across all seat angles | SATISFIED | [SeatHighlight.tsx L258-269](frontend/src/scenes3d/components/SeatHighlight.tsx#L258-L269) applies `rotation={[0, rotationY, 0]}` via the same `computeBillboardYRotation` used by `<Nameplate>` | Identical world-XZ inputs (`seatAnchorLocalToWorld(seatIndex, seatCount, [0, NAMEPLATE_LOCAL_Y, 0])`) → identical rotation. |
| AC-2 | Rotation-tracks-camera test green (closes Cycle 29 M-1(a)) | SATISFIED | [SeatHighlight.test.tsx L343-430](frontend/test/scenes3d/SeatHighlight.test.tsx#L343-L430): 4 unit tests — rotates to face, re-orients on move, no-camera guard, matches sibling nameplate. [PokerTable.seatHighlights.test.tsx L321-388](frontend/test/scenes3d/PokerTable.seatHighlights.test.tsx#L321-L388): scene-level probe drives frames w/ camera and asserts `phiGlow ≈ phiNameplate` and `phiGlow2 ≠ phiGlow1` | Frame-advanced assertion exists at scene level — this is the specific probe Cycle 29 M-1(a) flagged as missing. |
| — | T-018 AC-2 (1500ms glow timing) — no regression | SATISFIED | [SeatHighlight.test.tsx L640-665](frontend/test/scenes3d/SeatHighlight.test.tsx#L640-L665) auto-clear; [L667-710](frontend/test/scenes3d/SeatHighlight.test.tsx#L667-L710) window refresh | Composer's setTimeout lifecycle untouched by this change. |
| — | T-018 AC-3 (pulse) — no regression | SATISFIED | All `<TurnPulseRing>` + composer AC-3 tests still green (29/29 SeatHighlight, 11/11 scene). | Pulse code path untouched. |
| — | T-018 AC-4 (reduced motion) — no regression | SATISFIED | [SeatHighlight.tsx L246-253](frontend/src/scenes3d/components/SeatHighlight.tsx#L246-L253) keeps opacity fade gated by `!reducedMotion`; billboard rotation runs unconditionally (correct — billboard is layout, not motion). [SeatHighlight.test.tsx L722-744](frontend/test/scenes3d/SeatHighlight.test.tsx#L722-L744) still green. | See M-1 note on reduced-motion + billboard intent. |

---

## Findings

### [MEDIUM] Billboard useFrame driver duplicated between `<Nameplate>` and `<BetGlowOverlay>`

**File:** `frontend/src/scenes3d/components/SeatHighlight.tsx`, `frontend/src/scenes3d/components/Nameplate.tsx`
**Line(s):** SeatHighlight.tsx L243-271; Nameplate.tsx L240-267
**Category:** design

**Problem:**
Hank picked approach (b) — "shared helper, independent drivers." The helper `computeBillboardYRotation` + `BILLBOARD_EPSILON` are shared, but the surrounding `useFrame`/`useState`/`rotation={[0, rotationY, 0]}` pattern is copy-pasted into both components. Any future billboard-behavior change (e.g., smoothing, hysteresis, tilt) now has to be made in two places in lockstep — and the sibling-parity test in `SeatHighlight.test.tsx` only catches drift when someone remembers to extend it.

Rotation parity is robust *today* because:
1. Both read the same `cameraPos` from the same R3F frame.
2. Both compute against the identical world-XZ anchor (`seatAnchorLocalToWorld(... [0, NAMEPLATE_LOCAL_Y, 0])`).
3. `computeBillboardYRotation` is pure.

Callback ordering (which `useFrame` fires first) is irrelevant — neither consumes the other's state. No subtle drift risk exists from the current implementation. The concern is purely maintainability: the next time a billboard tweak lands, the two drivers will silently diverge if the author only edits one.

**Suggested Fix:**
Extract a `useBillboardYRotation(objectPos: Vec3): number` hook in `Nameplate.tsx` (or a shared `billboard.ts`) that owns the `useState` + `useFrame` + epsilon logic. Have both components call it. Not a blocker for H-2; file as a follow-up refactor bead.

**Impact:** Low today; grows with any future billboard behavior change.

---

### [LOW] One-frame edge-on paint on scene first mount

**File:** `frontend/src/scenes3d/components/SeatHighlight.tsx`
**Line(s):** L225 (`const [rotationY, setRotationY] = useState<number>(0);`)
**Category:** correctness (edge case)

**Problem:**
Initial state seeds `rotationY = 0`, so the very first render of `<BetGlowOverlay>` (and `<Nameplate>`) paints the plane at the world +Z default. `useFrame` only runs after commit, so frame 1 is edge-on for any off-axis seat. This is a pre-existing `<Nameplate>` behavior that H-2 now mirrors — no new regression, but the glow's typical mount-unmount cadence per bet/raise makes it marginally more observable than the nameplate's always-on pattern. In practice, `<BetGlowOverlay>` is mounted for every seat by the composer (it returns `null` internally rather than unmounting), so `rotationY` persists across `active` toggles and this only fires on initial scene mount. Low real-world visibility.

**Suggested Fix:**
Seed via a `useLayoutEffect` that reads the current camera, or accept the initial frame as a trade-off. Carry forward if ever observed in a user-facing QA report.

**Impact:** Cosmetic; identical behavior to `<Nameplate>`.

---

### [LOW] `frameState as { camera?: ... }` ad-hoc cast duplicated

**File:** `frontend/src/scenes3d/components/SeatHighlight.tsx`
**Line(s):** L248-257
**Category:** convention

**Problem:**
The inline `const fs = frameState as { camera?: { position?: { x: number; z: number } } };` pattern is copy-pasted from `Nameplate.tsx` L253-257. R3F exports a typed `RootState` that would give us real type safety at zero runtime cost. Not a bug — the runtime guards (`typeof camPos.x !== 'number'`) protect against the untyped call sites used in tests.

**Suggested Fix:**
When the billboard helper is extracted (see M-1), type the parameter as `RootState` from `@react-three/fiber` and drop the structural cast.

**Impact:** Style / type hygiene only.

---

### [LOW] `<BetGlowOverlay>` runs billboard driver on all 6 seats every frame, including inactive ones

**File:** `frontend/src/scenes3d/components/SeatHighlight.tsx`
**Line(s):** L243-270
**Category:** design (perf)

**Problem:**
The composer mounts `<BetGlowOverlay>` for every seat and toggles `active` via prop, so the `useFrame` body (camera read + `computeBillboardYRotation` + state compare + potential `setRotationY`) runs 6× per frame even though 0–1 seats are typically glowing. The math itself is `Math.atan2` + two subtracts — negligible. The only concrete cost is the extra `setRotationY` epsilon-gated re-renders on inactive seats, which still hit React reconciliation. Matches the `<Nameplate>` pattern (which is also always-on for all 6 seats), so the incremental cost from H-2 is ~6 extra trig calls per frame. Filing as LOW for the record; the natural fix is to short-circuit at the top of the useFrame body if `!active`, at the cost of the one-frame edge-on flash on glow activation (see L-1 trade-off).

**Suggested Fix:**
Leave as-is, but document the trade-off near the `useFrame` comment so future optimization passes understand why the driver runs unconditionally.

**Impact:** Negligible; no measurable frame-rate impact expected at 6 seats.

---

## Positives

- **Reduced-motion call is correct.** Billboarding is a layout / camera-tracking concern, not an animation preference. Applying rotation regardless of `prefers-reduced-motion` keeps the plane legible for reduced-motion users without violating AC-4 (opacity fade is still gated). The inline comment on L245-247 documents this intent clearly.
- **Cycle 29 M-1(a) probe gap is genuinely closed.** The scene-level `PokerTable.seatHighlights.test.tsx` block "glow rotation tracks the camera across frames" drives two distinct camera positions through `useFrame` and asserts:
  - `phiGlow ≈ phiNameplate` (parity with the billboarded sibling),
  - `|phiGlow| > 0` (not the default world-+Z orientation),
  - `phiGlow2 ≠ phiGlow1` (rotation updates across frames).
  This is exactly the frame-advanced assertion Cycle 29 flagged as missing.
- **Parity test in unit layer.** `SeatHighlight.test.tsx` "matches the sibling `<Nameplate>` rotation for the same camera position" renders both components against the same camera and asserts `toBeCloseTo(phiName, 6)` — 1e-6 rad tolerance. Strong evidence of shared-math correctness.
- **`stepFrames` helper extension is clean.** Third parameter defaults to `{}`, so all existing call sites still work; only the new billboard tests pass a camera.
- **No regressions introduced.** 29/29 SeatHighlight, 11/11 PokerTable.seatHighlights, 36/36 Nameplate, 16/16 PokerTable.playerMode.

---

## Overall Assessment

H-2 is landed cleanly. The fix is minimal, mirrors an established pattern (`<Nameplate>`), and closes both the original H-2 regression and the Cycle 29 M-1(a) probe gap. Zero CRITICAL / zero HIGH findings. The single MEDIUM is a maintainability nudge to extract the billboard driver into a shared hook — not a blocker for closing aia-core-6o9t.2.

**Recommended:** Close the bead. File M-1 as a follow-up refactor (`aia-core-6o9t.X`: Extract `useBillboardYRotation` shared hook). L-1/L-2/L-3 can be folded into that refactor or left on the ledger.
