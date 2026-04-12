# Code Review Report — aia-core

**Date:** 2026-04-06
**Target:** `src/app/main.py`, `test/test_cors_middleware.py`
**Reviewer:** Scott (automated)

**Task:** Add CORS middleware to FastAPI backend
**Beads ID:** aia-core-4eo
**Cycle:** 3

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
| 1 | `CORSMiddleware` added to FastAPI app | SATISFIED | `src/app/main.py:13-19` — `app.add_middleware(CORSMiddleware, ...)` | |
| 2 | Origins from `ALLOWED_ORIGINS` env var (comma-separated), default `http://localhost:5173` | PARTIAL | `src/app/main.py:11-12` — parsing is correct; comma-split + strip is present | No test exercises multi-origin env var path (see M-1) |
| 3 | `allow_methods=["*"]` and `allow_headers=["*"]` | SATISFIED | `src/app/main.py:17-18` | |
| 4 | `allow_credentials=True` | SATISFIED | `src/app/main.py:16` | No test asserts the `Access-Control-Allow-Credentials` response header (see M-2) |
| 5 | Existing tests still pass | SATISFIED | 726 tests passing per session report | |

---

## Findings

### [HIGH] No guard against `ALLOWED_ORIGINS=*` with `allow_credentials=True`

**File:** `src/app/main.py`
**Line(s):** 11–19
**Category:** security

**Problem:**
If `ALLOWED_ORIGINS=*` is set in the environment, `_allowed_origins` becomes `['*']`. Starlette's `CORSMiddleware` with `allow_origins=['*']` and `allow_credentials=True` responds to every preflight by reflecting the incoming `Origin` header verbatim rather than sending a literal `*` (which browsers reject). The net effect is that **every origin on the internet receives credentialed access** to the API — exactly the scenario OWASP flags as a misconfiguration. Neither the parsing code nor the application startup raises an error or warning when this unsafe combination is detected.

**Code:**
```python
_raw_origins = os.getenv('ALLOWED_ORIGINS', 'http://localhost:5173')
_allowed_origins = [origin.strip() for origin in _raw_origins.split(',')]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,   # <-- credentials ON
    allow_methods=['*'],
    allow_headers=['*'],
)
```

**Suggested Fix:**
Add a startup-time guard that raises a `ValueError` (or logs a fatal warning) when `'*'` appears in `_allowed_origins` while `allow_credentials=True`:
```python
_raw_origins = os.getenv('ALLOWED_ORIGINS', 'http://localhost:5173')
_allowed_origins = [origin.strip() for origin in _raw_origins.split(',')]

if '*' in _allowed_origins:
    raise ValueError(
        "ALLOWED_ORIGINS='*' is incompatible with allow_credentials=True. "
        "Specify explicit origins."
    )
```

**Impact:** In a production deployment where an operator sets `ALLOWED_ORIGINS=*` by mistake or for convenience, any cross-origin site can issue credentialed requests (with cookies/auth headers) to the backend. This is a direct match to OWASP A05:2021 — Security Misconfiguration.

---

### [MEDIUM] Multi-origin env var path is untested

**File:** `test/test_cors_middleware.py`
**Line(s):** 1–26 (entire file)
**Category:** correctness

**Problem:**
AC #2 specifies that `ALLOWED_ORIGINS` is a **comma-separated** list of origins. The parsing logic (`split(',')` + `strip()`) is present in `main.py` but there is no test that sets the env var to multiple origins (e.g., `http://localhost:5173,http://localhost:3000`) and verifies that all listed origins are accepted while unlisted ones are rejected. Because `main.py` evaluates `os.getenv` at module import time, these tests would need to be structured carefully (e.g., a separate test app fixture or a direct unit test of the parsing logic), but the gap leaves AC #2 only partially covered.

**Suggested Fix:**
Add a unit test that directly exercises the parsing function, or build a separate `TestClient` from an app instance constructed with a patched env var. At minimum, assert that both origins in a two-item list get `access-control-allow-origin` back in a preflight response, and that a third unlisted origin is denied.

**Impact:** Regression risk — a future change that breaks multi-origin parsing would not be caught by the test suite.

---

### [MEDIUM] `allow_credentials` response header is not asserted

**File:** `test/test_cors_middleware.py`
**Line(s):** 7–16
**Category:** correctness

**Problem:**
AC #4 requires `allow_credentials=True`. The middleware config is set correctly, but neither test asserts that the preflight response includes `Access-Control-Allow-Credentials: true`. The tests only check `access-control-allow-origin`. A future misconfiguration that drops the credentials flag would not be caught.

**Suggested Fix:**
Extend `test_cors_preflight_default_origin`:
```python
assert response.headers.get('access-control-allow-credentials') == 'true'
```

**Impact:** AC #4 is code-verified but not test-verified; a regression in this header would be invisible to CI.

---

### [LOW] Imprecise assertion in `test_cors_preflight_disallowed_origin`

**File:** `test/test_cors_middleware.py`
**Line(s):** 19–26
**Category:** correctness

**Problem:**
The disallowed-origin test asserts `!= 'http://evil.example.com'`. This passes whether the header is `None` (correct), absent entirely (correct), or any other unexpected value (e.g., a different origin or an accidental `*`). The assertion does not confirm the expected negative behaviour precisely enough to catch all misbehaviour variants.

**Suggested Fix:**
```python
assert response.headers.get('access-control-allow-origin') is None
```

**Impact:** Low — the current assertion catches the most obvious failure mode; edge cases like an accidental wildcard would still slip through.

---

### [LOW] Module-level env var evaluation limits test isolation

**File:** `src/app/main.py`
**Line(s):** 11–12
**Category:** design

**Problem:**
`os.getenv('ALLOWED_ORIGINS', ...)` is called once at import time. Any test that wants to exercise different `ALLOWED_ORIGINS` values must patch before the module is first imported, which is fragile and easy to get wrong. This is a common FastAPI pattern and not a bug in the current tests, but it is worth noting as a maintainability constraint that will complicate tests for the H-1 guard above.

**Suggested Fix:**
Wrap origin parsing in a function called during `lifespan` or defer it to where the middleware can receive arguments at startup, or document in a comment that this value is import-time-only.

**Impact:** Low — does not affect current tests or production behaviour; affects future test authors.

---

## Positives

- Origin parsing (`split(',')` + list-comprehension `strip()`) is clean, idiomatic, and handles whitespace correctly.
- Explicit origin list (non-wildcard default) is the right approach for credentialed CORS — the implementation avoids the most dangerous form of the misconfiguration.
- `test_cors_preflight_disallowed_origin` providing a negative-path test for rejected origins is good coverage hygiene.
- Middleware is registered before routers, which is the correct Starlette ordering.

---

## Overall Assessment

The implementation satisfies ACs 1, 3, 4, and 5, and partially satisfies AC 2. The CORS configuration is structurally sound for the default and normal cases. The one **HIGH** finding — missing protection against `ALLOWED_ORIGINS=*` — must be addressed before this code is deployed to any environment where that env var could be set carelessly, as the combination with `allow_credentials=True` creates an exploitable security misconfiguration. The two **MEDIUM** gaps leave AC #2 and AC #4 without definitive test coverage. Add a wildcard guard, assert the credentials response header, and add a multi-origin parsing test to close this review.
