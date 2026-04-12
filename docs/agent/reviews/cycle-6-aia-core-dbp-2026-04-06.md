# Code Review Report — cycle-6 — aia-core-dbp

**Date:** 2026-04-06
**Cycle:** 6
**Task:** aia-core-dbp — Implement API client module
**Reviewer:** Scott
**Target file:** `frontend/src/api/client.js`
**Commit:** 66fc71f

---

## Summary

The module exports all 10 required functions and correctly includes `Content-Type: application/json` on all mutating requests. The internal `request()` helper is clean and the base URL pattern using `import.meta.env` is appropriate for Vite.

However, **five of the ten functions have incorrect URLs or HTTP methods** that will cause runtime failures (404s or 422s). The routes were built against a URL schema that does not exist in the FastAPI backend.

---

## Acceptance Criteria Mapping

| AC | Criterion | Status |
|---|---|---|
| AC1 | `fetchSessions` exported, correct route | ✅ PASS |
| AC2 | `fetchHands(sessionId)` exported, correct route | ✅ PASS |
| AC3 | `fetchPlayerStats(sessionId)` exported, correct route | ❌ FAIL |
| AC4 | `fetchGameStats(sessionId)` exported, correct route | ❌ FAIL |
| AC5 | `fetchLeaderboard` exported, correct route | ❌ FAIL |
| AC6 | `createSession(data)` exported, correct route | ✅ PASS |
| AC7 | `createPlayer(data)` exported, correct route | ✅ PASS |
| AC8 | `createHand(sessionId, data)` exported, correct route | ✅ PASS |
| AC9 | `updateHolecards(handId, data)` exported, correct route | ❌ FAIL |
| AC10 | `updateCommunityCards(handId, data)` exported, correct route | ❌ FAIL |
| AC11 | POST/PUT requests include `Content-Type: application/json` | ✅ PASS |
| AC12 | Throws on non-2xx | ✅ PASS |

---

## Findings

### CRITICAL

#### [C-1] `fetchPlayerStats` — wrong URL structure and wrong parameter semantics
**File:** `frontend/src/api/client.js` line 18
**Client calls:** `GET /games/${sessionId}/stats/players`
**Actual route:** `GET /stats/players/{player_name}` (router prefix `/stats`, endpoint `/players/{player_name}`)

The function signature takes `sessionId` but the backend endpoint takes a `player_name` string. There is no per-session player stats endpoint — the API provides per-player lifetime stats. The route `/games/<id>/stats/players` does not exist; every call will return 404.

**Fix:** Change signature to `fetchPlayerStats(playerName)` and URL to `/stats/players/${playerName}`.

---

#### [C-2] `fetchGameStats` — wrong URL
**File:** `frontend/src/api/client.js` line 22
**Client calls:** `GET /games/${sessionId}/stats/game`
**Actual route:** `GET /stats/games/{game_id}` (router prefix `/stats`, endpoint `/games/{game_id}`)

The path segments are in the wrong order. Every call will return 404.

**Fix:** Change URL to `/stats/games/${sessionId}`.

---

#### [C-3] `fetchLeaderboard` — missing `/stats` prefix
**File:** `frontend/src/api/client.js` line 26
**Client calls:** `GET /leaderboard`
**Actual route:** `GET /stats/leaderboard`

Every call will return 404.

**Fix:** Change URL to `/stats/leaderboard`.

---

#### [C-4] `updateHolecards` — wrong HTTP method, wrong URL, missing parameters
**File:** `frontend/src/api/client.js` lines 54–59
**Client calls:** `PUT /hands/${handId}/hole-cards`
**Actual route:** `PATCH /games/{game_id}/hands/{hand_number}/players/{player_name}`

Three separate problems:
1. HTTP method is `PUT`; server expects `PATCH` (will return 405).
2. The URL path `/hands/{handId}/hole-cards` does not exist at all.
3. The function takes only `handId`, but the actual endpoint requires `game_id`, `hand_number`, and `player_name` — the `hand_id` integer alone is insufficient to address this resource.

**Fix:** Change signature to `updateHolecards(gameId, handNumber, playerName, data)`, method to `PATCH`, and URL to `/games/${gameId}/hands/${handNumber}/players/${playerName}`.

---

#### [C-5] `updateCommunityCards` — wrong HTTP method, wrong URL, missing parameters
**File:** `frontend/src/api/client.js` lines 61–66
**Client calls:** `PUT /hands/${handId}/community-cards`
**Actual route:** `PATCH /games/{game_id}/hands/{hand_number}`

Two separate problems:
1. HTTP method is `PUT`; server expects `PATCH` (will return 405).
2. The URL path `/hands/{handId}/community-cards` does not exist; the actual path is `/games/{game_id}/hands/{hand_number}`.
3. The function takes only `handId`, but the actual endpoint requires `game_id` and `hand_number`.

**Fix:** Change signature to `updateCommunityCards(gameId, handNumber, data)`, method to `PATCH`, and URL to `/games/${gameId}/hands/${handNumber}`.

---

### MEDIUM

#### [M-1] Error handler exposes raw server response body
**File:** `frontend/src/api/client.js` line 6
```js
throw new Error(`HTTP ${response.status}: ${text}`);
```
`text` is the raw FastAPI response body, which on 422/500 errors includes Pydantic validation details and potentially stack traces. This is visible in the browser console and in any UI component that renders the error message. Not a server-side exposure, but it leaks internal API structure to end users.

**Fix:** Log `text` to `console.error` for debugging and throw a generic user-facing message, or truncate/sanitise before including in the thrown error.

---

### LOW

#### [L-1] No async/await — functions return bare Promises
**File:** `frontend/src/api/client.js` lines 11–66
All exported functions implicitly return the Promise from `request()`. The internal `request` function uses `await` correctly, but the exported wrappers are not declared `async`. This is functionally correct but inconsistent with the naming convention (`async function request`) and can be surprising when callers expect an async function.

**Fix (optional):** Either add `async` to each exported function declaration for consistency, or document that they return Promises.

---

## Route Reference Table

| Function | Client URL | Correct URL | Method | Status |
|---|---|---|---|---|
| `fetchSessions` | `GET /games` | `GET /games` | GET | ✅ |
| `fetchHands` | `GET /games/${id}/hands` | `GET /games/${id}/hands` | GET | ✅ |
| `fetchPlayerStats` | `GET /games/${id}/stats/players` | `GET /stats/players/${playerName}` | GET | ❌ |
| `fetchGameStats` | `GET /games/${id}/stats/game` | `GET /stats/games/${id}` | GET | ❌ |
| `fetchLeaderboard` | `GET /leaderboard` | `GET /stats/leaderboard` | GET | ❌ |
| `createSession` | `POST /games` | `POST /games` | POST | ✅ |
| `createPlayer` | `POST /players` | `POST /players` | POST | ✅ |
| `createHand` | `POST /games/${id}/hands` | `POST /games/${id}/hands` | POST | ✅ |
| `updateHolecards` | `PUT /hands/${id}/hole-cards` | `PATCH /games/${gId}/hands/${hNum}/players/${name}` | PATCH | ❌ |
| `updateCommunityCards` | `PUT /hands/${id}/community-cards` | `PATCH /games/${gId}/hands/${hNum}` | PATCH | ❌ |

---

## Verdict

**NOT CLEAN — 5 CRITICAL findings.** The module cannot be merged until C-1 through C-5 are resolved. Five of ten functions will fail at runtime with 404 or 405 responses. The function signatures for `updateHolecards` and `updateCommunityCards` also need breaking changes to carry the required path parameters.

`FINDINGS SUMMARY: C:5 H:0 M:1 L:1`
