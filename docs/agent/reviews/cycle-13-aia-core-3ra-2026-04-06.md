# Code Review Report — aia-core

**Date:** 2026-04-06
**Target:** `frontend/src/components/streetScrubber.js`
**Reviewer:** Scott (automated)
**Cycle:** 13

**Task:** Implement hand-level street scrubber component
**Beads ID:** aia-core-3ra

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 1 |
| MEDIUM | 1 |
| LOW | 1 |
| **Total Findings** | **3** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | `createStreetScrubber()` creates the component | SATISFIED | Line 3 — function exported, DOM created and appended to `container` | — |
| 2 | 5 segment buttons, clicking sets active street | SATISFIED | Lines 13–20 — `segments` array, click handlers call `goToStreet(i)` setting `currentIndex` | — |
| 3 | Clicking or Prev/Next calls `onStreetChange(street, handData)` | SATISFIED | Lines 56–67 — all paths through `goToStreet` call `onStreetChange`; initial mount fires it too (line 71) | See L-1 re: ordering on initial mount |
| 4 | Active segment highlighted | SATISFIED | Lines 41–44 — `updateUI` applies `#3a3a6e` background, `#fff` color, `#6666cc` border to `currentIndex` | — |
| 5 | Turn/River disabled when null | SATISFIED | Lines 35–38 — `isDisabled` returns `!handData.turn` for index 2, `!handData.river` for index 3 | — |

---

## Edge Case Analysis

### Both Turn AND River null → can user reach Showdown?

**Confirmed: YES, Showdown is reachable.**

With `handData.turn = null` and `handData.river = null` so indices 2 and 3 are both disabled, pressing Next from Flop (index 1):

```js
let idx = 2;  // isDisabled(2) = true → idx=3
              // isDisabled(3) = true → idx=4
              // isDisabled(4) = false → stop
goToStreet(4); // Showdown ✅
```

The `while` loop correctly skips both disabled streets and lands on Showdown (index 4). No bug.

---

## Findings

### [HIGH] `updateHandData` leaves component in contradictory state when current street becomes disabled

**File:** `frontend/src/components/streetScrubber.js`
**Line(s):** 74–77 (`updateHandData`), 40–50 (`updateUI`)
**Category:** correctness

**Problem:**
If the user is currently viewing Turn (index 2) and `updateHandData({ turn: null })` is called, `updateUI()` is invoked but the function never checks whether `currentIndex` is now pointing at a disabled street. The result is an internally contradictory DOM state: the Turn button simultaneously has `btn.disabled = true` (from `isDisabled`) and the active highlight styles (`background: #3a3a6e`, `color: #fff`, `border: #6666cc`) because the `i === currentIndex` branch still fires. Additionally, `onStreetChange` is never called, so the parent component still believes the view is on Turn with the pre-update `handData`. The user is stuck on an invalid street until they press Prev or Next.

**Code:**
```js
updateHandData: (newHandData) => {
  Object.assign(handData, newHandData);
  updateUI();               // ← no check: is currentIndex still valid?
  // no onStreetChange call → parent is out of sync
},
```

```js
// Inside updateUI — both conditions are true for the active+disabled button:
btn.disabled = disabled;                                    // true
btn.style.opacity = disabled ? '0.35' : '1';               // 0.35
btn.style.background = i === currentIndex ? '#3a3a6e' : '#222'; // active highlight ← contradiction
```

**Suggested Fix:**
After calling `updateUI()` in `updateHandData`, check whether `currentIndex` is now disabled and, if so, navigate to the nearest non-disabled fallback:

```js
updateHandData: (newHandData) => {
  Object.assign(handData, newHandData);
  if (isDisabled(currentIndex)) {
    // walk back to nearest enabled street
    let fallback = currentIndex - 1;
    while (fallback >= 0 && isDisabled(fallback)) fallback--;
    if (fallback < 0) fallback = 0; // Pre-Flop is never disabled
    currentIndex = fallback;
    onStreetChange(STREETS[currentIndex], handData);
  }
  updateUI();
},
```

**Impact:** Parent view renders stale data for a street that no longer exists in `handData`. The visual state (active highlight on a dimmed disabled button) will confuse users and any code that reads `getCurrentStreet()`.

---

### [MEDIUM] `Object.assign(handData, newHandData)` silently mutates the caller's object

**File:** `frontend/src/components/streetScrubber.js`
**Line(s):** 75
**Category:** design

**Problem:**
`updateHandData` uses `Object.assign(handData, newHandData)` which mutates the original `handData` reference in-place. Because JavaScript passes objects by reference, any caller who still holds the original object will find it silently modified. This is a hidden side-effect that violates the principle of least surprise and can introduce subtle bugs in the table scene that manages `handData` objects.

**Code:**
```js
updateHandData: (newHandData) => {
  Object.assign(handData, newHandData); // mutates caller's object in-place
  updateUI();
},
```

**Suggested Fix:**
Reassign the closed-over variable rather than mutating the original:

```js
updateHandData: (newHandData) => {
  handData = { ...handData, ...newHandData }; // new object, no mutation
  updateUI();
},
```

Note: `handData` in the outer scope would need to be declared with `let` (it already is a parameter — must be converted to a local `let` variable and the parameter renamed to avoid this pattern).

**Impact:** Caller's hand data object is unexpectedly modified, which can cause downstream rendering inconsistencies in the parent scene if it compares old vs. new values.

---

### [LOW] `onStreetChange` fires before `updateUI` on initial mount, opposite of `goToStreet` order

**File:** `frontend/src/components/streetScrubber.js`
**Line(s):** 71–72
**Category:** convention

**Problem:**
At the bottom of the constructor the call order is:
```js
onStreetChange(STREETS[currentIndex], handData); // (1) fires callback
updateUI();                                       // (2) styles the DOM
```
In `goToStreet` the order is reversed:
```js
updateUI();                                       // (1) styles the DOM
onStreetChange(STREETS[currentIndex], handData); // (2) fires callback
```
Any callback code that reads the DOM state of the scrubber buttons (e.g., to check `btn.disabled`) at initial mount will see unstyled buttons, while it would see correctly styled buttons on all subsequent changes.

**Suggested Fix:**
Swap the order in the constructor to match `goToStreet`:
```js
updateUI();
onStreetChange(STREETS[currentIndex], handData);
```

**Impact:** Low risk for current usage, but creates an undetectable ordering dependency for future callers who read scrubber DOM state from within the callback.

---

## Positives

- **Edge-case navigation is correct.** The `while`-loop skip logic in Prev/Next correctly traverses multiple consecutive disabled streets in both directions. The confirmed edge case (both Turn and River null → Showdown reachable) works without any special-casing.
- **Clean `isDisabled` predicate.** Centralising the disabled check in one small function makes the logic easy to reason about and extends cleanly if more streets are added.
- **Public API is well-scoped.** Returning `{ getCurrentStreet, goTo, updateHandData, dispose }` exposes exactly what callers need and nothing more; internal state is not leaked.
- **`goTo` guards against unknown street names** via `STREETS.indexOf` returning `-1` with a null-check before delegating to `goToStreet`.

---

## Overall Assessment

The component is functional for the happy path and the navigation skip logic is implemented correctly. Two issues require attention before this component is used in production: the HIGH `updateHandData` inconsistency (invalid active+disabled state, no parent notification) and the MEDIUM mutation of the caller's `handData` object. The LOW ordering inconsistency is low risk but should be normalised for predictability. No CRITICAL findings.
