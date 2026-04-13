# Code Review Report — alpha-patch-009

**Date:** 2026-04-12
**Cycle:** 2
**Target:** Betting state machine backend — blinds, turn order, pot, side pots
**Reviewer:** Scott (automated)

**Task:** T-002 — Betting state machine backend
**Beads ID:** aia-core-ndtd
**Epic:** alpha-patch-009

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 3 |
| MEDIUM | 5 |
| LOW | 4 |
| **Total Findings** | **12** |

All 1294 tests pass (31 new in `test_betting_state_machine.py`). No regressions detected.

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | `start-all` creates blind actions and initializes pot = SB + BB; HandState points to UTG | SATISFIED | `TestBlindPosting` (3 tests); `start_hand()` in `hands.py` L500-540 | Blind actions created, pot initialized, UTG assigned correctly |
| 2 | `start-all` returns 400 if fewer than 2 active players | SATISFIED | `TestStartHandMinPlayers::test_fewer_than_2_returns_400`; `hands.py` L421-425 | Clean 400 with descriptive message |
| 3 | `GET .../status` returns `current_player_name`, `legal_actions`, `amount_to_call`, `pot`, `side_pots` | SATISFIED | `TestHandStatusBettingFields` (4 tests); `get_hand_status()` L249-340 | All fields present and correctly computed |
| 4 | `POST .../actions` returns 403 when a non-current player submits an action | SATISFIED | `TestTurnOrderEnforcement` (2 tests); `record_player_action()` L1497-1508 | 403 with descriptive message; `force=true` bypass works |
| 5 | After a valid action, `current_seat` advances correctly; after street completion, `phase` advances | SATISFIED | `TestSeatAndPhaseAdvancement` (3 tests); `_next_seat()`, `_try_advance_phase()` | Advancement works for both simple call rounds and raise scenarios |
| 6 | Fold-to-one ends the hand and sets the remaining player's result to `won` | SATISFIED | `TestFoldToOne` (3 tests); `record_player_action()` L1553-1562 | Winner set, phase moves to showdown, current_seat cleared |
| 7 | `pot` accumulates correctly across call/bet/raise/blind actions | SATISFIED | `TestPotTracking` (2 tests); `record_player_action()` L1543-1544 | Amounts accumulate correctly, though client-side amounts are trusted (see Finding 7) |
| 8 | All-in-for-less triggers side-pot creation with correct eligible player lists | PARTIAL | `TestSidePots` (2 tests); `compute_side_pots()` in `betting.py` | Works for call-based all-in only. All-in via bet/raise is not detected (see Finding 2) |
| 9 | When no all-in, `side_pots` is `[]` and `pot` holds the full amount | SATISFIED | `TestNoSidePots::test_no_side_pots_without_all_in` | Clean empty array when no all-in players |
| 10 | Alembic migration passes `alembic upgrade head` and `alembic downgrade -1` cleanly | SATISFIED | Migration `a40bc0cc2015`; uses `batch_alter_table` with `server_default` | Correct batch-mode for SQLite, clean upgrade/downgrade |
| 11 | Pytest tests cover all specified scenarios | SATISFIED | 31 tests in `test_betting_state_machine.py` | Covers blind posting, preflop round, street transitions, fold-to-one, side-pot creation, legal action calculation, street completion |

---

## Findings

### [HIGH-1] No validation on negative action amounts

**File:** `src/pydantic_models/app_models.py`
**Line(s):** 495-502
**Category:** security

**Problem:**
`PlayerActionCreate.amount` is `float | None` with no lower-bound constraint. A malicious client can submit a negative amount on a call/bet/raise action, which would subtract from the pot (line 1543 of `hands.py`: `hand.pot = (hand.pot or 0) + payload.amount`).

**Code:**
```python
class PlayerActionCreate(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    street: StreetEnum
    action: ActionEnum
    amount: float | None = None  # no minimum constraint
```

**Suggested Fix:**
Add `Field(ge=0)` to the amount field:
```python
amount: float | None = Field(default=None, ge=0)
```

**Impact:** A negative amount would corrupt pot state, potentially causing negative pot values and incorrect accounting.

---

### [HIGH-2] All-in detection only fires on calls, missing bet/raise all-ins

**File:** `src/app/routes/hands.py`
**Line(s):** 1548-1550
**Category:** correctness

**Problem:**
The all-in detection logic only checks `if payload.action == 'call'` to determine if a player went all-in for less. Players who go all-in via a bet or raise are never flagged as `is_all_in = True`, meaning side pots won't be computed correctly when a player shoves.

**Code:**
```python
# Detect all-in-for-less
if payload.action == 'call' and payload.amount is not None and amount_to_call > 0:
    if payload.amount < amount_to_call:
        player_hand.is_all_in = True
```

**Suggested Fix:**
Without stack tracking, the backend cannot independently verify all-in status. Two options:
1. Accept an `is_all_in` flag in `PlayerActionCreate` and trust the client/dealer
2. Add stack tracking (out of scope for this task)

For now, extending the detection to include a client-supplied field would close the gap for bet/raise all-ins.

**Impact:** AC 8 is only PARTIAL. Side-pot calculations will be incorrect when a player goes all-in via bet/raise.

---

### [HIGH-3] Side pot `eligible_player_ids` exposes internal DB IDs

**File:** `src/app/services/betting.py` L76-82, `src/app/routes/hands.py` L1555-1565
**Category:** design

**Problem:**
The `side_pots` JSON serialized into `Hand.side_pots` and returned in API responses contains `eligible_player_ids` as raw integer database primary keys. The frontend has no mapping from player_id to player name without an additional lookup, and exposing internal IDs is an information leak.

**Code:**
```python
pots.append({
    'amount': pot_amount,
    'eligible_player_ids': list(remaining),
})
```

**Suggested Fix:**
Map player IDs to names before serializing to the response in `_build_hand_response()` and `get_hand_status()`, or change the pure function's interface to accept and return names. Example:
```python
'eligible_players': [player_name_map[pid] for pid in remaining]
```

**Impact:** Frontend cannot display side pot eligibility without additional round trips; internal IDs exposed in the API surface.

---

### [MEDIUM-1] MD5 used for ETag generation

**File:** `src/app/routes/hands.py`
**Line(s):** 327
**Category:** security

**Problem:**
`hashlib.md5()` is used to compute the ETag. While not security-critical in a caching context, MD5 is considered deprecated and security scanners will flag it. Some environments may have MD5 disabled in FIPS mode.

**Code:**
```python
etag = '"' + hashlib.md5(body.model_dump_json().encode()).hexdigest() + '"'
```

**Suggested Fix:**
```python
etag = '"' + hashlib.sha256(body.model_dump_json().encode()).hexdigest()[:32] + '"'
```

**Impact:** Audit/compliance flag. No practical exploit risk.

---

### [MEDIUM-2] Untyped `side_pots: list` in Pydantic models

**File:** `src/pydantic_models/app_models.py`
**Line(s):** 250, 440
**Category:** design

**Problem:**
`side_pots: list = []` uses a bare `list` type without specifying the element type. This defeats Pydantic's validation (any value is accepted) and OpenAPI schema generation (documented as `array` with no item schema).

**Suggested Fix:**
Define a `SidePotEntry` model:
```python
class SidePotEntry(BaseModel):
    amount: float
    eligible_player_ids: list[int]
```
Then use `side_pots: list[SidePotEntry] = []`.

**Impact:** Weak contract between backend and frontend; no validation of side pot structure.

---

### [MEDIUM-3] No validation that submitted action is legal

**File:** `src/app/routes/hands.py`
**Line(s):** 1457-end
**Category:** correctness

**Problem:**
The `record_player_action` endpoint enforces turn order but does not validate that the submitted action is in the legal action set. A player could submit `check` when they owe a call, or `bet` when they should `call/raise`.

**Suggested Fix:**
Before recording the action, call `get_legal_actions()` and reject with 400 if `payload.action` is not in the returned list:
```python
la = get_legal_actions(hand_state.phase, actions_data, player.player_id, (sb, bb))
if payload.action not in la['legal_actions']:
    raise HTTPException(status_code=400, detail=f"Illegal action: {payload.action}")
```

**Impact:** Invalid game states are possible without this check.

---

### [MEDIUM-4] Pot calculation trusts client-supplied amount

**File:** `src/app/routes/hands.py`
**Line(s):** 1543-1544
**Category:** correctness

**Problem:**
The pot is incremented by `payload.amount` without server-side validation. For a call, the amount should equal `amount_to_call`. For a raise, it should meet minimum raise rules. A client could submit `call` with an arbitrary amount.

**Suggested Fix:**
For calls, validate `payload.amount == amount_to_call` (or `<= amount_to_call` for all-in). For bets/raises, validate against minimum raise thresholds.

**Impact:** Pot integrity depends entirely on client correctness. In a dealer-verified flow this is acceptable but not idempotent.

---

### [MEDIUM-5] GET `/state` endpoint mutates via `_try_advance_phase`

**File:** `src/app/routes/hands.py`
**Line(s):** 559-560
**Category:** design

**Problem:**
The `get_hand_state` GET endpoint calls `_try_advance_phase()` and `db.commit()`, producing side effects on a read operation. Concurrent GET requests could trigger unexpected phase transitions.

**Code:**
```python
_try_advance_phase(db, game_id, hand, state)
db.commit()
db.refresh(state)
```

**Suggested Fix:**
Move phase advancement to only occur during POST (action recording or community card dealing). Alternatively, make the GET idempotent by computing the derived state without persisting it.

**Impact:** Violates REST idempotency principle; potential for race conditions under concurrent requests.

---

### [LOW-1] `blind_amounts` parameter in `get_legal_actions` is unused

**File:** `src/app/services/betting.py`
**Line(s):** 6-10
**Category:** design

**Problem:**
The `blind_amounts` tuple is accepted as a parameter but never referenced in the function body. It may be needed for minimum raise calculations in the future but is currently dead code.

**Suggested Fix:**
Remove the parameter or add a `# TODO: use for minimum raise validation` comment.

**Impact:** Minor confusion for callers.

---

### [LOW-2] Multiple players with null seats all map to seat 0

**File:** `src/app/routes/hands.py`
**Line(s):** 73
**Category:** correctness

**Problem:**
`gp.seat_number or 0` maps all null-seat players to seat 0, which could cause ambiguous ordering in `_get_active_seat_order()`.

**Suggested Fix:**
Acceptable given seat assignment is expected before hand start, but the `start-hand` endpoint could validate that all active players have seats assigned.

**Impact:** Edge case — unlikely in production but could cause incorrect turn order if seats aren't assigned.

---

### [LOW-3] `test_fold_action_sets_result.py` uses legacy hand creation endpoint

**File:** `test/test_fold_action_sets_result.py`
**Line(s):** 56-63
**Category:** convention

**Problem:**
This test file creates hands via the old `POST /games/{id}/hands` endpoint (which doesn't create HandState or post blinds) rather than `POST /games/{id}/hands/start`. It bypasses the new betting flow, testing a path that may not be used in production.

**Suggested Fix:**
Consider updating to use the `start` endpoint for consistency, or keep as a deliberate test of the legacy path and add a comment explaining the intent.

**Impact:** Tests pass but exercise a different code path than production.

---

### [LOW-4] No test for action on a completed (showdown) hand

**File:** `test/test_betting_state_machine.py`
**Category:** coverage

**Problem:**
No test verifies that actions are rejected when the hand phase is `showdown` (e.g., after fold-to-one). Currently the code would allow additional actions on a completed hand since there's no phase check in `record_player_action`.

**Suggested Fix:**
Add a test that acts after fold-to-one and expects a 400/403 rejection. Consider adding a guard in `record_player_action` to reject actions when `hand_state.phase == 'showdown'`.

**Impact:** Actions recorded on a completed hand could corrupt game state.

---

## Positives

- **Clean separation of concerns**: `betting.py` contains pure functions with no DB dependencies — excellent for testing and future reuse
- **Comprehensive test suite**: 31 well-structured tests organized by AC, with clear helper functions
- **`force=true` bypass**: Thoughtful escape hatch for dealer override scenarios; existing tests updated to use it
- **Migration quality**: Correct use of `batch_alter_table` for SQLite compatibility, with proper `server_default` values
- **Backward compatibility**: Old hand-recording endpoint still works; new `start-all` endpoint adds behavior without breaking existing paths
- **Street completion logic**: The `is_street_complete()` function handles complex edge cases (BB option, raise re-action, all-in players skipped) correctly

---

## Overall Assessment

The implementation is solid and covers the core betting state machine functionality well. All 1294 tests pass with zero regressions. The code is well-organized with betting logic cleanly separated into a service module.

**Zero CRITICAL findings.** The 3 HIGH findings are all correctness/security gaps at the input boundary:
1. Negative amounts accepted (fix is a one-line Pydantic constraint)
2. All-in detection incomplete for bet/raise (needs design decision on stack tracking)
3. Side pot IDs are internal DB keys (needs mapping layer)

The MEDIUM findings around legal action validation and amount verification are expected for a first-pass implementation where the dealer UI provides a verification layer. These should be prioritized for a subsequent hardening pass.

**Recommendation:** Address HIGH-1 (negative amount validation) immediately as it's a trivial fix. HIGH-2 and HIGH-3 should be tracked as follow-up tasks. MEDIUM findings can be batched into a hardening task.
