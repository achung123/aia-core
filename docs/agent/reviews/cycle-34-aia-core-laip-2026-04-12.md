# Code Review Report — alpha-feedback-008

**Date:** 2026-04-12
**Cycle:** 34
**Target:** `frontend/src/dealer/QRCodeDisplay.tsx`, `frontend/src/dealer/QRCodeDisplay.test.tsx`, `frontend/src/dealer/HandDashboard.tsx`, `frontend/src/dealer/HandDashboard.test.tsx`
**Reviewer:** Scott (automated)

**Task:** T-027 — QR code simplification
**Beads ID:** aia-core-laip

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 0 |
| LOW | 4 |
| **Total Findings** | **4** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | QR encodes `<host>/player?game=<gameId>` | SATISFIED | `QRCodeDisplay.tsx` L15: `` `${window.location.origin}/player?game=${gameId}` ``; test `calls QRCode.toDataURL with the correct game URL` | `gameId` is typed `number` — no injection risk |
| 2 | Displayed prominently on Game Dashboard | SATISFIED | `HandDashboard.tsx` L138–145: QR toggle + `QRCodeDisplay` rendered inline in main dashboard | Single prominent placement, centered with label |
| 3 | Show/Hide QR toggle | SATISFIED | `HandDashboard.tsx` L49 (`showQR` state), L138–145 (toggle button); tests `QR code is hidden by default`, `toggle button shows/hides QR code` | Toggle label switches between "Show QR" / "Hide QR" |
| 4 | QR updates if active game changes | SATISFIED | `QRCodeDisplay.tsx` L17: `[gameId, visible]` in `useEffect` deps; test `updates QR code when gameId changes` | Re-renders with new gameId → new QR generated |
| 5 | Existing QRCodeDisplay component reused or simplified | SATISFIED | `QRCodeDisplay.tsx` props reduced to `{ gameId, visible }`; no `playerName` prop; `HandDashboard.tsx` L145 passes only `gameId` | Clean interface; single consumer confirmed via grep |

---

## Findings

### [LOW] Redundant `visible` prop

**File:** `frontend/src/dealer/HandDashboard.tsx`
**Line(s):** 143–145
**Category:** design

**Problem:**
`HandDashboard` conditionally renders `QRCodeDisplay` only when `showQR` is true (L143: `{showQR && ...}`), yet also passes `visible={true}`. The `visible` prop is always `true` at the call site, making it a dead parameter. Inside `QRCodeDisplay`, the `visible` prop gates both the effect and the early return — but the component is never mounted with `visible={false}` in the current codebase.

**Code:**
```tsx
{showQR && (
  <QRCodeDisplay gameId={gameId} visible={true} />
)}
```

**Suggested Fix:**
Remove the `visible` prop from `QRCodeDisplayProps` and the internal guards; rely solely on the parent's conditional render. Alternatively, if the prop is kept for API flexibility, document its purpose.

**Impact:** Minor dead code; no functional issue.

---

### [LOW] Duplicate URL construction

**File:** `frontend/src/dealer/QRCodeDisplay.tsx`
**Line(s):** 15, 20
**Category:** convention

**Problem:**
The player URL string is computed twice — once inside the `useEffect` (L15) for QR code generation and once in the render body (L20) for the text label. These are identical expressions.

**Code:**
```tsx
// Inside useEffect (L15)
const url = `${window.location.origin}/player?game=${gameId}`;
// In render body (L20)
const playerUrl = `${window.location.origin}/player?game=${gameId}`;
```

**Suggested Fix:**
Compute the URL once above the effect (or via `useMemo`) and reference it in both places.

**Impact:** No functional issue; minor DRY violation.

---

### [LOW] Unhandled promise rejection on QR generation

**File:** `frontend/src/dealer/QRCodeDisplay.tsx`
**Line(s):** 16
**Category:** correctness

**Problem:**
`QRCode.toDataURL()` returns a promise that is `.then()`'d but has no `.catch()`. If the library throws (e.g., invalid input), the rejection is unhandled and will surface as a console warning. Since `gameId` is a number this is extremely unlikely, but the pattern is incomplete.

**Code:**
```tsx
QRCode.toDataURL(url, { width: 200, margin: 2 }).then(setDataUrl);
```

**Suggested Fix:**
Add `.catch(() => setDataUrl(null))` or use `async/await` with try/catch inside the effect.

**Impact:** Theoretical unhandled promise rejection; near-zero real-world risk with numeric gameId.

---

### [LOW] Missing useEffect cleanup for async state update

**File:** `frontend/src/dealer/QRCodeDisplay.tsx`
**Line(s):** 13–17
**Category:** correctness

**Problem:**
The `useEffect` fires an async `toDataURL` call and calls `setDataUrl` in the `.then()`. If the component unmounts or the deps change before the promise resolves, `setDataUrl` is called on a stale closure. React 18+ tolerates this (no-ops on unmounted state), but it's a known anti-pattern.

**Code:**
```tsx
useEffect(() => {
  if (!visible) return;
  const url = `${window.location.origin}/player?game=${gameId}`;
  QRCode.toDataURL(url, { width: 200, margin: 2 }).then(setDataUrl);
}, [gameId, visible]);
```

**Suggested Fix:**
Add a cleanup flag:
```tsx
useEffect(() => {
  if (!visible) return;
  let cancelled = false;
  const url = `${window.location.origin}/player?game=${gameId}`;
  QRCode.toDataURL(url, { width: 200, margin: 2 }).then((data) => {
    if (!cancelled) setDataUrl(data);
  });
  return () => { cancelled = true; };
}, [gameId, visible]);
```

**Impact:** No observable bug today; defensive improvement for race conditions on rapid re-renders.

---

## Positives

- **URL construction is secure**: `gameId` is typed as `number`, eliminating injection via query parameter manipulation. `window.location.origin` is the correct base for same-origin URLs.
- **Clean prop interface**: The component takes only `gameId` and `visible` — no `playerName`, no hash-based routing artifacts. The test at L55 explicitly asserts the URL does *not* contain `/#/`, acting as a regression guard.
- **Thorough test coverage**: `QRCodeDisplay.test.tsx` covers visibility gating, URL correctness, image rendering, URL label display, and re-render on gameId change. `HandDashboard.test.tsx` covers QR hidden-by-default, toggle show/hide, and toggle always-visible — all three QR-related ACs are directly tested.
- **Good mock isolation**: `HandDashboard.test.tsx` mocks `QRCodeDisplay` to a stub, keeping integration tests focused on dashboard behavior. `QRCodeDisplay.test.tsx` mocks only the `qrcode` library.
- **Conditional rendering over CSS hiding**: Using `{showQR && <QRCodeDisplay ... />}` avoids rendering unnecessary DOM and avoids triggering the QR generation effect when hidden.

---

## Overall Assessment

All 5 acceptance criteria are **SATISFIED**. The implementation is clean, secure, and well-tested. The 4 LOW findings are minor hygiene items — no functional bugs, no security issues, no design concerns. The `visible` prop redundancy is the most actionable cleanup but is purely cosmetic.

**Verdict:** PASS — no critical or high findings.
