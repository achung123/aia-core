# Code Review Report — aia-core

**Date:** 2026-04-15
**Target:** `frontend/src/components/CardIcon.tsx`, `frontend/test/components/CardIcon.test.tsx`
**Reviewer:** Scott (automated)
**Cycle:** 12

**Task:** CardIcon component
**Beads ID:** aia-core-eat

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
| 1 | Component accepts a card prop (string like "AH", "10C", "KD") | SATISFIED | `CardIcon.tsx` L8 — `CardIconProps.card: string \| null \| undefined`; tests cover "AH", "KS", "9D", "JC", "10C" | Prop type correctly typed |
| 2 | Renders rank + suit in correct color (red for H/D, black for S/C) | SATISFIED | `CardIcon.tsx` L4-5 — `SUIT_COLORS` maps H/D → `#dc2626`, S/C → `#1e293b`; tests assert color on all 4 suits | Colors verified in tests |
| 3 | Handles null/undefined (nothing) and invalid string (placeholder) | SATISFIED | `CardIcon.tsx` L12-16 — null/undefined → `null`, invalid → placeholder `?`; tests for null, undefined, "XY", "" | Both paths tested |
| 4 | Has test file with basic render tests | SATISFIED | `CardIcon.test.tsx` — 15 passing tests covering rendering, color, nullability, invalid input, element type | Comprehensive test coverage |

---

## Findings

### [MEDIUM] Duplicated suit maps across CardIcon and PlayingCard

**File:** `frontend/src/components/CardIcon.tsx`
**Line(s):** 4-5
**Category:** design

**Problem:**
`SUIT_MAP` and `SUIT_COLORS` are defined independently in both `CardIcon.tsx` (uppercase keys) and `PlayingCard.tsx` (lowercase keys). They carry the same data — suit code → Unicode symbol and suit code → hex color. This is a DRY violation that could drift if one component is updated without the other.

**Code:**
```tsx
// CardIcon.tsx
const SUIT_MAP: Record<string, string> = { H: '♥', D: '♦', C: '♣', S: '♠' };
const SUIT_COLORS: Record<string, string> = { H: '#dc2626', D: '#dc2626', C: '#1e293b', S: '#1e293b' };

// PlayingCard.tsx
const SUIT_MAP: Record<string, string> = { h: '♥', s: '♠', d: '♦', c: '♣' };
const SUIT_COLORS: Record<string, string> = { h: '#dc2626', s: '#1e293b', d: '#dc2626', c: '#1e293b' };
```

**Suggested Fix:**
Extract shared suit constants into `cardUtils.ts` with a single canonical casing (uppercase), and import in both components.

**Impact:** Risk of color/symbol drift between components if one is updated independently.

---

### [LOW] Redundant falsy check before `isValidCard`

**File:** `frontend/src/components/CardIcon.tsx`
**Line(s):** 14
**Category:** correctness

**Problem:**
The `!card` guard on line 14 is redundant. At this point, `card` is guaranteed non-null (line 12 returns early for `null`/`undefined`), so `!card` only catches the empty string `""`. However, `isValidCard("")` already returns `false` (it trims to empty, returns false), making the `!card` check a no-op.

**Code:**
```tsx
if (!card || !isValidCard(card)) {
```

**Suggested Fix:**
Simplify to `if (!isValidCard(card))`. Not urgent — this is a clarity improvement, not a bug.

**Impact:** None — behavior is correct. Minor readability note.

---

### [LOW] Inconsistent suit map key casing convention

**File:** `frontend/src/components/CardIcon.tsx`
**Line(s):** 4-5
**Category:** convention

**Problem:**
`CardIcon.tsx` uses uppercase keys (`H`, `D`, `C`, `S`) while the existing `PlayingCard.tsx` uses lowercase keys (`h`, `d`, `c`, `s`). Both work because each component normalizes case internally, but the inconsistency makes the codebase harder to grep and reason about.

**Suggested Fix:**
Adopt a single convention (uppercase, matching `isValidCard` output) across both components. Best addressed alongside the MEDIUM finding above by sharing constants.

**Impact:** Minor convention inconsistency. No functional impact.

---

## Positives

- **Clean separation of concerns** — validation is delegated to `isValidCard` in `cardUtils.ts`, keeping the component focused on rendering
- **Comprehensive tests** — 15 tests cover all four suits, multi-char rank (10), case insensitivity, null, undefined, invalid string, empty string, and element type — well above the AC requirement
- **XSS-safe** — all user-supplied card strings are rendered via JSX interpolation (auto-escaped), no `dangerouslySetInnerHTML`
- **TypeScript-strict** — `CardIconProps` interface properly types `card` as `string | null | undefined`
- **Correct edge cases** — whitespace and mixed-case inputs are handled via `trim().toUpperCase()` in both validation and rendering paths

---

## Overall Assessment

The `CardIcon` component is a clean, well-tested implementation. All four acceptance criteria are satisfied. No critical or high-severity issues were found. The one medium finding (duplicated suit maps) is a DRY concern that should be addressed when the shared constants surface is consolidated — it poses no immediate risk. The two low findings are style/clarity observations only.

**Verdict: PASS — no critical issues.**
