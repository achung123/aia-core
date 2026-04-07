# Code Review Report — aia-core

**Date:** 2026-04-07
**Target:** `frontend/src/scenes/holeCards.js`
**Reviewer:** Scott (automated)
**Task:** aia-core-6hd — Split-pot timer Set, texture map dispose, fold dim delay
**Beads ID:** aia-core-6hd
**Cycle:** 16c (focused re-review)

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 1 |
| MEDIUM | 1 |
| LOW | 0 |
| **Total Findings** | **2** |

---

## Verification Checklist

| # | Verification Point | Result | Evidence |
|---|---|---|---|
| V1 | `winnerGlowTimer` replaced with `Set` | ✅ SATISFIED | Line 34: `const winnerGlowTimers = new Set();` |
| V2 | All winner timer IDs tracked in Set | ✅ SATISFIED | Lines 172–173: `timerId` captured, added to Set before callback fires |
| V3 | Timer auto-deletes from Set on fire | ✅ SATISFIED | Line 172: `winnerGlowTimers.delete(timerId)` inside callback |
| V4 | Timers fully cleared in `initHand` | ✅ SATISFIED | Lines 123–124: `forEach(clearTimeout)` + `clear()` |
| V5 | Timers fully cleared in `dispose` | ✅ SATISFIED | Lines 190–191: `forEach(clearTimeout)` + `clear()` |
| V6 | `disposeCards` calls `m.map.dispose()` before `m.dispose()` | ✅ SATISFIED | Lines 43–47: map disposed first in both array and scalar branches |
| V7 | `dimCards`/`addFoldSprite` deferred 350ms for fold players | ✅ SATISFIED | Line 166: `setTimeout(() => { dimCards(foldIdx); addFoldSprite(foldIdx); }, 350)` |
| V8 | Fold timer IDs tracked for cancellation | ❌ FAILS | Line 166: timer ID discarded; fold timers never tracked in any Set |
| V9 | `addFoldSprite` has null-data guard | ❌ FAILS | Lines 113–114: `seatData.get(seatIndex)` result used without null check |

---

## Findings

### [HIGH] Fold timer IDs not tracked — `addFoldSprite` crashes when `seatData` is cleared mid-flight

**File:** `frontend/src/scenes/holeCards.js`
**Line(s):** 107–115 (`addFoldSprite`), 166 (`goToShowdown` fold block)
**Category:** correctness

**Problem:**
Winner-glow timers are correctly tracked in `winnerGlowTimers` and cancelled in `initHand` / `dispose`. Fold timers are not tracked anywhere. If `dispose()` or `initHand()` is called within 350 ms of `goToShowdown()` (e.g., the user navigates to the next hand quickly), the fold timer fires while `seatData` has already been cleared by `seatData.clear()`.

Inside the callback, `dimCards(foldIdx)` is safe — it has a `if (!data) return` guard.
`addFoldSprite(foldIdx)` is **not** safe: it calls `scene.add(sprite)` unconditionally, then retrieves `data = seatData.get(seatIndex)` (returns `undefined` after `seatData.clear()`), then immediately does `data.sprite = sprite` — throwing:

```
TypeError: Cannot set properties of undefined (setting 'sprite')
```

Because `scene.add(sprite)` has already run by that point, a dangling `THREE.Sprite` (plus its `CanvasTexture` + `SpriteMaterial`) is permanently orphaned in the Three.js scene, leaking GPU memory and polluting subsequent renders.

**Code:**
```js
// Line 166 — timer ID not captured or stored
if (playerHand && playerHand.result === 'fold') {
  const foldIdx = seatIndex;
  setTimeout(() => { dimCards(foldIdx); addFoldSprite(foldIdx); }, 350);  // ← ID dropped
}

// Lines 107–115 — addFoldSprite has no null-data guard
function addFoldSprite(seatIndex) {
  const seatPos = seatPositions[seatIndex];
  const sprite = createFoldSprite();
  sprite.position.set(seatPos.x, seatPos.y + 0.6, seatPos.z);
  scene.add(sprite);                       // ← runs before guard
  const data = seatData.get(seatIndex);
  data.sprite = sprite;                    // ← TypeError if data is undefined
}
```

**Suggested Fix:**
1. Track fold timer IDs in `winnerGlowTimers` (or a parallel `foldTimers` Set) and cancel them in `initHand` / `dispose`.
2. Add a null guard in `addFoldSprite` — move `scene.add()` after the guard so no object leaks on race:

```js
// goToShowdown — track fold timerId
if (playerHand && playerHand.result === 'fold') {
  const foldIdx = seatIndex;
  const foldId = setTimeout(() => {
    winnerGlowTimers.delete(foldId);
    dimCards(foldIdx);
    addFoldSprite(foldIdx);
  }, 350);
  winnerGlowTimers.add(foldId);
}

// addFoldSprite — guard before scene.add
function addFoldSprite(seatIndex) {
  const data = seatData.get(seatIndex);
  if (!data) return;
  const seatPos = seatPositions[seatIndex];
  const sprite = createFoldSprite();
  sprite.position.set(seatPos.x, seatPos.y + 0.6, seatPos.z);
  scene.add(sprite);
  data.sprite = sprite;
}
```

**Impact:** Runtime `TypeError` crash + Three.js object/GPU memory leak when navigating between hands faster than 350 ms after `goToShowdown`.

---

### [MEDIUM] `goToPreFlop` does not cancel pending winner-glow timers

**File:** `frontend/src/scenes/holeCards.js`
**Line(s):** 181–188
**Category:** correctness

**Problem:**
`goToPreFlop` disposes and replaces all cards with fresh face-down placeholders but never calls `winnerGlowTimers.forEach(id => clearTimeout(id))`. If called within 350 ms of `goToShowdown`, a pending winner-glow timer fires on the new placeholder cards. `glowWinnerCards` safely retrieves `data` (seatData is still populated), accesses `card.material[4]`, and attempts to set `.emissive` — but the placeholder's `material[4]` is a `MeshBasicMaterial` (`backMat`), which silently ignores `emissive` assignments. No crash, but no visible effect either. The real risk is visual confusion in any future refactor that switches to `MeshLambertMaterial` for all faces, which would make stale timers suddenly produce an incorrect golden glow on face-down cards.

Also, the (currently untracked) fold timer still fires 350 ms later: `dimCards` dims the fresh placeholders and `addFoldSprite` adds a stale `FOLD` label — incorrect visual state for the new pre-flop view.

**Code:**
```js
// Lines 181–188 — no timer cancellation
goToPreFlop() {
  for (const [seatIndex, data] of seatData) {
    removeSprite(seatIndex);
    disposeCards(seatIndex);
    placeCards(seatIndex, 'A', 'S', 'A', 'S', false);
  }
},
```

**Suggested Fix:**
```js
goToPreFlop() {
  winnerGlowTimers.forEach(id => clearTimeout(id));
  winnerGlowTimers.clear();
  for (const [seatIndex] of seatData) {
    removeSprite(seatIndex);
    disposeCards(seatIndex);
    placeCards(seatIndex, 'A', 'S', 'A', 'S', false);
  }
},
```

**Impact:** Stale timers fire and mutate freshly-placed placeholder cards — incorrect visual state on pre-flop scrub. Becomes a visible glow bug if material types change.

---

## Positives

- `winnerGlowTimers` is correctly a `Set` — the original single-ID pattern is fully replaced.
- Winner timer auto-deletion inside the callback (`winnerGlowTimers.delete(timerId)`) keeps the Set bounded without extra cleanup work.
- `initHand` and `dispose` both use `forEach(clearTimeout)` + `clear()` — the canonical safe teardown pattern.
- `disposeCards` correctly orders `m.map.dispose()` before `m.dispose()` in both the `Array.isArray` branch and the scalar branch — prevents the GPU texture-before-material disposal ordering bug.
- `removeSprite` mirrors the same correct disposal order (map → material → nullify reference).
- `dimCards`/`addFoldSprite` 350 ms deferral is structurally correct and properly captures `seatIndex` via `const foldIdx` before the closure.
- `seatPos.y` in `addFoldSprite` is safe: `computeSeatPositions()` always produces `new THREE.Vector3(x, 0, z)`, so `seatPos.y` is deterministically `0`.

---

## Overall Assessment

Three of the four task requirements are fully and correctly implemented. The remaining gap is a two-part defect in the fold-timer path: fold timer IDs are not registered in any cancellation Set, and `addFoldSprite` assigns into an unchecked `seatData` lookup. Both halves must be fixed together to close the race. The `goToPreFlop` medium finding is a clean one-liner once the tracking Set is unified.

No CRITICAL findings. Do not commit until the HIGH finding is resolved.

---

FINDINGS SUMMARY: C:0 H:1 M:1 L:0
