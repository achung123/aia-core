# Code Review Report — alpha-feedback-008

**Date:** 2026-04-12
**Cycle:** 29
**Target:** `frontend/src/scenes/seatCamera.ts`, `frontend/src/scenes/seatCamera.test.ts`, `frontend/src/pages/TableView.tsx`, `frontend/src/pages/TableView.test.tsx`
**Reviewer:** Scott (automated)

**Task:** T-037 — Seat-snap camera view
**Beads ID:** aia-core-lsyn

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 1 |
| LOW | 0 |
| **Total Findings** | **1** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | Tapping a seat label triggers 300-500 ms camera animation to that seat | SATISFIED | `seatCamera.ts` L79 default 400 ms; `TableView.test.tsx` "animates camera to seat when seat label is clicked" | Duration within range; click handler wired via `handleSeatClick` |
| 2 | Camera positions computed from tableGeometry seat positions | SATISFIED | `seatCamera.ts` L18-29 `computeSeatCameraPosition`; `TableView.tsx` L195 destructures `seatPositions` from scene | Scene exposes seat positions; `computeSeatCameraPosition` derives camera offset |
| 3 | Reset View button returns to default overhead position | SATISFIED | `TableView.tsx` L209-218 `handleResetView`; `TableView.test.tsx` "Reset View animates camera to default overhead position" | Animates to `(0, 14, 3)` via `getDefaultCameraPosition()` |
| 4 | In player mode, camera defaults to player's own seat on load | SATISFIED | `TableView.tsx` L305-307 `centerOnPlayer(playerSeatIndex)`; `TableView.test.tsx` "defaults camera to player own seat on load" | Called after data fetch resolves |
| 5 | Works on mobile (tap) and desktop (click) | SATISFIED | `TableView.tsx` L177 `pointer-events:auto;cursor:pointer`; `TableView.test.tsx` "makes seat labels clickable" | Standard click events; no touch-specific handling needed (browser maps tap → click) |

---

## Findings

### [MEDIUM] In-flight animation not cancelled on component unmount

**File:** `frontend/src/pages/TableView.tsx`
**Line(s):** 120-137 (scene lifecycle `useEffect` cleanup)
**Category:** correctness

**Problem:**
The scene lifecycle `useEffect` cleanup disposes the Three.js scene and clears labels, but does not cancel any in-flight `requestAnimationFrame` animation held in `animCancelRef`. If the user navigates away while a seat-snap animation is playing, the rAF callback continues to fire, accessing camera and controls objects from a disposed scene. This wastes CPU cycles and risks accessing freed resources.

**Code:**
```tsx
return () => {
  cancelled = true;
  labelsRef.current.forEach(el => el.remove());
  labelsRef.current = [];
  if (sceneRef.current) {
    sceneRef.current.dispose();
    sceneRef.current = null;
  }
};
```

**Suggested Fix:**
Add animation cancellation at the start of the cleanup function:

```tsx
return () => {
  cancelled = true;
  if (animCancelRef.current) {
    animCancelRef.current();
    animCancelRef.current = null;
  }
  labelsRef.current.forEach(el => el.remove());
  labelsRef.current = [];
  if (sceneRef.current) {
    sceneRef.current.dispose();
    sceneRef.current = null;
  }
};
```

**Impact:** Without cancellation, a fast navigation (e.g., pressing Back during the initial 400 ms player-seat animation) leaves orphaned rAF callbacks running against disposed objects. Low probability of user-visible error in practice, but could produce console warnings and minor memory/CPU waste.

---

## Positives

- **Clean module separation** — `seatCamera.ts` is a pure utility with zero React or DOM dependencies, making it independently testable.
- **Cancellation handle pattern** — `animateCameraToSeat` returns `{ cancel }`, following the disposable-resource pattern. `handleSeatClick` and `handleResetView` correctly cancel previous animations before starting new ones.
- **Constants are cloned** — `getDefaultCameraPosition` clones module-level `Vector3` constants to prevent external mutation — a subtle but important correctness detail.
- **Easing function correctness** — `easeInOutQuad` is continuous at t=0.5, passes boundary values 0 and 1, and provides visually smooth animation.
- **Thorough test coverage** — 10 unit tests for `seatCamera.ts` (three seat-position cases, default position, animation lifecycle including cancel, completion, snapping, timing) and 6 integration tests in `TableView.test.tsx` covering all five ACs.
- **OrbitControlsLike interface** — Decouples animation logic from the concrete Three.js OrbitControls class, enabling clean mocking in tests.

---

## Overall Assessment

The implementation is well-structured and all five acceptance criteria are satisfied with corresponding test coverage. The single MEDIUM finding — missing animation cancellation on unmount — is a minor cleanup gap that does not affect normal user flows but should be addressed to prevent orphaned rAF callbacks on fast navigation. No critical or high-severity issues found.
