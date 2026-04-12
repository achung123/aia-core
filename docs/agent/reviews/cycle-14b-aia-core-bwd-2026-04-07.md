# Code Review Report — cycle-14b — aia-core-bwd — 2026-04-07

**Task:** aia-core-bwd — Wire chipStacks module into playbackView.js
**Reviewer:** Scott
**Cycle:** 14b
**Date:** 2026-04-07

---

## Files Reviewed

| File | Role |
|---|---|
| `frontend/src/views/playbackView.js` | Primary — wiring target |
| `frontend/src/scenes/chipStacks.js` | Reference — module being wired |
| `frontend/src/scenes/tableGeometry.js` | Reference — `computeSeatPositions` contract |

---

## Acceptance Criteria Assessment

| # | Criterion | Status |
|---|---|---|
| AC-1 | `createChipStacks` is imported from `chipStacks.js` | PASS |
| AC-2 | `createChipStacks` called after `computeSeatPositions()` | PASS |
| AC-3 | `updateChipStacks` called in `__onSessionLoaded` with correct `seatPlayerMap` | PASS |
| AC-4 | Chip stacks render in the scene (reviewable from code) | PASS |

---

## Detailed Findings

### CRITICAL

_None._

---

### HIGH

_None._

---

### MEDIUM

#### M-1 — `chipStacksCtrl.dispose()` not called on view teardown

**File:** `frontend/src/views/playbackView.js`, lines 23–39
**Description:**
`createChipStacks` adds 10 `THREE.Group` objects to the scene immediately at call time. The controller's `dispose()` method (which calls `scene.remove(group)`, `discGeom.dispose()`, and cancels any running animations) is never invoked. If `renderPlaybackView` is called a second time — e.g., the SPA router navigates away and back — a second set of 10 chip-stack groups will be added to the scene without the first set being removed, resulting in doubled geometry and a material/animation leak.

Note: this is consistent with the existing pattern for `initScene`'s own `dispose` return value, which is also never called. The chip-stacks wiring does not make the situation worse in practice under current single-load usage, but the gap compounds the pre-existing teardown debt.

**Suggested fix:**
Capture the `dispose` return from `initScene` and the `chipStacksCtrl.dispose` in a view-level cleanup function that is called before re-rendering:
```js
const { renderer, scene, camera, dispose: disposeScene } = initScene(canvas);
// ...
const chipStacksCtrl = createChipStacks(scene, seatPositions, {});

function teardown() {
  chipStacksCtrl.dispose();
  disposeScene();
}
// Expose teardown for the router or re-render guard.
```

---

### LOW

#### L-1 — P/L map always empty at session load; chip heights are permanently neutral

**File:** `frontend/src/views/playbackView.js`, line 39
**Description:**
`chipStacksCtrl.updateChipStacks({}, seatPlayerMap)` passes an empty object as `playerPLMap`. The `chipStacks.js` logic correctly falls through to the "no P/L data — neutral half-height stack" branch for every player, so all stacks render at `NEUTRAL_HEIGHT` (0.3 units) in grey regardless of the loaded session. The visual is indistinguishable from the initial unloaded state.

This is expected scaffolding for this task — the wiring is structurally correct and P/L data will be supplied by a future hand-scrubber integration. Flagged as LOW to ensure it is tracked and not mistaken for a working P/L visualisation during QA.

---

## Summary

The wiring is correct at every checkpoint. `createChipStacks` is imported cleanly, called immediately after `computeSeatPositions()` with the right arguments, and its controller is properly captured in a closure shared with `window.__onSessionLoaded`. The `seatPlayerMap` construction (`playerNames.forEach((name, i) => { seatPlayerMap[i] = name; })`) is compatible with the integer-keyed lookup in `chipStacks.js` (`_seatPlayerMap[seatIndex]`). The `THREE.Vector3` objects returned by `computeSeatPositions` are compatible with `createChipStack`'s `position.x / .y / .z` access. Chip stacks are added to the scene at construction time and will be visible as neutral-height grey cylinders around all 10 seat positions immediately on view load.

No CRITICAL or HIGH issues were introduced by this change.

---

## Findings Summary

```
FINDINGS SUMMARY: C:0 H:0 M:1 L:1
```
