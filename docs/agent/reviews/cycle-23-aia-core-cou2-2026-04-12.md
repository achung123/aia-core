# Code Review Report — aia-core

**Date:** 2026-04-12
**Cycle:** 23
**Target:** `frontend/src/scenes/pokerScene.ts`, `frontend/src/scenes/tableGeometry.ts`, `frontend/src/scenes/tableGeometry.test.ts`, import updates in views
**Reviewer:** Scott (automated)

**Task:** T-023 — Convert Three.js scene core to TypeScript
**Beads ID:** aia-core-cou2

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 1 |
| MEDIUM | 2 |
| LOW | 2 |
| **Total Findings** | **5** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | pokerScene.js → pokerScene.ts with typed function signatures | PARTIAL | `frontend/src/scenes/pokerScene.ts` exists with full type annotations | Old `pokerScene.js` was not deleted — see HIGH-1 |
| 2 | tableGeometry.js → tableGeometry.ts with typed function signatures | SATISFIED | `frontend/src/scenes/tableGeometry.ts` — all 5 exported functions have typed parameters and return types. Old `.js` file removed. | Clean conversion |
| 3 | @types/three installed | SATISFIED | `package.json` devDependencies: `"@types/three": "^0.183.1"` | Version aligns with `three@0.183.2` runtime dep |
| 4 | createPokerScene returns typed object | SATISFIED | `PokerSceneResult` interface at line 36 of `pokerScene.ts`; function signature returns `PokerSceneResult` | All properties typed — no `any` |
| 5 | Tests pass (565 across 41 files) | SATISFIED | `vitest run` → 565 passed, 41 test files passed | 2 pre-existing `.jsx` test file failures (not regressions) |
| 6 | New unit tests for converted modules | SATISFIED | `tableGeometry.test.ts` — 12 tests covering all 5 exported functions | Good coverage of geometry, labels, and session loading |

---

## Findings

### [HIGH] H-1: Dead file `pokerScene.js` not removed after conversion

**File:** `frontend/src/scenes/pokerScene.js`
**Line(s):** 1–186 (entire file)
**Category:** convention

**Problem:**
The original `pokerScene.js` still exists alongside the new `pokerScene.ts`. The old file imports from `./tableGeometry.js` which no longer exists, meaning it would throw at import time if anything loaded it. All consumers (`PlaybackView.tsx`, `MobilePlaybackView.tsx`, `DealerPreview.tsx`, `pokerScene.test.js`) have been updated to import from `pokerScene.ts`, so the old file is dead code. `tableGeometry.js` was correctly deleted but `pokerScene.js` was missed.

**Suggested Fix:**
Delete `frontend/src/scenes/pokerScene.js`.

**Impact:** Dead code in the build tree. Vite won't bundle it (no imports), but it adds confusion and could cause issues if someone accidentally imports the wrong file.

---

### [MEDIUM] M-1: `pokerScene.test.js` remains as JavaScript

**File:** `frontend/src/scenes/pokerScene.test.js`
**Line(s):** 1
**Category:** convention

**Problem:**
The test file for `pokerScene` is still `.js` while the new `tableGeometry.test.ts` is TypeScript. The test already imports from `pokerScene.ts` via dynamic import, so it works, but it creates an inconsistency: new tests are `.ts`, old tests are `.js`. This is a missed opportunity to get type-checking in the test file.

**Suggested Fix:**
Convert `pokerScene.test.js` → `pokerScene.test.ts` in a follow-up task. Not blocking.

**Impact:** Low — tests pass, but inconsistent file extensions in the same directory.

---

### [MEDIUM] M-2: Pre-existing stale `.jsx` files cause 2 test file failures

**File:** `frontend/src/views/MobilePlaybackView.test.jsx`, `frontend/src/dealer/DealerPreview.test.jsx`
**Line(s):** N/A
**Category:** convention

**Problem:**
Old `.jsx` source and test files (`MobilePlaybackView.jsx`, `MobilePlaybackView.test.jsx`, `DealerPreview.jsx`, `DealerPreview.test.jsx`) coexist with their `.tsx` replacements. The `.test.jsx` files fail at import time with a `preact` resolution error. These are **pre-existing** issues (not regressions from T-023), but they inflate the test failure count. The task description says imports in these views were updated — that refers to the `.tsx` files, not the dead `.jsx` files.

**Suggested Fix:**
File a follow-up task to delete the stale `.jsx` files: `MobilePlaybackView.jsx`, `MobilePlaybackView.test.jsx`, `DealerPreview.jsx`, `DealerPreview.test.jsx`.

**Impact:** 2 test files show as FAIL in the suite (0 test cases fail, but 2 file-level errors).

---

### [LOW] L-1: Defensive optional chaining on `THREE.TOUCH` enum

**File:** `frontend/src/scenes/pokerScene.ts`
**Line(s):** 90–93
**Category:** correctness

**Problem:**
```typescript
controls.touches = {
  ONE: THREE.TOUCH?.ROTATE ?? 0,
  TWO: THREE.TOUCH?.DOLLY_ROTATE ?? 3,
};
```
`THREE.TOUCH` is a constant enum in three.js — it will always be defined when `three` is imported. The optional chaining is unnecessary. The fallback values (0 and 3) happen to match the enum values, so behavior is correct regardless.

**Suggested Fix:**
Use `THREE.TOUCH.ROTATE` and `THREE.TOUCH.DOLLY_ROTATE` directly. Not urgent.

**Impact:** None — behavior is correct either way.

---

### [LOW] L-2: `HandState.cardData` type duplicated across views

**File:** `frontend/src/scenes/pokerScene.ts`
**Line(s):** 17–33
**Category:** design

**Problem:**
The `HandState` interface defines a `cardData` shape inline. The same card data structure is independently defined as `CardData` in `PlaybackView.tsx`, `MobilePlaybackView.tsx`, and `DealerPreview.tsx`. These types are structurally compatible but not shared. This is a pre-existing pattern that predates T-023.

**Suggested Fix:**
In a future task, extract a shared `CardData` type and import it across all consumers.

**Impact:** Low — no bugs, but increases maintenance surface when the card data shape evolves.

---

## Positives

- **Zero `any` types** — Both converted files use specific types throughout. `ReturnType<typeof createChipStacks>` and `ReturnType<typeof createCommunityCards>` avoid duplicating types for untyped JS dependencies.
- **Well-structured interfaces** — `PokerSceneOptions`, `HandState`, and `PokerSceneResult` are clear, documented, and exported for consumer use.
- **Thorough new tests** — `tableGeometry.test.ts` covers all 5 exported functions with 12 tests including edge cases (behind-camera label hiding, null player names).
- **Clean Three.js mock** — The test file mocks `three` completely, avoiding any dependency on WebGL in the test environment.
- **Proper cleanup** — The `dispose()` function removes all event listeners, cancels animation frames, and disposes Three.js resources — no memory leaks.
- **`@types/three` version aligned** — `@types/three@0.183.1` matches `three@0.183.2` — correct pairing.

---

## Overall Assessment

Solid TypeScript conversion with proper type annotations, no `any` types, and good test coverage for `tableGeometry`. The main actionable finding is **H-1**: the old `pokerScene.js` file was not deleted after conversion. This should be cleaned up promptly. The medium findings (stale `.jsx` files, `.js` test file) are pre-existing or cosmetic and can be addressed in follow-up tasks.

No CRITICAL findings. The conversion is functionally correct and type-safe.
