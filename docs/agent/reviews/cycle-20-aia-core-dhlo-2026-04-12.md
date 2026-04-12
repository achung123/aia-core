# Code Review Report — frontend-react-ts-006

**Date:** 2026-04-12
**Cycle:** 20
**Target:** `frontend/src/components/{SessionScrubber,StreetScrubber,StatsSidebar,ResultOverlay,EquityOverlay}.tsx` + tests
**Reviewer:** Scott (automated)

**Task:** T-019 — Convert vanilla DOM components to React TSX (batch 2: overlays & sidebars)
**Beads ID:** aia-core-dhlo
**Epic:** aia-core-dthg (Frontend Migration: JavaScript + Preact to TypeScript + React)

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
| 1 | Five `.tsx` files replace the five `.js` files | PARTIAL | `SessionScrubber.tsx`, `StreetScrubber.tsx`, `StatsSidebar.tsx`, `ResultOverlay.tsx`, `EquityOverlay.tsx` all exist | Old `.js` files still present; removal blocked by `playbackView.js` imports |
| 2 | All imperative DOM manipulation is replaced with JSX | SATISFIED | All 5 components use JSX; zero `document.createElement`/`appendChild` calls | Clean conversion |
| 3 | Each component has a typed props interface | SATISFIED | `SessionScrubberProps`, `StreetScrubberProps`, `StatsSidebarProps`, `ResultOverlayProps`, `EquityOverlayProps` all exported | Interfaces are well-defined with appropriate types |
| 4 | Styles use CSS Modules | NOT SATISFIED | All 5 components use inline `React.CSSProperties` style objects; zero `.module.css` files exist | Consistent with batch 1 (T-018) pattern — project-wide deviation from spec |
| 5 | Components integrate with typed API client where needed | SATISFIED (N/A) | These are pure presentational components; originals also had no API client usage | No client integration needed |

---

## Findings

### [MEDIUM] M-1: CSS Modules not used — inline styles throughout

**Files:** All 5 `.tsx` components
**Category:** convention

**Problem:**
AC4 and spec S-4.4 AC3 require styles to be extracted to CSS Modules. All 5 components use inline `React.CSSProperties` style objects instead. No `.module.css` files exist anywhere in `frontend/src/components/`.

**Context:**
This is consistent with the batch 1 (T-018) components (`SessionForm.tsx`, `HandRecordForm.tsx`, etc.) which also use inline styles. The entire TSX migration has adopted inline styles as the de-facto pattern, making this a project-wide spec deviation rather than a per-task defect.

**Suggested Fix:**
Either update the spec to reflect the inline-styles decision, or create a follow-up task to extract styles to CSS Modules across all converted components in a single pass.

**Impact:** No runtime impact. Maintainability concern if styles grow complex.

---

### [MEDIUM] M-2: Old vanilla `.js` files not removed

**Files:** `frontend/src/components/{sessionScrubber,streetScrubber,statsSidebar,resultOverlay,equityOverlay}.js`
**Category:** convention

**Problem:**
AC1 says the `.tsx` files "replace" the `.js` files, but all 5 originals remain. They are still imported by `views/playbackView.js` (lines 5-6, 8).

**Context:**
This is a phased migration — `playbackView.js` is T-020's responsibility. Deleting the `.js` files now would break the unconverted view. Leaving them is the correct interim choice.

**Suggested Fix:**
No action needed yet. T-020 (Convert playbackView to TSX) should delete these files when it migrates the consumer. Consider adding a note to T-020's ACs.

**Impact:** No runtime impact. Temporary duplication until T-020 completes.

---

### [LOW] L-1: `EquityOverlay` uses empty string for `display` instead of `undefined`

**File:** `frontend/src/components/EquityOverlay.tsx`
**Line(s):** 53
**Category:** correctness

**Problem:**
`display: hasEquity ? '' : 'none'` — an empty string for `display` is technically valid (browsers treat it as removing the inline style), but `undefined` is the idiomatic React way to omit a style property.

**Code:**
```tsx
display: hasEquity ? '' : 'none',
```

**Suggested Fix:**
```tsx
display: hasEquity ? undefined : 'none',
```

**Impact:** No functional difference in browsers. Minor idiom deviation.

---

### [LOW] L-2: `StreetScrubber` `isDisabled` uses magic index numbers

**File:** `frontend/src/components/StreetScrubber.tsx`
**Line(s):** 47-49
**Category:** design

**Problem:**
`isDisabled` maps street index `2` → Turn, `3` → River by hardcoded numbers. If `STREETS` order ever changes, this silently breaks.

**Code:**
```tsx
function isDisabled(index: number, handData: StreetHandData): boolean {
  if (index === 2) return !handData.turn;
  if (index === 3) return !handData.river;
  return false;
}
```

**Suggested Fix:**
Reference `STREETS.indexOf('Turn')` / `STREETS.indexOf('River')`, or use the street name directly in the map callback rather than the index.

**Impact:** Minimal — `STREETS` is a `const` tuple unlikely to change. Readability improvement only.

---

## Positives

- **Clean JSX conversion** — All 5 components are well-structured, idiomatic React with no leftover imperative patterns
- **Strong typing** — Every component exports a clearly defined props interface; no `any` types
- **Thorough tests** — 41 tests across 5 files cover rendering, interaction, edge cases (null data, boundary indices, disabled states)
- **Faithful port** — Visual behavior (colors, layout, card formatting, P/L display) matches the vanilla originals exactly
- **Good separation of concerns** — Components are pure presentational; data fetching stays in parent views
- **`ResultOverlay` null safety** — Gracefully handles `null` handData and empty hole_cards arrays
- **`StatsSidebar` `useMemo`** — Correctly memoizes the expensive aggregation computation with appropriate deps

---

## Overall Assessment

The conversion is solid. Zero CRITICAL or HIGH issues. All 5 components are correct, well-typed, well-tested React TSX. The two MEDIUM findings are project-wide conventions (inline styles vs CSS Modules, old files retained during phased migration) rather than task-specific defects — both are consistent with how batch 1 was handled. The two LOW findings are minor idiom preferences.

**ACs 2, 3, 5:** Fully satisfied.
**AC 1:** Satisfied for the TSX creation; old file removal is blocked by T-020.
**AC 4:** Not satisfied (CSS Modules), but this is a known project-wide pattern established in T-018.

**Verdict:** Clean — no blocking issues.
