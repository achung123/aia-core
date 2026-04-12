# Code Review Report — aia-core

**Date:** 2026-04-06
**Target:** `frontend/src/components/sessionScrubber.js`
**Reviewer:** Scott (automated)
**Cycle:** 12

**Task:** Implement session-level scrubber component
**Beads ID:** aia-core-3gu

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 1 |
| MEDIUM | 2 |
| LOW | 3 |
| **Total Findings** | **6** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | `<div class="session-scrubber">` with range input and Prev/Next buttons | SATISFIED | `sessionScrubber.js` L2–4, L6–8, L47–50 | `wrapper.className = 'session-scrubber'`; prevBtn/nextBtn appended |
| 2 | Range input min=1, max=handCount, step=1 | SATISFIED | `sessionScrubber.js` L31–34 | `range.min=1`, `range.max=handCount`, `range.step=1` confirmed |
| 3 | SVG tick marks, one per hand | SATISFIED | `sessionScrubber.js` L13–28 | Loop `for (let i = 0; i < handCount; i++)` appends one `<line>` per hand |
| 4 | "Hand X / Y" label updates on drag | SATISFIED | `sessionScrubber.js` L54–57, L59 | `updateLabel()` called on `'input'` event; label text set correctly |
| 5 | `onChange(handIndex)` callback wired | PARTIAL | `sessionScrubber.js` L54–57, L59 | Fires on interaction and `setIndex`, but **NOT on initial construction** |

---

## Findings

### [HIGH] `onChange` not called on construction — initial state never communicated

**File:** `frontend/src/components/sessionScrubber.js`
**Line(s):** 1–78 (constructor body — no initial `updateLabel()` call)
**Category:** correctness

**Problem:**
`updateLabel()` is only called in response to user interaction (`range` `input` event, prevBtn click, nextBtn click) and `setIndex`. On construction the scrubber initialises the range to value `1` and sets the label to `"Hand 1 / ${handCount}"` directly on line 46 — but `onChange` is never invoked. Any consumer that relies solely on the callback to know the current hand index will never receive the initial index and will remain in an uninitialised state until the user interacts with the scrubber.

**Code:**
```js
// Line 46 — label is set directly, bypassing updateLabel()
label.textContent = `Hand 1 / ${handCount}`;

// No call to updateLabel() or onChange(1) anywhere in the constructor
```

**Suggested Fix:**
Call `updateLabel()` (or `onChange(1)`) at the end of the constructor, after all DOM nodes are appended:
```js
container.appendChild(wrapper);
updateLabel(); // fire initial state
```

**Impact:** Scene code that renders the displayed hand in response to `onChange` will show a blank or stale view on first load. The consumer must know to call `getIndex()` at mount time — a silent, non-obvious contract that is easy to miss.

---

### [MEDIUM] Tick marks visually misalign with slider thumb at min/max positions

**File:** `frontend/src/components/sessionScrubber.js`
**Line(s):** 13–28
**Category:** design

**Problem:**
Browser-native `<input type="range">` elements render the thumb track with inset padding on each side (commonly 8px, varies by browser/OS). The actual thumb travel area is therefore narrower than the element's full CSS width. Placing ticks at `0%` and `100%` of the SVG width does not correspond to where the thumb sits at `min` and `max`. The first and last ticks will appear to float outside the thumb's travel zone, and for any `handCount > 2` the intermediate ticks will also be proportionally mis-positioned.

**Code:**
```js
// pct maps linearly from 0% to 100% of SVG width
const pct = handCount > 1 ? i / (handCount - 1) : 0;
tick.setAttribute('x1', `${pct * 100}%`);
```

**Suggested Fix:**
Compensate for the thumb half-width using a CSS variable or a fixed pixel offset. One approach is to read the element width after mount and compute tick positions in pixels with a padding offset, or use the well-known formula where effective offset ≈ `thumb_half_px / element_width_px`:
```js
// After appending to DOM:
const thumbHalf = 8; // approximate, tune per target browser
const w = rangeWrapper.offsetWidth;
const usable = w - 2 * thumbHalf;
const px = thumbHalf + pct * usable;
tick.setAttribute('x1', `${px}px`);
```

**Impact:** Users see tick marks that don't line up with hand positions on the slider, undermining the purpose of the tick track. Most visible with small `handCount` values.

---

### [MEDIUM] No guard against `handCount=0`

**File:** `frontend/src/components/sessionScrubber.js`
**Line(s):** 31–34
**Category:** correctness

**Problem:**
When `handCount=0` is passed, `range.min=1` and `range.max=0` creates an invalid range input (`min > max`). HTML spec behaviour in this case is browser-defined; most browsers clamp the value silently and render a broken slider. The SVG loop renders zero ticks. The label reads `"Hand 1 / 0"`. No error is surfaced to the caller.

**Code:**
```js
range.min = 1;
range.max = handCount;  // 0 when handCount=0 → min > max
```

**Suggested Fix:**
Add a guard at the top of the function:
```js
if (handCount < 1) throw new RangeError(`createSessionScrubber: handCount must be ≥ 1, got ${handCount}`);
```
Or clamp silently if a zero-hand session is a valid caller state:
```js
const safeCount = Math.max(1, handCount);
```

**Impact:** If any caller passes `0` (e.g., an empty session before hands are dealt), the scrubber silently misbehaves. Fail-fast with a `RangeError` is preferable to silent DOM corruption.

---

### [LOW] Last tick at `x1="100%"` renders partially outside SVG bounds

**File:** `frontend/src/components/sessionScrubber.js`
**Line(s):** 20–25
**Category:** design

**Problem:**
An SVG `<line>` with `stroke-width="1"` centred on `x=100%` renders 0.5px of its stroke outside the SVG viewport. When the SVG's `overflow` defaults to `hidden` (as in most browser SVG implementations), the right half of the rightmost tick stroke is clipped — making it appear thinner than all other ticks.

**Code:**
```js
tick.setAttribute('x1', `${pct * 100}%`);  // last tick → "100%"
tick.setAttribute('stroke-width', '1');     // 0.5px clips at right edge
```

**Suggested Fix:**
Clamp the last tick to `calc(100% - 0.5px)`, or apply `overflow="visible"` to the SVG element, or switch tick positions to pixel coordinates once the SVG is mounted (which the [MEDIUM] fix above would already accomplish).

**Impact:** Minor visual artifact — rightmost tick appears half-width. Low visibility on most monitors.

---

### [LOW] `dispose()` does not explicitly remove event listeners

**File:** `frontend/src/components/sessionScrubber.js`
**Line(s):** 74
**Category:** design

**Problem:**
`dispose()` calls `wrapper.remove()` but does not call `removeEventListener` on `range`, `prevBtn`, or `nextBtn`. Modern garbage collectors will eventually collect the detached nodes and their listeners, but if `onChange` holds a closure over outer scope state (e.g., a scene object), those references remain live until GC runs. In a long-running SPA with frequent scrubber creation/destruction this could delay collection.

**Code:**
```js
dispose: () => wrapper.remove(),
```

**Suggested Fix:**
```js
dispose: () => {
  range.removeEventListener('input', updateLabel);
  prevBtn.removeEventListener('click', prevHandler);
  nextBtn.removeEventListener('click', nextHandler);
  wrapper.remove();
},
```
This requires extracting the anonymous click handlers to named references.

**Impact:** Low risk in current usage. Becomes a concern if `onChange` captures large objects or the scrubber is created/destroyed at high frequency.

---

### [LOW] `setIndex` fires `onChange` even when index is unchanged

**File:** `frontend/src/components/sessionScrubber.js`
**Line(s):** 75
**Category:** design

**Problem:**
`setIndex(i)` always calls `updateLabel()` (which calls `onChange`), even when `i` equals the current value. This triggers unnecessary downstream re-renders when the caller sets the same hand index twice.

**Code:**
```js
setIndex: (i) => { range.value = Math.max(1, Math.min(handCount, i)); updateLabel(); },
```

**Suggested Fix:**
```js
setIndex: (i) => {
  const clamped = Math.max(1, Math.min(handCount, i));
  if (parseInt(range.value, 10) !== clamped) {
    range.value = clamped;
    updateLabel();
  }
},
```

**Impact:** Low in current volume. Benign if the consumer's render is idempotent, but worth fixing to avoid redundant work.

---

## Positives

- **AC surface area is clean:** all five acceptance criteria are implemented — the structural shape of the component (class name, input attributes, SVG ticks, label, buttons) is complete and correct.
- **`handCount=1` edge case is handled correctly** for SVG ticks: the guard `handCount > 1 ? i / (handCount - 1) : 0` prevents a divide-by-zero. The range input with `min=max=1` works as a locked slider in all browsers. The label correctly shows "Hand 1 / 1".
- **Prev/Next boundary clamping is correct:** buttons are no-ops at the min and max ends; no value can escape the valid range.
- **`parseInt(range.value, 10)` is used consistently:** no implicit coercion bugs in index arithmetic.
- **`getIndex` / `setIndex` / `dispose` API is clean** and sufficient for scene integration.

---

## Overall Assessment

The implementation is structurally sound and satisfies all five acceptance criteria in their literal sense. No CRITICAL bugs exist. The most impactful issue is **H1** (no initial `onChange` fire): any scene that relies on the callback to render the first hand will silently display nothing until the user interacts. This should be fixed before the scrubber is integrated into `table.js`. The two MEDIUM findings (tick alignment, missing handCount guard) are quality concerns that affect visual polish and robustness under edge inputs. The three LOW findings are minor and can be addressed in a follow-up pass.

**Recommended action:** Fix H1 (`updateLabel()` call at end of constructor) before merging. Address M1 (tick alignment) if pixel-accurate tick correspondence is expected by UX design. M2 (handCount guard) is a one-liner and worth adding defensively.
