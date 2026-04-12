# Code Review Report — dealer-interface-003

**Date:** 2026-04-07
**Cycle:** 8
**Target:** Wire native camera capture for player cards
**Reviewer:** Scott (automated)

**Task:** T-009 — Wire native camera capture for player cards
**Beads ID:** aia-core-z6c

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 1 |
| MEDIUM | 2 |
| LOW | 2 |
| **Total Findings** | **5** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | Tapping a player tile opens the native camera/file picker | SATISFIED | `PlayerGrid.onTileSelect` → `DealerApp.handleTileSelect` sets `captureTarget` → renders `CameraCapture` → `useEffect` calls `inputRef.current.click()` with `capture="environment"` | Correct pattern for mobile camera trigger |
| 2 | The selected image is uploaded to the backend | SATISFIED | `CameraCapture.handleFileChange` reads `e.target.files[0]`, calls `uploadImage(gameId, file)` which POSTs FormData to `/games/{gameId}/hands/image` | FormData construction in `client.js:101-113` is correct |
| 3 | Detection results are retrieved after upload | SATISFIED | After `uploadImage` resolves, `getDetectionResults(gameId, upload.id)` fetches from `/games/{gameId}/hands/image/{uploadId}` and passes result to `onDetectionResult` | Sequential two-step flow is correct |
| 4 | A loading indicator is shown during upload + detection | SATISFIED | `setLoading(true)` before the try block; spinner rendered when `loading && !error`; CSS `@keyframes spin` defined in `style.css:305` | Spinner animation works via global keyframe reference in inline style |
| 5 | On failure, an error message is shown and the dealer can retry | SATISFIED | Catch block sets `error` state and `setLoading(false)`; error UI shows message text, Retry button (re-triggers file input), and Cancel button (calls `onCancel`) | Error text auto-escaped by JSX — no XSS risk |

---

## Findings

### [HIGH] Empty overlay with no dismiss mechanism when file picker change event is not fired

**File:** `frontend/src/dealer/CameraCapture.jsx`
**Line(s):** 17–19, 44–73
**Category:** correctness

**Problem:**
The component auto-triggers the file picker on mount via `useEffect → triggerInput()`. If the browser does not fire a `change` event when the user dismisses the file picker without selecting a file (documented behavior on some Android WebViews and older browsers), the component remains in its initial state (`loading=false`, `error=null`). In this state, the overlay renders a semi-transparent backdrop with **no visible controls** — no spinner, no error message, no cancel button. The user is trapped with no way to dismiss the overlay.

**Code:**
```jsx
return (
  <div style={styles.overlay}>
    <input ref={inputRef} ... />
    {loading && !error && ( /* spinner — not shown */ )}
    {error && ( /* error UI — not shown */ )}
  </div>
);
```

**Suggested Fix:**
Add a visible Cancel button in the default state (when `!loading && !error`), or add an `onClick` handler on the overlay backdrop that calls `onCancel()`. Example:

```jsx
{!loading && !error && (
  <div style={styles.card}>
    <p style={styles.text}>Waiting for camera…</p>
    <button style={styles.cancelButton} onClick={onCancel}>Cancel</button>
  </div>
)}
```

**Impact:** On the primary mobile platform, a dealer could become stuck in an unresponsive overlay, requiring a page reload to recover.

---

### [MEDIUM] No AbortController for in-flight requests on component unmount

**File:** `frontend/src/dealer/CameraCapture.jsx`
**Line(s):** 29–36
**Category:** correctness

**Problem:**
If the CameraCapture component unmounts (e.g., the parent navigates away) while `uploadImage` or `getDetectionResults` is in flight, the pending promises will resolve and attempt to call `onDetectionResult` or `setError`/`setLoading` on an unmounted component. While Preact's `setState` on unmounted components is a no-op, calling the parent's `onDetectionResult` callback could trigger state updates in a context that no longer expects them.

**Code:**
```jsx
async function handleFileChange(e) {
  // ...
  try {
    const upload = await uploadImage(gameId, file);
    const detections = await getDetectionResults(gameId, upload.id);
    onDetectionResult(targetName, detections);
  } catch (err) {
    setError(err.message || 'Upload failed');
    setLoading(false);
  }
}
```

**Suggested Fix:**
Create an `AbortController` in the `useEffect` and pass its signal to the fetch calls. Return a cleanup function that calls `controller.abort()`.

**Impact:** Low probability in practice (component only unmounts on cancel or success), but could cause unexpected state updates in edge cases.

---

### [MEDIUM] No client-side file size validation before upload

**File:** `frontend/src/dealer/CameraCapture.jsx`
**Line(s):** 23–25
**Category:** design

**Problem:**
Modern phone cameras produce images of 5–15 MB or more. On mobile data connections, uploading a large image without warning could take a long time and consume significant bandwidth. There is no client-side check on `file.size` before initiating the upload.

**Code:**
```jsx
const file = e.target.files?.[0];
if (!file) {
  onCancel();
  return;
}
setLoading(true);
```

**Suggested Fix:**
Add a size check (e.g., 20 MB limit) before upload, showing a user-friendly warning:

```jsx
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
if (file.size > MAX_FILE_SIZE) {
  setError('Image is too large. Please try again with a smaller image.');
  return;
}
```

**Impact:** Poor UX on slow connections; no data loss risk since the backend would likely reject oversized uploads eventually.

---

### [LOW] console.log left in production code path

**File:** `frontend/src/dealer/DealerApp.jsx`
**Line(s):** 29
**Category:** convention

**Problem:**
A `console.log` statement logs detection results to the browser console. While marked with a `TODO (T-011)` comment, debug logging should not ship to production.

**Code:**
```jsx
console.log('Detection result for', targetName, detections);
```

**Suggested Fix:**
Remove the `console.log` or gate it behind `import.meta.env.DEV`.

**Impact:** Minor — leaks detection data to the browser console; no functional issue.

---

### [LOW] Detection results are not persisted to reducer state

**File:** `frontend/src/dealer/DealerApp.jsx`
**Line(s):** 27–30
**Category:** design

**Problem:**
`handleDetectionResult` receives `targetName` and `detections` but only logs them. The reducer's `SET_STEP` action transitions to `'review'` without storing the detection data. The review step will have no detection data to render.

**Code:**
```jsx
function handleDetectionResult(targetName, detections) {
  setCaptureTarget(null);
  dispatch({ type: 'SET_STEP', payload: 'review' });
  // TODO (T-011): pass targetName + detections to DetectionReview
  console.log('Detection result for', targetName, detections);
}
```

**Suggested Fix:**
This is acknowledged as deferred to T-011 (Detection Review step). No action needed now, but the review step will be non-functional until T-011 is implemented.

**Impact:** Expected — the review step is a placeholder until the next task wires it up.

---

## Positives

- **Clean component decomposition**: `CameraCapture` is a focused, single-responsibility component with clear props (`gameId`, `targetName`, `onDetectionResult`, `onCancel`)
- **Correct camera integration pattern**: Hidden file input with `accept="image/*"` and `capture="environment"` is the standard approach for mobile camera access; auto-trigger on mount is idiomatic
- **Proper error handling in the API layer**: Both `uploadImage` and `getDetectionResults` parse error bodies and throw meaningful `Error` objects with HTTP status and detail information
- **XSS-safe error rendering**: Error messages are rendered via JSX interpolation (`{error}`), which auto-escapes HTML — no `dangerouslySetInnerHTML` usage
- **Ephemeral state correctly separated**: `captureTarget` is held in `useState` rather than the reducer, which is appropriate for transient UI state that doesn't need to participate in hand lifecycle management
- **Retry mechanism is well-implemented**: Retry clears the error state and re-triggers the file input, providing a clean recovery path

---

## Overall Assessment

All five acceptance criteria are **SATISFIED**. The implementation is clean, focused, and follows the existing project patterns well. The camera capture flow (tile tap → file picker → upload → detection → result callback) is correctly wired end-to-end.

The single HIGH finding (empty overlay trap when the file picker is dismissed without a `change` event) should be addressed before this ships to production — it can leave a mobile dealer stuck. The two MEDIUM findings (abort controller, file size check) are improvements worth adding but are not blockers.

No CRITICAL issues found. Zero security vulnerabilities identified — file type filtering is handled by `accept` attribute at the UX level and by backend validation at the security boundary; error display is XSS-safe.
