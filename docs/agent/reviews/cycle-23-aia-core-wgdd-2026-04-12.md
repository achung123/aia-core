# Code Review Report — alpha-feedback-008

**Date:** 2026-04-12
**Cycle:** 23
**Target:** `src/app/routes/hands.py`, `test/test_hand_status_etag.py`
**Reviewer:** Scott (automated)

**Task:** T-014 — ETag support on hand status endpoint
**Beads ID:** aia-core-wgdd

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
| 1 | Response includes ETag header (hash of response body) | SATISFIED | `test_hand_status_etag.py::TestHandStatusETagPresent::test_response_includes_etag_header` — asserts `etag` in headers and quotes format; `hands.py` L268 computes MD5 of `model_dump_json()` | ETag is a quoted MD5 hex digest per RFC 7232 |
| 2 | If-None-Match matching current ETag returns 304 with empty body | SATISFIED | `test_hand_status_etag.py::TestHandStatusIfNoneMatch304::test_matching_etag_returns_304` — asserts 304 status and `b''` body; `hands.py` L270-271 | Also verified: non-matching ETag returns 200 |
| 3 | Changed data returns 200 with new ETag | SATISFIED | `test_hand_status_etag.py::TestHandStatusETagChangesWithData::test_etag_changes_when_player_added` and `test_etag_changes_when_cards_set` — both verify new ETag differs from previous | Two mutation scenarios tested |
| 4 | Tests verify 304 and 200 cases | SATISFIED | 6 tests: 2 for ETag presence/determinism, 2 for 304/200 conditional, 2 for data-change invalidation | Good scenario spread |
| 5 | uv run pytest test/ passes | SATISFIED | 1214 tests passing, 0 failures | Confirmed locally |

---

## Findings

### [LOW] `hashlib.md5()` missing `usedforsecurity=False`

**File:** `src/app/routes/hands.py`
**Line(s):** 268
**Category:** convention

**Problem:**
`hashlib.md5(...)` is called without the `usedforsecurity=False` keyword argument (available since Python 3.9). On FIPS-compliant systems, `hashlib.md5()` raises `ValueError` unless this flag is set. Since the hash is used purely as a content fingerprint for cache validation and not for any security purpose, the flag should be explicit.

**Code:**
```python
etag = '"' + hashlib.md5(body.model_dump_json().encode()).hexdigest() + '"'
```

**Suggested Fix:**
```python
etag = '"' + hashlib.md5(body.model_dump_json().encode(), usedforsecurity=False).hexdigest() + '"'
```

**Impact:** No impact on current deployments. Would cause a runtime crash if the app is ever deployed on a FIPS-enforcing host.

---

### [LOW] `If-None-Match` multi-value / wildcard not handled

**File:** `src/app/routes/hands.py`
**Line(s):** 269
**Category:** correctness

**Problem:**
RFC 7232 §3.2 allows `If-None-Match` to carry a comma-separated list of ETags (e.g., `"etag1", "etag2"`) or the wildcard `*`. The current check (`if_none_match == etag`) only matches a single exact value. A client sending multiple ETags or `*` would never get a 304.

**Code:**
```python
if if_none_match and if_none_match == etag:
    return Response(status_code=304, headers={'etag': etag})
```

**Suggested Fix:**
```python
if if_none_match:
    tags = [t.strip() for t in if_none_match.split(',')]
    if '*' in tags or etag in tags:
        return Response(status_code=304, headers={'etag': etag})
```

**Impact:** Negligible for the current single-client polling use case. Would matter if a shared cache or proxy aggregates ETags.

---

## Positives

- **Correct ETag format:** Quoted hex digest per RFC 7232; strong validator is appropriate for byte-identical JSON output.
- **Deterministic serialization:** Using `model_dump_json()` on a frozen Pydantic model ensures the same data always produces the same hash — no dict-ordering surprises.
- **Clean separation:** ETag logic is self-contained within the endpoint (6 lines) and doesn't bleed into other routes.
- **Good test coverage:** Six tests cover presence, determinism, 304 match, 200 mismatch, and two data-mutation invalidation scenarios. All three ACs have dedicated test classes.
- **Consistent test file structure:** Follows the same DB setup pattern used by other test files in the project.
- **No sensitive data leakage:** The ETag is a one-way MD5 hash; the response payload (player names, cards, participation status) cannot be reconstructed from it.

---

## Overall Assessment

The ETag implementation is clean, minimal, and correct for the intended single-client polling use case. All five acceptance criteria are satisfied with strong test evidence. The two LOW findings are minor RFC compliance and portability nits — neither affects current functionality or security. No CRITICAL findings; safe to commit.
