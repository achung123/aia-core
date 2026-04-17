# Code Review Report — alpha-feedback-008

**Date:** 2026-04-12
**Target:** `test/test_player_flow_integration.py`
**Reviewer:** Scott (automated)

**Task:** T-042 — Player flow integration test
**Beads ID:** aia-core-6pai

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 1 |
| LOW | 2 |
| **Total Findings** | **3** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | Test creates a game, starts a hand, simulates player joining | SATISFIED | `test_player_flow_integration.py` L55–L82 — creates game with 3 players, starts hand, polls status | Status endpoint confirms all 3 players present with participation status |
| 2 | Records hole cards via PATCH, then records bet/check/fold actions via POST | SATISFIED | L84–L161 — PATCH hole cards for all 3 players; POST actions: bet (Alice preflop), call (Bob preflop), fold (Charlie preflop), check (Alice flop/river), bet (Bob flop), call (Alice flop), check (Bob river) | All 4 action types covered: bet, check, call, fold |
| 3 | After hand finalization, verifies player can see showdown results | SATISFIED | L164–L212 — records results via PATCH, then verifies via GET hand detail AND GET hand status | Both endpoints cross-checked for all 3 players' results, profit/loss, and cards |
| 4 | Verifies actions retrievable via GET /hands/{num}/actions | SATISFIED | L214–L252 — GET returns all 8 actions with correct player names, streets, action types, amounts, ordering, and timestamps | Full positional assertion on all 8 actions |
| 5 | uv run pytest test/ passes | SATISFIED | Test run confirmed: 1 passed in 0.33s | N/A |

---

## Findings

### [MEDIUM] Unchecked status codes on 4 API calls

**File:** `test/test_player_flow_integration.py`
**Line(s):** 130–181
**Category:** correctness

**Problem:**
Four API calls have no status code or response body assertion:
- L130: `client.patch(…/flop, …)` — flop community cards
- L164: `client.patch(…/turn, …)` — turn community card
- L168: `client.patch(…/river, …)` — river community card
- L174–181: Two `client.post(…/actions…)` — Alice and Bob river checks

If any of these silently return an error (e.g., 422 validation error), the test would still proceed and fail later at the action-count assertion (`assert len(actions) == 8`) with a confusing message that doesn't point to the real cause.

**Code:**
```python
# Line 130 — no assertion on response
client.patch(
    f'/games/{game_id}/hands/{hand_number}/flop',
    json={...},
)

# Lines 174-177 — no assertion on response
client.post(
    f'/games/{game_id}/hands/{hand_number}/players/Alice/actions?force=true',
    json={'street': 'river', 'action': 'check'},
)
```

**Suggested Fix:**
Capture the response and assert `status_code == 200` (for PATCH) or `201` (for POST) on all 4 calls, matching the pattern used for the other API calls in this test.

**Impact:** Silent failures could produce misleading test errors, making debugging harder.

---

### [LOW] Turn street not exercised for player actions

**File:** `test/test_player_flow_integration.py`
**Line(s):** 162–181
**Category:** design

**Problem:**
The test covers actions on preflop, flop, and river streets but skips the turn street entirely. While the AC doesn't require all four streets, exercising turn would provide fuller coverage of the action-per-street matrix and increase confidence that street routing works uniformly.

**Suggested Fix:**
Add a check or bet action on the turn street between the turn community card and river community card. Not required for AC satisfaction — just a coverage improvement.

**Impact:** Minor coverage gap; turn-street action routing remains untested by this file (may be covered elsewhere).

---

### [LOW] Duplicate fixture boilerplate

**File:** `test/test_player_flow_integration.py`
**Line(s):** 9–42
**Category:** convention

**Problem:**
The file redeclares `engine`, `SessionLocal`, `override_get_db()`, `setup_db`, and `client` fixtures that are identical to those in `conftest.py`. This is ~30 lines of duplicated code.

**Suggested Fix:**
Remove the local declarations and rely on the shared `conftest.py` fixtures. However, this matches the pattern in `test/test_dealer_flow_integration.py` exactly — both integration tests use self-contained fixtures. If this is intentional (test isolation / explicitness), it can stay.

**Impact:** Maintenance burden if shared fixture logic changes; both integration tests would need updating independently.

---

## Positives

- **Comprehensive AC coverage**: All 5 acceptance criteria are directly and demonstrably satisfied.
- **All action types tested**: bet, check, call, and fold are all exercised with response assertions — going beyond the AC's "bet/check/fold" to include call.
- **Dual-endpoint verification**: Results are verified through both `GET /hands/{num}` and `GET /hands/{num}/status`, catching endpoint-specific bugs.
- **Full action audit trail**: All 8 actions are verified positionally with player name, street, action type, amount, and timestamp — making the test a reliable regression net.
- **Pattern consistency**: Structure, naming, and flow match `test_dealer_flow_integration.py` exactly, keeping the test suite consistent.
- **Deterministic**: Synchronous TestClient + in-memory SQLite with StaticPool eliminates flakiness from timing or connection pool races.

---

## Overall Assessment

The test is solid and well-structured. It covers the full player flow end-to-end (join → hole cards → actions → finalization → showdown results → action retrieval) with strong assertions. All 5 acceptance criteria are satisfied. The one MEDIUM finding (unchecked status codes on 4 calls) is a maintainability concern rather than a correctness bug — the test passes and exercises the right paths. No CRITICAL or HIGH issues found.
