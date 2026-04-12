# Code Review Report — aia-core

**Date:** 2026-04-07
**Target:** `frontend/src/components/handRecordForm.js`
**Reviewer:** Scott (automated)

**Task:** Build data interface: hand recording form
**Beads ID:** aia-core-b0k

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 1 |
| MEDIUM | 2 |
| LOW | 2 |
| **Total Findings** | **5** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| AC1 | Form shows community card fields + per-player rows (card1, card2, result, profit_loss) | SATISFIED | `communityDefs` array lines 176–191; `createPlayerRow()` lines 101–158 | All 5 community slots (flop1–3, turn, river) and all 4 per-player fields present |
| AC2 | Card fields validate format on blur | SATISFIED | `blur` listeners lines 268–272; `validateSingleCard()` delegates to `parseCard()` | Required fields also checked for empty |
| AC3 | Duplicate card detection client-side, highlights duplicate fields | SATISFIED | `runDuplicateCheck()` lines 247–266; `setDupError()` highlights in red with "Duplicate card" | Triggered on every blur; cleared and re-run cleanly |
| AC4 | Submit: POST /games/{id}/hands, then PATCH per-player, then onSuccess() | PARTIAL | `createHand()` then `Promise.all(updateHolecards)` then `onSuccess()` — sequence correct; but see HIGH finding | PATCH failure after POST success prevents `onSuccess()` even though hand IS saved |
| AC5 | API errors shown inline | SATISFIED | `formError.textContent = err.message` (line ~358); `formError.hidden = false` | Uses `.textContent` — no XSS risk |

---

## Findings

### [HIGH] POST succeeds + PATCH fails → silent orphan and double-submit risk

**File:** `frontend/src/components/handRecordForm.js`
**Line(s):** 341–365
**Category:** correctness

**Problem:**
`createHand()` (POST) already persists the hand **including** all player card data via `player_entries`. The subsequent `Promise.all(updateHolecards)` PATCHes are therefore redundant — but if any PATCH rejects (network hiccup, 404 because player name contains a URL-reserved char, 422 validation drift), the `catch` block fires: `formError.textContent = err.message`, the button is re-enabled, and `onSuccess()` is **never called** even though the hand was fully and correctly saved to the database.

The practical consequence: the user sees an error, believes the submit failed, and clicks "Submit Hand" again. The second submission creates a **second hand** (the backend auto-increments `hand_number`). There is no idempotency guard, no form-reset, and no way to distinguish "total failure" from "POST ok, PATCH failed".

**Code:**
```javascript
try {
  const handResp = await createHand(sessionId, postBody);   // ← persists everything
  const handNumber = handResp.hand_number;

  await Promise.all(
    playerRows.map(row =>
      updateHolecards(sessionId, handNumber, row.name, {    // ← redundant; failure here
        card_1: parseCard(row.card1Input.value),            //   leaves form re-submittable
        card_2: parseCard(row.card2Input.value),
      })
    )
  );

  onSuccess();
} catch (err) {
  formError.textContent = err.message;  // ← shown even when hand IS in DB
  formError.hidden = false;
} finally {
  submitBtn.disabled = false;           // ← re-enabled unconditionally
}
```

**Suggested Fix:**
Split the try/catch into two stages. After `createHand` resolves, record `handCreated = true`. If the PATCH stage fails, call `onSuccess()` anyway (the data is saved) and log a warning, or show a non-blocking advisory instead of blocking the success flow:

```javascript
const handResp = await createHand(sessionId, postBody);
const handNumber = handResp.hand_number;
let patchError = null;
try {
  await Promise.all(playerRows.map(row =>
    updateHolecards(sessionId, handNumber, row.name, {
      card_1: parseCard(row.card1Input.value),
      card_2: parseCard(row.card2Input.value),
    })
  ));
} catch (e) {
  patchError = e;  // non-fatal — POST already saved the data
}
if (patchError) {
  console.warn('PATCH hole-cards failed (hand was saved):', patchError);
}
onSuccess();
```

**Impact:** Duplicate hands in the database when PATCH fails and user retries. Also: the UX incorrectly signals failure for a successful operation.

---

### [MEDIUM] `profit_loss` input has no min/max guard — extreme values reach the API

**File:** `frontend/src/components/handRecordForm.js`
**Line(s):** 147–153
**Category:** correctness

**Problem:**
`profitInput.type = 'number'` and `step = '0.01'` correctly prevent non-numeric text entry (satisfying the AC's "number or null" requirement), but there is no `min`/`max` attribute and no client-side range check before submission. A user can submit `profit_loss = 999999999999` or `profit_loss = -999999999999`. If the backend Pydantic model has a range constraint, the error surfaces as a generic inline API error with no field-level highlight on the profit input — the user has no visual cue about which field caused the rejection.

**Code:**
```javascript
const profitInput = document.createElement('input');
profitInput.type = 'number';
profitInput.id = `profit-${slug}`;
profitInput.step = '0.01';
profitInput.placeholder = '0.00';
// ← no min/max; no blur validation added to profitInput
```

**Suggested Fix:**
Add reasonable bounds and a blur handler:
```javascript
profitInput.min = '-100000';
profitInput.max = '100000';
profitInput.addEventListener('blur', () => {
  const v = parseFloat(profitInput.value);
  if (!Number.isNaN(v) && (v < -100000 || v > 100000)) {
    // show inline error on profitInput
  }
});
```

**Impact:** Invalid values reach the backend; resulting 422 error appears as a form-level message with no indication of which player's profit field is the problem.

---

### [MEDIUM] `toFieldId` slug collision can corrupt per-player field references

**File:** `frontend/src/components/handRecordForm.js`
**Line(s):** 18–20, 103
**Category:** correctness

**Problem:**
`toFieldId` replaces every non-alphanumeric character with `_`. Two players whose names differ only in punctuation/spaces produce identical slugs:

- `"Alice-Bob"` → `"Alice_Bob"`
- `"Alice Bob"` → `"Alice_Bob"`

All four element IDs (`card-input-Alice_Bob-card1`, `result-Alice_Bob`, `profit-Alice_Bob`, …) are duplicated in the DOM. HTML forbids duplicate `id` attributes, and `label.htmlFor` will associate with the **first** matching element, breaking keyboard accessibility for the second player's entire row.

Functional data collection is unaffected (the code stores direct DOM references, not ID-based lookups), but accessibility is broken and the HTML is invalid for any such name pair.

**Code:**
```javascript
function toFieldId(str) {
  return str.replace(/[^a-zA-Z0-9]/g, '_');  // ← "Alice Bob" and "Alice-Bob" → same slug
}
```

**Suggested Fix:**
Append an index to guarantee uniqueness:
```javascript
// In createHandRecordForm, when building player rows:
playerNames.forEach((name, idx) => {
  const row = createPlayerRow(name, idx);  // pass index
  ...
});
// In createPlayerRow:
function createPlayerRow(playerName, idx) {
  const slug = `${toFieldId(playerName)}_${idx}`;
  ...
}
```

**Impact:** Invalid HTML; screen-reader/keyboard users targeting the second of two colliding players will interact with the wrong inputs. Low functional risk in typical use (distinct player names are enforced by the backend), but defensive practice is warranted.

---

### [LOW] Player name interpolated directly into PATCH URL without encoding

**File:** `frontend/src/api/client.js`
**Line(s):** 56–62
**Category:** security / correctness

**Problem:**
`updateHolecards` builds the URL as:
```javascript
`/games/${gameId}/hands/${handNumber}/players/${playerName}`
```
`playerName` is passed directly from `row.name` (the raw string from `playerNames`). If a player name contains `/`, `?`, `#`, or `%`, the constructed URL is malformed. In practice the backend enforces valid names on player creation, but the frontend has no corresponding guard.

**Suggested Fix:**
```javascript
`/games/${gameId}/hands/${handNumber}/players/${encodeURIComponent(playerName)}`
```

**Impact:** Low likelihood given backend constraints, but malformed URLs would cause a fetch error caught by the generic catch block, showing a confusing error despite data being otherwise valid.

---

### [LOW] `onSuccess()` exceptions surfaced as API errors

**File:** `frontend/src/components/handRecordForm.js`
**Line(s):** 355–363
**Category:** design

**Problem:**
`onSuccess()` is called inside the `try` block. If the caller's callback throws (e.g., a parent component error during form teardown), the exception is caught by `catch(err)` and displayed as `formError.textContent = err.message`. The error message could be an internal application error unrelated to the API call, misleading the user into thinking the submission failed.

**Code:**
```javascript
try {
  ...
  onSuccess();   // ← callback error caught here
} catch (err) {
  formError.textContent = err.message;   // ← shown as if it were an API error
  formError.hidden = false;
}
```

**Suggested Fix:**
Call `onSuccess()` after the try/catch completes:
```javascript
} finally {
  submitBtn.disabled = false;
}
onSuccess();   // outside try — propagates to caller naturally
```

**Impact:** Low probability; cosmetic confusion if it occurs.

---

## Positives

- **Zero innerHTML / zero XSS surface.** Every DOM write, including the API error path (`formError.textContent = err.message`), uses `.textContent` or element creation APIs. The error message from the server (raw HTTP response text set via `throw new Error(...)` in `client.js`) never reaches an HTML parser. This is correct and deliberate.
- **Dual-mode error state on card fields.** The `fmtError` / `dupError` dataset flags correctly prevent clearing one error type from hiding the other — a subtle but important correctness detail.
- **Format validation is strict and symmetric.** `parseCard()` canonicalises input (`.toUpperCase()`, `.trim()`) before checking against `VALID_RANKS` / `VALID_SUITS` sets. The same parser drives both blur validation and the submit payload, so the set of values accepted by validation equals the set sent to the API.
- **Blur + submit double validation.** Running `validateSingleCard` and `runDuplicateCheck` again on submit catches fields that were never blurred (e.g., autofill or programmatic population).
- **`dispose()` returned.** The form exposes a teardown method so the parent can cleanly remove it from the DOM.
- **`hand_number` correctly used.** `HandResponse` (confirmed in `src/pydantic_models/app_models.py:291`) does expose `hand_number: int`, so `handResp.hand_number` is a valid field access.

---

## Overall Assessment

The implementation is well-structured, XSS-clean, and satisfies 4 of the 5 acceptance criteria fully. AC4 is technically present but has a meaningful correctness hole: when the redundant PATCH stage fails after the POST has already saved all data, `onSuccess()` is blocked, the user is shown a spurious error, and re-submission creates a duplicate hand. This is the only HIGH finding and should be addressed before shipping.

The two MEDIUM findings (profit bounds, slug collision) are low-probability in the current deployment context but represent correctness gaps that can be fixed cheaply. No security issues were identified.

**Recommended actions for Hank before closing aia-core-b0k:**
1. Fix the PATCH failure / `onSuccess` blocking issue (HIGH — see suggested fix above).
2. Add `min`/`max` to `profitInput` (MEDIUM — one-liner).
3. Index-suffix the `toFieldId` slug (MEDIUM — protects against future player-name edge cases).

---

FINDINGS SUMMARY: C:0 H:1 M:2 L:2
