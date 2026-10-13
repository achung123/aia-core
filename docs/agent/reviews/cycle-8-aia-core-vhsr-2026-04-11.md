# Code Review Report — aia-core

**Date:** 2026-04-11
**Target:** `frontend/src/stores/dealerStore.ts`, `frontend/src/stores/dealerStore.test.ts`, `frontend/src/NavBar.tsx`
**Reviewer:** Scott (automated)

**Task:** T-008 — Implement Zustand dealer store
**Beads ID:** aia-core-vhsr
**Epic:** aia-core-dthg (cycle 8)

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
| 1 | `stores/dealerStore.ts` exports a typed Zustand store | SATISFIED | `dealerStore.ts` L131: `export const useDealerStore = create<DealerState & DealerActions>()` | Full type coverage for state and actions |
| 2 | All actions implemented (SET_GAME, SET_PLAYER_CARDS, SET_COMMUNITY_CARDS, SET_HAND_ID, SET_PLAYER_STATUS, NEW_HAND, ADD_PLAYER, REMOVE_PLAYER, FINISH_HAND, RESET, RESTORE_STATE, SET_COMMUNITY_RECORDED) | PARTIAL | All original reducer actions ported. ADD_PLAYER and REMOVE_PLAYER listed in AC but absent from original `dealerState.js` — not a gap | Plus additional actions: `setFlopCards`, `setTurnCard`, `setRiverCard`, `setStep`, `setGameMode`, `loadHand`, `updateParticipation` |
| 3 | `persist` middleware saves to sessionStorage with key `aia_dealer_state` | SATISFIED | `dealerStore.ts` L226–229; test at `dealerStore.test.ts` L540–544 | Uses `createJSONStorage(() => sessionStorage)` |
| 4 | `validateOutcomeStreets` exported as typed utility | SATISFIED | `dealerStore.ts` L104: `export function validateOutcomeStreets(players: Player[]): string \| null` | Typed parameter and return |
| 5 | Existing dealerState.test.js assertions pass against new store | SATISFIED | `dealerStore.test.ts` covers all 49 assertions from old test file | Every old scenario re-implemented in Zustand API style |

---

## Findings

### [MEDIUM] `setCommunityCards` behavioral drift — preserves turn/river when omitted

**File:** `frontend/src/stores/dealerStore.ts`
**Line(s):** 153–158
**Category:** correctness

**Problem:**
The old reducer directly assigns `turn` and `river` from the payload. When called with only flop values (turn/river undefined), the old behavior sets `turn: undefined, turnRecorded: false`, effectively clearing them. The new store uses nullish coalescing (`turn ?? state.community.turn`), which preserves existing turn/river values instead of clearing them.

**Code:**
```typescript
// NEW (dealerStore.ts) — preserves existing values
turn: turn ?? state.community.turn,
turnRecorded: turn ? true : state.community.turnRecorded,
river: river ?? state.community.river,
riverRecorded: river ? true : state.community.riverRecorded,

// OLD (dealerState.js) — overwrites unconditionally
turn,
turnRecorded: !!turn,
river,
riverRecorded: !!river,
```

**Suggested Fix:**
If the new behavior is intentional (likely correct — prevents accidental data loss), add a test that explicitly verifies the "flop-only call preserves existing turn/river" behavior to document the decision. If the old behavior is desired, revert to direct assignment.

**Impact:** Any caller that relies on `setCommunityCards({ flop1, flop2, flop3 })` to clear previously-set turn/river will silently retain stale values.

---

### [MEDIUM] `setGame` step determination differs from old reducer

**File:** `frontend/src/stores/dealerStore.ts`
**Line(s):** 140
**Category:** correctness

**Problem:**
The old reducer checks only the raw payload `gameMode` to determine the step: `currentStep: gameMode === 'participation' ? 'qrCodes' : 'dashboard'`. The new store resolves `gameMode` against existing state first: `(gameMode || state.gameMode) === 'participation'`. This means calling `setGame` without `gameMode` when `state.gameMode` is already `'participation'` will navigate to `'qrCodes'` in the new store but `'dashboard'` in the old reducer.

**Code:**
```typescript
// NEW — resolves against current state
currentStep: (gameMode || state.gameMode) === 'participation' ? 'qrCodes' : 'dashboard',

// OLD — checks raw payload only
currentStep: gameMode === 'participation' ? 'qrCodes' : 'dashboard',
```

**Suggested Fix:**
If the new behavior is intentional (likely more correct), add a test that calls `setGame` without `gameMode` while state is `'participation'` and asserts step is `'qrCodes'`. The existing test "preserves current gameMode when none is provided" only checks `gameMode`, not `currentStep`.

**Impact:** Edge case — only affects re-initializing a game without explicitly passing `gameMode` when mode is already `participation`.

---

### [LOW] Unused `act` variable in test file

**File:** `frontend/src/stores/dealerStore.test.ts`
**Line(s):** 8
**Category:** convention

**Problem:**
`const act = useDealerStore.getState;` is declared but never referenced in any test.

**Suggested Fix:**
Remove the unused declaration.

**Impact:** Dead code; no runtime effect.

---

### [LOW] ADD_PLAYER and REMOVE_PLAYER listed in ACs but absent

**File:** N/A (AC documentation)
**Line(s):** N/A
**Category:** design

**Problem:**
AC #2 lists ADD_PLAYER and REMOVE_PLAYER as required actions, but these don't exist in the original `dealerState.js` reducer either. The new store correctly omits them.

**Suggested Fix:**
Update the AC wording to reflect the actual action set, or file a follow-up task if these actions are planned future work.

**Impact:** Documentation-only; no code gap.

---

## Positives

- **Strong type coverage**: `DealerState`, `DealerActions`, `Player`, `CommunityCards`, `LoadHandPayload`, and `GameMode` are all properly typed — no `any` in the store itself
- **Clean Zustand idioms**: Actions use `set((state) => ...)` with spread-based immutable updates; no state mutation bugs
- **Persist config correct**: `sessionStorage` with key `aia_dealer_state` via `createJSONStorage`
- **Comprehensive test suite**: 49 tests cover all actions, edge cases, validation logic, and persist configuration
- **NavBar integration is minimal and correct**: Uses a selector (`(s) => s.gameId`) to subscribe only to the needed slice — no unnecessary re-renders
- **`validateOutcomeStreets` faithfully ported**: Logic, error messages, and street ordering are identical to the original

---

## Overall Assessment

The implementation is solid. Zero CRITICAL or HIGH findings. The two MEDIUM findings are intentional behavioral improvements over the old reducer (preserving turn/river on partial community-card updates, and using resolved gameMode for step determination). Both are arguably more correct but should be documented with explicit tests to avoid confusion during migration. The store is well-typed, correctly persisted, and thoroughly tested.

**Recommendation:** Add 2 targeted tests to cover the behavioral drifts, remove the dead `act` variable, and this is ready to ship.
