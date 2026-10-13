# Code Review Report — alpha-feedback-008

**Date:** 2026-04-12
**Cycle:** 24
**Target:** `src/app/middleware.py`, `test/test_request_logging_middleware.py`
**Reviewer:** Scott (automated)

**Task:** T-040 — Structured request logging middleware
**Beads ID:** aia-core-ctzy

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 1 |
| MEDIUM | 1 |
| LOW | 1 |
| **Total Findings** | **3** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | Each request logs: request_id, method, path, status_code, duration_ms | SATISFIED | `src/app/middleware.py` L23-30; `test_log_contains_required_fields` | All five fields present in JSON payload |
| 2 | Uses Python logging module at INFO level | SATISFIED | `src/app/middleware.py` L37; `test_request_logs_at_info_level` | `logger.info()` called for 2xx/3xx responses |
| 3 | Log format is structured (JSON or key=value) | SATISFIED | `src/app/middleware.py` L23 `json.dumps()`; `test_log_format_is_valid_json` | JSON format confirmed |
| 4 | Error responses (4xx, 5xx) log at WARNING/ERROR level | PARTIAL | `src/app/middleware.py` L33-37; `test_4xx_logs_at_warning_level` | 4xx→WARNING path tested; 5xx→ERROR path is NOT tested (see HIGH finding) |
| 5 | uv run pytest test/ passes; log output verified via caplog | PARTIAL | All 9 tests pass | Tests use `unittest.mock.patch` instead of `caplog`; functionally equivalent |

---

## Findings

### [HIGH] `test_5xx_logs_at_error_level` never exercises the ERROR path

**File:** `test/test_request_logging_middleware.py`
**Line(s):** 68-79
**Category:** correctness

**Problem:**
The test hits `/api/games/99999` hoping for a 500 response but the endpoint returns 404. The conditional fallback (`if mock_mw_logger.error.call_count == 1 ... else ...`) silently accepts the 4xx/WARNING path. Verified empirically: `error.call_count` is always 0 and `warning.call_count` is always 1. The `logger.error()` branch in `middleware.py` L34-35 has **zero test coverage**.

**Code:**
```python
def test_5xx_logs_at_error_level(client, mock_mw_logger):
    client.get('/api/games/99999')
    # This endpoint may return 404 (4xx) not 500
    if mock_mw_logger.error.call_count == 1:
        log_data = json.loads(mock_mw_logger.error.call_args[0][0])
        assert log_data['status_code'] >= 500
    else:
        assert mock_mw_logger.warning.call_count == 1
```

**Suggested Fix:**
Create a dedicated test route that forces a 500 response (e.g., register a temporary route in a fixture that raises an unhandled `RuntimeError`, or mock `call_next` to return a `Response(status_code=500)`) so the ERROR path is deterministically tested.

**Impact:** The 5xx→ERROR log-level mapping is unverified. A regression could silently downgrade 500 errors to INFO without any test catching it.

---

### [MEDIUM] Unhandled exceptions in `call_next` bypass logging entirely

**File:** `src/app/middleware.py`
**Line(s):** 17
**Category:** correctness

**Problem:**
If `call_next(request)` raises an exception (e.g., an unhandled error that propagates before Starlette's `ExceptionMiddleware` converts it to a response), the logging block on lines 18-39 is skipped entirely. The request produces no structured log entry. In the current middleware stack, `ServerErrorMiddleware` sits outermost but `ExceptionMiddleware` sits below `RequestIdMiddleware`, so non-HTTP exceptions that escape `ExceptionMiddleware` could reach here as raw exceptions.

**Code:**
```python
async def dispatch(self, request: Request, call_next) -> Response:
    request_id = str(uuid.uuid4())
    start = time.perf_counter()
    response = await call_next(request)  # <-- no try/except
    elapsed_ms = (time.perf_counter() - start) * 1000
```

**Suggested Fix:**
Wrap `call_next` in a try/except that logs the exception at ERROR level and re-raises:
```python
try:
    response = await call_next(request)
except Exception:
    elapsed_ms = (time.perf_counter() - start) * 1000
    logger.error(json.dumps({...}))
    raise
```

**Impact:** Low probability in normal operation (most errors become HTTP responses), but catastrophic requests would leave no log trail.

---

### [LOW] AC5 specifies `caplog` but tests use `unittest.mock.patch`

**File:** `test/test_request_logging_middleware.py`
**Line(s):** 8-13
**Category:** convention

**Problem:**
The acceptance criterion states "log output verified via caplog" but all tests use `patch('app.middleware.logger')` with `MagicMock`. The mock approach is functionally equivalent and arguably more precise, but it deviates from the stated AC.

**Suggested Fix:**
Either update the AC to reflect the chosen approach, or add at least one test using `caplog` at the `app.middleware` logger to satisfy the AC literally.

**Impact:** No functional impact; minor traceability discrepancy.

---

## Positives

- **Clean, minimal middleware** — The implementation is concise (~40 lines), easy to reason about, and does exactly what the ACs require without over-engineering.
- **Correct timer choice** — `time.perf_counter()` is the right high-resolution monotonic clock for measuring elapsed time; avoids wall-clock drift.
- **No sensitive data in logs** — Uses `request.url.path` (not `str(request.url)`) which excludes query parameters that could contain tokens or PII.
- **Strong field-level test coverage** — Tests verify each JSON field's name, type, and value individually, making regressions easy to pinpoint.
- **Request ID consistency test** — `test_log_request_id_matches_response_header` verifies the log entry and response header carry the same UUID, which is a valuable cross-cutting check.

---

## Overall Assessment

The implementation is solid and the middleware is well-designed. The one HIGH finding — the 5xx error-level test never actually exercising the ERROR path — should be addressed before considering this fully covered. The MEDIUM finding (exception bypass) is a hardening opportunity rather than a bug in current usage. No CRITICAL issues found.
