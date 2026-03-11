# Code Review Report — aia-core-001

**Date:** 2026-03-10
**Target:** `src/app/database/models.py`, `test/test_player_model.py`
**Reviewer:** Scott (automated)

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 2 |
| MEDIUM | 3 |
| LOW | 2 |
| **Total Findings** | **7** |

---

## Findings

### [HIGH] H-1 — Case-insensitive uniqueness not enforced on `Player.name`

**File:** `src/app/database/models.py`
**Line(s):** 14
**Category:** correctness

**Problem:**
S-1.1 AC-2 requires player names to be case-insensitive unique (no duplicate "Adam" / "adam"). The current model uses a plain `Column(String, unique=True)`, which in most databases (PostgreSQL included) treats `'Adam'` and `'adam'` as distinct values. The constraint only works case-insensitively on SQLite by accident (SQLite's default `NOCASE` collation applies only when explicitly set or through `COLLATE NOCASE`). This means the production database will allow duplicate names differing only by case.

**Code:**
```python
name = Column(String, unique=True, nullable=False)
```

**Suggested Fix:**
Add a case-insensitive collation or a functional unique index. For cross-DB compatibility, store a normalized (lowercased) name alongside or use a `@validates` hook plus a functional index:
```python
from sqlalchemy import func, Index

name = Column(String, nullable=False)

__table_args__ = (
    Index('ix_players_name_lower', func.lower(name), unique=True),
)
```

**Impact:** Duplicate players with different casing can be created in production, violating a core spec requirement (S-1.1 AC-2) and causing downstream stat aggregation bugs.

---

### [HIGH] H-2 — No test for case-insensitive name uniqueness

**File:** `test/test_player_model.py`
**Line(s):** (missing — not present)
**Category:** correctness

**Problem:**
S-1.1 AC-2 explicitly requires case-insensitive uniqueness ("no duplicate 'Adam' / 'adam'"), yet no test in `TestPlayerNameUniqueness` verifies this. The existing test only checks exact-match duplicates (`'Adam'` / `'Adam'`). This means the gap in production code (H-1) is also invisible to the test suite.

**Suggested Fix:**
Add a test case:
```python
def test_case_insensitive_duplicate_raises(self, db_session):
    from app.database.models import Player
    p1 = Player(name='Adam')
    p2 = Player(name='adam')
    db_session.add(p1)
    db_session.commit()
    db_session.add(p2)
    with pytest.raises(IntegrityError):
        db_session.flush()
```

**Impact:** Without this test, case-sensitivity regressions go undetected.

---

### [MEDIUM] M-1 — Deprecated `declarative_base()` usage

**File:** `src/app/database/models.py`
**Line(s):** 4
**Category:** convention

**Problem:**
The model imports `declarative_base` from `sqlalchemy.orm` and calls it directly. Since SQLAlchemy 2.0, the preferred approach is to use `DeclarativeBase` as a class mixin (`from sqlalchemy.orm import DeclarativeBase`), or at minimum `from sqlalchemy.orm import declarative_base` (which is still supported but flagged as legacy). The project is on SQLAlchemy 2.x (implied by pyproject.toml listing `sqlalchemy` without pinning to 1.x). Using the legacy function will emit deprecation warnings under SQLAlchemy 2.0+ and will be removed in 3.0.

**Code:**
```python
from sqlalchemy.orm import declarative_base
Base = declarative_base()
```

**Suggested Fix:**
Adopt the SQLAlchemy 2.0 mapped-column style:
```python
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import String

class Base(DeclarativeBase):
    pass

class Player(Base):
    __tablename__ = 'players'
    player_id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String, unique=True)
    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc))
```
This also gives better type-checker support.

**Impact:** Technical debt — deprecation warnings now, breakage on SQLAlchemy 3.0.

---

### [MEDIUM] M-2 — `created_at` uses Python-side default instead of server default

**File:** `src/app/database/models.py`
**Line(s):** 15
**Category:** design

**Problem:**
`created_at` uses `default=lambda: datetime.now(timezone.utc)`, which is evaluated in Python. This means if a row is inserted by a migration, a raw SQL script, or another client, `created_at` will be `NULL`. A `server_default` is more robust for audit timestamps.

**Code:**
```python
created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
```

**Suggested Fix:**
Use `server_default` with `func.now()` (or `text("(datetime('now'))")` for SQLite compatibility), or keep the Python default but also add `nullable=False` to catch missing values:
```python
from sqlalchemy import func
created_at = Column(DateTime, nullable=False, server_default=func.now())
```

**Impact:** Rows inserted outside the ORM will have NULL timestamps, complicating auditing and debugging.

---

### [MEDIUM] M-3 — Test file re-imports `Player` / `Base` inside every test function

**File:** `test/test_player_model.py`
**Line(s):** 35, 40, 46, 53, 60, 67, 74, 86, 97, 108
**Category:** convention

**Problem:**
Every test method contains a local `from app.database.models import Player` (or `Base`). This is unusual for Python tests and creates significant line noise. It provides no isolation benefit — the module is cached after the first import, so it is the same object every time.

**Code:**
```python
def test_player_model_importable(self):
    from app.database.models import Player
    assert Player is not None
```

**Suggested Fix:**
Import once at the top of the file:
```python
from app.database.models import Base, Player
```
This follows standard Python convention and makes test bodies focused on assertions.

**Impact:** Readability — adds ~20 lines of boilerplate that distract from test intent.

---

### [LOW] L-1 — `db_session` fixture duplicates `conftest.py` pattern with a different `Base`

**File:** `test/test_player_model.py`
**Line(s):** 11–28
**Category:** design

**Problem:**
The file defines its own `db_session` fixture using the *new* `Base` (from `app.database.models`), while `conftest.py` has a project-wide fixture using the *old* `Base` (from `app.database.database_models`). This is currently correct — the two `Base` instances track different models — but as the migration progresses (per the spec's plan to replace old models), the project will end up with two competing session-fixture patterns. Consider a migration plan to unify them.

**Suggested Fix:**
No immediate action required, but flag for T-010 (database session dependency refactor) — when the new `Base` becomes the canonical one, consolidate all test session fixtures into `conftest.py`.

**Impact:** Minor duplication now; risk of fixture confusion as more test files are added.

---

### [LOW] L-2 — No `String` length on `Player.name`

**File:** `src/app/database/models.py`
**Line(s):** 14
**Category:** design

**Problem:**
`Column(String, ...)` without a length argument creates an unbounded VARCHAR. While SQLite and PostgreSQL both tolerate this, some deployment targets (MySQL) require a length, and an unbounded name column could accept arbitrarily long strings.

**Code:**
```python
name = Column(String, unique=True, nullable=False)
```

**Suggested Fix:**
Set a reasonable limit:
```python
name = Column(String(100), unique=True, nullable=False)
```

**Impact:** Low — unlikely to cause issues on current target (SQLite/PostgreSQL), but worth standardizing before more models are added.

---

## Positives

1. **Clean, minimal model** — The `Player` model is correctly structured with autoincrement PK, non-nullable name, and a timezone-aware `created_at` default. No over-engineering.
2. **Good test structure** — Tests are organized by AC (`TestPlayerModelExists` → AC-1, `TestPlayerNameUniqueness` → AC-2, `TestPlayerInBaseMetadata` → AC-3), making traceability straightforward.
3. **Proper use of in-memory SQLite with `StaticPool`** — The `db_session` fixture correctly uses `StaticPool` and `check_same_thread=False` for thread-safe in-memory testing.
4. **Thorough column-level assertions** — Tests verify not just that the model works, but that each individual column exists and that `player_id` is the primary key. This catches accidental renames or removals.
5. **Fixture teardown** — The `db_session` fixture properly closes the session and drops all tables, preventing state leakage.

---

## Overall Assessment

The `Player` model is a clean, minimal first model that satisfies most of T-002's acceptance criteria. The tests are well-structured and trace clearly to the three ACs. However, **the most important gap is the missing case-insensitive uniqueness constraint** (H-1) — this is explicitly called out in S-1.1 AC-2 and is not implemented. The corresponding test gap (H-2) compounds the risk.

**Recommended next steps (priority order):**
1. **Fix H-1** — Add case-insensitive unique index on `Player.name`
2. **Fix H-2** — Add test for case-insensitive duplicate rejection
3. **Address M-1** during T-003 — Adopt SQLAlchemy 2.0 `DeclarativeBase` style before adding more models (easier to migrate now with one model than later with five)
4. **Address M-2** during T-006 — Switch to `server_default` when writing the Alembic migration
5. **Track L-1** for T-010 — Unify test fixtures when the database session dependency is refactored
