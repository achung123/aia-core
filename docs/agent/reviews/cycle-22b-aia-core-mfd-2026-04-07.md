# Code Review — Cycle 22b · aia-core-mfd · 2026-04-07

**Reviewer:** Scott
**Target:** `frontend/src/views/playbackView.js` — focused re-review of the `activeScrubber` dispose fix
**Scope:** Verify five checklist items; flag any new CRITICAL or HIGH issues
**Companion file reviewed:** `frontend/src/components/sessionScrubber.js`

---

## Checklist Verification

| # | Item | Result |
|---|---|--------|
| 1 | `let activeScrubber = null` declared in outer scope | ✅ PASS |
| 2 | `activeScrubber.dispose()` called before `createSessionScrubber` | ✅ PASS |
| 3 | `scrubberContainer.innerHTML = ''` called to clear DOM | ✅ PASS |
| 4 | Zero-hands guard present (`if (!hands.length) return`) | ✅ PASS (with caveat — see H-01) |
| 5 | New CRITICAL or HIGH issues | ❌ ONE NEW HIGH — see H-01 |

---

## Finding Detail

### [HIGH] H-01 — Zero-hands guard fires before dispose; stale scrubber leaks on empty sessions

**File:** `frontend/src/views/playbackView.js`
**Lines:** 54–62

```js
// Current order:
if (!hands.length) return;          // L54 — early exit fires FIRST

if (activeScrubber) {               // L56 — never reached when hands === 0
  activeScrubber.dispose();
  activeScrubber = null;
}
const scrubberContainer = container.querySelector('#scrubber-container');
scrubberContainer.innerHTML = '';
activeScrubber = createSessionScrubber(…);
```

**Impact:** If the user loads a non-empty session (scrubber A is created), then loads a second session that has zero hands, the function returns at line 54. `activeScrubber.dispose()` is never called, so:

1. `scrubberA`'s DOM wrapper (`<div class="session-scrubber">`) remains visible in `#scrubber-container`, showing the previous session's hand count and range state.
2. `activeScrubber` still references `scrubberA`; a third session load will correctly dispose it, but only then — so the leak persists for the entire zero-hand-session view.
3. `scrubberA`'s three event listeners (`input`, `click` × 2) remain active on orphaned DOM nodes.

This is a visible UI regression introduced by ordering the guard above the dispose block.

**Suggested fix:** Move the dispose + DOM-clear block **above** the zero-hands guard:

```js
// Dispose previous scrubber unconditionally, regardless of new hand count
if (activeScrubber) {
  activeScrubber.dispose();
  activeScrubber = null;
}
const scrubberContainer = container.querySelector('#scrubber-container');
scrubberContainer.innerHTML = '';

if (!hands.length) return;           // guard is now safe — cleanup already done

activeScrubber = createSessionScrubber(scrubberContainer, hands.length, …);
```

---

### [MEDIUM] M-01 — `scrubberContainer.innerHTML = ''` is redundant after `dispose()`

**File:** `frontend/src/views/playbackView.js` L61
**Context:** `dispose()` in `sessionScrubber.js` L82 is implemented as `wrapper.remove()`, which immediately detaches the wrapper element from the DOM.  Calling `innerHTML = ''` immediately after is harmless but unnecessary noise; it would only be needed if `dispose()` did not remove the DOM node.
**Recommendation:** Either document why the belt-and-suspenders clear is kept (e.g., "guards against future scrubber implementations that skip DOM removal"), or remove the line and rely solely on `dispose()`.  Not a blocking concern.

---

## Summary Table

| Severity | Count | IDs |
|---|---|---|
| CRITICAL | 0 | — |
| HIGH | 1 | H-01 |
| MEDIUM | 1 | M-01 |
| LOW | 0 | — |

---

## Commit Guidance

Zero CRITICAL findings; one HIGH finding that must be addressed before this fix is considered complete.
**Do not commit as-is.** Resolve H-01 (reorder the guard below the dispose block), rerun tests, then re-review.

---

FINDINGS SUMMARY: C:0 H:1 M:1 L:0
