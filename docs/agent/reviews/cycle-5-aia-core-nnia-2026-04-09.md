# Code Review Report — dealer-viz-004

**Date:** 2026-04-09
**Target:** `CSV upload result validation (aia-core-nnia)`
**Reviewer:** Scott (automated)
**Cycle:** 5

**Task:** aia-core-nnia — CSV upload writes unvalidated result strings to database
**Beads ID:** aia-core-nnia

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

The bug description implies these acceptance criteria:

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| AC-1 | validate_csv_rows() checks result field against valid ResultEnum values | SATISFIED | `src/pydantic_models/csv_schema.py` L112-124; `test/test_upload_csv_api.py::TestInvalidResultValues` (9 tests) | Validation added at the correct point in the pipeline |
| AC-2 | Invalid result values return descriptive error messages | SATISFIED | Error message includes invalid value and lists valid options (`csv_schema.py` L118-121); `test_error_message_mentions_valid_values` verifies | |
| AC-3 | Blank/empty result is allowed (maps to None) | SATISFIED | `csv_schema.py` L112 — `if result_value and ...` skips blank; `test_empty_result_accepted` in both test files | |
| AC-4 | Commit endpoint calls validate before DB writes | SATISFIED | `src/app/routes/upload.py` L69-74 — `validate_csv_rows(grouped)` called before any DB operations; 400 returned if errors exist | |
| AC-5 | No bypass path — invalid results cannot reach the database | SATISFIED | CSV path is the only non-Pydantic write path for `PlayerHand.result`; all other routes use Pydantic models with `ResultEnum` typing. `images.py` doesn't write result at all. | See MEDIUM finding for future hardening |
| AC-6 | Legacy values (win, loss, fold) are rejected | SATISFIED | `test_legacy_win_value_reported_as_error`, `test_legacy_loss_value_reported_as_error`, `test_legacy_fold_value_reported_as_error` in upload tests; `test_legacy_win_rejected`, `test_legacy_loss_rejected`, `test_legacy_fold_rejected` in commit tests | |

---

## Findings

### [MEDIUM] Case-sensitive result validation has no normalization

**File:** `src/pydantic_models/csv_schema.py`
**Line(s):** 112-124
**Category:** correctness

**Problem:**
The result validation uses exact match against `_VALID_RESULTS` (`{'won', 'lost', 'folded'}`). Mixed-case input like `"Won"`, `"WON"`, or `"Folded"` will be rejected as invalid. While this is technically correct (the enum values are lowercase), CSV data from external sources commonly uses varied casing. There is no test covering this behavior, so the design choice is implicit rather than explicit.

**Code:**
```python
result_value = row.get('result', '').strip()
if result_value and result_value not in _VALID_RESULTS:
```

**Suggested Fix:**
This is a design decision, not a bug. If case-insensitive matching is desired, add `result_value = result_value.lower()` before the check. If strict casing is intentional, add a test for `"Won"` being rejected with an error message that hints at correct casing. Either way, make the behavior explicit.

**Impact:** Users uploading CSV with `"Won"` or `"Lost"` (capitalized) will get validation errors without guidance that casing matters.

---

### [LOW] `_VALID_RESULTS` set ordering in error message is non-deterministic across Python versions

**File:** `src/pydantic_models/csv_schema.py`
**Line(s):** 119
**Category:** convention

**Problem:**
The error message uses `sorted(_VALID_RESULTS)` which produces a stable alphabetical order (`folded, lost, won`). This is actually fine — the `sorted()` call makes it deterministic. No action needed; noting for completeness that this was checked.

**Code:**
```python
f'Must be one of: {", ".join(sorted(_VALID_RESULTS))}'
```

**Suggested Fix:** None required — `sorted()` already ensures deterministic output.

**Impact:** None.

---

## Positives

1. **Correct placement in the pipeline.** Validation happens in `validate_csv_rows()` which is called by both the `/upload/csv` (preview) and `/upload/csv/commit` (write) endpoints. This means validation is DRY — a single validation function protects both paths.

2. **Blank result handling is correct.** The `if result_value and ...` guard correctly allows empty strings through, which map to `None` in the commit path (`row['result'].strip() or None` in upload.py L161).

3. **Commit path is fully protected.** The commit endpoint calls `validate_csv_rows()` at L69 and raises 400 before any DB operations at L71-74. The rollback in the `except` block at L169 provides a safety net, but validation prevents reaching it for result errors.

4. **No bypass paths exist.** All other routes that write `PlayerHand.result` use Pydantic models with `ResultEnum` typing, so FastAPI/Pydantic validates at the API boundary. The CSV path was the only unguarded entry point, and it's now fixed.

5. **Comprehensive test coverage.** 15 new tests cover: arbitrary invalid strings, all three legacy values (win/loss/fold), all three valid values, empty result, error message content, and the commit-side equivalents. Both positive and negative cases are tested.

6. **Error messages are actionable.** The error dict includes row number, field name, invalid value, and a message listing all valid options — sufficient for users to diagnose and fix their CSV.

---

## Overall Assessment

The fix is **correct, complete, and well-tested**. The core bug — unvalidated result strings reaching the database via the CSV commit path — is fully addressed. Validation is DRY (single function, two callers), the error reporting is detailed, and 15 new tests cover the key cases including legacy value rejection.

The only substantive finding (MEDIUM) is a case-sensitivity design question — `"Won"` is rejected but no test or documentation makes this explicit. This is a UX consideration for a future task, not a correctness issue in the current fix.

**Verdict:** No CRITICAL or HIGH findings. Fix is ready.
