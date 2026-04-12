# Code Review Report — aia-core

**Date:** 2026-04-07
**Target:** `frontend/src/scenes/communityCards.js`
**Reviewer:** Scott (automated)
**Cycle:** 15

**Task:** Implement community card deal animations
**Beads ID:** aia-core-5b9

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 2 |
| MEDIUM | 1 |
| LOW | 2 |
| **Total Findings** | **5** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | At Flop: 3 cards animate from off-table to 3 center positions over 0.5s | SATISFIED | `communityCards.js` lines 71–73: `slotsForStreet(1)` returns `Set([0,1,2])`; `addCard` places mesh at `OFF_TABLE_Z=5` then calls `animateCard(mesh, target, 500, null)` | — |
| 2 | At Turn: 1 card slides in to right of flop cards | SATISFIED | `communityCards.js` lines 74, 8–13: `slotsForStreet(2)` adds slot 3; `cardPosition(3)` gives `x = -1.7 + 3*0.85 = 0.85`, one spacing-unit right of slot 2 | — |
| 3 | At River: 1 card slides in to right of turn card | SATISFIED | `communityCards.js` lines 75, 8–13: `slotsForStreet(3)` adds slot 4; `cardPosition(4)` gives `x = -1.7 + 4*0.85 = 1.70`, one spacing-unit right of slot 3 | — |
| 4 | Backwards scrubbing removes appropriate cards (reverse-animate off table) | SATISFIED | `communityCards.js` lines 90–101: `removeCard` sets target `z = OFF_TABLE_Z`, animates mesh to staging position, then removes from scene in `onComplete` callback | See HIGH-1: disposed cards in flight are invisible to `dispose()` |
| 5 | Cards are face-up on arrival (faceUp=true, no flip) | SATISFIED | `communityCards.js` line 82: `createCard(data.rank, data.suit, true)`; `mesh.flip()` is never called | — |

---

## Findings

### [HIGH] Orphaned scene meshes after `dispose()` when removal animation is in-flight

**File:** `frontend/src/scenes/communityCards.js`
**Line(s):** 88–101, 117–126
**Category:** correctness

**Problem:**
`removeCard` immediately nulls `cards[slotIndex]` and removes the slot from `visibleSlots` before the animation completes, so that subsequent `goToStreet` calls see consistent state. However, this also makes those in-flight meshes invisible to `dispose()`:

```js
// removeCard — sets null immediately
cards[slotIndex] = null;          // dispose() will skip this index
visibleSlots.delete(slotIndex);

animateCard(mesh, stagingPos, ANIM_DURATION, () => {
  scene.remove(mesh);             // removal only happens after full animation
  disposeMesh(mesh);
});
```

```js
// dispose() — only iterates cards[], misses in-flight meshes
for (let i = 0; i < 5; i++) {
  const mesh = cards[i];
  if (mesh) { ... }               // cards[i] === null → skipped entirely
}
```

If the owning component is torn down (scene change, hand end) while a backwards-scrub animation is mid-flight, the mesh stays attached to the `scene` graph and the RAF callback fires its `onComplete` on a scene that may have been destroyed. This is silent scene contamination — the mesh is never removed or disposed unless the `onComplete` eventually fires.

**Suggested Fix:**
Maintain a `Set` of in-flight removal meshes alongside `cards[]`:

```js
const inflightRemovals = new Set();

function removeCard(slotIndex) {
  const mesh = cards[slotIndex];
  if (!mesh) return;
  cards[slotIndex] = null;
  visibleSlots.delete(slotIndex);
  inflightRemovals.add(mesh);
  const stagingPos = { x: mesh.position.x, y: mesh.position.y, z: OFF_TABLE_Z };
  animateCard(mesh, stagingPos, ANIM_DURATION, () => {
    inflightRemovals.delete(mesh);
    scene.remove(mesh);
    disposeMesh(mesh);
  });
}

function dispose() {
  for (let i = 0; i < 5; i++) {
    const mesh = cards[i];
    if (mesh) { scene.remove(mesh); disposeMesh(mesh); cards[i] = null; }
  }
  for (const mesh of inflightRemovals) {
    scene.remove(mesh);
    disposeMesh(mesh);
  }
  inflightRemovals.clear();
  visibleSlots.clear();
}
```

**Impact:** After calling `dispose()` during a backwards-scrub transition, one or more card meshes remain permanently attached to the Three.js scene. They are invisible (positioned off-table at `z=5`) but their geometry/material GPU resources are never released, and the RAF `onComplete` callback fires against a potentially stale scene reference.

---

### [HIGH] Concurrent RAF loops on the same mesh during rapid `goToStreet` calls

**File:** `frontend/src/scenes/communityCards.js`
**Line(s):** 16–35, 80–101
**Category:** correctness

**Problem:**
`animateCard` starts a new RAF loop identified only by closure — there is no handle returned, no cancellation mechanism, and no guard inside the loop. When a card is mid-`addCard` animation (RAF loop A in progress, moving mesh toward the table) and `goToStreet` is immediately called with a lower street index, `removeCard` is called on that same mesh, spawning RAF loop B (moving mesh away from the table). Both loops now execute concurrently on the same `mesh.position`:

- Frame N: Loop A writes `position.z = lerp(OFF_TABLE_Z, 0, t_A)` (e.g. 3.0)
- Frame N: Loop B writes `position.z = lerp(current_z, OFF_TABLE_Z, t_B)` (e.g. 4.5)
- Each frame the two loops fight over `position`, producing jitter or an incorrect resting position

Loop A has no reference to the mesh in `cards[]` after `removeCard`, so neither loop terminates early. Loop A eventually completes and calls `onComplete = null` (no harm), but Loop B may then fire its `onComplete` calling `scene.remove` and `disposeMesh` while Loop A is still running.

The comment on line 90 — *"Mark as gone immediately so rapid goToStreet calls stay consistent"* — acknowledges state tracking consistency but does not address the animation conflict.

**Suggested Fix:**
Return a cancellation token from `animateCard` and cancel the active animation before starting a new one. A simple approach:

```js
function animateCard(card, targetPos, duration, onComplete) {
  let cancelled = false;
  const startPos = { x: card.position.x, y: card.position.y, z: card.position.z };
  const startTime = performance.now();

  function step(now) {
    if (cancelled) return;
    const t = Math.min((now - startTime) / duration, 1);
    card.position.x = startPos.x + (targetPos.x - startPos.x) * t;
    card.position.y = startPos.y + (targetPos.y - startPos.y) * t;
    card.position.z = startPos.z + (targetPos.z - startPos.z) * t;
    if (t < 1) { requestAnimationFrame(step); }
    else { if (onComplete) onComplete(); }
  }
  requestAnimationFrame(step);
  return () => { cancelled = true; };
}
```

Then store the cancel function per slot and cancel before starting a new animation on the same slot:

```js
const cancelAnimations = [null, null, null, null, null];

function addCard(slotIndex) {
  if (cancelAnimations[slotIndex]) cancelAnimations[slotIndex]();
  ...
  cancelAnimations[slotIndex] = animateCard(mesh, target, ANIM_DURATION, () => {
    cancelAnimations[slotIndex] = null;
  });
}
```

**Impact:** Rapid scrubbing (e.g. a timeline slider dragged quickly) produces jittery card movement and can corrupt final card positions. In the worst case a card settles at an intermediate z-depth, leaving it visible on the table when it should have been removed, or vice versa.

---

### [MEDIUM] `addCard` RAF loop retains disposed mesh in heap for up to 500 ms after `dispose()`

**File:** `frontend/src/scenes/communityCards.js`
**Line(s):** 80–87, 117–126
**Category:** correctness

**Problem:**
When `dispose()` is called while a card is mid-`addCard` animation, `dispose()` correctly removes the mesh from the scene and calls `disposeMesh`, then nulls `cards[i]`. However, the RAF closure in `animateCard` still holds a live _JavaScript_ reference to the same mesh object and continues writing to `mesh.position.x/y/z` each frame for up to 500 ms:

```js
// dispose() sets cards[i] = null and calls disposeMesh, but…
function step(now) {
  // …this closure still runs, writing to the now-disposed mesh
  card.position.x = ...;
  card.position.y = ...;
  card.position.z = ...;
  if (t < 1) { requestAnimationFrame(step); } // keeps scheduling itself
}
```

Three.js does not crash on position writes to a disposed mesh (position is a plain `Vector3`), but the RAF loop chains `requestAnimationFrame` until `t >= 1`, typically 8–15 additional frames. During that window, the JS heap cannot GC the mesh, and the RAF budget is wasted on a mesh not in any scene.

**Suggested Fix:**
Use the cancellation-token pattern described in HIGH-2. The same fix resolves both issues.

**Impact:** Minor heap retention (~500 ms) and wasted RAF frames after scene teardown. Negligible in isolation but compounds if `dispose()` is called frequently (e.g. hand-replay scrubbing).

---

### [LOW] Shared `backMat` instance disposed multiple times per mesh

**File:** `frontend/src/scenes/communityCards.js` (via `cards.js`)
**Line(s):** `communityCards.js` 39–49; `cards.js` 48–58
**Category:** correctness

**Problem:**
`createCard` returns a mesh with 6 material slots, 5 of which are the same `backMat` object reference (slots 0–3 and 5). `disposeMesh` iterates every slot and calls `m.dispose()` on each:

```js
mesh.material.forEach((m) => {
  if (m.map) m.map.dispose();
  m.dispose();           // backMat.dispose() called 5 times
});
```

Three.js `Material.dispose()` is idempotent at the JavaScript level (it fires a `dispose` event and marks internal flags) but the WebGLRenderer's program cache removal can be triggered multiple times unnecessarily. This is harmless in practice but indicates `disposeMesh` does not account for shared material references.

**Suggested Fix:**
Deduplicate before disposing:

```js
const uniqueMaterials = new Set(Array.isArray(mesh.material) ? mesh.material : [mesh.material]);
uniqueMaterials.forEach((m) => {
  if (m.map) m.map.dispose();
  m.dispose();
});
```

**Impact:** Up to 4 redundant `dispose` event dispatches per card cleanup. No crash, no real leak, but wasteful.

---

### [LOW] Linear interpolation produces abrupt animation feel

**File:** `frontend/src/scenes/communityCards.js`
**Line(s):** 28–31
**Category:** design

**Problem:**
`animateCard` uses raw `t` (linear) for all lerps. Cards accelerate and decelerate instantaneously at the edges of the animation — the motion has no ease-in or ease-out:

```js
card.position.x = startPos.x + (targetPos.x - startPos.x) * t;  // t is raw
```

For a dealing animation, smooth deceleration on arrival (ease-out) is considered standard practice and is what users expect from physical cards sliding into place.

**Suggested Fix:**
Apply a simple ease-out cubic in the `animateCard` function:

```js
const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
card.position.x = startPos.x + (targetPos.x - startPos.x) * eased;
```

**Impact:** Pure visual quality — no functional correctness issues. The ACs specify a 0.5 s animation but do not mandate easing, so this is not an AC violation.

---

## Positives

- **Clean state-diffing in `goToStreet`**: The slot-based diff loop (lines 105–116) is minimal and correct — it only adds/removes the delta, never re-creates already-visible cards. This scales well to arbitrary street indices including Showdown.
- **Immediate tracking update in `removeCard`**: Nulling `cards[i]` and `visibleSlots` before the animation starts correctly prevents double-removal on rapid calls — the intent is right even though the `dispose()` interaction needs the `inflightRemovals` fix.
- **`disposeMesh` handles both array and single-material forms**: The conditional in `disposeMesh` (`Array.isArray`) is a good defensive pattern for future reuse.
- **`OFF_TABLE_Z` staging origin**: Using the card's current `x/y` but forcing `z = OFF_TABLE_Z` as the reverse-animation target correctly mirrors the deal direction, giving a natural reverse-deal look.
- **No unnecessary flip call**: AC 5 is satisfied cleanly — `faceUp=true` is passed at construction and `mesh.flip()` is never invoked, keeping the implementation simple.

---

## Overall Assessment

All 5 acceptance criteria are met. The core dealing and scrubbing logic is well-structured. However, there are two HIGH-severity bugs in the animation lifecycle that must be fixed before this code can be considered production-ready:

1. **Scene contamination on dispose** (HIGH-1) — Cards mid-removal-animation are not cleaned up when `dispose()` is called. Fix: maintain an `inflightRemovals` set and drain it in `dispose()`.
2. **Concurrent RAF loops** (HIGH-2) — Rapid street changes spawn multiple competing RAF loops on the same mesh. Fix: return a cancellation token from `animateCard` and cancel the prior animation before starting a new one.

The MEDIUM finding (RAF loop lingers after dispose) is addressed as a side effect of fixing HIGH-2.

Recommend: **Do not close aia-core-5b9 until HIGH-1 and HIGH-2 are resolved.** The LOW findings (shared material disposal, linear easing) can be addressed in a follow-up polish pass.

---

FINDINGS SUMMARY: C:0 H:2 M:1 L:2
