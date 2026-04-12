# Code Review Report — dealer-interface-003

**Date:** 2026-04-07
**Cycle:** 7
**Target:** `frontend/src/dealer/dealerState.js`, `frontend/src/dealer/dealerState.test.js`, `frontend/src/dealer/DealerApp.jsx`, `frontend/package.json`
**Reviewer:** Scott (automated)

**Task:** T-008 — Implement dealer state reducer
**Beads ID:** aia-core-cu7

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
| 1 | Reducer manages game ID, per-player cards, community cards, and current step | SATISFIED | `dealerState.js` lines 3–10 (`initialState`), lines 17–65 (reducer actions) | State shape includes `gameId`, `players[].card1/card2`, `community.flop1–river`, `currentStep`. Also extends with `handCount` and `gameDate` for dashboard needs. |
| 2 | `SET_PLAYER_CARDS` updates a specific player and marks them `recorded: true` | SATISFIED | `dealerState.js` lines 33–40; `dealerState.test.js` lines 44–79 | Matches by `name`, spreads new card values, sets `recorded: true`. Immutability verified by dedicated test. |
| 3 | `SET_COMMUNITY_CARDS` stores community cards and marks `recorded: true` | SATISFIED | `dealerState.js` lines 42–48; `dealerState.test.js` lines 81–97 | Destructures all 5 community slots and sets `recorded: true`. |
| 4 | `RESET_HAND` clears all card data but preserves game ID and player list | SATISFIED | `dealerState.js` lines 50–57; `dealerState.test.js` lines 99–131 | Re-initializes players via `initPlayer(p.name)`, resets community to `emptyCommunity`, preserves `gameId`, `gameDate`, and player names. Also increments `handCount` and resets step to `dashboard`. |
| 5 | State is passed to child components; no prop-drilling deeper than one level | SATISFIED | `DealerApp.jsx` lines 24–47 | `DealerApp` renders `GameCreateForm`, `HandDashboard`, and `PlayerGrid` — each receives props directly from the top-level `state`/`dispatch`. No intermediate wrapper components re-forward props. |

---

## Findings

### [MEDIUM] SET_PLAYER_CARDS silently ignores unknown player names

**File:** `frontend/src/dealer/dealerState.js`
**Line(s):** 33–40
**Category:** correctness

**Problem:**
If `SET_PLAYER_CARDS` is dispatched with a `name` that doesn't match any player in `state.players`, the `.map()` returns all players unchanged. No error, warning, or indication that the dispatch was a no-op. While the current call sites always use names sourced from `state.players`, this silent failure could mask integration bugs in future tasks (T-009/T-010) that wire camera capture and must map detection results back to specific players.

**Code:**
```js
case 'SET_PLAYER_CARDS': {
  const { name, card1, card2 } = action.payload;
  return {
    ...state,
    players: state.players.map((p) =>
      p.name === name ? { ...p, card1, card2, recorded: true } : p,
    ),
  };
}
```

**Suggested Fix:**
Add a development-only `console.warn` when no player matches, or assert the match in tests. Example:

```js
case 'SET_PLAYER_CARDS': {
  const { name, card1, card2 } = action.payload;
  const players = state.players.map((p) =>
    p.name === name ? { ...p, card1, card2, recorded: true } : p,
  );
  if (import.meta.env.DEV && !players.some((p) => p.name === name && p.recorded)) {
    console.warn(`SET_PLAYER_CARDS: no player named "${name}"`);
  }
  return { ...state, players };
}
```

**Impact:** Could mask integration bugs in downstream tasks. Low risk in isolation — only becomes relevant when real dispatch call sites are added.

---

### [LOW] SET_COMMUNITY_CARDS payload destructuring can introduce `undefined` instead of `null`

**File:** `frontend/src/dealer/dealerState.js`
**Line(s):** 42–48
**Category:** correctness

**Problem:**
The `SET_COMMUNITY_CARDS` handler destructures `{ flop1, flop2, flop3, turn, river }` from `action.payload`. If any key is absent (e.g., a partial update or a malformed dispatch), the corresponding field becomes `undefined` rather than `null`, which is inconsistent with the `emptyCommunity` shape that uses `null` for all slots. This matters because downstream components may check for `=== null` rather than falsy values.

**Code:**
```js
case 'SET_COMMUNITY_CARDS': {
  const { flop1, flop2, flop3, turn, river } = action.payload;
  return {
    ...state,
    community: { flop1, flop2, flop3, turn, river, recorded: true },
  };
}
```

**Suggested Fix:**
Default destructured values to `null`:

```js
const { flop1 = null, flop2 = null, flop3 = null, turn = null, river = null } = action.payload;
```

**Impact:** Minimal in current usage — all dispatches provide all 5 fields. Becomes relevant if partial community updates are needed later.

---

### [LOW] Placeholder `console.log` in `handleTileSelect`

**File:** `frontend/src/dealer/DealerApp.jsx`
**Line(s):** 20–23
**Category:** convention

**Problem:**
`handleTileSelect` contains a `console.log('Tile selected:', name)` stub. This is expected for T-008 (the task description notes it as a placeholder for T-009), but it should be tracked for cleanup when T-009 wires camera capture.

**Code:**
```js
function handleTileSelect(name) {
  // Placeholder — later tasks will wire camera capture
  console.log('Tile selected:', name);
}
```

**Suggested Fix:**
No action needed for T-008. Ensure T-009 replaces this with real logic and removes the `console.log`.

**Impact:** None functionally. Minor log noise during development.

---

## Positives

- **Clean immutability**: Every action handler returns new objects via spread. The test on line 68–72 explicitly verifies original state is not mutated — excellent practice.
- **Good separation**: Reducer logic is in its own module (`dealerState.js`), cleanly imported by `DealerApp.jsx`. Easy to test in isolation.
- **Thorough test coverage**: 9 tests covering all 5 actions, initialState shape, immutability, incremental handCount, and unknown-action passthrough. All tests pass.
- **Correct prop passing**: `HandDashboard` receives only player names (`.map(p => p.name)`), while `PlayerGrid` receives full player objects with `recorded` flags. This is the right granularity for each component.
- **Extra state fields**: `handCount` and `gameDate` go beyond the minimum task spec but are needed by `HandDashboard` — good forward-thinking without over-engineering.
- **vitest added correctly**: Dev dependency in `package.json`, matching the project's Vite-based build setup.

---

## Overall Assessment

The implementation is solid and meets all 5 acceptance criteria. The reducer is correctly structured, immutable, and well-tested. The `DealerApp` integration is clean with no unnecessary prop drilling. No CRITICAL or HIGH issues found. The MEDIUM finding (silent no-op on unknown player name) is a defensive improvement that becomes relevant in T-009/T-010 when real dispatch sites are added. The two LOW findings are minor and don't affect current functionality.

**Verdict:** Clean — ready to proceed.
