# Code Review Report — Cycle 10

**Task:** aia-core-bpn — Build session list panel and session loading flow  
**Jean Task:** T-009 (aia-frontend-002)  
**Stories:** S-3.1, S-3.2  
**Reviewer:** Scott  
**Date:** 2026-04-06  
**Cycle:** 10  
**Commit:** 995fbf2

---

## Files Reviewed

- [frontend/src/views/playbackView.js](../../frontend/src/views/playbackView.js)
- [frontend/src/scenes/tableGeometry.js](../../frontend/src/scenes/tableGeometry.js) (dependency context)
- [frontend/src/api/client.js](../../frontend/src/api/client.js) (error message origin)
- [src/app/routes/games.py](../../src/app/routes/games.py) (API shape)
- [src/pydantic_models/app_models.py](../../src/pydantic_models/app_models.py) (`GameSessionListItem` shape)
- [specs/aia-frontend-002/tasks.md](../../specs/aia-frontend-002/tasks.md) (acceptance criteria)

---

## Acceptance Criteria Coverage

| # | Criterion | Status | Finding |
|---|---|---|---|
| AC1 | `fetchSessions()` called on mount; results in left-side panel | ✅ COVERED | `renderPlaybackView` → `loadSessionList()` → `fetchSessions()` |
| AC2 | Each row shows date, hand count, player count | ❌ BROKEN | Uses `(s.players\|\|[]).length`; API returns `player_count` (integer). Always 0. See H-1 |
| AC3 | Loading spinner overlays scene while hands fetch | ✅ COVERED | `spinner.style.display='block'` before `fetchHands`, hidden after |
| AC4 | On error, red banner shown; spinner removed | ✅ COVERED | `errorBanner.textContent = ...` + `spinner.style.display='none'` in catch (hands path) |
| AC5 | `table.loadSession(playerNames)` called; scrubber initialized | ❌ NOT MET | Neither call is made. `window.__onSessionLoaded` stub used instead. See C-1 |

---

## Findings

### CRITICAL

#### C-1 — AC5: `table.loadSession(playerNames)` not called; scrubber not initialized

**File:** [frontend/src/views/playbackView.js](../../frontend/src/views/playbackView.js#L72-L76)  
**Lines:** 72–76

```js
// Initialize scene seat labels (dummy — real scene integration done in T-011+)
console.log('Session loaded:', session.game_id, 'players:', playerNames, 'hands:', hands.length);

// Signal session loaded — stub for T-010 scrubber integration
if (window.__onSessionLoaded) {
  window.__onSessionLoaded({ session, hands, playerNames });
}
```

AC5 explicitly requires: _"On success, `table.loadSession(playerNames)` is called and the session scrubber is initialized with the hand count."_

The implementation substitutes a `window.__onSessionLoaded` stub and defers both obligations to future tasks. `loadSession` _is_ imported from `tableGeometry.js` (line 2) but is never invoked. No scrubber is referenced or initialized.

The beads task description itself restates this: _"On success: table.loadSession(playerNames) called and session scrubber initialized."_ Deferring to T-010 integration is not a valid substitute for T-009's own AC.

**Suggested fix:** Acquire scene context (labels array) within `renderPlaybackView` by initialising the scene inline or accepting it as a parameter. Call `loadSession(labels, playerNames)` after a successful `fetchHands`. Signal scrubber initialization with the hand count. The `window.__onSessionLoaded` stub is acceptable in _addition_, but not as a replacement.

---

### HIGH

#### H-1 — AC2 Bug: wrong field name; player count always 0

**File:** [frontend/src/views/playbackView.js](../../frontend/src/views/playbackView.js#L39)  
**Line:** 39

```js
<div style="font-size:11px;color:#999;">${s.hand_count ?? '?'} hands · ${(s.players || []).length} players</div>
```

`GameSessionListItem` (confirmed in `src/pydantic_models/app_models.py` line 220) exposes `player_count: int`, not a `players` array. The expression `(s.players || []).length` evaluates to `0` for every session because `s.players` is always `undefined`. AC2 is satisfied for date and hand count, but player count is permanently broken.

**Suggested fix:**
```js
${s.player_count ?? '?'} players
```

---

#### H-2 — XSS: `err.message` injected via `innerHTML` in session list error handler

**File:** [frontend/src/views/playbackView.js](../../frontend/src/views/playbackView.js#L47)  
**Line:** 47

```js
list.innerHTML = `<p style="color:#f55;">Error: ${err.message}</p>`;
```

`err.message` from `client.js` is constructed as:

```js
throw new Error(`HTTP ${response.status}: ${text}`);
```

where `text = await response.text()` is the **raw server response body**. If the server (or a man-in-the-middle) returns a response body containing `<script>` or event-handler attributes, this code will execute it via `innerHTML`. This is a reflected-server-response XSS vector.

The hands-loading error handler at line 66 correctly avoids this with `errorBanner.textContent`. The session list error handler must follow the same pattern.

**Suggested fix:**
```js
const p = document.createElement('p');
p.style.color = '#f55';
p.textContent = `Error: ${err.message}`;
list.innerHTML = '';
list.appendChild(p);
```

---

#### H-3 — XSS: API-sourced string fields interpolated via `innerHTML` in session row

**File:** [frontend/src/views/playbackView.js](../../frontend/src/views/playbackView.js#L35-L40)  
**Lines:** 35–40

```js
row.innerHTML = `
  <div style="font-weight:600;">${s.game_date || s.date || 'Unknown date'}</div>
  <div style="font-size:11px;color:#999;">${s.hand_count ?? '?'} hands · ${(s.players || []).length} players</div>
`;
```

`s.game_date` and `s.date` are API-supplied strings. If a session's `game_date` contains HTML (e.g., a malformed or compromised API payload), it will be rendered as markup. The numeric fields (`hand_count`, `player_count`) are lower risk but still untreated.

The row is built with `document.createElement('div')` which is safe—the issue is exclusively the `row.innerHTML` assignment.

**Suggested fix:** Build each cell with `textContent`:
```js
const dateDiv = document.createElement('div');
dateDiv.style.fontWeight = '600';
dateDiv.textContent = s.game_date || s.date || 'Unknown date';

const metaDiv = document.createElement('div');
metaDiv.style.cssText = 'font-size:11px;color:#999;';
metaDiv.textContent = `${s.hand_count ?? '?'} hands · ${s.player_count ?? '?'} players`;

row.appendChild(dateDiv);
row.appendChild(metaDiv);
```

---

### MEDIUM

#### M-1 — Race condition: no AbortController on concurrent session clicks

**File:** [frontend/src/views/playbackView.js](../../frontend/src/views/playbackView.js#L51-L81)  
**Lines:** 51–81

`loadSession_` is invoked directly by click event listeners with no guard. If a user clicks session A then immediately clicks session B, both `fetchHands` calls are in flight simultaneously. Whichever resolves last will determine the final state, which may be session A even though session B was clicked most recently. The spinner will also be hidden after the first resolution, misrepresenting loading state.

**Suggested fix:** Track an `AbortController` (or a monotonic counter) and abort/ignore stale fetches:

```js
let currentFetchId = 0;

async function loadSession_(session) {
  const myId = ++currentFetchId;
  spinner.style.display = 'block';
  errorBanner.style.display = 'none';
  try {
    const hands = await fetchHands(session.game_id);
    if (myId !== currentFetchId) return; // stale
    spinner.style.display = 'none';
    // ... rest of success path
  } catch (err) {
    if (myId !== currentFetchId) return;
    spinner.style.display = 'none';
    errorBanner.textContent = `Failed to load session: ${err.message}`;
    errorBanner.style.display = 'block';
  }
}
```

---

### LOW

#### L-1 — All four imported tableGeometry functions are unused

**File:** [frontend/src/views/playbackView.js](../../frontend/src/views/playbackView.js#L2)  
**Line:** 2

```js
import { loadSession, createSeatLabels, computeSeatPositions, updateSeatLabelPositions } from '../scenes/tableGeometry.js';
```

None of the four symbols are referenced anywhere in the module body. `loadSession` is the function required by AC5 but is never called; the other three are purely dead imports. Bundlers will tree-shake them, but the import line is misleading static noise and will likely cause a linter warning.

**Suggested fix:** Remove the import line until AC5 is properly implemented; re-add just the symbols actually used when AC5 is resolved.

---

#### L-2 — Session list fetch error does not use the `#error-banner` element

**File:** [frontend/src/views/playbackView.js](../../frontend/src/views/playbackView.js#L46-L48)  
**Lines:** 46–48

```js
} catch (err) {
  list.innerHTML = `<p style="color:#f55;">Error: ${err.message}</p>`;
}
```

AC4's phrasing ("on error, a red banner is shown") technically targets the hands-loading flow (since it mentions the spinner being removed), and the `fetchSessions` error renders an inline message in the sidebar panel. This is a UX inconsistency rather than an AC violation: the `#error-banner` overlay element goes unused for the session-list error path while the hands-loading error path correctly uses it. Standardizing both error paths to use the banner (or an explicit panel-error element) would improve predictability.

---

## Summary

| Severity | Count | Items |
|---|---|---|
| CRITICAL | 1 | C-1: AC5 not implemented (`table.loadSession`, scrubber both absent) |
| HIGH | 3 | H-1: player count always 0 (wrong field), H-2: XSS via innerHTML in list error, H-3: XSS via innerHTML in row template |
| MEDIUM | 1 | M-1: race condition on rapid session clicks |
| LOW | 2 | L-1: four unused imports, L-2: session-list error bypasses `#error-banner` |

**The CRITICAL finding (C-1) blocks a clean bill of health. No commit issued.**

---

FINDINGS SUMMARY: C:1 H:3 M:1 L:2
