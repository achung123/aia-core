# Code Review Report — dealer-viz-004

**Date:** 2026-04-09
**Cycle:** 25
**Target:** T-010 — Integrate GameCreateForm into selector flow
**Reviewer:** Scott (automated)

**Task:** T-010 — Integrate GameCreateForm into selector flow
**Beads ID:** aia-core-idi0

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 1 |
| MEDIUM | 2 |
| LOW | 1 |
| **Total Findings** | **4** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | `DealerApp` initial step is `gameSelector` (not `create`) | SATISFIED | `dealerState.js` L8: `currentStep: 'gameSelector'`; `dealerState.test.js` L12 asserts same; integration test `initialState starts at gameSelector step` | — |
| 2 | "New Game" transitions to `GameCreateForm` | SATISFIED | `DealerApp.jsx` L27: `handleNewGame` dispatches `SET_STEP` → `'create'`; integration test `tapping New Game transitions to GameCreateForm` verifies date input renders | — |
| 3 | After game creation, transitions to `HandDashboard` with the new game loaded | SATISFIED | `DealerApp.jsx` L34: `handleGameCreated` dispatches `SET_GAME` which sets step to `'dashboard'`; `DealerApp.jsx` L222-227 renders `HandDashboard` when step is `dashboard` and `gameId` is set; integration test `after game creation, transitions to HandDashboard` verifies `new-hand-btn` appears | — |
| 4 | Selecting an existing game transitions directly to `HandDashboard` | SATISFIED | `DealerApp.jsx` L31: `handleSelectGame` dispatches `SET_GAME` with the selected `gameId`, which sets step to `'dashboard'` | No dedicated integration test for select-existing-game flow (see HIGH finding) |
| 5 | Existing create flow works unchanged | SATISFIED | `GameCreateForm` is not modified; `handleGameCreated` callback unchanged; `DealerApp.jsx` L219-221 renders it at `create` step as before | — |

---

## Findings

### [HIGH] Missing test for AC-4: selecting an existing game from the list

**File:** `frontend/src/dealer/GameSelectorIntegration.test.jsx`
**Line(s):** N/A (missing test)
**Category:** correctness

**Problem:**
AC-4 states "Selecting an existing game transitions directly to `HandDashboard`". While the wiring in `handleSelectGame` (DealerApp.jsx L31) is correct, there is no integration test that renders a session list, clicks a game card, and asserts the `HandDashboard` appears. The other four ACs all have corresponding integration tests.

**Suggested Fix:**
Add an integration test that mocks `fetchSessions` to return at least one game, waits for the game card to render, clicks it, and asserts `HandDashboard` content (e.g., `new-hand-btn` or the heading) appears.

**Impact:** A regression in the select-existing-game path would go undetected.

---

### [MEDIUM] `handleSelectGame` dispatches SET_GAME with empty players and null gameDate

**File:** `frontend/src/dealer/DealerApp.jsx`
**Line(s):** 31
**Category:** design

**Problem:**
When a user selects an existing game from the list, `handleSelectGame` dispatches:
```js
dispatch({ type: 'SET_GAME', payload: { gameId, players: [], gameDate: null } });
```
This sets up the state with zero players and no date, relying on `HandDashboard` to fetch hands independently. However, if any downstream step (e.g., `playerGrid`) is reached without re-populating `players`, the grid will be empty. This works today because `HandDashboard` calls `onSelectHand` which goes to `playerGrid`, but the empty player list means the player grid will have no tiles.

**Suggested Fix:**
Fetch the game session details (including player names and date) when selecting an existing game, then pass them into `SET_GAME`. Alternatively, document this as a known limitation to be addressed in a later task (e.g., T-011 or a new task).

**Impact:** Low immediate risk since `HandDashboard` works as a standalone, but will surface when the full round-trip flow for existing games is implemented.

---

### [MEDIUM] GameSelector sorts by `game_date` string comparison — no null guard

**File:** `frontend/src/dealer/GameSelector.jsx`
**Line(s):** 13-15
**Category:** correctness

**Problem:**
The sort comparator is:
```js
const sorted = [...data].sort((a, b) =>
  b.game_date.localeCompare(a.game_date)
);
```
If the API ever returns a session with a `null` or `undefined` `game_date`, this will throw a `TypeError`. The backend schema allows `game_date` to be optional in some flows.

**Suggested Fix:**
Add a fallback: `(b.game_date || '').localeCompare(a.game_date || '')`.

**Impact:** Runtime crash on the landing page if a session has no date. Low probability given current backend constraints, but defensive coding is warranted for the entry point.

---

### [LOW] Inline styles in GameSelector could be extracted to a shared pattern

**File:** `frontend/src/dealer/GameSelector.jsx`
**Line(s):** 70-150
**Category:** convention

**Problem:**
`GameSelector` uses the same inline-styles-object pattern as `HandDashboard`, `PlayerGrid`, etc. This is consistent with the existing codebase, so no action is required now. Noting for awareness that a shared theme/tokens file would reduce duplication if the dealer interface grows further.

**Suggested Fix:**
No action needed. Future consideration only.

**Impact:** None.

---

## Positives

- **Clean reducer design:** `SET_GAME` correctly resets community cards and transitions to `dashboard` in a single dispatch, preventing stale state from leaking across games.
- **Good test coverage overall:** 5 integration tests cover the GameSelector → Create → Dashboard → Back round-trip thoroughly, using real component rendering (not shallow).
- **Correct cleanup of blob URLs:** `handleReviewConfirm` and `handleReviewRetake` properly call `URL.revokeObjectURL`, preventing memory leaks.
- **No XSS vectors:** All user-facing data (`game_date`, `player_count`, `hand_count`, status) is rendered via Preact's JSX interpolation, which auto-escapes. No `dangerouslySetInnerHTML` usage. The `fetchSessions` API client uses safe `fetch` + JSON parsing.
- **Immutable state updates:** All reducer cases produce new objects/arrays via spread, preventing mutation bugs.

---

## Overall Assessment

T-010 is correctly implemented and satisfies all five acceptance criteria. The navigation flow (gameSelector → create → dashboard, and dashboard → back → gameSelector) works as specified. The one HIGH finding is the missing integration test for the "select existing game" path (AC-4), which should be addressed to close the test gap. The two MEDIUM findings are low-risk edge cases that can be handled in follow-up work. No security issues found.
