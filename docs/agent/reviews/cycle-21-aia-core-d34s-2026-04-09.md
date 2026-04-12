# Code Review Report — dealer-viz-004

**Date:** 2026-04-09
**Target:** T-019 — Wire equity overlay in dealer preview
**Reviewer:** Scott (automated)
**Cycle:** 21
**Task:** T-019 — Wire equity overlay in dealer preview
**Beads ID:** aia-core-d34s
**Story Ref:** S-5.3

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 2 |
| LOW | 2 |
| **Total Findings** | **4** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | Equity badges appear when ≥2 players have hole cards | SATISFIED | `DealerPreview.jsx` L75-82 checks `playersWithCards.length < 2`; test "fetches equity when >=2 players have hole cards" confirms badges render | |
| 2 | Equity re-fetches when community cards are added | SATISFIED | `DealerPreview.jsx` L90-91 includes `community?.flop1` etc. in useEffect deps; test "re-fetches equity when community cards change" confirms second fetch | |
| 3 | If equity endpoint fails, badges are hidden (no error toast) | SATISFIED | `DealerPreview.jsx` L86 `.catch(() => setEquities(null))`; test "hides badges when fetchEquity fails" confirms null equities → no badges | |
| 4 | Badges show percentage to nearest integer (e.g., "81%") | SATISFIED | `DealerPreview.jsx` L108 `Math.round(e.equity * 100)`; test "rounds equity percentages to nearest integer" verifies 0.6549 → 65% | |
| 5 | `fetchEquity(gameId, handNumber)` in `client.js` | SATISFIED | `client.js` L139-141 exports `fetchEquity`; mocked in both test files | Pre-existing from T-007 as expected |

---

## Findings

### [MEDIUM] M-1: Race condition — stale equity response on rapid state changes

**File:** `frontend/src/dealer/DealerPreview.jsx`
**Line(s):** 80-92
**Category:** correctness

**Problem:**
The equity useEffect uses a `cancelled` boolean to prevent setting state after unmount or re-render, which is good. However, on rapid community card changes (e.g., flop → turn → river in quick succession), multiple concurrent `fetchEquity` calls can be in flight simultaneously. While the `cancelled` flag prevents stale updates from old effects, it does not abort the actual HTTP requests. This means unnecessary network traffic and backend load during rapid state transitions.

**Code:**
```jsx
let cancelled = false;
fetchEquity(gameId, handNumber)
  .then((data) => {
    if (!cancelled) setEquities(data.equities);
  })
  .catch(() => {
    if (!cancelled) setEquities(null);
  });

return () => { cancelled = true; };
```

**Suggested Fix:**
Use `AbortController` to cancel in-flight requests on cleanup. This is a minor optimization — the current approach is functionally correct (stale responses are discarded) but wastes network resources.

```jsx
const controller = new AbortController();
fetchEquity(gameId, handNumber, { signal: controller.signal })
  .then(...)
  .catch((err) => {
    if (err.name !== 'AbortError' && !controller.signal.aborted) setEquities(null);
  });
return () => controller.abort();
```

**Impact:** Low in practice — the cancelled flag prevents UI bugs. This is a polish improvement, not a functional defect.

---

### [MEDIUM] M-2: Spread of dynamic array in useEffect dependency list

**File:** `frontend/src/dealer/DealerPreview.jsx`
**Line(s):** 89-92
**Category:** design

**Problem:**
The equity useEffect dependency array spreads player cards dynamically:
```jsx
...((players || []).flatMap((p) => [p.card1, p.card2]))
```
This pattern means the dependency array length changes when players are added/removed, which violates React/Preact's rules of hooks (dependency arrays should have a stable length across renders). In practice, Preact's diffing is lenient and this works correctly because the component re-renders fully when the player count changes, but it's technically incorrect per the hooks contract and could cause subtle bugs with future framework updates.

The same pattern appears in the scene-update useEffect at lines 63-66.

**Suggested Fix:**
Serialize the player cards into a stable string key:
```jsx
const playerCardKey = (players || []).map(p => `${p.card1}|${p.card2}`).join(',');
// Then use [gameId, handNumber, communityKey, playerCardKey] as deps
```

**Impact:** No current bug observed, but a latent correctness issue under strict hooks rules.

---

### [LOW] L-1: Equity badges render outside the expanded canvas section

**File:** `frontend/src/dealer/DealerPreview.jsx`
**Line(s):** 113-124
**Category:** design

**Problem:**
Equity badges render regardless of whether the 3D preview canvas is expanded or collapsed. When `expanded === false`, the badges still appear below the toggle button if equity data is available. This may be intentional (showing equity even without the 3D view), but the spec says "equity badges appear over each seat" (S-5.3 AC-1), implying they are part of the visual table preview.

**Suggested Fix:**
Wrap the badge container in `{expanded && equities && ...}` if the intent is to show badges only when the table is visible. If showing badges independently is desired, no change needed — but clarify the design intent.

**Impact:** Minor UX inconsistency — not a functional defect.

---

### [LOW] L-2: Missing test for equity re-fetch when player cards change

**File:** `frontend/src/dealer/DealerPreview.test.jsx`
**Line(s):** 160-210
**Category:** correctness

**Problem:**
The test suite covers re-fetch when community cards change, but does not explicitly test that equity re-fetches when a new player's hole cards are added (e.g., going from 2 → 3 players with cards). The dependency array includes player card values, so this should work, but there's no test asserting it.

**Suggested Fix:**
Add a test that starts with 2 players having cards, re-renders with a third player gaining cards, and asserts `fetchEquity` is called again.

**Impact:** Minor test gap — the behavior is covered by the dependency array implementation, but an explicit test would improve confidence.

---

## Positives

1. **Clean cancellation pattern** — The `cancelled` boolean in the equity useEffect correctly prevents stale state updates, which is the most important aspect of async effect cleanup.
2. **Thorough test coverage** — 6 equity-specific tests covering all ACs: fetch trigger threshold, error hiding, re-fetch on community change, integer rounding, and missing gameId/handNumber guard.
3. **Graceful degradation** — The component handles missing `gameId`/`handNumber` props cleanly by clearing equities, which supports the progressive disclosure flow where props become available after hand creation.
4. **Consistent prop threading** — `DealerApp.jsx` correctly passes `gameId={state.gameId}` and `handNumber={state.currentHandId}` to `DealerPreview`, ensuring equity fetches target the correct hand.
5. **`fetchEquity` already existed** — Correctly reuses the T-007 API client function rather than duplicating fetch logic.
6. **All 107 frontend tests pass** — Zero regressions across 8 test files.

---

## Overall Assessment

T-019 is a clean, well-tested implementation. All 5 acceptance criteria are satisfied. The equity overlay correctly fetches, renders, and hides equity badges based on hand state. The two MEDIUM findings (AbortController optimization and spread-in-deps pattern) are polish items that don't represent functional defects — the current code works correctly in all tested scenarios. No CRITICAL or HIGH issues found.

**Verdict:** PASS — ready to merge.
