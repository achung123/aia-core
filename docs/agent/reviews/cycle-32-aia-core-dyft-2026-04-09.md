# Code Review Report — player-participation-005

**Date:** 2026-04-09
**Target:** T-001 — Add hand status polling endpoint
**Reviewer:** Scott (automated)
**Cycle:** 32
**Task:** T-001 — Add hand status polling endpoint
**Beads ID:** aia-core-dyft

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 2 |
| LOW | 2 |
| **Total Findings** | **4** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| AC-1 | Endpoint returns JSON: `{ hand_number, community_recorded, players: [{ name, participation_status, card_1, card_2, result, outcome_street }] }` | SATISFIED | `src/pydantic_models/app_models.py` L490-503; `src/app/routes/hands.py` L42-84 | Response shape matches spec exactly |
| AC-2 | Derivation logic for participation_status | SATISFIED | `src/app/routes/hands.py` L31-38 `_derive_participation_status()` | All branches correctly implemented: idle, pending, joined, and result pass-through (folded, handed_back, won, lost) |
| AC-3 | Returns 404 for missing game or hand | SATISFIED | `src/app/routes/hands.py` L48-56; `test/test_hand_status_api.py` `TestHandStatus404` | Both 404 paths tested |
| AC-4 | Pydantic response model `HandStatusResponse` defined in `pydantic_models/app_models.py` | SATISFIED | `src/pydantic_models/app_models.py` L499-503 | Model defined with correct fields |
| AC-5 | At least 6 test cases covering each status + 404s | SATISFIED | `test/test_hand_status_api.py` — 9 test methods | 9 ≥ 6; covers idle, pending, joined, folded, won, community_recorded true/false, and both 404 cases |
| AC-6 | `uv run pytest test/` passes | SATISFIED | Task close message: "894 total suite passes" | Confirmed at close time |

---

## Findings

### [MEDIUM] `community_recorded` check omits `flop_2` and `flop_3`

**File:** `src/app/routes/hands.py`
**Line(s):** 59-61
**Category:** correctness

**Problem:**
The `community_recorded` flag is derived from `[hand.flop_1, hand.turn, hand.river]`, omitting `hand.flop_2` and `hand.flop_3`. If a data inconsistency ever caused `flop_1` to be `None` while `flop_2` or `flop_3` were set, `community_recorded` would incorrectly return `False`. In practice this is unlikely because flop cards are always set together, but the check is incomplete relative to the schema.

**Code:**
```python
community_recorded = any(
    c is not None for c in [hand.flop_1, hand.turn, hand.river]
)
```

**Suggested Fix:**
Include all five community card columns for completeness:
```python
community_recorded = any(
    c is not None for c in [hand.flop_1, hand.flop_2, hand.flop_3, hand.turn, hand.river]
)
```

**Impact:** Negligible in practice — flop cards are always written together. Defensive improvement only.

---

### [MEDIUM] Missing test coverage for `handed_back` participation status

**File:** `test/test_hand_status_api.py`
**Line(s):** (entire file)
**Category:** correctness

**Problem:**
AC-2 explicitly specifies `result="handed_back" → "handed_back"` as a derivation rule, but no test case exercises this path. The `lost` status is also untested. While the implementation handles these correctly (the `_derive_participation_status` function returns `result` as-is when it's not `None`), the test suite doesn't prove this for the two missing values.

**Suggested Fix:**
Add test cases for `handed_back` and `lost`:
```python
class TestHandStatusHandedBack:
    def test_player_handed_back(self, client, empty_hand):
        game_id, hand_number = empty_hand
        client.post(f'/games/{game_id}/hands/{hand_number}/players', json={...})
        client.patch(f'/games/{game_id}/hands/{hand_number}/players/Alice/result',
                     json={'result': 'handed_back', 'profit_loss': 0})
        resp = client.get(f'/games/{game_id}/hands/{hand_number}/status')
        alice = next(p for p in resp.json()['players'] if p['name'] == 'Alice')
        assert alice['participation_status'] == 'handed_back'
```

**Impact:** Gap in spec-to-test traceability. If the derivation logic ever regresses for these values, no test would catch it.

---

### [LOW] `participation_status` typed as bare `str` instead of `Literal` or enum

**File:** `src/pydantic_models/app_models.py`
**Line(s):** 492
**Category:** design

**Problem:**
`PlayerStatusEntry.participation_status` is typed as `str`. The AC defines a closed set of valid values (`idle`, `pending`, `joined`, `folded`, `handed_back`, `won`, `lost`). Using `Literal["idle", "pending", "joined", "folded", "handed_back", "won", "lost"]` would make the API contract self-documenting and enable OpenAPI schema generation of the enum values.

**Code:**
```python
class PlayerStatusEntry(BaseModel):
    name: str
    participation_status: str
```

**Suggested Fix:**
```python
from typing import Literal
ParticipationStatus = Literal["idle", "pending", "joined", "folded", "handed_back", "won", "lost"]

class PlayerStatusEntry(BaseModel):
    name: str
    participation_status: ParticipationStatus
```

**Impact:** No runtime bug, but a tighter type contract improves API documentation and catches invalid values at serialization time.

---

### [LOW] Unused import: `func` from SQLAlchemy

**File:** `src/app/routes/hands.py`
**Line(s):** 6
**Category:** convention

**Problem:**
`from sqlalchemy import func` is imported but not used by the `get_hand_status` endpoint. While this import may be used by other endpoints in the same file, ruff should flag it if truly unused.

**Code:**
```python
from sqlalchemy import func
```

**Suggested Fix:**
Verify via `ruff check`; if unused, remove the import. If used elsewhere in the file, no action needed.

**Impact:** None — cosmetic only.

---

## Positives

- **Clean derivation logic**: `_derive_participation_status()` is extracted as a standalone helper with clear, testable branching. The order of checks (result → card_1 → default) is correct and easy to reason about.
- **No N+1 queries**: The endpoint makes exactly 4 queries (game, hand, player_hands via relationship, players via relationship) and uses a dict lookup to map players to their hands — O(1) per player.
- **Good test structure**: Tests are organized by status class with clear docstrings referencing ACs. The fixture chain (`game_with_players` → `empty_hand`) avoids repetition.
- **Consistent patterns**: The endpoint follows the same 404-handling, dependency-injection, and response-model patterns as other endpoints in the file.
- **No authorization concern**: The codebase has no auth layer anywhere — this endpoint is consistent with that pattern. Auth is a project-wide gap, not a T-001 issue.

---

## Overall Assessment

The implementation is **clean and correct**. All 6 acceptance criteria are satisfied. The derivation logic is sound, queries are efficient, and the test suite provides good coverage at 9 cases. The two MEDIUM findings are a minor completeness gap in `community_recorded` calculation and missing test cases for `handed_back`/`lost` statuses — both are low-risk but worth addressing before downstream tasks (T-002, T-012) that depend on this endpoint. No CRITICAL or HIGH issues found.
