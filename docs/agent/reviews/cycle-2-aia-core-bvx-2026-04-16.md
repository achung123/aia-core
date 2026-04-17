# Code Review Report — aia-core

**Date:** 2026-04-16
**Cycle:** 2
**Target:** `frontend/src/views/LandingPage.tsx`, `frontend/test/views/LandingPage.test.tsx`
**Reviewer:** Scott (automated)

**Task:** aia-core-bvx — Add Analytics card to LandingPage
**Beads ID:** aia-core-bvx
**Epic:** aia-core-wd4 — Analytics Hub

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
| 1 | Add a 5th navigation card to LandingPage | SATISFIED | `frontend/src/views/LandingPage.tsx` L45-49 | Card added as 5th `<a>` element in the links grid |
| 2 | Link to `#/analytics` | SATISFIED | `frontend/src/views/LandingPage.tsx` L45 | `href="#/analytics"` — route exists in `App.tsx` L32 |
| 3 | Use emoji 📈 | SATISFIED | `frontend/src/views/LandingPage.tsx` L46 | `<div style={styles.cardIcon}>📈</div>` |
| 4 | Title 'Analytics' | SATISFIED | `frontend/src/views/LandingPage.tsx` L47 | `<div style={styles.cardTitle}>Analytics</div>` |
| 5 | Description 'Leaderboard & player stats' | SATISFIED | `frontend/src/views/LandingPage.tsx` L48 | Uses `&amp;` entity — renders correctly |
| 6 | Update test to expect 5 cards and include `nav-analytics` testid | SATISFIED | `frontend/test/views/LandingPage.test.tsx` L55-60 | Test name updated to "renders 5 navigation cards"; asserts all 5 testids |

---

## Findings

### [MEDIUM] Missing href verification test for analytics card

**File:** `frontend/test/views/LandingPage.test.tsx`
**Line(s):** after L103
**Category:** convention (test completeness)

**Problem:**
Every other navigation card has a dedicated test that verifies its `href` attribute:
- `it('playback card links to #/playback')` (L63)
- `it('dealer card links to #/dealer')` (L88)
- `it('player card links to #/player')` (L93)
- `it('data card links to #/data')` (L99)

The new analytics card is verified to *exist* in the "renders 5 navigation cards" test, but there is no dedicated test asserting `href="#/analytics"`. This breaks the established 1-test-per-card-href pattern.

**Suggested Fix:**
Add a test after the data card href test:

```tsx
it('analytics card links to #/analytics', () => {
  render(<LandingPage />);
  const link = screen.getByTestId('nav-analytics');
  expect(link.getAttribute('href')).toBe('#/analytics');
});
```

**Impact:** If the href were accidentally changed or removed, no test would catch it. Low risk in practice, but violates the test pattern established for the other four cards.

---

### [LOW] Pre-existing redundant import path in test file

**File:** `frontend/test/views/LandingPage.test.tsx`
**Line(s):** L28
**Category:** convention

**Problem:**
The import path `../../src/../src/views/LandingPage.tsx` contains a redundant `src/../src/` segment. This resolves correctly but is confusing. This is a pre-existing issue — **not introduced by this task**.

**Code:**
```tsx
import { LandingPage } from '../../src/../src/views/LandingPage.tsx';
```

**Suggested Fix:**
```tsx
import { LandingPage } from '../../src/views/LandingPage.tsx';
```

**Impact:** No functional impact. Cosmetic only.

---

## Positives

- Card structure is identical to the existing Dealer / Player / Data cards — same JSX shape (`<a>` → three `<div>` children), same `styles.card` reference, same `data-testid` naming convention (`nav-{name}`).
- Emoji (📈), title, description, and href all match the task specification exactly.
- The route `#/analytics` is backed by a real `<Route>` in `App.tsx` L32 pointing to `AnalyticsPage`.
- Test was updated correctly: both the test name ("renders 5 navigation cards") and the assertion list include the new `nav-analytics` testid.
- No regressions to existing cards or their tests — playback disabled-state logic is untouched.

---

## Overall Assessment

The implementation is clean and well-scoped. All 6 acceptance criteria are **SATISFIED**. The only actionable finding is a **MEDIUM** gap: a missing href verification test for the analytics card, which breaks the per-card test pattern established for the other four cards. No CRITICAL or HIGH issues were found.

**Recommendation:** Add the missing href test to complete the pattern, then close.
