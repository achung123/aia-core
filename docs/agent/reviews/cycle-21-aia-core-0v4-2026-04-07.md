# Code Review Report — aia-core

**Date:** 2026-04-07
**Target:** `frontend/src/components/sessionForm.js`
**Reviewer:** Scott (automated)

**Task:** Build data interface: session creation form
**Beads ID:** aia-core-0v4

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
| 1 | Date picker defaults to today in correct backend format | SATISFIED | Lines 24–29: `new Date()` → local `getFullYear/getMonth/getDate` → `YYYY-MM-DD` string assigned to `dateInput.value` at construction | Format matches backend expectation |
| 2 | Multi-select of registered players | SATISFIED | Lines 37–40: `playerSelect.multiple = true`; `fetchPlayers()` populates options on mount (lines 63–84) | Loading and error states handled |
| 3 | Submit calls `createSession()` and `onSessionCreated(newSession)` callback; form resets | SATISFIED | Lines 97–105: `createSession()` awaited, `form.reset()` called, `onSessionCreated(newSession)` invoked inside `try` block | Order is correct; callback receives the API response |
| 4 | Duplicate date errors shown inline | SATISFIED | Lines 107–112: 409 detected via `err.message.startsWith('HTTP 409')`, friendly string written to `inlineError.textContent` | See LOW-1 for coupling fragility |
| 5 | Form resets after successful submission | SATISFIED | Lines 103–104: `form.reset()` followed by explicit re-assignment of date input | See MEDIUM-1 for stale-date edge case in re-assignment |

---

## Findings

### [MEDIUM] Stale date used for post-submit reset

**File:** `frontend/src/components/sessionForm.js`
**Line(s):** 24–26 (capture) → 104 (usage)
**Category:** correctness

**Problem:**
`yyyy`, `mm`, and `dd` are computed once from `new Date()` when `createSessionForm()` is called — at component mount time. They are then closed over inside the `submit` event handler and reused to restore the date field after a successful submission. If the page has been open across midnight, the post-submit reset will write the previous day's date, not today's date.

**Code:**
```js
// Lines 24–26 — computed once at construction
const yyyy = today.getFullYear();
const mm   = String(today.getMonth() + 1).padStart(2, '0');
const dd   = String(today.getDate()).padStart(2, '0');

// Line 104 — reused in submit handler; stale after midnight
dateInput.value = `${yyyy}-${mm}-${dd}`;
```

**Suggested Fix:**
Compute `YYYY-MM-DD` inline inside the submit handler at reset time:
```js
const todayStr = (() => {
  const t  = new Date();
  const y  = t.getFullYear();
  const mo = String(t.getMonth() + 1).padStart(2, '0');
  const d  = String(t.getDate()).padStart(2, '0');
  return `${y}-${mo}-${d}`;
})();
dateInput.value = todayStr;
```
Or extract a shared `todayISO()` helper in the module.

**Impact:** After midnight, the date field resets to the prior day. The user may not notice and submit a session under yesterday's date without the backend catching it (if the date is not a duplicate).

---

### [LOW] 409 detection string-coupled to `client.js` error format

**File:** `frontend/src/components/sessionForm.js`
**Line(s):** 107–109
**Category:** design

**Problem:**
The 409 check depends on the error message starting with the literal string `'HTTP 409'`, which matches the format `HTTP ${response.status}: ${text}` produced by `client.js`. This is an implicit contract between two files with no test that enforces it. If `client.js` changes its error format (e.g., to `Error 409` or a structured object), the `startsWith` check silently falls through to the raw `err.message` path — and the user sees a JSON blob or stack trace instead of the friendly duplicate-date message.

Additionally, for non-409 errors the raw server response body is passed directly to `inlineError.textContent`. While `textContent` is safe from XSS, it can expose server internals (validation details, stack traces) to the user.

**Code:**
```js
const message =
  err.message && err.message.startsWith('HTTP 409')
    ? 'A session for this date already exists'
    : err.message;   // raw server body surfaced to user on all other errors
inlineError.textContent = message;
```

**Suggested Fix:**
Attach a typed `statusCode` property in `client.js`:
```js
const err = new Error(`HTTP ${response.status}: ${text}`);
err.statusCode = response.status;
throw err;
```
Then check `err.statusCode === 409` in `sessionForm.js`. For other errors, use a generic fallback message (`'An unexpected error occurred. Please try again.'`) rather than the raw server body.

**Impact:** Friendly duplicate-date UX silently breaks on any `client.js` refactor. Raw server errors may confuse or alarm users.

---

### [LOW] No submit guard during `fetchPlayers()` in-flight

**File:** `frontend/src/components/sessionForm.js`
**Line(s):** 63–84 (fetch), 87–117 (submit handler)
**Category:** correctness

**Problem:**
`fetchPlayers()` is called immediately on mount. The submit button is not disabled during this async operation. If the user submits the form before `fetchPlayers()` resolves (slow network, cold backend), `playerSelect.selectedOptions` will be empty — `loadingOption` is `disabled` and cannot be selected — and the API will be called with `player_names: []`. The backend is the only guard against a playerless session.

**Code:**
```js
// Mount — fetch starts immediately, no guard on submit
fetchPlayers().then(players => { … }).catch(…);

// Submit — no check for in-flight fetch
const selectedNames = Array.from(playerSelect.selectedOptions).map(opt => opt.value);
// selectedNames === [] if players not yet loaded
await createSession({ game_date: dateInput.value, player_names: selectedNames });
```

**Suggested Fix:**
Disable the submit button until `fetchPlayers()` settles:
```js
submitBtn.disabled = true;
fetchPlayers()
  .then(players => { /* populate */ })
  .catch(err   => { /* show error */ })
  .finally(()  => { submitBtn.disabled = false; });
```

**Impact:** A session could be created with no players if the network is slow. Whether the backend rejects this depends on its validation logic; if it allows it, orphan sessions can be created silently.

---

## Positives

- **Full DOM API discipline** — zero uses of `innerHTML`, `outerHTML`, or `insertAdjacentHTML`. Every node built via `createElement` / `textContent`. XSS surface is non-existent.
- **Double-submit guard is airtight** — `submitBtn.disabled = true` is set before the `try` block, and `submitBtn.disabled = false` is in `finally {}`, guaranteeing restoration on every path (success, 409 error, network error, unexpected throw).
- **Loading and error states handled for `fetchPlayers()`** — both the happy path and the `.catch()` branch call `removeChild(loadingOption)` and show appropriate UI feedback.
- **`dispose()` pattern** — clean teardown hook prevents DOM leaks when the component is unmounted.
- **Correct `form.reset()` sequencing** — `form.reset()` is called before `onSessionCreated(newSession)`, preventing stale form state from being visible to the callback.

---

## Overall Assessment

All 5 acceptance criteria are satisfied. The implementation is XSS-clean, the double-submit guard is correctly placed in `finally`, and the component lifecycle is handled cleanly. No CRITICAL or HIGH issues were found.

The MEDIUM finding (stale date after midnight) is a real but rare edge case in the post-submit reset logic and should be fixed before this component enters long-lived production use. The two LOW findings are brittleness concerns (string-coupled 409 detection, unguarded submit during player fetch) that are low-risk given current backend behavior but worth hardening.

FINDINGS SUMMARY: C:0 H:0 M:1 L:2
