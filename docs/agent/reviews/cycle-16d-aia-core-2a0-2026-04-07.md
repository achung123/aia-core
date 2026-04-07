# Code Review Report — Cycle 16d

**Task:** aia-core-2a0
**Reviewer:** Scott
**Date:** 2026-04-07
**Scope:** Focused re-review of `frontend/src/scenes/holeCards.js`
**Commit reviewed:** "fix: track fold timer IDs, guard addFoldSprite, clear timers in goToPreFlop (aia-core-2a0)"

---

## Verification Checklist

### 1. Fold `setTimeout` ID added to `winnerGlowTimers`

**PASS ✅** — Lines 161–167:

```js
const foldTimerId = setTimeout(() => {
  winnerGlowTimers.delete(foldTimerId);
  dimCards(foldIdx);
  addFoldSprite(foldIdx);
}, 350);
winnerGlowTimers.add(foldTimerId);
```

`winnerGlowTimers.add(foldTimerId)` is called synchronously after the `setTimeout` call. The callback's self-cleanup (`winnerGlowTimers.delete(foldTimerId)`) uses the correct closure binding — `const` ensures the binding is stable and the `setTimeout` return value is assigned before the event loop can fire the callback. Pattern is correct.

---

### 2. `seatData.get(seatIndex)` null-checked before `scene.add(sprite)` in `addFoldSprite`

**PASS ✅** — Lines 108–116:

```js
function addFoldSprite(seatIndex) {
  const data = seatData.get(seatIndex);
  if (!data) return;                  // guard is present
  const seatPos = seatPositions[seatIndex];
  const sprite = createFoldSprite();
  sprite.position.set(seatPos.x, seatPos.y + 0.6, seatPos.z);
  scene.add(sprite);
  data.sprite = sprite;
}
```

The early-return guard `if (!data) return;` prevents `scene.add(sprite)` from executing on a stale or missing seat entry.

Note: `seatPositions` elements are `THREE.Vector3` objects (y initialised to `0` in `computeSeatPositions`), so `seatPos.y + 0.6 = 0.6` is valid — not a defect.

---

### 3. `goToPreFlop` clears `winnerGlowTimers` at the start

**PASS ✅** — Lines 188–190:

```js
goToPreFlop() {
  winnerGlowTimers.forEach(id => clearTimeout(id));
  winnerGlowTimers.clear();
  // ... rest of cleanup
}
```

Timer cancellation is the very first action in `goToPreFlop`, guaranteeing that any in-flight fold or winner-glow timers are aborted before cards are disposed and re-placed.

---

## Findings

### CRITICAL
_None._

### HIGH
_None._

### MEDIUM

#### M1 — `placeCards` unchecked `data` dereference (pre-existing, not introduced by this commit)
**File:** `frontend/src/scenes/holeCards.js` — line 82  
**Code:**
```js
function placeCards(seatIndex, rank0, suit0, rank1, suit1, faceUp) {
  const seatPos = seatPositions[seatIndex];
  // ...
  const data = seatData.get(seatIndex);
  data.cards = [card0, card1];   // no null check
}
```
`placeCards` is called from `initHand` and `goToPreFlop`, both of which iterate over `seatData` entries — so in practice `data` will always be present. However, unlike every other internal helper (`disposeCards`, `removeSprite`, `dimCards`, `glowWinnerCards`, `addFoldSprite`), this function does not guard against a `null` result before dereferencing. If ever called out of sequence it will throw a `TypeError`. Recommend adding `if (!data) return;` for consistency.

### LOW

#### L1 — `seatPositions[seatIndex]` not null-guarded in `addFoldSprite` (pre-existing, consistent with rest of file)
**File:** `frontend/src/scenes/holeCards.js` — line 110  
`seatPositions[seatIndex]` is accessed without verifying the index is in range. This is consistent with the identical pattern in `placeCards` (line 63) and carries the same low practical risk (seat indices are controlled by `initHand`). Flagged for awareness; not a regression.

---

## Summary

All three behaviours introduced by the fix commit are correctly implemented:
- Fold timer IDs are tracked in `winnerGlowTimers` with proper self-cleanup inside the callback.
- `addFoldSprite` guards against a missing seat entry before calling `scene.add`.
- `goToPreFlop` cancels and clears all pending timers as its first action.

No new CRITICAL or HIGH issues were introduced. The two findings (M1, L1) are pre-existing patterns unrelated to this commit.

---

```
FINDINGS SUMMARY: C:0 H:0 M:1 L:1
```
