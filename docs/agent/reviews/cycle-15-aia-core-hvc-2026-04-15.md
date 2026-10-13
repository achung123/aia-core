# Code Review Report — aia-core

**Date:** 2026-04-15
**Target:** `frontend/src/pages/GameListPage.tsx`, `frontend/src/pages/GameRecapPage.tsx`, `frontend/src/App.tsx`, `frontend/test/pages/GameListPage.test.tsx`, `frontend/test/pages/GameRecapPage.test.tsx`
**Reviewer:** Scott (automated)

**Task:** Game list page and recap route shell
**Beads ID:** aia-core-hvc
**Cycle:** 15

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
| 1 | Game list renders at `/games` | SATISFIED | `App.tsx` L24: `<Route path="/games" element={<GameListPage />} />`; test "renders a list of game sessions" passes | — |
| 2 | Each game links to recap (`/games/:id/recap`) | SATISFIED | `GameListPage.tsx` L42: `<Link to={/games/${game.game_id}/recap}>` ; test "each game row links to /games/:gameId/recap" asserts `href` | — |
| 3 | Recap shell with loading skeleton | SATISFIED | `GameRecapPage.tsx` L41-49: skeleton divs with `data-testid="recap-loading"`; test "shows a loading skeleton" passes | — |
| 4 | Mobile-first layout | SATISFIED | Both pages use `maxWidth: 600`, `padding: '1rem'`, `margin: '0 auto'` for centered responsive layout | Inline styles; adequate for a shell |
| 5 | Routes registered in App.tsx | SATISFIED | `App.tsx` L24-25: `/games` and `/games/:gameId/recap` routes present | — |

---

## Findings

### [HIGH] Partial error handling in GameRecapPage — only stats errors surfaced

**File:** `frontend/src/pages/GameRecapPage.tsx`
**Line(s):** 39
**Category:** correctness

**Problem:**
The composite `isError` flag only checks `statsQuery.isError`. If `handsQuery`, `awardsQuery`, or `highlightsQuery` fail, the page silently renders their empty fallbacks (`"No hand data available."`, `"No highlights yet."`, etc.) instead of surfacing an error. Users cannot distinguish between "no data" and "fetch failed" for those sections.

**Code:**
```tsx
const isError = statsQuery.isError;
```

**Suggested Fix:**
Either compose all error states into the top-level check, or add per-section error indicators:
```tsx
// Option A: unified
const isError = statsQuery.isError || handsQuery.isError || awardsQuery.isError || highlightsQuery.isError;

// Option B: per-section inline error messages (better UX)
```

**Impact:** Users may believe a section has no data when the API call actually failed, making debugging harder and creating a misleading UX.

---

### [MEDIUM] Duplicated query logic — existing hooks in useAnalytics.ts not reused

**File:** `frontend/src/pages/GameRecapPage.tsx`
**Line(s):** 10-36
**Category:** design

**Problem:**
`GameRecapPage` manually constructs four `useQuery` calls for game stats, hands, awards, and highlights. Three of these already exist as custom hooks in `frontend/src/hooks/useAnalytics.ts`: `useGameStats`, `useAwards`, and `useGameHighlights`. The query keys and enabled guards are duplicated, creating a maintenance risk if query keys or fetch logic change in one place but not the other.

**Code:**
```tsx
// GameRecapPage duplicates:
const statsQuery = useQuery<GameStatsResponse, Error>({
  queryKey: ['gameStats', id],
  queryFn: () => fetchGameStats(id),
  enabled: id > 0,
});
// vs useAnalytics.ts already provides:
// export function useGameStats(gameId: number) { ... }
```

**Suggested Fix:**
Refactor to use the existing hooks:
```tsx
const statsQuery = useGameStats(id);
const awardsQuery = useAwards(id);
const highlightsQuery = useGameHighlights(id);
```
Only `handsQuery` lacks a pre-built hook and would need a new one or remain inline.

**Impact:** Divergent query keys could cause stale cache behavior if one location is updated but not the other. Minor for now since the page is a shell, but should be addressed before GA.

---

### [LOW] Array index used as React key for highlights and awards lists

**File:** `frontend/src/pages/GameRecapPage.tsx`
**Line(s):** 90, 101
**Category:** convention

**Problem:**
Both the highlights and awards `map()` calls use `key={i}` (array index). This is acceptable for static, non-reorderable lists but is a known React anti-pattern if items are ever inserted, removed, or reordered.

**Code:**
```tsx
{highlightsQuery.data.map((h, i) => (
  <li key={i}>{h.description}</li>
))}
```

**Suggested Fix:**
If the API responses include unique identifiers (e.g., `award_id`, `highlight_id`), prefer those as keys. If not, the current approach is tolerable for a shell implementation.

**Impact:** Minimal for current shell; revisit when list items become interactive or sortable.

---

### [LOW] Inline styles throughout both pages

**File:** `frontend/src/pages/GameListPage.tsx`, `frontend/src/pages/GameRecapPage.tsx`
**Line(s):** throughout
**Category:** convention

**Problem:**
Both pages use inline `style={{}}` objects for all layout and visual styling. This creates new object references on every render and prevents style reuse, theming, or responsive breakpoints beyond the hardcoded `maxWidth`.

**Suggested Fix:**
Acceptable for a scaffold/shell. When these pages move to production-ready state, migrate to CSS modules, Tailwind classes, or a shared design system. No action needed now.

**Impact:** No functional impact. Flagged for awareness during future iteration.

---

## Positives

- **Clean loading and error states:** Both pages handle loading, error, and empty states with appropriate `data-testid` attributes, making testing straightforward.
- **Good test coverage:** 5 tests for GameListPage and 4 tests for GameRecapPage cover all primary states (loading, loaded, error, empty). Mocking strategy is clean and idiomatic.
- **Correct route wiring:** Routes in `App.tsx` are properly parameterized and consistent with the link targets in `GameListPage`.
- **Guard against invalid IDs:** `enabled: id > 0` on all queries in `GameRecapPage` prevents unnecessary API calls when `gameId` is `NaN` or `0`.
- **Type safety:** All queries are properly typed with generics matching the API response types.

---

## Overall Assessment

The implementation is a solid shell that satisfies all five acceptance criteria. All 9 tests pass. No CRITICAL issues were found.

The one HIGH finding (partial error handling) should be addressed in the next iteration — it's a correctness gap that will confuse users when non-stats API calls fail. The MEDIUM finding (duplicated hooks) is a maintenance concern but not blocking for a scaffold.

**Totals: (C: 0, H: 1, M: 1, L: 2)**
