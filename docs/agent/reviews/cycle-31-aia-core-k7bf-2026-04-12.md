# Code Review Report — alpha-feedback-008

**Date:** 2026-04-12
**Cycle:** 31
**Target:** `src/app/services/equity.py`, `src/app/routes/hands.py`, `frontend/src/api/client.ts`, `frontend/src/pages/TableView.tsx`, `test/test_equity.py`, `test/test_equity_api.py`, `frontend/src/pages/TableView.test.tsx`
**Reviewer:** Scott (automated)

**Task:** T-033 — Adjusted equity display (player perspective)
**Beads ID:** aia-core-k7bf

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
| 1 | Calls equity endpoint with only player's hole cards (opponents unknown/random) | SATISFIED | Backend: `calculate_player_equity()` in `equity.py` L200-240 deals random opponent hands via Monte Carlo. API: `?player=` param in `hands.py` L540-555 routes to player-perspective calc. Frontend: `fetchPlayerEquity()` in `client.ts` L226-228. Tests: `test_player_param_returns_single_equity`, `test_aa_preflop_vs_one_random_opponent`, frontend AC1 test. | Clean implementation — player's hole cards are known, opponents are sampled randomly |
| 2 | Displays equity as percentage near player's cards | SATISFIED | `TableView.tsx` L420-423: `equity-overlay` div renders `Math.round(equityPct * 100)}%`. Frontend test: "displays equity percentage near player cards (AC2)" asserts `72%` text. | Overlay is positioned via absolute CSS in the viewport |
| 3 | Recalculates when community cards change | SATISFIED | `handleScrubberChange()` in `TableView.tsx` L315-320 calls `fetchEquityForHand()` on every hand change. Backend test: `test_player_equity_with_community_cards`. Frontend test: "recalculates equity when hand changes via scrubber (AC3)". | Recalculation is triggered by scrubber navigation; see MEDIUM finding about race condition |
| 4 | Toggle to show/hide equity | SATISFIED | `TableView.tsx` L411-417: `equity-toggle-btn` toggles `showEquity` state. Frontend test: "has a toggle button to show/hide equity (AC4)" verifies show → hide → show cycle. | Default state is `showEquity=true` |
| 5 | Falls back to preflop equity when no community cards | SATISFIED | `calculate_player_equity()` handles `community_cards=[]` by dealing all 5 community cards from the deck. API test: `test_player_equity_without_community_cards` verifies AA ~85%. Frontend test: "shows preflop equity when no community cards (AC5)". | Seamless — same code path handles 0-5 community cards |

---

## Findings

### [MEDIUM] Race condition in equity fetches during rapid scrubbing

**File:** `frontend/src/pages/TableView.tsx`
**Line(s):** 298-311
**Category:** correctness

**Problem:**
`fetchEquityForHand()` fires an unguarded `fetchPlayerEquity()` promise with no abort controller or stale-request check. When the user rapidly scrubs through hands, multiple equity fetches can be in-flight simultaneously. If an earlier request resolves after a later one, `equityPct` will show equity for the wrong hand.

**Code:**
```typescript
function fetchEquityForHand(handNumber: number): void {
    if (!gameId || !playerName) return;
    fetchPlayerEquity(gameId, handNumber, playerName)
      .then(data => {
        if (data.equities.length > 0) {
          setEquityPct(data.equities[0].equity);
        } else {
          setEquityPct(null);
        }
      })
      .catch(() => {
        setEquityPct(null);
      });
  }
```

**Suggested Fix:**
Track the latest requested hand number in a ref and discard stale responses, or use an `AbortController` (similar to the `fetchHands` call in the main `useEffect`) to cancel in-flight equity requests when the scrubber moves.

**Impact:** User could briefly see equity from a previous hand after scrubbing. Low severity in practice since equity fetches are fast, but violates correctness under latency.

---

### [LOW] No deck-size guard in `calculate_player_equity` for extreme opponent counts

**File:** `src/app/services/equity.py`
**Line(s):** 221-230
**Category:** correctness

**Problem:**
`calculate_player_equity` indexes into the shuffled deck at `deck[idx]` and `deck[idx + 1]` for each opponent, then slices `deck[idx : idx + remaining]` for community cards. If `num_opponents * 2 + remaining > len(deck)`, this would silently produce incorrect results (overlapping cards) or an IndexError. The API derives `num_opponents` from the hand's player count so this is bounded by game size, but there is no explicit guard.

**Code:**
```python
for _ in range(num_opponents):
    opponents.append([deck[idx], deck[idx + 1]])
    idx += 2
b = board + deck[idx : idx + remaining] if remaining > 0 else board
```

**Suggested Fix:**
Add an early check: `if num_opponents * 2 + remaining > len(deck): return 0.5` (or raise). In practice this would require 23+ opponents with no community cards — unreachable in normal usage.

**Impact:** Theoretical only — standard poker tables max at ~10 players.

---

## Positives

- **Monte Carlo implementation is solid**: Correct algorithm selection — exhaustive for ≤2 remaining cards, Monte Carlo for 3+. The 5000-iteration count balances accuracy and latency well.
- **Player-perspective equity is cleanly separated**: `calculate_player_equity` is a distinct function from the multi-player `calculate_equity`, avoiding parameter overloading.
- **API input validation is sound**: 404 for missing game/hand, empty response for unknown player or insufficient cards. The `_db_card_to_tuple` helper correctly lowercases suits to match the evaluator's format.
- **Equity range is correctly bounded**: All return paths produce values in [0.0, 1.0]. The API rounds to 4 decimal places for clean JSON output.
- **Test coverage is comprehensive**: 23 backend tests (5 unit + 4 API for T-033 specifically) and 7 frontend tests map directly to all 5 ACs. Edge cases (no opponents, player not in hand, empty equities, fetch errors) are covered.
- **Frontend error handling**: Equity fetch failures are caught and result in hidden overlay rather than a crash.
- **`encodeURIComponent`** properly applied to player name in the frontend API call, preventing URL injection.

---

## Overall Assessment

The T-033 implementation is clean and well-tested. All 5 acceptance criteria are satisfied with direct test coverage on both backend and frontend. The Monte Carlo engine produces correct equity values within expected tolerances. The single MEDIUM finding (race condition on rapid scrubbing) is low-impact in practice but worth addressing in a future pass. No CRITICAL or HIGH issues — code is ready for production.
