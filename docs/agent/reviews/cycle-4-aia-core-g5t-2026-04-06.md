# Code Review Report — aia-core

**Date:** 2026-04-06
**Target:** `src/app/main.py`, `test/test_cors_middleware.py`
**Reviewer:** Scott (automated)
**Cycle:** 4

**Task:** aia-core-g5t — Fix: CORS wildcard origin guard — ALLOWED_ORIGINS=* with allow_credentials=True
**Beads ID:** aia-core-g5t

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

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | `main.py` raises `ValueError` at startup if `*` is in the parsed `allowed_origins` list | SATISFIED | `src/app/main.py:13-17`; `test_cors_wildcard_origin_raises` passes | Guard fires before `add_middleware`, preventing the unsafe configuration entirely |
| 2 | Test coverage for multi-origin comma-separated parsing | PARTIAL | `test/test_cors_middleware.py:33-44` — asserts `_allowed_origins == [...]` | Verifies list parsing only; middleware HTTP behavior for the second parsed origin is not verified via a preflight request (see Finding [MEDIUM]) |
| 3 | Assert `access-control-allow-credentials: true` in allowed-origin preflight test | SATISFIED | `test/test_cors_middleware.py:19` | Response header assertion confirmed |
| 4 | Disallowed-origin assertion fixed to `is None` | SATISFIED | `test/test_cors_middleware.py:28` | Correct — `response.headers.get(...)` returns `None` when header is absent |

---

## Findings

### [HIGH] Fix changes are not committed to git

**File:** `src/app/main.py`, `test/test_cors_middleware.py`
**Line(s):** N/A — file-level
**Category:** convention

**Problem:**
`git status` shows `src/app/main.py` as modified (unstaged) and `test/test_cors_middleware.py` as untracked. The beads task `aia-core-g5t` was closed with status `closed`, but no git commit captures the fix. Per project rules in `AGENTS.md`: "Work is NOT complete until `git push` succeeds." The security fix currently exists only in the working tree and could be lost on branch reset or checkout.

**Code:**
```
modified:   src/app/main.py          (unstaged)
untracked:  test/test_cors_middleware.py
```

**Suggested Fix:**
Stage both files and commit before closing the cycle:
```bash
git add src/app/main.py test/test_cors_middleware.py
git commit -m "fix: CORS wildcard origin guard — raise ValueError on ALLOWED_ORIGINS=* (aia-core-g5t)"
git push
```

**Impact:** The security fix is not in version control. If the branch is reset or switched, the fix is lost. CI cannot enforce or verify it.

---

### [MEDIUM] `test_cors_multi_origin_parsing` validates list parsing only, not middleware behavior

**File:** `test/test_cors_middleware.py`
**Line(s):** 33–44
**Category:** correctness

**Problem:**
The test reloads `app.main` with `ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000`, then asserts `main_module._allowed_origins == ['http://localhost:5173', 'http://localhost:3000']`. This confirms the string-splitting path is correct, but does **not** verify that `CORSMiddleware` was initialized with those origins and actually allows preflight requests from the second origin. The middleware is added to the reloaded `main_module.app` — a new `FastAPI` instance not accessible through the module-level `client`. AC#2 is therefore satisfied for parsing but not for end-to-end middleware behavior.

**Code:**
```python
def test_cors_multi_origin_parsing(monkeypatch):
    import app.main as main_module

    monkeypatch.setenv('ALLOWED_ORIGINS', 'http://localhost:5173,http://localhost:3000')
    try:
        importlib.reload(main_module)
        assert main_module._allowed_origins == ['http://localhost:5173', 'http://localhost:3000']
    finally:
        monkeypatch.delenv('ALLOWED_ORIGINS', raising=False)
        importlib.reload(main_module)
```

**Suggested Fix:**
After reloading, spin up a `TestClient` against the reloaded app and assert the second origin is allowed:
```python
from fastapi.testclient import TestClient as TC
reloaded_client = TC(main_module.app)
resp = reloaded_client.options(
    '/',
    headers={'Origin': 'http://localhost:3000', 'Access-Control-Request-Method': 'GET'},
)
assert resp.headers.get('access-control-allow-origin') == 'http://localhost:3000'
```

**Impact:** A regression that breaks multi-origin middleware initialization (while keeping the list-parsing logic intact) would go undetected.

---

### [LOW] Two pre-existing B905 ruff errors in unrelated files

**File:** `src/app/services/card_detector.py:48`, `src/pydantic_models/csv_schema.py:175`
**Line(s):** 48, 175
**Category:** convention

**Problem:**
`uv run ruff check` exits with code 1 due to two B905 violations (`zip()` without an explicit `strict=` parameter) in files not touched by this fix. Both violations exist at HEAD before the g5t changes and are unrelated to CORS. The pre-commit `ruff` hook runs on staged files only, so they will not block the g5t commit — but they do cause full-suite `uv run ruff check` to fail, which the project's baseline instructions require to pass before committing.

**Code:**
```python
# card_detector.py:48
for pos, card in zip(positions, chosen)

# csv_schema.py:175
row_dict = dict(zip(headers, row))
```

**Suggested Fix:**
File a separate chore issue to add `strict=False` (or `strict=True` where lengths are expected to match) to these calls. Do not fix in this PR to keep scope tight.

**Impact:** Low — these are pre-existing and outside the scope of g5t. They do not affect CORS security. A follow-up chore task should address them.

---

### [LOW] No test for mixed wildcard: `ALLOWED_ORIGINS=http://foo.com,*`

**File:** `test/test_cors_middleware.py`
**Line(s):** N/A
**Category:** correctness

**Problem:**
`test_cors_wildcard_origin_raises` exercises `ALLOWED_ORIGINS=*` (bare wildcard only). The guard logic — `if '*' in _allowed_origins` — also correctly handles a mixed list like `['http://foo.com', '*']` because Python's `in` operator checks list membership. However, this case has no explicit test. An accidental change to the guard condition (e.g., `_allowed_origins == ['*']`) would bypass the protection for mixed strings.

**Suggested Fix:**
Add a parametrized or second test:
```python
def test_cors_wildcard_mixed_origin_raises(monkeypatch):
    import app.main as main_module
    monkeypatch.setenv('ALLOWED_ORIGINS', 'http://foo.com,*')
    try:
        with pytest.raises(ValueError, match="ALLOWED_ORIGINS must not contain"):
            importlib.reload(main_module)
    finally:
        monkeypatch.delenv('ALLOWED_ORIGINS', raising=False)
        importlib.reload(main_module)
```

**Impact:** Low — the current logic is correct; this is a coverage gap for a regression, not a live bug.

---

## Positives

- **Fast-fail startup guard is well-placed**: The `ValueError` is raised at module scope, before `add_middleware` is called. The application literally cannot start in the dangerous `*` + `allow_credentials=True` state. This is the correct pattern.
- **`allow_credentials` is not conditionally weakened**: Rather than toggling `allow_credentials` based on whether a wildcard is present, the guard enforces that `allow_credentials=True` (the intended behavior) remains hardcoded while preventing the dangerous configuration at the environment level.
- **`origin.strip()` in parsing**: Whitespace around origin values in `ALLOWED_ORIGINS` is handled correctly, which also means `ALLOWED_ORIGINS= * ` (spaces around wildcard) is caught by the guard.
- **`finally` blocks in reload tests**: Both `importlib.reload` tests restore module state in `finally` blocks, preventing leakage to subsequent tests. The use of `monkeypatch.delenv` also ensures cleanup even if an unexpected exception propagates.
- **Disallowed-origin assertion is precise**: Using `is None` (not `== None` or `!= 'http://evil.example.com'`) is idiomatic and correct for testing header absence.

---

## Overall Assessment

The security implementation is **correct and well-targeted**. The OWASP A05:2021 (Security Misconfiguration) risk — credentialed CORS with a wildcard origin — is fully mitigated by the startup guard. The guard cannot be silently bypassed in normal operation.

**Blocking items before this cycle can be fully closed:**
1. **(HIGH)** Stage and commit `src/app/main.py` and `test/test_cors_middleware.py`. The beads task is closed but the fix is not in git. This must be resolved immediately.

**Recommended follow-up (non-blocking):**
- Add an HTTP-level assertion to `test_cors_multi_origin_parsing` to verify middleware behavior for the second origin.
- Add a mixed-wildcard test case to harden the guard against regression.
- File a chore task for the two pre-existing B905 ruff errors.
