# Code Review Report — dealer-viz-004

**Date:** 2026-04-09
**Cycle:** 28
**Target:** `test/test_dealer_flow_smoke.py`
**Reviewer:** Scott (automated)

**Task:** T-024 — End-to-end smoke test: full dealer flow
**Beads ID:** aia-core-j7l4

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
| 1 | Backend test: POST empty hand → POST player cards → PATCH results → PATCH community → GET equity — all 200s | SATISFIED | `test_dealer_flow_smoke.py` Steps 1–5 assert 201/200 for every endpoint | All status codes verified |
| 2 | Backend test: Eliminated player (never POSTed) has null cards and null result | SATISFIED | `test_dealer_flow_smoke.py` Step 6 — Dave verified with null card_1, card_2, result | Dave is POSTed with null cards (simulating frontend Finish Hand behavior); see LOW-1 |
| 3 | Frontend checklist covers: game selector, hand dashboard, camera capture, outcome buttons, Table capture, finish hand, dealer preview equity | NOT SATISFIED | No checklist file found in the repository | Missing deliverable — see HIGH-1 |
| 4 | All backend tests pass with `uv run pytest test/` | SATISFIED | `uv run pytest test/test_dealer_flow_smoke.py -v` — 1 passed | Confirmed green |

---

## Findings

### [HIGH] HIGH-1 — Missing frontend manual test checklist

**File:** (none — expected new file)
**Line(s):** N/A
**Category:** correctness

**Problem:**
T-024 AC #3 requires a frontend manual test checklist covering: game selector, hand dashboard, camera capture, outcome buttons, Table capture, finish hand, and dealer preview equity. No such file exists in the repository. The beads close reason says "full dealer flow smoke test covers all 6 steps" but does not mention the frontend checklist.

**Suggested Fix:**
Create a markdown checklist (e.g., `specs/dealer-viz-004/dealer-flow-checklist.md` or `docs/dealer-flow-manual-test-checklist.md`) listing the manual frontend verification steps.

**Impact:** One of four acceptance criteria is entirely unsatisfied.

---

### [MEDIUM] MED-1 — Equity response sum-to-one not validated

**File:** `test/test_dealer_flow_smoke.py`
**Line(s):** 140–149
**Category:** correctness

**Problem:**
The test asserts each equity value is between 0.0 and 1.0, but does not verify that the sum of all equities is approximately 1.0. A bug where the endpoint returned `0.0` for every player would pass the current assertions.

**Code:**
```python
for entry in equity_data['equities']:
    assert 0.0 <= entry['equity'] <= 1.0
```

**Suggested Fix:**
Add a sanity assertion:
```python
total = sum(e['equity'] for e in equity_data['equities'])
assert 0.99 <= total <= 1.01
```

**Impact:** A subtle equity calculation bug (e.g., all-zeros) would silently pass.

---

### [LOW] LOW-1 — AC #2 wording mismatch: "never POSTed" vs actual behavior

**File:** `test/test_dealer_flow_smoke.py`
**Line(s):** 99–105
**Category:** design

**Problem:**
The tasks.md AC #2 says "Eliminated player (never POSTed)" but the test explicitly POSTs Dave with null cards. In practice, the frontend Finish Hand logic does POST eliminated players to the backend (T-016 spec), so the test correctly models the actual flow. The discrepancy is in the AC wording, not the test.

**Impact:** Cosmetic — no behavior bug, but readers may question whether the AC is truly satisfied. Consider updating the AC wording to "Eliminated player POSTed with null cards and null result."

---

### [LOW] LOW-2 — profit_loss values not verified in final state

**File:** `test/test_dealer_flow_smoke.py`
**Line(s):** 108–126
**Category:** correctness

**Problem:**
The test assigns `profit_loss` values (100.0, -50.0, -25.0) in Step 3 and asserts the result enum in the PATCH response, but never verifies that `profit_loss` persists correctly through the final GET hand in Step 6.

**Suggested Fix:**
In Step 6, after retrieving player_hands, assert `profit_loss` values for Alice/Bob/Charlie match what was PATCHed.

**Impact:** Low — profit_loss persistence is covered by other dedicated tests (`test_player_result_patch_api.py`), so this is redundant for a smoke test. Nice-to-have only.

---

## Positives

- **Clean sequential flow** — The single `test_full_dealer_flow` method reads like a script of the actual dealer workflow, making it self-documenting.
- **Good elimination coverage** — Dave's null-card scenario and exclusion from equity are both explicitly verified.
- **Correct DB isolation** — Uses in-memory SQLite with `StaticPool`, creates both `LegacyBase` and `ModelsBase` tables (matching the dual-base pattern used across the test suite).
- **Follows codebase conventions** — DB setup, fixture patterns, and test structure match the established patterns in 20+ existing test files.
- **Meaningful assertions** — Every endpoint response is checked for both status code and key fields; equity includes per-player name checks and range validation.

---

## Overall Assessment

The backend smoke test is well-written and covers AC #1, #2, and #4 comprehensively. The single monolithic test is appropriate for an end-to-end integration scenario. The main gap is the **missing frontend manual test checklist** (AC #3), which is a HIGH finding since it represents an undelivered acceptance criterion. The MEDIUM equity validation note is a hardening suggestion. The two LOW findings are cosmetic.

**Recommendation:** File a follow-up issue for the missing frontend checklist. The backend test itself is solid and requires no code changes to pass review.
