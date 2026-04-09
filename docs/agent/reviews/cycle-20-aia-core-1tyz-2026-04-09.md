# Code Review Report — dealer-viz-004

**Date:** 2026-04-09
**Target:** `frontend/src/dealer/DealerPreview.jsx`, `frontend/src/dealer/DealerPreview.test.jsx`, `frontend/src/dealer/DealerApp.jsx` (integration)
**Reviewer:** Scott (automated)
**Cycle:** 20
**Epic:** dealer-viz-004

**Task:** T-018 — DealerPreview.jsx embedded component
**Beads ID:** aia-core-1tyz

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
| 1 | DealerPreview renders a Three.js canvas inside the dealer interface | SATISFIED | `DealerPreview.jsx` L95-100 renders `<canvas>` when expanded; `DealerApp.jsx` L232 renders `<DealerPreview>` in playerGrid step; test "expands to show canvas when toggle is clicked" confirms | Canvas rendered via `createPokerScene()` from `pokerScene.js` |
| 2 | Community cards and hole cards update in real time | SATISFIED | `DealerPreview.jsx` L35-69 second `useEffect` maps community/player props to `sceneRef.current.update()`; tests "calls update when community cards change" and "calls update when player hole cards change" verify | streetIndex mapping (0=preflop, 1=flop, 2=turn, 3=river) is correct |
| 3 | Toggle button collapses/expands the preview | SATISFIED | `DealerPreview.jsx` L92-98 toggle button with "Show Table"/"Hide Table" text; tests "renders a toggle button that defaults to collapsed" and "collapses back and disposes on second toggle click" verify | Defaults to collapsed — good mobile-first choice |
| 4 | Canvas is responsive to container width | SATISFIED | `DealerPreview.jsx` L72-86 ResizeObserver on parent element; canvas style `width: 100%` with `aspectRatio: 4/3`; test "canvas container has responsive width style" verifies wrapper width | ResizeObserver updates renderer and camera projection |
| 5 | Cleanup on unmount (dispose Three.js resources) | SATISFIED | `DealerPreview.jsx` L11-14 disposes when collapsing; L26-29 cleanup function disposes on unmount; test "calls dispose when unmounted" and "collapses back and disposes on second toggle click" verify | Both collapse and unmount paths tested |

---

## Findings

### [MEDIUM] Variable-length dependency array in useEffect

**File:** `frontend/src/dealer/DealerPreview.jsx`
**Line(s):** 67-69
**Category:** correctness

**Problem:**
The second `useEffect` uses a spread operator to expand player card values into the dependency array:

```jsx
  ], [
    expanded,
    community?.flop1, community?.flop2, community?.flop3, community?.turn, community?.river,
    ...((players || []).flatMap((p) => [p.card1, p.card2])),
  ]);
```

This creates a dependency array whose length changes when the number of players changes (e.g., from 2 players → 4 dependencies to 3 players → 6 dependencies). React and Preact expect dependency arrays to have a **stable length** between renders. When the length changes, the framework compares misaligned positions, potentially skipping updates or triggering unnecessary re-renders.

In practice, this is partially mitigated because the first `useEffect` depends on `players?.length` and recreates the scene when player count changes — so the second effect is likely to re-run anyway. However, the pattern is fragile and violates hooks conventions.

**Suggested Fix:**
Serialize the player cards into a single string dependency:

```jsx
const playerCardKey = (players || []).map((p) => `${p.card1}|${p.card2}`).join(',');
```

Then use `playerCardKey` as a single stable dependency entry instead of the spread.

**Impact:** Low real-world impact currently due to the first effect's `players?.length` dependency acting as a safety net. Could cause subtle bugs if players change their card values without a player-count change.

---

### [LOW] No guard for zero-dimension resize

**File:** `frontend/src/dealer/DealerPreview.jsx`
**Line(s):** 78-83
**Category:** correctness

**Problem:**
The ResizeObserver callback computes `camera.aspect = w / h` without guarding against `h === 0`. If the canvas parent temporarily collapses to zero height (e.g., during DOM layout transitions), this produces `Infinity` or `NaN` for the aspect ratio, which could cause Three.js rendering artifacts.

```jsx
const observer = new ResizeObserver(() => {
  if (!sceneRef.current) return;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  sceneRef.current.renderer.setSize(w, h);
  sceneRef.current.camera.aspect = w / h;
  sceneRef.current.camera.updateProjectionMatrix();
});
```

**Suggested Fix:**
Add a guard: `if (w === 0 || h === 0) return;`

**Impact:** Edge case — only triggers during transient DOM layout states. No user-facing bug in normal operation.

---

### [LOW] No test coverage for update() call data shape

**File:** `frontend/src/dealer/DealerPreview.test.jsx`
**Line(s):** 94-113
**Category:** design

**Problem:**
Tests "calls update when community cards change" and "calls update when player hole cards change" assert that `mockUpdate` was called, but do not inspect the arguments passed to `update()`. The `streetIndex` calculation logic (line 57-62 in DealerPreview.jsx) and the `cardData`/`seatPlayerMap` structure are untested. A regression in the mapping logic (e.g., wrong streetIndex for turn vs river) would not be caught.

**Suggested Fix:**
Add assertions on `mockUpdate.mock.calls[0][0]` to verify the shape:

```jsx
const arg = mockUpdate.mock.calls[0][0];
expect(arg.streetIndex).toBe(1); // flop present
expect(arg.cardData.community).toEqual(['Ah', 'Kd', '5c']);
expect(arg.seatPlayerMap).toEqual({ 0: 'Alice', 1: 'Bob' });
```

**Impact:** A gap in test coverage for the data transformation logic, but not a production bug.

---

## Positives

- **Clean Three.js lifecycle management** — Three separate effects for creation, updates, and resize keep concerns separated and make each independently testable. The dispose pattern is thorough: handles both collapse and unmount, with null-checks to prevent double-dispose.

- **Good default behavior** — Starting collapsed is a smart mobile-first choice. The `seatCount` defaulting to `players.length` (or 10 when null) avoids hardcoding.

- **Comprehensive test suite** — 9 tests provide solid coverage of the component lifecycle: toggle states, scene creation/disposal, card change reactivity, responsive styling, and parameterized seat count. Mock setup is clean and isolated.

- **Minimal integration surface** — DealerApp wires `state.community` and `state.players` directly as props, keeping DealerPreview purely presentational with no internal state management beyond the expanded toggle.

- **ResizeObserver over window resize** — Using ResizeObserver on the parent element instead of a global `window.resize` listener is more responsive to container-level layout changes (e.g., sidebar toggling).

---

## Overall Assessment

**CLEAN** — No critical or high-severity findings. The component is well-structured with proper Three.js resource management, comprehensive test coverage, and correct integration into DealerApp. All 5 acceptance criteria are satisfied.

The one MEDIUM finding (variable-length dependency array) is a hooks convention violation that's mitigated in practice but should be addressed for long-term maintainability. The two LOW findings are minor hardening opportunities.

**Recommendation:** Ship as-is; address the MEDIUM finding in a follow-up cleanup pass.
