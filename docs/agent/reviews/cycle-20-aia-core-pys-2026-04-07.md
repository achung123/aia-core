# Code Review Report — aia-core

**Date:** 2026-04-07
**Target:** `frontend/src/components/playerManagement.js`
**Reviewer:** Scott (automated)

**Task:** Build data interface: player management UI
**Beads ID:** aia-core-pys

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 1 |
| HIGH | 0 |
| MEDIUM | 2 |
| LOW | 1 |
| **Total Findings** | **4** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | Player list renders all players with name and total hands count | NOT SATISFIED | `playerManagement.js:79` calls `fetchLeaderboard()` / `stats.py:110` uses INNER JOIN on `PlayerHand` filtered by `result.isnot(None)` | Leaderboard excludes players with 0 hands; backend `GET /players` exists but is not called |
| 2 | "New Player" form with name input and Submit button | SATISFIED | `playerManagement.js:57–68` | `input[type=text]` + `button[type=submit]` both present |
| 3 | Submit calls `createPlayer()` and adds player without full reload; form resets on success | SATISFIED | `playerManagement.js:112–117` | `event.preventDefault()`, `createPlayer({name})`, DOM append, `nameInput.value = ''` |
| 4 | Duplicate name errors shown inline below input | PARTIAL | `playerManagement.js:71–75` | Error element is rendered after the Submit button, not directly below the input field; 409 detection logic is fragile (string-prefix check) |
| 5 | Empty name submission prevented client-side | SATISFIED | `playerManagement.js:105–110` | `trim()` check gates empty/whitespace-only names; shows inline error message |

---

## Findings

### [CRITICAL] AC1: Player list excludes zero-hand players — wrong data source

**File:** `frontend/src/components/playerManagement.js`
**Line(s):** 79
**Category:** correctness

**Problem:**
`createPlayerManagement` populates the player table by calling `fetchLeaderboard()`, which hits
`GET /stats/leaderboard`. That endpoint builds its result set with an **inner join** on `PlayerHand`
filtered to rows where `result IS NOT NULL` (see `stats.py` lines 110–114):

```python
db.query(Player.name, ...)
  .join(PlayerHand, Player.player_id == PlayerHand.player_id)
  .filter(PlayerHand.result.isnot(None))
  .group_by(...)
```

Any player who has been created but has never played (or whose hands have no recorded result) is
completely invisible in the response. The acceptance criterion requires **all** players to appear.

The backend already exposes `GET /players` (→ `list[PlayerResponse]`, `players.py` line 41) which
returns every player unconditionally. However, `client.js` has no `fetchPlayers()` helper, so there
is no path for the component to call that endpoint.

**Suggested Fix:**
1. Add `fetchPlayers()` to `frontend/src/api/client.js`:
   ```js
   export function fetchPlayers() {
     return request('/players');
   }
   ```
2. In `playerManagement.js`, replace `fetchLeaderboard()` with `fetchPlayers()` and map
   `entry.name` / `entry.hands_played` (note: `PlayerResponse` does not carry `hands_played` —
   this field would need to be added to the backend response or sourced from a joined query,
   or rendered as `0` / `"—"` for players with no history).

**Note on race condition if fixed:** After the fix, if `fetchPlayers()` is still in-flight when a
new player is successfully created, the UI appends the new row immediately. If the `fetchPlayers()`
response resolves *after* the POST and already includes the new player, that player will appear
twice. Consider setting a flag or clearing/rebuilding `tbody` from the fetched list to prevent
duplicates.

**Impact:** The player list silently omits every player created before any session data is recorded,
and every player whose hands have no `result` value. This is a core functional gap — users creating
players via the form see them disappear on next page load.

---

### [MEDIUM] AC4 (partial): Inline error rendered below Submit button, not below input

**File:** `frontend/src/components/playerManagement.js`
**Line(s):** 60–75
**Category:** correctness / design

**Problem:**
The DOM order inside the form is: `nameInput` → `submitBtn` → `inlineError`. The acceptance
criterion specifies the duplicate-name error appears "below input," which conventionally means
directly beneath the input field. Placing it after the Submit button increases the chance a user
misses the message (especially if the button is styled large or the form has vertical padding).

```js
form.appendChild(nameInput);   // line 60
form.appendChild(submitBtn);   // line 64
form.appendChild(inlineError); // line 71  ← below button, not below input
```

**Suggested Fix:**
Insert `inlineError` between `nameInput` and `submitBtn`:
```js
form.appendChild(nameInput);
form.appendChild(inlineError); // moved here
form.appendChild(submitBtn);
```

**Impact:** Error messages are visible but technically misplaced relative to the AC. Under some
layouts the user must read past the Submit button to see the error.

---

### [MEDIUM] Fragile 409 detection via error message string prefix

**File:** `frontend/src/components/playerManagement.js`
**Line(s):** 118–121
**Category:** design

**Problem:**
The submit handler detects duplicate-name errors by checking whether the thrown error message
starts with the string `'HTTP 409'`:

```js
const status = err.message && err.message.startsWith('HTTP 409')
  ? `Player "${name}" already exists.`
  : err.message;
```

This couples the component's control flow to the exact string format produced by `client.js`
(`HTTP ${response.status}: ${text}`). If that format ever changes (e.g., a refactor to
`[409] ...` or a custom `ApiError` class), the 409 branch silently stops firing and the raw
error message is shown to the user instead of the friendly duplicate notice—with no test failure
or warning.

**Suggested Fix:**
Extend the `request()` helper in `client.js` to throw a richer error type that carries a numeric
`status` field:
```js
const err = new Error(`HTTP ${response.status}: ${text}`);
err.status = response.status;
throw err;
```
Then the component can check `err.status === 409` instead of parsing the message string.

**Impact:** No user-visible defect today; silent regression risk during future refactors. Low
likelihood but zero cost to fix.

---

### [LOW] Raw server error messages exposed in UI

**File:** `frontend/src/components/playerManagement.js`
**Line(s):** 92–96, 119–121
**Category:** security / design

**Problem:**
On both a failed leaderboard load and a non-409 submit error, the raw `err.message` is rendered
directly into the UI:

```js
// initial load failure (line 94)
errorEl.textContent = `Failed to load players: ${err.message}`;

// submit failure, non-409 (line 120)
inlineError.textContent = status; // where status = err.message
```

`err.message` contains the full text thrown by `client.js`: `HTTP <code>: <raw server body>`. This
can expose HTTP status codes, stack traces, or internal error details to end users without any
filtering.

Using `textContent` (not `innerHTML`) means there is **no XSS risk**, but leaking internal
server response bodies is poor practice.

**Suggested Fix:**
For non-409 errors show a generic fallback:
```js
const status = err.status === 409
  ? `Player "${name}" already exists.`
  : 'An unexpected error occurred. Please try again.';
```

**Impact:** Information disclosure only; no exploitability. Low severity.

---

## Positives

- **XSS clean throughout** — Every DOM mutation uses `textContent` or `createElement`+`appendChild`.
  No `innerHTML`, `outerHTML`, or `insertAdjacentHTML` anywhere in the file. The security posture
  here is excellent.
- **Correct field names** — `entry.player_name` and `entry.hands_played` exactly match the
  `LeaderboardEntry` Pydantic schema fields (`app_models.py` lines 352–358). `?? 0` guard is
  good defensive coding.
- **Submit guard** — `submitBtn.disabled = true` before the `await` and re-enabled in `finally`
  correctly prevents double-submission without extra state variables.
- **Whitespace-only names blocked** — `nameInput.value.trim()` gates the empty check, catching
  names like `"   "` that would pass a bare length check.
- **Empty-state handling** — Both the loading state and the no-data state are handled gracefully
  with informative messages.
- **`dispose()` method** — The component exposes a cleanup interface, which is good component
  lifecycle hygiene.

---

## Overall Assessment

The implementation is partially acceptable: XSS hygiene is strong, the form mechanics (AC2, AC3,
AC5) work correctly, and the code is readable. However, **AC1 is not satisfied** — the player list
uses the wrong API endpoint. The leaderboard INNER-joins on hand history, so players with no
recorded results are silently invisible. The fix requires adding `fetchPlayers()` to `client.js`
and switching the component to call `GET /players`. The backend endpoint already exists. Until this
is fixed the task cannot be considered done.

AC4 is partially met; the two MEDIUM findings are low-effort corrections once the CRITICAL is
resolved.

**This review contains 1 CRITICAL finding — no commit is made.**

---

FINDINGS SUMMARY: C:1 H:0 M:2 L:1
