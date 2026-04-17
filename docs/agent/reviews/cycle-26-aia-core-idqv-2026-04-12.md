# Code Review Report — alpha-feedback-008

**Date:** 2026-04-12
**Cycle:** 26
**Target:** `frontend/src/dealer/ActiveHandDashboard.tsx`, `frontend/src/dealer/ActiveHandDashboard.test.tsx`
**Reviewer:** Scott (automated)

**Task:** T-053 — Split-screen dealer input layout
**Beads ID:** aia-core-idqv

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
| 1 | Viewport ≥ 600px: splits top=board, bottom=player tiles | SATISFIED | `isWide` via `matchMedia('(min-width: 600px)')` toggles `splitLayout`/`panelScroll` — L63–68, L88–92, L150–155. Test: "renders split layout panels with independent scroll on wide viewports" | `containerWide` sets `height: 100vh`, `flexDirection: column`; children share space with `flex: 1` |
| 2 | < 600px: stacked/scrollable single-column layout | SATISFIED | Narrow path uses `container`/`stackedLayout`/`panelStack` — no forced height or independent overflow. Test: "renders stacked layout without split scroll on narrow viewports" | Natural document scroll; maxWidth 480px |
| 3 | Both sections scroll independently if content overflows | SATISFIED | `panelScroll` has `overflowY: 'auto'`, `minHeight: 0` on both panels and parent `splitLayout` — L249–253. Test asserts `overflowY === 'auto'` on both panels | Textbook flexbox independent-scroll pattern |
| 4 | Blind info bar remains fixed/sticky at top | SATISFIED | `blindBarSticky` sets `position: 'sticky'`, `top: 0`, `zIndex: 10` — L237. Test: "blind info bar has sticky positioning" | In wide mode sticky is moot (no page scroll) but harmless; in narrow mode it keeps the bar pinned during document scroll |
| 5 | Implemented with CSS grid or flexbox | SATISFIED | All layout uses flexbox (`display: 'flex'`, `flexDirection: 'column'`, `flex: 1`). Test: "uses flexbox for the split layout container" | No grid used; flexbox throughout |
| 6 | RTL test verifies both layout modes | SATISFIED | 6 new tests in `describe('Split-screen layout')` covering wide and narrow paths, sticky bar, flexbox container, and viewport-height behavior | `mockMatchMedia` helper toggles `matches` for both modes |

---

## Findings

### [MEDIUM] `100vh` on tablet viewports may clip behind mobile browser chrome

**File:** `frontend/src/dealer/ActiveHandDashboard.tsx`
**Line(s):** 228–233 (`containerWide`)
**Category:** design

**Problem:**
`height: '100vh'` is applied when the viewport is ≥ 600px. On tablet browsers (iPad Safari, Chrome on Android tablets), `100vh` includes the area behind the browser's address bar / toolbar, causing the bottom content (player tiles, Finish Hand button) to be hidden behind browser chrome.

**Code:**
```ts
containerWide: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',       // ← includes hidden area behind browser chrome
    maxWidth: '600px',
    margin: '0 auto',
    padding: '1rem',
},
```

**Suggested Fix:**
Use `100dvh` (dynamic viewport height) which adjusts for visible viewport:
```ts
height: '100dvh',
```
Browser support for `dvh` is universal since mid-2023. Alternatively, provide a fallback:
```ts
height: '100dvh',
// fallback for older browsers handled by CSS @supports or just accept 100vh
```

**Impact:** On affected tablet browsers, the bottom ~60–80px of the player panel may be unreachable without the user scrolling the entire page or hiding the address bar. Low severity for apps running in full-screen/PWA mode.

---

### [LOW] `matchMedia` mock doesn't capture event listeners — resize transitions untestable

**File:** `frontend/src/dealer/ActiveHandDashboard.test.tsx`
**Line(s):** 273–286 (`mockMatchMedia` helper)
**Category:** design (test robustness)

**Problem:**
The `mockMatchMedia` mock returns `addEventListener: vi.fn()` which discards the handler reference. The production code registers a `change` listener (L65–68) that toggles `isWide` on viewport resize, but no test can verify that dynamic transition because the mock never fires the event.

**Code:**
```ts
addEventListener: vi.fn(),   // handler is not captured
removeEventListener: vi.fn(),
```

**Suggested Fix:**
Store the handler and expose a `trigger` helper so a future test can simulate a mid-render viewport change:
```ts
function mockMatchMedia(matches: boolean) {
  let handler: ((e: MediaQueryListEvent) => void) | null = null;
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      addEventListener: vi.fn((_: string, h: any) => { handler = h; }),
      removeEventListener: vi.fn(),
      // expose for tests:
      _trigger: (m: boolean) => handler?.({ matches: m } as MediaQueryListEvent),
    })),
  });
}
```

**Impact:** Current AC6 is still satisfied — the 6 tests verify initial render in both modes. Dynamic resize testing is a nice-to-have for future regression coverage but not required by any current AC.

---

## Positives

- **Correct flexbox overflow pattern**: `flex: 1` + `minHeight: 0` + `overflowY: auto` on both panels is the canonical approach for independent-scroll flex children — applied correctly here.
- **SSR guard in useState initializer**: `typeof window !== 'undefined'` prevents crashes if the component is ever server-rendered.
- **Clean listener cleanup**: The `useEffect` properly returns a cleanup that calls `removeEventListener`, avoiding memory leaks.
- **Comprehensive AC coverage**: All 6 acceptance criteria have direct, clearly-labeled test assertions.
- **Separation of wide/narrow style paths**: The style objects (`splitLayout`/`stackedLayout`, `panelScroll`/`panelStack`, `container`/`containerWide`) are cleanly separated, making the responsive behavior easy to follow.

---

## Overall Assessment

The split-screen layout implementation is solid. Flexbox patterns are textbook-correct, the responsive breakpoint works as specified, and all 6 acceptance criteria are satisfied with dedicated tests. The only actionable item is the `100vh` → `100dvh` swap (MEDIUM) which would improve tablet browser compatibility. Zero CRITICAL or HIGH findings.
