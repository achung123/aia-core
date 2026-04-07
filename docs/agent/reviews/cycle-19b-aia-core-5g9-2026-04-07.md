# Code Review — cycle-19b · aia-core-5g9 · 2026-04-07

**Reviewer:** Scott  
**Target:** `frontend/src/views/dataView.js` — stale-check fix for `aia-core-5g9`  
**Scope:** Spot-check post-fix correctness; full pass for new CRITICAL/HIGH regressions

---

## Primary Verification

### Stale check after `await fetchHands(...)` in `handleRowClick`

**CONFIRMED PRESENT.** Lines 82–84:

```js
const hands = await fetchHands(session.id);
loadingRow.remove();

// Stale check — bail if the user changed selection while we were fetching
if (expandedSessionId !== session.id) return;
```

The guard fires after `loadingRow.remove()`. Removing the loading row before the check is safe: by the time a competing click sets a new `expandedSessionId`, `handleRowClick` for the new session already calls `tbody.querySelector('.hand-details-row')` and removes the old loading row from the DOM. When the stale fetch finally calls `loadingRow.remove()`, the element is already detached and the call is a harmless no-op. The stale check then returns without inserting stale markup.

---

## Findings

### HIGH — H-1: `catch` block is missing a stale check

**File:** `frontend/src/views/dataView.js`  
**Lines:** 143–155  

```js
} catch (err) {
  loadingRow.remove();                          // no-op if already detached — fine

  const errorRow = document.createElement('tr');
  errorRow.className = 'hand-details-row';
  const errorTd = document.createElement('td');
  errorTd.colSpan = columns.length;
  errorTd.textContent = `Error loading hands: ${err.message}`;
  errorTd.style.color = 'red';
  errorRow.appendChild(errorTd);
  tr.insertAdjacentElement('afterend', errorRow); // ← inserts after a STALE `tr`
  expandedSessionId = null;                       // ← clobbers a DIFFERENT session's state
}
```

**Scenario that reproduces the bug:**

1. User clicks session A → `expandedSessionId = A`, fetch A begins.  
2. User clicks session B → A's loading row removed, `expandedSessionId = B`, fetch B begins.  
3. Fetch A throws → `loadingRow.remove()` no-op, then error row is inserted after **A's** `<tr>` in the DOM (A's row is still present as a session row), and `expandedSessionId` is set to `null`, silently discarding B's expanded state.  
4. If fetch B later completes successfully, B's detail row is inserted → the DOM now contains two `.hand-details-row` elements simultaneously.  
5. The next click on B queries `tbody.querySelector('.hand-details-row')`, finds the **error row under A** first, removes it, and then adds a second loading row on top of the existing detail row — visually broken.

**Fix:** Mirror the success-path stale guard:

```js
} catch (err) {
  loadingRow.remove();
  if (expandedSessionId !== session.id) return;   // ← add this
  // ... rest of error row insertion unchanged
  expandedSessionId = null;
}
```

---

### LOW — L-1: Expandable rows have no keyboard support

**File:** `frontend/src/views/dataView.js`  
**Lines:** 169–172  

```js
tr.style.cursor = 'pointer';
// ...
tr.addEventListener('click', () => handleRowClick(s, tr, tbody, columns));
```

Session rows are clickable but lack `tabindex="0"`, `role="button"`, and a `keydown` handler for Enter/Space. Keyboard-only users and screen-reader users cannot expand session details. Low priority for an analytics tool, but worth a follow-up task.

---

## Acceptance Criteria Assessment

| AC | Description | Status |
|----|-------------|--------|
| Fix | Stale check `if (expandedSessionId !== session.id) return` present after `await fetchHands(...)` | ✅ SATISFIED |
| Fix | No double-render of detail rows on rapid sequential clicks (success path) | ✅ SATISFIED |
| Regression | No new CRITICAL issues | ✅ PASS |
| Regression | No new HIGH issues pre-existing in this file | ⚠️ H-1 identified — missing stale guard in `catch` path |

---

## Summary

The primary fix for `aia-core-5g9` is correctly implemented. The success-path stale check is present and logically sound. One new HIGH issue was identified: the `catch` block does not perform the equivalent stale check, creating an edge-case race condition that corrupts both DOM state and `expandedSessionId` when a fetch fails after the user has switched to a different session.

---

FINDINGS SUMMARY: C:0 H:1 M:0 L:1
