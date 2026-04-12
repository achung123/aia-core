# Code Review Report — dealer-viz-004

**Date:** 2026-04-09
**Target:** `frontend/src/dealer/GameSelector.jsx`, `frontend/src/dealer/GameSelector.test.jsx`, `frontend/package.json`
**Reviewer:** Scott (automated)

**Task:** T-008 — Game selector landing page component
**Beads ID:** aia-core-04vu
**Cycle:** 13

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 2 |
| LOW | 3 |
| **Total Findings** | **5** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | Component renders a list of games sorted by date descending | SATISFIED | `GameSelector.jsx` L13-16 sorts by `game_date` descending; test "renders games sorted by date descending" verifies order | String `localeCompare` works for ISO dates |
| 2 | Active games have an indigo accent; completed games are muted | SATISFIED | `GameSelector.jsx` L49-51 applies `cardActive` (borderColor: indigo) vs `cardComplete` (borderColor: #d1d5db); test "active games have indigo accent style" checks `style.borderColor` | |
| 3 | Tapping a game card calls `onSelectGame(gameId)` | SATISFIED | `GameSelector.jsx` L53 `onClick={() => onSelectGame(s.game_id)}`; test "calls onSelectGame when a game card is tapped" verifies with mock | |
| 4 | "New Game" button is visible and calls `onNewGame()` | SATISFIED | `GameSelector.jsx` L28-32 renders button with `data-testid="new-game-btn"`; tests verify click callback and visibility even during loading | |
| 5 | Loading and error states are handled | SATISFIED | `GameSelector.jsx` L35-36 renders loading/error paragraphs; tests "shows loading state initially" and "shows error state when fetch fails" verify both paths | |

---

## Findings

### [MEDIUM] M-1 — No abort controller for fetch on unmount

**File:** `frontend/src/dealer/GameSelector.jsx`
**Line(s):** 10-20
**Category:** correctness

**Problem:**
The `useEffect` calls `fetchSessions()` but never aborts the in-flight request if the component unmounts before the promise settles. This can cause "setState on unmounted component" warnings and subtle state corruption if the user navigates away quickly (e.g., tapping "New Game" before the list loads).

**Code:**
```jsx
useEffect(() => {
  fetchSessions()
    .then(data => { ... setSessions(sorted); })
    .catch(err => setError(err.message))
    .finally(() => setLoading(false));
}, []);
```

**Suggested Fix:**
Add an `AbortController` and a cleanup return:
```jsx
useEffect(() => {
  const controller = new AbortController();
  fetchSessions({ signal: controller.signal })
    .then(data => { ... })
    .catch(err => {
      if (!controller.signal.aborted) setError(err.message);
    })
    .finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
  return () => controller.abort();
}, []);
```
This requires passing `signal` through `client.js`'s `request()`, which already accepts `options`.

**Impact:** Low risk in practice (Preact handles this more gracefully than React), but becomes important once the app adds navigation between GameSelector ↔ HandDashboard.

---

### [MEDIUM] M-2 — No empty-state test

**File:** `frontend/src/dealer/GameSelector.test.jsx`
**Line(s):** (missing test)
**Category:** correctness

**Problem:**
There is no test verifying the empty-state message ("No games yet. Start a new one!") when `fetchSessions` returns `[]`. The component renders this at line 38-40, but it is untested.

**Suggested Fix:**
Add a test:
```jsx
it('shows empty state when no games exist', async () => {
  fetchSessions.mockResolvedValue([]);
  const container = renderToContainer(
    <GameSelector onSelectGame={() => {}} onNewGame={() => {}} />
  );
  await vi.waitFor(() => {
    expect(container.textContent).toContain('No games yet');
  });
});
```

**Impact:** Minor gap — the empty state is simple and unlikely to regress, but it's worth covering for completeness.

---

### [LOW] L-1 — Missing aria attributes for accessibility

**File:** `frontend/src/dealer/GameSelector.jsx`
**Line(s):** 27-32, 46-62
**Category:** design

**Problem:**
Neither the "New Game" button nor the game card buttons have `aria-label` attributes. Screen readers would announce the full text content, which is adequate for the "New Game" button but less ideal for the game cards (which contain multiple data points without semantic structure).

**Suggested Fix:**
Add `aria-label` to game cards:
```jsx
<button aria-label={`Game on ${s.game_date}, ${isActive ? 'active' : 'complete'}`} ...>
```

**Impact:** Low — this is a mobile-first dealer tool, but accessibility is still good practice.

---

### [LOW] L-2 — Test assertions rely on text content containing numbers (fragile)

**File:** `frontend/src/dealer/GameSelector.test.jsx`
**Line(s):** 78-82
**Category:** convention

**Problem:**
The "displays game details" test checks that card text contains `'6'`, `'3'`, `'4'`, `'12'`. These are weak assertions — `'3'` would match inside `'2026-03-01'` in the date string, not just the player/hand count. The test happens to work because the date is also present, but it could pass for the wrong reason.

**Suggested Fix:**
Use more specific assertions or target specific DOM elements:
```jsx
expect(cards[0].textContent).toContain('6 players');
expect(cards[0].textContent).toContain('3 hands');
```

**Impact:** Minimal — tests pass correctly now, but fragile if the display format changes.

---

### [LOW] L-3 — `happy-dom` is a devDependency but version is unpinned

**File:** `frontend/package.json`
**Line(s):** 12
**Category:** convention

**Problem:**
`"happy-dom": "^20.8.9"` uses a caret range, which is standard for npm but worth noting — happy-dom has had breaking changes between minor versions in the past. The other devDependencies also use carets, so this is consistent within the project.

**Suggested Fix:**
No action needed now — just a note that if happy-dom tests start failing after a `npm install`, version pinning would be the first thing to check.

**Impact:** Negligible — consistent with project conventions.

---

## Positives

- **Clean component structure** — The component is concise (~70 lines of logic), follows Preact hooks patterns correctly, and separates style objects cleanly.
- **Good test coverage** — 8 tests covering all 5 ACs: sorting, styling, callbacks, loading, error, and the "new game available during loading" edge case.
- **No XSS risk** — All rendered data (`game_date`, `player_count`, `hand_count`, `status`) flows through Preact's JSX escaping. No `dangerouslySetInnerHTML` usage. Player names are not rendered in this component.
- **Correct data flow** — The component is purely presentational with callbacks; it doesn't manage navigation or global state, keeping it composable for T-009 and T-010.
- **Consistent patterns** — Follows the same Preact/JSX conventions as `GameCreateForm.jsx`, `HandDashboard.jsx`, and other dealer components.
- **Touch-friendly** — Buttons have `minHeight: 48px` on "New Game" and generous padding on cards; `WebkitTapHighlightColor: transparent` is set.

---

## Overall Assessment

The GameSelector component is well-implemented and satisfies all 5 acceptance criteria. No critical or high-severity issues found. The two medium findings (missing abort controller on unmount, missing empty-state test) are low-risk items that should be addressed when T-009/T-010 add navigation between views. The component is clean, testable, and ready for integration.

**Verdict:** PASS — ready to ship.
