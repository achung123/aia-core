# Code Review Report — aia-core

**Date:** 2026-04-07
**Target:** `frontend/src/scenes/holeCards.js`
**Reviewer:** Scott (automated)

**Task:** Implement hole card display and showdown reveal
**Beads ID:** aia-core-2pg

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 1 |
| HIGH | 2 |
| MEDIUM | 4 |
| LOW | 2 |
| **Total Findings** | **9** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| AC1 | Pre-Flop: 2 face-down card meshes at each active seat | SATISFIED | `holeCards.js:132–135` — `initHand` iterates `seatData` and calls `placeCards(..., false)` for each seat | Cards correctly placed face-down |
| AC2 | Showdown: all cards flip face-up via `card.flip()` | SATISFIED | `holeCards.js:150–157` — `goToShowdown` disposes placeholders, places real cards, calls `card.flip()` per card | Flip animation wired correctly |
| AC3 | Fold players: 50% opacity dim + "FOLD" sprite | PARTIAL | `holeCards.js:163–167` — `dimCards` / `addFoldSprite` called for fold results; but `dimCards` sets opacity only on `backMat`; after the flip animation swaps `material[4]` to `faceMat`, the revealed face retains full opacity | Folded players with non-null `hole_cards` will have undimmed face after flip (see M-03) |
| AC4 | Winner: golden emissive glow on cards | NOT SATISFIED | `holeCards.js:95–99` — `glowWinnerCards` sets `.emissive` and `.emissiveIntensity` on a `MeshBasicMaterial`; `MeshBasicMaterial` has no emissive support in the Three.js shader pipeline; the property is silently ignored | No visual glow appears (see C-01) |
| AC5 | Null hole cards: placeholders remain face-down at Showdown | SATISFIED | `holeCards.js:148` — `if (playerHand && playerHand.hole_cards)` guard skips real-card replacement; face-down placeholders remain untouched | Works correctly |

---

## Findings

### [CRITICAL] AC4 silently broken — `MeshBasicMaterial` has no emissive support

**File:** `frontend/src/scenes/holeCards.js`
**Line(s):** 95–99
**Category:** correctness

**Problem:**
`glowWinnerCards` attempts to set `.emissive` and `.emissiveIntensity` on the front-face material, but every card's `faceMat` is created as a `MeshBasicMaterial` (see `cards.js` line 49). `MeshBasicMaterial` does not participate in Three.js's lighting/emissive pipeline — the GLSL shader for this material type simply ignores those properties. The assignment succeeds silently in JavaScript, the golden glow effect is completely invisible to the user, and AC4 is unimplemented.

**Code:**
```js
// holeCards.js lines 89-99
function glowWinnerCards(seatIndex) {
  const data = seatData.get(seatIndex);
  if (!data) return;
  for (const card of data.cards) {
    // Front face is material index 4 (post-flip it holds faceMat)
    const frontMat = card.material[4];
    frontMat.emissive = new THREE.Color(0xffd700);       // ← silently ignored
    frontMat.emissiveIntensity = 0.4;                    // ← silently ignored
  }
}
```

**Suggested Fix:**
Change `faceMat` in `cards.js` from `MeshBasicMaterial` to `MeshStandardMaterial` (or `MeshLambertMaterial`) so that emissive is rendered. Note this also requires a scene with at least an `AmbientLight` for the material to appear correctly. Alternatively, simulate glow by adding a second translucent golden `MeshBasicMaterial` plane behind each card.

**Impact:** AC4 is completely non-functional. Winners receive no visual differentiation at showdown.

---

### [HIGH] Stale `setTimeout` — no cancellation handle stored

**File:** `frontend/src/scenes/holeCards.js`
**Line(s):** 169–171
**Category:** correctness

**Problem:**
The `setTimeout` that schedules `glowWinnerCards` 350 ms after showdown is not stored, so it can never be cancelled. If `initHand()` is called for a new hand within 350 ms of `goToShowdown()`, the timeout fires and applies glow logic to the newly-placed pre-flop placeholder cards of the *new* hand. If `dispose()` is called first and `seatData` is cleared, the early-return guard in `glowWinnerCards` prevents a crash — but initiating a new hand without calling `dispose()` first (a normal workflow) produces incorrect state.

**Code:**
```js
// holeCards.js lines 169-171
if (playerHand && playerHand.result === 'win') {
  const capturedIdx = seatIndex;
  setTimeout(() => glowWinnerCards(capturedIdx), 350);   // ← no ID returned/stored
}
```

**Suggested Fix:**
Store the returned timeout ID in a `Set` or array on the object and cancel all pending IDs at the start of `initHand()` and `dispose()`:
```js
const pendingTimers = new Set();
// in goToShowdown:
const id = setTimeout(() => { glowWinnerCards(capturedIdx); pendingTimers.delete(id); }, 350);
pendingTimers.add(id);
// in initHand / dispose:
for (const id of pendingTimers) clearTimeout(id);
pendingTimers.clear();
```

**Impact:** Stale glow applied to wrong hand's cards in fast hand-advance workflows; impossible to safely call `goToShowdown` → `initHand` back-to-back.

---

### [HIGH] RAF flip animation untracked — cannot be cancelled on disposal

**File:** `frontend/src/scenes/cards.js`
**Line(s):** 62–80 (flip RAF loop); `holeCards.js` 153–156 (call site)
**Category:** correctness

**Problem:**
`card.flip()` in `cards.js` starts a `requestAnimationFrame` loop with no cancellation handle. The loop runs for 300 ms. If `disposeCards()` is called (e.g., by `goToPreFlop()`) while a flip is still in-flight, the RAF callback continues to execute: it still sets `mesh.material[4] = backMat/faceMat` and mutates `mesh.rotation.y` on a mesh that has been removed from the scene and whose materials have been `.dispose()`'d. This is an uncontrolled side-effect run on disposed GPU resources.

**Code:**
```js
// cards.js — flip() with no cancel handle
function animate(now) {
  ...
  if (t < 1) {
    requestAnimationFrame(animate);   // ← runs even after disposeCards()
  }
}
requestAnimationFrame(animate);
```

**Suggested Fix:**
Return an `{ cancel }` handle from `flip()` (flip sets a `cancelled` flag the RAF checks before continuing), and store these handles in `seatData` so `disposeCards` can cancel them before disposal:
```js
let cancelled = false;
mesh.flip = function() {
  ...
  function animate(now) {
    if (cancelled) return;
    ...
  }
  ...
};
mesh.cancelFlip = function() { cancelled = true; };
```

**Impact:** Mutates disposed materials after `goToPreFlop()` during an in-progress showdown reveal; can produce console errors and subtle visual artifacts when hands advance quickly.

---

### [MEDIUM] Texture memory leak in `disposeCards` — CanvasTexture not disposed

**File:** `frontend/src/scenes/holeCards.js`
**Line(s):** 36–46
**Category:** correctness

**Problem:**
`disposeCards` calls `card.geometry.dispose()` and `card.material.forEach(m => m.dispose())` but does not dispose the `CanvasTexture` stored in `faceMat.map`. In Three.js, calling `material.dispose()` does **not** automatically dispose associated textures — the caller must call `texture.dispose()` explicitly. Every call to `disposeCards` (initiated per-hand in `goToShowdown` and `goToPreFlop`) leaks the GPU texture underlying each card's face. This is two textures per seat per hand transition.

**Code:**
```js
// holeCards.js lines 39-45
for (const card of data.cards) {
  scene.remove(card);
  card.geometry.dispose();
  if (Array.isArray(card.material)) {
    card.material.forEach(m => m.dispose());   // ← textures NOT disposed
  } else {
    card.material.dispose();
  }
}
```

**Suggested Fix:**
Before disposing each material, dispose its texture if present:
```js
card.material.forEach(m => {
  if (m.map) m.map.dispose();
  m.dispose();
});
```

**Impact:** Progressive GPU texture memory leak; visible in long sessions or repeated hand navigation via `goToPreFlop`.

---

### [MEDIUM] Texture memory leak in `removeSprite` — SpriteMaterial map not disposed

**File:** `frontend/src/scenes/holeCards.js`
**Line(s):** 49–55
**Category:** correctness

**Problem:**
`removeSprite` calls `data.sprite.material.dispose()` but does not call `data.sprite.material.map.dispose()`. The `CanvasTexture` created in `createFoldSprite` is not freed. Same Three.js material-does-not-own-texture pattern as M-01.

**Code:**
```js
// holeCards.js lines 49-55
function removeSprite(seatIndex) {
  const data = seatData.get(seatIndex);
  if (!data || !data.sprite) return;
  scene.remove(data.sprite);
  data.sprite.material.dispose();   // ← texture at .material.map not disposed
  data.sprite = null;
}
```

**Suggested Fix:**
```js
if (data.sprite.material.map) data.sprite.material.map.dispose();
data.sprite.material.dispose();
```

**Impact:** One canvas texture leaked per folded player per hand navigation. Accumulates in sessions with many folds.

---

### [MEDIUM] Dim-then-flip race — `faceMat` not dimmed for folded players with hole cards

**File:** `frontend/src/scenes/holeCards.js`
**Line(s):** 148–167
**Category:** correctness

**Problem:**
In `goToShowdown()`, for a folded player with non-null `hole_cards`, the code (1) places the real cards face-down, (2) calls `card.flip()` to begin a 300 ms animation, then immediately (3) calls `dimCards`. At the time `dimCards` runs, all 6 material slots hold `backMat` (the card is face-down), so opacity is set on `backMat` only. When the flip animation completes 300 ms later, `material[4]` is swapped to `faceMat` (see `cards.js` line 73). `faceMat` was never dimmed, so the revealed face renders at full opacity despite the player having folded. Only the card edges (slots 0-3, 5) remain dimmed. AC3 is therefore not fully satisfied for folded players whose cards are revealed at showdown.

**Code:**
```js
// holeCards.js lines 148-167
if (playerHand && playerHand.hole_cards) {
  disposeCards(seatIndex);
  ...
  for (const card of data.cards) { card.flip(); }      // ← flip starts, faceMat swap at t≥0.5
}
if (playerHand && playerHand.result === 'fold') {
  dimCards(seatIndex);   // ← runs immediately, only dims backMat, faceMat missed
  addFoldSprite(seatIndex);
}
```

**Suggested Fix:**
Apply dim and sprite after the flip animation completes (350 ms), matching the same delay used for winner glow, or dim `faceMat` explicitly before placing the card:
```js
if (playerHand.result === 'fold') {
  setTimeout(() => { dimCards(seatIndex); addFoldSprite(seatIndex); }, 350);
}
```

**Impact:** Folded players with revealed cards appear at full opacity after the flip, breaking the AC3 visual requirement.

---

### [MEDIUM] Missing input guard on `handData.player_hands`

**File:** `frontend/src/scenes/holeCards.js`
**Line(s):** 121
**Category:** correctness

**Problem:**
`initHand` accesses `handData.player_hands.find(...)` with no guard. If `handData` is missing the `player_hands` property (API error response, partial data load), this throws `TypeError: Cannot read properties of undefined (reading 'find')`, crashing the scene initialization with no recovery. This is a system-boundary function receiving backend data.

**Code:**
```js
// holeCards.js line 121
const playerHand = handData.player_hands.find(ph => ph.player_name === playerName) || null;
```

**Suggested Fix:**
```js
const hands = handData?.player_hands ?? [];
const playerHand = hands.find(ph => ph.player_name === playerName) ?? null;
```

**Impact:** Any partial or error response from the backend causes an unhandled exception during hand setup.

---

### [LOW] `seatPos.y` may be `undefined` in `addFoldSprite`

**File:** `frontend/src/scenes/holeCards.js`
**Line(s):** 104–108
**Category:** correctness

**Problem:**
`addFoldSprite` positions the sprite as `seatPos.y + 0.6`. If `seatPositions` entries are 2D objects (e.g., `{ x, z }` with no `y`), `seatPos.y` is `undefined` and `undefined + 0.6 = NaN`, placing the sprite at a NaN Y coordinate (invisible). `placeCards` hardcodes `CARD_OFFSET_Y` as the Y position, never reading `seatPos.y`, making this inconsistency easy to miss. The contract for `seatPositions` objects should be explicit.

**Suggested Fix:**
Use a fallback: `(seatPos.y ?? 0) + 0.6` and document that `seatPositions` entries must include `.y`.

**Impact:** FOLD sprites invisible if caller passes 2D seat position objects.

---

### [LOW] Redundant dispose calls — `backMat` shared across 5 material slots

**File:** `frontend/src/scenes/holeCards.js`
**Line(s):** 39–46; `frontend/src/scenes/cards.js` line 44–50
**Category:** convention

**Problem:**
`createCard` assigns the same `backMat` instance to 5 of the 6 material slots. `disposeCards` iterates all 6 slots with `card.material.forEach(m => m.dispose())`, calling `.dispose()` on the same `backMat` object up to 5 times. Three.js handles repeated dispose calls gracefully (no crash), but it's noisy and signals that the caller doesn't account for shared material instances.

**Suggested Fix:**
Deduplicate before disposing: `[...new Set(card.material)].forEach(m => m.dispose())` or dispose the set `{ backMat, faceMat }` directly.

**Impact:** No functional harm; minor code quality concern.

---

## Positives

- **Clean data model**: `seatData` Map keyed by index, with `{ cards, sprite, playerHand }` per seat, is clearly structured and straightforward to reason about.
- **`disposeCards` / `removeSprite` separation**: Keeping geometry/material disposal and sprite removal as distinct helpers is good discipline and avoids repetition.
- **RAF guard in `flip()`**: `isFlipping` flag in `cards.js` prevents double-flip and is correctly scoped to the closure.
- **`goToPreFlop()` correctness**: Clears sprites, disposes old cards, replaces with fresh face-down placeholders — the right sequence for back-scrubbing.
- **AC5 null guard**: The `if (playerHand && playerHand.hole_cards)` pattern correctly leaves null-card seats untouched without an explicit branch.

---

## Overall Assessment

The implementation correctly wires AC1, AC2, and AC5. AC3 is partially broken (dim does not survive the flip animation for folded players with revealed cards). **AC4 is completely non-functional** — the winner glow has zero visual effect because `MeshBasicMaterial` does not support emissive properties in Three.js. This is the most important issue to fix before sign-off.

Two HIGH concurrency issues (stale `setTimeout`, untracked RAF) don't affect correctness in normal single-hand navigation but will surface in fast-forwarded or orchestrated playback. Both require small but non-trivial additions to the lifetime management API.

Two MEDIUM texture leaks should be addressed before any production deployment; they are one-liner fixes each.

**The task cannot be closed as-complete while AC4 is NOT SATISFIED.** Recommend returning to Hank for:
1. Fix `MeshBasicMaterial` → `MeshStandardMaterial`/`MeshLambertMaterial` for face textures (C-01, blocks AC4)
2. Store and cancel `setTimeout` IDs (H-02)
3. Add flip-cancellation handle to `card.flip()` (H-03)
4. Dispose `faceTex` and sprite canvas texture (M-01, M-02)

---

FINDINGS SUMMARY: C:1 H:2 M:4 L:2
