# Code Review Report — aia-core (Cycle 4)

**Date:** 2026-04-07
**Target:** `frontend/src/dealer/GameCreateForm.jsx`, `frontend/src/dealer/DealerApp.jsx`
**Reviewer:** Scott (automated)
**Cycle:** 4
**Epic:** Dealer Interface (aia-frontend-002 / dealer-interface-003)

**Task:** T-004 — Build Game Creation form component
**Beads ID:** aia-core-egy

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 2 |
| LOW | 2 |
| **Total Findings** | **4** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | Date input defaults to today's date | SATISFIED | `GameCreateForm.jsx` L13: `useState(todayStr)` uses lazy initializer calling `todayStr()` which returns `YYYY-MM-DD` for today | Correct use of lazy state initializer |
| 2 | Players are fetched and displayed as tappable chips | SATISFIED | `GameCreateForm.jsx` L22-26: `useEffect` fetches via `fetchPlayers()`; L74-87: renders `<button>` elements with chip styling and `onClick` toggle | API contract matches backend `PlayerResponse` shape (`player_id`, `name`) |
| 3 | "Create Game" is disabled with <2 players selected | SATISFIED | `GameCreateForm.jsx` L53: `canSubmit = selected.size >= 2 && !submitting`; L89-93: `disabled={!canSubmit}` with visual disabled styling | Also disabled during submission — good |
| 4 | Successful creation navigates to the Hand Dashboard with the game context | SATISFIED | `GameCreateForm.jsx` L45: `onGameCreated(result.game_id, result.player_names, result.game_date)`; `DealerApp.jsx` L7-8: sets `game` state; L18-22: renders Hand Dashboard placeholder when `game` is truthy | Navigation is state-driven via prop callback — correct Preact pattern |
| 5 | API errors display an inline error message | SATISFIED | `GameCreateForm.jsx` L46: `catch (err) { setError(err.message) }`; L88: `{error && <p style={styles.error}>{error}</p>}` renders inline styled error | Also handles player fetch errors (L24) |

---

## Findings

### [MEDIUM] No empty-state message when player list is empty

**File:** `frontend/src/dealer/GameCreateForm.jsx`
**Line(s):** 72-87
**Category:** correctness

**Problem:**
When `fetchPlayers()` succeeds but returns an empty array, the chip container renders nothing and the "Loading players…" message is gone. The user sees an empty fieldset with no explanation and cannot create a game (since 0 < 2 players). There is no path to unblock themselves.

**Code:**
```jsx
{loading && <p>Loading players…</p>}
<div style={styles.chipContainer}>
  {players.map(p => { /* ... */ })}
</div>
```

**Suggested Fix:**
Add an empty-state message after the loading check:
```jsx
{loading && <p>Loading players…</p>}
{!loading && players.length === 0 && !error && (
  <p>No players found. Create players before starting a game.</p>
)}
```

**Impact:** Users on a fresh system with no players will see a blank form with no guidance.

---

### [MEDIUM] Missing `aria-pressed` on player chip toggle buttons

**File:** `frontend/src/dealer/GameCreateForm.jsx`
**Line(s):** 77-86
**Category:** design (accessibility)

**Problem:**
Player chip buttons toggle between selected/unselected states but do not communicate this state to assistive technologies. The `aria-pressed` attribute is missing.

**Code:**
```jsx
<button
  key={p.player_id}
  type="button"
  onClick={() => togglePlayer(p.name)}
  style={{ ...styles.chip, ...(active ? styles.chipActive : {}) }}
>
```

**Suggested Fix:**
Add `aria-pressed={active}` to each chip button:
```jsx
<button
  key={p.player_id}
  type="button"
  aria-pressed={active}
  onClick={() => togglePlayer(p.name)}
  // ...
>
```

**Impact:** Reduced accessibility for screen reader users and potential WCAG 4.1.2 non-compliance.

---

### [LOW] Inconsistent `h` import across dealer components

**File:** `frontend/src/dealer/GameCreateForm.jsx`
**Line(s):** 1
**Category:** convention

**Problem:**
`GameCreateForm.jsx` explicitly imports `h` from `preact`, while `DealerApp.jsx` does not. With `@preact/preset-vite` (configured in `vite.config.js`), the automatic JSX runtime injects `h` during build — making the explicit import unnecessary and the two files inconsistent.

**Code:**
```jsx
// GameCreateForm.jsx L1
import { h } from 'preact';

// DealerApp.jsx — no h import (correct with automatic runtime)
import { useState } from 'preact/hooks';
```

**Suggested Fix:**
Remove the `h` import from `GameCreateForm.jsx` to match `DealerApp.jsx` and rely on the automatic runtime.

**Impact:** Cosmetic inconsistency; no runtime effect.

---

### [LOW] No AbortController cleanup in useEffect fetch

**File:** `frontend/src/dealer/GameCreateForm.jsx`
**Line(s):** 22-26
**Category:** correctness

**Problem:**
The `useEffect` that fetches players does not return a cleanup function with an `AbortController`. If the component unmounts before the fetch completes, `setPlayers` / `setError` / `setLoading` will be called on an unmounted component. Preact tolerates this without crashing, but it's a minor leak and deviation from best practice.

**Code:**
```jsx
useEffect(() => {
  fetchPlayers()
    .then(data => setPlayers(data))
    .catch(err => setError(err.message))
    .finally(() => setLoading(false));
}, []);
```

**Suggested Fix:**
```jsx
useEffect(() => {
  const controller = new AbortController();
  fetchPlayers({ signal: controller.signal })
    .then(data => setPlayers(data))
    .catch(err => { if (!controller.signal.aborted) setError(err.message); })
    .finally(() => { if (!controller.signal.aborted) setLoading(false); });
  return () => controller.abort();
}, []);
```
Note: this requires `fetchPlayers` to accept and forward an `options` / `signal` parameter.

**Impact:** Minor — no crash, but violates React/Preact lifecycle best practices.

---

## Positives

- **Clean state management** — The `Set`-based player selection with functional `setSelected` updates is idiomatic and avoids stale closure bugs.
- **Correct lazy initializer** — `useState(todayStr)` passes a function reference, avoiding re-computing the date string on every render.
- **Good API contract alignment** — `createSession` payload (`game_date`, `player_names`) matches `GameSessionCreate` exactly; response destructuring (`game_id`, `player_names`, `game_date`) matches `GameSessionResponse`.
- **XSS-safe** — All dynamic content (`p.name`, `error`) is rendered as text nodes via JSX; no `dangerouslySetInnerHTML` usage anywhere.
- **Dual error handling** — Both the player fetch and the form submission have independent error handling with user-visible feedback.
- **Proper disabled UX** — Submit button is visually and functionally disabled when fewer than 2 players are selected or during submission, preventing double-submits.
- **Mobile-friendly styling** — `width: 100%` on inputs and submit button, `flexWrap: wrap` on chip container, `maxWidth: 480px` centered form, and touch-friendly `padding: 8px 16px` chip sizes all support mobile use.

---

## Overall Assessment

The implementation is solid and all five acceptance criteria are **SATISFIED**. The code follows Preact conventions correctly, integrates cleanly with the existing API client (`client.js`), and handles error states well. The two MEDIUM findings (empty-state UX and `aria-pressed`) are quality improvements rather than correctness bugs. No security issues found — JSX auto-escaping protects against XSS, and all API calls go through the centralized `request()` helper with proper `Content-Type` headers.

**Verdict:** No critical or high-severity issues. Ready for merge after addressing the MEDIUM findings in a follow-up task if desired.
