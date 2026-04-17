# Code Review Report — frontend-react-ts-006

**Date:** 2026-04-12
**Target:** `frontend/src/views/PlaybackView.tsx`, `frontend/src/views/MobilePlaybackView.tsx` + tests
**Reviewer:** Scott (automated)
**Cycle:** 21

**Task:** T-020 — Convert playbackView + MobilePlaybackView to TSX
**Beads ID:** aia-core-m77b

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
| 1 | Both files are `.tsx` with typed props/state | SATISFIED | `PlaybackView.tsx` L1-137: typed state via `useState<T>`, refs via `useRef<T>`; `MobilePlaybackView.tsx` L1-170: same pattern | All state variables explicitly typed; interfaces `ParsedCard`, `CardData`, `PlayerHandData` defined in both files |
| 2 | Three.js scene created in `useEffect` and disposed in cleanup | SATISFIED | `PlaybackView.tsx` L149-224: `useEffect(()=>{…; return ()=>{…pokerScene.dispose()…}}, [])`, `MobilePlaybackView.tsx` L197-233: same pattern with `cancelled` guard | Both use `cancelled` flag to prevent post-unmount state updates; cleanup removes event listeners and disposes scene |
| 3 | Canvas element accessed via `useRef<HTMLCanvasElement>` | SATISFIED | `PlaybackView.tsx` L130: `useRef<HTMLCanvasElement>(null)`, `MobilePlaybackView.tsx` L165: same | Correct generic type argument |
| 4 | Scrubber integration uses typed API client | SATISFIED | `PlaybackView.tsx` L3: `import { fetchSessions, fetchHands } from '../api/client.ts'`; L4: `import type { GameSessionListItem, HandResponse } from '../api/types.ts'`; `MobilePlaybackView.tsx` L3-4: identical typed imports | `SessionScrubber` and `StreetScrubber` are imported as TSX components with typed props |

---

## Findings

### [MEDIUM] Duplicated card-parsing helpers across both views

**File:** `frontend/src/views/PlaybackView.tsx`, `frontend/src/views/MobilePlaybackView.tsx`
**Line(s):** PlaybackView L19-80, MobilePlaybackView L15-80
**Category:** design

**Problem:**
`SUIT_SYMBOL`, `parseCard()`, `RESULT_MAP`, `handToCardData()`, `communityForStreet()`, `STREET_INDEX`, and the interfaces `ParsedCard`, `CardData`, `PlayerHandData` are duplicated verbatim between the two files (~65 lines each). This increases maintenance surface — a bug fix in one file could easily be missed in the other.

**Suggested Fix:**
Extract shared helpers and interfaces into a `utils/cardHelpers.ts` module and import from both views. This is a natural follow-up task, not blocking for T-020.

**Impact:** Maintenance risk; no functional issue.

---

### [MEDIUM] MobilePlaybackView duplicates `EquityRow` inline instead of using shared `EquityOverlay`

**File:** `frontend/src/views/MobilePlaybackView.tsx`
**Line(s):** L86-148
**Category:** design

**Problem:**
`PlaybackView` imports the shared `EquityOverlay` component from `../components/EquityOverlay.tsx`. `MobilePlaybackView` defines its own inline `EquityRow` component with separate styling. While the mobile layout likely warrants a different presentation (row vs. positioned overlay), the component is ~60 lines of duplicated equity display logic with its own `equityColor()` function.

**Suggested Fix:**
Consider extracting the equity color logic into a shared utility. The inline component itself may be fine for mobile-specific layout, but flag for T-022 or cleanup pass.

**Impact:** Moderate duplication; separate styling may be intentional for mobile UX.

---

### [LOW] `@typescript-eslint/no-explicit-any` suppressions for Three.js scene refs

**File:** `frontend/src/views/PlaybackView.tsx`, `frontend/src/views/MobilePlaybackView.tsx`
**Line(s):** PlaybackView L132, L189, L196; MobilePlaybackView L168, L207, L247
**Category:** convention

**Problem:**
Both files suppress `@typescript-eslint/no-explicit-any` for the scene ref and Three.js position objects. This is expected since the spec notes T-023/T-024 will type the Three.js scene modules.

**Suggested Fix:**
No action needed now — T-023/T-024 covers typing scene modules. The `// @ts-ignore` comments on JS imports are correctly annotated with "will be typed in T-023/T-024".

**Impact:** None — tracked by future tasks.

---

### [LOW] `void playerNames` statement to suppress unused-variable warning

**File:** `frontend/src/views/PlaybackView.tsx`
**Line(s):** L380
**Category:** convention

**Problem:**
`void playerNames;` is used to suppress the unused-variable linter warning. The variable is used imperatively in `loadSessionById` but not in JSX render. The `void` trick works but is unconventional.

**Suggested Fix:**
An alternative is a `// eslint-disable-next-line @typescript-eslint/no-unused-vars` on the destructuring, or restructuring so `playerNames` is only in the callback scope. Minor style issue — not blocking.

**Impact:** Cosmetic only.

---

## Positives

- **Three.js lifecycle is correct in both views.** Scene creation uses a `cancelled` flag to guard against race conditions during unmount. Cleanup functions properly remove event listeners, DOM labels, and call `dispose()` on the scene. This is the most important concern for this task and it's handled well.
- **Canvas refs are properly typed.** `useRef<HTMLCanvasElement>(null)` with null-checks before use — no forced non-null assertions on refs.
- **Tests are comprehensive.** 29 tests across both files covering: loading states, error states, session selection, hand/street navigation, equity computation, drawer toggle (mobile), back button (mobile), and scrubber rendering. All pass.
- **Typed API client integration.** Both views import from the typed `client.ts` and `types.ts` — no raw `fetch` calls or untyped responses.
- **Old `.js`/`.jsx` files removed.** No leftover originals in the views directory.
- **TSX component imports.** `PlaybackView` imports `SessionScrubber`, `StreetScrubber`, and `EquityOverlay` as TSX; `MobilePlaybackView` imports `SessionScrubber` and `StreetScrubber` as TSX.

---

## Overall Assessment

**CLEAN** — zero CRITICAL or HIGH findings. All four acceptance criteria are satisfied. The conversion is faithful to the original behavior with proper Three.js lifecycle management, typed state/refs, and typed API client usage. The two MEDIUM findings (code duplication) are design-level observations suitable for a follow-up cleanup task, not blockers for T-020. Tests are thorough and all 29 pass.
