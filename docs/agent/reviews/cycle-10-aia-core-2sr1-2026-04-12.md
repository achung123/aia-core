# Code Review Report — aia-core

**Date:** 2026-04-12
**Target:** `POST /games/{game_id}/hands/{hand_number}/players/{player_name}/actions`
**Reviewer:** Scott (automated)
**Cycle:** 10

**Task:** T-009 — Record player action endpoint
**Beads ID:** aia-core-2sr1

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 2 |
| LOW | 1 |
| **Total Findings** | **3** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | Accepts `{ "street": str, "action": str, "amount": float \| null }` | SATISFIED | `PlayerActionCreate` in `src/pydantic_models/app_models.py` L420-L427; test_fold, test_check, test_bet all confirm shape | |
| 2 | Validates street in {preflop, flop, turn, river}; action in {fold, check, call, bet, raise} | SATISFIED | `StreetEnum` L22-L27, `ActionEnum` L412-L418 in `app_models.py`; `test_invalid_street` and `test_invalid_action` confirm 422 | Pydantic enum coercion handles this cleanly |
| 3 | Returns 201 with created action record | SATISFIED | `status_code=201` on decorator L1087; all happy-path tests assert 201 with `action_id`, `created_at`, etc. | |
| 4 | Returns 404 for missing game/hand/player | SATISFIED | `record_player_action` L1098-L1131 raises HTTPException(404) for each entity; 4 dedicated 404 tests cover game, hand, player-not-in-hand, and player-not-found | |
| 5 | Tests cover all action types, validation errors, and 404 cases | SATISFIED | 18 tests: 8 happy-path (all 5 action types + amount default + player_hand_id + multiple actions), 5 validation, 4 not-found, 1 case-insensitive | Thorough coverage |
| 6 | `uv run pytest test/` passes | SATISFIED | 1076 passed, 0 failed (verified during review) | |

---

## Findings

### [MEDIUM] No validation for negative bet amounts

**File:** `src/pydantic_models/app_models.py`
**Line(s):** 426
**Category:** correctness

**Problem:**
`PlayerActionCreate.amount` accepts any `float | None`, including negative values. A request like `{"street": "preflop", "action": "bet", "amount": -50.0}` will be persisted to the database. While this doesn't break anything structurally, it allows semantically invalid poker actions.

**Code:**
```python
amount: float | None = None
```

**Suggested Fix:**
Add a `Field` constraint to enforce non-negative amounts:
```python
amount: float | None = Field(default=None, ge=0)
```

**Impact:** Invalid data can accumulate in the database, corrupting downstream analytics (e.g., pot size calculations, player stats).

---

### [MEDIUM] No semantic validation of amount vs action type

**File:** `src/app/routes/hands.py`
**Line(s):** 1133-1140
**Category:** correctness

**Problem:**
The endpoint allows semantically inconsistent combinations:
- `fold` with `amount: 100.0` (a fold never has an amount)
- `bet` with `amount: null` (a bet must have an amount)
- `check` with `amount: 50.0` (a check has no amount)

These are persisted without warning. While flexibility may be intentional for MVP, the lack of validation means the data model doesn't enforce poker rules.

**Code:**
```python
action = PlayerHandAction(
    player_hand_id=player_hand.player_hand_id,
    street=payload.street,
    action=payload.action,
    amount=payload.amount,
)
```

**Suggested Fix:**
Add a `model_validator` to `PlayerActionCreate` to enforce semantic consistency:
```python
@model_validator(mode='after')
def _validate_amount_for_action(self):
    no_amount_actions = {'fold', 'check'}
    if self.action in no_amount_actions and self.amount is not None:
        raise ValueError(f'{self.action} should not have an amount')
    if self.action in {'bet', 'raise'} and self.amount is None:
        raise ValueError(f'{self.action} requires an amount')
    return self
```

**Impact:** Inconsistent action records undermine data quality. Consider implementing this if the frontend doesn't already enforce these rules on the client side.

---

### [LOW] Test file duplicates conftest DB boilerplate

**File:** `test/test_player_actions_api.py`
**Line(s):** 8-35
**Category:** convention

**Problem:**
The test file defines its own `engine`, `SessionLocal`, `override_get_db`, `setup_db` fixture, and `client` fixture, duplicating what `conftest.py` already provides.

**Code:**
```python
DATABASE_URL = 'sqlite:///:memory:'
engine = create_engine(
    DATABASE_URL, connect_args={'check_same_thread': False}, poolclass=StaticPool
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
# ... etc.
```

**Suggested Fix:**
This is the established codebase convention (18+ test files follow this pattern), so no action is required for this task. A future tech-debt cleanup could centralize all test files to use conftest fixtures exclusively.

**Impact:** None in practice — matches existing convention. Noted for awareness only.

---

## Positives

- **Clean 4-step 404 cascade**: The endpoint validates game → hand → player → player_hand in sequence, with clear error messages at each step. This matches the existing route patterns perfectly.
- **Case-insensitive player lookup**: Using `func.lower()` on both the column and input is a nice touch that prevents user-facing case sensitivity bugs. A test explicitly verifies this.
- **SQLAlchemy ORM prevents SQL injection**: All queries use parameterized ORM methods — no raw SQL or string interpolation. The `player_name` path parameter is only used in a parameterized `.filter()`, not interpolated into a query string.
- **Proper FK linking**: The endpoint correctly looks up the `PlayerHand` by `hand_id` + `player_id` (not by name), ensuring referential integrity.
- **Good test structure**: Tests are organized into logical groups (happy path, validation, 404s) with descriptive names and proper assertions on response shape.
- **Alembic migration present**: `4d88a1c3a8d4_add_player_hand_actions_table.py` correctly creates the table with FK constraint and `server_default` for `created_at`.
- **Enum-driven validation**: Using `StreetEnum` and `ActionEnum` in the Pydantic model means Pydantic rejects invalid values before the endpoint code runs — clean separation of validation from business logic.

---

## Overall Assessment

The implementation is solid and well-tested. All 6 acceptance criteria are **SATISFIED**. The code follows existing codebase patterns for route structure, error handling, ORM usage, and test organization. No security issues found — SQLAlchemy ORM prevents injection, and Pydantic enums enforce input validation at the boundary.

The two MEDIUM findings (negative amounts and action-amount semantic consistency) are data quality improvements that could be addressed in a follow-up task. They don't represent bugs in the current implementation — the endpoint works correctly for all specified acceptance criteria.

**Verdict:** PASS — no critical or high findings. Ready for merge.
