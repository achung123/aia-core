# Code Review Report — aia-core

**Date:** 2026-04-13
**Cycle:** 6
**Target:** Rebuy model: player_name string → player_id FK
**Reviewer:** Scott (automated)

**Task:** Fix Rebuy model: player_name string → player_id FK
**Beads ID:** aia-core-zz7m

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 1 |
| LOW | 1 |
| **Total Findings** | **2** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | Rebuy model replaces player_name (String) with player_id (Integer FK to players) | SATISFIED | `src/app/database/models.py` L225-227, `test/test_rebuy_model.py` TestRebuyTableSchema | Correct FK, not-nullable, indexed |
| 2 | Alembic migration adds player_id, migrates data (name → ID lookup), drops player_name | SATISFIED | `alembic/versions/a0f7c6c82d0f_rebuy_player_name_to_player_id_fk.py` | Uses batch mode for SQLite; both upgrade and downgrade implemented |
| 3 | Pydantic schemas updated (RebuyResponse.player_name → player_id) | SATISFIED | `src/pydantic_models/player_schemas.py` L23-30, `test/test_player_schemas_split.py` test_import_rebuy_response | `from_attributes=True` correctly maps from ORM model |
| 4 | Route handlers use player_id for create, list, and stats aggregation | SATISFIED | `src/app/routes/games.py` L672-712 (create_rebuy, list_rebuys), L65-87 (_build_players) | Player resolved by name in URL, stored by ID |
| 5 | Tests updated for new schema | SATISFIED | `test/test_rebuy_model.py`, `test/test_rebuy_api.py`, `test/test_player_schemas_split.py` | Model schema, FK enforcement, API CRUD, schema import tests all updated |
| 6 | Existing tests still pass | SATISFIED | 1403 passed, 0 failures | Previously reported ordering failure no longer reproduces |

---

## Findings

### [MEDIUM] Migration does not guard against orphaned rebuys

**File:** `alembic/versions/a0f7c6c82d0f_rebuy_player_name_to_player_id_fk.py`
**Line(s):** 29-35
**Category:** correctness

**Problem:**
The data migration (Step 2) uses a correlated subquery to map `player_name` → `player_id`. If any rebuy row references a `player_name` that does not exist in the `players` table, the subquery returns `NULL`. Step 3 then sets `player_id` to `NOT NULL`, causing the migration to fail with an `IntegrityError`.

While the current application always validates player existence before creating rebuys (making orphans unlikely), a production database with manually inserted data or stale records from deleted players would hit this.

**Code:**
```python
conn.execute(
    sa.text(
        'UPDATE rebuys SET player_id = '
        '(SELECT player_id FROM players WHERE players.name = rebuys.player_name)'
    )
)
```

**Suggested Fix:**
Add a guard between Step 2 and Step 3 — either delete orphaned rows or raise a clear diagnostic:

```python
# After Step 2, before Step 3:
orphan_count = conn.execute(
    sa.text('SELECT COUNT(*) FROM rebuys WHERE player_id IS NULL')
).scalar()
if orphan_count:
    conn.execute(sa.text('DELETE FROM rebuys WHERE player_id IS NULL'))
    print(f"WARNING: Deleted {orphan_count} rebuy(s) with no matching player")
```

**Impact:** Migration failure on databases with inconsistent data. The failure is noisy and recoverable, but the migration should handle this gracefully.

---

### [LOW] RebuyResponse breaking API change

**File:** `src/pydantic_models/player_schemas.py`
**Line(s):** 23-30
**Category:** design

**Problem:**
`RebuyResponse` changed from returning `player_name: str` to `player_id: int`. Any API consumers expecting `player_name` in the response payload will break. This is the correct direction (FK-based responses are more reliable), but it is a breaking change.

**Suggested Fix:**
If backward compatibility is needed, add `player_name` back as a computed field:

```python
class RebuyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    rebuy_id: int
    game_id: int
    player_id: int
    amount: float
    created_at: datetime
    # Optional: player_name for backward compat, populated via relationship
```

Alternatively, document this as a known breaking change in the API changelog.

**Impact:** Low — this is an internal/pre-release API. Frontend consumers can be updated in tandem.

---

## Positives

- **Clean migration structure**: Three-step upgrade (add nullable → migrate data → enforce constraints + drop old column) is the correct pattern for data migrations. Downgrade is symmetrical and complete.
- **SQLite batch mode**: Correctly uses `batch_alter_table` throughout, which is required for SQLite's limited ALTER TABLE support.
- **API URL stability**: The route paths still use `player_name` in the URL (`/{game_id}/players/{player_name}/rebuys`), preserving URL structure while storing the FK internally. Good separation of external API from internal storage.
- **Thorough test coverage**: Model tests verify schema structure (columns, FKs, nullability), CRUD operations, FK enforcement, and autoincrement. API tests cover happy path, reactivation, 404s, and validation.
- **Correct stats aggregation**: `_build_players()` properly groups rebuy stats by `player_id` instead of the old string-based approach, eliminating case-sensitivity and spelling issues.

---

## Overall Assessment

This is a well-executed schema migration. The Rebuy model correctly moves from a denormalized `player_name` string to a proper `player_id` foreign key with referential integrity. The migration, model, routes, schemas, and tests are all consistently updated. The only substantive concern is the migration's lack of orphan handling (MEDIUM), which is a defensive measure for production data scenarios. The API breaking change (LOW) is acceptable for the project's current stage.

**Verdict:** Clean — no critical or high findings. Safe to proceed.
