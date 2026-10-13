# Code Review Report — analytics-dashboard-007

**Date:** 2026-04-15
**Target:** `HandTimeline component (frontend/src/components/HandTimeline.tsx, frontend/src/pages/GameRecapPage.tsx, frontend/test/components/HandTimeline.test.tsx)`
**Reviewer:** Scott (automated)
**Cycle:** 18
**Epic:** aia-core-mne (Analytics Dashboard)

**Task:** T-017 — Hand-by-hand timeline component
**Beads ID:** aia-core-9z4

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
| 1 | Each hand renders as a timeline card: hand number, community cards (via CardIcon), and winner name | SATISFIED | `HandTimeline.tsx` L76 (hand number), L82-87 (CardIcon community cards), L89-91 (winner); tests: "displays hand number", "renders community cards via CardIcon", "displays winner name" | — |
| 2 | Tapping/clicking a card expands it to show all players hole cards, results, and outcome street | SATISFIED | `HandTimeline.tsx` L42-44 (toggle handler), L95-119 (expanded details with cards, result badges, outcome_street); tests: "clicking a card expands it", "clicking an expanded card collapses it", "shows winning hand description" | — |
| 3 | Community cards only render streets that exist (no empty slots for missing turn/river) | SATISFIED | `HandTimeline.tsx` L16-28 (`getCommunityCards` adds turn only if flop exists, river only if turn exists); tests: "does not render community cards section when no flop exists", "does not render turn slot when turn is null" | — |
| 4 | Timeline is scrollable; selected hand is highlighted | SATISFIED | `HandTimeline.tsx` L134 (`overflowY: 'auto'`, `maxHeight: '60vh'`), L159 (`cardSelected` blue border + boxShadow); tests: "renders the timeline container as scrollable", "highlights the selected/expanded card" | — |
| 5 | Mobile: full-width cards. Desktop: centered column with timeline connector lines | SATISFIED | `HandTimeline.tsx` L152 (`width: '100%'`, `maxWidth: 480`, `margin: '0 auto'`), L139-142 (connector lines); tests: "renders connector lines between cards" | Cards are full-width below 480px viewport and centered above. No CSS media queries, but the inline style approach achieves the intent. |

---

## Findings

### [MEDIUM] M-1 — Timeline cards not keyboard-accessible

**File:** `frontend/src/components/HandTimeline.tsx`
**Line(s):** 69–73
**Category:** design (accessibility)

**Problem:**
Timeline cards are clickable `<div>` elements without `role="button"`, `tabIndex={0}`, or `onKeyDown` handlers. Keyboard-only users cannot focus or activate cards to expand hand details.

**Code:**
```tsx
<div
  data-testid={`timeline-card-${hand.hand_id}`}
  data-selected={isSelected ? 'true' : 'false'}
  onClick={() => handleCardClick(hand.hand_id)}
  style={{...}}
>
```

**Suggested Fix:**
Add `role="button"`, `tabIndex={0}`, and an `onKeyDown` handler that triggers on Enter/Space.

**Impact:** Users who rely on keyboard navigation cannot interact with the timeline.

---

### [MEDIUM] M-2 — Missing ARIA attributes for expand/collapse

**File:** `frontend/src/components/HandTimeline.tsx`
**Line(s):** 69–73, 95–119
**Category:** design (accessibility)

**Problem:**
The expandable card-to-details pattern lacks `aria-expanded` and `aria-controls` attributes. Screen readers cannot convey the expand/collapse state to users.

**Suggested Fix:**
Add `aria-expanded={isSelected}` to the card div and `aria-controls={`hand-details-${hand.hand_id}`}`. Add a matching `id` to the details container.

**Impact:** Assistive technology users get no feedback about expandable state.

---

### [LOW] L-1 — Array index used as key for community card CardIcons

**File:** `frontend/src/components/HandTimeline.tsx`
**Line(s):** 85
**Category:** convention

**Problem:**
Community cards use `key={i}` (array index). While safe here since the card list is static per render, using the card string as key would be more semantically correct.

**Code:**
```tsx
{communityCards.map((card, i) => (
  <CardIcon key={i} card={card} />
))}
```

**Suggested Fix:**
Use `key={card}` or `key={`${card}-${i}`}` for stable identity.

**Impact:** Minimal — no reorder bugs expected in this case.

---

### [LOW] L-2 — Only first winner displayed for split pots

**File:** `frontend/src/components/HandTimeline.tsx`
**Line(s):** 10–13
**Category:** correctness

**Problem:**
`getWinnerName` uses `.find()` which returns only the first player with `result === 'won'`. In a split-pot scenario, only one winner name appears on the collapsed card.

**Code:**
```tsx
function getWinnerName(hand: HandResponse): string | null {
  const winner = hand.player_hands.find((ph) => ph.result === 'won');
  return winner ? winner.player_name : null;
}
```

**Suggested Fix:**
Filter all winners and join names: `hand.player_hands.filter(ph => ph.result === 'won').map(ph => ph.player_name).join(', ')`. Alternatively, defer to a future task if split pots aren't in scope yet.

**Impact:** Minor UX gap for split-pot hands — full details still visible in expanded view.

---

## Positives

- **Clean component architecture**: Single-file, well-structured with helper functions (`getWinnerName`, `getCommunityCards`) extracted at module scope.
- **Conditional street rendering is correct**: The `getCommunityCards` function properly chains flop → turn → river dependencies, preventing empty card slots.
- **Good test coverage**: 16 tests cover all ACs — rendering, expand/collapse toggle, conditional rendering, highlighting, connectors, empty state, and pot display.
- **Proper integration**: `GameRecapPage` imports and wires `HandTimeline` cleanly with TanStack Query data.
- **No security concerns**: All dynamic content rendered as text — no `dangerouslySetInnerHTML` or user-controlled URLs.
- **Type safety**: Props interface uses the shared `HandResponse` type — no `any` casts.

---

## Overall Assessment

Solid implementation. All 5 acceptance criteria are **SATISFIED**. The component is well-tested (16 tests), correctly integrated into the recap page, and follows existing codebase patterns. The two MEDIUM findings (keyboard accessibility and ARIA attributes) are accessibility improvements that should be addressed in a follow-up task but do not block this feature. No critical or high-severity issues found.

**Totals: (C: 0, H: 0, M: 2, L: 2)**
