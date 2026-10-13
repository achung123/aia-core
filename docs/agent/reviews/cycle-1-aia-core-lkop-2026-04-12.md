# Code Review Report — alpha-feedback-008

**Date:** 2026-04-12
**Cycle:** 1
**Target:** `frontend/src/pages/TableView.tsx`, `frontend/src/pages/TableView.test.tsx`
**Reviewer:** Scott (automated)

**Task:** T-032 — Player Table View screen (3D scene, mobile-first)
**Beads ID:** aia-core-lkop

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
| 1 | Table View button/tab accessible from player playing screen | SATISFIED | `frontend/src/player/PlayerApp.tsx` L372 `data-testid="table-view-btn"` | Button navigates via `window.location.hash` |
| 2 | Renders pokerScene.ts in full-viewport canvas with touch-enabled orbit controls | SATISFIED | `TableView.tsx` L316-325 viewport style `100vw×100vh`; `pokerScene.ts` L89-96 OrbitControls with touch config | `touchAction: none` on canvas |
| 3 | Player's own hole cards face-up; all others face-down | SATISFIED | `TableView.tsx` L51-63 `handToPlayerCardData`; test L140-155 asserts Alice's cards present, Bob's null | Correct masking logic |
| 4 | Community cards displayed as available | SATISFIED | `TableView.tsx` L42-43 flop/turn/river parsed; test L158-164 asserts flop length=3 | Passed via `scene.update()` |
| 5 | Back to Hand button returns to action screen | SATISFIED | `TableView.tsx` L95-100 `handleBack`; test L124-130 verifies navigation | Uses react-router `navigate()` |
| 6 | Default camera centers on player's seat position | SATISFIED | `TableView.tsx` L195-207 `centerOnPlayer` called after data loads at L270 | Positions camera behind player seat |
| 7 | React Testing Library test verifies Table View toggle and canvas render | SATISFIED | `TableView.test.tsx` — 9 tests all passing | Canvas render, back button, data fetch, card masking, dispose |

---

## Findings

### [MEDIUM] Potential race between scene init and data fetch

**File:** `frontend/src/pages/TableView.tsx`
**Line(s):** 103-130, 235-280
**Category:** correctness

**Problem:**
The first `useEffect` (scene init, line 103) uses a bounded RAF retry loop that may take up to 30 frames (~500ms) before `sceneRef.current` is assigned. The second `useEffect` (data fetch, line 235) starts an async `fetchHands` call immediately on mount. If the fetch resolves before the scene init completes, the guard `if (sceneRef.current)` at line 263 silently skips the `scene.update()` call, and the 3D scene will render with no card data.

**Code:**
```typescript
// First effect — may take up to 30 RAF to set sceneRef.current
function init(tries = 30): void {
  if (cancelled || !canvas) return;
  if (tries > 0 && canvas.clientWidth === 0 && canvas.clientHeight === 0) {
    requestAnimationFrame(() => init(tries - 1));
    return;
  }
  // ...
  sceneRef.current = scene;
}

// Second effect — fetch starts immediately, checks sceneRef on resolve
if (sceneRef.current) {
  sceneRef.current.update({ ... });
}
```

**Suggested Fix:**
Store the fetched hand data in a state variable and move the `scene.update()` call to a third `useEffect` that depends on both `sceneRef.current` being set and data being available. Alternatively, merge both effects so scene init gates data fetch. This matches how `PlaybackView` separates scene setup from user-triggered data loading.

**Impact:** Under normal conditions (networked fetch > 30 RAF frames), this race is unlikely. Could manifest on fast local responses or cached data.

---

### [LOW] Unused `fetchHandStatus` mock setup in test

**File:** `frontend/src/pages/TableView.test.tsx`
**Line(s):** 89-98
**Category:** convention

**Problem:**
The `beforeEach` block configures a mock return value for `fetchHandStatus`, but `TableView.tsx` never imports or calls `fetchHandStatus`. This is dead setup code that adds noise and could mislead future maintainers.

**Code:**
```typescript
vi.mocked(fetchHandStatus).mockResolvedValue({
  hand_number: 1,
  community_recorded: true,
  players: [ /* ... */ ],
});
```

**Suggested Fix:**
Remove the `fetchHandStatus` import (line 44) and its mock setup from `beforeEach`. The module-level mock factory already provides a no-op stub which is sufficient.

**Impact:** Cosmetic; no functional impact.

---

### [LOW] `any` typing on sceneRef

**File:** `frontend/src/pages/TableView.tsx`
**Line(s):** 87, 113
**Category:** convention

**Problem:**
`sceneRef` is typed as `useRef<any>(null)` and `scene` is cast to `any` at line 113. The `PokerSceneResult` interface exists in `pokerScene.ts` and could be used instead.

**Code:**
```typescript
const sceneRef = useRef<any>(null);  // line 87
const scene: any = createPokerScene(canvas, { ... });  // line 113
```

**Suggested Fix:**
Import `PokerSceneResult` from `../scenes/pokerScene.ts` and type the ref accordingly: `useRef<PokerSceneResult | null>(null)`. This matches what the function returns and enables type checking on `.update()`, `.dispose()`, etc.

**Impact:** Minor; matches existing pattern in `PlaybackView.tsx` which also uses `any`, so not a regression.

---

## Positives

- **Bounded retry pattern is correct.** The `init(tries = 30)` loop is properly bounded with a decrement, checks the `cancelled` flag before each iteration, and disposes the scene immediately if the component unmounts mid-init. No resource leaks.
- **Cleanup is thorough.** The first useEffect's cleanup sets `cancelled`, removes DOM labels, and disposes the scene. The second useEffect's cleanup aborts the fetch controller.
- **Card masking logic is clean and well-tested.** `handToPlayerCardData` correctly shows only the viewing player's cards; the test verifies Alice's cards are present and Bob's are null.
- **Test mocking approach is sound.** Saving/restoring `HTMLElement.prototype.clientWidth/clientHeight` descriptors in `beforeEach`/`afterEach` is the correct pattern for happy-dom's zero-dimension limitation. Properly uses `configurable: true` and restores originals.
- **Mobile-first design.** Full-viewport fixed layout, 48px minimum button height, `touchAction: none` on canvas, and touch-enabled OrbitControls.

---

## Overall Assessment

The implementation is solid and all 7 acceptance criteria are satisfied. The bounded retry fix correctly prevents the infinite RAF loop that was the primary bug. The test mocking approach is appropriate for the happy-dom environment.

The one MEDIUM finding (race between scene init and data fetch) is a latent correctness risk but unlikely to manifest in real usage. It should be addressed in a follow-up task, especially as dependent tasks (T-033 equity, T-035 scrubber) will add more data-dependent scene updates.

No CRITICAL findings. Code is ready for integration.
