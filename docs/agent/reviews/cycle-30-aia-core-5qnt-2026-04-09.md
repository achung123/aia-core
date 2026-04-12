# Code Review Report — dealer-viz-004

**Date:** 2026-04-09
**Cycle:** 30
**Target:** T-022 — Preact-styled UI controls for mobile
**Reviewer:** Scott (automated)

**Task:** T-022 — Preact-styled UI controls for mobile
**Beads ID:** aia-core-5qnt
**Story:** S-6.3

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 3 |
| LOW | 2 |
| **Total Findings** | **5** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | Session scrubber and street scrubber are Preact components with mobile-friendly sizing | SATISFIED | `frontend/src/mobile/SessionScrubber.jsx`, `frontend/src/mobile/StreetScrubber.jsx` — both use `h` from Preact, 48px min touch targets | Tests verify 48px sizing |
| 2 | Styling matches dealer interface (indigo accent, rounded corners) | SATISFIED | Both scrubbers use `#4f46e5` indigo accent, `8px` border-radius; tests verify palette | |
| 3 | Equity overlay renders as horizontal card row below canvas | SATISFIED | `frontend/src/mobile/EquityRow.jsx` — flex row with `overflowX: auto`, rendered inside scrubber-mount div | |
| 4 | "Back to Dealer" or "Back to Games" navigation link is available | SATISFIED | `frontend/src/views/MobilePlaybackView.jsx` L218–L237 — back button with 48px touch target, resets state and reopens drawer | Button label is "← Back" (not "Back to Games") but intent is met |
| 5 | All controls are usable on a 375px-wide screen | PARTIAL | Buttons use `flex: 1` and `minWidth: 48px`; horizontal scrolling enabled via `overflowX: auto`. However, 5 street buttons × 48px min + gaps = ~260px, which fits. No test validates 375px layout | No integration-level layout test on a narrow viewport |

---

## Findings

### [MEDIUM] EquityRow renders player names without length capping in the container

**File:** `frontend/src/mobile/EquityRow.jsx`
**Line(s):** 28–33
**Category:** design

**Problem:**
The `.name` style sets `overflow: hidden` and `textOverflow: ellipsis` but does not set a `maxWidth` on the card container. The card has `minWidth: 80px` with `flexShrink: 0`, so with many players (6+), the row grows unbounded and requires horizontal scrolling. On a 375px screen with 6 players, the equity row extends to ~540px — the user must scroll to see all equities.

**Suggested Fix:**
Consider adding `maxWidth` to the card (e.g., `calc((100vw - 24px - 30px) / 4)` for 4-visible cards) or reducing `minWidth` to `64px` so more cards fit without scrolling. Alternatively, accept the scroll behavior as intentional — it is functional, just not ideal for glanceability.

**Impact:** Usability on narrow screens with many players. Not a blocker since horizontal scroll is enabled.

---

### [MEDIUM] No ARIA labels on navigation buttons

**File:** `frontend/src/mobile/SessionScrubber.jsx`
**Line(s):** 43–50, 53–60
**Category:** accessibility

**Problem:**
The prev/next buttons use Unicode arrows (◀ / ▶) as their only text content. Screen readers will read these as "black left-pointing triangle" / "black right-pointing triangle" rather than "Previous hand" / "Next hand". The back button in `MobilePlaybackView.jsx` (L228) uses "← Back" which is slightly better but still starts with a Unicode arrow.

**Suggested Fix:**
Add `aria-label="Previous hand"` and `aria-label="Next hand"` to the SessionScrubber buttons. Add `aria-label="Back to games"` on the back button. Similarly, StreetScrubber buttons could use `aria-label` for consistency, though they already have text labels.

**Impact:** Accessibility for screen reader users. Low practical impact for a poker visualization app but good practice.

---

### [MEDIUM] `handleSessionChange` calls `showHand` which reads stale `hands` closure

**File:** `frontend/src/views/MobilePlaybackView.jsx`
**Line(s):** 192–195
**Category:** correctness

**Problem:**
`handleSessionChange` calls `showHand(newIndex - 1)` without passing the `hands` array. Inside `showHand`, line 131 does `const list = handsList || hands;` — this references the `hands` value from the closure at the time `showHand` was defined. Because `showHand` is not wrapped in `useCallback` and `handleSessionChange` is also not memoized, both are recreated on every render with the latest `hands` value. This works in practice but is fragile — if either function were memoized in the future, the stale closure would surface as a bug.

**Suggested Fix:**
Always pass `hands` explicitly: `showHand(newIndex - 1, hands)` in `handleSessionChange`. This makes the data flow explicit and prevents future stale-closure issues.

**Impact:** No current bug, but a latent correctness risk if the component is refactored to use `useCallback`.

---

### [LOW] `drawer-toggle` button has no minimum touch target height

**File:** `frontend/src/views/MobilePlaybackView.jsx`
**Line(s):** 267–276
**Category:** accessibility

**Problem:**
The drawer toggle button has `padding: '10px'` but no explicit `minHeight: '48px'`. With a 14px font, the rendered height is ~34px, below the 48px minimum touch target that all other buttons in this PR follow. This is inconsistent.

**Suggested Fix:**
Add `minHeight: '48px'` to the drawer toggle style to match the touch target standard used elsewhere.

**Impact:** Minor touch target inconsistency. The button spans full width so it's still easy to tap, but doesn't meet the 48px standard.

---

### [LOW] `game-card` buttons lack explicit touch target height

**File:** `frontend/src/views/MobilePlaybackView.jsx`
**Line(s):** 291–306
**Category:** accessibility

**Problem:**
Game card buttons have `padding: '12px'` but no `minHeight`. With the two lines of text content (~14px + 11px + padding), actual height is approximately 49px which meets the 48px target, but only incidentally. If content changes (e.g., empty date or missing hand_count), the height could drop below 48px.

**Suggested Fix:**
Add `minHeight: '48px'` for consistency.

**Impact:** Very minor. Current content ensures adequate height.

---

## Positives

- **Clean component API:** SessionScrubber, StreetScrubber, and EquityRow each have minimal, well-defined prop interfaces. Easy to test and compose.
- **Thorough test coverage:** All three new components have comprehensive test suites covering rendering, interaction, edge cases (null/empty data), and styling verification.
- **XSS-safe:** Player names from the backend are rendered via JSX text content — Preact auto-escapes, and no `dangerouslySetInnerHTML` is used anywhere in the changed files.
- **Edge case handling:** EquityRow returns `null` for null/empty maps. StreetScrubber defaults `handData` to `{}` when nullish. SessionScrubber disables buttons at boundaries.
- **Consistent design language:** All new components follow the indigo palette (`#4f46e5`, `#1a1a2e`, `#1e1b4b`) and 48px touch targets consistently.
- **Integration tested:** MobilePlaybackView tests verify the full flow — game selection, scrubber visibility, back navigation, and equity row rendering.

---

## Overall Assessment

T-022 is well-implemented. The three new Preact components are clean, focused, and well-tested. All 5 acceptance criteria are met (AC-5 is PARTIAL only because there's no explicit 375px viewport test, but the layout math works). No security issues — player names are JSX-escaped, no raw HTML injection vectors. The 3 MEDIUM findings are accessibility improvements and a defensive coding suggestion, none of which represent bugs or blockers. The 2 LOW findings are minor touch target consistency gaps. **No critical issues found.**
