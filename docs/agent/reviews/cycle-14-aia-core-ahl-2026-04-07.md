# Code Review Report — aia-frontend-002

**Date:** 2026-04-07
**Target:** `frontend/src/scenes/chipStacks.js`
**Reviewer:** Scott (automated)

**Task:** T-008 — Build chip stack visualization at each seat
**Beads ID:** aia-core-ahl

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 2 |
| MEDIUM | 3 |
| LOW | 2 |
| **Total Findings** | **7** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | Each active seat has a chip stack group of 3–8 disc geometries positioned at the seat location | PARTIAL | `chipStacks.js:22–33` creates 5 discs per stack, positioned correctly | Module is never imported or called from `playbackView.js` or `table.js`; stacks are never rendered end-to-end. DISC_COUNT is hardcoded to 5 — no range. |
| 2 | Stack height scales linearly with P/L relative to the session maximum | SATISFIED | `chipStacks.js:120–124`: `ratio = pl / maxPL`; `height = NEUTRAL_HEIGHT + (MAX_STACK_HEIGHT - NEUTRAL_HEIGHT) * ratio` | Linear formula is correct. Edge case `maxPL = 0` returns `ratio = 0` (neutral height). |
| 3 | Players with negative P/L display a smaller stack in a different color (red tint) | SATISFIED | `chipStacks.js:113–118`: `COLOR_NEGATIVE = 0xc44e4e` used; height scales down from `NEUTRAL_HEIGHT` to `~0.09` at max loss | Color snap is instant (not lerped), which can cause flicker during rapid updates. |
| 4 | `updateChipStacks(map)` lerp-animates each stack to its target height over 400ms | SATISFIED | `chipStacks.js:48–60`: `t = Math.min((now - startTime) / ANIM_DURATION, 1)`; `group.scale.y = startScaleY + (targetScaleY - startScaleY) * t` | Correct linear lerp. Interrupted animations resume from current scale position. `ANIM_DURATION = 400`. |
| 5 | Players with `null` P/L display a neutral half-height stack | SATISFIED | `chipStacks.js:106–108`: `pl === null \|\| pl === undefined` → `setHeight(NEUTRAL_HEIGHT, COLOR_NEUTRAL)`; `NEUTRAL_HEIGHT = 0.3`, `MAX_STACK_HEIGHT = 0.6` → exactly half. | ✓ |

---

## Findings

### [HIGH] Module is never imported or called — chip stacks are never rendered

**File:** `frontend/src/views/playbackView.js`
**Line(s):** 1–3 (imports block)
**Category:** correctness

**Problem:**
`chipStacks.js` exports `createChipStack` and `createChipStacks`, but neither is imported anywhere in `playbackView.js`, `table.js`, or any other module. `seatPositions` computed by `computeSeatPositions()` in `playbackView.js` (line 27) is never passed to `createChipStacks`. The downstream task `aia-core-b62` ("Wire chip stack animations to session scrubber") is blocked by this task and assumes the stacks already exist in the scene — but they don't.

**Code:**
```js
// playbackView.js lines 1-3 — chipStacks.js is absent
import { fetchSessions, fetchHands } from '../api/client.js';
import { initScene } from '../scenes/table.js';
import { addPokerTable, computeSeatPositions, createSeatLabels, loadSession, updateSeatLabelPositions } from '../scenes/tableGeometry.js';
```

**Suggested Fix:**
Add `import { createChipStacks } from '../scenes/chipStacks.js';` and call `createChipStacks(scene, seatPositions)` after `addPokerTable(scene)` in the `requestAnimationFrame` callback in `renderPlaybackView`. Store the returned `{ updateChipStacks, dispose }` handle on `window.__chipStacks` or pass it into the session-loaded callback so `aia-core-b62` can wire to it.

**Impact:** AC 1 cannot be demonstrated in a running application. The downstream scrubber wiring task (`aia-core-b62`) has nothing to connect to.

---

### [HIGH] No test coverage — frontend test suite does not exist

**File:** `frontend/` (entire directory)
**Line(s):** N/A
**Category:** convention

**Problem:**
There are zero test files under `frontend/`. The project's TDD-first convention requires tests for all new behavior. The core logic in `chipStacks.js` — including the lerp animation timing formula, P/L → height scaling, null-neutral mapping, negative-P/L red-tint logic, and the `dispose()` lifecycle — is entirely untested. This renders verification of AC 2, 3, 4, and 5 dependent solely on manual inspection.

**Suggested Fix:**
Add a Vitest (or equivalent) test suite under `frontend/test/`. At minimum cover:
- `createChipStack` initialises with neutral height
- `setHeight` schedules a RAF and converges `group.scale.y` to `targetHeight / NATURAL_HEIGHT` by end of animation
- `updateChipStacks` with positive/negative/null P/L maps sets correct target heights and colors
- `dispose()` cancels any in-flight RAF and removes group from scene

**Impact:** No regression safety. Any future refactor can silently break the P/L scaling or lerp logic.

---

### [MEDIUM] `setHeight` applies color change instantly, not lerped — visible flicker during rapid updates

**File:** `frontend/src/scenes/chipStacks.js`
**Line(s):** 39–41
**Category:** design

**Problem:**
Inside `setHeight`, the material color is updated synchronously before the animation loop starts:
```js
const col = new THREE.Color(color);
materials.forEach((m) => m.color.set(col));
```
The height lerps smoothly over 400ms, but the color snaps immediately. When `updateChipStacks` is called repeatedly (e.g., while the user scrubs through hands), each call re-applies the color instantly, causing noticeable flicker especially when a player crosses the 0 P/L boundary between positive (cream) and negative (red).

**Suggested Fix:**
Either lerp the material color alongside the height (store `startColor`/`targetColor` and call `m.color.lerp(targetColor, t)` inside `animate()`), or accept the instant color change but document it explicitly and ensure calling code avoids overcalling during scrubbing.

**Impact:** Visual quality degradation during scrubber interaction, which is the primary use case for `aia-core-b62`.

---

### [MEDIUM] `DISC_COUNT` is hardcoded to 5 — AC specifies a meaningful range of 3–8

**File:** `frontend/src/scenes/chipStacks.js`
**Line(s):** 3
**Category:** correctness

**Problem:**
```js
const DISC_COUNT = 5;
```
AC 1 specifies "3–8 disc geometries", which implies the count should either vary by context (e.g., proportional to stack size) or at minimum be configurable per call. The implementation always creates exactly 5 discs with no mechanism to honour the range. If the intent of the range is purely to allow future tuning, the constant is fine but the AC is not fully satisfied as written.

**Suggested Fix:**
Either accept a `discCount` parameter in `createChipStack(scene, position, discCount = 5)` and validate it is in `[3, 8]`, or update the AC documentation to clarify that 5 is the fixed value chosen from within the acceptable range. If variability is intended (e.g., bigger winners get more discs), implement the dynamic logic.

**Impact:** AC 1 is partially satisfied; "3–8" is only met coincidentally by the fixed value.

---

### [MEDIUM] Post-`dispose()` calls to `updateChipStacks` silently leak RAF callbacks

**File:** `frontend/src/scenes/chipStacks.js`
**Line(s):** 133–139 (`createChipStacks.dispose`), 38–60 (`setHeight`)
**Category:** correctness

**Problem:**
`createChipStacks.dispose()` calls each stack's `dispose()`, which cancels any in-flight RAF and removes the mesh group from the scene. However, there is no guard preventing subsequent calls to `updateChipStacks` on the same `createChipStacks` instance after disposal. Each such call will invoke `stack.setHeight()` on a disposed stack, scheduling a new `requestAnimationFrame` loop that runs for up to 400ms before ending, modifying `.scale.y` on a removed-from-scene `THREE.Group`.

```js
// createChipStacks.dispose() — no `disposed` flag set
function dispose() {
  stacks.forEach((s) => s.dispose());
  // nothing prevents subsequent updateChipStacks() calls
}
```

**Suggested Fix:**
Add a `let disposed = false;` flag. Set it to `true` in `dispose()` and guard the entry of `updateChipStacks` with `if (disposed) return;`. Apply the same pattern to `createChipStack.setHeight`.

**Impact:** Up to 400ms × (seats count) of wasted rAF callbacks per stale call; multiplies if a component is destroyed and recreated quickly (e.g., during SPA route transitions).

---

### [LOW] Geometry and materials disposed before group is removed from scene

**File:** `frontend/src/scenes/chipStacks.js`
**Line(s):** 63–68
**Category:** convention

**Problem:**
```js
function dispose() {
  if (animId !== null) { cancelAnimationFrame(animId); animId = null; }
  discGeom.dispose();                   // ← GPU resource freed
  materials.forEach((m) => m.dispose()); // ← GPU resource freed
  scene.remove(group);                  // ← removed from scene last
}
```
The idiomatic THREE.js disposal order is: remove from scene first, then dispose GPU resources. While JavaScript's single-threaded event loop prevents a render from firing between these synchronous statements today, the pattern is fragile in `OffscreenCanvas` / `Worker` setups and violates the THREE.js documented cleanup sequence.

**Suggested Fix:**
Reverse the order: call `scene.remove(group)` first, then dispose geometry and materials.

**Impact:** Low — no current runtime issue, but a latent risk if the scene is migrated to a worker thread.

---

### [LOW] `dispose()` is not idempotent — double-call will re-dispose geometry and materials

**File:** `frontend/src/scenes/chipStacks.js`
**Line(s):** 62–69
**Category:** correctness

**Problem:**
Calling `dispose()` twice will invoke `discGeom.dispose()` and `m.dispose()` on already-disposed objects. THREE.js currently silently tolerates this, but it is a latent correctness hazard and makes the function non-idempotent, which callers may reasonably expect.

**Suggested Fix:**
Add a `let disposed = false;` guard (shared with the post-dispose RAF fix above):
```js
function dispose() {
  if (disposed) return;
  disposed = true;
  // ... rest of cleanup
}
```

**Impact:** Low — no current crash, but combines poorly with the post-dispose `updateChipStacks` leak finding above.

---

## Positives

- **Lerp implementation is correct.** `t = Math.min((now - startTime) / duration, 1)` is the standard pattern; interrupted animations pick up from the current interpolated value (not the start), avoiding visual jumps on rapid updates.
- **`cancelAnimationFrame` is called before starting a new one.** No duplicate RAF chains possible within a single stack.
- **Geometry is shared across discs within each stack** — one `CylinderGeometry` for all 5 discs is more memory-efficient than 5 separate geometries and is a correct THREE.js pattern.
- **P/L normalization handles both `Map` and plain object inputs.** The dual-format support in `updateChipStacks` is a thoughtful API design choice.
- **Null/undefined guard is explicit** (`pl === null || pl === undefined`) and correctly routes to the neutral path.
- **Constants are well-named and grouped** at the top of the file, making tuning straightforward.

---

## Overall Assessment

The `chipStacks.js` module is a solid, well-structured implementation of the core P/L-to-height scaling and lerp animation logic. The math is correct, the animation is properly interruptible, and the null/negative/positive branches are cleanly separated. **However, the feature cannot be considered complete**: the module is never imported or wired into the playback view, meaning no chip stacks appear on screen, and no frontend test suite exists to validate the logic automatically.

**Blocking the closure of aia-core-b62:** The downstream wiring task (`aia-core-b62`) expects chip stacks to already exist in the scene. Without the `createChipStacks` call in `playbackView.js`, that task has nothing to connect to.

**Recommended next steps (in priority order):**
1. **[HIGH-1]** Import `createChipStacks` in `playbackView.js`, call it with `scene` and `seatPositions`, and expose the `updateChipStacks` handle for the scrubber wiring task.
2. **[HIGH-2]** Add a Vitest test suite (`frontend/test/chipStacks.test.js`) covering the five ACs.
3. **[MEDIUM-3]** Add a `disposed` guard to both `createChipStack` and `createChipStacks` to prevent post-dispose RAF leaks (fixes both MEDIUM-3 and LOW-2).
4. **[MEDIUM-1]** Lerp the material color alongside the height, or document the instant-snap as intentional.
5. **[MEDIUM-2]** Clarify or implement the DISC_COUNT 3–8 range.
