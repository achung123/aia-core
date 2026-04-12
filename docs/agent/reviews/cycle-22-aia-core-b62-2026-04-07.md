# Code Review Report — aia-frontend-002

**Date:** 2026-04-07
**Target:** `frontend/src/views/playbackView.js`
**Reviewer:** Scott (automated)

**Task:** T-012 — Wire chip stack animations to session scrubber
**Beads ID:** aia-core-b62

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 1 |
| MEDIUM | 1 |
| LOW | 2 |
| **Total Findings** | **4** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | Session scrubber `handChange` sums P/L from hand 1..N for each player | SATISFIED | `playbackView.js:37–45` — `computeCumulativePL` loops `i = 0..handIndex` inclusive; `null` P/L coerced to 0 via `??`; `handNumber - 1` correctly converts 1-based scrubber value to 0-based index | |
| 2 | `chipStacksCtrl.updateChipStacks(cumulativePLMap)` called with computed map | SATISFIED | `playbackView.js:52–54` — `onChange` calls `updateChipStacks(plMap)` with the object returned by `computeCumulativePL` | |
| 3 | Chip stacks animate smoothly — handled by `chipStacks.js` | SATISFIED | `chipStacks.js:45–61` — `setHeight` lerp-animates over `ANIM_DURATION = 400ms` using `requestAnimationFrame` | |
| 4 | Fast scrubbing doesn't cause stutter — RAF cancellation | SATISFIED | `chipStacks.js:42–44` — `cancelAnimationFrame(animId)` fires at the top of each `setHeight` call, canceling any in-flight animation before starting a new one | |

---

## Findings

### [HIGH] Scrubber DOM nodes accumulate on repeated session loads — memory leak + visual corruption

**File:** `frontend/src/views/playbackView.js`
**Line(s):** 48–55
**Category:** correctness / design

**Problem:**
`window.__onSessionLoaded` calls `createSessionScrubber(scrubberContainer, ...)` every time a session is clicked. `createSessionScrubber` unconditionally appends a new `<div>` to `scrubberContainer` without clearing existing content. The return value (which carries a `dispose()` method) is discarded, so the old scrubber's DOM node and all its event listeners are never removed.

After two session clicks:
- Two scrubber `<div>`s are visible and stacked in the UI.
- Both scrubbers fire their `onChange` callbacks simultaneously on input events, each calling `chipStacksCtrl.updateChipStacks()` with data from different `hands` closures — producing visual corruption and double-RAF thrash on every scrub.
- With each new session click, one more orphaned event listener closure capturing a stale `hands` array accumulates in memory.

**Code:**
```js
// playbackView.js lines 48-55
window.__onSessionLoaded = ({ hands, playerNames }) => {
  // ...
  const scrubberContainer = container.querySelector('#scrubber-container');
  createSessionScrubber(scrubberContainer, hands.length, (handNumber) => {  // ← appends, never removes
    const plMap = computeCumulativePL(hands, handNumber - 1);
    chipStacksCtrl.updateChipStacks(plMap);
  });
  // ← return value discarded; dispose() never called
};
```

**Suggested Fix:**
Capture the previous scrubber instance and call `dispose()` before creating a new one:

```js
let activeScrubber = null;

window.__onSessionLoaded = ({ hands, playerNames }) => {
  // ...
  if (activeScrubber) {
    activeScrubber.dispose();   // removes previous DOM node + event listeners
    activeScrubber = null;
  }
  const scrubberContainer = container.querySelector('#scrubber-container');
  activeScrubber = createSessionScrubber(scrubberContainer, hands.length, (handNumber) => {
    const plMap = computeCumulativePL(hands, handNumber - 1);
    chipStacksCtrl.updateChipStacks(plMap);
  });
};
```

**Impact:** Visual corruption and growing memory leak on every session switch. Reproducible in any normal user session.

---

### [MEDIUM] Zero-hand session throws TypeError in `computeCumulativePL`

**File:** `frontend/src/views/playbackView.js`
**Line(s):** 37–45, 49–55
**Category:** correctness

**Problem:**
If a session is loaded with no hands (`hands.length === 0`), `createSessionScrubber` is called with `handCount = 0`. The scrubber sets `range.max = 0` and `range.value = 1`, then immediately fires `onChange(1)` inside `updateLabel()` (line 58 of `sessionScrubber.js`). The callback calls `computeCumulativePL(hands, 0)`, which evaluates `hands[0].player_hands` — but `hands[0]` is `undefined`, throwing `TypeError: Cannot read properties of undefined (reading 'player_hands')`.

The error surfaces as an unhandled exception in the `<input>` event listener chain, crashing the scrubber silently.

**Code:**
```js
// playbackView.js line 37
for (let i = 0; i <= handIndex; i++) {
  (hands[i].player_hands || []).forEach(...)  // ← hands[0] is undefined when hands = []
}
```

**Suggested Fix:**
Guard against empty hand lists before creating the scrubber, or add an early return inside `computeCumulativePL`:

```js
// Option A: guard before calling createSessionScrubber
if (!hands.length) return;

// Option B: guard inside computeCumulativePL
function computeCumulativePL(hands, handIndex) {
  const plMap = {};
  for (let i = 0; i <= handIndex && i < hands.length; i++) {
    // ...
  }
  return plMap;
}
```

**Impact:** Any session stored with zero hands crashes the scrubber UI silently. Likely an edge case in production, but a realistic state during development or data migrations.

---

### [LOW] Double `updateChipStacks` call on every session load causes harmless RAF thrash

**File:** `frontend/src/views/playbackView.js`
**Line(s):** 47, 51–54
**Category:** design

**Problem:**
On each `__onSessionLoaded` invocation, `updateChipStacks({}, seatPlayerMap)` is called synchronously on line 47, queuing RAFs on all stacks to animate to neutral height. Immediately afterward (in the same JS microtask), `createSessionScrubber` fires `onChange(1)` synchronously via `updateLabel()`, which calls `updateChipStacks(plMap)`. This cancels every RAF just queued and queues new ones — so no animation from the neutral-reset ever plays; the stacks go straight to the hand-1 heights.

Functionally harmless because RAF cancellation works correctly, but it adds unnecessary animation setup/teardown per stack × 2 on every load.

**Suggested Fix:**
Remove the `updateChipStacks({}, seatPlayerMap)` pre-reset call; instead, pass `seatPlayerMap` via `newSeatPlayerMap` in the scrubber's initial `onChange` invocation:

```js
// Remove line 47: chipStacksCtrl.updateChipStacks({}, seatPlayerMap);

activeScrubber = createSessionScrubber(scrubberContainer, hands.length, (handNumber) => {
  const plMap = computeCumulativePL(hands, handNumber - 1);
  chipStacksCtrl.updateChipStacks(plMap, handNumber === 1 ? seatPlayerMap : undefined);
});
```

**Impact:** No user-visible bug. Minor CPU waste on session load.

---

### [LOW] `computeCumulativePL` silently accumulates P/L under key `"undefined"` for null player names

**File:** `frontend/src/views/playbackView.js`
**Line(s):** 40–43
**Category:** correctness (data quality)

**Problem:**
If any `player_hand` record has `player_name = null` or `player_name = undefined` (malformed API response), `plMap["undefined"]` accumulates P/L values. This entry never matches a seat in `updateChipStacks` (because the seat-player map only contains truthy names), so it does no visible harm — but it silently discards that player's P/L data rather than surfacing the error.

**Code:**
```js
(hands[i].player_hands || []).forEach(ph => {
  const pl = ph.profit_loss ?? 0;
  plMap[ph.player_name] = (plMap[ph.player_name] || 0) + pl;  // ← ph.player_name may be null
});
```

**Suggested Fix:**
```js
(hands[i].player_hands || []).forEach(ph => {
  if (!ph.player_name) return;
  const pl = ph.profit_loss ?? 0;
  plMap[ph.player_name] = (plMap[ph.player_name] || 0) + pl;
});
```

**Impact:** Silent data loss if API returns malformed records. No UI crash.

---

## Positives

- `computeCumulativePL` indexing is correct: `handNumber - 1` accurately converts the 1-based scrubber value to a 0-based array index, and the inclusive `i <= handIndex` loop correctly sums hands 1 through N.
- `profit_loss ?? 0` is the right null-coalescing pattern; it correctly treats both `null` and `undefined` as zero without falsely zeroing out a legitimate `0` value.
- The separation between `playbackView.js` (wiring) and `chipStacks.js` (animation) is clean — the scrubber callback is a thin adapter.
- RAF cancellation in `chipStacks.js:setHeight` is well-placed and correct: it fires before starting a new animation, preventing animation queue buildup during fast scrubbing (AC4 fully satisfied).
- `createChipStacks` correctly normalizes both `Map` and plain-object `playerPLMap` inputs, making the consumer API forgiving.

---

## Overall Assessment

The core wiring — `computeCumulativePL` → `updateChipStacks` — is functionally correct for the happy path. ACs 1–4 are satisfied. The primary concern is the HIGH memory leak: every session click appends a new scrubber without removing the previous one, and the return value from `createSessionScrubber` (which provides `dispose()`) is never captured. This causes both DOM accumulation and multiple concurrent `onChange` callbacks firing on each scrub event after the second session load.

**Required before close:** Fix the HIGH finding (capture and dispose the active scrubber).
**Recommended:** Guard against zero-hand sessions (MEDIUM).

---

FINDINGS SUMMARY: C:0 H:1 M:1 L:2
