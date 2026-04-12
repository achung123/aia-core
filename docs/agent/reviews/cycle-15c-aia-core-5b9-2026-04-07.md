# Code Review Report — Cycle 15c

**Reviewer:** Scott (Test Architect & Code Reviewer)
**Date:** 2026-04-07
**Task / Beads ID:** aia-core-5b9
**Commit:** `777a6eb` (`fix: cancel prior addCard RAF handle before overwriting (aia-core-bqz)`)
**Scope:** Spot-check — `addCard` function only, `frontend/src/scenes/communityCards.js`

---

## Verification Target

> Does `addCard` now begin with `if (cancelHandles[slotIndex]) { cancelHandles[slotIndex](); cancelHandles[slotIndex] = null; }` before calling `animateCard`?

---

## Findings

### CRITICAL
_None._

### HIGH
_None._

### MEDIUM
_None._

### LOW
_None._

---

## AC Mapping

| Acceptance Criterion | Status |
|---|---|
| `addCard` cancels any prior in-flight RAF handle for the same slot before creating a new animation | ✅ SATISFIED |
| Guard appears as the **first statement** in `addCard`, before any mesh creation or `animateCard` call | ✅ SATISFIED |

---

## Detail

**`frontend/src/scenes/communityCards.js`, line 76** (commit `777a6eb`, `+1` insertion):

```js
function addCard(slotIndex) {
    if (cancelHandles[slotIndex]) { cancelHandles[slotIndex](); cancelHandles[slotIndex] = null; }  // ← added line
    const data = slotCardData(slotIndex);
    if (!data) return;
    ...
    cancelHandles[slotIndex] = animateCard(mesh, target, ANIM_DURATION, null);
}
```

The guard matches the required pattern exactly:

1. **Condition** — `cancelHandles[slotIndex]` is truthy (a live cancel function exists).
2. **Cancel** — Calls `cancelHandles[slotIndex]()` to halt the prior RAF loop.
3. **Null-out** — Sets `cancelHandles[slotIndex] = null` immediately to prevent a double-call if `addCard` is re-entered before the assignment on line 86.
4. **Position** — Guard is the *first statement* in the function body, unconditionally executed before `slotCardData`, mesh creation, or `animateCard`.

The symmetric guard already present in `removeCard` (line 97) follows the same pattern consistently, and `dispose()` (line 124) correctly iterates all handles on teardown. No regressions or new issues introduced.

---

## Summary

The one-line fix correctly closes the race condition where a rapid `goToStreet` call could overwrite `cancelHandles[slotIndex]` without stopping the in-flight animation, leaking a detached RAF loop. The implementation is minimal and consistent with the surrounding defensive patterns.

---

```
FINDINGS SUMMARY: C:0 H:0 M:0 L:0
```
