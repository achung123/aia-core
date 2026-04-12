# Code Review Report — aia-core

**Date:** 2026-04-07
**Target:** `frontend/src/components/statsSidebar.js`
**Reviewer:** Scott (automated)

**Task:** Implement stats sidebar with cumulative P/L
**Beads ID:** aia-core-1w8

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 1 |
| LOW | 3 |
| **Total Findings** | **4** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| AC1 | Sidebar lists all session players with formatted P/L (`+$45.00`, `-$12.50`) | SATISFIED | `formatPL()` lines 19–23; player rows lines 85–101 | Format correct for positive, negative, and zero values |
| AC2 | Players sorted by P/L descending | SATISFIED | Sort comparator lines 55–63: `playerTotals[b] - playerTotals[a]` | Non-null players only; null players handled separately via AC5 |
| AC3 | Summary row shows total hands completed and cumulative pot | SATISFIED | `handsCompleted` / `totalPot` accumulation lines 34–49; summary row lines 105–122 | Both fields rendered; pot shown as `$X.XX` |
| AC4 | Sidebar re-renders on scrubber position change (no additional API call) | SATISFIED | `update(handIndex)` reads only from closed-over `hands` array; no `fetch` anywhere | Pure in-memory calculation |
| AC5 | `null` P/L values display as "—" and sort last | SATISFIED | `playerAllNull` map lines 33/44–46; sort lines 56–60; display line 91: `'\u2014'` | All-null players correctly go last; em-dash rendered |

---

## Findings

### [MEDIUM] `dispose()` throws if sidebar already removed

**File:** `frontend/src/components/statsSidebar.js`
**Line(s):** 131
**Category:** correctness

**Problem:**
`container.removeChild(sidebar)` throws a `NotFoundError` DOM exception if `dispose()` is called after `sidebar` has already been removed from `container` (e.g., called twice, or if the parent removed children independently during a re-init cycle). In an orchestrated scrubber/replay flow, double-dispose is a realistic path.

**Code:**
```js
function dispose() {
  container.removeChild(sidebar);
}
```

**Suggested Fix:**
```js
function dispose() {
  if (sidebar.parentNode === container) {
    container.removeChild(sidebar);
  }
}
```

**Impact:** Unhandled DOM exception crashes the disposal path; the caller receives no indication that disposal failed.

---

### [LOW] Dead `null` guard in `formatPL`

**File:** `frontend/src/components/statsSidebar.js`
**Line(s):** 20
**Category:** convention

**Problem:**
`formatPL` guards against `null` with `if (value === null) return '\u2014'`, but it is only ever called at line 91 after the `playerAllNull[name]` check has already routed null-players to the em-dash path. The null branch in `formatPL` is therefore unreachable dead code. Leaving it in place suggests `formatPL` can be called with `null`, which misleads future readers.

**Code:**
```js
function formatPL(value) {
  if (value === null) return '\u2014';   // never reached
  ...
}
// caller always does:
const plText = playerAllNull[name] ? '\u2014' : formatPL(playerTotals[name]);
```

**Suggested Fix:**
Remove the null guard from `formatPL` and document that callers are responsible for the null case, or invert: let `formatPL` own the null rendering and remove the ternary at the call site.

**Impact:** No runtime impact; code clarity concern.

---

### [LOW] Misleading inline comment about slice semantics

**File:** `frontend/src/components/statsSidebar.js`
**Line(s):** 26–27
**Category:** convention

**Problem:**
The comment reads *"handIndex is 1-based … convert to 0-based inclusive slice"* and the notation `hands[0..handIndex-1] inclusive` contradicts the actual loop `for (let i = 0; i < sliceEnd …)` which uses an exclusive upper bound. The word "inclusive" and the `..` notation are misleading — the code is correct but the comment misstates what it does.

**Code:**
```js
// handIndex is 1-based (matches scrubber value), convert to 0-based inclusive slice
const sliceEnd = handIndex; // hands[0..handIndex-1] inclusive = hands.slice(0, handIndex)
```

**Suggested Fix:**
```js
// handIndex is 1-based; process hands[0] through hands[handIndex-1] (exclusive upper bound)
const sliceEnd = handIndex;
```

**Impact:** No runtime impact; documentation clarity concern.

---

### [LOW] Zero net P/L displays as `+$0.00`

**File:** `frontend/src/components/statsSidebar.js`
**Line(s):** 21–22
**Category:** design

**Problem:**
`formatPL(0)` returns `'+$0.00'` because `0 >= 0` is true. A player who exactly breaks even displays as `+$0.00`, which users may interpret as a winning result. The spec examples (`+$45.00`, `-$12.50`) do not cover the zero case, leaving the rendering ambiguous. `$0.00` (no sign) would be less misleading.

**Code:**
```js
return value >= 0 ? '+$' + abs : '-$' + abs;
```

**Suggested Fix:**
```js
if (value === 0) return '$0.00';
return value > 0 ? '+$' + abs : '-$' + abs;
```

**Impact:** UX concern; no functional bug.

---

## Positives

- **Full XSS safety:** Every DOM mutation uses `textContent` — no `innerHTML`, `insertAdjacentHTML`, or `document.write` anywhere in the file. Player names and P/L values from untrusted API data are rendered safely.
- **Clean separation of concerns:** `createStatsSidebar` returns a `{ update, dispose }` interface; the caller owns lifecycle. No global state or event listeners are registered.
- **Null-sort correctness:** The `playerAllNull` pattern correctly handles the mixed case (a player with some null and some non-null P/L values in the slice is treated as non-null and sorted by their cumulative total).
- **Graceful over/under-index:** `handIndex=0` yields an empty table with a zero summary row. `handIndex > hands.length` processes all hands without error — both are handled by the loop guard.
- **No API calls in `update()`:** The function is strictly a pure view transform over the already-fetched `hands` array, satisfying AC4 unambiguously.

---

## Overall Assessment

All 5 acceptance criteria are **satisfied**. The implementation is clean, XSS-safe, and architecturally sound. The single MEDIUM finding (`dispose()` missing a guard against double-removal) is a defensive-programming gap that could surface in an orchestrated lifecycle but carries no data-loss risk. The three LOW findings are all code-clarity issues with no runtime impact.

**Recommended action:** Patch the `dispose()` guard (MEDIUM) before merging. The LOW findings can be addressed opportunistically.

---

FINDINGS SUMMARY: C:0 H:0 M:1 L:3
