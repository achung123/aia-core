# Code Review Report — dealer-interface-003

**Date:** 2026-04-07
**Cycle:** 6
**Target:** `frontend/src/dealer/PlayerGrid.jsx`, `frontend/src/dealer/DealerApp.jsx`
**Reviewer:** Scott (automated)

**Task:** T-007 — Build Player Grid component
**Beads ID:** aia-core-gsf
**Epic:** Dealer Interface (dealer-interface-003)

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
| 1 | One tile per player plus one "Table" tile | SATISFIED | PlayerGrid.jsx L6–L12 renders a "Table" button; L14–L22 maps over `players` array | Table tile rendered first, then one button per player via `.map()` |
| 2 | Tiles are large enough for easy tap on mobile (~80px min) | SATISFIED | PlayerGrid.jsx L46 `minHeight: '80px'` plus `padding: '1rem'` | Meets the 80px minimum; padding provides additional touch area |
| 3 | Checkmark overlays appear on tiles where `recorded` is true | SATISFIED | PlayerGrid.jsx L11 (`communityRecorded &&`) and L21 (`p.recorded &&`) render ✅ emoji with absolute positioning | Check appears top-right via `position: absolute` overlay |
| 4 | Tapping a tile emits the player name (or "community") to the parent | SATISFIED | PlayerGrid.jsx L8 `onTileSelect('community')` and L19 `onTileSelect(p.name)` | DealerApp.jsx L23–26 receives via `handleTileSelect`; currently a console.log placeholder for T-009 |

---

## Findings

### [MEDIUM] M-001 — Missing `type="button"` on tile buttons

**File:** `frontend/src/dealer/PlayerGrid.jsx`
**Line(s):** 6–7, 16–17
**Category:** convention

**Problem:**
The `<button>` elements do not specify `type="button"`. Without an explicit type, HTML buttons default to `type="submit"`. While the buttons are not currently inside a `<form>`, this is a defensive best practice — if the component is ever composed inside a form context, the buttons will unexpectedly trigger form submission. The sibling component `GameCreateForm.jsx` explicitly sets `type="button"` on its toggle buttons.

**Code:**
```jsx
<button
  style={styles.tile}
  onClick={() => onTileSelect('community')}
>
```

**Suggested Fix:**
Add `type="button"` to both the Table tile `<button>` and the player `.map()` `<button>`:
```jsx
<button type="button" style={styles.tile} onClick={() => onTileSelect('community')}>
```

**Impact:** Preventive — avoids unexpected form submission if component composition changes.

---

### [MEDIUM] M-002 — No ARIA attributes to communicate recorded state

**File:** `frontend/src/dealer/PlayerGrid.jsx`
**Line(s):** 6–22
**Category:** design (accessibility)

**Problem:**
Screen readers have no way to distinguish recorded tiles from unrecorded tiles. The ✅ emoji is a visual-only indicator — assistive technologies may read it inconsistently or not at all. There is no `aria-label`, `aria-pressed`, or `role` attribute to convey the recorded state programmatically.

**Code:**
```jsx
<button style={styles.tile} onClick={() => onTileSelect(p.name)}>
  <span style={styles.tileName}>{p.name}</span>
  {p.recorded && <span style={styles.check}>✅</span>}
</button>
```

**Suggested Fix:**
Add an `aria-label` that includes the recorded state:
```jsx
<button
  type="button"
  style={styles.tile}
  onClick={() => onTileSelect(p.name)}
  aria-label={`${p.name}${p.recorded ? ' (recorded)' : ''}`}
>
```
Apply the same pattern to the Table tile with `communityRecorded`.

**Impact:** Accessibility improvement for screen reader users. Important for inclusive design on mobile (VoiceOver, TalkBack).

---

### [LOW] L-001 — Inconsistent `import { h }` across dealer components

**File:** `frontend/src/dealer/PlayerGrid.jsx`
**Line(s):** 1
**Category:** convention

**Problem:**
`GameCreateForm.jsx` and `HandDashboard.jsx` both import `{ h } from 'preact'`, while `PlayerGrid.jsx` and `DealerApp.jsx` do not. The project uses `@preact/preset-vite` which provides an automatic JSX transform, so the import is technically unnecessary in all files. However, the inconsistency could confuse contributors.

**Suggested Fix:**
Either remove `import { h }` from the older components or add it to the newer ones for consistency. Removing is preferred since the automatic transform handles it.

**Impact:** Style consistency only — no runtime effect.

---

### [LOW] L-002 — `handleTileSelect` is a console.log stub

**File:** `frontend/src/dealer/DealerApp.jsx`
**Line(s):** 23–26
**Category:** correctness

**Problem:**
`handleTileSelect` logs to console but does not update any state or trigger navigation. This is an expected placeholder for T-009 (camera capture) and T-008 (state reducer), so it is not a bug — but it means the tile tap has no user-visible effect beyond the console, which could confuse manual testers.

**Code:**
```jsx
function handleTileSelect(name) {
  // Placeholder — later tasks will wire camera capture
  console.log('Tile selected:', name);
}
```

**Suggested Fix:**
No action required now. T-008 and T-009 will replace this stub. The comment clearly documents the intent.

**Impact:** None — expected placeholder per task dependency chain.

---

## Positives

- **Clean component structure** — `PlayerGrid` is a pure presentational component with no internal state, making it easy to test and compose. Props are well-defined: `players`, `communityRecorded`, `onTileSelect`.
- **Consistent styling approach** — Inline style objects match the pattern established by `GameCreateForm` and `HandDashboard`. The `styles` const at module scope is clean and scannable.
- **Correct state derivation in DealerApp** — The `gridPlayers` derived array cleanly maps player names to `{ name, recorded }` objects, and `communityRecorded` is properly keyed to `'community'`. The `recorded` state is reset on each new hand via `handleStartHand`.
- **Mobile-first design** — `minHeight: 80px`, 2-column grid with `gap`, `WebkitTapHighlightColor: 'transparent'`, and generous padding all demonstrate mobile awareness.
- **Table tile rendered first** — Matches the spec requirement (S-4.1 AC4: "displayed above or before the player icons").

---

## Overall Assessment

All four acceptance criteria for T-007 are **SATISFIED**. The implementation is clean, minimal, and follows existing codebase conventions. No CRITICAL or HIGH findings. The two MEDIUM findings (missing `type="button"` and missing ARIA attributes) are defensive improvements that should be addressed before the dealer interface ships to production but do not block subsequent tasks. The two LOW findings are informational — one is a style inconsistency and the other is an expected placeholder.

**Verdict:** PASS — ready for next task in the dependency chain (T-008, T-009).
