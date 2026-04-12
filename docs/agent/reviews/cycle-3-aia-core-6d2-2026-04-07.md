# Code Review Report — dealer-interface-003

**Date:** 2026-04-07
**Cycle:** 3
**Epic:** aia-core-8w0 (Dealer Interface — Phase 3)
**Target:** `frontend/src/api/client.js` (lines 101–116)
**Reviewer:** Scott (automated)

**Task:** T-003 — Add image upload & detection API functions
**Beads ID:** aia-core-6d2

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 1 |
| LOW | 1 |
| **Total Findings** | **2** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | `uploadImage(gameId, file)` sends a multipart POST and returns the upload record JSON | SATISFIED | `frontend/src/api/client.js` L101-113 — constructs FormData, POSTs to `/games/${gameId}/hands/image`, returns parsed JSON body | Matches backend endpoint `POST /games/{game_id}/hands/image` (status 201) |
| 2 | `getDetectionResults(gameId, uploadId)` returns the detection results JSON | SATISFIED | `frontend/src/api/client.js` L115-116 — delegates to `request()` which parses JSON via `response.json()` | Matches backend endpoint `GET /games/{game_id}/hands/image/{upload_id}` |
| 3 | Both throw descriptive errors on non-2xx responses | SATISFIED | `uploadImage` checks `!r.ok` and throws with detail or status; `getDetectionResults` uses `request()` which throws `HTTP ${status}: ${text}` on non-ok | Error patterns consistent with existing functions |
| 4 | Existing client functions are not modified | SATISFIED | `git diff` confirms only additive changes — 18 lines inserted between `uploadCsvCommit` and `fetchCsvSchema`; no existing lines modified or removed | Verified via `git diff HEAD -- frontend/src/api/client.js` |

---

## Findings

### [MEDIUM] Inconsistent error handling pattern between `uploadImage` and `getDetectionResults`

**File:** `frontend/src/api/client.js`
**Line(s):** 101-116
**Category:** convention

**Problem:**
`uploadImage` uses a direct `fetch` + `.then()` pattern (like `uploadCsvCommit`) which parses `body.detail` for structured error messages. `getDetectionResults` uses the shared `request()` helper which throws `HTTP ${status}: ${text}` (raw response text). This means:
- `uploadImage` errors surface the FastAPI `detail` field (e.g., "Unsupported file type: …")
- `getDetectionResults` errors surface the raw response body as text

This is not a bug — both throw on non-2xx — but the error message format differs. The inconsistency is inherited from existing patterns in the file (`uploadCsvValidate`/`uploadCsvCommit` vs. `fetchCsvSchema`), so this is consistent with the codebase as-is.

**Suggested Fix:**
No immediate fix required. If the team standardizes error handling in the future, both should use the same approach. For now, this matches the existing convention where FormData functions use direct `fetch` and simple GET functions use `request()`.

**Impact:** Low UX inconsistency in error messages; no functional issue.

---

### [LOW] No input validation on `gameId` or `uploadId` parameters

**File:** `frontend/src/api/client.js`
**Line(s):** 101, 115
**Category:** design

**Problem:**
Neither `uploadImage(gameId, file)` nor `getDetectionResults(gameId, uploadId)` validate their parameters before constructing the URL. Passing `undefined`, `null`, or a non-numeric value would produce URLs like `/games/undefined/hands/image` which would hit the backend and return a 422 validation error.

**Suggested Fix:**
This is consistent with every other function in the file — none of them validate inputs either. The backend validates all inputs and returns appropriate HTTP errors. Adding client-side validation here without adding it everywhere would be inconsistent. No action needed unless the team decides to add input guards across the board.

**Impact:** Minimal — backend validation catches all invalid inputs.

---

## Positives

- **Correct endpoint paths** — Both URLs exactly match the backend router (`POST /games/{game_id}/hands/image`, `GET /games/{game_id}/hands/image/{upload_id}`)
- **Pattern consistency** — `uploadImage` follows the same FormData + direct `fetch` pattern as `uploadCsvCommit` (including the `typeof body.detail === 'object'` guard for structured error details). `getDetectionResults` follows the same `request()` delegation pattern as other simple GET functions
- **No `Content-Type` header set on FormData** — Correctly omitted, allowing the browser to set the `multipart/form-data` boundary automatically
- **Additive-only change** — No existing functions were touched; `fetchCsvSchema` was cleanly repositioned after the new functions
- **Clean placement** — New functions are logically grouped with the image/detection domain, placed after the CSV upload functions and before the schema fetch

---

## Overall Assessment

The implementation is clean, correct, and consistent with established patterns in the file. All four acceptance criteria are satisfied. The two findings are both convention/design observations that apply equally to the entire file — the new code does not introduce any new inconsistencies. No critical or high-severity issues found.

**Verdict:** PASS — ready for integration.
