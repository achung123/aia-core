# Code Review Report — table-3d-revamp-010

**Loop Context:** Cycle 9 | Task: aia-core-wqon | Epic: table-3d-revamp-010 | Date: 2026-04-18

**Date:** 2026-04-18
**Target:** `frontend/src/scenes3d/components/CameraRig.tsx`, `frontend/test/scenes3d/CameraRig.test.tsx`
**Reviewer:** Scott (automated)

**Task:** T-008 — Implement `<CameraRig>` with drei OrbitControls
**Beads ID:** aia-core-wqon

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 3 |
| LOW | 3 |
| **Total Findings** | **6** |

---

## Acceptance Criteria Verification

### T-008 ACs

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | OrbitControls has `enableDamping`, touch gestures enabled, zoom/pitch clamped for above-table viewing | SATISFIED | [CameraRig.tsx:58-68](frontend/src/scenes3d/components/CameraRig.tsx#L58-L68), [CameraRig.test.tsx:71-94](frontend/test/scenes3d/CameraRig.test.tsx#L71-L94) | `enableDamping=true`, `dampingFactor=0.08`, polar clamped `[π/9, 0.45π]`, distances `[4,14]` |
| 2 | Single-finger orbit, pinch zoom, two-finger pan on touch | SATISFIED | [CameraRig.tsx:153-156](frontend/src/scenes3d/components/CameraRig.tsx#L153-L156), [CameraRig.test.tsx:160-167](frontend/test/scenes3d/CameraRig.test.tsx#L160-L167) | `touches.ONE=TOUCH.ROTATE`, `touches.TWO=TOUCH.DOLLY_PAN` (pinch→dolly, 2-finger→pan simultaneously) |
| 3 | A test mounts `<CameraRig>` and asserts OrbitControls config values | SATISFIED | [CameraRig.test.tsx:143-159](frontend/test/scenes3d/CameraRig.test.tsx#L143-L159) | Spy captures all 11 orbit fields and asserts per-field equality against the spectator config |
| 4 | `target` prop updates re-center the camera smoothly | SATISFIED | [CameraRig.tsx:116-121](frontend/src/scenes3d/components/CameraRig.tsx#L116-L121), [CameraRig.test.tsx:176-185](frontend/test/scenes3d/CameraRig.test.tsx#L176-L185) | Damping forces interpolation; rerender test confirms the new target is forwarded and damping remains on |

### Cross-referenced S-5.2 ACs (player camera)

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| S-5.2 #1 | Camera initializes at the viewer's seat POV | PARTIAL | [CameraRig.tsx:80-82](frontend/src/scenes3d/components/CameraRig.tsx#L80-L82) | Default `position=[0, 2.4, 4.5]` is seat-agnostic; seat-specific placement is explicitly deferred to T-022 per task notes. The rig *accepts* a position override, but the preset ships with a fixed default pose. |
| S-5.2 #2 | ±30° yaw, limited pitch, tightened zoom | SATISFIED | [CameraRig.tsx:86-96](frontend/src/scenes3d/components/CameraRig.tsx#L86-L96), [CameraRig.test.tsx:100-120](frontend/test/scenes3d/CameraRig.test.tsx#L100-L120) | Yaw `±π/6`, polar `[π/4, 0.425π]`, distance `[3,6]`, `enablePan=false` |
| S-5.2 #3 | Camera preset buttons hidden | NOT APPLICABLE | — | Toolbar/preset UI belongs to T-021; out of scope for T-008 |
| S-5.2 #4 | Double-tap resets to default seat POV | NOT APPLICABLE | — | Deferred to T-021/T-022 per task notes |

---

## Findings

### [MEDIUM] Player yaw clamp is world-absolute, but player seat position is caller-controlled — opens a future privacy gap

**File:** `frontend/src/scenes3d/components/CameraRig.tsx`
**Line(s):** 85-96
**Category:** design / privacy-equity

**Problem:**
`PLAYER_CAMERA_CONFIG` pins `minAzimuthAngle = -π/6` and `maxAzimuthAngle = +π/6` as *absolute* world-space yaw bounds measured from `target=[0,0,0]`. This is correct when the player happens to be seated behind `+z` and looking at the origin (the current default pose). But `position` is a caller-overridable prop (explicitly by design per the task summary), and T-022 will supply seat-specific positions for seats 0..N. At any seat whose angular placement around the table is outside the ±30° cone of world `+z`, the yaw clamp will not express the intended "cannot look sideways past my own shoulders" semantics — it will instead lock the player to look toward world-z, potentially *away* from the community. The clamp and the pose become decoupled.

The S-5.2 privacy guarantee ("zoom range tightened to prevent seeing behind opponents") implicitly assumes yaw is clamped **relative to the viewer's natural forward**, not world yaw.

**Code:**
```ts
minAzimuthAngle: -Math.PI / 6,
maxAzimuthAngle:  Math.PI / 6,
```

**Suggested Fix:**
Track this now as a P1 follow-up against T-022 (seat-POV placement) so the seat-specific work lands the rotation offset at the same time as the seat position. One of:
- Accept a `yawCenter` (azimuth offset) prop on `<CameraRig>` and express the clamp as `[yawCenter - π/6, yawCenter + π/6]`; T-022 computes it from seat angle around the table.
- Or place the *target* at the table center and rotate the *player's local up* such that the canonical yaw=0 always means "looking at the community", and document the contract.

**Impact:** In the current default scene the clamp is correct and privacy holds. But the moment T-022 turns on seat-specific positions, a silent regression is possible: a player in seat 3 could legally (per clamp) rotate to look at seat 5's cards. Fileable follow-up on T-022; does not block closing T-008.

---

### [MEDIUM] Player preset's `minDistance`, `maxDistance`, and pitch clamps are not pinned to absolute numeric values in tests

**File:** `frontend/test/scenes3d/CameraRig.test.tsx`
**Line(s):** 113-117
**Category:** test coverage / regression pinning

**Problem:**
The test suite pins the player-privacy-relevant **yaw** clamps to absolute numeric values (`toBeCloseTo(-Math.PI/6, 6)`) — good. But the zoom and pitch clamps, which are equally part of the S-5.2 "prevent seeing behind opponents" guarantee, are only asserted **relatively**:

```ts
expect(PLAYER_CAMERA_CONFIG.orbit.maxDistance).toBeLessThanOrEqual(
  SPECTATOR_CAMERA_CONFIG.orbit.maxDistance,
);
```

A future regression could legally widen `maxDistance` to `13` (still `≤ 14` spectator) and silently break the zoom-out privacy intent. `minDistance` for the player is not asserted at all. Player `minPolarAngle` / `maxPolarAngle` are asserted only by their presence on the object, not by value. Spectator pitch is asserted only as `>0` and `<π/2`.

**Suggested Fix:**
Add absolute-value invariants for each privacy-relevant clamp, e.g.:
```ts
expect(PLAYER_CAMERA_CONFIG.orbit.minDistance).toBe(3);
expect(PLAYER_CAMERA_CONFIG.orbit.maxDistance).toBe(6);
expect(PLAYER_CAMERA_CONFIG.orbit.minPolarAngle).toBeCloseTo(Math.PI / 4, 6);
expect(PLAYER_CAMERA_CONFIG.orbit.maxPolarAngle).toBeCloseTo(Math.PI * 0.425, 6);
```
The point is **not** to hard-code implementation, but to make any future widening of a privacy clamp visible as a loud test diff that forces a review conversation.

**Impact:** Without absolute pins, an innocent "tune the zoom feel" change could silently widen equity-relevant bounds. This is exactly the user's stated concern in the loop-review focus.

---

### [MEDIUM] `position` and `target` props pass new array literals straight through — callers can thrash drei's camera.set()/controls.target.copy() on every parent render

**File:** `frontend/src/scenes3d/components/CameraRig.tsx`
**Line(s):** 143-169
**Category:** performance / memoization

**Problem:**
`effPosition = position ?? base.position` and `effTarget = target ?? base.target` forward whatever reference the caller passed. If a consumer renders `<CameraRig target={[x, y, z]} />` inline — which is the idiomatic R3F call site — a fresh array is allocated on every parent render. drei's `<PerspectiveCamera>` and `<OrbitControls>` key update work off shallow-equal props, and arrays-as-vectors re-issue `camera.position.set(...)` / `controls.target.copy(...)` on every render. For a static scene this is invisible; in the S-4.1 cinematic-orbit use case (re-renders every frame) it compounds.

The `touches` object is correctly memoized ([CameraRig.tsx:152-156](frontend/src/scenes3d/components/CameraRig.tsx#L152-L156)) — which establishes the team's intent — but the more consequential `position`/`target` arrays escape.

**Code:**
```ts
const effPosition = position ?? base.position;
const effTarget = target ?? base.target;
const effFov = fov ?? base.fov;
```

**Suggested Fix:**
Either (a) document the contract that consumers must pass stable references (easy, low-cost), or (b) normalize to a stable ref here:
```ts
const effPosition = useMemo<Vec3>(
  () => (position ? [position[0], position[1], position[2]] : base.position),
  [position?.[0], position?.[1], position?.[2], base.position],
);
// same for effTarget
```
Option (a) is sufficient if T-021's tween driver will memoize anyway; file as a doc-only follow-up.

**Impact:** No correctness issue today. Becomes relevant when T-021 cinematic orbit and T-022 seat POV start driving `position`/`target` imperatively; worth pinning the contract before those land.

---

### [LOW] Both `<PerspectiveCamera>` and `<OrbitControls>` receive `makeDefault` tied to the same prop — not independently toggleable

**File:** `frontend/src/scenes3d/components/CameraRig.tsx`
**Line(s):** 160, 168
**Category:** design

**Problem:**
The single `makeDefault` prop gates both the camera and the controls. This matches the common case, but means a consumer cannot keep `PokerCanvas`'s inline Canvas-default camera while still installing the rig's orbit controls (useful for test harnesses or split-view rendering). Also, in React StrictMode the `makeDefault` swap/restore cycle happens twice per mount — drei handles this correctly in current versions, but the behavior is worth pinning with a test that mounts + unmounts the rig inside a real `<Canvas>` to confirm the restored default is sane.

**Suggested Fix:**
Either split into `cameraMakeDefault` and `controlsMakeDefault` (and default both to the same value), or leave as-is and add a comment stating that the two are intentionally coupled. StrictMode double-mount should get its own smoke test under T-009 when the rig is first composed into a real Canvas.

**Impact:** Low — no known breakage; this is a "seam for future flexibility and a gap in defense-in-depth testing."

---

### [LOW] `PokerCanvas` inline camera and `CameraRig`'s default are duplicated magic numbers

**File:** `frontend/src/scenes3d/PokerCanvas.tsx`, `frontend/src/scenes3d/components/CameraRig.tsx`
**Line(s):** [PokerCanvas.tsx:37](frontend/src/scenes3d/PokerCanvas.tsx#L37), [CameraRig.tsx:51-53](frontend/src/scenes3d/components/CameraRig.tsx#L51-L53)
**Category:** convention / DRY

**Problem:**
`PokerCanvas` declares `camera={{ position: [0, 6, 8], fov: 45, near: 0.1, far: 100 }}` — the exact numeric triple also hard-coded inside `SPECTATOR_CAMERA_CONFIG` (`position: [0, 6, 8]`, `fov: 45`). This is the *intentional* contract ("rig-absent fallback matches rig-present default so consumers can't see a visual jump"), but the coupling is undocumented and nothing will fail if one drifts. The S-1.2 AC #3 (`<CameraRig>` wraps OrbitControls with touch gestures enabled and damping tuned for mobile) implicitly relies on this match.

**Suggested Fix:**
Import `SPECTATOR_CAMERA_CONFIG` into `PokerCanvas.tsx` and seed the inline camera from it, e.g.:
```ts
camera={{
  position: SPECTATOR_CAMERA_CONFIG.position,
  fov: SPECTATOR_CAMERA_CONFIG.fov,
  near: 0.1,
  far: 100,
}}
```
Or document the coupling in a comment on both sides.

**Impact:** Cosmetic today. Becomes a silent visual bug if the spectator position is ever retuned and only one of the two sites is updated.

---

### [LOW] `viewer.seat` is accepted but ignored; no dev-only warning when `policy='player'` without a seat

**File:** `frontend/src/scenes3d/components/CameraRig.tsx`
**Line(s):** 98-102
**Category:** correctness / DX

**Problem:**
`getCameraRigConfig()` branches only on `viewer.policy`. `types.ts` marks `seat` as required-when-player (`Required when policy === 'player'; ignored otherwise`). If a caller sets `policy='player'` and forgets `seat`, the rig silently applies the player clamps with the generic `[0, 2.4, 4.5]` default position. That's defensible (clamps still protect privacy), but it hides a bug.

**Suggested Fix:**
Add a dev-only assertion:
```ts
if (import.meta.env.DEV && viewer?.policy === 'player' && viewer.seat == null) {
  console.warn('[CameraRig] viewer.policy="player" without viewer.seat; falling back to generic player pose.');
}
```
Can also be a follow-up aligned with T-022 when `seat` becomes actually-consumed.

**Impact:** Low — no runtime break; just a quieter failure mode than it should be.

---

## Positives

- **TDD discipline** — 23 tests for a ~170-line component; red-first is visible in the way spies capture *every* forwarded prop rather than only happy-path ones.
- **Configuration is data, not code** — `SPECTATOR_CAMERA_CONFIG` and `PLAYER_CAMERA_CONFIG` as plain exported constants means T-021 (preset buttons) and T-022 (seat POV) can compose/override cleanly without re-deriving the rig shape. The doc comment on `OrbitConfig` explicitly names this intent.
- **Honest scope boundary** — the player preset comment (`T-008 only guarantees the clamps — seat-specific position is injected by the caller`) makes the deferral to T-022 unambiguous, which is exactly how multi-task privacy work should be handed off.
- **Touch gesture mapping is memoized** — small detail, but shows the author was thinking about render stability.
- **Spec-to-value traceability in tests** — the `±30° = ±π/6 rad` comment inside the yaw-clamp test ties the assertion directly to S-5.2 AC #2, which is what makes the test legible to a future reviewer.
- **Privacy-relevant defaults are sensibly conservative** — `enablePan=false` in player mode, `maxDistance=6` (vs spectator's 14), and pitch capped at `0.425π` all point the same direction: "harder to see anything other than your own hand + community".

---

## Overall Assessment

T-008 lands cleanly. Zero critical or high findings. All four T-008 acceptance criteria are fully satisfied, and the three player-camera clamps that matter for S-5.2 equity/privacy (yaw, zoom-out, pan) are in place and test-pinned. The task-summary's list of explicit deferrals (seat-specific position, preset UI, double-tap reset, cinematic auto-orbit) is a faithful reading of what T-008 does and does not own.

The three MEDIUM findings cluster around a single theme the user flagged in the focus prompt: **clamp invariants need to be defended against silent erosion**, in two directions — (a) the world-absolute yaw clamp is only correct for the current seat-0-ish default pose and will need a seat-rotated variant when T-022 lands, and (b) the privacy clamps on zoom and pitch are not pinned to absolute values in tests, so a future "feels-better" tweak could widen them without the suite complaining. Both are follow-ups rather than T-008 blockers; both belong on T-022 and on a small test-hardening task respectively.

No commit is made — this is a loop review; Anna owns the git workflow.

**Recommendation:** Close T-008 / aia-core-wqon. File two P2 follow-ups discovered-from aia-core-wqon: (1) seat-rotated yaw clamp alongside T-022 seat POV, (2) absolute-value pins for player zoom + pitch clamps in the test suite. Defer the three LOW findings to tasks.md notes.
