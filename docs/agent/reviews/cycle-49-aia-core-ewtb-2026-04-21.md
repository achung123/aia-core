# Code Review Report — aia-core / table-3d-revamp-010

**Cycle:** 49
**Date:** 2026-04-21
**Target:** `aia-core-ewtb` (T-029 — Mobile touch / tap-target / 360px-width audit)
**Reviewer:** Scott (automated, loop-review)

**Task:** T-029 — Mobile touch / tap-target / 360px-width audit
**Beads ID:** aia-core-ewtb
**Epic:** table-3d-revamp-010 (S-6.3)

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
| 1 | Gesture matrix verified on two physical or emulated devices (document versions). | SATISFIED | [docs/frontend/mobile-gesture-matrix.md](../../../docs/frontend/mobile-gesture-matrix.md) — iPhone SE (iOS 17 Safari, 360×780) + Pixel 5 (Android 14 Chrome, 393×851). | Emulated device frames in Chrome DevTools; versions documented per AC wording "document versions". |
| 2 | Automated test asserts all interactive overlays' rendered size ≥ 44px. | SATISFIED | [frontend/test/scenes3d/mobileAudit.test.tsx](../../../frontend/test/scenes3d/mobileAudit.test.tsx) AC-2 block (5 tests: CameraPresetToolbar, HandScrubberPanel, TableSettingsPanel radiogroups, QualityToast dismiss, SessionScrubber prev/next). | Gaps discovered in QualityToast.buttonStyle (`all: unset` wiped sizing) and SessionScrubber button (padding 4×8 only); both fixed this cycle. |
| 3 | Visual regression or screenshot test at 360px viewport passes. | PARTIAL | [frontend/test/scenes3d/mobileAudit.test.tsx](../../../frontend/test/scenes3d/mobileAudit.test.tsx) AC-3 block — 4 structural/inline-sum assertions at `window.innerWidth=360`. | happy-dom has no real layout engine; delivered inline-sum + `flexWrap: 'wrap'` structural checks rather than a pixel snapshot. See MED-1. |
| 4 | Orientation-change smoke test passes. | SATISFIED | [frontend/test/scenes3d/mobileAudit.test.tsx](../../../frontend/test/scenes3d/mobileAudit.test.tsx) AC-4 block — 3 tests (HandScrubberPanel, TableSettingsPanel, SessionScrubber+QualityToast) flipping 360×780 ↔ 780×360 and dispatching `resize` + `orientationchange`. | All panels re-render without throwing; state preserved across the flip. |

---

## Findings

### [MEDIUM] AC-3 is a structural/inline-sum check, not a pixel-level visual regression

**File:** `frontend/test/scenes3d/mobileAudit.test.tsx`
**Line(s):** 107–146 (AC-3 describe block)
**Category:** design

**Problem:**
The canonical AC-3 text reads "**Visual regression or screenshot test** at 360px viewport passes." The implementation asserts (a) inline-minimum arithmetic fits within 360 and (b) `TableSettingsPanel` radiogroups use `flexWrap: 'wrap'`. happy-dom does not compute layout, so a true pixel snapshot is not available in this test environment. The current assertions defend against inline-style regressions (e.g. someone shrinking `minWidth` below 44, or removing `flexWrap`) but will not catch non-inline overflow introduced via stylesheet imports, computed grid sizing, or deeply-nested absolute positioning.

**Suggested follow-up:**
Add a Playwright (or Vitest-browser) companion that renders `PlaybackView` at a 360×780 viewport and asserts `document.documentElement.scrollWidth <= 360`. Track as T-029-followup in the next planning cycle; non-blocking for close because the intent (resist horizontal-scroll regressions at 360px) is exercised structurally.

---

### [MEDIUM] PlaybackView back-button + route-level composition not exercised by the new test file

**File:** `frontend/test/scenes3d/mobileAudit.test.tsx`
**Line(s):** entire file
**Category:** design (coverage)

**Problem:**
The audit exercises each overlay in isolation. The full route composition (`PlaybackView` wrapping `SessionReplayShell` + `PokerCanvas` + `QualityToast` + `back-button`) is not rendered at 360px as an integrated scene. The back-button has `minWidth: 48` / `minHeight: 48` in `playbackStyles.ts` so it does pass the intent, but it is not asserted.

**Suggested follow-up:**
Either widen `mobileAudit.test.tsx` to render `<PlaybackView />` end-to-end at `window.innerWidth = 360` (with the query-client/router harness the existing `PlaybackView.test.tsx` uses), or add one assertion there covering the back-button's tap-target. Non-blocking.

---

### [LOW] `MIN_TAP_TARGET_PX` duplicated across 4 component files

**File:** `frontend/src/scenes3d/components/CameraPresetToolbar.tsx` (line 40), `HandScrubberPanel.tsx` (line 67), `TableSettingsPanel.tsx` (line 17), `QualityToast.tsx` (new this cycle).
**Category:** convention (DRY)

**Problem:**
Four separate `const MIN_TAP_TARGET_PX = 44;` declarations now exist. Changes to the minimum (e.g. adopting 48 px for Material 3) require edits in four files and the magic number in `SessionScrubber.tsx`.

**Suggested follow-up:**
Extract to `frontend/src/scenes3d/constants.ts` (or reuse one of the existing shared modules under `scenes3d/`) and import. Non-blocking.

---

### [LOW] `SessionScrubber.tsx` uses inline numeric `44` instead of a named constant

**File:** `frontend/src/components/SessionScrubber.tsx`
**Line(s):** 21–22 (`minWidth: 44, minHeight: 44`)
**Category:** convention (naming)

**Problem:**
Other overlays in this cycle use `MIN_TAP_TARGET_PX` with an inline comment citing iOS HIG. `SessionScrubber` was updated with a comment pointing at T-029 AC-2 but the `44` is inline. Minor inconsistency that would be resolved by the LOW-1 follow-up.

**Suggested follow-up:**
Import the extracted constant when LOW-1 lands.

---

## Positives

- Tight red-green cycle: Hank wrote the failing test first (Red showed **only** the QualityToast dismiss and SessionScrubber prev/next failing) then surgically patched the two offending inline styles. No drive-by refactors of the already-compliant overlays.
- `QualityToast.buttonStyle` correctly re-adds `display: inline-flex` + `alignItems`/`justifyContent` after `all: 'unset'` so the `minWidth`/`minHeight` actually render as a 44×44 centered hit region (not just a bounding box with text at the top-left).
- AC-4 test meaningfully dispatches both `resize` and `orientationchange` events, not just one, so any future consumer that subscribes to either will be exercised.
- Gesture matrix documentation cites device + OS versions per AC-1 wording, and links the three automated-test blocks back into the three automated ACs for traceability.
- Test-count delta matches expectation: 1844 → 1856 (+12).

---

## Summary

T-029 is implemented with **AC-1 / AC-2 / AC-4 SATISFIED** and **AC-3 PARTIAL** (structural rather than pixel-level). All findings are MED or LOW and non-blocking per the Anna contract — they belong in `tasks.md` as carry-forwards, not as new beads issues. The audit correctly surfaced two latent tap-target gaps (QualityToast dismiss, SessionScrubber prev/next) and fixed them with minimal diffs. Recommend close.

**Suggested close reason:** T-029 implemented — audit-first mobileAudit.test.tsx (12 tests) at 360×780 covers AC-2/3/4 structurally; two latent tap-target gaps found and fixed (QualityToast dismiss button, SessionScrubber prev/next). AC-1 gesture matrix documented at docs/frontend/mobile-gesture-matrix.md (iPhone SE iOS 17 Safari 360×780, Pixel 5 Android 14 Chrome 393×851). Full suite 1844→1856 green; lint delta 0. Cycle 49: 0 CRIT / 0 HIGH / 2 MED / 2 LOW — M-1 AC-3 is structural not pixel-level (follow-up: Playwright viewport test); M-2 PlaybackView integration coverage gap; L-1 `MIN_TAP_TARGET_PX` duplicated across overlay files; L-2 SessionScrubber uses inline `44` instead of named constant. All tasks.md per Anna contract. Review: docs/agent/reviews/cycle-49-aia-core-ewtb-2026-04-21.md.
