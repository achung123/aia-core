# Code Review Report — aia-core

**Date:** 2026-04-15
**Cycle:** 13
**Target:** `frontend/src/components/StatCard.tsx`, `frontend/src/components/AwardCard.tsx` + tests
**Reviewer:** Scott (automated)

**Task:** StatCard and AwardCard components
**Beads ID:** aia-core-b5q

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 1 |
| LOW | 3 |
| **Total Findings** | **4** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | StatCard renders label, value, and optional trend | SATISFIED | `StatCard.tsx` L15-30; tests "renders label and value", "renders up/down/neutral trend indicator", "renders without trend" | All three trend variants tested |
| 2 | AwardCard renders emoji, awardName, winnerName, statValue, statLabel | SATISFIED | `AwardCard.tsx` L11-28; test "renders emoji, award name, winner name, stat value, and stat label" | All five fields verified |
| 3 | Null/zero handling with muted style and dash placeholder | SATISFIED | Both components: `isEmptyValue` → em dash, `isZero` → muted color; tests "renders dash placeholder for null", "renders zero with muted style", "applies muted style for null" | Consistent logic across both components |
| 4 | Responsive layout | SATISFIED | Both components use `flex: '1 1 auto'` and `minWidth` in container styles | Containers flex to fill available space |
| 5 | Render tests exist | SATISFIED | `StatCard.test.tsx` (9 tests), `AwardCard.test.tsx` (6 tests) — all 15 pass | Good coverage of props, edge cases, and visual states |

---

## Findings

### [MEDIUM] Defensive `undefined` check diverges from type signature

**File:** `frontend/src/components/StatCard.tsx`, `frontend/src/components/AwardCard.tsx`
**Line(s):** StatCard L16, AwardCard L12
**Category:** correctness

**Problem:**
`isEmptyValue` checks `value === null || value === undefined`, but the `value`/`statValue` prop type is `string | number | null` — `undefined` is not in the union. This creates a gap between the type contract and the runtime guard. If someone passes `undefined` via a type bypass (e.g., `as any`, JavaScript caller), the component handles it gracefully, but the type signature doesn't communicate that `undefined` is an accepted input.

**Suggested Fix:**
Either widen the type to `string | number | null | undefined` to match the runtime check, or rely on TypeScript and simplify to `value === null`. The defensive approach is reasonable for a UI component, but the type and runtime should agree.

**Impact:** Low risk — purely a type-vs-runtime consistency gap. No bugs at runtime.

---

### [LOW] Weak assertion in AwardCard "renders all required fields" test

**File:** `frontend/test/components/AwardCard.test.tsx`
**Line(s):** 63-74
**Category:** correctness

**Problem:**
The test "renders all required fields when provided" only checks `container.firstElementChild` is truthy. This verifies the component doesn't crash but doesn't assert any visible content. The first test already covers all five fields thoroughly, making this test redundant rather than additive.

**Suggested Fix:**
Either remove this test (it's covered by the first test) or add meaningful assertions (e.g., check specific text content for the props passed).

**Impact:** No bug, but a missed opportunity for an additional meaningful assertion.

---

### [LOW] No accessibility attributes on card containers

**File:** `frontend/src/components/StatCard.tsx`, `frontend/src/components/AwardCard.tsx`
**Line(s):** StatCard L22, AwardCard L18
**Category:** design

**Problem:**
Neither component uses semantic HTML or ARIA attributes. The outer `<div>` has no `role` or `aria-label`. For presentational cards this is acceptable, but adding `role="group"` and an `aria-label` (e.g., derived from the label/awardName prop) would improve screen reader experience.

**Suggested Fix:**
Consider adding `role="group"` and `aria-label={label}` to StatCard's container and `aria-label={awardName}` to AwardCard's container. Not blocking — this is an enhancement.

**Impact:** Minor accessibility gap for screen reader users.

---

### [LOW] Components not yet imported by any parent

**File:** `frontend/src/components/StatCard.tsx`, `frontend/src/components/AwardCard.tsx`
**Line(s):** N/A
**Category:** design

**Problem:**
Neither `StatCard` nor `AwardCard` is imported or used anywhere in the application yet. This is expected for new components built ahead of integration, but worth flagging to ensure they get wired in during a subsequent cycle.

**Suggested Fix:**
Ensure a follow-up task integrates these components into the analytics dashboard or game summary view.

**Impact:** No functional impact — components are tested and ready for integration.

---

## Positives

- **Consistent patterns:** Both components follow the same structure as existing components (`CardIcon`, `BlindPositionDisplay`) — named exports, exported interfaces, inline styles via `Record<string, React.CSSProperties>`.
- **Shared null/zero logic:** Both components handle `null` → em dash and `0` → muted style identically, creating a predictable UX pattern.
- **Well-structured tests:** 15 tests across 2 files cover all prop combinations, edge cases (null, zero, missing optional), and visual states (muted color). Style assertions verify the muted color value directly.
- **Responsive by default:** `flex: '1 1 auto'` with `minWidth` ensures the components adapt to container width.
- **Clean, focused components:** No side effects, no state, no API calls — pure presentational components that are easy to test and compose.

---

## Overall Assessment

Clean implementation with no critical or high-severity issues. Both components are well-tested, follow existing codebase conventions, and satisfy all acceptance criteria. The one MEDIUM finding (type/runtime divergence on `undefined`) is a minor consistency issue, not a bug. The LOW findings are enhancement suggestions. Implementation is ready for integration.

**Totals: (C: 0, H: 0, M: 1, L: 3)**
