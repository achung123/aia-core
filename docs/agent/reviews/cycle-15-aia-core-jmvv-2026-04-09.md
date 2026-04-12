# Code Review Report — dealer-viz-004

**Date:** 2026-04-09
**Target:** `frontend/src/dealer/PlayerGrid.jsx`, `frontend/src/dealer/PlayerGrid.test.jsx`
**Reviewer:** Scott (automated)
**Cycle:** 15

**Task:** T-012 — Player tiles with status indicators
**Beads ID:** aia-core-jmvv

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 1 |
| LOW | 1 |
| **Total Findings** | **2** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | Each tile shows name and status text | SATISFIED | `PlayerGrid.jsx` L30–L32 renders `p.name` and `p.status`; test "renders player name and status text on each tile" verifies all four statuses | — |
| 2 | Background color matches status (white/playing, green/won, red/folded, orange/lost) | SATISFIED | `statusColors` map at L1–L6; inline style at L28; test "sets background color based on player status" asserts all four hex values | — |
| 3 | Tiles at least 80px tall and touch-friendly | SATISFIED | `styles.tile.minHeight: '80px'` at L73; padding `1rem`; test "renders tiles with at least 80px min-height" asserts style | — |
| 4 | Table tile retains checkmark for community cards | SATISFIED | L20 renders ✅ when `communityRecorded`; two tests cover presence/absence of checkmark on Table tile | — |

---

## Findings

### [MEDIUM] Status text color has insufficient contrast on colored backgrounds

**File:** `frontend/src/dealer/PlayerGrid.jsx`
**Line(s):** 89–93
**Category:** accessibility

**Problem:**
The `statusText` style uses `color: '#555'` (0.8rem font). Against colored tile backgrounds this falls below WCAG AA 4.5:1 ratio for normal/small text:
- `#555` on `#bbf7d0` (won/green) ≈ 3.5:1
- `#555` on `#fed7aa` (lost/orange) ≈ 3.1:1
- `#555` on `#fecaca` (folded/red) ≈ 2.9:1

Only white (`#ffffff`) meets the threshold at ≈ 5:1.

**Code:**
```jsx
statusText: {
    fontSize: '0.8rem',
    fontWeight: 'normal',
    marginTop: '0.25rem',
    color: '#555',
},
```

**Suggested Fix:**
Use a darker text color such as `#333` or `#374151` for the status text, which would bring all backgrounds above 4.5:1.

**Impact:** Users with low vision may have difficulty reading the status text on green, orange, and red tiles.

---

### [LOW] No test for unknown status falling back to white

**File:** `frontend/src/dealer/PlayerGrid.test.jsx`
**Line(s):** —
**Category:** correctness

**Problem:**
`PlayerGrid.jsx` L28 includes a fallback `|| '#ffffff'` for unknown status values, but no test verifies this defensive path.

**Suggested Fix:**
Add a test with a player whose status is an unrecognized string (e.g., `'unknown'`) and assert the tile background is `#ffffff`.

**Impact:** Minor — the fallback is simple and unlikely to regress, but explicit coverage prevents surprises.

---

## Positives

- **Clean status-color mapping** — the `statusColors` object at module scope is easy to maintain and extend.
- **Good test coverage** — 6 tests map directly to all 4 acceptance criteria with clear assertions.
- **`data-testid` attributes** — consistent naming (`player-tile-{name}`, `table-tile`) enables reliable test selectors.
- **Status text alongside color** — status is conveyed through both color and text, which is the right accessibility pattern (no reliance on color alone).
- **Defensive fallback** — unknown statuses gracefully fall back to white rather than crashing.

---

## Overall Assessment

All four acceptance criteria are **SATISFIED**. The implementation is correct, concise, and well-tested. One medium accessibility issue with status text contrast on colored backgrounds should be addressed in a follow-up. No critical or high findings — code is clean.
