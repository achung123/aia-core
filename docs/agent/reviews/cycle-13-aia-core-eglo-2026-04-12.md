# Code Review Report — aia-core

**Date:** 2026-04-12
**Target:** `test/test_dealer_flow_integration.py`
**Reviewer:** Scott (automated)

**Task:** T-041 — Dealer flow integration test
**Beads ID:** aia-core-eglo
**Cycle:** 13

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
| 1 | Test creates a game with 3 players, starts a hand via POST /hands/start | SATISFIED | `test_dealer_flow_integration.py` L55-77 — creates game with Alice/Bob/Charlie, starts hand, asserts 3 PlayerHands | SB/BB assigned and distinct |
| 2 | Records community cards (flop + turn + river) via PATCH endpoints | SATISFIED | `test_dealer_flow_integration.py` L79-108 — flop/turn/river each asserted on response | Cards re-verified at final state (L177-181) |
| 3 | Records fold for one player, gets equity for remaining two | PARTIAL | `test_dealer_flow_integration.py` L110-135 — fold + equity called and asserted | Missing negative assertion that Charlie is excluded from equity results |
| 4 | Calls PATCH .../result for each player | SATISFIED | `test_dealer_flow_integration.py` L137-155 — Alice won, Bob lost, Charlie folded | profit_loss values asserted for all three |
| 5 | Verifies final hand state: all players have results, community cards recorded, SB/BB assigned | SATISFIED | `test_dealer_flow_integration.py` L157-199 — GET hand + GET status both verified | Comprehensive final-state check |
| 6 | uv run pytest test/ passes | SATISFIED | Confirmed: 1 passed in 0.24s | Full suite: 1207/1207 at close time |

---

## Findings

### [HIGH] Missing negative assertion for folded player equity

**File:** `test/test_dealer_flow_integration.py`
**Line(s):** 127-135
**Category:** correctness

**Problem:**
AC 3 requires verifying equity "for remaining two" after Charlie folds. The test asserts Alice and Bob appear in equity results and that each equity is in [0, 1], but never asserts that Charlie is *excluded* from the equity response. The comment on line 134 states "Charlie has no cards assigned → no equity" but this is not backed by an assertion. If a regression caused folded/cardless players to receive equity values, this test would not catch it.

**Code:**
```python
equity_names = {e['player_name'] for e in equity_data['equities']}
# Alice and Bob have cards → they get equity
assert 'Alice' in equity_names
assert 'Bob' in equity_names
# Charlie has no cards assigned → no equity (folded, null cards)
for entry in equity_data['equities']:
    assert 0.0 <= entry['equity'] <= 1.0
```

**Suggested Fix:**
Add explicit negative assertion and count check:
```python
assert 'Charlie' not in equity_names
assert len(equity_data['equities']) == 2
```

**Impact:** A regression in the equity endpoint that returns equity for players without hole cards would go undetected.

---

### [MEDIUM] SB/BB rotation not tested across hands

**File:** `test/test_dealer_flow_integration.py`
**Line(s):** 64-72
**Category:** correctness

**Problem:**
The test starts only a single hand and verifies that `sb_player_name` and `bb_player_name` are assigned and distinct. However, SB/BB rotation — where the blind positions advance to different players on the next hand — is never exercised. Starting a second hand and asserting that the SB/BB players differ from hand 1 would strengthen the integration coverage.

**Code:**
```python
assert hand['sb_player_name'] is not None
assert hand['bb_player_name'] is not None
assert hand['sb_player_name'] != hand['bb_player_name']
```

**Suggested Fix:**
After completing hand 1, start a second hand and assert rotation:
```python
start_resp_2 = client.post(f'/games/{game_id}/hands/start')
hand_2 = start_resp_2.json()
assert hand_2['sb_player_name'] != hand['sb_player_name']
assert hand_2['bb_player_name'] != hand['bb_player_name']
```

**Impact:** Blind rotation is a core dealer mechanic; without this, a rotation bug could ship undetected by the integration test.

---

### [LOW] Equity values not validated to sum to ~1.0

**File:** `test/test_dealer_flow_integration.py`
**Line(s):** 131-135
**Category:** correctness

**Problem:**
Each player's equity is range-checked (`0.0 <= equity <= 1.0`) but the test does not verify that all returned equities sum to approximately 1.0. A calculation bug that returned, e.g., 0.5 for both players (correct individually) but forgot to account for tie equity would still pass.

**Code:**
```python
for entry in equity_data['equities']:
    assert 0.0 <= entry['equity'] <= 1.0
```

**Suggested Fix:**
```python
total_equity = sum(e['equity'] for e in equity_data['equities'])
assert abs(total_equity - 1.0) < 0.01, f"Equities sum to {total_equity}, expected ~1.0"
```

**Impact:** Minor — other unit tests likely cover equity math, but in an integration test this adds a cheap regression guard.

---

## Positives

- **Follows established codebase conventions exactly** — fixture structure (local engine, `autouse` setup/teardown, client fixture with `dependency_overrides`) mirrors every other test file in the repo.
- **Comprehensive final-state verification** — the test re-fetches the hand via GET and asserts community cards, SB/BB, and all player results rather than trusting earlier PATCH responses alone.
- **Status endpoint cross-check** — verifying `GET .../status` as well as `GET .../hands/{n}` adds a second read path, increasing confidence that the hand state is consistent.
- **Clean sequential flow** — the single-function structure makes the test read like a scenario script; easy to follow and debug. No flaky patterns (no timing, no async, no ordering assumptions beyond the deterministic API calls).
- **AC mapping is explicit** — section comments (`=== AC1 ===`, `=== AC2 ===`, etc.) make traceability trivial.

---

## Overall Assessment

The integration test is well-structured, readable, and covers the core dealer flow end-to-end. It matches existing codebase conventions and passes cleanly. The one HIGH finding (missing negative assertion on equity for folded player) is a real gap in regression protection and should be addressed before this test is considered fully robust. The MEDIUM finding (no SB/BB rotation) is a scope gap that could be addressed in this test or tracked separately. The LOW finding is a nice-to-have hardening step.

**Recommendation:** Fix the HIGH finding (add `assert 'Charlie' not in equity_names` + count check), then this test is solid.
