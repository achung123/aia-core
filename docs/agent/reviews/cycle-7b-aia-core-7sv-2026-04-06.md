# Code Review Report — aia-core

**Date:** 2026-04-06
**Target:** `frontend/src/scenes/table.js`
**Reviewer:** Scott (automated)
**Cycle:** 7b

**Task:** Lifecycle fix — store RAF handle, implement `dispose()`
**Beads ID:** aia-core-7sv
**Commit reviewed:** d9c66df

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 1 |
| LOW | 1 |
| **Total Findings** | **2** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | `initScene(canvasElement)` sets up renderer, scene, camera, RAF loop | SATISFIED | Lines 3–44; renderer, scene, camera created; `animate()` called immediately | — |
| 2 | Viewport fills canvas; `window.resize` → `setSize` + aspect update | SATISFIED | Lines 29–37; `onResize` updates both `renderer.setSize` and `camera.aspect` + `updateProjectionMatrix()` | — |
| 3 | `AmbientLight(0x404040)` + directional light | SATISFIED | Lines 21–26; `AmbientLight(0x404040)` and `DirectionalLight(0xffffff, 1.0)` added to scene | — |
| 4 | Camera at (0,8,5) looking at origin | SATISFIED | Lines 17–18; `camera.position.set(0, 8, 5); camera.lookAt(0, 0, 0)` | — |
| 5 | Stable RAF loop | SATISFIED | Lines 40–43; `rafId` captured on every `requestAnimationFrame` call; `dispose()` calls `cancelAnimationFrame(rafId)` | — |

All 5 ACs: **SATISFIED**.

---

## Findings

### [MEDIUM] `renderer.dispose()` not called in `dispose()`

**File:** `frontend/src/scenes/table.js`
**Line(s):** 47–50
**Category:** design (resource management)

**Problem:**
`dispose()` cancels the RAF loop and removes the resize listener, but does not call `renderer.dispose()`. Three.js `WebGLRenderer` holds GPU resources (WebGL context, shader programs, framebuffers). If the caller re-mounts the scene (e.g. React StrictMode double-invoke, SPA route transitions) the old renderer's GPU resources remain allocated, causing a WebGL context leak that degrades over time.

**Current code:**
```js
function dispose() {
  cancelAnimationFrame(rafId);
  window.removeEventListener('resize', onResize);
}
```

**Suggested fix:**
```js
function dispose() {
  cancelAnimationFrame(rafId);
  window.removeEventListener('resize', onResize);
  renderer.dispose();
}
```

---

### [LOW] Initial `renderer.setSize` uses `clientWidth/clientHeight` before layout is stable

**File:** `frontend/src/scenes/table.js`
**Line(s):** 5–6
**Category:** correctness (edge case)

**Problem:**
`renderer.setSize(canvasElement.clientWidth, canvasElement.clientHeight)` and the camera aspect ratio are computed at call time. If `initScene` is called before the canvas has been laid out (e.g. in a `<script>` tag before first paint, or in a framework `onMount` that fires before CSS is applied), `clientWidth`/`clientHeight` may be 0, producing a degenerate 0×0 renderer and `NaN` camera aspect. The `onResize` handler will correct this on the next resize event, but not immediately.

This is only a risk if callers invoke `initScene` at an unusual lifecycle point. No fix is strictly required if the caller guarantees the canvas has been painted, but documenting the assumption (or calling `onResize()` once at the end of `initScene`) would close the gap.

**Suggested mitigation (optional, non-breaking):**
```js
// After window.addEventListener('resize', onResize) — ensure initial size is correct
onResize();
```

---

## What Was Done Well

- `rafId` is reassigned on every `requestAnimationFrame` call (line 41), which is the correct pattern — ensures the final pending frame ID is always what gets cancelled, even if `animate` is called multiple times.
- `onResize` is a named function reference (not an inline arrow), making `removeEventListener` reliable (same reference required by the Web API).
- Return value exposes `{ renderer, scene, camera, dispose }` — clean, minimal public surface.
- All 5 original acceptance criteria are fully satisfied.

---

## Overall Assessment

The lifecycle fix is correct and complete for its stated scope. The RAF handle is properly captured and cancelled; the resize listener is properly removed using the same named-function reference. No critical or high issues found.

The one medium finding (`renderer.dispose()` missing) is a true resource-management gap worth addressing before this module is used in a long-lived SPA context. The low finding is a defensive hardening suggestion, not a bug under normal usage.

**Recommendation:** Address the MEDIUM finding (`renderer.dispose()`) before shipping to production. The LOW finding can be deferred or handled via a code comment.
