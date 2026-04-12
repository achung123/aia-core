# Code Review Report — aia-core

**Date:** 2026-04-12
**Cycle:** 18
**Target:** T-025 — Set up React Testing Library and migrate test infra
**Beads ID:** aia-core-agx9
**Reviewer:** Scott (automated)

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 0 |
| LOW | 1 |
| **Total Findings** | **1** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | RTL + jest-dom + user-event installed as devDeps | SATISFIED | `package.json` devDependencies: `@testing-library/react` ^16.3.0, `@testing-library/jest-dom` ^6.6.3, `@testing-library/user-event` ^14.6.1 | All three present in devDependencies, not dependencies |
| 2 | Vitest configured with DOM environment | SATISFIED | `vite.config.ts` L7: `environment: 'happy-dom'` (pre-existing); `happy-dom` ^20.8.9 in devDependencies | happy-dom was already configured; RTL setup builds on it correctly |
| 3 | Test setup file extends expect with jest-dom matchers | SATISFIED | `src/test/setup.ts` L1: `import '@testing-library/jest-dom/vitest'`; `vite.config.ts` L8: `setupFiles: ['./src/test/setup.ts']` | Uses the correct Vitest-specific entry point (not generic `@testing-library/jest-dom`) |
| 4 | Smoke test verifies setup works | SATISFIED | `src/test/rtl-setup.test.tsx` — 3 tests: `toBeInTheDocument()`, `toHaveTextContent()`, and `userEvent.click()` — all pass | Covers all three libraries: RTL render/screen, jest-dom matchers, and user-event |
| 5 | No regressions | SATISFIED | 349/349 tests pass; 23/28 test files pass; 5 failing files are pre-existing Preact import errors (`EquityRow`, `SessionScrubber`, `StreetScrubber`, `PlayerApp`, `MobilePlaybackView`) introduced in earlier commits (pre-T-025) | git log confirms failing files predate this task |

---

## Findings

### [LOW] Explicit `cleanup()` in smoke test is redundant with modern RTL

**File:** `frontend/src/test/rtl-setup.test.tsx`
**Line(s):** 6-8
**Category:** convention

**Problem:**
The module-level `afterEach(() => { cleanup(); })` is a safe precaution but technically unnecessary. `@testing-library/react` v16 auto-cleans after each test when it detects a global `afterEach`. Without `globals: true` in the Vitest config, auto-cleanup may not trigger — so the explicit call is actually a reasonable safety net for the current configuration.

**Code:**
```tsx
afterEach(() => {
  cleanup();
});
```

**Suggested Fix:**
No action required. If `globals: true` is added to the Vitest config in a future task, this can be removed. As-is, it's harmless and defensive.

**Impact:** None — cosmetic only. The explicit cleanup is actually correct given the current Vitest config lacks `globals: true`.

---

## Positives

- **Correct Vitest entry point**: Uses `@testing-library/jest-dom/vitest` (not the generic import), which properly integrates matchers with Vitest's `expect` without manual `extend()` calls.
- **Minimal, focused setup file**: `setup.ts` is a single import — no bloat, no side effects beyond extending matchers.
- **Comprehensive smoke test**: Three tests cover all three new libraries — RTL rendering + querying (`render`, `screen`), jest-dom matchers (`toBeInTheDocument`, `toHaveTextContent`), and user-event (`userEvent.setup()` + `click()`). This validates the full integration stack.
- **Proper TypeScript usage**: Smoke test is `.tsx`, inline test components are properly typed with React patterns (`useState`, typed props).
- **No unnecessary changes**: Only four files touched, all directly related to the task. No drive-by refactors.

---

## Overall Assessment

The RTL test infrastructure setup is **clean and complete**. All five acceptance criteria are satisfied. The three new testing-library packages are properly installed as devDependencies, the Vitest setup file correctly extends matchers via the Vitest-specific entry point, and the smoke test validates rendering, DOM matchers, and user interaction. The single LOW finding (explicit cleanup) is actually a correct pattern given the current config. No regressions — the 5 failing test files all predate this task (Preact import errors from earlier commits). No blockers.
