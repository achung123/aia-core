# Code Review Report — aia-core-001

**Date:** 2026-04-12
**Cycle:** 10
**Target:** Buy-in capture on game/player creation endpoints
**Reviewer:** Scott (automated)

**Task:** aia-core-vm6d — Buy-in capture on game/player creation endpoints

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 1 |
| LOW | 2 |
| **Total Findings** | **3** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| AC-1 | POST /games accepts optional buy_in float per player | SATISFIED | `test_buy_in_api.py::TestPostGamesWithBuyIn` (3 tests); `games.py` L108 `buy_ins.get(name)` | `player_buy_ins` dict is optional, defaults to `None`, values flow to `GamePlayer.buy_in` |
| AC-2 | POST /games/{id}/players accepts optional buy_in in body | SATISFIED | `test_buy_in_api.py::TestPostPlayersWithBuyIn` (2 tests); `games.py` L458 `buy_in=payload.buy_in` | `AddPlayerToGameRequest.buy_in` is optional, defaults to `None` |
| AC-3 | GameSessionResponse includes buy_in per player | SATISFIED | `test_buy_in_api.py::TestGameSessionResponseIncludesBuyIn` (2 tests); `_build_players()` L47 queries `GamePlayer.buy_in` | Both POST and GET responses include buy_in via `PlayerInfo` |

---

## Findings

### [MEDIUM] No validation on negative buy-in values

**File:** `src/pydantic_models/app_models.py`
**Line(s):** 127 (`GameSessionCreate.player_buy_ins`), 439 (`AddPlayerToGameRequest.buy_in`)
**Category:** correctness

**Problem:**
Both `GameSessionCreate.player_buy_ins` (dict values) and `AddPlayerToGameRequest.buy_in` accept any float, including negative numbers. A negative buy-in has no semantic meaning in poker and likely indicates a client-side error.

**Code:**
```python
# GameSessionCreate
player_buy_ins: dict[str, float] | None = None

# AddPlayerToGameRequest
buy_in: float | None = None
```

**Suggested Fix:**
Add `ge=0` (or `gt=0` if zero buy-in is also invalid) to `AddPlayerToGameRequest.buy_in`:
```python
buy_in: float | None = Field(default=None, ge=0)
```
For `player_buy_ins`, add a `model_validator` that checks all dict values are `>= 0`, since Pydantic does not support nested field constraints on dict values directly.

**Impact:** Allows logically invalid data to be persisted. Low risk in practice (clients control the input), but violates input validation best practices.

---

### [LOW] Case-sensitive dict key matching for player_buy_ins

**File:** `src/app/routes/games.py`
**Line(s):** 108
**Category:** correctness

**Problem:**
The buy-in lookup uses `buy_ins.get(name)` where `name` comes directly from `payload.player_names`. If a client sends inconsistent casing between `player_names` and `player_buy_ins` keys (e.g., `player_names: ["alice"]`, `player_buy_ins: {"Alice": 50}`), the buy-in won't match. Meanwhile, player creation in the same endpoint uses case-insensitive matching (`func.lower(Player.name)`).

**Code:**
```python
buy_ins = payload.player_buy_ins or {}
# ...
buy_in=buy_ins.get(name),
```

**Suggested Fix:**
Normalize dict keys to lowercase and perform a case-insensitive lookup:
```python
buy_ins = {k.lower(): v for k, v in (payload.player_buy_ins or {}).items()}
# ...
buy_in=buy_ins.get(name.lower()),
```

**Impact:** Edge case — only triggers with inconsistent casing between the two fields in the same request. Low probability but inconsistent with the case-insensitive player handling elsewhere.

---

### [LOW] Extra keys in player_buy_ins silently ignored

**File:** `src/app/routes/games.py`
**Line(s):** 104–108
**Category:** design

**Problem:**
If `player_buy_ins` contains player names that are not in `player_names`, those entries are silently discarded. This could mask a client-side typo (e.g., `player_names: ["Alice"]`, `player_buy_ins: {"Alce": 50}`).

**Code:**
```python
buy_ins = payload.player_buy_ins or {}
# Only names in player_names are iterated; extra keys never accessed
```

**Suggested Fix:**
Optionally, add a `model_validator` on `GameSessionCreate` that warns or rejects if `player_buy_ins` contains keys not present in `player_names`:
```python
@model_validator(mode='after')
def _check_buy_in_keys(self):
    if self.player_buy_ins:
        names_lower = {n.lower() for n in self.player_names}
        extra = [k for k in self.player_buy_ins if k.lower() not in names_lower]
        if extra:
            raise ValueError(f"player_buy_ins contains unknown players: {extra}")
    return self
```

**Impact:** Minimal — extra dict entries are harmless to the system but may hide user errors.

---

## Positives

- **Clean backward compatibility** — Both `player_buy_ins` and `buy_in` default to `None`, preserving existing API contracts. Tests explicitly verify the null-default behavior.
- **Consistent data flow** — `_build_players()` queries `GamePlayer.buy_in` and maps it through `PlayerInfo`, so the field appears in all GET and POST responses without duplication.
- **Proper migration** — Alembic migration `447f9697b2f2` adds the column with `nullable=True`, matching the optional semantics.
- **Good test structure** — Tests are organized by AC with clear class groupings, and cover the positive path, partial path, and null-default path for both endpoints.
- **7 focused tests** covering all three ACs with both happy-path and edge-case scenarios.

---

## Overall Assessment

The buy-in implementation is solid and well-tested. All three acceptance criteria are satisfied. The only actionable finding is the missing non-negative validation on buy-in values (MEDIUM), which should be addressed before this feature goes to production. The two LOW findings are minor robustness improvements that can be deferred.

**Verdict:** PASS — no CRITICAL or HIGH findings. Ready for merge pending MEDIUM fix.
