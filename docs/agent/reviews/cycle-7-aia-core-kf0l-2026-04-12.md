# Code Review Report — alpha-patch-009

**Date:** 2026-04-12
**Cycle:** 7
**Target:** UI stabilization — canvas bounds, scrubber perf, camera defaults
**Reviewer:** Scott (automated)

**Task:** T-005 — UI stabilization — canvas bounds, scrubber perf, camera defaults
**Beads ID:** aia-core-kf0l

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 1 |
| MEDIUM | 3 |
| LOW | 3 |
| **Total Findings** | **7** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | Canvas doesn't extend behind HUD in both views | SATISFIED | `PlaybackView.tsx` styles: `canvasArea: { flex: 1, overflow: 'hidden' }`, `main: { flex: 1, flexDirection: 'column' }`; `MobilePlaybackView.tsx` styles: `canvasArea: { flex: 1, overflow: 'hidden' }`, `scrubberMount: { flexShrink: 0 }` | Flex column layout prevents canvas from extending behind scrubbers and equity row |
| 2 | Resizing re-bounds canvas correctly | SATISFIED | `PlaybackView.tsx` L196-206: ResizeObserver on `canvasAreaRef` calls `renderer.setSize()` + `camera.updateProjectionMatrix()`; `MobilePlaybackView.tsx` L230-241: same pattern on canvas parent | Both observers properly disconnect in cleanup |
| 3 | Scrubber updates labels in real-time on drag | SATISFIED | `SessionScrubber.tsx` L96: `onInput` handler fires `onChange` callback during drag | React state update is immediate; label reflects current value |
| 4 | Scene update follows within one animation frame | SATISFIED | `PlaybackView.tsx` `handleHandChange` L296: `requestAnimationFrame(() => scene.update(...))` ; `MobilePlaybackView.tsx` `showHand()` L341: same pattern | Scene update deferred into rAF as designed |
| 5 | Default camera shows full table without manual zoom | PARTIAL | `MobilePlaybackView.tsx` L223: `scene.camera.position.set(0, 18, 6)` overrides to correct position | `PlaybackView.tsx` does NOT override `createPokerScene`'s camera at `(0, 8, 5)` — see HIGH-1 |
| 6 | Seat-snap camera shows reasonable first-person perspective | SATISFIED | `seatCamera.ts` L9-11: `SEAT_CAMERA_HEIGHT = 8`, `SEAT_CAMERA_BEHIND = 1.6` | Wider angle than before; `computeSeatCameraPosition` uses these constants |
| 7 | OrbitControls enforce min/max zoom | SATISFIED | `pokerScene.ts` L93-94: `controls.minDistance = 8`, `controls.maxDistance = 30` | Tested in `pokerScene.test.ts` line 420 |
| 8 | Vitest tests cover all changes | PARTIAL | 12 new tests across 5 files: camera constants, minDistance/maxDistance, input event, CSS layout assertions | Tests verify CSS properties but do not mock ResizeObserver to verify `renderer.setSize()` is called — see LOW-1 |

---

## Findings

### [HIGH] PlaybackView camera default inconsistent with `DEFAULT_OVERHEAD_POSITION`

**File:** `frontend/src/scenes/pokerScene.ts`
**Line(s):** 79
**Category:** correctness

**Problem:**
`createPokerScene` hardcodes the initial camera position to `(0, 8, 5)`, which differs from the `DEFAULT_OVERHEAD_POSITION` constant `(0, 18, 6)` in `seatCamera.ts`. MobilePlaybackView explicitly overrides the camera to `(0, 18, 6)` after scene creation, but PlaybackView does not — it uses the scene default. This means the desktop PlaybackView camera starts at `(0, 8, 5)`, which may be too close to show all 10 seats without manual zoom. AC #5 is only satisfied for the mobile view.

**Code:**
```ts
// pokerScene.ts L79 — hardcoded, doesn't use DEFAULT_OVERHEAD_POSITION
camera.position.set(0, 8, 5);
```

```ts
// MobilePlaybackView.tsx L223 — overrides but with magic numbers
scene.camera.position.set(0, 18, 6);
```

**Suggested Fix:**
Import `DEFAULT_OVERHEAD_POSITION` from `seatCamera.ts` into `pokerScene.ts` and use it for the initial camera position, or have PlaybackView explicitly set the camera position after scene creation (matching MobilePlaybackView's pattern). Either way, avoid repeating the magic numbers.

**Impact:** Desktop users may not see all 10 seats on initial load. Double-tap reset also restores to `(0, 8, 5)` instead of `(0, 18, 6)` in PlaybackView.

---

### [MEDIUM] SessionScrubber double-fires onChange on each drag step

**File:** `frontend/src/components/SessionScrubber.tsx`
**Line(s):** 96-97
**Category:** correctness

**Problem:**
Both `onInput` and `onChange` are attached to the range input. In React, the synthetic `onChange` for `<input>` fires on the native `input` event, not just `change`. This means the `onChange` callback fires **twice** per drag step — once from `onInput` and once from React's `onChange`. The duplicate calls cause redundant state updates and redundant `requestAnimationFrame` scene update scheduling in the parent views.

**Code:**
```tsx
onInput={(e) => onChange(parseInt((e.target as HTMLInputElement).value, 10))}
onChange={(e) => onChange(parseInt(e.target.value, 10))}
```

**Suggested Fix:**
Remove the `onInput` handler. React's `onChange` already fires continuously during drag in all modern browsers. Alternatively, remove `onChange` and keep only `onInput` if you want to be explicit about native behavior.

**Impact:** Redundant state updates and rAF scheduling per drag step. Not a correctness bug but unnecessary overhead.

---

### [MEDIUM] MobilePlaybackView uses hardcoded camera position instead of constants

**File:** `frontend/src/views/MobilePlaybackView.tsx`
**Line(s):** 223-224
**Category:** design

**Problem:**
The camera position is set with magic numbers `(0, 18, 6)` that duplicate the `DEFAULT_OVERHEAD_POSITION` constant from `seatCamera.ts`. If the constants change, this code won't track.

**Code:**
```ts
scene.camera.position.set(0, 18, 6);
scene.camera.lookAt(0, 0, 0);
```

**Suggested Fix:**
Import `DEFAULT_OVERHEAD_POSITION` and `DEFAULT_OVERHEAD_TARGET` from `seatCamera.ts` and use:
```ts
scene.camera.position.copy(DEFAULT_OVERHEAD_POSITION);
scene.camera.lookAt(DEFAULT_OVERHEAD_TARGET.x, DEFAULT_OVERHEAD_TARGET.y, DEFAULT_OVERHEAD_TARGET.z);
```

**Impact:** Maintenance risk — silent divergence if constants are updated.

---

### [MEDIUM] MobilePlaybackView init loop has no retry limit

**File:** `frontend/src/views/MobilePlaybackView.tsx`
**Line(s):** 216-243
**Category:** design

**Problem:**
The `init()` function retries via `requestAnimationFrame(init)` indefinitely when the canvas has zero dimensions. PlaybackView uses a retry limit (`tries = 30`), but MobilePlaybackView has no such limit. If the canvas never gains dimensions (hidden parent, display:none), this creates an infinite rAF loop.

**Code:**
```ts
function init(): void {
  if (cancelled) return;
  if (canvas!.clientWidth > 0 && canvas!.clientHeight > 0) {
    // create scene
  } else {
    requestAnimationFrame(init);
  }
}
```

**Suggested Fix:**
Add a retry counter matching PlaybackView's pattern:
```ts
function init(tries = 30): void {
  if (cancelled) return;
  if (tries > 0 && canvas!.clientWidth === 0 && canvas!.clientHeight === 0) {
    requestAnimationFrame(() => init(tries - 1));
    return;
  }
  // create scene
}
```

**Impact:** Potential infinite loop in edge cases. Mitigated by `cancelled` flag on unmount but loop runs until then.

---

### [LOW] ResizeObserver behavior not tested via mock

**File:** `frontend/src/views/PlaybackView.test.tsx`, `frontend/src/views/MobilePlaybackView.test.tsx`
**Line(s):** N/A
**Category:** correctness (test gap)

**Problem:**
AC #8 specifies "canvas container sizing via mock ResizeObserver" tests. The current tests verify CSS properties (`overflow: hidden`, `flex: 1`) but do not mock `ResizeObserver`, trigger a resize entry, and verify that `renderer.setSize()` is called with correct dimensions. This is a minor gap — the CSS tests confirm layout intent, but not the dynamic resize behavior.

**Suggested Fix:**
Add a test that stubs `ResizeObserver` globally, triggers the callback with a mock entry, and asserts that the mock scene's `renderer.setSize()` was called with the entry dimensions.

**Impact:** Reduced confidence that the resize pipeline works end-to-end in test.

---

### [LOW] Rapid scrubbing queues multiple rAF scene updates without cancellation

**File:** `frontend/src/views/PlaybackView.tsx`
**Line(s):** 293-303
**Category:** design

**Problem:**
Each call to `handleHandChange` schedules a new `requestAnimationFrame(() => scene.update(...))` without cancelling the previous one. Rapid dragging queues N rAF callbacks, all of which execute — only the last is visible. This is wasted work, not a correctness issue.

**Suggested Fix:**
Store the rAF handle in a ref and cancel the previous one before scheduling a new one:
```ts
cancelAnimationFrame(updateRafRef.current);
updateRafRef.current = requestAnimationFrame(() => { scene.update(...); });
```

**Impact:** Minor performance concern during rapid scrubbing; no visual glitch.

---

### [LOW] Redundant window resize handler in pokerScene alongside ResizeObserver in views

**File:** `frontend/src/scenes/pokerScene.ts`
**Line(s):** 136-142
**Category:** design

**Problem:**
`pokerScene.ts` attaches a `window.addEventListener('resize', onResize)` handler that calls `renderer.setSize()`. Both views now also attach a `ResizeObserver` that does the same thing. On a window resize, both fire — the size is set twice.

**Suggested Fix:**
Consider removing the window resize listener from `pokerScene.ts` since the views now handle resizing via `ResizeObserver`, which is more precise (handles container-level changes too). Alternatively, document the intentional redundancy as a fallback.

**Impact:** Benign double-resize on window events. No visual impact.

---

## Positives

- **Clean separation of concerns**: Camera constants are properly exported from `seatCamera.ts` and tested independently. OrbitControls limits are set in the scene factory.
- **Thorough test coverage**: 12 new tests cover the key behavioral changes. The constant-assertion tests in `seatCamera.test.ts` act as regression guards.
- **Proper ResizeObserver cleanup**: Both views disconnect observers in their cleanup functions, preventing memory leaks.
- **rAF deferral pattern is correct**: The pattern of immediate state update + deferred scene update provides responsive UI with minimal coupling.
- **Consistent flex layout**: Both views use the same `flex: 1; overflow: hidden` pattern for the canvas area, ensuring portable behavior.

---

## Overall Assessment

The implementation covers 6 of 8 acceptance criteria fully and 2 partially. The most significant finding is **HIGH-1**: PlaybackView's default camera position doesn't match the updated `DEFAULT_OVERHEAD_POSITION`, meaning the desktop view may not show all 10 seats without manual zoom. The three MEDIUM findings (double onChange, hardcoded magic numbers, unbounded init loop) are actionable improvements. No CRITICAL issues found.

**Recommendation**: Address HIGH-1 by ensuring `createPokerScene` (or PlaybackView) uses the `DEFAULT_OVERHEAD_POSITION` constant for the initial camera. Address MEDIUM-1 by removing the redundant `onInput` handler from SessionScrubber.
