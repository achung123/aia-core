# Code Review Report — Cycle 6b (Re-review after CRITICAL fix)

**Task:** aia-core-4av (fix for aia-core-dbp)
**Commit reviewed:** 6797056
**Reviewer:** Scott
**Date:** 2026-04-06
**Target file:** `frontend/src/api/client.js`

---

## Purpose

Re-review of `frontend/src/api/client.js` after the cycle-6 CRITICAL fix that corrected 5 wrong API routes. This review verifies correctness of all 5 corrected URLs against the FastAPI route definitions, checks `Content-Type` header presence on all mutating requests, and confirms all 10 functions are exported.

---

## Route Verification

### Stats router (`src/app/routes/stats.py`, prefix: `/stats`)

| Client function | URL formed | FastAPI route | Match |
|---|---|---|---|
| `fetchPlayerStats(playerName)` | `GET /stats/players/${playerName}` | `GET /stats/players/{player_name}` | ✅ |
| `fetchGameStats(gameId)` | `GET /stats/games/${gameId}` | `GET /stats/games/{game_id}` | ✅ |
| `fetchLeaderboard()` | `GET /stats/leaderboard` | `GET /stats/leaderboard` | ✅ |

### Hands router (`src/app/routes/hands.py`, prefix: `/games`)

| Client function | URL formed | FastAPI route | Match |
|---|---|---|---|
| `updateHolecards(gameId, handNumber, playerName, data)` | `PATCH /games/${gameId}/hands/${handNumber}/players/${playerName}` | `PATCH /games/{game_id}/hands/{hand_number}/players/{player_name}` | ✅ |
| `updateCommunityCards(gameId, handNumber, data)` | `PATCH /games/${gameId}/hands/${handNumber}` | `PATCH /games/{game_id}/hands/{hand_number}` | ✅ |

All 5 previously-broken routes now correctly resolve to their FastAPI endpoints.

---

## Content-Type Header Audit

All POST and PATCH functions in scope:

| Function | Method | `Content-Type: application/json` |
|---|---|---|
| `createSession` | POST | ✅ present |
| `createPlayer` | POST | ✅ present |
| `createHand` | POST | ✅ present |
| `updateHolecards` | PATCH | ✅ present |
| `updateCommunityCards` | PATCH | ✅ present |

No mutation function is missing the header.

---

## Export Count

Functions exported from `client.js`:

1. `fetchSessions` ✅
2. `fetchHands` ✅
3. `fetchPlayerStats` ✅
4. `fetchGameStats` ✅
5. `fetchLeaderboard` ✅
6. `createSession` ✅
7. `createPlayer` ✅
8. `createHand` ✅
9. `updateHolecards` ✅
10. `updateCommunityCards` ✅

All 10 functions are exported. Count confirmed.

---

## Findings

### MEDIUM

#### M-1: Missing `encodeURIComponent` for `playerName` URL parameter

**Location:** `frontend/src/api/client.js` lines 20 and 56

**Description:** Both `fetchPlayerStats` and `updateHolecards` interpolate `playerName` directly into the URL path using template literals without encoding:

```js
// line 20
return request(`/stats/players/${playerName}`);

// line 56
return request(`/games/${gameId}/hands/${handNumber}/players/${playerName}`, { ... });
```

Player names containing spaces (e.g., `"John Doe"`) will produce an invalid URL (`/stats/players/John Doe`). Names containing `/` will split path segments and route to a different endpoint entirely (e.g., `"al/ice"` → `/stats/players/al/ice` → 404 or wrong route match). Names with `?` or `#` will silently truncate the URL. The fix is to wrap the parameter: `` `/stats/players/${encodeURIComponent(playerName)}` ``.

**Risk:** Incorrect routing for any player whose name contains non-alphanumeric characters. FastAPI's path routing on the server side does not compensate for a malformed client URL.

---

### LOW

#### L-1: `BASE_URL` not normalized — trailing slash causes double-slash paths

**Location:** `frontend/src/api/client.js` line 1

**Description:**

```js
const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
```

If `VITE_API_BASE_URL` is set with a trailing slash (e.g., `http://api.example.com/`), every request will have a double slash (e.g., `http://api.example.com//games`). FastAPI does not redirect these by default. The fix is:

```js
const BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');
```

---

#### L-2: `response.json()` called unconditionally on success path

**Location:** `frontend/src/api/client.js` lines 3–10

**Description:**

```js
return response.json();
```

If the server returns a 200-range response with no body or a non-JSON content type, `response.json()` throws a `SyntaxError` that surfaces as an opaque parse failure rather than a meaningful error. Currently no FastAPI route returns a non-JSON 2xx response so this is not an active defect, but it would silently break if a `204 No Content` response were ever introduced. Low risk at present.

---

## AC Mapping

This review is scoped to the fix committed in 6797056 (correcting the 5 broken routes from aia-core-4av). All targeted acceptance criteria are satisfied:

| Criterion | Status |
|---|---|
| `fetchPlayerStats` calls `GET /stats/players/{name}` | ✅ Satisfied |
| `fetchGameStats` calls `GET /stats/games/{id}` | ✅ Satisfied |
| `fetchLeaderboard` calls `GET /stats/leaderboard` | ✅ Satisfied |
| `updateHolecards` calls `PATCH /games/{id}/hands/{num}/players/{name}` | ✅ Satisfied |
| `updateCommunityCards` calls `PATCH /games/{id}/hands/{num}` | ✅ Satisfied |
| All mutating requests include `Content-Type: application/json` | ✅ Satisfied |
| All 10 functions exported | ✅ Satisfied |
| Build passes | ✅ Confirmed (commit 6797056) |

---

## Summary

The CRITICAL routing defects from the previous cycle are fully resolved. No new CRITICAL or HIGH findings were introduced by the fix. Two low-severity quality issues exist in the pre-existing `request()` helper (not introduced by this commit). One medium-severity input-encoding gap (`encodeURIComponent`) exists for player-name parameters.

---

## Findings Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 1 |
| LOW | 2 |
