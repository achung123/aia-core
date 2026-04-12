# Code Review Report — cycle-24 · aia-core-vj6 · 2026-04-07

## Task
**aia-core-vj6** — Build data interface: hand edit/correction form

**File reviewed:** `frontend/src/components/handEditForm.js`
**Supporting files read:** `frontend/src/api/client.js`, `frontend/src/components/handRecordForm.js`, `src/pydantic_models/app_models.py`, `src/app/routes/hands.py`

---

## Acceptance Criteria Coverage

| # | Acceptance Criterion | Status |
|---|---|---|
| AC1 | Edit form pre-populated with current hand values | ✅ PASS |
| AC2 | Card/result validation (same rules as recording form) | ✅ PASS |
| AC3 | PATCH community cards and hole cards only for changed fields | ⚠️ PARTIAL — cards checked correctly; `result`/`profit_loss` appear editable but are silently discarded |
| AC4 | Cancel exits without API call | ✅ PASS |
| AC5 | Successful save refreshes that hand row only (calls `onSave` callback) | ✅ PASS |

---

## Findings

### HIGH

---

#### H-1 · `result` and `profit_loss` edits are silently discarded — data loss on save

**File:** `frontend/src/components/handEditForm.js` — lines 362–382

**Description:**
The form renders fully interactive `<select>` (result) and `<input type="number">` (profit_loss) fields for every player row, pre-populated with the current database values. When the user edits them and clicks Save, those changes are folded into the `updatedHandData` object passed to `onSave`, but they are **never sent to the backend**. `updateHolecards` only accepts `card_1` and `card_2` (see `HoleCardsUpdate` in `app_models.py`), and there is no separate PATCH for result/profit_loss.

The consequence: the UI briefly reflects the user's change (via the `onSave` callback), but on the next data fetch the original values return. This is silent, unsalvageable data loss with no error shown to the user.

**Relevant code:**
```js
// lines ~375–382 — result/profit_loss computed but never PATCHed
const result = row.resultSelect.value || null;
const profitRaw = parseFloat(row.profitInput.value);
const profitLoss = Number.isNaN(profitRaw) ? orig.profit_loss : profitRaw;
return { ...orig, card_1: card1, card_2: card2, result, profit_loss: profitLoss };
```

**Fix options:**
a) Add a PATCH endpoint for result/profit_loss and call it when those fields change, OR
b) Make the result/profit_loss fields `readonly` and add a visible "read-only" label so users aren't misled.

---

#### H-2 · `playerName` interpolated in URL without encoding — breaks for any name containing spaces or special characters

**File:** `frontend/src/api/client.js` — lines 64–68 (called from `handEditForm.js` line ~363)

**Description:**
```js
export function updateHolecards(gameId, handNumber, playerName, data) {
  return request(`/games/${gameId}/hands/${handNumber}/players/${playerName}`, {
```

`playerName` is interpolated directly into the URL template literal without `encodeURIComponent`. A player named `"John Doe"` produces the URL path `/players/John Doe`, which is technically invalid. A name containing `/`, `?`, or `#` would corrupt the URL structure entirely.

The backend's FastAPI route — `/{game_id}/hands/{hand_number}/players/{player_name}` — correctly URL-decodes path parameters, so `encodeURIComponent` on the client side is the matching fix. This bug surfaces quietly in any project where player names have spaces (a common real-world case).

**Fix:**
```js
return request(
  `/games/${gameId}/hands/${handNumber}/players/${encodeURIComponent(playerName)}`,
  { ... }
);
```

---

### MEDIUM

---

#### M-1 · Buttons permanently disabled after a successful save when `onSave` throws

**File:** `frontend/src/components/handEditForm.js` — lines 383–388

**Description:**
After all PATCH calls succeed, `saveBtn` and `cancelBtn` are never re-enabled before the `onSave` call. The inner try/catch isolates the `onSave` error (correct), but if `onSave` throws and the error is only logged, the `dispose()` path is never taken and the form is left rendered with both buttons permanently disabled — the user cannot retry, cancel, or escape the form without a full page reload.

```js
try { onSave(updatedHandData); } catch (cbErr) { console.warn('onSave callback error:', cbErr); }
```

The outer catch (lines 389–395) re-enables buttons, but it is never reached in this scenario because the outer try succeeded.

**Fix:** Re-enable buttons after the inner `onSave` try/catch completes if the wrapper element is still in the DOM:
```js
try { onSave(updatedHandData); } catch (cbErr) {
  console.warn('onSave callback error:', cbErr);
  saveBtn.disabled = false;
  cancelBtn.disabled = false;
}
```

---

#### M-2 · `dispose()` not called automatically on successful save — DOM orphan risk

**File:** `frontend/src/components/handEditForm.js` — lines 398–403

**Description:**
`createHandEditForm` returns `{ dispose() { ... } }` to let the caller remove the wrapper element, but the form itself never calls `dispose()` after a successful save. The `onSave` callback is the only point where the caller can trigger removal. If the callback's author doesn't know to call `dispose()`, the edit form persists in the DOM alongside whatever fresh UI `onSave` renders — creating a duplicate view.

This is a leaky API contract: the responsibility of cleaning up the form should not lie entirely with an external callback.

**Fix:** Call `wrapper.parentElement?.removeChild(wrapper)` (or `dispose()`) at the end of the successful-save path, before `onSave` is invoked. Alternatively, document the contract explicitly.

---

### LOW

---

#### L-1 · Error spans lack `aria-live` — screen readers won't announce validation errors

**File:** `frontend/src/components/handEditForm.js` — lines 89–93

**Description:**
The `.card-field-error` spans are unhidden dynamically when errors are set, but they have no `aria-live="polite"` (or `role="alert"`) attribute. Screen reader users will not be notified when format or duplicate errors appear on blur or on submit.

---

#### L-2 · Player name slug collision — two players whose names differ only by special characters get identical HTML IDs

**File:** `frontend/src/components/handEditForm.js` — lines 97–98

**Description:**
```js
const slug = toFieldId(playerHand.player_name);  // /[^a-zA-Z0-9]/ → '_'
const idBase = `edit-h${handNumber}-${slug}`;
```

`"Alice!"` and `"Alice?"` both map to `"Alice_"`, producing duplicate IDs. The `<label htmlFor>` association will bind to whichever element appears first in the DOM, silently breaking label–input pairing for the second player.

---

#### L-3 · `profitInput.step = '0.01'` does not prevent overly-precise values from being serialized

**File:** `frontend/src/components/handEditForm.js` — line 147

**Description:**
HTML `step` is a browser UI hint; a user can still type `1.234567`. `parseFloat('1.234567')` succeeds and the full-precision value is sent to the backend as a float. The database schema accepts float, so no crash occurs, but the value persists with unintended precision. A `Math.round(...* 100) / 100` before serialization would align with poker's two-decimal-place convention.

---

## XSS Assessment

All dynamic DOM content is set via `.textContent`; no `innerHTML` is used anywhere in the file. IDs derived from player names are sanitized through `toFieldId` before being set as `input.id` and `label.htmlFor`. No XSS vectors detected. ✅

## Race Condition Assessment

`saveBtn.disabled = true` and `cancelBtn.disabled = true` are set synchronously before the first `await`, within the same JS task as the submit event handler. JavaScript's single-threaded event loop means no second submit event can fire between the validation check and the button-disable. No race condition. ✅

## `onSave`/`onCancel` Isolation Assessment

Both callbacks are wrapped in isolated try/catch blocks that log to console without re-throwing: `onCancel` on line 293, `onSave` on line 385. Neither can propagate into the outer error handler or corrupt form state. ✅

---

## Summary

| Severity | Count | IDs |
|---|---|---|
| CRITICAL | 0 | — |
| HIGH | 2 | H-1, H-2 |
| MEDIUM | 2 | M-1, M-2 |
| LOW | 3 | L-1, L-2, L-3 |

Three of the five acceptance criteria pass cleanly. AC3 is partially satisfied — the change-detection diffing for cards is correct, but `result`/`profit_loss` are editable in the UI and silently not persisted (H-1). The URL-encoding gap (H-2) would silently break saves for any player name with a space, which is a realistic production scenario.

```
FINDINGS SUMMARY: C:0 H:2 M:2 L:3
```
