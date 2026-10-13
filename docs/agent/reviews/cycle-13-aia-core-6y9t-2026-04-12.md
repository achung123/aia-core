# Code Review Report — aia-core

**Date:** 2026-04-12
**Cycle:** 13
**Target:** `src/app/middleware.py`, `src/app/main.py`, `test/test_request_id_middleware.py`
**Reviewer:** Scott (automated)

**Task:** T-013 — Server timestamp & request-ID middleware
**Beads ID:** aia-core-6y9t
**Epic:** alpha-feedback-008 | Story: S-9.2

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
| 1 | Middleware is registered in main.py after CORS middleware | SATISFIED | `src/app/main.py` L31-40 — `CORSMiddleware` added first, `RequestIdMiddleware` added second | Correct: last-added middleware is outermost in Starlette, so RequestIdMiddleware wraps CORS — timing and headers cover the full request lifecycle including CORS processing |
| 2 | X-Request-Id is a UUID4 string, unique per request | SATISFIED | `src/app/middleware.py` L12 — `uuid.uuid4()` called per dispatch; `test_x_request_id_is_valid_uuid4`, `test_x_request_id_is_unique_per_request` |  |
| 3 | X-Response-Time-Ms is wall-clock time in ms (float, 2 decimal places) | SATISFIED | `src/app/middleware.py` L13-16 — `time.perf_counter()` delta × 1000, formatted `:.2f`; `test_x_response_time_ms_is_valid_number`, `test_x_response_time_ms_has_two_decimal_places` |  |
| 4 | Headers appear on all endpoints including error responses | PARTIAL | `test_headers_present_on_error_response` verifies 404 (handled HTTPException) — but unhandled exceptions (500) bypass header injection because `call_next()` re-raises | See MEDIUM finding #1 |
| 5 | Tests verify both headers are present and X-Response-Time-Ms is a valid number | SATISFIED | 7 tests covering presence, format, uniqueness, and error-path behavior |  |
| 6 | uv run pytest test/ passes | SATISFIED | Close reason confirms 1206 tests passed |  |

---

## Findings

### [MEDIUM] Unhandled exceptions bypass header injection

**File:** `src/app/middleware.py`
**Line(s):** 13-17
**Category:** correctness

**Problem:**
If a route handler raises an unhandled exception, `call_next(request)` re-raises it. The lines that set `X-Request-Id` and `X-Response-Time-Ms` (L15-17) are never reached. The exception then propagates to Starlette's `ServerErrorMiddleware`, which returns a bare 500 response without the custom headers.

This means AC4 ("including error responses") is only partially satisfied — 4xx responses from `HTTPException` work correctly, but true 500s from unhandled exceptions do not.

**Code:**
```python
response = await call_next(request)          # raises if handler throws
elapsed_ms = (time.perf_counter() - start) * 1000  # skipped
response.headers['X-Request-Id'] = request_id       # skipped
response.headers['X-Response-Time-Ms'] = f'{elapsed_ms:.2f}'  # skipped
```

**Suggested Fix:**
Wrap `call_next` in a try/except to catch exceptions, create a fallback 500 response, and still attach the headers:
```python
try:
    response = await call_next(request)
except Exception:
    response = Response(status_code=500)
elapsed_ms = (time.perf_counter() - start) * 1000
response.headers['X-Request-Id'] = request_id
response.headers['X-Response-Time-Ms'] = f'{elapsed_ms:.2f}'
return response
```
Add a corresponding test that raises inside a route handler and asserts headers are present on the 500 response.

**Impact:** On unhandled exceptions, the response loses request-ID and timing headers, reducing debuggability for the exact requests that need it most. Also blocks downstream task aia-core-ctzy (structured logging) from reliably correlating log entries with request IDs on error paths.

---

### [LOW] Custom headers not exposed via CORS

**File:** `src/app/main.py`
**Line(s):** 31-39
**Category:** design

**Problem:**
The `CORSMiddleware` configuration does not include `expose_headers=['X-Request-Id', 'X-Response-Time-Ms']`. By default, CORS only exposes "simple" response headers to browser JavaScript. The new custom headers will appear in browser DevTools but cannot be read programmatically by the frontend via `fetch` or `axios`.

**Code:**
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_origin_regex=_private_ip_regex,
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
    # missing: expose_headers=['X-Request-Id', 'X-Response-Time-Ms']
)
```

**Suggested Fix:**
Add `expose_headers` to the CORS configuration. This is outside the scope of this task but worth addressing in a follow-up, especially if the frontend will display request IDs for error reporting.

**Impact:** Minimal for current use — headers are still set on every response and visible in DevTools/curl. Only affects future frontend code that tries to read these headers programmatically.

---

## Positives

- **Clean, minimal implementation** — 18 lines of middleware with no unnecessary complexity. Single responsibility, easy to read.
- **Correct timer choice** — `time.perf_counter()` is the highest-resolution monotonic clock available, ideal for measuring short durations.
- **Well-structured tests** — 7 focused test functions, each testing one concern. Good naming convention (`test_<header>_<property>`). UUID4 validation parses with `version=4` and round-trips the string — solid.
- **Registration order is correct** — `RequestIdMiddleware` added after `CORSMiddleware` makes it outermost, so headers and timing cover the full request lifecycle including CORS preflight.
- **Thread/async safety** — `uuid.uuid4()` and `time.perf_counter()` are both safe in async contexts with no shared state.

---

## Overall Assessment

Solid, well-scoped implementation that satisfies 5 of 6 acceptance criteria fully and 1 partially. The middleware is clean and idiomatic. The one MEDIUM finding (exception path bypass) is a real gap but only manifests on unhandled exceptions — a rare case in a well-implemented FastAPI application. The LOW finding is a pre-existing CORS configuration gap outside this task's scope.

**Recommendation:** Address the MEDIUM finding in a follow-up task or as part of aia-core-ctzy (structured logging), which will need reliable request-ID access on all code paths including errors. No blockers for merging the current implementation.
