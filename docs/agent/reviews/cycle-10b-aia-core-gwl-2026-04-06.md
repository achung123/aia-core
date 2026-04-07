# Code Review Report — Cycle 10b

**Task:** aia-core-gwl
**Commit:** e169f72
**Reviewer:** Scott
**Date:** 2026-04-06
**Cycle:** 10b (re-review after critical fix)
**Target file:** `frontend/src/views/playbackView.js`

---

## AC Verification

| AC | Criterion | Status | Notes |
|---|---|---|---|
| AC1 | On mount, `fetchSessions()` called; results in left-panel | ✅ PASS | `loadSessionList()` invoked at end of `renderPlaybackView`; populates `#session-list` via DOM API |
| AC2 | Each row shows date, hand count, player count | ✅ PASS | `nameEl.textContent = s.game_date \|\| s.date \|\| 'Unknown date'`; `infoEl.textContent` uses `s.hand_count ?? '?'` and `s.player_count ?? '?'` |
| AC3 | Loading spinner while fetching | ✅ PASS | Initial "Loading..." paragraph in `#session-list`; `#spinner` shown/hidden during `loadSession_()` |
| AC4 | On error, red banner | ✅ PASS | `loadSession_` catch: `errorBanner.textContent` set, `display:block`; session-list fetch errors use DOM-created `<p>` with `textContent` |
| AC5 | `loadSession(playerNames)` called and scene initialized | ✅ PASS | `initScene(canvas)` → `createSeatLabels(canvasArea)` → `window.__onSessionLoaded` closure calls `loadSession(labels, playerNames)` + `updateSeatLabelPositions`; triggered by row click → `loadSession_()` → hands fetch → callback |

---

## XSS Fix Verification

| Location | Before | After | Assessment |
|---|---|---|---|
| Session list error catch | `innerHTML` with `err.message` | `p.textContent = \`Error: ${err.message}\`` | ✅ Fixed |
| Session row (date) | `row.innerHTML` | `nameEl.textContent = s.game_date \| ...` | ✅ Fixed |
| Session row (info) | `row.innerHTML` | `infoEl.textContent = \`... hands · ... players\`` | ✅ Fixed |
| Error banner in `loadSession_` | Was already safe | `errorBanner.textContent = \`Failed...: ${err.message}\`` | ✅ Safe |
| `container.innerHTML = \`...\`` in `renderPlaybackView` | Static literal, no interpolation | Unchanged | ✅ Safe |

All four XSS vectors identified in the initial review are correctly resolved. No `innerHTML` assignments use server-returned or user-controlled data.

---

## Findings

### HIGH

**H1 — Canvas dimensions are zero when `initScene` is called**
**File:** `frontend/src/views/playbackView.js` line 22
`initScene(canvas)` is called synchronously immediately after `container.innerHTML = \`...\``. At this point the browser has not performed layout, so `canvas.clientWidth` and `canvas.clientHeight` are both `0`.

In `table.js` `initScene`:
```js
renderer.setSize(canvasElement.clientWidth, canvasElement.clientHeight); // 0×0
camera.aspect = canvasElement.clientWidth / canvasElement.clientHeight;   // NaN → broken projection matrix
```
The renderer enters a broken state: nothing renders until a `resize` event fires and `onResize()` corrects the dimensions. On a typical page load there is no guaranteed resize event, so the Three.js canvas may remain blank until the user physically resizes the browser window.
**Suggested fix:** Call `renderer.setSize` (and `camera.aspect`) via `requestAnimationFrame` or a `ResizeObserver` on the canvas element after first layout. Alternatively: `const w = canvasArea.clientWidth || 800; const h = canvasArea.clientHeight || 600;` as a safe fallback with a post-layout correction.

---

### MEDIUM

**M1 — `dispose` return value from `initScene` is discarded**
**File:** `frontend/src/views/playbackView.js` line 22
```js
const { renderer, scene, camera } = initScene(canvas);
```
`dispose` is not destructured and is never called. Every call to `renderPlaybackView` (e.g., on SPA navigation) leaks:
- An active `requestAnimationFrame` loop referencing old WebGL context
- A `window.resize` event listener holding a closure over the old renderer

Over repeated mounts this accumulates leaked RAF loops and listeners.
**Suggested fix:** Destructure `dispose` and store it on the container or a module-level variable; call it before replacing the view.

---

**M2 — `window.__onSessionLoaded` is a mutable global**
**File:** `frontend/src/views/playbackView.js` lines 29–32
The callback is stored on `window`, making it callable by any inline script, browser extension, or injected third-party code. While the data path is safe (values reach `label.textContent`, not `innerHTML`), the global can be overwritten by race conditions if `renderPlaybackView` is ever called twice before the first unmounts. The stale closure would update orphaned label DOM nodes.
**Suggested fix:** Use a module-level variable or attach the callback to a non-global event bus / custom DOM event.

---

**M3 — Seat label positions not updated on window resize**
**File:** `frontend/src/views/playbackView.js` lines 27, 30
`updateSeatLabelPositions` is called once at init and once in `__onSessionLoaded`. The resize handler in `table.js` (`onResize`) updates the renderer size and camera projection matrix but does not call `updateSeatLabelPositions`. After the user resizes the browser, the Three.js scene redraws correctly, but the HTML seat labels remain at stale pixel coordinates — they appear to drift from their 3-D seating positions.
**Suggested fix:** Accept a `onAfterResize` hook in `initScene`, or register a `ResizeObserver` on the canvas in `renderPlaybackView` that calls `updateSeatLabelPositions` after each layout change.

---

### LOW

**L1 — `loadSession_` naming convention**
**File:** `frontend/src/views/playbackView.js` line 70
The underscore suffix on `loadSession_` is non-idiomatic JavaScript. It was introduced to avoid collision with the imported `loadSession` from `tableGeometry.js`. A clearer name (`loadHandsForSession`, `onSessionRowClick`) would eliminate ambiguity without a naming hack.

---

**L2 — `loadSessionList` queries DOM globally instead of using scoped reference**
**File:** `frontend/src/views/playbackView.js` line 37
```js
const list = document.getElementById('session-list');
```
`document.getElementById` is a global query. If the component is torn down while `fetchSessions()` is in-flight, the resolved Promise writes to a detached DOM node (silent, no crash). Passing the container or element reference into the function and using `container.querySelector` would be more robust.

---

## Summary Table

| Severity | Count | IDs |
|---|---|---|
| CRITICAL | 0 | — |
| HIGH | 1 | H1 |
| MEDIUM | 3 | M1, M2, M3 |
| LOW | 2 | L1, L2 |

---

## Overall Assessment

The four XSS vectors are correctly fixed. All five ACs pass. The most impactful remaining issue is H1: the initial canvas render is silently broken because layout has not occurred when `initScene` is called. This will manifest as a blank canvas on first load in most environments. M1 (dispose leak) and M3 (label drift on resize) are polish/correctness issues that should be tracked before the feature is considered stable.

**No CRITICAL findings — commit is clean with respect to security and AC compliance.**

---

`FINDINGS SUMMARY: C:0 H:1 M:3 L:2`
