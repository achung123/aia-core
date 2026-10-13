# Code Review Report — alpha-feedback-008

**Date:** 2026-04-12
**Cycle:** 4
**Target:** `frontend/src/api/client.ts`, `frontend/src/api/types.ts`, `frontend/src/api/client.test.ts`
**Reviewer:** Scott (automated)

**Task:** T-017 — API client — add new endpoint functions
**Beads ID:** aia-core-cdv2

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
| 1 | `togglePlayerStatus(gameId, playerName, isActive)` | SATISFIED | `client.ts` L259–265; test at `client.test.ts` L64–83 | PATCH, URL encoding, body all correct |
| 2 | `addPlayerToGame(gameId, playerName, buyIn?)` | PARTIAL | `client.ts` L267–273; test at `client.test.ts` L89–101 | `buyIn` param omitted — backend `AddPlayerToGameRequest` has no `buy_in` field; valid omission |
| 3 | `startHand(gameId)` | SATISFIED | `client.ts` L275–279; test at `client.test.ts` L109–120 | POST to `/hands/start`, no body, matches backend |
| 4 | `recordPlayerAction(gameId, handNumber, playerName, data)` | SATISFIED | `client.ts` L281–288; test at `client.test.ts` L128–150 | POST with `PlayerActionCreate` body, URL encoding tested |
| 5 | `fetchHandActions(gameId, handNumber)` | NOT APPLICABLE | No backend GET endpoint for hand actions exists | Valid skip |
| 6 | `fetchBlinds(gameId)` / `updateBlinds(gameId, data)` | SATISFIED | `client.ts` L290–298; tests at `client.test.ts` L155–173 | GET + PATCH, correct paths and bodies |
| 7 | `recordRebuy` / `fetchRebuys` / `fetchHandState` | NOT APPLICABLE | No rebuy endpoints in backend; `fetchHandState` already exists as `fetchHandStatus` | Valid skip |
| 8 | All follow existing `request()` helper pattern | SATISFIED | All 6 functions use `request<T>()`, consistent headers, `encodeURIComponent` for player names | Matches pre-existing functions exactly |

---

## Findings

### [MEDIUM] `HandResponse` TS type missing `sb_player_name` / `bb_player_name` fields

**File:** `frontend/src/api/types.ts`
**Line(s):** 63–80
**Category:** correctness

**Problem:**
The backend `HandResponse` Pydantic model (`src/pydantic_models/app_models.py` L201–217) includes `sb_player_name: str | None` and `bb_player_name: str | None`, but the TypeScript `HandResponse` interface does not declare these fields. The `startHand()` function returns `HandResponse`, and the backend's start-hand endpoint specifically populates these SB/BB fields via blind rotation logic. Any downstream consumer relying on TypeScript types will lack type-safe access to blind position data.

**Code:**
```typescript
// types.ts — missing fields
export interface HandResponse {
  hand_id: number;
  // ...
  // sb_player_name: string | null;  ← missing
  // bb_player_name: string | null;  ← missing
  created_at: string;
  player_hands: PlayerHandResponse[];
}
```

**Suggested Fix:**
Add `sb_player_name: string | null;` and `bb_player_name: string | null;` to the `HandResponse` interface.

**Impact:** Consumers of `startHand()` response won't see blind position fields in autocomplete or type checks. The data is present at runtime but invisible to TypeScript. This is a pre-existing gap (not introduced by this task) but relevant because `startHand` is a new consumer.

---

### [LOW] AC2 `buyIn` parameter not implemented

**File:** `frontend/src/api/client.ts`
**Line(s):** 267–273
**Category:** design

**Problem:**
AC2 specifies the signature `addPlayerToGame(gameId, playerName, buyIn?)`, but the function only accepts `gameId` and `playerName`. The backend `AddPlayerToGameRequest` Pydantic model has no `buy_in` field, so this omission is technically correct — the backend doesn't support it. However, the AC and implementation diverge.

**Suggested Fix:**
No code change needed. The AC was aspirational. Update the task/AC documentation to clarify that `buyIn` is deferred until the backend supports it.

**Impact:** Minimal — the function correctly matches the backend contract.

---

### [LOW] No error-path tests for new functions

**File:** `frontend/src/api/client.test.ts`
**Line(s):** 60–173
**Category:** convention

**Problem:**
Of the 6 new functions, none have an explicit error-path test (e.g., verifying that a 404 or 409 response throws the expected error). Only the pre-existing `fetchHandStatus` describes block includes an error test. The error behavior is covered generically by the shared `request()` helper, so this is a coverage gap rather than a correctness issue.

**Suggested Fix:**
Add at least one `mockError()` test to any new describe block — the pattern already exists in the `fetchHandStatus` block and can be copied.

**Impact:** Low — the `request()` helper's error path is tested once. Adding more would increase confidence but is not strictly necessary.

---

## Positives

- **Consistent patterns**: All 6 new functions follow the exact same `request<T>()` helper pattern as pre-existing functions. No divergent fetch patterns, no missed JSON headers.
- **URL encoding**: Player-name parameters use `encodeURIComponent()` consistently. Tested with space-containing names (`Bob Smith`) for both `togglePlayerStatus` and `recordPlayerAction`.
- **Type accuracy**: TypeScript types for `BlindsResponse`, `BlindsUpdate`, `AddPlayerToGameResponse`, `PlayerStatusResponse`, `PlayerActionCreate`, and `PlayerActionResponse` all match their Pydantic counterparts field-for-field, including correct nullability.
- **URL/method correctness**: Every endpoint URL and HTTP method was cross-referenced against the backend routes — all match exactly.
- **Skipped items justified**: `fetchHandActions`, `recordRebuy`/`fetchRebuys` were correctly identified as having no backend endpoints. `fetchHandState` correctly mapped to the existing `fetchHandStatus` function.

---

## Overall Assessment

Clean implementation. All 6 functions are correctly typed, correctly routed, and follow existing patterns. The one MEDIUM finding (`HandResponse` missing SB/BB fields) is a pre-existing gap, not introduced by this task but newly relevant because `startHand()` is now a consumer. The two LOW findings are documentation/coverage polish items.

**Verdict:** No CRITICAL or HIGH findings. Implementation is production-ready.
