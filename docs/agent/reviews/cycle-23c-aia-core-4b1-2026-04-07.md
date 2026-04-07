# Code Review Report — aia-core

**Date:** 2026-04-07
**Target:** `frontend/src/components/handRecordForm.js` — submit handler `onSuccess()` isolation
**Reviewer:** Scott (automated)
**Cycle:** 23c
**Beads ID:** aia-core-4b1

---

## Primary Verification

**Question:** Is `onSuccess()` now wrapped in `try { onSuccess(); } catch (cbErr) { console.warn(...); }` — isolated from the outer catch block?

**Answer: YES — CONFIRMED.**

`handRecordForm.js` line ~352:

```js
try {
  const handResp = await createHand(sessionId, postBody);
  const handNumber = handResp.hand_number;
  try { onSuccess(); } catch (cbErr) { console.warn('onSuccess callback error:', cbErr); }

  // Best-effort PATCH hole cards ...
  try {
    await Promise.all( ... );
  } catch (patchErr) {
    console.warn('Supplementary PATCH failed (hand already saved):', patchErr);
  }
} catch (err) {
  formError.textContent = err.message;
  formError.hidden = false;
} finally {
  submitBtn.disabled = false;
}
```

`onSuccess()` has its own dedicated inner `try/catch`. Any exception thrown by the consumer callback is caught by `cbErr` and surfaced only as a `console.warn`. It does **not** propagate to the outer `catch (err)` block that handles API failures, and it does **not** prevent the supplementary PATCH from executing. Isolation is complete.

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 2 |
| LOW | 1 |
| **Total Findings** | **3** |

---

## Findings

### [MEDIUM] `onSuccess()` fires before supplementary PATCH calls complete

**File:** `frontend/src/components/handRecordForm.js`
**Line(s):** 352–362
**Category:** design

**Problem:**
`onSuccess()` is invoked immediately after the `createHand` POST resolves, but the `updateHolecards` PATCH calls are still in-flight (they run inside the same outer `try` block below it). If `onSuccess` triggers parent-component teardown or navigation, two side-effects occur:

1. `submitBtn.disabled = false` in `finally` runs against a detached DOM node — harmless, but signals a lifecycle race.
2. PATCH errors after teardown are silently swallowed by the inner `catch (patchErr)` with no user-visible feedback.

The hand record itself is safe (POST already committed), and the comment "non-fatal — hand already saved" documents the intent. The issue is that callers have no way to know that hole-card PATCH calls may still be running after `onSuccess()` resolves.

**Code:**
```js
try { onSuccess(); } catch (cbErr) { console.warn('onSuccess callback error:', cbErr); }

// Best-effort PATCH hole cards (non-fatal — hand already saved via POST)
try {
  await Promise.all(
    playerRows.map(row =>
      updateHolecards(sessionId, handNumber, row.name, { ... })
    )
  );
} catch (patchErr) {
  console.warn('Supplementary PATCH failed (hand already saved):', patchErr);
}
```

**Suggested Fix:**
Await the PATCH calls before invoking `onSuccess()`, or — if early notification is required — pass the PATCH promise to `onSuccess` so callers can optionally await it. The simpler option is to move `onSuccess()` after the PATCH `try/catch` block.

**Impact:** PATCH errors after parent navigation are silently discarded; no data loss, but hole-card data may be stale server-side without any user indication.

---

### [MEDIUM] No null/callable guard on `onSuccess` before invocation

**File:** `frontend/src/components/handRecordForm.js`
**Line(s):** 352
**Category:** correctness

**Problem:**
`onSuccess` is accepted as a parameter but is never validated to be a function. If a caller passes `undefined`, `null`, or a non-function, the inner `try/catch` silently swallows the resulting `TypeError` and logs it only as a `console.warn`. The form then continues as if submission succeeded, giving no user-visible error. Misconfigured callers can go undetected.

**Code:**
```js
try { onSuccess(); } catch (cbErr) { console.warn('onSuccess callback error:', cbErr); }
```

**Suggested Fix:**
```js
if (typeof onSuccess === 'function') {
  try { onSuccess(); } catch (cbErr) { console.warn('onSuccess callback error:', cbErr); }
}
```

**Impact:** Low probability in practice (callers likely pass a function), but a misconfigured caller produces a silent failure that can be difficult to trace.

---

### [LOW] `profit_loss` has no client-side bounds check

**File:** `frontend/src/components/handRecordForm.js`
**Line(s):** 323–325
**Category:** correctness

**Problem:**
The profit/loss field uses `parseFloat` with only an `isNaN` guard. Values such as `Infinity`, `-Infinity`, or extremely large floats will pass through and be sent in the POST body without any client-side rejection.

**Code:**
```js
const profit = parseFloat(row.profitInput.value);
if (!Number.isNaN(profit)) {
  entry.profit_loss = profit;
}
```

**Suggested Fix:**
```js
const profit = parseFloat(row.profitInput.value);
if (!Number.isNaN(profit) && Number.isFinite(profit)) {
  entry.profit_loss = profit;
}
```

**Impact:** Server-side validation should catch this, but the client will silently pass bogus values if that guard is absent.

---

## Positives

- **XSS-free DOM construction:** All elements are built via `document.createElement` / `.textContent` — no `innerHTML` usage anywhere in the file. No injection surface.
- **Dual-error-state tracking:** The `fmtError` / `dupError` dataset flags cleanly separate format errors from duplicate errors, preventing one kind of clear from masking the other.
- **Non-fatal PATCH pattern:** Deliberately separating "hand saved" from "hole cards patched" with a best-effort inner `try/catch` is the correct architecture for a two-step write where the first step is the source of truth.
- **`onSuccess` isolation (the target fix):** The callback is correctly isolated in its own `try/catch`. A buggy consumer callback cannot corrupt the outer error-display path or prevent `submitBtn` re-enabling.

---

## Overall Assessment

The primary objective of this cycle — isolating `onSuccess()` from the outer API-error catch block — is **fully satisfied**. No CRITICAL or HIGH issues were found. The two MEDIUM findings are design-quality concerns (callback timing and defensive guard) rather than functional bugs. The form is correctly preventing duplicate card submissions, validating required fields, and handling API errors with user-visible feedback.

FINDINGS SUMMARY: C:0 H:0 M:2 L:1
