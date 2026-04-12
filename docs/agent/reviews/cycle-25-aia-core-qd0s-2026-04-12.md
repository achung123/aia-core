# Code Review Report — aia-core (Cycle 25)

**Date:** 2026-04-12
**Target:** RTL test migration (T-026 / aia-core-qd0s)
**Reviewer:** Scott (automated)
**Cycle:** 25

**Task:** T-026 — Migrate all component tests to RTL
**Beads ID:** aia-core-qd0s

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
| 1 | All test files converted to .tsx | SATISFIED | `find frontend/src -name '*.test.tsx'` returns 46 files; `find frontend/src -name '*.test.jsx'` returns 0 | Pure logic tests remain `.test.ts` as expected |
| 2 | No Preact/createRoot patterns remain | SATISFIED | `grep -rn 'createRoot\|from.*preact' frontend/src/ --include='*.test.tsx'` returns 0 matches | Fully eliminated |
| 3 | RTL render/cleanup used everywhere | SATISFIED | All 33 `.test.tsx` files with JSX import `render`/`cleanup` from `@testing-library/react`; all have `afterEach` with `cleanup()` | Consistent pattern |
| 4 | 605 tests pass | SATISFIED | `npx vitest run` → 605 passed, 0 failed across 46 test files | 570 `act()` warnings present but non-blocking (pre-existing) |
| 5 | Zero .jsx test files remain | SATISFIED | `find frontend/src -name '*.test.jsx'` returns 0 | Clean |

---

## Findings

### [MEDIUM] Mock paths reference non-existent `.js`/`.jsx` extensions

**Files:**
- `frontend/src/dealer/GameSelectorIntegration.test.tsx` lines 6, 44, 49
- `frontend/src/dealer/DealerApp.test.tsx` lines 89, 94
- `frontend/src/dealer/HandDashboard.test.tsx` line 12

**Category:** convention

**Problem:**
Six `vi.mock()` calls reference files with `.js` or `.jsx` extensions that no longer exist. The actual files are `.ts`/`.tsx`:

| Mock path | Actual file |
|---|---|
| `../api/client.js` | `../api/client.ts` |
| `../mobile/StreetScrubber.jsx` | `../mobile/StreetScrubber.tsx` |
| `../poker/evaluator.js` | `../poker/evaluator.ts` |
| `./QRCodeDisplay.jsx` | `./QRCodeDisplay.tsx` |

Vitest resolves these through Vite's module resolution (extensions are stripped), so tests pass today. However, this creates inconsistency — `DealerApp.test.tsx` mocks `../api/client.ts` (correct) while `GameSelectorIntegration.test.tsx` mocks `../api/client.js` (stale). If Vitest or Vite tighten resolution in a future version, these mocks could silently fail.

**Suggested Fix:**
Update the 6 mock paths to match actual file extensions (`.ts`/`.tsx`).

**Impact:** Low runtime risk today; maintenance confusion and potential breakage on toolchain upgrade.

---

### [LOW] `act()` environment warnings (570 occurrences)

**File:** `frontend/src/dealer/DealerApp.test.tsx` (primary source)

**Category:** convention

**Problem:**
570 stderr warnings: "The current testing environment is not configured to support act(...)". These are emitted by React when `act()` is used with happy-dom. All tests pass despite the warnings, and this is a pre-existing issue not introduced by the migration.

**Suggested Fix:**
This is out of scope for T-026 but could be addressed by switching the vitest environment to `jsdom` or configuring `globalThis.IS_REACT_ACT_ENVIRONMENT = true` in test setup.

**Impact:** Noisy CI output only; no functional impact.

---

### [LOW] `GameSelectorIntegration.test.tsx` mock style differs from `DealerApp.test.tsx`

**File:** `frontend/src/dealer/GameSelectorIntegration.test.tsx` lines 6–56 vs `frontend/src/dealer/DealerApp.test.tsx` lines 7–95

**Category:** convention

**Problem:**
`GameSelectorIntegration.test.tsx` was a full rewrite and mocks `../api/client.js` with inline extension, while `DealerApp.test.tsx` (which was only patched) mocks `../api/client.ts`. Both work, but the inconsistency adds friction for future contributors scanning mock patterns.

**Suggested Fix:**
Normalize to `.ts`/`.tsx` extensions in all mock calls across both files.

**Impact:** Readability/consistency only.

---

## Positives

- **Clean migration**: All 6 files successfully converted with zero test regressions.
- **Consistent cleanup pattern**: Every migrated test file uses `afterEach(() => { cleanup(); })` — no leaked DOM state between tests.
- **Type-safe mocks**: The `as ReturnType<typeof vi.fn>` pattern for typed mock functions is used consistently in `GameSelectorIntegration.test.tsx` and `PlayerApp.test.tsx`.
- **Helper functions**: `renderToContainer()` and `findButton()` helpers reduce boilerplate and improve readability across the migrated files.
- **Full test passage**: 605 tests across 46 files — zero failures, zero skipped.
- **No `.jsx` test files remain**: Complete elimination of the legacy format.

---

## Overall Assessment

The RTL migration is **complete and clean**. All five acceptance criteria are satisfied. The only finding above informational severity is the stale `.js`/`.jsx` mock paths (MEDIUM), which work today but are a maintenance liability. No CRITICAL or HIGH issues were found.

**Recommendation:** Close T-026. The MEDIUM mock-path issue can be filed as a follow-up chore.
