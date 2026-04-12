# Code Review Report — alpha-feedback-008

**Date:** 2026-04-12
**Target:** `frontend/src/scenes/{cards,chipStacks,communityCards,holeCards,table}.ts` + tests + `pokerScene.ts` imports
**Reviewer:** Scott (automated)
**Cycle:** 24
**Epic:** alpha-feedback-008

**Task:** T-024 — Convert Three.js visual modules to TypeScript
**Beads ID:** aia-core-zpft

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 3 |
| LOW | 3 |
| **Total Findings** | **6** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | All 5 files converted with explicit Three.js types | SATISFIED | `cards.ts`, `chipStacks.ts`, `communityCards.ts`, `holeCards.ts`, `table.ts` all exist as `.ts` with explicit Three.js types (`THREE.Mesh`, `THREE.Scene`, `THREE.Vector3`, `THREE.Group`, `THREE.WebGLRenderer`, etc.) | All interfaces exported with proper Three.js types |
| 2 | No `any` for Three.js objects | SATISFIED | `grep "any"` across all 6 production `.ts` files returns zero matches | Clean — no `any` escape hatches |
| 3 | Old .js files deleted | SATISFIED | `ls frontend/src/scenes/` shows only `.ts` files; git status confirms `D` (deleted) for all 5 `.js` files + `pokerScene.test.js` | Old files removed from working tree |
| 4 | 605 tests pass | SATISFIED | `npx vitest run` → "Tests 605 passed (605), Test Files 46 passed (46)" | Full green |
| 5 | New unit tests added | SATISFIED | 5 new test files: `cards.test.ts` (7 tests), `chipStacks.test.ts` (11 tests), `communityCards.test.ts` (8 tests), `holeCards.test.ts` (7 tests), `table.test.ts` (5 tests) = 38 new tests; `pokerScene.test.ts` converted to TypeScript with additional touch/controls tests | Comprehensive per-module coverage |

---

## Findings

### [MEDIUM] M-1: `table.ts` dispose does not clean up renderer, scene, or lights

**File:** `frontend/src/scenes/table.ts`
**Line(s):** 55-58
**Category:** design (memory leak)

**Problem:**
`initScene()` creates a `WebGLRenderer`, `Scene`, two lights, and a `PerspectiveCamera` but `dispose()` only cancels the animation frame and removes the resize listener. It does not call `renderer.dispose()` or clean up scene children. This leaks GPU resources if `initScene` is used directly.

**Code:**
```typescript
function dispose(): void {
    cancelAnimationFrame(rafId);
    window.removeEventListener('resize', onResize);
}
```

**Suggested Fix:**
Add `renderer.dispose()` inside `dispose()`. Note: `pokerScene.ts` does call `renderer.dispose()` in its own dispose, so this is only a concern for standalone `initScene` usage.

**Impact:** Minor GPU resource leak if `initScene` is used independently of `createPokerScene`. Low risk since `pokerScene.ts` wraps it and disposes correctly.

---

### [MEDIUM] M-2: `chipStacks.ts` shares a single `CylinderGeometry` but disposes it per stack

**File:** `frontend/src/scenes/chipStacks.ts`
**Line(s):** 41, 82
**Category:** correctness

**Problem:**
`createChipStack` creates one `discGeom` and shares it across 5 disc meshes. The `dispose()` function calls `discGeom.dispose()`. However, in `createChipStacks`, each stack has its own geometry instance (each `createChipStack` call creates a new one), so this is actually safe. No bug — but the pattern could be fragile if geometry were ever hoisted for sharing across stacks.

**Code:**
```typescript
const discGeom = new THREE.CylinderGeometry(DISC_RADIUS, DISC_RADIUS, DISC_THICKNESS, 16);
// ... later in dispose:
discGeom.dispose();
```

**Suggested Fix:** No action required now. Document that geometry is per-stack, not shared across stacks.

**Impact:** None currently — architecture note for future maintainers.

---

### [MEDIUM] M-3: `cards.ts` uses `as unknown as CardMesh` double-cast

**File:** `frontend/src/scenes/cards.ts`
**Line(s):** 50
**Category:** design (type safety)

**Problem:**
The `createCard` function creates a `THREE.Mesh`, assigns `flip` and `cancelFlip` onto it at runtime, then returns it via `as unknown as CardMesh`. The double cast bypasses type checking. A safer pattern would be to use a composition or wrapper object.

**Code:**
```typescript
const cardMesh = mesh as unknown as CardMesh;
cardMesh.flip = function () {};
cardMesh.cancelFlip = function () {};
return cardMesh;
```

**Suggested Fix:** Consider returning a wrapper `{ mesh, flip, cancelFlip }` instead of extending `THREE.Mesh` at runtime. However, since `CardMesh` extends `THREE.Mesh` and the interface is explicitly typed, the risk is contained.

**Impact:** Low — the `CardMesh` interface documents the contract and tests verify it. The cast is localized to one place.

---

### [LOW] L-1: `communityCards.ts` `disposeMesh` casts material without type guard

**File:** `frontend/src/scenes/communityCards.ts`
**Line(s):** 60-71
**Category:** correctness

**Problem:**
`disposeMesh` checks `Array.isArray(mesh.material)` then falls through to casting as `MeshLambertMaterial`. Since `createCard` can return either `MeshLambertMaterial` (face-up) or `MeshBasicMaterial` (face-down), accessing `.map` on `MeshBasicMaterial` won't crash (it's `undefined`) but the cast is imprecise.

**Code:**
```typescript
const mat = mesh.material as THREE.MeshLambertMaterial;
if (mat.map) mat.map.dispose();
mat.dispose();
```

**Suggested Fix:** Use `'map' in mat` check or cast to `THREE.Material` and check before accessing `.map`. Current behavior is safe because `MeshBasicMaterial` won't have `.map`, but the cast could mask future issues.

**Impact:** Cosmetic — works correctly today.

---

### [LOW] L-2: `holeCards.ts` — `winnerGlowTimers` tracks `setTimeout` IDs but no `setTimeout` calls exist

**File:** `frontend/src/scenes/holeCards.ts`
**Line(s):** 60, 155, 169, 179
**Category:** design (dead code)

**Problem:**
`winnerGlowTimers` is a `Set` of timeout IDs that gets cleared in `initHand`, `goToPreFlop`, and `dispose`. However, no code ever calls `setTimeout` or adds IDs to this set. This appears to be scaffolding for planned animation that was never implemented.

**Code:**
```typescript
const winnerGlowTimers = new Set<ReturnType<typeof setTimeout>>();
// ... cleared in 3 places but never populated
```

**Suggested Fix:** Either remove the dead set or add a TODO comment explaining the planned usage.

**Impact:** No functional impact — minor dead code.

---

### [LOW] L-3: Changes not committed

**File:** (workspace-level)
**Line(s):** N/A
**Category:** convention

**Problem:**
`git status` shows all `.ts` files as untracked (`??`) and `.js` deletions as unstaged (`D`). The beads task `aia-core-zpft` was closed, but the work was not committed to git. The last commit is `f57aaa4` (T-023).

**Suggested Fix:** Stage and commit all changes: `git add -A frontend/src/scenes/ && git commit -m "T-024: Convert Three.js visual modules to TypeScript (aia-core-zpft)"`

**Impact:** Work could be lost if the working tree is cleaned. The closed beads task has no matching commit.

---

## Positives

- **Clean TypeScript conversion** — All 5 modules use explicit Three.js types throughout. No `any` types anywhere in production code. Interfaces are well-named and exported for downstream consumers.
- **Thorough dispose patterns** — `chipStacks`, `communityCards`, `holeCards`, and `pokerScene` all implement proper cleanup: cancelling animation frames, disposing geometries/materials/textures, and removing objects from the scene.
- **Animation cancellation** — Both `chipStacks` and `communityCards` track in-flight animation IDs and cancel them on dispose or re-entry, preventing orphaned callbacks.
- **Comprehensive new tests** — 38 new tests across 5 files, plus the full `pokerScene.test.ts` conversion. Tests cover API surface, scene mutations, dispose behavior, edge cases (null data), and rapid state changes.
- **Well-structured interfaces** — `CardMesh`, `ChipStack`, `ChipStacks`, `CommunityCards`, `HoleCards`, `InitSceneResult`, and `PokerSceneResult` provide clear contracts. The `HoleCardHandData`/`CommunityHandData` types properly model the poker domain.
- **No security issues** — No user input is rendered unsanitized, no DOM injection risks, no external network calls in the visual modules.

---

## Overall Assessment

The TypeScript conversion is **well-executed**. All 5 acceptance criteria are satisfied: modules use explicit Three.js types, zero `any` usage, old `.js` files deleted, 605 tests pass, and 38+ new tests added. 

No CRITICAL or HIGH findings. The 3 MEDIUM findings are minor design observations (incomplete standalone dispose in `table.ts`, a localized double-cast in `cards.ts`, and a documentation note about geometry ownership). The 3 LOW findings cover a cosmetic type cast, vestigial dead code, and the uncommitted working tree.

**Recommendation:** Commit the changes and proceed.
