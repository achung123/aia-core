# Code Review Report — aia-core

**Date:** 2026-04-12
**Cycle:** 11
**Target:** `frontend/src/dealer/TableView3D.tsx`, `frontend/src/dealer/HandDashboard.tsx` + tests
**Reviewer:** Scott (automated)

**Task:** T-003 — 3D table toggle in dealer HandDashboard
**Beads ID:** aia-core-6vai

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 1 |
| MEDIUM | 3 |
| LOW | 2 |
| **Total Findings** | **6** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | Toggle button in HandDashboard above content | SATISFIED | `HandDashboard.tsx` L120-L127 renders `view-toggle-btn` above conditional content; `HandDashboard.test.tsx` "shows view toggle defaulting to tile view" | Button placed between `GamePlayerManagement` and content area |
| 2 | 3D View renders Three.js scene with cards/seats/results | SATISFIED | `TableView3D.tsx` L74-L82 calls `createPokerScene`; `handToCardData()` maps cards, seats, results; `TableView3D.test.tsx` "calls scene.update with mapped hand state" | Scene update correctly maps all hand data |
| 3 | Tile View (default) restores tile grid | SATISFIED | `HandDashboard.tsx` L51 defaults `viewMode` to `'tile'`; `HandDashboard.test.tsx` "clicking Tile View restores the tile grid" | Verified via toggle round-trip test |
| 4 | No WebGL context leaks on repeated toggling | SATISFIED | `TableView3D.tsx` L96-99 cleanup calls `dispose()` and nulls ref; `TableView3D.test.tsx` "does not leak WebGL contexts on multiple mount/unmount cycles" asserts create/dispose counts match | 3 cycles tested |
| 5 | Canvas resizes on container resize | SATISFIED | `TableView3D.tsx` L85-95 creates `ResizeObserver` on container; cleanup disconnects observer | No test exercises ResizeObserver directly — see finding M-1 |
| 6 | OrbitControls for rotate/zoom | SATISFIED | `pokerScene.ts` L86-98 creates OrbitControls with damping, zoom, rotate, touch gestures | Configured in scene factory, not in TableView3D itself |
| 7 | Hand state passed correctly to scene | SATISFIED | `TableView3D.tsx` `handToCardData` + `buildSeatPlayerMap` + `computeStreetIndex`; tests verify flop length, player names, result mapping | Good coverage of data transformation |
| 8 | Vitest tests cover toggle, lifecycle, prop mapping | SATISFIED | 8 tests in `TableView3D.test.tsx`, 5 new tests in `HandDashboard.test.tsx` | 38 total tests pass |

---

## Findings

### [HIGH] H-1: Dual resize listeners — window + ResizeObserver

**File:** `frontend/src/scenes/pokerScene.ts` + `frontend/src/dealer/TableView3D.tsx`
**Line(s):** pokerScene.ts L140-146, TableView3D.tsx L85-95
**Category:** correctness

**Problem:**
`createPokerScene()` attaches a `window.addEventListener('resize', onResize)` listener internally (pokerScene.ts L146). Additionally, `TableView3D` creates its own `ResizeObserver` that also calls `renderer.setSize()` and `camera.updateProjectionMatrix()`. On a window resize, both handlers fire — the internal handler uses `canvas.clientWidth/Height` while the ResizeObserver uses `entry.contentRect`. This can cause a double-resize on every window resize event, and if the two measurements differ momentarily (e.g., during layout reflow), the canvas may flicker between two sizes.

**Suggested Fix:**
Either (a) remove the `window` resize listener from `createPokerScene` and let the component's ResizeObserver be the sole resize authority, or (b) remove the ResizeObserver from `TableView3D` and rely on the scene's internal handler. Option (a) is preferred since ResizeObserver is more precise for container-based sizing. This would require adding an option to `createPokerScene` to opt out of the window listener (e.g., `{ externalResize: true }`).

**Impact:** Visual flicker during resize; potential performance issue from redundant layout recalculations.

---

### [MEDIUM] M-1: ResizeObserver not directly tested

**File:** `frontend/src/dealer/TableView3D.test.tsx`
**Line(s):** (missing)
**Category:** design

**Problem:**
AC #5 (canvas resizes on container resize) is marked satisfied by code inspection, but no test triggers a simulated `ResizeObserver` callback to verify that `renderer.setSize` and `camera.updateProjectionMatrix` are called. happy-dom does not natively support `ResizeObserver`, so the observer may silently fail in the test environment without coverage.

**Suggested Fix:**
Add a mock `ResizeObserver` in the test setup that stores the callback, then invoke it manually with a fake `contentRect` and assert `renderer.setSize` was called with the new dimensions.

**Impact:** Low risk — the code is straightforward, but the AC is only verified by reading code, not by an automated assertion.

---

### [MEDIUM] M-2: `sceneRef` typed as `any`

**File:** `frontend/src/dealer/TableView3D.tsx`
**Line(s):** L72
**Category:** convention

**Problem:**
`sceneRef` uses `useRef<any>(null)` with an eslint-disable comment. The `PokerSceneResult` type is already exported from `pokerScene.ts` and could be imported.

```tsx
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sceneRef = useRef<any>(null);
```

**Suggested Fix:**
```tsx
import type { PokerSceneResult } from '../scenes/pokerScene.ts';
const sceneRef = useRef<PokerSceneResult | null>(null);
```

This removes the `any` escape hatch and the eslint-disable comment, giving type safety on `sceneRef.current.update()`.

**Impact:** Minor — no runtime effect, but loses type checking on scene API calls.

---

### [MEDIUM] M-3: Missing `hands` reference stability consideration

**File:** `frontend/src/dealer/TableView3D.tsx`
**Line(s):** L100-110
**Category:** design

**Problem:**
The `useEffect` that calls `sceneRef.current.update` depends on `[hands]`. Since `fetchHands` returns a new array reference on every call, this effect re-runs every time the parent re-renders with the same logical data. For the current usage this is fine because `HandDashboard` only fetches once, but if `hands` were polled or received from a WebSocket, the scene would rebuild community cards and hole cards on every message even if hand data hasn't changed.

**Suggested Fix:**
No immediate action needed — document this as a known limitation. If polling is added later, memoize the `hands` prop or add a shallow-comparison check inside the effect (e.g., compare `latestHand.hand_id` to a stored ref).

**Impact:** No current impact; future scalability concern only.

---

### [LOW] L-1: `parseCard` returns raw char if suit not in SUIT_SYMBOL map

**File:** `frontend/src/dealer/TableView3D.tsx`
**Line(s):** L20-23
**Category:** correctness

**Problem:**
If a card string has an unexpected suit character (e.g., `'A♥'` already containing a unicode symbol, or a typo like `'Ax'`), `parseCard` falls through to `suitChar` unchanged. This won't crash but could render an unexpected character in the 3D scene.

**Suggested Fix:**
Acceptable as-is — the backend validates card strings before they reach the frontend. Just noting for completeness.

**Impact:** Cosmetic only in edge cases.

---

### [LOW] L-2: `buildSeatPlayerMap` uses array index as seat number

**File:** `frontend/src/dealer/TableView3D.tsx`
**Line(s):** L55-60
**Category:** design

**Problem:**
`buildSeatPlayerMap` assigns `map[i] = ph.player_name` using the array index. If a player's actual `seat_number` property exists on the backend data (it does in the `PlayerInfo` type), the 3D scene will place players in wrong seats when seats are not contiguous or are assigned out of order.

**Suggested Fix:**
If `PlayerHandResponse` gains a `seat_number` field in the future, use it. For now this is consistent with the current API where `player_hands` does not carry seat information, so index-based mapping is the only option.

**Impact:** Players may appear at wrong seats if seat data becomes available but this mapper isn't updated.

---

## Positives

- **Clean lifecycle management**: The mount/dispose pattern in `TableView3D` is well-structured — `ResizeObserver` disconnect, `dispose()` call, and ref nulling all happen in the cleanup function.
- **Thorough data mapping**: `handToCardData`, `computeStreetIndex`, and `buildSeatPlayerMap` are small, focused functions that correctly transform API data to scene data. The `RESULT_MAP` translation (`won` → `win`) is a nice touch.
- **Good test isolation**: Both test files mock dependencies cleanly. The `TableView3D` tests mock `createPokerScene` to avoid WebGL in happy-dom, and `HandDashboard` tests mock `TableView3D` itself to test toggle behavior in isolation.
- **Test coverage**: 8 tests for `TableView3D` cover mount, unmount, dispose, update, empty hands, last-hand selection, result mapping, and context leak prevention. 5 new tests for `HandDashboard` cover default tile view, 3D toggle, tile restore, and prop passing.
- **Conditional rendering done right**: The ternary in `HandDashboard` ensures only one view is mounted at a time, so the 3D scene is fully disposed when switching back to tile view.

---

## Overall Assessment

The implementation is solid and all 8 acceptance criteria are satisfied. The code follows existing project patterns, test coverage is comprehensive, and the WebGL lifecycle is handled correctly. The only HIGH finding is the dual-resize-listener conflict between `pokerScene.ts` (window listener) and `TableView3D` (ResizeObserver), which could cause visual flicker during resize. This is a pre-existing concern in `pokerScene.ts` rather than a defect introduced by this task, but it should be addressed in a follow-up.

No CRITICAL findings — implementation is clean and safe.
