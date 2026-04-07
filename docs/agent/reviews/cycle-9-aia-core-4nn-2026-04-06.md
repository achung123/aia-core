# Code Review Report — aia-core

**Date:** 2026-04-06
**Target:** `frontend/src/scenes/tableGeometry.js`
**Reviewer:** Scott (automated)
**Cycle:** 9

**Task:** Build oval poker table geometry and seat positions
**Beads ID:** aia-core-4nn
**Commit:** `5bf68f5`

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
| 1 | CylinderGeometry scaled on X, green MeshLambertMaterial | SATISFIED | `tableGeometry.js` lines 8–14: `new THREE.CylinderGeometry(1, 1, 0.1, 64)`, `.scale(TABLE_RADIUS_X, 1, TABLE_RADIUS_Z)`, color `0x1a7a1a` | — |
| 2 | 10 evenly-spaced ellipse seats | SATISFIED | `tableGeometry.js` lines 18–25: `SEAT_COUNT = 10`, `(i / SEAT_COUNT) * Math.PI * 2`, x/z mapped to cos/sin × respective radii | — |
| 3 | div.seat-label projected 3D→2D each frame | PARTIAL | `tableGeometry.js` lines 42–53: projection implemented, but no `projected.z` guard — labels remain visible and positionally incorrect when a seat falls behind the camera frustum | See HIGH finding |
| 4 | `loadSession(labels, playerNames)` assigns names to seats, shows/dims | SATISFIED | `tableGeometry.js` lines 55–63: iterates all labels, sets `textContent` and `opacity` | — |
| 5 | Unoccupied seats 30% opacity | SATISFIED | `tableGeometry.js` line 61: `label.style.opacity = '0.3'` for seats without a player name | — |

---

## Findings

### [HIGH] Missing behind-camera guard in `updateSeatLabelPositions`

**File:** `frontend/src/scenes/tableGeometry.js`
**Line(s):** 44–52
**Category:** correctness

**Problem:**
After projecting a world-space position into NDC (Normalized Device Coordinates) with `pos.clone().project(camera)`, the resulting `projected.z` value falls in the range `[-1, 1]` for points inside the camera frustum. When a seat is anywhere behind the near plane or behind the camera itself, `projected.z` exceeds `1`. The current code does not check for this condition — it still computes screen-space `x`/`y` from the flipped NDC values and assigns them to `label.style.left`/`top`. This causes the label to appear at a mirrored, incorrect screen position rather than being hidden.

For a fixed overhead camera this is unlikely to trigger in normal usage, but if OrbitControls or any camera animation allow the viewpoint to dip below the table plane, up to half the seat labels could render visibly wrong.

**Code:**
```js
seatPositions.forEach((pos, i) => {
  const projected = pos.clone().project(camera);
  const x = (projected.x * 0.5 + 0.5) * width;
  const y = (1 - (projected.y * 0.5 + 0.5)) * height;
  labels[i].style.left = `${x}px`;
  labels[i].style.top  = `${y}px`;
  labels[i].style.transform = 'translate(-50%, -50%)';
});
```

**Suggested Fix:**
Add a visibility guard before updating position:
```js
seatPositions.forEach((pos, i) => {
  const projected = pos.clone().project(camera);
  if (projected.z > 1) {
    labels[i].style.display = 'none';
    return;
  }
  labels[i].style.display = '';
  const x = (projected.x * 0.5 + 0.5) * width;
  const y = (1 - (projected.y * 0.5 + 0.5)) * height;
  labels[i].style.left = `${x}px`;
  labels[i].style.top  = `${y}px`;
  labels[i].style.transform = 'translate(-50%, -50%)';
});
```

**Impact:** Seats behind the camera render at wrong screen positions; AC3 is only partially satisfied until this is fixed.

---

### [MEDIUM] No DOM cleanup if `createSeatLabels` is called more than once

**File:** `frontend/src/scenes/tableGeometry.js`
**Line(s):** 29–38
**Category:** design

**Problem:**
`createSeatLabels(container)` unconditionally `appendChild`es 10 new `div.seat-label` elements to `container` every time it is called. If the scene is torn down and re-initialized (hot reload, session reset, route change in a SPA), stale labels accumulate in the DOM and all receive `updateSeatLabelPositions` calls through the old `labels` array — but the new call also appends 10 more. There is no teardown/cleanup path.

**Code:**
```js
export function createSeatLabels(container) {
  const labels = [];
  for (let i = 0; i < SEAT_COUNT; i++) {
    const div = document.createElement('div');
    // ...
    container.appendChild(div);
    labels.push(div);
  }
  return labels;
}
```

**Suggested Fix:**
Either (a) clear any existing `.seat-label` children from `container` at the top of the function, or (b) expose a companion `destroySeatLabels(labels)` that removes each element from its parent before the caller recreates the scene.

**Impact:** DOM leak and duplicate labels on re-initialization; low risk for a single-page lifetime but a real issue in any hot-reload or multi-session workflow.

---

### [LOW] `style.transform` set on every frame per label

**File:** `frontend/src/scenes/tableGeometry.js`
**Line(s):** 51
**Category:** convention

**Problem:**
`labels[i].style.transform = 'translate(-50%, -50%)'` is assigned inside the per-frame `forEach` loop in `updateSeatLabelPositions`. The value never changes, so this triggers an unnecessary style recalculation and possible layout invalidation for all 10 labels on every animation frame.

**Suggested Fix:**
Move the `transform` assignment into `createSeatLabels` where the element is initially styled, and remove it from the update loop:
```js
// in createSeatLabels:
div.style.cssText = 'position:absolute;pointer-events:none;color:#fff;font-size:12px;white-space:nowrap;opacity:0.3;transform:translate(-50%,-50%);';
```

**Impact:** Minor per-frame overhead; no functional bug.

---

### [LOW] `BufferGeometry.scale()` does NOT dispatch a dispose event — premise incorrect, code is fine

**File:** `frontend/src/scenes/tableGeometry.js`
**Line(s):** 9
**Category:** correctness (clarification)

**Problem:**
The review checklist asked whether `BufferGeometry.scale()` dispatches a `dispose` event that could cause issues. The premise is incorrect. In Three.js, `BufferGeometry.scale(x, y, z)` constructs a `Matrix4` scale matrix and calls `this.applyMatrix4(m)`, which transforms vertex buffer data in-place and returns `this`. No `dispose` event is dispatched. Only the explicit `BufferGeometry.dispose()` call dispatches a `dispose` event.

The current usage:
```js
const tableGeom = new THREE.CylinderGeometry(1, 1, 0.1, 64);
tableGeom.scale(TABLE_RADIUS_X, 1, TABLE_RADIUS_Z);
```
is correct: the geometry vertices are scaled at construction time, the return value is unused (which is fine), and no dispose side-effect occurs.

**Impact:** No bug. Recording here to close out the checklist item and correct the assumption.

---

## Positives

- **Clean module surface** — five focused, single-responsibility exports with no cross-cutting concerns. Easy to test and compose.
- **Constants extracted** — `SEAT_COUNT`, `TABLE_RADIUS_X`, `TABLE_RADIUS_Z` at the top of the file; changing table dimensions or seat count requires a one-line edit.
- **Correct NDC conversion** — the `(projected.x * 0.5 + 0.5) * width` and `(1 - (projected.y * 0.5 + 0.5)) * height` formula correctly handles Three.js's Y-up NDC to CSS top-down coordinates.
- **`clientWidth/clientHeight` (not `width/height`)** — using CSS pixel dimensions for label positioning is correct; this would break on HiDPI displays if `canvas.width` were used instead.
- **`loadSession` is idempotent** — calling it multiple times safely resets all labels without leaking state.

---

## Overall Assessment

The implementation satisfies 4 of 5 ACs fully. AC3 is partial due to the missing `projected.z > 1` visibility guard, which is the only finding that needs to be addressed before the task can be considered fully complete. The remaining findings are quality improvements (DOM cleanup pattern, per-frame style redundancy) and a clarification (BufferGeometry.scale behavior). No critical or security issues found.

**Recommended next step:** Fix the `projected.z` guard in `updateSeatLabelPositions` (HIGH finding) to fully satisfy AC3. DOM cleanup (MEDIUM) should be tracked as a follow-up if scene re-initialization is in scope.
