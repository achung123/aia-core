# Code Review Report — analytics-dashboard-007

**Date:** 2026-04-15
**Cycle:** 14
**Target:** `frontend/src/components/PlayerSelector.tsx`, `frontend/test/components/PlayerSelector.test.tsx`
**Reviewer:** Scott (automated)

**Task:** T-013 — PlayerSelector component
**Beads ID:** aia-core-twz
**Epic:** aia-core-mne (Analytics Dashboard)

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
| 1 | Fetches player names from the existing /players or /stats/leaderboard endpoint | SATISFIED | `PlayerSelector.tsx` L19 calls `fetchPlayers()` on mount; test "fetches players on mount" asserts `fetchPlayers` called once | Uses `/players` endpoint via `fetchPlayers()` from `api/client.ts` |
| 2 | Supports type-ahead filtering | SATISFIED | `PlayerSelector.tsx` L39-41 filters by `inputValue.toLowerCase()`; test "filters players as user types" verifies filtering | Case-insensitive substring match |
| 3 | Calls an onSelect(playerName) callback when a player is chosen | SATISFIED | `PlayerSelector.tsx` L51-54 `handleSelect` invokes `onSelect(name)`; test "calls onSelect with player name when option is clicked" asserts callback | |
| 4 | Supports a value prop for controlled usage | SATISFIED | `PlayerSelector.tsx` L23-26 syncs `value` prop to internal state via `useEffect`; tests verify initial display and re-render | |
| 5 | Mobile-friendly: full-width input, large touch targets | SATISFIED | Container `width: '100%'` (L58), input `width: '100%'`, `padding: '12px'`, `fontSize: '16px'` (L64); options `minHeight: '44px'` (L86); tests verify width and minHeight | 44px meets Apple HIG touch-target guidance |

---

## Findings

### [MEDIUM] Silent error swallowing on fetch failure

**File:** `frontend/src/components/PlayerSelector.tsx`
**Line(s):** 19
**Category:** correctness

**Problem:**
`fetchPlayers().then(setPlayers).catch(() => {})` silently discards fetch errors. If the API is unreachable or returns an error, the component renders an empty dropdown with "No players found" — which is misleading (there *are* players, they just failed to load). The existing codebase convention in `SessionForm.tsx` (L17-20) uses a discriminated union (`PlayerLoadState`) with explicit `loading`/`error` states to surface fetch failures to the user.

**Code:**
```tsx
useEffect(() => {
  fetchPlayers().then(setPlayers).catch(() => {});
}, []);
```

**Suggested Fix:**
Add a loading/error state or, at minimum, log the error and optionally surface it via a prop callback (e.g., `onError`). Follow the `SessionForm` pattern with a `PlayerLoadState` discriminated union if the component should show loading/error UI inline.

**Impact:** Users see "No players found" instead of a meaningful error message when the API fails. Parent components cannot differentiate between "no players exist" and "fetch failed."

---

### [MEDIUM] Incomplete ARIA combobox pattern

**File:** `frontend/src/components/PlayerSelector.tsx`
**Line(s):** 58-93
**Category:** design / accessibility

**Problem:**
The input declares `role="combobox"`, `aria-expanded`, and `aria-autocomplete="list"`, but the implementation is missing several required parts of the [WAI-ARIA Combobox pattern](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/):

1. **No keyboard navigation** — Arrow keys don't move focus through options; Enter doesn't select the active option; Escape doesn't close the dropdown.
2. **No `aria-controls`** on the input referencing the listbox `id`.
3. **No `aria-selected`** on `<li role="option">` elements.
4. **No `aria-activedescendant`** for tracking the visually focused option.

Declaring ARIA roles without the expected keyboard behavior can mislead assistive technology users into expecting interactions that don't work.

**Suggested Fix:**
Either implement the full WAI-ARIA combobox keyboard interaction (arrow keys, Enter, Escape, Home/End) with the missing ARIA attributes, or remove the ARIA roles and treat this as a plain filtered input until full accessibility support is added. A library like Downshift or React Aria's `useComboBox` can provide this out of the box.

**Impact:** Screen reader users encounter a combobox that doesn't respond to standard keyboard patterns, degrading accessibility.

---

### [LOW] No fetch abort on component unmount

**File:** `frontend/src/components/PlayerSelector.tsx`
**Line(s):** 18-20
**Category:** correctness

**Problem:**
The `useEffect` that calls `fetchPlayers()` does not use an `AbortController`. If the component unmounts before the promise resolves, `setPlayers` is called on an unmounted component. In React 18 strict mode this is benign (no warning), but it's still a minor resource leak and deviates from best practice.

**Code:**
```tsx
useEffect(() => {
  fetchPlayers().then(setPlayers).catch(() => {});
}, []);
```

**Suggested Fix:**
```tsx
useEffect(() => {
  let cancelled = false;
  fetchPlayers()
    .then((data) => { if (!cancelled) setPlayers(data); })
    .catch(() => {});
  return () => { cancelled = true; };
}, []);
```

**Impact:** Minor — potential stale state update on fast navigation.

---

### [LOW] No `aria-label` or associated `<label>` for the input

**File:** `frontend/src/components/PlayerSelector.tsx`
**Line(s):** 60-66
**Category:** design / accessibility

**Problem:**
The combobox input has no `aria-label`, `aria-labelledby`, or associated `<label>` element. Screen readers will announce it as an unlabeled combobox. The `placeholder` prop is not a substitute for a label.

**Suggested Fix:**
Accept an `aria-label` or `label` prop and apply it to the input.

**Impact:** Minor accessibility gap — screen readers cannot announce the purpose of the input.

---

## Positives

- **Clean, focused component** — single responsibility, no extraneous features
- **Good controlled/uncontrolled pattern** — `value` prop syncs cleanly via `useEffect` without breaking internal state
- **Click-outside dismiss** — properly implemented with cleanup on unmount
- **Strong test coverage** — 11 tests map cleanly to all 5 ACs plus edge cases; mock isolation of `fetchPlayers` is well done
- **Consistent typing** — uses `PlayerResponse` from the shared types package

---

## Overall Assessment

The `PlayerSelector` component is a solid, minimal implementation that satisfies all 5 acceptance criteria. No critical or high-severity issues were found. The two medium findings (silent error handling and incomplete ARIA pattern) are worth addressing before the component is used in downstream tasks (aia-core-3ow head-to-head page, aia-core-fad player profile page) that will surface it to end users. The error-handling gap is particularly notable since the existing codebase (`SessionForm.tsx`) already demonstrates the correct pattern. Tests are well-structured and provide good AC coverage.

**(C: 0, H: 0, M: 2, L: 2)**
