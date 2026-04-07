# Code Review Report — aia-core

**Date:** 2026-04-06
**Cycle:** 7
**Target:** `frontend/src/scenes/table.js`
**Reviewer:** Scott (automated)

**Task:** Build base Three.js scene (renderer, camera, lighting)
**Beads ID:** aia-core-puw

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 2 |
| MEDIUM | 1 |
| LOW | 0 |
| **Total Findings** | **3** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | `initScene(canvasElement)` sets up renderer, scene, camera, RAF loop | SATISFIED | `table.js` lines 3–46: WebGLRenderer, Scene, PerspectiveCamera, `animate()` RAF loop all constructed and started | Returns `{ renderer, scene, camera }` |
| 2 | Viewport fills canvas; resize triggers setSize and camera aspect update | SATISFIED | `table.js` lines 29–36: `onResize` calls `renderer.setSize(w, h)`, updates `camera.aspect`, calls `camera.updateProjectionMatrix()` | Listener registered on `window` |
| 3 | Ambient light (0x404040) and directional key light | SATISFIED | `table.js` lines 20–26: `AmbientLight(0x404040)` and `DirectionalLight(0xffffff, 1.0)` at position `(5, 10, 7.5)` | Exact color match |
| 4 | Camera at ~(0, 8, 5) looking at origin | SATISFIED | `table.js` lines 16–17: `camera.position.set(0, 8, 5)` and `camera.lookAt(0, 0, 0)` | Exact position match |
| 5 | Stable RAF loop | PARTIAL | `table.js` lines 39–43: `animate()` self-schedules via `requestAnimationFrame(animate)` — loop is stable for single-call usage | No cancellation mechanism; loop cannot be stopped; re-calling `initScene` starts a second loop alongside the first |

---

## Findings

### [HIGH] RAF loop is not cancellable — double-loop on re-initialisation

**File:** `frontend/src/scenes/table.js`
**Line(s):** 39–43
**Category:** correctness

**Problem:**
`requestAnimationFrame(animate)` is called inside `animate()` but the handle returned by `requestAnimationFrame` is never stored. There is no way for the caller to call `cancelAnimationFrame(id)` to halt the loop. Every invocation of `initScene` starts a new, independent animation loop that runs forever. If `initScene` is called more than once — through HMR, a component remount, or any canvas teardown/re-setup path — all previously created loops continue rendering into now-discarded renderers, burning CPU/GPU indefinitely and preventing garbage collection of the previous renderer and scene graph.

**Code:**
```js
function animate() {
  requestAnimationFrame(animate);   // handle is discarded
  renderer.render(scene, camera);
}
animate();
```

**Suggested Fix:**
Capture the RAF handle and return a `dispose` function:
```js
let rafId;
function animate() {
  rafId = requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
animate();

return {
  renderer, scene, camera,
  dispose() {
    cancelAnimationFrame(rafId);
    window.removeEventListener('resize', onResize);
    renderer.dispose();
  },
};
```

**Impact:** Silent performance degradation and CPU/GPU leak on any re-initialisation path. Not observable in a simple single-call startup, but will manifest during development (Vite HMR) and in any future component lifecycle that recreates the canvas.

---

### [HIGH] Resize event listener leaks on re-initialisation

**File:** `frontend/src/scenes/table.js`
**Line(s):** 31–36
**Category:** correctness

**Problem:**
`window.addEventListener('resize', onResize)` registers the listener using an inner closure that is never exposed to the caller. There is no corresponding `removeEventListener` call anywhere in the module, and `onResize` cannot be referenced externally. Every call to `initScene` adds another resize listener that captures a stale renderer and camera. Over repeated initialisations, all stale listeners continue to fire, each updating dead renderer instances.

**Code:**
```js
function onResize() { ... }
window.addEventListener('resize', onResize);
// onResize is never exported or returned — cannot be cleaned up
```

**Suggested Fix:**
Include `window.removeEventListener('resize', onResize)` in the `dispose` function described in the RAF finding above. Both leaks are resolved by the same pattern.

**Impact:** Accumulating `resize` listeners that keep stale closures (and their captured renderer/camera objects) alive in memory, and fire resize logic on every window resize event regardless of whether the corresponding canvas is still in the DOM.

---

### [MEDIUM] No cleanup / dispose mechanism returned from `initScene`

**File:** `frontend/src/scenes/table.js`
**Line(s):** 46
**Category:** design

**Problem:**
`initScene` returns `{ renderer, scene, camera }` but exposes no lifecycle teardown. The caller has the renderer reference but cannot stop the RAF loop (no handle) and cannot deregister the resize listener (no reference to `onResize`). The two HIGH findings above are both direct consequences of this design gap. Any callers that want graceful teardown must work around this by reaching into Three.js internals and guessing the RAF ID, which is error-prone.

**Suggested Fix:**
Return a `dispose()` function alongside the scene objects (see the example in the RAF finding). This is a single-line surface change to the return value once the handle and listener teardown are in place.

**Impact:** Blocks correct lifecycle management in the calling layer; forces all resource-leak risk onto the consumer of this API.

---

## Positives

- `renderer.setPixelRatio(window.devicePixelRatio)` is present (line 4) — a common oversight, correctly included here.
- `camera.updateProjectionMatrix()` is called after aspect changes in `onResize` — correct Three.js pattern.
- Camera position `(0, 8, 5)` with `lookAt(0, 0, 0)` exactly matches the spec.
- `AmbientLight(0x404040)` color matches the spec exactly.
- Scene background colour (`0x1a1a2e`) is a nice ambient touch.
- Renderer is initialised with the provided canvas element directly — no implicit canvas creation, which is the correct approach for caller-controlled DOM.

---

## Overall Assessment

All five acceptance criteria are satisfied for the single-call case: the renderer, camera, lighting, resize handler, and RAF loop are all correctly wired. The implementation will work correctly in a simple single-mount scenario.

The two HIGH findings are not theoretical — Vite HMR alone is sufficient to trigger the double-loop and listener accumulation bug during normal development. Both findings share a root cause (no dispose mechanism) and can be resolved together in a few lines.

**Recommended action before closing this task:** Add a `dispose()` function to the return value that calls `cancelAnimationFrame(rafId)`, `window.removeEventListener('resize', onResize)`, and `renderer.dispose()`. This makes AC 5 ("stable RAF loop") fully satisfied under all lifecycle conditions rather than just the happy path.
