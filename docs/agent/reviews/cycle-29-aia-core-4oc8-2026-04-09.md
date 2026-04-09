# Code Review Report — dealer-viz-004

**Date:** 2026-04-09
**Cycle:** 29
**Target:** `frontend/src/scenes/pokerScene.js`, `frontend/src/scenes/pokerScene.test.js`
**Reviewer:** Scott (automated)

**Task:** T-021 — Touch controls for Three.js scene
**Beads ID:** aia-core-4oc8

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 1 |
| MEDIUM | 1 |
| LOW | 2 |
| **Total Findings** | **4** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | Pinch-to-zoom works on mobile | PARTIAL | `pokerScene.js` L50-51: enableZoom=true, touches.TWO=DOLLY_ROTATE | Zoom is configured, but double-tap reset triggers on pinch-end (see HIGH finding) — zoom is immediately undone |
| 2 | Single-finger drag orbits the camera | SATISFIED | `pokerScene.js` L49,53: enableRotate=true, touches.ONE=ROTATE; test "enables damping and zoom on OrbitControls" | |
| 3 | Double-tap resets camera to default position | SATISFIED | `pokerScene.js` L61-71: touchend handler with 300ms threshold; tests "double-tap on canvas resets camera position" and "single tap does not reset camera" | |
| 4 | OrbitControls does not interfere with scrubber touch events | SATISFIED | OrbitControls attached to canvas element only (L48), not document; enablePan=false prevents scroll conflicts | No automated test — relies on DOM event scoping |
| 5 | Context menu is suppressed on long-press | SATISFIED | `pokerScene.js` L57-58: contextmenu event handler with preventDefault(); test "suppresses context menu on the canvas" | |

---

## Findings

### [HIGH] Double-tap reset triggers on pinch-zoom end

**File:** `frontend/src/scenes/pokerScene.js`
**Line(s):** 61-71
**Category:** correctness

**Problem:**
The `onTouchEnd` handler does not check `event.touches.length`. When a user completes a pinch-zoom gesture and lifts both fingers, two `touchend` events fire in rapid succession (one per finger). The second event arrives within the 300ms double-tap window, triggering `controls.reset()` — which immediately reverts the zoom the user just performed. This makes pinch-to-zoom effectively non-functional on real devices.

**Code:**
```javascript
function onTouchEnd() {
  const now = Date.now();
  if (now - lastTapTime < DOUBLE_TAP_MS) {
    controls.reset();
    lastTapTime = 0;
  } else {
    lastTapTime = now;
  }
}
```

**Suggested Fix:**
Accept the event parameter and only count taps when all fingers are off the screen (`e.touches.length === 0` and `e.changedTouches.length === 1`):

```javascript
function onTouchEnd(e) {
  if (e.touches.length > 0) return;          // still fingers on screen
  if (e.changedTouches.length > 1) return;   // multi-finger lift
  const now = Date.now();
  if (now - lastTapTime < DOUBLE_TAP_MS) {
    controls.reset();
    lastTapTime = 0;
  } else {
    lastTapTime = now;
  }
}
```

**Impact:** AC #1 (pinch-to-zoom) is broken — every zoom immediately resets. Users cannot explore the 3D scene with pinch gestures.

---

### [MEDIUM] No test for multi-finger touchend not triggering reset

**File:** `frontend/src/scenes/pokerScene.test.js`
**Line(s):** 248-260 (double-tap tests)
**Category:** correctness

**Problem:**
The test suite verifies that a double-tap resets the camera and a single tap does not, but does not test that lifting two fingers from a pinch gesture avoids triggering the reset. This is the scenario that would catch the HIGH finding above.

**Suggested Fix:**
Add a test that dispatches two `touchend` events with `touches.length > 0` on the first (simulating one finger still down) and verifies `reset` is not called.

**Impact:** The HIGH bug above would have been caught with this test.

---

### [LOW] No zoom distance limits on OrbitControls

**File:** `frontend/src/scenes/pokerScene.js`
**Line(s):** 48-56
**Category:** design

**Problem:**
OrbitControls has no `minDistance` or `maxDistance` set. Users can zoom infinitely close (clipping through the table) or infinitely far (losing the scene). On mobile touch, accidental aggressive pinches can more easily overshoot.

**Suggested Fix:**
```javascript
controls.minDistance = 3;
controls.maxDistance = 20;
```

**Impact:** Minor UX annoyance — users can lose sight of the table. Not blocking.

---

### [LOW] Fallback magic numbers in TOUCH enum

**File:** `frontend/src/scenes/pokerScene.js`
**Line(s):** 53-54
**Category:** convention

**Problem:**
The fallback values `?? 0` and `?? 3` are undocumented Three.js enum values. While the optional chaining is good defensive coding, if `THREE.TOUCH` were ever absent, the raw integers would be opaque to future readers.

**Suggested Fix:**
Add a brief comment or const:
```javascript
// THREE.TOUCH enums: ROTATE=0, PAN=1, DOLLY_PAN=2, DOLLY_ROTATE=3
```

**Impact:** Negligible — `THREE.TOUCH` is always present in supported Three.js versions.

---

## Positives

- **Complete cleanup**: `dispose()` removes all event listeners (`contextmenu`, `touchend`, `resize`), cancels the animation frame, and disposes OrbitControls, renderer, and sub-components. No memory leaks.
- **Good test coverage**: 8 new tests in the `touch controls` describe block cover OrbitControls creation, config flags, context menu suppression, double-tap reset, single-tap non-reset, and cleanup. The mock strategy for OrbitControls is clean.
- **Defensive coding**: Optional chaining on `THREE.TOUCH` and `canvas.parentElement?.clientWidth` handles edge cases gracefully.
- **`saveState()` before any user interaction**: Ensures `reset()` returns to the exact initial camera position.
- **`enablePan = false`**: Correctly prevents pan gestures from conflicting with page scroll or scrubber swipes.
- **Animation loop calls `controls.update()`**: Required for damping to work — correctly placed.

---

## Overall Assessment

The implementation is well-structured with proper cleanup and solid test coverage. The one HIGH finding — pinch-zoom end triggering camera reset — is a functional defect that would make pinch-to-zoom unusable on real touch devices. The fix is straightforward (filter `touchend` by `touches.length`). After addressing the HIGH, all five ACs would be fully satisfied.
