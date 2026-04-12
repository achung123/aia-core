# Code Review Report — alpha-feedback-008

**Date:** 2026-04-12
**Cycle:** 27
**Target:** `frontend/src/dealer/CameraCapture.tsx`, `frontend/src/dealer/CameraCapture.test.tsx`, `frontend/src/player/PlayerApp.test.tsx`
**Reviewer:** Scott (automated)

**Task:** T-052 — Image local preview in camera capture flow
**Beads ID:** aia-core-xvs2

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 0 |
| LOW | 3 |
| **Total Findings** | **3** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | After capturing, preview screen shows photo with Use Photo and Retake buttons | SATISFIED | `CameraCapture.tsx` L105-123; test: "shows preview with Use Photo and Retake buttons after capture" | Phase-gated rendering works correctly |
| 2 | Preview renders from local blob/data-URL — no backend call | SATISFIED | `CameraCapture.tsx` L49 (`URL.createObjectURL`); test: "renders preview from local blob URL without backend call" | Asserts `src` starts with `blob:` and `uploadImage` not called |
| 3 | Use Photo sends image to backend for OCR; Retake discards and re-opens camera | SATISFIED | `CameraCapture.tsx` L63-75 (Use Photo), L78-84 (Retake); tests: "Use Photo sends image to backend for OCR", "Retake discards preview and re-opens camera" | Both paths tested end-to-end |
| 4 | Preview shows resolution and file size info | SATISFIED | `CameraCapture.tsx` L57-60, L117-120; tests: "shows file size info in preview", "shows resolution info after image loads" | Resolution set via `onLoad` / `naturalWidth×naturalHeight` |
| 5 | Mobile-first: large thumb-accessible buttons at bottom | SATISFIED | `CameraCapture.tsx` styles — `minHeight: '48px'`, `minWidth: '48px'`; test: "buttons have minimum 48px touch target" | Meets WCAG 2.5.8 target size |
| 6 | React Testing Library test verifies preview and button flows | SATISFIED | 13 tests in `CameraCapture.test.tsx`, 7 in `image preview` describe block | Full coverage of idle → preview → upload/retake flows |

**All 6 ACs: SATISFIED**

---

## Findings

### [LOW] `handleRetry` does not clear stale `capturedFile` / `previewUrl` state

**File:** `frontend/src/dealer/CameraCapture.tsx`
**Line(s):** 86-90
**Category:** design

**Problem:**
`handleRetry` transitions from `error` → `idle` and opens the file picker, but does not reset `capturedFile` or `previewUrl`. The old blob URL and File object linger in state. There is no functional bug because (a) the `phase === 'idle'` guard prevents stale data from rendering, and (b) the `useEffect` cleanup revokes the old blob URL when a new one is set. However, leaving stale references in state is inconsistent with `handleRetake`, which explicitly clears them.

**Code:**
```tsx
function handleRetry(): void {
    setError(null);
    setPhase('idle');
    triggerInput();
}
```

**Suggested Fix:**
Mirror `handleRetake` by revoking and clearing before transitioning:
```tsx
function handleRetry(): void {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setCapturedFile(null);
    setPreviewUrl(null);
    setError(null);
    setPhase('idle');
    triggerInput();
}
```

**Impact:** Cosmetic. No memory leak or user-visible bug due to existing `useEffect` cleanup.

---

### [LOW] No test for the retry → new capture flow

**File:** `frontend/src/dealer/CameraCapture.test.tsx`
**Line(s):** (missing)
**Category:** correctness (test gap)

**Problem:**
The error-state test verifies the Retry button appears, but no test clicks Retry and asserts the component returns to idle and the file picker re-opens. The `handleRetry` path is untested.

**Suggested Fix:**
Add a test:
```tsx
it('Retry returns to idle and re-opens file picker', async () => {
    mockUploadImage.mockRejectedValue(new Error('fail'));
    render(<CameraCapture {...defaultProps} />);
    // select file → preview → Use Photo → error
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['x'], 'p.jpg', { type: 'image/jpeg' })] } });
    await waitFor(() => expect(screen.getByText('Use Photo')).toBeDefined());
    fireEvent.click(screen.getByText('Use Photo'));
    await waitFor(() => expect(screen.getByText('Retry')).toBeDefined());
    fireEvent.click(screen.getByText('Retry'));
    await waitFor(() => expect(screen.getByText('Open Camera')).toBeDefined());
});
```

**Impact:** Minor coverage gap. The production code path is simple enough to be low-risk.

---

### [LOW] Blob URL cleanup (`revokeObjectURL`) is not asserted in any test

**File:** `frontend/src/dealer/CameraCapture.test.tsx`
**Line(s):** 170-186 (resolution test stubs URL but doesn't assert revoke)
**Category:** correctness (test gap)

**Problem:**
The resolution test at line 170 stubs `URL.createObjectURL` and `URL.revokeObjectURL`, but never asserts `revokeObjectURL` was called — on unmount, on retake, or on re-selection. The production code correctly revokes in three places (useEffect cleanup, `handleRetake`, `handleRetry` would need it per finding #1), but none of these revocations are verified by tests.

**Suggested Fix:**
In the resolution test (or a dedicated cleanup test), assert after unmount:
```tsx
cleanup(); // unmount
expect(revokeObjectURL).toHaveBeenCalledWith(blobUrl);
```

**Impact:** Low risk. The production implementation is correct; this is a test-depth gap.

---

## Positives

- **Clean phase machine** — The `Phase` type (`idle | preview | uploading | error`) with phase-gated JSX is easy to follow and prevents impossible states from rendering.
- **Correct blob URL lifecycle** — `useEffect` cleanup with `[previewUrl]` dependency handles unmount and URL change; `handleRetake` explicitly revokes before clearing. Double-revoke is harmless.
- **No backend call during preview** — `uploadImage` is only called in `handleUsePhoto`, confirmed by the "renders preview from local blob URL without backend call" test.
- **Thorough test coverage** — 13 tests covering all user-facing flows: idle, preview, upload success, error, retake, file size, resolution, touch targets. The `image preview` describe block maps 1:1 to the new ACs.
- **Integration coverage** — `PlayerApp.test.tsx` includes the full camera capture → preview → Use Photo → detection review → confirm flow at lines 659-711, validating end-to-end integration with the new preview step.
- **Mobile-first accessibility** — 48×48px minimum touch targets on all interactive buttons.
- **`formatFileSize` utility** — Clean, SI-unit formatting extracted as a pure function.

---

## Overall Assessment

The implementation is clean and all 6 acceptance criteria are fully satisfied. Blob URL cleanup is correctly handled via `useEffect` + explicit revocation in `handleRetake`. The three LOW findings are minor hygiene/coverage gaps — no functional bugs, no security issues, no memory leaks. The code follows existing project patterns and the test suite is thorough.

**Verdict: PASS — no critical issues.**
