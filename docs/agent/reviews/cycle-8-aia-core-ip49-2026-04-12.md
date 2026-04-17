# Code Review Report — alpha-patch-009

**Date:** 2026-04-12
**Cycle:** 8
**Target:** Bug fix for hardcoded camera default in PlaybackView
**Reviewer:** Scott (automated)

**Task:** T-005 (parent) — UI stabilization: canvas bounds, scrubber perf, camera defaults
**Beads ID:** aia-core-ip49
**Title:** Bug: PlaybackView camera default inconsistent with DEFAULT_OVERHEAD_POSITION

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 2 |
| MEDIUM | 2 |
| LOW | 1 |
| **Total Findings** | **5** |

---

## Acceptance Criteria Verification

The bug task (aia-core-ip49) has one implicit AC derived from its description:

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | pokerScene.ts uses DEFAULT_OVERHEAD_POSITION instead of hardcoded (0, 8, 5) | SATISFIED | `frontend/src/scenes/pokerScene.ts` L7, L74 — imports and uses the constant | Core fix is correct |
| 2 | Test asserts camera default matches the constant | SATISFIED | `frontend/src/scenes/pokerScene.test.ts` L425-L433 — dynamically imports constant and asserts match | Good: test will break if values drift |
| 3 | No other files still reference the old (0, 8, 5) value | SATISFIED | grep confirms zero occurrences of the old value | — |

---

## Findings

### [HIGH] table.ts still hardcodes (0, 18, 6) instead of importing DEFAULT_OVERHEAD_POSITION

**File:** `frontend/src/scenes/table.ts`
**Line(s):** 26
**Category:** correctness

**Problem:**
`table.ts` is a TypeScript file that sets `camera.position.set(0, 18, 6)` using a hardcoded literal. This is the exact same class of bug that aia-core-ip49 fixed in `pokerScene.ts` — if `DEFAULT_OVERHEAD_POSITION` is ever tuned again, `table.ts` will silently drift. Since both files are `.ts`, the constant is directly importable.

**Code:**
```typescript
camera.position.set(0, 18, 6);
```

**Suggested Fix:**
Import `DEFAULT_OVERHEAD_POSITION` from `./seatCamera.ts` and use it, matching the pattern in `pokerScene.ts`.

**Impact:** Future camera tuning will miss this file, recreating the original bug.

---

### [HIGH] TableView.test.tsx mocks DEFAULT_OVERHEAD_POSITION with stale values

**File:** `frontend/src/pages/TableView.test.tsx`
**Line(s):** 34
**Category:** correctness

**Problem:**
The test mock sets `DEFAULT_OVERHEAD_POSITION: { x: 0, y: 14, z: 3 }` but the actual constant is `(0, 18, 6)`. This means the test is asserting against a phantom value that doesn't match production. Any test that relies on this mock will pass even if the real constant changes — defeating the purpose of the assertion.

**Code:**
```typescript
DEFAULT_OVERHEAD_POSITION: { x: 0, y: 14, z: 3 },
```

**Suggested Fix:**
Update the mock to `{ x: 0, y: 18, z: 6 }` to match the actual `seatCamera.ts` constant. Ideally, dynamically import the real value (as `pokerScene.test.ts` does) so the mock stays in sync.

**Impact:** Silently incorrect test assertions; tests will not catch regressions.

---

### [MEDIUM] MobilePlaybackView.tsx hardcodes (0, 18, 6) post-creation

**File:** `frontend/src/views/MobilePlaybackView.tsx`
**Line(s):** 210
**Category:** design

**Problem:**
After creating the scene (which already sets the camera via `DEFAULT_OVERHEAD_POSITION`), this file immediately overwrites it with a hardcoded `position.set(0, 18, 6)`. The override is redundant when values match, but introduces a drift risk if the constant changes.

**Code:**
```typescript
scene.camera.position.set(0, 18, 6);
```

**Suggested Fix:**
Import `DEFAULT_OVERHEAD_POSITION` and use it, or remove the redundant set since `createPokerScene` already positions the camera.

**Impact:** Low immediate risk since values currently match, but adds a maintenance burden.

---

### [MEDIUM] MobilePlaybackView.jsx uses intentionally different (0, 14, 3) without referencing constant

**File:** `frontend/src/views/MobilePlaybackView.jsx`
**Line(s):** 88
**Category:** design

**Problem:**
This file overrides the camera to `(0, 14, 3)` immediately after scene creation. The comment says "Near-top-down camera so cards are always visible above the scrubber", suggesting it's intentional. However, it neither imports nor references `DEFAULT_OVERHEAD_POSITION`, so there's no clear link showing this is a deliberate deviation vs. a stale value from before the constant was created.

**Code:**
```javascript
sceneRef.current.camera.position.set(0, 14, 3);
```

**Suggested Fix:**
Add a comment referencing `DEFAULT_OVERHEAD_POSITION` to document the intentional difference, or define a `MOBILE_OVERHEAD_POSITION` constant in `seatCamera.ts` for this use case.

**Impact:** Readability and maintainability — next developer may "fix" this to match the constant, breaking the mobile layout.

---

### [LOW] pokerScene.js hardcodes (0, 18, 6) — JS legacy file

**File:** `frontend/src/scenes/pokerScene.js`
**Line(s):** 41
**Category:** convention

**Problem:**
The `.js` version of pokerScene hardcodes `(0, 18, 6)`. As a JS file it can't directly import from `.ts`, but this is the same drift risk. If this file is still actively used, the value could diverge from the constant.

**Code:**
```javascript
camera.position.set(0, 18, 6);
```

**Suggested Fix:**
If this JS file is still in use, consider either migrating it to TS or extracting the constant to a shared JS-compatible module. If it's deprecated, consider removing it.

**Impact:** Minor — only matters if the JS file is still used in production.

---

## Positives

- **Core fix is correct and well-tested.** `pokerScene.ts` now imports `DEFAULT_OVERHEAD_POSITION` from `seatCamera.ts` and the new test dynamically imports the constant to assert the camera matches — this will catch future drift.
- **OrbitControls min/max distance** is properly set (8/30), preventing extreme zoom.
- **table.test.ts** correctly asserts `y=18, z=6` matching the updated value.
- **Test count is healthy** — 899 tests passing, no regressions.

---

## Overall Assessment

The primary fix (aia-core-ip49) is **correct and well-tested** — `pokerScene.ts` now imports the shared constant instead of hardcoding. However, the fix was not applied consistently: `table.ts` (HIGH) still hardcodes the same value and could easily import the constant. `TableView.test.tsx` (HIGH) has a stale mock that masks regressions. Two view files hardcode camera positions without referencing the constant (MEDIUM). These are the same class of bug that motivated this task and should be addressed to prevent recurrence.

**Recommendation:** File a follow-up task for the 2 HIGH findings — they are low-effort fixes that complete the intent of this bug fix.
