# Code Review Report — aia-core

**Date:** 2026-04-06
**Target:** `frontend/src/scenes/cards.js`
**Reviewer:** Scott (automated)
**Task:** Create card mesh factory with canvas-rendered faces
**Beads ID:** aia-core-30y
**Cycle:** 11
**Commit:** 60f02b2

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 1 |
| LOW | 2 |
| **Total Findings** | **3** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | BoxGeometry(0.7, 1.0, 0.02) | SATISFIED | `cards.js:49` — `new THREE.BoxGeometry(0.7, 1.0, 0.02)` | Exact dimensions match |
| 2 | Front face CanvasTexture 256×384px with rank+suit, red/black, white rounded background | SATISFIED | `cards.js:5–38` — canvas 256×384, `roundRect` white fill, red/black color branch, rank in corners, large suit centered | All sub-criteria present |
| 3 | Back face solid dark-blue MeshBasicMaterial | SATISFIED | `cards.js:41–43` — `color: 0x1a3a6e` (#1a3a6e is dark blue) | Color verified |
| 4 | faceUp=false renders back on front slot | SATISFIED | `cards.js:56` — `faceUp ? faceMat : backMat` at materials index 4 | Back shown at +z face when face-down |
| 5 | card.flip() swaps to face-up with 0.3s Y tween | SATISFIED | `cards.js:64–84` — RAF loop over 300 ms, material swap at t=0.5 | isFlipping guard present |

---

## Face Index Verification (+z correctness)

BoxGeometry material index order in Three.js is: `[+x, -x, +y, -y, +z, -z]` (indices 0–5).

The default Three.js camera looks from positive Z toward the origin. A `Mesh` created with no rotation placed in the XY plane will have its **+z face directed toward the camera**. Index 4 (+z) is therefore the correct face slot for the card's visible front. ✅

The code comment at `cards.js:52` confirms intent: `// BoxGeometry face order: +x, -x, +y, -y, +z (front), -z (back of box)`.

---

## Findings

### [MEDIUM] No dispose() — CanvasTexture and geometry leak GPU memory

**File:** `frontend/src/scenes/cards.js`
**Line(s):** 5–38, 41–43, 49
**Category:** design

**Problem:**
`renderCardFace` calls `document.createElement('canvas')` and `new THREE.CanvasTexture(canvas)` per card. `createCard` also allocates a `BoxGeometry` and up to two `MeshBasicMaterial` instances. None of these GPU resources are freed when a card mesh is removed from the scene. Three.js does **not** automatically call `.dispose()` on materials, textures, or geometries; they persist in the WebGL context until the page is unloaded. In a dealing session with many hands, each new card allocates fresh GPU texture memory that is never reclaimed.

**Code:**
```js
// cards.js:5–11
function renderCardFace(rank, suit) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 384;
  // ...
  return new THREE.CanvasTexture(canvas);  // WebGL texture allocated here
}

// cards.js:49
const geom = new THREE.BoxGeometry(0.7, 1.0, 0.02);  // GPU buffer allocated here
```

**Suggested Fix:**
Expose a `mesh.dispose()` helper that releases all allocated resources before the mesh is removed from the scene:

```js
mesh.dispose = function () {
  geom.dispose();
  faceTex.dispose();
  faceMat.dispose();
  backMat.dispose();
};
```

Callers should invoke `card.dispose()` before `scene.remove(card)`.

**Impact:** Progressive GPU memory growth in long sessions or multi-hand deals; no immediate crash but degrades renderer performance.

---

### [LOW] Visible snap on final flip frame — rotation.y jumps from π to 0

**File:** `frontend/src/scenes/cards.js`
**Line(s):** 80–83
**Category:** correctness

**Problem:**
At animation end (`t === 1`), the loop sets `mesh.rotation.y = Math.PI` (line 73), then immediately sets `mesh.rotation.y = 0` (line 81). If the scene's render loop fires between these two assignments (possible in browsers that schedule rAF callbacks interleaved with rendering), the card will appear briefly at 180° Y rotation — showing a horizontally-mirrored front face — before snapping to 0°. Under a 60 fps render loop the window is sub-frame and typically not visible, but it is a latent correctness issue.

**Code:**
```js
// cards.js:72–83
function animate(now) {
  const t = Math.min((now - startTime) / duration, 1);
  mesh.rotation.y = t * Math.PI;           // at t=1: sets to π
  // ...
  if (t < 1) {
    requestAnimationFrame(animate);
  } else {
    mesh.rotation.y = 0;                   // snaps from π to 0
    isFlipping = false;
  }
}
```

**Suggested Fix:**
Reverse the rotation direction so the animation ends naturally at 0 (or 2π), avoiding the snap:

```js
// Rotate back through 0 → -π → 0 using a half-sine ease
mesh.rotation.y = Math.sin(t * Math.PI) * Math.PI;
```

Or simply stop the tween at t < 1 when close enough and set directly:

```js
if (t >= 1) {
  mesh.rotation.y = 0;
  isFlipping = false;
  return;               // early-return before the final rAF-frame render
}
mesh.rotation.y = t * Math.PI;
```

**Impact:** Low risk — cosmetically jarring on the final flip frame in pathological render timing; no functional breakage.

---

### [LOW] ctx.roundRect() has no fallback for older browsers

**File:** `frontend/src/scenes/cards.js`
**Line(s):** 13–16
**Category:** convention

**Problem:**
`CanvasRenderingContext2D.roundRect()` was added in Chrome 99, Firefox 112, Safari 15.4. It is not available in any version of IE or older Chromium-based WebViews. If `cards.js` is bundled for environments outside evergreen desktop browsers (e.g., Electron older than v21, mobile WebViews) the canvas render will throw `TypeError: ctx.roundRect is not a function`, producing a blank face texture with no error surfaced to the user.

**Code:**
```js
// cards.js:13–16
ctx.beginPath();
ctx.roundRect(0, 0, 256, 384, 16);
ctx.fill();
```

**Suggested Fix:**
Add a graceful fallback using `ctx.fillRect` or a manual arc-based rounded-rect path:

```js
if (typeof ctx.roundRect === 'function') {
  ctx.beginPath();
  ctx.roundRect(0, 0, 256, 384, 16);
  ctx.fill();
} else {
  ctx.fillRect(0, 0, 256, 384);  // plain rect fallback
}
```

**Impact:** Silently broken card faces in unsupported environments; no crash in the WebGL scene but cards render textureless.

---

## Positives

- **isFlipping guard is correct** — `if (isFlipping || isFaceUp) return;` prevents concurrent flip calls and redundant flips. The guard is set before the first `requestAnimationFrame` and cleared atomically after the last frame, so no race window exists within the rAF callback chain. ✅
- **Closure-based state** — `isFlipping` and `isFaceUp` are captured cleanly in the `createCard` closure; no global state, no prototype mutation.
- **Material array mutation approach is sound** — mutating `mesh.material[4]` in-place during animation is the correct Three.js pattern for per-face material swapping; no `needsUpdate` flag is required for material reference replacement (only for material property changes).
- **`faceUp=false` default guard** — `isFaceUp = faceUp` initialises correctly, so a card created with `faceUp=true` is correctly non-flippable without additional callers needing to track state.
- **Clean module boundary** — only `createCard` is exported; `renderCardFace` and `createBackMaterial` are module-private helpers. Good encapsulation.

---

## Overall Assessment

The implementation satisfies all five acceptance criteria. The geometry dimensions, face index selection, back-face coloring, `faceUp=false` default, and flip animation with guard are all correct. No critical or high-severity issues were found.

The one medium finding (missing `dispose()`) is the most important follow-up: in a multi-hand session this will degrade GPU memory over time. The two low findings are low-probability edge cases (animation snap is sub-frame; `roundRect` only matters outside evergreen desktop browsers).

**Verdict:** Ready to merge with the medium finding tracked as follow-up work.
