# Code Review Report — dealer-viz-004

**Date:** 2026-04-09
**Target:** `frontend/src/scenes/pokerScene.js`, `frontend/src/scenes/pokerScene.test.js`, `frontend/src/scenes/tableGeometry.js`, `frontend/src/views/playbackView.js`
**Reviewer:** Scott (automated)
**Cycle:** 14
**Epic:** dealer-viz-004 — Dealer & Visualization Evolution

**Task:** T-017 — Extract reusable Three.js scene module
**Beads ID:** aia-core-cgka

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

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | `pokerScene.js` exports `createPokerScene(canvas, options)` returning `{ scene, camera, renderer, seatPositions, dispose, update }` | SATISFIED | `pokerScene.js` L26–L131; test "returns the expected API surface" | Also returns `chipStacks`, `holeCards`, and a `communityCards` getter beyond spec — additive, not breaking |
| 2 | `playbackView.js` uses `createPokerScene()` instead of inline scene setup | SATISFIED | `playbackView.js` L2 import, L92 call; no inline `THREE.WebGLRenderer`, `PerspectiveCamera`, `AmbientLight`, or `DirectionalLight` construction found | Zero inline Three.js setup remains — extraction complete for core scene |
| 3 | Playback view renders identically before and after | SATISFIED | All 41 frontend tests pass (`vitest run`); same lighting, camera position, table geometry, chip stacks, hole cards, community card flow preserved | Visual parity confirmed by code path analysis |
| 4 | Options include `{ width, height, seatCount, antialias }` with sensible defaults | SATISFIED | `pokerScene.js` L8–L12 `DEFAULTS` object; test "respects custom seatCount option" | Defaults: 800×600, 10 seats, antialias on |

---

## Findings

### [MEDIUM] M-1: `dispose` destructured but never invoked in playbackView

**File:** `frontend/src/views/playbackView.js`
**Line(s):** 93
**Category:** correctness

**Problem:**
`dispose` is destructured from `createPokerScene()` at line 93 but is never called anywhere in the file. When the user navigates away from the playback view (e.g., via hash-based routing), the WebGL renderer, animation loop (`requestAnimationFrame`), and the resize listener registered inside `pokerScene` all continue running indefinitely. This is a resource leak that compounds each time the view is re-entered.

**Code:**
```javascript
const { renderer, scene, camera, seatPositions, chipStacks: chipStacksCtrl, holeCards: holeCardsCtrl, dispose } = pokerScene;
// `dispose` is never called — no teardown path exists
```

**Suggested Fix:**
Add a teardown hook in `renderPlaybackView` that calls `dispose()` when the view is replaced. If the app uses a router, hook into route-change events. Minimally, store `dispose` on the container or a module-level variable and call it before re-initializing:

```javascript
// At module level or on container
if (container._pokerDispose) container._pokerDispose();
// ... after creating pokerScene:
container._pokerDispose = dispose;
```

**Impact:** Memory leak — WebGL context, GPU buffers, and animation frames accumulate on repeated view entry.

---

### [MEDIUM] M-2: Orphaned resize listener in playbackView

**File:** `frontend/src/views/playbackView.js`
**Line(s):** 101–104
**Category:** correctness

**Problem:**
playbackView registers its own `window.addEventListener('resize', ...)` at line 101 to reposition seat labels and equity overlays. This listener is never removed. `pokerScene.dispose()` only removes the resize listener it registered internally. If `renderPlaybackView` is called multiple times, stale listeners accumulate, each referencing old DOM elements and Three.js objects.

**Code:**
```javascript
window.addEventListener('resize', () => {
  updateSeatLabelPositions(labels, seatPositions, camera, renderer);
  equityOverlay.updatePositions(seatPositions, camera, renderer);
});
```

**Suggested Fix:**
Store the handler reference and remove it during teardown:

```javascript
const onResize = () => { /* ... */ };
window.addEventListener('resize', onResize);
// In teardown:
window.removeEventListener('resize', onResize);
```

**Impact:** Listener leak — stale callbacks reference detached DOM and disposed Three.js objects.

---

### [MEDIUM] M-3: Dual community card lifecycle creates dispose gap

**File:** `frontend/src/views/playbackView.js`
**Line(s):** 120, 129, 145–146
**Category:** design

**Problem:**
playbackView calls `createCommunityCards(scene, cardData)` directly (line 146) and manages the result in its own `activeCommunityCards` variable. Meanwhile, `pokerScene.update()` also manages community cards internally with its own `activeCommunityCards`. These are completely independent lifecycles on the same `scene` object. This is an intentional design — playbackView needs fine-grained street-level control that `update()` doesn't provide — but the result is a dispose gap: `pokerScene.dispose()` only cleans up cards it created via `update()`, not those created directly by playbackView.

**Suggested Fix:**
Either: (a) have playbackView clean up its own `activeCommunityCards` before calling `pokerScene.dispose()` in the teardown path, or (b) expose a `clearCommunityCards()` method on pokerScene that both paths use. A comment in playbackView explaining this design choice would also help future developers.

**Impact:** If `pokerScene.dispose()` is called without playbackView cleaning up first, orphaned Three.js meshes remain in the scene.

---

### [LOW] L-1: Table geometry not tracked for disposal

**File:** `frontend/src/scenes/pokerScene.js`
**Line(s):** 56
**Category:** design

**Problem:**
`addPokerTable(scene)` returns the table mesh, but `createPokerScene` doesn't capture the return value. The table's `CylinderGeometry` and `MeshLambertMaterial` are never explicitly disposed in `dispose()`. Three.js `renderer.dispose()` does not clean up scene geometries or materials.

**Code:**
```javascript
addPokerTable(scene);  // return value (tableMesh) not captured
```

**Suggested Fix:**
Capture the return: `const tableMesh = addPokerTable(scene);` and in `dispose()`, call `tableMesh.geometry.dispose(); tableMesh.material.dispose(); scene.remove(tableMesh);`.

**Impact:** Minor GPU memory retained after disposal. Low severity since the scene typically lives for the app's full lifetime.

---

### [LOW] L-2: Dispose test verifies no-throw but not cleanup behavior

**File:** `frontend/src/scenes/pokerScene.test.js`
**Line(s):** 163–167
**Category:** convention

**Problem:**
The test "dispose does not throw" only asserts `not.toThrow()`. It doesn't verify that `cancelAnimationFrame` was called, that `renderer.dispose()` was invoked, or that the resize listener was removed. A dispose that silently does nothing would also pass.

**Suggested Fix:**
Spy on `cancelAnimationFrame` and `window.removeEventListener` before calling `dispose()`, then assert they were called:

```javascript
it('dispose cancels animation and cleans up', () => {
  const canvas = makeCanvas();
  const result = createPokerScene(canvas);
  const removeSpy = vi.spyOn(window, 'removeEventListener');
  const cancelSpy = vi.fn();
  vi.stubGlobal('cancelAnimationFrame', cancelSpy);

  result.dispose();

  expect(cancelSpy).toHaveBeenCalled();
  expect(removeSpy).toHaveBeenCalledWith('resize', expect.any(Function));
});
```

**Impact:** Regressions in cleanup logic would go undetected.

---

### [LOW] L-3: Direct `createCommunityCards` import alongside `pokerScene.update()`

**File:** `frontend/src/views/playbackView.js`
**Line(s):** 4
**Category:** convention

**Problem:**
playbackView imports `createCommunityCards` directly (line 4) even though `pokerScene.update()` wraps the same function internally. The direct import is necessary for the current design (per M-3), but without a comment, it appears as if the extraction is incomplete.

**Suggested Fix:**
Add a brief comment at the import or at the usage site explaining why community cards are managed directly:

```javascript
// Direct import needed: playbackView manages community cards per-street
// rather than using pokerScene.update() (which does a full one-shot update)
import { createCommunityCards } from '../scenes/communityCards.js';
```

**Impact:** Discoverability — future developers may try to "complete" the extraction and break the street-scrubber flow.

---

## Positives

- **Clean API design** — `createPokerScene` returns a well-shaped object with exactly the controllers consumers need. The `communityCards` getter provides read access without exposing mutation.
- **Sensible defaults with override** — The `DEFAULTS` spread pattern is idiomatic and extensible. Canvas dimension fallback logic (`clientWidth || parentElement?.clientWidth || opts.width`) is resilient.
- **Complete extraction** — Zero inline Three.js boilerplate remains in playbackView. All renderer, camera, lighting, and table setup lives in pokerScene.
- **Good test coverage** — 7 tests covering API shape, default/custom seat count, controller exposure, dispose safety, community card creation via `update()`, and dimension fallback edge case.
- **Full suite green** — All 41 frontend tests pass. No regressions.

---

## Overall Assessment

The extraction is **well executed** and all four acceptance criteria are **SATISFIED**. The `createPokerScene` API is clean, tested, and ready for consumption by downstream tasks (T-018 DealerPreview, T-020 Mobile Playback).

The three MEDIUM findings all relate to **resource lifecycle gaps in playbackView** — the `dispose` function is never called, an extra resize listener leaks, and community cards created outside `update()` won't be cleaned up by `pokerScene.dispose()`. These are pre-existing patterns that the extraction surfaced rather than introduced, and they don't affect correctness during normal use (the view is typically rendered once and stays mounted). However, they should be addressed before T-020 (Mobile Playback) since mobile route switching will trigger repeated mount/unmount cycles.

**Recommendation:** Create a follow-up issue to add a proper teardown path in playbackView (addressing M-1, M-2, M-3) before or alongside T-020.

**Commit status:** No CRITICAL findings — clean to commit.
