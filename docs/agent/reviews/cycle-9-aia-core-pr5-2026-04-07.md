# Code Review Report — dealer-interface-003

**Date:** 2026-04-07
**Cycle:** 9
**Target:** `frontend/src/dealer/CameraCapture.jsx`
**Reviewer:** Scott (automated)

**Task:** T-009 (discovered-from) — CameraCapture overlay trap on Android when file picker dismissed without selection
**Beads ID:** aia-core-pr5
**Epic:** aia-core-8w0 (Dealer Interface — Phase 3)

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

The bug report (aia-core-pr5) states:

> Empty overlay with no dismiss mechanism when file picker change event does not fire on Android WebViews. Fix: add a fallback Cancel button or "Waiting for camera" card in the !loading && !error state.

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | Overlay must not trap the dealer when the file picker is dismissed without selection | SATISFIED | `CameraCapture.jsx` L56–61: visible card with Cancel button rendered in `!loading && !error` state | Cancel button calls `onCancel` which sets `captureTarget=null` in DealerApp, unmounting the overlay |
| 2 | Cancel button must properly dismiss the overlay | SATISFIED | `CameraCapture.jsx` L59: `onClick={onCancel}`; `DealerApp.jsx` L34–36: `handleCaptureCancel` sets `captureTarget(null)`, removing the `<CameraCapture>` from the tree | No stale state left behind |
| 3 | Normal flow (file selection → upload → detection) must not regress | SATISFIED | `handleFileChange` (L20–37) is unchanged; `loading` state hides the cancel card and shows spinner; build passes | The `!loading && !error` guard ensures the cancel card disappears once upload begins |

---

## Findings

### [MEDIUM] Cancel button remains briefly visible after file is selected but before `setLoading(true)`

**File:** `frontend/src/dealer/CameraCapture.jsx`
**Line(s):** 20–27
**Category:** correctness

**Problem:**
There is a micro-window between `handleFileChange` being called and `setLoading(true)` executing (line 27) where the "Waiting for camera…" card with the Cancel button is still visible. If the user taps Cancel in this instant, `onCancel()` fires while the upload is about to begin, potentially causing a state mismatch where DealerApp unmounts CameraCapture mid-upload.

In practice this window is sub-millisecond (synchronous JS between the `if (!file)` check and `setLoading(true)`), so exploitation is extremely unlikely. However, the theoretical race exists.

**Code:**
```jsx
async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) {
      onCancel();
      return;
    }
    // Cancel button still visible here until next line executes
    setLoading(true);
    setError(null);
    ...
}
```

**Suggested Fix:**
Move `setLoading(true)` before the async work but keep it as-is — the current ordering is already correct since `setLoading(true)` is called synchronously before any `await`. The Preact render won't flush between these synchronous lines. No action needed; noting for awareness only.

**Impact:** Negligible in practice. Preact batches state updates within the same synchronous handler, so the Cancel card is never actually rendered between the file check and `setLoading(true)`.

---

### [LOW] "Waiting for camera…" text uses Unicode ellipsis character

**File:** `frontend/src/dealer/CameraCapture.jsx`
**Line(s):** 58
**Category:** convention

**Problem:**
The string `"Waiting for camera…"` uses a Unicode ellipsis (U+2026) rather than three ASCII periods. This is fine and arguably better typography, but if other strings in the codebase use `...`, this is inconsistent.

**Code:**
```jsx
<p style={styles.text}>Waiting for camera…</p>
```

**Suggested Fix:**
Pick one convention and apply consistently. The Unicode ellipsis is the typographically correct choice — no change needed unless the project standardizes on ASCII `...`.

**Impact:** Cosmetic only.

---

## Positives

- **Clean fix for a real Android bug.** The `!loading && !error` guard is the correct slot for the initial state UI. The fix is minimal and well-targeted.
- **Cancel button correctly wired.** `onCancel` is passed as a prop and called directly — no wrapper indirection, no stale closures. `DealerApp.handleCaptureCancel` nulls `captureTarget`, which unmounts the entire `<CameraCapture>` component cleanly.
- **Three-state UI is comprehensive.** Initial (waiting) → loading (spinner) → error (retry + cancel) covers all user-visible states. No state can render an empty overlay.
- **Inline styles are consistent** with the rest of the dealer components (no CSS module mismatch).
- **`handleFileChange` properly handles no-file case** (line 22–24) by calling `onCancel()`, which is the correct behavior when the browser fires the change event with an empty file list.
- **Build passes** — `vite build` succeeds with no errors.

---

## Overall Assessment

The fix is **correct and sufficient** for the reported bug. When the Android WebView file picker is dismissed without selection and the `change` event doesn't fire, the dealer now sees a visible "Waiting for camera…" card with a Cancel button instead of an empty trapped overlay. The Cancel button properly dismounts the component via `onCancel → setCaptureTarget(null)`.

No CRITICAL or HIGH findings. The two findings are informational: one theoretical micro-race that Preact's synchronous batching already prevents, and one minor typographic convention note.

**Verdict:** Fix is production-ready. No blockers.
