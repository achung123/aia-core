# Code Review Report — aia-core

**Date:** 2026-04-07
**Target:** `frontend/src/scenes/communityCards.js`
**Reviewer:** Scott (automated)
**Cycle:** 15b (re-review of cycle-15 fixes)

**Task:** Fix orphaned scene meshes (HIGH-1) and concurrent RAF loops (HIGH-2)
**Beads IDs:** aia-core-uno, aia-core-bqz
**Re-reviewing commit:** latest on branch (post-fix)

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 1 |
| MEDIUM | 0 |
| LOW | 1 |
| **Total Findings** | **2** |

---

## Fix Verification: HIGH-1 — `inflightRemovals` Set

**Verdict: CORRECT ✓ (with one gap — see HIGH finding below)**

### What was implemented

- `inflightRemovals` declared at line 57 as a `const Set()` alongside `cards[]` and `visibleSlots` ✓
- `removeCard` adds the mesh to `inflightRemovals` before starting the removal animation (line 98) ✓
- The removal animation's `onComplete` callback calls `inflightRemovals.delete(mesh)` before `scene.remove` and `disposeMesh` (lines 100–104) ✓
- `dispose()` cancels all tracked cancel handles (line 118), then iterates `inflightRemovals`, calls `scene.remove` and `disposeMesh` on each, and finally calls `inflightRemovals.clear()` (lines 125–130) ✓

### Correct path: dispose() during in-flight removal

When `removeCard` runs and `dispose()` is called before the animation completes:

1. `dispose()` calls `cancelHandles[k]()` → sets `cancelled = true` in the closure
2. The RAF `step` function fires once more, hits `if (cancelled) return;`, and exits without calling `onComplete`
3. The mesh is still in `inflightRemovals` (not yet deleted by `onComplete`) → `dispose()` finds it and calls `scene.remove(mesh); disposeMesh(mesh)` ✓
4. `inflightRemovals.clear()` cleans up the set ✓

**No orphaned meshes in this path.**

### Correct path: removal animation completes before dispose()

`onComplete` fires normally: `inflightRemovals.delete(mesh); scene.remove(mesh); disposeMesh(mesh)` — mesh is cleaned up and removed from the set before `dispose()` ever sees it. `dispose()` finds the set empty. ✓

### Gap: when `addCard` overwrites a stale removal handle (see HIGH finding below)

When `goToStreet` is called rapidly such that `addCard(i)` follows an in-flight `removeCard(i)` (same slot), `addCard` overwrites `cancelHandles[i]` without cancelling the prior removal handle. The orphaned removal animation remains in flight with `cancelled = false`. If `dispose()` is then called during this window, the mesh is in `inflightRemovals` and is disposed, but the orphaned animation's `onComplete` later fires a second `disposeMesh` call. Attributed to the incomplete HIGH-2 fix below.

---

## Fix Verification: HIGH-2 — `animateCard` cancel function and `cancelHandles` per slot

**Verdict: PARTIAL ⚠ — `removeCard` → `addCard` transition has an uncancelled orphan**

### What was implemented

- `animateCard` returns `() => { cancelled = true; }` (lines 17, 31) ✓
- `cancelHandles = {}` is a plain object keyed by slot index (line 57) ✓
- `removeCard` cancels any existing handle before starting the removal animation (line 97): `if (cancelHandles[slotIndex]) { cancelHandles[slotIndex](); cancelHandles[slotIndex] = null; }` ✓
- `removeCard` stores the new removal-animation handle in `cancelHandles[slotIndex]` (line 99) ✓
- `dispose()` iterates all keys and cancels surviving handles (line 118) ✓

### What is missing

`addCard` (line 85) does **not** cancel any prior animation before writing its new handle:

```js
// addCard — line 85
cancelHandles[slotIndex] = animateCard(mesh, target, ANIM_DURATION, null);
// ← prior removal handle silently overwritten, NOT cancelled
```

`addCard` is only called when `!visibleSlots.has(i)`. `removeCard` immediately calls `visibleSlots.delete(slotIndex)`, so `addCard` can be called on the same slot while that slot's removal animation is still in flight (within the 500 ms `ANIM_DURATION` window). This is the standard rapid-scrubbing scenario:

```
goToStreet(1)  →  addCard(0) — cancelHandles[0] = animAddA
goToStreet(0)  →  removeCard(0) — cancels animAddA ✓, cancelHandles[0] = animRemoveA
goToStreet(1)  →  addCard(0) — cancelHandles[0] = animAddB   ← animRemoveA not cancelled!
```

After step 3:
- `animRemoveA` is running on `meshA` with `cancelled = false`
- `cancelHandles[0]` points to `animAddB`, not `animRemoveA`
- `meshA` is still in `inflightRemovals` (correct — added in step 2, not yet deleted)
- `meshB` (new card) is in `cards[0]` and animating toward the table

**Consequence 1 — No position jitter.** The two animations act on **different** meshes (`meshA` vs `meshB`), so there is no concurrent-write conflict over a single `mesh.position`. The original HIGH-2 jitter is resolved for this scenario.

**Consequence 2 — Double-dispose when `dispose()` is called during the orphan window.**

```
dispose() is called:
  1. cancelHandles[0]() → cancels animAddB (correct)
  2. cards[0] (meshB) → scene.remove; disposeMesh ✓
  3. inflightRemovals contains meshA → scene.remove(meshA); disposeMesh(meshA) ✓
  4. inflightRemovals.clear()

  ... next RAF frame(s) ...
  5. animRemoveA.step fires; cancelled === false; t >= 1 → onComplete()
     → inflightRemovals.delete(meshA)  // no-op, set already cleared
     → scene.remove(meshA)             // no-op, already removed
     → disposeMesh(meshA)              // ← SECOND dispose of geometry + materials
```

`disposeMesh(meshA)` is called twice: once by `dispose()` (step 3) and once by the orphaned `onComplete` (step 5). In modern Three.js, `BufferGeometry.dispose()` and `Material.dispose()` fire the `dispose` event on already-released objects; the renderer's response to a second dispatch is effectively a silent no-op at the WebGL level, but it constitutes incorrect resource-management state and will silently re-trigger any `dispose`-event listeners attached to those objects.

**Consequence 3 — Orphaned RAF loop runs after scene teardown.** The orphaned `animRemoveA` continues to write `mesh.position` on `meshA` for up to ~500 ms after `dispose()` has been called, referencing a mesh that is no longer part of any scene. Wasted RAF budget per orphan.

---

## Findings

### [HIGH] `addCard` does not cancel a stale in-flight removal before starting — orphaned RAF + double-dispose

**File:** `frontend/src/scenes/communityCards.js`
**Line(s):** 79–87 (`addCard`)
**Category:** correctness — incomplete HIGH-2 fix

**Problem:**

`addCard` overwrites `cancelHandles[slotIndex]` without first invoking any prior cancel function:

```js
function addCard(slotIndex) {
  const data = slotCardData(slotIndex);
  if (!data) return;

  const mesh = createCard(data.rank, data.suit, true);
  const target = cardPosition(slotIndex);
  mesh.position.set(target.x, target.y, OFF_TABLE_Z);
  scene.add(mesh);
  cards[slotIndex] = mesh;
  visibleSlots.add(slotIndex);
  cancelHandles[slotIndex] = animateCard(mesh, target, ANIM_DURATION, null); // ← prior handle not cancelled
}
```

`removeCard` (line 97) correctly mirrors this pattern — it cancels before overwriting. `addCard` does not. When `addCard` follows an in-flight `removeCard` on the same slot (rapid `goToStreet` scrubbing), the removal animation's cancel handle is lost. The orphaned loop fires `disposeMesh` on a mesh that `dispose()` has already disposed, and continues running after scene teardown.

**Suggested Fix:**

Add the same guard that `removeCard` already uses:

```js
function addCard(slotIndex) {
  const data = slotCardData(slotIndex);
  if (!data) return;

  if (cancelHandles[slotIndex]) { cancelHandles[slotIndex](); cancelHandles[slotIndex] = null; }  // ← add this

  const mesh = createCard(data.rank, data.suit, true);
  const target = cardPosition(slotIndex);
  mesh.position.set(target.x, target.y, OFF_TABLE_Z);
  scene.add(mesh);
  cards[slotIndex] = mesh;
  visibleSlots.add(slotIndex);
  cancelHandles[slotIndex] = animateCard(mesh, target, ANIM_DURATION, null);
}
```

This cancels the in-flight removal animation before starting a new add animation on the slot, eliminating the orphaned RAF loop and preventing the double-dispose.

**Impact:** Under rapid `goToStreet` scrubbing (add→remove→add on the same slot within 500 ms) while `dispose()` is called during that window: `disposeMesh` is invoked twice on the same mesh, and the orphaned RAF loop runs for up to 500 ms after teardown writing to a mesh no longer in any scene.

---

### [LOW] `cancelHandles` entries not cleared in `dispose()`

**File:** `frontend/src/scenes/communityCards.js`
**Line(s):** 117–131 (`dispose`)
**Category:** cleanup

**Problem:**

`dispose()` cancels all handles via `Object.keys(cancelHandles).forEach(...)` but never deletes the keys or the dictionary itself. After `dispose()` returns, `cancelHandles` still contains stale `null` entries (from `removeCard`'s `cancelHandles[slotIndex] = null` assignments) or stale cancelled-function references. These are harmless since `dispose()` is terminal, but they delay GC of any captured closure state.

**Suggested Fix:**

After the cancel loop, clear the dictionary:

```js
Object.keys(cancelHandles).forEach(k => { if (cancelHandles[k]) cancelHandles[k](); });
Object.keys(cancelHandles).forEach(k => { delete cancelHandles[k]; }); // add this
```

Or combine:

```js
Object.keys(cancelHandles).forEach(k => {
  if (cancelHandles[k]) cancelHandles[k]();
  delete cancelHandles[k];
});
```

**Impact:** Minor — stale closure references held in `cancelHandles` after `dispose()` are not GC-eligible until the `createCommunityCards` closure is itself released. Negligible in practice unless the parent component retains the returned `{ goToStreet, dispose }` object long after disposal.

---

## Previously Reported Issues — Status

| Finding | Cycle-15 Severity | Status |
|---|---|---|
| HIGH-1: Orphaned scene meshes after dispose() when removal in flight | HIGH | **RESOLVED** (except for orphan created by addCard gap — see HIGH above) |
| HIGH-2: Concurrent RAF loops on same mesh during rapid goToStreet | HIGH | **PARTIAL** — removeCard→addCard direction fixed; addCard→removeCard→addCard direction leaves orphaned loop |
| MEDIUM: addCard RAF loop retains disposed mesh for 500ms after dispose() | MEDIUM | **RESOLVED** — cancel mechanism in dispose() stops addCard animation before disposeMesh is called |
| LOW: Shared backMat disposed multiple times per mesh | LOW | **UNCHANGED** — out of scope for this fix; issue is in cards.js |

---

FINDINGS SUMMARY: C:0 H:1 M:0 L:1
