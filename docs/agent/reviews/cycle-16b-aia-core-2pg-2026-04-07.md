# Code Review Report — aia-core

**Date:** 2026-04-07
**Target:** `frontend/src/scenes/cards.js`, `frontend/src/scenes/holeCards.js`
**Reviewer:** Scott (automated)
**Cycle:** 16b (re-review of cycle-16 fixes)

**Task:** Re-verify fixes for aia-core-3kg (CRITICAL), aia-core-buy (HIGH), aia-core-1ow (HIGH); confirm M-02 and M-04; identify new issues introduced
**Beads ID:** aia-core-2pg

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 1 |
| MEDIUM | 3 |
| LOW | 0 |
| **Total Findings** | **4** |

---

## Fix Verification Matrix

| Issue ID | Original Finding | Files Changed | Status | Evidence |
|---|---|---|---|---|
| aia-core-3kg (C-01) | `faceMat` was `MeshBasicMaterial` — emissive silently ignored | `cards.js` | ✅ FIXED | `cards.js:50` — `new THREE.MeshLambertMaterial({ map: faceTex })` |
| aia-core-buy (H-01) | `winnerGlowTimer` not stored — stale glow fires on new hand | `holeCards.js` | ⚠️ PARTIAL | Timer stored at `holeCards.js:35`, cleared in `initHand` and `dispose`; but single-slot design orphans timers in multi-winner scenario (see H-01 below) |
| aia-core-1ow (H-02) | RAF flip untracked — mutations on disposed GPU resources | `cards.js`, `holeCards.js` | ✅ FIXED | `cards.js:64` — `flipCancelled` closure flag; `cards.js:93` — `mesh.cancelFlip` API; `holeCards.js:41` — called first thing in `disposeCards` |
| M-02 | `removeSprite` leaked sprite's `CanvasTexture` | `holeCards.js` | ✅ FIXED | `holeCards.js:53` — `if (data.sprite.material.map) data.sprite.material.map.dispose()` present |
| M-04 | `initHand` crashed on missing `player_hands` property | `holeCards.js` | ✅ FIXED | `holeCards.js:132` — `(handData?.player_hands ?? []).find(...)` |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| AC1 | Pre-Flop: 2 face-down card meshes at each active seat | SATISFIED | `holeCards.js:136–139` — `initHand` iterates `seatData`, calls `placeCards(..., false)` | Unchanged from prior cycle |
| AC2 | Showdown: all cards flip face-up via `card.flip()` | SATISFIED | `holeCards.js:150–157` — `disposeCards`, real cards placed, `card.flip()` called | Unchanged |
| AC3 | Fold players: 50% opacity dim + "FOLD" sprite | PARTIAL | `holeCards.js:163–166` — `dimCards`/`addFoldSprite` still called immediately after `flip()` starts; `faceMat` is not dimmed before the 300 ms animation completes | M-03 carry-over still unresolved |
| AC4 | Winner: golden emissive glow on cards | SATISFIED | `glowWinnerCards` sets `.emissive = new THREE.Color(0xffd700)` and `.emissiveIntensity = 0.4` on `MeshLambertMaterial` — this material honours both properties in the Three.js shader pipeline | Depends on presence of scene lighting (see M-new-01) |
| AC5 | Null hole cards: placeholders remain face-down at Showdown | SATISFIED | `holeCards.js:148` — guard `if (playerHand && playerHand.hole_cards)` unchanged | Correct |

---

## Findings

### [HIGH] `winnerGlowTimer` single-slot incomplete — first winner's timer orphaned in split-pot

**File:** `frontend/src/scenes/holeCards.js`
**Line(s):** 170–173
**Category:** correctness

**Problem:**
The `aia-core-buy` fix correctly captures the timeout ID in `winnerGlowTimer` and clears it in `initHand()` and `dispose()`. However, `winnerGlowTimer` is a single `let` variable. `goToShowdown()` iterates over all entries in `seatData`, and for each player with `result === 'win'` it overwrites `winnerGlowTimer`:

```js
// holeCards.js — goToShowdown, inside for-of loop
if (playerHand && playerHand.result === 'win') {
  const capturedIdx = seatIndex;
  winnerGlowTimer = setTimeout(() => glowWinnerCards(capturedIdx), 350);
  // ← every winner overwrites the previous ID
}
```

In a split-pot scenario (two or more players share the win), the loop creates N timers but only the last ID is stored. The earlier (N−1) timers become uncancellable. When `initHand()` is called within 350 ms (fast hand-advance), `clearTimeout(winnerGlowTimer)` cancels only the final winner's timer; the first winner's timer fires and calls `glowWinnerCards` on the new hand's `seatData`. If the new hand's `goToShowdown()` has already run (or runs shortly after), `material[4]` on those cards is `faceMat` (`MeshLambertMaterial`) and the stale emissive glow lands on the wrong hand's cards.

This is the same root-cause bug as `aia-core-buy` but partially regressed by the single-slot fix choice.

**Suggested Fix:**
Replace the single `let winnerGlowTimer` with a `Set` of IDs, and clear all entries in `initHand()` and `dispose()`:

```js
const winnerGlowTimers = new Set();

// goToShowdown — inside the loop:
if (playerHand && playerHand.result === 'win') {
  const capturedIdx = seatIndex;
  const id = setTimeout(() => {
    winnerGlowTimers.delete(id);
    glowWinnerCards(capturedIdx);
  }, 350);
  winnerGlowTimers.add(id);
}

// initHand and dispose:
for (const id of winnerGlowTimers) clearTimeout(id);
winnerGlowTimers.clear();
```

**Impact:** Stale emissive glow applied to the wrong hand's cards in split-pot + fast-navigation scenarios. Non-crashing but produces visually incorrect state.

---

### [MEDIUM] `MeshLambertMaterial` face requires scene lighting — silent black face if no lights

**File:** `frontend/src/scenes/cards.js`
**Line(s):** 50
**Category:** correctness

**Problem:**
The `aia-core-3kg` fix changes `faceMat` from `MeshBasicMaterial` to `MeshLambertMaterial`. `MeshLambertMaterial` participates in Three.js's lighting pipeline and its rendered output depends on light sources in the scene. If the scene has no `AmbientLight`, `DirectionalLight`, or equivalent, the face texture renders entirely black regardless of the canvas texture content.

The `backMat` (`createBackMaterial`) retains `MeshBasicMaterial` — it renders its flat colour unconditionally. This means the card back is always visible while the card face may appear black in an unlit scene. No scene setup file (`main.js` or a scene builder) is reviewed here, so whether a sufficient ambient light is present cannot be confirmed from these files alone.

**Suggested Fix:**
Either (a) confirm the scene has at least `new THREE.AmbientLight(0xffffff, 1.0)` before deploying, or (b) document the lighting requirement in a comment at the top of `createCard`. If lighting cannot be guaranteed, `MeshStandardMaterial` with `roughness: 1, metalness: 0` is a safer choice because it produces visually predictable output across common lighting rigs. Alternatively, keep the card face as `MeshPhongMaterial` with a well-specified `color` and `emissive` for explicit control.

**Impact:** Card faces render black in any scene without a configured light source; the glow effect that motivated the material change also becomes invisible.

---

### [MEDIUM] CanvasTexture not disposed in `disposeCards` — GPU texture leak (M-01 carry-over)

**File:** `frontend/src/scenes/holeCards.js`
**Line(s):** 43–46
**Category:** correctness

**Problem:**
This finding was raised as M-01 in cycle-16 and remains unaddressed. `disposeCards` calls `material.dispose()` on each slot but does not call `material.map.dispose()`. In Three.js, `Material.dispose()` does not free associated textures. The `CanvasTexture` created by `renderCardFace` (one per card per hand reveal) is leaked to GPU memory on every call to `disposeCards` (triggered per hand in `goToShowdown` and `goToPreFlop`).

```js
// holeCards.js — disposeCards, current state
card.material.forEach(m => m.dispose());   // ← m.map (CanvasTexture) not freed
```

**Suggested Fix:**
```js
card.material.forEach(m => {
  if (m.map) m.map.dispose();
  m.dispose();
});
```

**Impact:** Progressive GPU texture memory leak on every hand transition; accumulates in sessions with many hands or repeated `goToPreFlop` scrubs.

---

### [MEDIUM] Dim-then-flip race unresolved for folded players with hole cards (M-03 carry-over)

**File:** `frontend/src/scenes/holeCards.js`
**Line(s):** 163–166
**Category:** correctness

**Problem:**
This finding was raised as M-03 in cycle-16 and remains unaddressed. For a folded player with non-null `hole_cards`, `goToShowdown()` calls `card.flip()` (300 ms animation) immediately followed by synchronous `dimCards()`. At the moment `dimCards` runs, all 6 material slots hold `backMat`; `faceMat` has not yet been swapped in. When the flip completes at t ≥ 0.5, `material[4]` is set to `faceMat`, which was never dimmed. The revealed face renders at full opacity despite the fold result. AC3 is partially unsatisfied for this sub-case.

```js
// holeCards.js — goToShowdown
for (const card of data.cards) { card.flip(); }   // 300 ms animation starts
...
if (playerHand && playerHand.result === 'fold') {
  dimCards(seatIndex);       // ← runs NOW, only dims backMat
  addFoldSprite(seatIndex);
}
```

**Suggested Fix:**
Delay the dim call to match the flip duration:
```js
if (playerHand.result === 'fold') {
  setTimeout(() => { dimCards(seatIndex); addFoldSprite(seatIndex); }, 350);
}
```

Note: if using this pattern, the `setTimeout` ID should also be tracked and cancelable via the same mechanism recommended for `winnerGlowTimers` above.

**Impact:** Folded players appear at full opacity after card reveal, violating AC3 visual spec.

---

## Positives

- **aia-core-3kg (C-01) fully resolved.** `MeshLambertMaterial` is the correct choice — both `emissive` and `emissiveIntensity` are honoured by the GLSL shader. The golden glow is now functionally wired.
- **aia-core-1ow (H-02) fully and correctly resolved.** `flipCancelled` is a clean closure-scoped boolean; `cancelFlip()` is correctly reset to `false` at the start of each `flip()` call; `disposeCards` calls it before any other teardown. The sequence is correct.
- **M-02 (sprite texture dispose) fully resolved.** The null guard `if (data.sprite.material.map)` before `map.dispose()` is defensive and correct.
- **M-04 (input guard) fully resolved.** Optional chaining with nullish coalescing `(handData?.player_hands ?? [])` is idiomatic and correctly handles `undefined`, `null`, and missing property cases.
- **`winnerGlowTimer` single-winner scenario is correct.** For the normal (most common) poker case of one winner per hand, the fix fully prevents stale glow on new hands.

---

## Overall Assessment

Three of five targeted fixes are complete and correct (aia-core-3kg, aia-core-1ow, M-02, M-04). The aia-core-buy fix is partially correct but introduces a regression for split-pot hands — a realistic poker scenario — where the first winner's timer becomes uncancellable again. This is a **HIGH** finding that must be resolved before the task can be closed.

Two prior MEDIUM findings from cycle-16 (M-01 texture leak, M-03 dim-flip race) remain open and unchanged.

No new CRITICAL findings were introduced by the fixes.

**Recommended actions before closing aia-core-2pg:**
1. Replace `let winnerGlowTimer` with `Set<ReturnType<typeof setTimeout>>` and cancel all entries — resolves the HIGH regression
2. Add `m.map.dispose()` in `disposeCards` before `m.dispose()` — resolves carry-over M-01
3. Delay `dimCards`/`addFoldSprite` by 350 ms in `goToShowdown` — resolves carry-over M-03
4. Confirm or add a scene `AmbientLight` to satisfy `MeshLambertMaterial` rendering — resolves M-new-01

---

FINDINGS SUMMARY: C:0 H:1 M:3 L:0
