# Code Review Report — dealer-viz-004

**Date:** 2026-04-09
**Target:** T-002 — Make HandCreate fields optional
**Reviewer:** Scott (automated)
**Cycle:** 2
**Epic:** dealer-viz-004

**Task:** T-002 — Make HandCreate fields optional
**Beads ID:** aia-core-9obc

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 1 |
| HIGH | 1 |
| MEDIUM | 2 |
| LOW | 0 |
| **Total Findings** | **4** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | `POST /games/{game_id}/hands` with `{}` body returns 201 | SATISFIED | `test/test_empty_hand_creation_api.py::TestEmptyBodyHandCreation::test_empty_body_returns_201` | Tested and passing |
| 2 | Full payload still returns 201 (backwards-compatible) | SATISFIED | `test/test_empty_hand_creation_api.py::TestFullPayloadBackwardsCompatible::test_full_payload_still_works` | Tested and passing |
| 3 | Hand persisted with null community cards and empty player_hands | SATISFIED | `test/test_empty_hand_creation_api.py::TestEmptyBodyHandCreation::test_empty_body_hand_has_null_community_cards` and `test_empty_body_hand_has_empty_player_hands` | Both assertions verified |
| 4 | `uv run pytest test/` passes | SATISFIED | 775 passed, 0 failed | Full suite green |

---

## Findings

### [CRITICAL] `add_player_to_hand()` passes None flop values to duplicate card validator

**File:** `src/app/routes/hands.py`
**Line(s):** 329
**Category:** correctness

**Problem:**
`add_player_to_hand()` unconditionally extends `all_cards` with `[hand.flop_1, hand.flop_2, hand.flop_3]`. Now that hands can be created with null community cards, this injects `None` values into the card list. The `validate_no_duplicate_cards()` function treats `None` as a hashable value — three `None` flops would be detected as "duplicates", raising a spurious `ValueError("Duplicate cards found: None")` and returning a 400 error when attempting to add a player to an empty-body hand.

**Code:**
```python
# src/app/routes/hands.py line 328-329
all_cards = [str(payload.card_1), str(payload.card_2)]
all_cards.extend([hand.flop_1, hand.flop_2, hand.flop_3])
```

**Suggested Fix:**
Filter out None values before extending, consistent with how `record_hand()` already handles this:
```python
all_cards = [str(payload.card_1), str(payload.card_2)]
for card in (hand.flop_1, hand.flop_2, hand.flop_3):
    if card is not None:
        all_cards.append(card)
```

**Impact:** Adding a player to a hand created with an empty body will fail with a 400 error. This blocks the intended workflow of creating an empty hand first, then incrementally adding players.

---

### [HIGH] `edit_player_hole_cards()` passes None flop values to duplicate card validator

**File:** `src/app/routes/hands.py`
**Line(s):** 241
**Category:** correctness

**Problem:**
Same issue as above in a different endpoint. `edit_player_hole_cards()` unconditionally extends `all_cards` with `[hand.flop_1, hand.flop_2, hand.flop_3]`, injecting `None` values when community cards are null. This would cause a spurious duplicate-card error when editing hole cards on a hand with no community cards. Rated HIGH rather than CRITICAL because editing hole cards on an empty hand is a less common workflow (a player must already exist on the hand).

**Code:**
```python
# src/app/routes/hands.py line 240-241
all_cards = [str(payload.card_1), str(payload.card_2)]
all_cards.extend([hand.flop_1, hand.flop_2, hand.flop_3])
```

**Suggested Fix:**
```python
all_cards = [str(payload.card_1), str(payload.card_2)]
for card in (hand.flop_1, hand.flop_2, hand.flop_3):
    if card is not None:
        all_cards.append(card)
```

**Impact:** Editing a player's hole cards on a hand with null community cards fails with a spurious 400 error.

---

### [MEDIUM] No validation that flop cards are provided as a complete set or all null

**File:** `src/pydantic_models/app_models.py`
**Line(s):** 293-298
**Category:** design

**Problem:**
`HandCreate` allows partial flop specification — e.g., `flop_1` set but `flop_2` and `flop_3` null. In poker, a flop is always 3 cards. A partial flop (1 or 2 of 3 cards) is semantically invalid. While this may be intentional for progressive card entry in the dealer interface, there is no model-level validator to enforce "all three or none" if that constraint is desired.

**Code:**
```python
class HandCreate(BaseModel):
    flop_1: Card | None = None
    flop_2: Card | None = None
    flop_3: Card | None = None
```

**Suggested Fix:**
If partial flop should be rejected, add a Pydantic model validator:
```python
@model_validator(mode='after')
def validate_flop_completeness(self):
    flop_cards = [self.flop_1, self.flop_2, self.flop_3]
    provided = sum(1 for c in flop_cards if c is not None)
    if provided not in (0, 3):
        raise ValueError('Flop must have all 3 cards or none')
    return self
```
If partial flop is intentionally allowed (for progressive card entry), document this decision and add a test covering the partial case.

**Impact:** A partial flop could be persisted, leading to inconsistent game state. Low risk if the frontend always sends complete sets.

---

### [MEDIUM] Test file creates its own DB fixtures instead of using shared `conftest.py`

**File:** `test/test_empty_hand_creation_api.py`
**Line(s):** 13-41
**Category:** convention

**Problem:**
The new test file creates its own `engine`, `SessionLocal`, `override_get_db`, and `setup_db` fixture instead of using the shared fixtures from `test/conftest.py`. This duplicates infrastructure and may diverge from the canonical test setup over time.

**Code:**
```python
DATABASE_URL = 'sqlite:///:memory:'
engine = create_engine(
    DATABASE_URL, connect_args={'check_same_thread': False}, poolclass=StaticPool
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    db = SessionLocal()
    ...
```

**Suggested Fix:**
Use the `client` and `db_session` fixtures from `test/conftest.py` (consistent with other test files in the project).

**Impact:** Low immediate risk, but creates maintenance burden if the shared test infrastructure changes.

---

## Positives

- **`record_hand()` correctly handles None cards** — The iteration `for card in (...): if card is not None: all_cards.append(str(card))` is clean and correct.
- **Alembic migration is correct and reversible** — Uses `batch_alter_table` (necessary for SQLite), and `downgrade()` properly reverses the nullable change.
- **Test coverage for the primary ACs is solid** — 7 tests cover empty body, null community cards, empty player_hands, hand numbering, full payload, and partial payload.
- **Pydantic model changes are backwards-compatible** — `Card | None = None` for flop fields and `list[...] = []` for player_entries means existing payloads continue to work unchanged.
- **Database model aligns with migration** — `Hand.flop_1/2/3` columns show `nullable=True` in both the model definition and the migration.

---

## Overall Assessment

The core task — making `HandCreate` fields optional — is implemented correctly and the 4 acceptance criteria are all satisfied. However, there is a **CRITICAL** bug introduced by this change in a sibling endpoint (`add_player_to_hand`) that now passes `None` values into duplicate card validation when flop columns are null. The same pattern exists in `edit_player_hole_cards` (HIGH). These must be fixed before the incremental hand-building workflow (create empty hand → add players) will work.

**Recommendations:**
1. **Fix CRITICAL/HIGH** — Filter `None` from community cards in `add_player_to_hand()` and `edit_player_hole_cards()`, matching the pattern already used in `record_hand()`
2. **Add test** — Test adding a player to an empty-body hand to cover the CRITICAL finding
3. **Decide on partial flop** — Either add a model validator or document that partial flop is intentionally allowed
4. **Align test fixtures** — Consider migrating `test_empty_hand_creation_api.py` to use shared `conftest.py` fixtures
