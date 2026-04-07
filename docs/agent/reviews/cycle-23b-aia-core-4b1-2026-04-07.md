# Code Review Report — aia-core

**Date:** 2026-04-07
**Cycle:** 23b (re-review of fix)
**Target:** `frontend/src/components/handRecordForm.js`
**Commit:** `651dd51` — `fix: onSuccess after POST, PATCH non-fatal (aia-core-4b1)`
**Reviewer:** Scott (automated)

**Task:** Fix: onSuccess called before PATCH; PATCH failure non-fatal
**Beads ID:** aia-core-4b1
**Parent review:** cycle-23-aia-core-b0k-2026-04-07.md (HIGH finding: PATCH failure blocked onSuccess + enabled double-submit)

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 1 |
| MEDIUM | 1 |
| LOW | 2 |
| **Total Findings** | **4** |

---

## Verification Checklist

| Check | Result | Evidence |
|---|---|---|
| `onSuccess()` called immediately after `createHand()` resolves, before any PATCH | **PASS** | Line 345: `onSuccess()` is the first statement after `handResp.hand_number` is extracted; the inner try/catch with `Promise.all` follows on line 348 |
| `Promise.all(updateHolecards…)` wrapped in a separate try/catch | **PASS** | Lines 348–356: inner `try { await Promise.all(…) } catch (patchErr) { console.warn(…) }` — no re-throw |
| Inner catch does NOT re-throw | **PASS** | The `catch (patchErr)` block only calls `console.warn`; control falls through to the `finally` block |
| Outer catch fires only on POST failure | **PARTIAL — see HIGH finding** | If `createHand()` rejects the outer catch fires correctly. However `onSuccess()` is inside the outer try; a synchronous throw from the callback also reaches the outer catch (see HIGH finding below) |
| Double-submit risk from cycle-23 HIGH resolved | **PASS** | `onSuccess()` is now called before PATCH; the outer catch can no longer fire due to PATCH rejection; the submit button is always re-enabled via `finally` |

---

## Findings

### [HIGH] H-1 — `onSuccess()` inside outer `try`: throwing callback triggers false POST-failure error

**File:** `frontend/src/components/handRecordForm.js`
**Lines:** 344–362
**Category:** Correctness / error handling

**Problem:**
`onSuccess()` sits inside the outer `try` block. If the callback throws synchronously (e.g., a navigation error, a missing-DOM guard, or a consumer bug), the outer `catch (err)` fires:

```javascript
formError.textContent = err.message;
formError.hidden = false;
```

This displays a hand-submission-failure message on the form even though the hand was already committed to the database by `createHand()`. The inner `try/catch` for PATCH is never reached. The net effect:

- Hand exists in the DB — the user's data is not lost
- Form shows "Submit failed" — the user believes it was lost
- Submit button is re-enabled (via `finally`) — if the user resubmits, a **second duplicate hand** is created (the same double-submit risk originally filed in cycle-23, now reachable via a different code path)

**Current structure:**
```javascript
try {
  const handResp = await createHand(sessionId, postBody);   // POST — hand saved
  const handNumber = handResp.hand_number;
  onSuccess();                                              // ← any throw propagates to outer catch
  try {
    await Promise.all( … updateHolecards … );
  } catch (patchErr) { console.warn(…); }
} catch (err) {                                             // ← incorrectly fires for onSuccess() throw
  formError.textContent = err.message;
  formError.hidden = false;
}
```

**Suggested fix:** Wrap `onSuccess()` in its own isolated guard so an exception cannot reach the POST-failure handler:
```javascript
try {
  const handResp = await createHand(sessionId, postBody);
  const handNumber = handResp.hand_number;

  // Guard: onSuccess throw must not reach the POST-failure handler
  try { onSuccess(); } catch (cbErr) { console.error('onSuccess callback threw:', cbErr); }

  try {
    await Promise.all( … updateHolecards … );
  } catch (patchErr) { console.warn('Supplementary PATCH failed:', patchErr); }
} catch (err) {
  formError.textContent = err.message;
  formError.hidden = false;
}
```

---

### [MEDIUM] M-1 — Silent PATCH failure gives no user feedback

**File:** `frontend/src/components/handRecordForm.js`
**Lines:** 348–356
**Category:** UX / observability

**Problem:**
When the inner `catch (patchErr)` fires, only a `console.warn` is emitted. The user receives no indication that the supplementary hole-card update failed. The hand is saved but hole card data on the server may be incomplete or absent. In a poker session review, missing hole cards silently degrade the data quality with no recovery prompt.

**Note:** This is an accepted trade-off per the comment `"non-fatal — hand already saved via POST"`, but the absence of any non-blocking UI hint (e.g., a dismissible warning banner) means data quality issues can go unnoticed indefinitely.

**Suggested fix:** Show a non-blocking warning banner (separate from `formError`) after PATCH failure rather than suppressing it entirely. The banner should not re-enable any submission path.

---

### [LOW] L-1 — `err.message` is `undefined` when outer catch receives a non-Error

**File:** `frontend/src/components/handRecordForm.js`
**Line:** 359
**Category:** Defensive coding

**Problem:**
`formError.textContent = err.message` assumes `err` is an `Error` instance. A non-Error rejection (e.g., `throw "network unavailable"` or `throw null`) causes `err.message` to be `undefined`, rendering the literal string `"undefined"` on the form.

**Suggested fix:**
```javascript
formError.textContent = err instanceof Error ? err.message : String(err);
```

---

### [LOW] L-2 — Card values re-parsed from DOM after `onSuccess()` may diverge from POST data

**File:** `frontend/src/components/handRecordForm.js`
**Lines:** 350–354
**Category:** Design fragility

**Problem:**
The PATCH calls re-invoke `parseCard(row.card1Input.value)` and `parseCard(row.card2Input.value)` after `onSuccess()` has already been called. These card objects were already constructed for the POST body (lines 315–317) but are not reused. If `onSuccess()` has any side effect that clears or mutates the input fields (e.g., a form reset), the PATCH would send `null` card values rather than the values that were POSTed.

The already-parsed `playerEntries` array from line 311 contains the identical card objects; those could be reused directly for the PATCH to eliminate any divergence risk.

**Suggested fix:** Reference the already-built `playerEntries[i].card_1 / card_2` in the PATCH map rather than re-reading from the DOM.

---

## Cycle-23 HIGH Finding — Resolution Status

| Cycle-23 Finding | Status |
|---|---|
| PATCH failure blocked `onSuccess()`, re-enabled submit, risked double-submit | **RESOLVED** — `onSuccess()` now called before PATCH; PATCH failures are isolated by inner try/catch and no longer propagate to the outer handler |

---

## Overall Assessment

The core fix is structurally correct: `onSuccess()` fires before any PATCH, and PATCH failures are genuinely non-fatal. The cycle-23 HIGH is closed. One new HIGH remains: the `onSuccess()` callback itself is not isolated from the outer catch, meaning a callback throw (however rare) produces a misleading error state and re-exposes the double-submit path. This should be addressed before the branch is merged.

---

FINDINGS SUMMARY: C:0 H:1 M:1 L:2
