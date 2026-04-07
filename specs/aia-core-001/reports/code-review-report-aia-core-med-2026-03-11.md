# Code Review Report — aia-core-001

**Date:** 2026-03-11
**Target:** `test/conftest.py` — `client` fixture (lines 33–37)
**Reviewer:** Scott (automated)

**Task:** T-049 — Fix: client fixture in conftest.py must yield and clear dependency_overrides
**Beads ID:** aia-core-med

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 0 |
| LOW | 2 |
| **Total Findings** | **2** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | `client` fixture uses `yield` instead of `return` | SATISFIED | `test/conftest.py` line 36 — `yield TestClient(app)` | Confirmed in commit 95c56aa |
| 2 | `app.dependency_overrides.clear()` called in teardown (after yield) | SATISFIED | `test/conftest.py` line 37 — `app.dependency_overrides.clear()` | Executes after every test that uses `client` |
| 3 | No regressions — all existing tests pass | SATISFIED | `173 passed, 2 warnings in 1.26s` | Verified by running `pytest test/` |

---

## Findings

### [LOW] `.clear()` removes all overrides, not just the one this fixture owns

**File:** `test/conftest.py`
**Line(s):** 37
**Category:** correctness

**Problem:**
`app.dependency_overrides.clear()` wipes every entry from the `dependency_overrides` dict, including any overrides that may have been added by other fixtures or test-level setup running concurrently with or alongside this one. The fixture only registered one key (`get_db`), so the teardown should only remove that key.

In the current codebase there is only one override (`get_db`), so `.clear()` produces the same result as a targeted removal — no active bug. However, the pattern is broader than the fixture's ownership and would silently strip overrides added by future fixtures, masking misconfiguration.

**Code:**
```python
app.dependency_overrides[get_db] = override_get_db
yield TestClient(app)
app.dependency_overrides.clear()   # removes ALL overrides
```

**Suggested Fix:**
```python
app.dependency_overrides[get_db] = override_get_db
yield TestClient(app)
app.dependency_overrides.pop(get_db, None)   # only removes what this fixture owns
```

**Impact:** Low — no current test is affected. Risk surfaces only if additional dependency overrides are introduced in the future.

---

### [LOW] `TestClient` is not used as a context manager — lifespan events are not exercised

**File:** `test/conftest.py`
**Line(s):** 36
**Category:** convention

**Problem:**
FastAPI's recommended test pattern wraps `TestClient` in a `with` block:

```python
with TestClient(app) as client:
    yield client
```

The `with` form calls `__enter__` / `__exit__`, which triggers the app's `startup` and `shutdown` lifespan event handlers (if any are registered). The current bare `yield TestClient(app)` skips those lifecycle hooks.

For the present app there are no registered lifespan handlers, so tests pass correctly. If startup/shutdown hooks are added later (e.g., creating connection pools, loading caches), tests using the bare client would silently fail to exercise that code.

**Code:**
```python
yield TestClient(app)          # lifespan events not triggered
```

**Suggested Fix:**
```python
with TestClient(app) as client:
    yield client               # lifespan startup fires before yield, shutdown fires after
```

**Impact:** Low — no current regression. Risk surfaces if `@app.on_event("startup")` or a lifespan context manager is added in the future.

---

## Positives

- **Minimal, focused change.** The commit modifies exactly two lines — replacing `return` with `yield` and appending the teardown. No unrelated edits, no scope creep.
- **Correct fundamental fix.** The `return → yield` transformation is precisely what is required to give a pytest fixture a teardown phase. The teardown is unconditional (not guarded by an `if`), so it fires even if the test raises.
- **Full test suite passes.** 173/173 tests pass after the change with no new failures or warnings introduced by the fix.
- **Clear commit message.** `fix(test): client fixture yield + dependency_overrides teardown (T-049)` follows conventional commit format and references the task ID.

---

## Overall Assessment

The fix is **correct and sufficient**. T-049's acceptance criteria are fully satisfied: the `client` fixture now uses `yield`, the override is cleared on teardown, and test isolation is restored. Both LOW findings are pre-existing patterns that introduce no active defects; they are worth noting for future robustness but do not require immediate follow-up.

**Recommendation:** Approve and close. If lifespan event handlers are ever introduced, revisit the `with TestClient(app)` pattern (LOW-2) at that time.
