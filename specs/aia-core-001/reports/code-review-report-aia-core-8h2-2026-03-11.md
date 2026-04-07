# Code Review Report — aia-core-001

**Date:** 2026-03-11
**Target:** `src/app/database/session.py`, `src/app/database/database_models.py`, `src/app/routes/game.py`, `test/conftest.py`, `test/test_session_dependency.py`
**Reviewer:** Scott (automated)

**Task:** T-010 — Implement database session dependency with new engine
**Beads ID:** aia-core-8h2

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 2 |
| MEDIUM | 2 |
| LOW | 3 |
| **Total Findings** | **7** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | `session.py` exists with `engine`, `SessionLocal`, and `get_db` | SATISFIED | `src/app/database/session.py` lines 10–20; `test_session_dependency.py` `TestSessionModuleExists` class (5 structural tests) | All three names present and exported |
| 2 | All routers use the shared `get_db` dependency | SATISFIED | `src/app/routes/game.py` line 13 imports `get_db`; all 4 route handlers inject it via `Depends`; other routers are stubs with no DB access | No residual per-router session creation found |
| 3 | No duplicate engine creation across the codebase | SATISFIED | `grep` confirms `create_engine` appears only in `session.py` (prod) and `conftest.py` (test); `database_models.py` imports engine from `session.py` | `TestNoDuplicateEngineCreation` suite covers this with 3 assertions |

---

## Findings

### [HIGH] `connect_args={'check_same_thread': False}` applied unconditionally

**File:** `src/app/database/session.py`
**Line(s):** 10–12
**Category:** correctness

**Problem:**
`check_same_thread` is a SQLite-only DBAPI keyword argument. When `DATABASE_URL` is set to a PostgreSQL URL, psycopg2's `connect()` rejects unknown keyword arguments, causing `TypeError: connect() got an unexpected keyword argument 'check_same_thread'` at engine creation time. Since `DATABASE_URL` is explicitly designed to be overridable via environment variable (the whole point of this task), this makes PostgreSQL deployments non-functional despite the env-var pathway existing.

**Code:**
```python
engine = create_engine(
    DATABASE_URL, connect_args={'check_same_thread': False}
)
```

**Suggested Fix:**
```python
connect_args = {'check_same_thread': False} if DATABASE_URL.startswith('sqlite') else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
```

**Impact:** All non-SQLite deployments (e.g., production PostgreSQL) fail at startup with an unhelpful TypeError. Blocks T-011, T-025, T-039, and every future task that depends on T-010.

---

### [HIGH] `dependency_overrides` never cleared in `client` fixture

**File:** `test/conftest.py`
**Line(s):** 34–37
**Category:** correctness

**Problem:**
The `client` fixture sets `app.dependency_overrides[get_db] = override_get_db` but never tears it down — the fixture returns a `TestClient` directly instead of using `yield` with a cleanup step. Because `app` is a module-level singleton, the override persists for every subsequent test in the same pytest process. Any test that instantiates `TestClient(app)` directly (or any future test that expects the real DB dependency) will silently receive the in-memory test override instead. This violates test isolation and is a latent defect that will surface once the test suite grows.

**Code:**
```python
@pytest.fixture
def client():
    """Provides a test client for FastAPI with overridden database."""
    app.dependency_overrides[get_db] = override_get_db
    return TestClient(app)          # ← no cleanup; override leaks
```

**Suggested Fix:**
```python
@pytest.fixture
def client():
    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()
```

**Impact:** Silent test isolation failure. Future tests that intentionally skip the override will unknowingly use the in-memory DB. Difficult to diagnose because all current tests pass.

---

### [MEDIUM] `get_db` missing explicit rollback on exception

**File:** `src/app/database/session.py`
**Line(s):** 16–20
**Category:** correctness

**Problem:**
If a request handler raises an exception mid-transaction (e.g., a DB error after a partial write), `get_db` lands in the `finally` block and calls `db.close()`. SQLAlchemy's `Session.close()` does not issue a rollback — it returns the connection to the pool in its current state. Whether the DBAPI automatically rolls back depends on the driver and pool configuration; it is not guaranteed at the SQLAlchemy layer. The recommended FastAPI + SQLAlchemy pattern includes an explicit rollback to leave the session in a clean state.

**Code:**
```python
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

**Suggested Fix:**
```python
def get_db():
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
```

**Impact:** Under concurrent load or on DB errors, stale transactions may pollute the connection pool, causing hard-to-reproduce data integrity issues in subsequent requests.

---

### [MEDIUM] `test_engine_uses_database_url_env_or_default` assertion too loose

**File:** `test/test_session_dependency.py`
**Line(s):** 48–53
**Category:** correctness

**Problem:**
The test asserts that the engine URL contains `'sqlite'` or `'postgresql'` — this is true of virtually any SQLAlchemy URL and would pass even if the default was `sqlite:///:memory:`, `sqlite:///wrong.db`, or any other sqlite path. The test does not verify the *actual* default value (`sqlite:///./poker.db`) specified in the implementation, nor does it test that `DATABASE_URL` env var changes the engine URL (since the module is already imported by the time the test runs).

**Code:**
```python
def test_engine_uses_database_url_env_or_default(self):
    module = importlib.import_module('app.database.session')
    url = str(module.engine.url)
    assert 'sqlite' in url or 'postgresql' in url, \
        "engine URL must be sqlite (default) or configurable via DATABASE_URL"
```

**Suggested Fix:**
Split into two tests: one that verifies the specific default URL, and one that uses `importlib.reload` with a mocked `DATABASE_URL` env var to verify the env-var path:
```python
def test_default_engine_url_is_poker_db(self):
    module = importlib.import_module('app.database.session')
    assert str(module.engine.url) == 'sqlite:///./poker.db'

def test_engine_respects_database_url_env_var(self, monkeypatch):
    monkeypatch.setenv('DATABASE_URL', 'sqlite:///./custom.db')
    import app.database.session as sess
    importlib.reload(sess)
    assert 'custom.db' in str(sess.engine.url)
```

**Impact:** The test gives false confidence. The default URL could silently regress to a wrong path and the test would still pass.

---

### [LOW] `get_db` missing return type annotation

**File:** `src/app/database/session.py`
**Line(s):** 16
**Category:** convention

**Problem:**
`get_db` is the primary dependency injected across all routers. Missing a type annotation means static analysis tools (mypy, pyright) cannot verify that callers correctly type the `db` parameter, and the function's contract is only self-documenting at runtime.

**Suggested Fix:**
```python
from typing import Generator
from sqlalchemy.orm import Session

def get_db() -> Generator[Session, None, None]:
```

**Impact:** Reduces type-checker effectiveness for callers in T-011 onward.

---

### [LOW] Path-relative assertions in test file assume pytest CWD = project root

**File:** `test/test_session_dependency.py`
**Line(s):** 9, 43, 48, 57, 64, 70
**Category:** convention

**Problem:**
Multiple tests use bare relative paths like `Path('src/app/database/session.py').exists()` and `Path('src/app/routes/game.py').read_text()`. These resolve relative to the working directory at test invocation time. Running `pytest` from a subdirectory or from an IDE that sets CWD differently would cause `FileNotFoundError` or silently incorrect `.exists()` results without a clear error message.

**Suggested Fix:**
Anchor paths to the repository root via `__file__`:
```python
PROJECT_ROOT = Path(__file__).parent.parent  # test/ → project root

def test_session_module_file_exists(self):
    assert (PROJECT_ROOT / 'src/app/database/session.py').exists()
```

**Impact:** Tests are fragile in non-standard execution environments (CI runners, IDEs, Docker) that don't set CWD to the project root.

---

### [LOW] No test covers the env-var code path for `DATABASE_URL`

**File:** `test/test_session_dependency.py`
**Line(s):** 48–53
**Category:** correctness

**Problem:**
The entire rationale for reading `DATABASE_URL` from the environment is to support non-SQLite deployments. No test exercises the env-var branch (i.e., `DATABASE_URL` set to a non-default value). The existing test imports the already-initialized module, so it only exercises the default branch. The env-var branch is untested.

**Suggested Fix:**
Add a test using `monkeypatch.setenv` + `importlib.reload` (see MEDIUM finding above for a code sketch).

**Impact:** The env-var pathway — the primary production pathway — has zero test coverage.

---

## Positives

- **Clean module design:** `session.py` is focused, minimal, and correctly separates engine configuration from model definitions. The 21-line file does exactly one thing.
- **Correct FastAPI dependency pattern:** `get_db` as a generator with `try/finally` is the right idiom for session lifecycle management in FastAPI.
- **Complete deduplication:** `create_engine` and `SessionLocal` were fully removed from `database_models.py` and `game.py` with no remnants — confirmed by grep. No partial refactor.
- **Test structure:** `test_session_dependency.py` is well-organized into three logical test classes (`TestSessionModuleExists`, `TestNoDuplicateEngineCreation`, `TestSharedGetDbWorksWithOverride`) with clear docstrings.
- **Source-based structural tests:** Using `Path.read_text()` to assert structural properties (no `create_engine` in game.py) is a lightweight, readable way to enforce the "no duplication" constraint without needing mock DI wiring.
- **`StaticPool` in test conftest:** Using `StaticPool` for the in-memory test engine is the correct SQLAlchemy pattern to ensure all connections share a single in-memory database, preventing the "tables not found" issue common with SQLite in-memory + testing.

---

## Overall Assessment

T-010 is **functional and correct for its primary use case.** All three acceptance criteria are satisfied: `session.py` exists with the required exports, `game.py` uses the shared dependency, and no duplicate engine creation remains.

The two HIGH findings should be addressed before downstream tasks (T-011, T-025, T-039) build on this infrastructure:

1. **`check_same_thread` conditionality** (HIGH) is a real runtime bug that will block any PostgreSQL deployment — a one-line fix.
2. **`dependency_overrides` leak** (HIGH) is a test isolation defect that becomes progressively harder to debug as the test suite grows — a two-line fix (change `return` to `yield`, add `.clear()`).

The two MEDIUM findings are test quality issues that reduce confidence in the implementation's correctness guarantees. The three LOW findings are conventions that should be addressed in the normal course of future tasks.

**Recommendation:** Address the two HIGH findings in a follow-up before T-011 lands.
