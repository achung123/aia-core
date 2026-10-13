# Code Review Report — analytics-dashboard-007

**Date:** 2026-04-15
**Cycle:** 21
**Target:** `frontend/src/pages/PlayerProfilePage.tsx`, `frontend/src/App.tsx`, `frontend/test/pages/PlayerProfilePage.test.tsx`
**Reviewer:** Scott (automated)

**Task:** T-020 — Player profile page shell + career stats
**Beads ID:** aia-core-fad
**Epic:** aia-core-mne (Analytics Dashboard)

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 1 |
| LOW | 2 |
| **Total Findings** | **3** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | Route renders a player profile page with a PlayerSelector to switch players | SATISFIED | `App.tsx` L29: `/players/:playerName` route; `PlayerProfilePage.tsx` L82–84: PlayerSelector rendered; test "renders a PlayerSelector" asserts combobox role | — |
| 2 | Fetches from /stats/players/{name} and displays total hands, win/loss/fold, win rate, P&L, and street percentages using StatCard components | SATISFIED | `PlayerProfilePage.tsx` L11: `usePlayerStats(name)` hook; L51–73: 9 StatCard instances covering all required fields; tests "renders player stats after loading" and "renders street percentages" verify values | — |
| 3 | Zero/null values shown gracefully | SATISFIED | `PlayerProfilePage.tsx` L28–29: `fmtPct` guards null/undefined; StatCard handles null with dash placeholder, zero with muted style; test "handles zero stats gracefully" uses ZERO_STATS fixture | — |
| 4 | Page title updates to show the selected player name | SATISFIED | `PlayerProfilePage.tsx` L13–19: useEffect sets `document.title`; test "updates document title with player name" confirms | — |
| 5 | Mobile-first single-column layout | SATISFIED | `PlayerProfilePage.tsx` L90–92: `maxWidth: 600px`, `padding: 1rem`, `margin: 0 auto`; L109: grid with `minmax(140px, 1fr)` collapses to single column on narrow screens | Not unit-testable; verified by style inspection |

---

## Findings

### [MEDIUM] Player switch navigation via PlayerSelector is untested

**File:** `frontend/test/pages/PlayerProfilePage.test.tsx`
**Line(s):** entire file
**Category:** correctness

**Problem:**
The `handlePlayerSelect` callback (PlayerProfilePage.tsx L23–25) navigates to `/players/${encodeURIComponent(selected)}` when a player is selected from the dropdown. No test exercises this code path. If the navigation target or encoding logic regresses, no test will catch it.

**Suggested Fix:**
Add a test that renders the page, interacts with the PlayerSelector to pick a different player, and asserts the resulting URL includes the encoded player name.

**Impact:** A regression in player-switching navigation would go undetected.

---

### [LOW] P&L trend indicator shows 'neutral' for null values

**File:** `frontend/src/pages/PlayerProfilePage.tsx`
**Line(s):** 60–66
**Category:** design

**Problem:**
When `stats.total_profit_loss` is `null` or `undefined`, the JavaScript comparison `null > 0` evaluates to `false` and `null < 0` also evaluates to `false`, causing the ternary to fall through to `'neutral'`. This renders a neutral trend dot (●) next to a null/dash P&L value, which is slightly misleading — no data should mean no trend indicator.

**Code:**
```tsx
trend={
  stats
    ? stats.total_profit_loss > 0
      ? 'up'
      : stats.total_profit_loss < 0
        ? 'down'
        : 'neutral'
    : undefined
}
```

**Suggested Fix:**
Guard for null before evaluating the trend:
```tsx
trend={
  stats && stats.total_profit_loss != null
    ? stats.total_profit_loss > 0 ? 'up' : stats.total_profit_loss < 0 ? 'down' : 'neutral'
    : undefined
}
```

**Impact:** Minor UX inconsistency; neutral dot appears alongside a dash placeholder.

---

### [LOW] document.title cleanup resets to empty string

**File:** `frontend/src/pages/PlayerProfilePage.tsx`
**Line(s):** 17–18
**Category:** convention

**Problem:**
The useEffect cleanup sets `document.title = ''`. If a future page also sets `document.title`, navigating away from the profile page will briefly flash an empty title. A more robust pattern would save and restore the previous title.

**Code:**
```tsx
return () => {
  document.title = '';
};
```

**Suggested Fix:**
Capture the previous title and restore it on cleanup:
```tsx
useEffect(() => {
  const prev = document.title;
  if (name) document.title = `${name} — Player Profile`;
  return () => { document.title = prev; };
}, [name]);
```

**Impact:** Cosmetic; no other pages currently set `document.title`, so the empty-string reset is harmless today.

---

## Positives

- **Clean component structure** — loading, error, and success states are clearly separated with data-testid attributes enabling straightforward testing.
- **Consistent patterns** — follows existing conventions (inline styles, named exports, `pages/` directory, StatCard/PlayerSelector reuse) matching GameRecapPage and other siblings.
- **Good test coverage** — 8 tests cover all primary states (loading, loaded, zero stats, error, title, selector, heading, street percentages).
- **Defensive data handling** — `fmtPct` helper and nullish coalescing throughout prevent rendering `undefined` or `NaN`.
- **Responsive grid** — `auto-fill, minmax(140px, 1fr)` naturally collapses to a single column on small viewports without media queries.

---

## Overall Assessment

The implementation is solid and satisfies all 5 acceptance criteria. No critical or high-severity issues found. The single MEDIUM finding is a test gap (untested navigation callback), and the two LOW findings are minor design/convention nits. Code is clean, well-structured, and consistent with existing codebase patterns. Ready to proceed.
