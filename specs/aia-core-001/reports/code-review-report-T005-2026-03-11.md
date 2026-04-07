# Code Review Report — aia-core-001

**Date:** 2026-03-11
**Target:** `src/app/database/models.py` (PlayerHand model), `test/test_player_hand_model.py`
**Reviewer:** Scott (automated)

**Task:** T-005 — Create PlayerHand model
**Beads ID:** aia-core-iko

**Files reviewed:**
- `src/app/database/models.py` (lines 68–91 — PlayerHand model and relationship on Hand)
- `test/test_player_hand_model.py` (23 tests)

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 1 |
| MEDIUM | 4 |
| LOW | 2 |
| **Total Findings** | **7** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | `PlayerHand` model exists with all specified columns and FKs | SATISFIED | `models.py` L69–91: all 8 columns present; `hand_id` FK→`hands.hand_id`, `player_id` FK→`players.player_id`. Tests: 12 structural tests + 2 FK tests pass. | — |
| 2 | Unique constraint on (hand_id, player_id) prevents duplicates | SATISFIED | `models.py` L70: `UniqueConstraint('hand_id', 'player_id', name='uq_player_hand')`. Tests: `test_duplicate_player_in_same_hand_raises_integrity_error`, `test_same_player_different_hands_allowed`, `test_different_players_same_hand_allowed` all pass. | — |
| 3 | `result` and `profit_loss` are nullable | SATISFIED | `models.py` L80–81: `result = Column(String, nullable=True)`, `profit_loss = Column(Float, nullable=True)`. Tests: 4 nullable tests pass including round-trip with both None and set values. | — |

**AC Verdict: All 3 acceptance criteria SATISFIED. One spec requirement is NOT SATISFIED (see H-1 below).**

---

## Findings

### [HIGH] H-1 — `Player.hands_played` relationship is missing

**File:** `src/app/database/models.py`
**Line(s):** 10–19 (Player model), 88–91 (PlayerHand relationships)
**Category:** correctness

**Problem:**
The T-005 task spec states: *"Add relationships on `Hand.player_hands` and `Player.hands_played`."* The `Hand.player_hands` relationship is correctly implemented, but `Player.hands_played` is never added to the `Player` model. Additionally, `PlayerHand.player` is defined as a unidirectional relationship without `back_populates`, which makes the absence of `Player.hands_played` invisible at runtime until a caller tries to access `some_player.hands_played` and gets an `AttributeError`.

This will directly affect T-032 (Player Stats endpoint), which needs to query all hands for a given player efficiently, and any other feature that navigates from a `Player` to their `PlayerHand` records via the ORM.

**Code:**
```python
# PlayerHand (models.py, line 90)
player = relationship('Player')            # unidirectional, no back_populates

# Player model (lines 10-19) — hands_played is absent
class Player(Base):
    __tablename__ = 'players'
    player_id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, unique=True, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    games = relationship('GameSession', secondary='game_players', back_populates='players')
    # hands_played = relationship('PlayerHand', back_populates='player')  ← MISSING
```

**Suggested Fix:**
Add `hands_played` to `Player` and wire up `back_populates` on `PlayerHand.player`:
```python
# In Player model
hands_played = relationship('PlayerHand', back_populates='player')

# In PlayerHand model
player = relationship('Player', back_populates='hands_played')
```

**Impact:** `Player.hands_played` raises `AttributeError` at runtime when accessed. Downstream stats queries that rely on ORM traversal from `Player → PlayerHand` will fail without a fallback to raw SQL joins.

---

### [MEDIUM] M-1 — `profit_loss` uses `Float` instead of `Numeric` for financial data

**File:** `src/app/database/models.py`
**Line(s):** 81
**Category:** design

**Problem:**
`profit_loss` is stored as IEEE 754 `Float`, which is subject to binary floating-point rounding errors. For example, storing `0.10` may be retrieved as `0.10000000000000001`. For a poker analytics application where `profit_loss` values will be summed across hundreds of hands to produce session P&L, these errors accumulate. The spec says "Float, nullable" but this is a specification deficiency rather than a deliberate choice — the intent is clearly financial precision.

**Code:**
```python
profit_loss = Column(Float, nullable=True)
```

**Suggested Fix:**
```python
from sqlalchemy import Numeric
profit_loss = Column(Numeric(precision=10, scale=2), nullable=True)
```
`Numeric(10, 2)` gives values up to ±99,999,999.99 with exact decimal representation, which is more than sufficient for poker P&L.

**Impact:** Cumulative rounding errors in aggregate stats (T-032). Players will see incorrect lifetime P&L values at sufficient hand counts.

---

### [MEDIUM] M-2 — No `result` value constraint — spec values (win/loss/fold) are not enforced at DB level

**File:** `src/app/database/models.py`
**Line(s):** 80
**Category:** design

**Problem:**
The spec defines `result` as `"win/loss/fold"`, implying a fixed vocabulary. The column is defined as an unbounded `String` with no check constraint or SQLAlchemy `Enum` type. Any string — including `"WIN"`, `"W"`, `"loser"`, or `""` — can be inserted without error. Until T-007/T-008 (Pydantic validation) is implemented, there is no barrier to invalid values entering the database or corrupting stats queries that group on `result`.

**Code:**
```python
result = Column(String, nullable=True)
```

**Suggested Fix:**
Use `Enum` at the SQLAlchemy layer to enforce values at the DB level:
```python
from sqlalchemy import Enum
result = Column(Enum('win', 'loss', 'fold', name='hand_result'), nullable=True)
```
This creates a DB-level CHECK constraint (SQLite/PostgreSQL) and documents the valid states explicitly. The Pydantic layer (T-007) should use the same enum values.

**Impact:** Invalid `result` values bypass all validation until a Pydantic layer is in place. Stats queries grouping on `result` will silently produce wrong output if inconsistent values (e.g., `"WIN"` vs `"win"`) are present.

---

### [MEDIUM] M-3 — No cascade delete on `Hand.player_hands` relationship

**File:** `src/app/database/models.py`
**Line(s):** 65–66
**Category:** design

**Problem:**
The `Hand.player_hands` relationship has no `cascade` argument. If a `Hand` record is deleted via the ORM, SQLAlchemy will not automatically delete its associated `PlayerHand` records. Depending on the database FK enforcement mode, this either leaves orphaned `player_hands` rows (SQLite default: FKs off) or raises an `IntegrityError` (PostgreSQL). Since T-030 adds "Remove Player from Hand" functionality, and future editing features may delete/replace hands, this omission is a latent data integrity risk.

**Code:**
```python
player_hands = relationship('PlayerHand', back_populates='hand')
```

**Suggested Fix:**
```python
player_hands = relationship('PlayerHand', back_populates='hand', cascade='all, delete-orphan')
```

**Impact:** Orphaned `player_hands` records on `Hand` deletion in SQLite; `IntegrityError` blocking cascaded deletes in PostgreSQL until this is fixed.

---

### [MEDIUM] M-4 — Tests do not verify NOT NULL enforcement for `card_1`, `card_2`, `hand_id`, or `player_id`

**File:** `test/test_player_hand_model.py`
**Line(s):** 57–76 (structural column tests), 162–200 (nullable tests)
**Category:** correctness

**Problem:**
The tests verify that `result` and `profit_loss` are nullable (correct), and that `card_1`/`card_2` are present as columns (correct). However, there is no test confirming that inserting a `PlayerHand` without `card_1`, `card_2`, `hand_id`, or `player_id` raises an `IntegrityError`. These four columns are all `nullable=False` in the model, but a typo or future refactor changing them to `nullable=True` would not be caught by the current test suite.

**Suggested Fix:**
Add tests in `TestPlayerHandNullableColumns` (or a new `TestPlayerHandNotNullColumns` class):
```python
def test_card_1_not_nullable(self):
    from app.database.models import PlayerHand
    mapper = inspect(PlayerHand)
    col = next(c for c in mapper.columns if c.key == 'card_1')
    assert not col.nullable, 'card_1 should be NOT NULL'

def test_card_2_not_nullable(self):
    # same pattern for card_2

def test_hand_id_not_nullable(self):
    # same pattern for hand_id

def test_player_id_not_nullable(self):
    # same pattern for player_id
```
Runtime enforcement tests (inserting a row without these fields and catching `IntegrityError`) can also be added, but require SQLite FK enforcement to be explicitly enabled (see L-2).

**Impact:** A regression that makes required card columns nullable would pass all 23 current tests undetected.

---

### [LOW] L-1 — `PlayerHand.player` relationship lacks `back_populates` (inconsistent with `PlayerHand.hand`)

**File:** `src/app/database/models.py`
**Line(s):** 90–91
**Category:** convention

**Problem:**
`PlayerHand.hand` correctly uses `back_populates='player_hands'`, creating a bidirectional relationship with `Hand.player_hands`. However, `PlayerHand.player` has no `back_populates`, making it unidirectional. This is inconsistent within the same class and is a symptom of the missing `Player.hands_played` relationship (H-1). On its own it is not a bug, but it makes the asymmetry harder to notice during code review.

**Code:**
```python
hand = relationship('Hand', back_populates='player_hands')  # bidirectional ✓
player = relationship('Player')                              # unidirectional ✗
```

**Suggested Fix:**
Addressed by fixing H-1: adding `Player.hands_played` and wiring `back_populates='hands_played'` on `PlayerHand.player`.

**Impact:** Style inconsistency; no runtime impact until `Player.hands_played` is accessed directly.

---

### [LOW] L-2 — SQLite FK enforcement not enabled in test fixture

**File:** `test/test_player_hand_model.py`
**Line(s):** 12–24 (`db_session` fixture)
**Category:** correctness

**Problem:**
SQLite disables foreign key enforcement by default. The `db_session` fixture does not execute `PRAGMA foreign_keys = ON`, meaning that FK violation tests (e.g., inserting a `PlayerHand` with a non-existent `hand_id`) would pass silently rather than raising an `IntegrityError`. The currently written tests happen to avoid this scenario, but any future test asserting FK-level enforcement will produce a false pass without this pragma.

**Code:**
```python
engine = create_engine(
    'sqlite:///:memory:',
    connect_args={'check_same_thread': False},
    poolclass=StaticPool,
)
```

**Suggested Fix:**
Add the FK enforcement event listener, consistent with what SQLAlchemy recommends for SQLite testing:
```python
from sqlalchemy import event

engine = create_engine(
    'sqlite:///:memory:',
    connect_args={'check_same_thread': False},
    poolclass=StaticPool,
)

@event.listens_for(engine, 'connect')
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute('PRAGMA foreign_keys=ON')
    cursor.close()
```
Note: The same gap exists in `test/test_hand_model.py` and other model test fixtures — this is a cross-cutting concern that should be addressed in `conftest.py`.

**Impact:** FK enforcement tests would produce false passes. Currently no test exercises this path for `PlayerHand`, so no false positives today — but this is a trap for future test authors.

---

## Positives

- **All 23 tests pass** with no failures or errors against the current implementation.
- **Test structure is clean and well-organized** — grouped by acceptance criterion with descriptive class names (`TestPlayerHandForeignKeys`, `TestPlayerHandUniqueConstraint`, etc.) matching the pattern established in `test_hand_model.py`.
- **Unique constraint is correctly named** (`uq_player_hand`) and consistently follows the `uq_` prefix convention used in the `Hand` model (`uq_hand_game_number`).
- **Helper functions `_make_hand` and `_make_player`** cleanly isolate test setup boilerplate and are reused across multiple test classes.
- **`Hand.player_hands` relationship is correctly wired** with `back_populates='hand'`, making the bidirectional ORM traversal `hand.player_hands → [PlayerHand]` and `player_hand.hand → Hand` fully functional.
- **`created_at` default** using `lambda: datetime.now(timezone.utc)` is consistent with all other models in the file.

---

## Overall Assessment

The `PlayerHand` model is **structurally sound** and satisfies all three stated acceptance criteria. All 23 tests pass. The core schema — columns, types, nullable constraints, FKs, and the unique constraint — is correct.

**One spec deviation requires a fix before T-006 (Alembic migration):** the `Player.hands_played` relationship is missing despite being explicitly listed in the T-005 description. This will break downstream stats features and ORM traversal. Fix H-1 first, then regenerate the migration.

The `Float` type for `profit_loss` (M-1) should be treated as a priority change before the first production data write — floating-point P&L accumulation errors are silent and hard to remediate retroactively in an existing database. The remaining medium findings (M-2 through M-4) are lower urgency but should be addressed before the Hand Management endpoints (T-018–T-023) are implemented, as those endpoints will begin inserting `result` values.
