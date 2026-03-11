# Code Review Report — aia-core-001

**Date:** 2026-03-11
**Target:** `alembic/env.py`, `alembic/versions/731dac60f062_create_initial_tables.py`, `test/test_alembic_setup.py`
**Reviewer:** Scott (automated)

**Task:** T-006 — Write initial Alembic migration for all new models
**Beads ID:** aia-core-ewq

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
| AC-1 | Migration file exists under `alembic/versions/` | SATISFIED | `alembic/versions/731dac60f062_create_initial_tables.py` exists | — |
| AC-2 | `alembic upgrade head` creates all 5 tables with correct columns, FKs, and constraints | PARTIAL | `test_upgrade_head_creates_all_tables` passes; table presence verified | Tests do not assert column types, nullability, or named-constraint presence — see MEDIUM-004 |
| AC-3 | `alembic downgrade base` drops all tables cleanly | SATISFIED | `test_downgrade_base_drops_all_tables` passes | — |

---

## Findings

### [HIGH] `env.py` missing `render_as_batch=True` — future SQLite ALTERs will fail

**File:** `alembic/env.py`
**Line(s):** 38, 62
**Category:** correctness

**Problem:**
SQLite does not support `ALTER TABLE ... ADD COLUMN`, `ALTER TABLE ... DROP COLUMN`, or `ALTER TABLE ... ALTER COLUMN`. Alembic's `render_as_batch=True` option wraps such operations in a copy-and-rename sequence. Without it, any migration that needs to modify an existing table (e.g., changing `profit_loss` from `Float` to `Numeric` for T-045, or adding an `Enum` constraint for T-046) will either raise a `NotImplementedError` at runtime or silently emit invalid SQL.

Both `run_migrations_offline` and `run_migrations_online` are missing this option.

**Code:**
```python
# run_migrations_offline (line ~38):
context.configure(
    url=url,
    target_metadata=target_metadata,
    literal_binds=True,
    dialect_opts={'paramstyle': 'named'},
    # render_as_batch=True  <-- MISSING
)

# run_migrations_online (line ~62):
context.configure(
    connection=connection,
    target_metadata=target_metadata,
    # render_as_batch=True  <-- MISSING
)
```

**Suggested Fix:**
Add `render_as_batch=True` to both `context.configure` calls:
```python
context.configure(
    url=url,
    target_metadata=target_metadata,
    literal_binds=True,
    dialect_opts={'paramstyle': 'named'},
    render_as_batch=True,
)
```
```python
context.configure(
    connection=connection,
    target_metadata=target_metadata,
    render_as_batch=True,
)
```

**Impact:** T-045 (`Float` → `Numeric`) and T-046 (add `Enum`) both require ALTER TABLE operations on `player_hands`. Without this flag those migrations will fail when run against SQLite. This blocks at least two immediate downstream tasks.

---

### [MEDIUM] `profit_loss` column uses `Float` — schema debt ships in the initial migration

**File:** `alembic/versions/731dac60f062_create_initial_tables.py`
**Line(s):** 62
**Category:** correctness

**Problem:**
The migration creates `profit_loss` as `sa.Float()`. The model (`src/app/database/models.py`, line 79) also uses `Float`. T-045 documents that `Float` accumulates IEEE 754 rounding errors and that `Numeric(10, 2)` should be used for exact decimal representation of P&L values. Because this ships in the *initial* migration, fixing it requires a subsequent `ALTER TABLE` migration — which is non-trivial on SQLite (see HIGH-001 above).

**Code:**
```python
sa.Column('profit_loss', sa.Float(), nullable=True),
```

**Suggested Fix:**
Address T-045 before or alongside this migration. Update both the model and this migration:
```python
sa.Column('profit_loss', sa.Numeric(precision=10, scale=2), nullable=True),
```

**Impact:** All P&L aggregations (session stats, leaderboard, lifetime P&L — T-032–T-035) will silently accumulate rounding errors. Fixing post-deployment requires a data-migration step.

---

### [MEDIUM] `result` column uses unbounded `String` — no DB-level constraint on hand outcomes

**File:** `alembic/versions/731dac60f062_create_initial_tables.py`
**Line(s):** 61
**Category:** correctness

**Problem:**
The migration creates `result` as `sa.String()`. T-046 documents this as a known gap: any string value (`"WIN"`, `"loser"`, `""`) can be inserted without error. Stats queries that `GROUP BY result` (T-032–T-035) will silently produce wrong output if inconsistent values are present. The spec describes `result` as win/loss/fold.

**Code:**
```python
sa.Column('result', sa.String(), nullable=True),
```

**Suggested Fix:**
Address T-046 before or alongside this migration:
```python
sa.Column('result', sa.Enum('win', 'loss', 'fold', name='hand_result'), nullable=True),
```
Note: SQLite doesn't enforce `Enum` natively but the constraint documents intent; the Pydantic layer (T-007/T-008) must enforce valid values at the API boundary until then.

**Impact:** Corrupted result values will silently degrade win-rate and leaderboard accuracy across all analytics endpoints.

---

### [MEDIUM] FK columns have no indexes — query performance degrades at scale

**File:** `alembic/versions/731dac60f062_create_initial_tables.py`
**Line(s):** 44–70
**Category:** design

**Problem:**
SQLite does not automatically create indexes for foreign key columns. The following FK columns have no explicit index:
- `game_players.game_id` and `game_players.player_id`
- `hands.game_id`
- `player_hands.hand_id` and `player_hands.player_id`

Queries that join or filter on these columns (the core access pattern for every Hand Management, Stats, and Search endpoint) will fall back to full-table scans.

**Code:**
```python
# game_players — no Index on game_id or player_id
sa.ForeignKeyConstraint(['game_id'], ['game_sessions.game_id'], ),
sa.ForeignKeyConstraint(['player_id'], ['players.player_id'], ),
```

**Suggested Fix:**
Add `sa.Index` entries or use `index=True` on FK columns. Example for `player_hands`:
```python
op.create_index('ix_player_hands_hand_id', 'player_hands', ['hand_id'])
op.create_index('ix_player_hands_player_id', 'player_hands', ['player_id'])
```
This can be addressed in a follow-on migration or added here before any data exists.

**Impact:** Acceptable for development, but will cause noticeable degradation in Stats (T-032–T-035) and Search (T-036–T-038) endpoints once non-trivial datasets are loaded.

---

### [MEDIUM] Tests verify table presence only — column types, nullability, and constraints are untested

**File:** `test/test_alembic_setup.py`
**Line(s):** 74–113
**Category:** correctness

**Problem:**
`test_upgrade_head_creates_all_tables` asserts only that the 5 table names exist. It does not verify:
- Column types (e.g., `Float` vs `Numeric` for `profit_loss`)
- Nullable/NOT NULL status for any column
- Named constraint presence (`uq_player_hand`, `uq_hand_game_number`)
- FK constraint existence

AC-2 states "correct columns, FKs, and constraints" must be created. The test does not fully cover this criterion.

**Code:**
```python
tables = set(inspect(engine).get_table_names())
engine.dispose()
assert self.EXPECTED_TABLES.issubset(tables), (
    f'Missing tables after upgrade: {self.EXPECTED_TABLES - tables}'
)
```

**Suggested Fix:**
Extend the test to inspect column details and constraints using `sqlalchemy.inspect`:
```python
inspector = inspect(engine)
cols = {c['name']: c for c in inspector.get_columns('player_hands')}
assert cols['profit_loss']['nullable'] is True
uniques = [u['name'] for u in inspector.get_unique_constraints('player_hands')]
assert 'uq_player_hand' in uniques
fks = inspector.get_foreign_keys('player_hands')
assert any(fk['referred_table'] == 'hands' for fk in fks)
```

**Impact:** Migration regressions (e.g., a column silently dropped or constraint name changed) would not be caught until runtime errors surface in higher-level integration tests.

---

### [LOW] Module docstring misidentifies file as T-001 tests

**File:** `test/test_alembic_setup.py`
**Line(s):** 1
**Category:** convention

**Problem:**
The module-level docstring reads `"""Tests for T-001: Alembic database migration setup."""` but the file now contains `TestAlembicMigrations` covering T-006 acceptance criteria. This will mislead anyone using the docstring to understand the file's scope, and breaks traceability tooling that relies on module-level comments.

**Code:**
```python
"""Tests for T-001: Alembic database migration setup."""
```

**Suggested Fix:**
```python
"""Tests for T-001 (Alembic setup) and T-006 (initial migration: all 5 tables)."""
```

**Impact:** Documentation drift — low operational risk.

---

### [LOW] `alembic.ini` hardcodes `poker.db` with no env-var override documentation

**File:** `alembic.ini`
**Line(s):** 89
**Category:** convention

**Problem:**
`sqlalchemy.url = sqlite:///./poker.db` points to the production database file by default. The tests correctly override this with a `tmp_path`-scoped URL, but there is no `.env`-driven or environment-variable mechanism to configure the URL for different environments (dev, CI, prod). Running `alembic upgrade head` manually from the repo root by a new developer will modify or create `poker.db` in the working directory without any warning.

**Suggested Fix:**
Document the override pattern (e.g., `alembic -x db_url=sqlite:///./dev.db upgrade head`) in a `CONTRIBUTING.md` note or add a comment in `alembic.ini`. Alternatively, add a `env.py` snippet that reads from an environment variable with `poker.db` as fallback.

**Impact:** Low risk now; potential confusion for new contributors and CI environments that don't isolate the database file.

---

## Positives

- **Correct dependency order in upgrade and downgrade.** Tables are created and dropped in proper FK-dependency sequence with no cycles. `game_sessions` and `players` before `game_players`; `player_hands` dropped first in downgrade.
- **Import path correctly updated.** `env.py` was updated to import `Base` from `app.database.models` (not the legacy `database_models`), and `alembic.ini` sets `prepend_sys_path = .:src` to make this importable.
- **Tests use isolated `tmp_path`.** Each migration test creates a fresh throwaway database, preventing test pollution and avoiding touches to the production `poker.db`.
- **All 13 tests pass.** No regressions introduced.
- **Revision chain is clean.** `down_revision = None` correctly marks this as the initial migration with no predecessor.

---

## Overall Assessment

The migration is **functionally correct for its stated scope** — all 5 tables are created and dropped cleanly, the revision chain is sound, and tests pass. It satisfies ACs 1 and 3 fully and AC-2 partially (table presence ✅, constraint correctness untested).

The **one HIGH finding** (`render_as_batch=True` missing) is the most urgent: it will block T-045 and T-046 from running against SQLite without additional env.py changes. That fix is a two-line change and should be applied before any ALTER-based migration is authored.

The **two MEDIUM schema debt findings** (Float/Enum) reflect deliberate deferred work tracked in T-045 and T-046. They are noted here because they ship in the initial schema, making the eventual fix more involved than if they had been caught pre-migration.

**Recommended actions before closing this sprint:**
1. (HIGH) Add `render_as_batch=True` to both `context.configure` calls in `env.py`
2. (MEDIUM) Expand `test_upgrade_head_creates_all_tables` to verify at least unique constraints and FK presence
3. (MEDIUM → T-045/T-046) Decide whether to fold Float→Numeric and Enum fixes into the *initial* migration or accept the ALTER-migration path — document the decision
