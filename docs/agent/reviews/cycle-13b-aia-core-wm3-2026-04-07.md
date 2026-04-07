# Code Review Report — Cycle 13b

**Task:** aia-core-wm3 — Fix: streetScrubber updateHandData leaves user stuck on disabled street
**Parent Feature:** aia-core-3ra — Implement hand-level street scrubber component
**Commit Reviewed:** a6237b3
**File Reviewed:** `frontend/src/components/streetScrubber.js`
**Reviewer:** Scott
**Date:** 2026-04-07

---

## Review Scope

Focused re-review of the three changes in commit `a6237b3`:
1. `updateHandData` uses spread (`{ ...handData, ...newHandData }`) instead of `Object.assign`
2. `updateHandData` walks backward on disabled current street, fires `onStreetChange`
3. Constructor fires `updateUI()` before `onStreetChange()` on initial mount

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 1 |
| LOW | 2 |

The stated HIGH bug (active+disabled coexistence, parent out-of-sync on street disable) is **fully resolved**. No new CRITICAL or HIGH issues were introduced. Two LOW-severity issues and one MEDIUM design concern are noted below.

---

## Fix 1 — Spread Assignment (`{ ...handData, ...newHandData }`)

**File:** `frontend/src/components/streetScrubber.js:83`

**Assessment: PASS ✓**

The new spread creates a fresh object: `handData = { ...handData, ...newHandData }`. The closure variable `handData` is reassigned; the caller's original object is untouched. All fields not present in `newHandData` are preserved from the prior `handData`. Shallow merge semantics are appropriate here — no nested mutable state is shared. `isDisabled()` reads `handData.turn` and `handData.river` from the closure variable correctly after the reassignment.

---

## Fix 2 — Walk-Back Logic in `updateHandData`

**File:** `frontend/src/components/streetScrubber.js:84-91`

**Assessment: PASS with LOW observations**

```javascript
updateHandData: (newHandData) => {
  handData = { ...handData, ...newHandData };
  updateUI();                                     // [1] first call
  if (isDisabled(currentIndex)) {
    let fallback = currentIndex - 1;
    while (fallback >= 0 && isDisabled(fallback)) fallback--;
    if (fallback < 0) fallback = 0;               // [2] dead guard
    currentIndex = fallback;
    updateUI();                                   // [1] second call
    onStreetChange(STREETS[currentIndex], handData);
  }
},
```

**Edge case analysis:**

| Scenario | Result |
|---|---|
| `currentIndex = 0` (Pre-Flop), any update | `isDisabled(0)` → false; if-block never entered. ✓ |
| `currentIndex = 2` (Turn), turn becomes null | fallback→1 (Flop), not disabled. `currentIndex=1`. ✓ |
| `currentIndex = 3` (River), river becomes null | fallback→2 (Turn, still set), loop stops. `currentIndex=2`. ✓ |
| `currentIndex = 3` (River), both turn + river null | fallback→2 disabled, loop→1 (Flop) not disabled. `currentIndex=1`. ✓ |
| `currentIndex = 1` (Flop), any update | `isDisabled(1)` always false; if-block never entered. ✓ |
| `currentIndex = 4` (Showdown), turn/river become null | `isDisabled(4)` always false; remains at Showdown. Pre-existing design gap, not introduced by fix. |

All explicitly stated edge cases pass. Two LOW-severity observations below.

---

## Fix 3 — Constructor Order (`updateUI` before `onStreetChange`)

**File:** `frontend/src/components/streetScrubber.js:72-73`

**Assessment: PASS ✓**

Swapping `onStreetChange` after `updateUI()` ensures the DOM segment states are applied before the parent is notified of the initial street. This prevents a race where `onStreetChange` fires before the buttons reflect their enabled/disabled/active state. No regression risk — both calls remain synchronous and execute before the first browser repaint.

---

## Findings

---

### [MEDIUM] M-01 — `onStreetChange` not called when `updateHandData` changes data on an enabled street

**File:** `frontend/src/components/streetScrubber.js:84-91`

**Description:**
When `updateHandData` is called but the current street does not become disabled, `onStreetChange` is never invoked. The `onStreetChange` callback signature is `(streetName, handData)` — it carries the updated `handData` as its second argument, indicating the parent relies on it to synchronize the displayed hand data for the current street. After this fix, `onStreetChange` is fired only in the disabled-fallback path, creating an asymmetry: the parent is notified when the active street changes, but not when the active street's underlying data changes.

**Scenario that fails silently:**
```
currentIndex = 2 (Turn, turn data exists)
updateHandData({ turn: { cards: [new set] } })
→ isDisabled(2) → false (turn still truthy)
→ updateUI() called (DOM correct)
→ if-block skipped
→ onStreetChange never called
→ parent renders stale Turn data
```

**Note:** This is a pre-existing gap for the non-disabled case but is now made more visible — and operationally problematic — because the fix creates an asymmetric notification contract. Prior to the fix, `updateHandData` never called `onStreetChange` in any path; now it does for the disabled path, making the silence for the enabled path inconsistent.

**Suggested fix:**
```javascript
updateHandData: (newHandData) => {
  handData = { ...handData, ...newHandData };
  if (isDisabled(currentIndex)) {
    let fallback = currentIndex - 1;
    while (fallback >= 0 && isDisabled(fallback)) fallback--;
    if (fallback < 0) fallback = 0;
    currentIndex = fallback;
  }
  updateUI();
  onStreetChange(STREETS[currentIndex], handData); // always notify
},
```

---

### [LOW] L-01 — Double `updateUI()` call creates a transient logically-invalid DOM state

**File:** `frontend/src/components/streetScrubber.js:85, 89`

**Description:**
The first `updateUI()` (line 85) is called before the disabled check. When `currentIndex` has just become disabled, this call renders the button with `disabled=true` and `opacity=0.35` but retains `background='#3a3a6e'` (active color) because `i === currentIndex` is still true. This is precisely the active+disabled coexistence state the bug describes. The second `updateUI()` (line 89) immediately corrects this by applying the active highlight to the fallback index.

Since both calls are synchronous within the same JS event loop task, the browser does not repaint between them — the invalid intermediate state is never visible. Functionally, this is harmless. However, the first `updateUI()` is a wasted write containing logically invalid state, and any synchronous side-effects attached to DOM mutation observers on the segment buttons would observe the invalid intermediate state.

**Suggested refactor:** restructure so `updateUI()` is called once after `currentIndex` is finalized (see MEDIUM M-01 suggestion above, which also collapses to a single `updateUI()` call).

---

### [LOW] L-02 — Dead guard `if (fallback < 0) fallback = 0`

**File:** `frontend/src/components/streetScrubber.js:87`

**Description:**
The guard `if (fallback < 0) fallback = 0` is logically unreachable. The while loop condition is `fallback >= 0 && isDisabled(fallback)`. Because `isDisabled(0)` always returns `false` (Pre-Flop is never disabled), the loop terminates at `fallback = 0` at the latest — it never decrements past zero. The guard can never fire.

The code is harmless as written, but it may mislead future maintainers into believing that index 0 can be disabled. If `isDisabled` is ever extended to disable index 0 or 1, the guard would become load-bearing without any test coverage to protect it.

**Suggested action:** Either remove the guard with a clarifying comment (`// loop stops at 0: Pre-Flop is never disabled`), or add a test that verifies fallback behavior if the guard contract were to change.

---

## Acceptance Criteria Mapping

From `aia-core-wm3` bug description:

| Criterion | Status |
|---|---|
| After `updateUI()`, if `isDisabled(currentIndex)`, walk backward to nearest enabled street | ✓ SATISFIED |
| Update `currentIndex` to fallback | ✓ SATISFIED |
| Fire `onStreetChange` (disabled-path) | ✓ SATISFIED |
| No active+disabled coexistence after `updateHandData` | ✓ SATISFIED (transient intermediate state fixed before repaint) |
| Spread prevents caller mutation | ✓ SATISFIED |
| Constructor: `updateUI()` before `onStreetChange()` | ✓ SATISFIED |

---

## Commit Decision

Report contains **zero CRITICAL findings** and **zero HIGH findings**. The fix fully resolves the stated HIGH bug. Two LOW observations and one MEDIUM design gap (pre-existing asymmetry, not a regression) are noted for follow-up.

**Committed clean (no CRITICAL blockers).**
