# Code Review Report — aia-core

**Date:** 2026-04-07
**Cycle:** 14
**Target:** `frontend/src/dealer/GameCreateForm.jsx`
**Reviewer:** Scott (automated)

**Task:** T-005 — Inline player creation in Game Creation form
**Beads ID:** aia-core-cpx

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
| 1 | A text input and "Add" button appear below the player chips | SATISFIED | `GameCreateForm.jsx` L112–L125: `addPlayerRow` div containing text input (placeholder "New player name") and "Add" button rendered after `chipContainer` | Correct placement within fieldset |
| 2 | Submitting creates the player via API and adds them to the list | SATISFIED | `GameCreateForm.jsx` L41–50: `handleAddPlayer` calls `createPlayer({ name: trimmed })`, then appends returned player to local state via `setPlayers(prev => [...prev, player])` | Matches backend `PlayerCreate` schema (`{ name }`) |
| 3 | The new player is automatically selected | SATISFIED | `GameCreateForm.jsx` L49: `setSelected(prev => new Set([...prev, player.name]))` adds the new player to the selection set immediately after creation | Input is also cleared (L50) |
| 4 | Duplicate name attempts show an inline error without crashing | SATISFIED | `GameCreateForm.jsx` L51–55: catch block checks for 409 and sets friendly message; L126 renders inline error `<p>` styled in red | Backend returns 409 for case-insensitive duplicate names |

---

## Findings

### [MEDIUM] Error detection relies on string matching against error message

**File:** `frontend/src/dealer/GameCreateForm.jsx`
**Line(s):** 51
**Category:** design

**Problem:**
The 409 duplicate detection uses `err.message.includes('409')`, which is coupled to the message format produced by `client.js`'s `request()` function (`"HTTP 409: ...")`). If the error format in `request()` changes, this check would silently break and users would see the raw error message instead of the friendly duplicate warning.

**Code:**
```js
if (err.message.includes('409')) {
  setAddPlayerError('A player with that name already exists.');
}
```

**Suggested Fix:**
Attach the HTTP status code as a property on the thrown error in `client.js`:
```js
const err = new Error(`HTTP ${response.status}: ${text}`);
err.status = response.status;
throw err;
```
Then check `err.status === 409` in the component. This is outside the scope of this task but should be tracked as a follow-up.

**Impact:** If `request()` error format changes, duplicate player errors would display raw HTTP text instead of the friendly message. Low probability, moderate user impact.

---

### [LOW] No maxlength constraint on player name input

**File:** `frontend/src/dealer/GameCreateForm.jsx`
**Line(s):** 113–117
**Category:** design

**Problem:**
The text input for new player names has no `maxlength` attribute. A user could submit an arbitrarily long name. The backend `Player` model does not appear to enforce a length constraint either, so this is a defense-in-depth concern.

**Code:**
```jsx
<input
  type="text"
  placeholder="New player name"
  value={newPlayerName}
  onInput={e => { setNewPlayerName(e.target.value); setAddPlayerError(null); }}
  style={styles.addPlayerInput}
/>
```

**Suggested Fix:**
Add `maxlength={50}` (or an appropriate limit) to the input.

**Impact:** Cosmetic/layout issues with extremely long names; no security risk since the backend uses parameterized queries.

---

### [LOW] Unnecessary `e.preventDefault()` on button click handler

**File:** `frontend/src/dealer/GameCreateForm.jsx`
**Line(s):** 42
**Category:** convention

**Problem:**
`handleAddPlayer` calls `e.preventDefault()` but is invoked via `onClick` on a `type="button"` element (L119). Button clicks of `type="button"` have no default action to prevent. The call is harmless but unnecessary.

**Code:**
```js
async function handleAddPlayer(e) {
  e.preventDefault();
  // ...
}
```

**Suggested Fix:**
Remove `e.preventDefault()` or change to a no-op guard. Alternatively, keep it as defensive programming — this is purely cosmetic.

**Impact:** None — purely a code clarity concern.

---

## Positives

- **Clean state management:** All state updates use functional updaters (`prev => ...`), preventing stale-state bugs in concurrent updates.
- **Good input validation:** Empty and whitespace-only names are rejected both in the handler (`if (!trimmed) return`) and via the disabled button check.
- **Proper loading states:** `addingPlayer` flag prevents double submission and provides visual feedback ("Adding…").
- **Error auto-clear:** `setAddPlayerError(null)` in the `onInput` handler clears errors as the user types, providing responsive UX.
- **XSS safe:** No use of `dangerouslySetInnerHTML`; all user content rendered through Preact's auto-escaping JSX interpolation.
- **Consistent styling:** New UI elements (`addPlayerRow`, `addPlayerInput`, `addPlayerBtn`, `addPlayerError`) follow the existing inline styles pattern used throughout the component.

---

## Overall Assessment

The implementation is **clean, correct, and complete**. All four acceptance criteria are satisfied. No critical or high-severity issues were found. The one medium finding (string-based error detection) is a design debt item that works correctly today but should be addressed in a future refactor of the shared `request()` function. The two low findings are cosmetic.

**Verdict:** Pass — ready to ship.
