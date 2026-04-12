# Code Review Report — dealer-viz-004

**Date:** 2026-04-09
**Target:** `frontend/src/dealer/HandDashboard.jsx`, `frontend/src/dealer/DealerApp.jsx`, `frontend/src/dealer/DealerApp.test.jsx`
**Reviewer:** Scott (automated)
**Cycle:** 24

**Task:** T-009 — Hand list & navigation in HandDashboard
**Beads ID:** aia-core-cjm

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
| 1 | HandDashboard shows past hands in a scrollable list | SATISFIED | `HandDashboard.jsx` L44-59: `data-testid="hand-list"` div with `overflowY: 'auto'`; test "shows hand list as scrollable" confirms style | — |
| 2 | Tapping a hand row emits `onSelectHand(handNumber)` for editing | SATISFIED | `HandDashboard.jsx` L51: `onClick={() => onSelectHand(hand.hand_number)}`; test "tapping a row calls onSelectHand with hand number" verifies both rows | — |
| 3 | "Add New Hand" button creates an empty hand via the API and navigates to player grid | SATISFIED | `HandDashboard.jsx` L33-37: `handleNewHand` calls `createHand(gameId, {})` then `onSelectHand(result.hand_number)`; `DealerApp.jsx` L37-39: `handleSelectHand` dispatches `SET_HAND_ID` + `SET_STEP: playerGrid`; test "New Hand button creates hand and calls onSelectHand" verifies | — |
| 4 | "Back to Games" button returns to the game selector | SATISFIED | `HandDashboard.jsx` L43: `data-testid="back-btn"` calls `onBack`; `DealerApp.jsx` L214: `onBack` dispatches `SET_STEP: create`; test "Back to Games button calls onBack" confirms | Navigates to create step (game selector integration is T-010) |
| 5 | Hand count is displayed at the top | SATISFIED | `HandDashboard.jsx` L42: `<h2>{hands.length} Hands</h2>`; tests "shows hand count in header" and "shows empty state" confirm for both populated and empty cases | — |

---

## Findings

### [MEDIUM] No double-click guard on "New Hand" button

**File:** `frontend/src/dealer/HandDashboard.jsx`
**Line(s):** 33-37
**Category:** correctness

**Problem:**
`handleNewHand` is an async function invoked directly by the button's `onClick`. If a user taps "New Hand" twice rapidly, two `createHand` API calls fire concurrently. This creates two empty hands on the backend. The first resolution calls `onSelectHand`, unmounting HandDashboard and navigating to the player grid. The second resolution then calls `onSelectHand` again on the (now unmounted) component, potentially dispatching a second `SET_HAND_ID` that overwrites the first — leaving an orphan hand in the database.

**Code:**
```jsx
async function handleNewHand() {
  try {
    const result = await createHand(gameId, {});
    onSelectHand(result.hand_number);
  } catch (err) {
    setError(err.message || 'Failed to create hand');
  }
}
```

**Suggested Fix:**
Add a `creating` state guard:
```jsx
const [creating, setCreating] = useState(false);
// ...
async function handleNewHand() {
  if (creating) return;
  setCreating(true);
  try { ... } catch { ... } finally { setCreating(false); }
}
```
Optionally disable the button via `disabled={creating}`.

**Impact:** Duplicate hands created in the database on rapid double-tap (common on mobile touch interfaces).

---

### [LOW] No cleanup for async operations on unmount

**File:** `frontend/src/dealer/HandDashboard.jsx`
**Line(s):** 11-14
**Category:** design

**Problem:**
The `useEffect` fetch and `handleNewHand` do not cancel in-flight requests when the component unmounts. If the component unmounts before `fetchHands` resolves, `setHands` or `setError` is called on a stale component instance. In modern Preact/React this does not cause a memory leak or crash, but it is a best-practice gap — especially on slow networks where the user navigates away quickly.

**Code:**
```jsx
useEffect(() => {
  fetchHands(gameId)
    .then((data) => setHands(data))
    .catch((err) => setError(err.message || 'Failed to fetch hands'));
}, [gameId]);
```

**Suggested Fix:**
Use an `AbortController` or a `mounted` flag returned from the effect cleanup:
```jsx
useEffect(() => {
  let cancelled = false;
  fetchHands(gameId)
    .then((data) => { if (!cancelled) setHands(data); })
    .catch((err) => { if (!cancelled) setError(err.message || '...'); });
  return () => { cancelled = true; };
}, [gameId]);
```

**Impact:** Minor — no user-visible bug in current Preact, but could mask stale-state issues in future refactors.

---

### [LOW] No defensive check for missing `player_hands` array

**File:** `frontend/src/dealer/HandDashboard.jsx`
**Line(s):** 53-58
**Category:** correctness

**Problem:**
The render logic calls `hand.player_hands.map(...)` without guarding against `player_hands` being `undefined` or `null`. If the API ever returns a hand without this field (e.g., a schema change or partial response), the component would throw a TypeError and crash.

**Code:**
```jsx
{hand.player_hands.map((ph) => (
  <span key={ph.player_hand_id}>
    {ph.player_name}{ph.result ? ` ${ph.result}` : ''}{' '}
  </span>
))}
```

**Suggested Fix:**
```jsx
{(hand.player_hands || []).map((ph) => ( ... ))}
```

**Impact:** Defensive hardening — current API always returns the field, but this guards against unexpected responses.

---

## Positives

- **Clean component design** — HandDashboard is a focused, stateful component with clear props contract (`gameId`, `onSelectHand`, `onBack`). No unnecessary state or logic.
- **Comprehensive test coverage** — 12 dedicated tests in `HandDashboard.test.jsx` cover loading, data display, interactions, error, and empty states. All map directly to component behavior.
- **DealerApp integration is minimal and correct** — Only 6 lines of JSX added (L212-217) with a clean `handleSelectHand` handler. Existing tests updated to mock `fetchHands` in every `beforeEach`.
- **No XSS risk** — All hand data (player names, results) rendered as JSX text nodes; no `dangerouslySetInnerHTML` or raw HTML insertion anywhere.
- **API client functions properly encode user inputs** — `encodeURIComponent` used for player names in URL paths.

---

## Overall Assessment

T-009 implementation is **solid**. All five acceptance criteria are satisfied, all 12 HandDashboard tests align with the component behavior, and DealerApp correctly wires the new props. No critical or high-severity issues found. The one MEDIUM finding (double-click on New Hand creating duplicate hands) is worth addressing before mobile testing since touch interfaces commonly produce duplicate taps. The two LOW findings are best-practice improvements that can be tracked as follow-up work.
