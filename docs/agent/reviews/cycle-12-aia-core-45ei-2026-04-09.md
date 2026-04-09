# Code Review Report — dealer-viz-004

**Date:** 2026-04-09
**Target:** `frontend/src/dealer/dealerState.js`, `frontend/src/dealer/dealerState.test.js`
**Reviewer:** Scott (automated)
**Cycle:** 12
**Epic:** dealer-viz-004

**Task:** T-011 — Dealer state refactor: status & incremental actions
**Beads ID:** aia-core-45ei

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
| 1 | `initialState.currentHandId === null` | SATISFIED | `dealerState.js` L4; `dealerState.test.js` L8 `currentHandId: null` in `toEqual` | — |
| 2 | Each player has `status: 'playing'` by default | SATISFIED | `initPlayer()` L14 returns `status: 'playing'`; SET_GAME test L35 asserts `status: 'playing'` | — |
| 3 | `SET_PLAYER_RESULT` updates player status | SATISFIED | Reducer L67-74; tests at L148-201 cover `won`, `folded`, `lost`, immutability, non-target unchanged | — |
| 4 | `SET_HAND_ID` stores hand ID from POST | SATISFIED | Reducer L76; tests at L203-215 cover set and overwrite | — |
| 5 | `FINISH_HAND` resets to dashboard | SATISFIED | Reducer L78-86; tests at L217-266 verify full reset, handCount increment, gameDate preservation | — |
| 6 | Tests cover all new actions and edge cases | SATISFIED | 11 new tests: SET_PLAYER_RESULT (5), SET_HAND_ID (2), FINISH_HAND (3), plus updated existing tests verify `status` field | — |

---

## Findings

### [MEDIUM] FINISH_HAND and RESET_HAND are functionally identical

**File:** `frontend/src/dealer/dealerState.js`
**Line(s):** 58-65, 78-86
**Category:** design

**Problem:**
`FINISH_HAND` and `RESET_HAND` have byte-for-byte identical return objects. Both clear `currentHandId`, rebuild players via `initPlayer()`, reset community, increment `handCount`, and set `currentStep: 'dashboard'`. While having two semantic names is intentional (one for the old batch-submit flow, one for the new incremental flow), the duplicated body is a maintenance risk — a future change to one could easily miss the other.

**Code:**
```js
// RESET_HAND (L58-65)
return {
  ...state,
  currentHandId: null,
  players: state.players.map((p) => initPlayer(p.name)),
  community: { ...emptyCommunity },
  handCount: state.handCount + 1,
  currentStep: 'dashboard',
};

// FINISH_HAND (L78-86) — identical body
return {
  ...state,
  currentHandId: null,
  players: state.players.map((p) => initPlayer(p.name)),
  community: { ...emptyCommunity },
  handCount: state.handCount + 1,
  currentStep: 'dashboard',
};
```

**Suggested Fix:**
Extract a `resetHandState(state)` helper and call it from both cases. Alternatively, have `FINISH_HAND` fall through to `RESET_HAND`. Not blocking — defer to T-016 (hand completion & elimination) which may diverge these actions.

**Impact:** Maintenance risk. If the two flows diverge in the future the duplication will need resolution anyway; if they don't diverge, one action becomes dead code.

---

### [LOW] RESET_HAND test does not verify `currentHandId` clearing

**File:** `frontend/src/dealer/dealerState.test.js`
**Line(s):** 99-131
**Category:** correctness

**Problem:**
The `RESET_HAND` test sets up player cards and community cards, then dispatches `RESET_HAND`, but never sets `currentHandId` beforehand and never asserts `reset.currentHandId === null`. This means the `currentHandId: null` line in the `RESET_HAND` case (added in this refactor) has no dedicated test coverage. The `FINISH_HAND` test does cover this scenario correctly, but the RESET_HAND case is independently reachable from `DealerApp.handleSubmitHand()`.

**Suggested Fix:**
Add a test that sets `currentHandId` via `SET_HAND_ID` before dispatching `RESET_HAND` and asserts it returns to `null`.

**Impact:** Minor — the FINISH_HAND test covers the same code path, but RESET_HAND is a separate entry point used by the existing submit flow. A regression here would only be caught indirectly.

---

### [LOW] SET_PLAYER_RESULT accepts any string for status

**File:** `frontend/src/dealer/dealerState.js`
**Line(s):** 67-74
**Category:** design

**Problem:**
The reducer accepts `action.payload.status` without validating it against the expected set (`playing`, `won`, `folded`, `lost`). Dispatching `SET_PLAYER_RESULT` with an invalid status (e.g., `{ name: 'Alice', status: 'banana' }`) would silently succeed and corrupt state.

**Suggested Fix:**
Not blocking — reducers are typically trusted to receive well-formed actions from dispatchers. If desired, add a guard clause or define a `VALID_STATUSES` set and throw/ignore on invalid values. Consider adding this when T-014 (Outcome buttons) wires the dispatch calls.

**Impact:** Low. The dispatcher is the only caller and is controlled by the developer. No external input can reach this reducer directly.

---

## Positives

- **Clean immutability** — all cases use spread operators and `.map()` correctly; the immutability test for `SET_PLAYER_RESULT` explicitly asserts the original state is unmodified
- **Excellent test coverage** — 20 tests for 7 action types plus initial state; every new action has ≥2 tests including edge cases
- **Good DRY patterns** — `initPlayer()` and `emptyCommunity` are reused across SET_GAME, RESET_HAND, and FINISH_HAND, keeping player shape consistent
- **Backwards-compatible** — existing `DealerApp.jsx` callers of `SET_PLAYER_CARDS`, `SET_COMMUNITY_CARDS`, `RESET_HAND` continue to work because the new `status` field is initialized via `initPlayer()` and preserved via spread
- **Test structure** — follows vitest `describe`/`it`/`expect` conventions consistently, grouped by action type

---

## Overall Assessment

Clean, well-structured implementation that satisfies all 6 acceptance criteria. Zero critical or high findings. The single MEDIUM finding (RESET_HAND / FINISH_HAND duplication) is a deliberate trade-off that may resolve naturally when T-016 diverges the two flows. The two LOW findings are minor quality improvements that can be addressed opportunistically.

**Verdict:** PASS — no critical issues. Ready for downstream tasks (T-012, T-015, T-016).
