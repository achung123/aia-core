# Code Review Report — dealer-viz-004

**Date:** 2026-04-09
**Target:** `aia-core-u63x` — TDD: Add player to hand with optional cards
**Reviewer:** Scott (automated)
**Cycle:** 10

**Task:** T-005 — TDD: Add player to hand with optional cards
**Beads ID:** aia-core-u63x

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 2 |
| HIGH | 2 |
| MEDIUM | 0 |
| LOW | 0 |
| **Total Findings** | **4** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| AC-1 | Player with null cards returns 201 | SATISFIED | `test/test_add_remove_player_hand_api.py` — `TestAddPlayerWithNullCards::test_add_player_with_null_cards_returns_201`, `test_add_player_with_omitted_cards_returns_201` | Both explicit null and omitted-field cases covered |
| AC-2 | Player with cards returns 201 | SATISFIED | `test/test_add_remove_player_hand_api.py` — `TestAddPlayerToHand::test_add_player_returns_201_and_player_hand` | Pre-existing test, still passing |
| AC-3 | Duplicate player returns 400 | SATISFIED | `test/test_add_remove_player_hand_api.py` — `TestAddPlayerWithNullCards::test_duplicate_player_with_null_cards_returns_400`, `TestAddPlayerToHand::test_add_player_400_duplicate_player_in_hand` | Both with-cards and null-cards duplicate cases covered |
| AC-4 | HoleCardsUpdate allows null cards | NOT SATISFIED | `src/pydantic_models/app_models.py` — `HoleCardsUpdate` still requires `card_1: Card` and `card_2: Card` (not optional) | See Finding #4 |

---

## Findings

### [CRITICAL] record_hand() stores literal string "None" in DB for null cards

**File:** `src/app/routes/hands.py`
**Line(s):** 495–496, 551–552
**Category:** correctness

**Problem:**
`record_hand()` calls `str(entry.card_1)` and `str(entry.card_2)` without checking for `None`. Since `PlayerHandEntry.card_1/card_2` are now `Card | None = None`, passing a null card through `record_hand` converts Python `None` to the literal string `"None"` which is then stored in the DB (#L495–496 for validation, #L551–552 for persistence). This is data corruption — the DB should store SQL `NULL`, not the string `"None"`.

Additionally, the validation path (#L495–496) will flag two players both having null cards as duplicate `"None"` strings, causing a spurious 400 error.

**Code:**
```python
# L495-496 — validation: str(None) = "None", causes false duplicates
for entry in payload.player_entries:
    all_cards.append(str(entry.card_1))
    all_cards.append(str(entry.card_2))

# L551-552 — persistence: stores literal "None" string
ph = PlayerHand(
    hand_id=hand.hand_id,
    player_id=player.player_id,
    card_1=str(entry.card_1),
    card_2=str(entry.card_2),
    ...
)
```

**Suggested Fix:**
```python
# Validation — filter None before appending
for entry in payload.player_entries:
    if entry.card_1 is not None:
        all_cards.append(str(entry.card_1))
    if entry.card_2 is not None:
        all_cards.append(str(entry.card_2))

# Persistence — guard with None check (matches add_player_to_hand pattern)
ph = PlayerHand(
    hand_id=hand.hand_id,
    player_id=player.player_id,
    card_1=str(entry.card_1) if entry.card_1 is not None else None,
    card_2=str(entry.card_2) if entry.card_2 is not None else None,
    ...
)
```

**Impact:** Any `record_hand` call with null player cards silently stores corrupted data; downstream reads, equity calculations, and edit_hole_cards may break or return nonsense.

---

### [CRITICAL] edit_community_cards() passes None hole cards to duplicate validator

**File:** `src/app/routes/hands.py`
**Line(s):** 206–207
**Category:** correctness

**Problem:**
`edit_community_cards()` appends `ph.card_1` and `ph.card_2` from existing player hands without checking for `None`. Now that DB columns are nullable, any hand with a null-card player will inject `None` into the `all_cards` list. Two or more players with null cards → multiple `None` values → `validate_no_duplicate_cards()` raises `ValueError` → spurious 400 error when editing community cards.

**Code:**
```python
for ph in hand.player_hands:
    all_cards.append(ph.card_1)
    all_cards.append(ph.card_2)
```

**Suggested Fix:**
```python
for ph in hand.player_hands:
    if ph.card_1 is not None:
        all_cards.append(ph.card_1)
    if ph.card_2 is not None:
        all_cards.append(ph.card_2)
```

**Impact:** Editing community cards on any hand with a null-card player fails with a false "duplicate cards" error. This blocks the dealer-viz flow (add player with no cards → detect community → edit community cards).

---

### [HIGH] edit_player_hole_cards() passes None hole cards of other players to duplicate validator

**File:** `src/app/routes/hands.py`
**Line(s):** 306–307
**Category:** correctness

**Problem:**
Same pattern as `edit_community_cards()`: when building the card set for validation, other players' hole cards are appended without filtering `None`. If another player in the hand has null cards, `None` is injected into the validation list.

**Code:**
```python
for other_ph in hand.player_hands:
    if other_ph.player_id != player.player_id:
        all_cards.append(other_ph.card_1)
        all_cards.append(other_ph.card_2)
```

**Suggested Fix:**
```python
for other_ph in hand.player_hands:
    if other_ph.player_id != player.player_id:
        if other_ph.card_1 is not None:
            all_cards.append(other_ph.card_1)
        if other_ph.card_2 is not None:
            all_cards.append(other_ph.card_2)
```

**Impact:** Editing a player's hole cards fails if any other player in the same hand has null cards. Blocks the per-player card capture flow (T-013).

---

### [HIGH] HoleCardsUpdate not updated to allow null cards (AC-4 not satisfied)

**File:** `src/pydantic_models/app_models.py`
**Line(s):** 303–306 (approximate — the `HoleCardsUpdate` class)
**Category:** correctness

**Problem:**
The task AC states "HoleCardsUpdate allows null cards", but `HoleCardsUpdate` still requires non-optional `card_1: Card` and `card_2: Card`. The per-player card collection flow (T-013) needs the ability to PATCH hole cards as null (e.g., to clear a detection), which this model blocks at the validation layer.

**Code:**
```python
class HoleCardsUpdate(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    card_1: Card
    card_2: Card
```

**Suggested Fix:**
```python
class HoleCardsUpdate(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    card_1: Card | None = None
    card_2: Card | None = None
```

Note: `edit_player_hole_cards()` also needs updating to handle None cards in validation and persistence, mirroring the pattern used in `add_player_to_hand()`.

**Impact:** The PATCH endpoint for hole cards cannot accept null values, which the downstream task T-013 expects.

---

## Positives

- **`add_player_to_hand()` is correctly implemented** — None cards are properly filtered in validation (`if c is not None`) and guarded in persistence (`str(x) if x is not None else None`). This is the model the adjacent endpoints should follow.
- **Migration is clean and reversible** — uses `batch_alter_table` for SQLite, correctly downgrades to `nullable=False`.
- **Good test coverage for the primary endpoint** — 5 new tests cover null cards, omitted cards, one-card-null, null-card persistence, and duplicate-player-with-null-cards. All 27 tests pass.
- **Equity endpoint is already null-safe** — the `get_hand_equity` function correctly skips players with `None` cards.
- **Pydantic models are correctly updated** — `PlayerHandEntry.card_1/card_2` default to `None`, `PlayerHandResponse.card_1/card_2` are `str | None`.

---

## Overall Assessment

The core deliverable — `add_player_to_hand()` with optional cards — is correctly implemented and well tested. However, the change introduced nullable card columns across the system without updating all code paths that read those columns. Three adjacent endpoints (`record_hand`, `edit_community_cards`, `edit_player_hole_cards`) will break when encountering null cards, and one acceptance criterion (`HoleCardsUpdate` allows null cards) remains unsatisfied.

**Recommended next steps:**
1. **File bug** for `record_hand()` null card handling (CRITICAL — data corruption)
2. **File bug** for `edit_community_cards()` null card handling (CRITICAL — spurious 400)
3. **File bug** for `edit_player_hole_cards()` null card handling (HIGH — spurious 400)
4. **File task** to make `HoleCardsUpdate` optional and update the PATCH endpoint (HIGH — AC-4)

These should be resolved before T-013 (per-player card collection flow) begins.
