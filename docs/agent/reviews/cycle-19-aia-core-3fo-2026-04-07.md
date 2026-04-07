# Code Review Report — aia-core

**Date:** 2026-04-07
**Target:** `frontend/src/views/dataView.js`, `frontend/src/main.js` (route registration)
**Reviewer:** Scott (automated)

**Task:** Build data interface: session list table
**Beads ID:** aia-core-3fo

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 1 |
| MEDIUM | 1 |
| LOW | 3 |
| **Total Findings** | **5** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | "Data" nav renders a table with columns: Date, Status, Hands, Players | SATISFIED | `dataView.js` lines 203–210: `columns` array with keys `date`, `status`, `hands`, `players`; `#/data` route wired in `main.js` line 17 | Column order matches spec |
| 2 | Column headers clickable to sort ascending/descending | SATISFIED | `dataView.js` lines 215–229: each `th` gets a `click` listener that toggles `sortAsc` or changes `sortCol`, then calls `updateHeaders` + `buildTableBody` | Toggle indicator (↑/↓) rendered correctly |
| 3 | Row click expands to show nested hand table | SATISFIED | `dataView.js` line 179: `tr.addEventListener('click', ...)` → `handleRowClick`; `handleRowClick` inserts a `hand-details-row` with a `hand-table` | Collapse on second click also works |
| 4 | Each hand row shows: hand number, flop (3 cards), turn, river, per-player results | SATISFIED | `dataView.js` lines 104–131: `tdNum`, `tdFlop`, `tdTurn`, `tdRiver`, `tdPlayers` all populated with correct field mappings (`flop_1/2/3`, `turn`, `river`, `player_hands`) | |
| 5 | Loading and error states handled | SATISFIED | Sessions: `loadingEl` (line 193) + `.catch` error banner (lines 244–251). Hands: `loadingRow` (lines 67–73) + catch block renders error row (lines 140–152) | Both loading and error paths covered for both async operations |

---

## Findings

### [HIGH] Race condition: stale fetch resolves after row is toggled closed (or different row opened)

**File:** `frontend/src/views/dataView.js`
**Line(s):** 55–153 (`handleRowClick`), key insertion at lines 138–139
**Category:** correctness

**Problem:**
`handleRowClick` is `async`. After the `await fetchHands(session.id)` suspends, the user can click the same row again (collapsing it) or click a different row. In both cases the guard at lines 57–62 removes the loading row and returns early, setting `expandedSessionId` to `null` (same row) or a different ID (different row). However, the suspended `await` from the **first** click still resolves and unconditionally executes `tr.insertAdjacentElement('afterend', detailsRow)` at line 139 — there is no post-`await` check that `expandedSessionId` still equals `session.id`.

Concrete failure scenarios:

1. **Double-click same row**: user clicks row A (fetch starts) → clicks row A again before fetch completes (loading row removed, `expandedSessionId = null`) → fetch resolves → detail row ghost-inserts below `tr` with no user action.
2. **Switch rows rapidly**: click row A → click row B before A resolves → fetch A resolves while B is still loading → A's detail row appears in the DOM alongside B's loading row, producing two simultaneous expanded sections.

The existing check at lines 56–63 only guards the **entry path**; there is no guard at the **resolution path**.

**Code:**
```js
// line 76
const hands = await fetchHands(session.id);
loadingRow.remove();
// ... build detailsRow ...
// line 139 — no guard here; always inserts even if expandedSessionId changed
tr.insertAdjacentElement('afterend', detailsRow);
```

**Suggested Fix:**
After `await fetchHands(session.id)` resolves, check whether the session is still the active expanded session before inserting:

```js
const hands = await fetchHands(session.id);
loadingRow.remove();

// Abort if the user toggled or switched rows while the fetch was in flight
if (expandedSessionId !== session.id) return;

const detailsRow = document.createElement('tr');
// ... rest unchanged
```

Mirror the same guard in the `catch` block before inserting the error row.

**Impact:** Users see unexpected, unsolicited detail expansions or multiple open sections simultaneously. Severity is high but not data-destructive.

---

### [MEDIUM] Date sort uses lexicographic string comparison

**File:** `frontend/src/views/dataView.js`
**Line(s):** 25–27
**Category:** correctness

**Problem:**
`sortSessions` compares date values with JavaScript's `<`/`>` operators on raw strings:

```js
av = a.game_date || a.date || '';
bv = b.game_date || b.date || '';
```

This is correct only if the API consistently returns ISO 8601 dates (`YYYY-MM-DD`). If dates arrive in any other format (e.g. `MM/DD/YYYY`, locale-formatted strings), lexicographic order will produce incorrect sort results. The `buildTableBody` display path at line 163 uses the same raw field without normalisation, so there is no indication the format is validated elsewhere.

**Suggested Fix:**
Parse dates before comparison to make sort format-agnostic:

```js
av = new Date(a.game_date || a.date || 0).getTime();
bv = new Date(b.game_date || b.date || 0).getTime();
```

`new Date('')` returns `Invalid Date` with `NaN` `getTime()`, so add a fallback: `|| 0` on the `getTime()` call to sort empty/invalid dates consistently.

**Impact:** Sort order is silently wrong for any non-ISO date format returned by the backend. Data is not lost, but the table is misleadingly ordered.

---

### [LOW] `tbody.id = 'session-tbody'` is set but never queried

**File:** `frontend/src/views/dataView.js`
**Line(s):** ~239 (inside `renderDataView`, `tbody` creation block)
**Category:** convention

**Problem:**
`tbody.id = 'session-tbody'` assigns a DOM id that is never referenced by `getElementById`, `querySelector`, or any selector in the file or in the project's frontend source. It is dead code.

**Suggested Fix:**
Remove `tbody.id = 'session-tbody';`.

**Impact:** Negligible. If the DOM is ever inspected, the id is misleading because it implies external dependencies.

---

### [LOW] No visual "selected" state applied to expanded session row

**File:** `frontend/src/views/dataView.js`
**Line(s):** 55–65, 155–182
**Category:** design

**Problem:**
When a row is expanded, no CSS class (e.g. `session-row--expanded`) is added to the parent `<tr>`. When the details panel is loading or shown, the session row itself is visually indistinguishable from a collapsed row. `handleRowClick` also never removes such a class on collapse. There is no affordance that the row is the "active" one.

**Suggested Fix:**
In `handleRowClick`, add `tr.classList.add('session-row--expanded')` after setting `expandedSessionId`, and remove it (or remove via the `tr` reference captured in `buildTableBody`) in the early-return collapse path.

**Impact:** UX polish only; no functional correctness issue.

---

### [LOW] `#/data` route uses an unnecessary wrapper arrow function

**File:** `frontend/src/main.js`
**Line(s):** 17
**Category:** convention

**Problem:**
```js
'#/data': container => renderDataView(container),
```
`renderDataView` already has the same single-argument signature as `renderPlayback`. The wrapper adds no adapter logic and is inconsistent with the `#/playback` entry which passes `renderPlayback` directly.

**Suggested Fix:**
```js
'#/data': renderDataView,
```

**Impact:** Style inconsistency only; no functional difference.

---

## Positives

- **Complete DOM API usage throughout** — every user-controlled string (session fields, hand fields, player names, error messages) is assigned exclusively via `.textContent`. Zero uses of `.innerHTML`, `insertAdjacentHTML`, or `eval`-family APIs. XSS surface is fully closed.
- **Listener cleanup on sort re-render** — `tbody.textContent = ''` correctly removes all old `<tr>` elements. Since no external code holds references to the detached rows, their click listeners are eligible for GC; there is no permanent leak.
- **`renderDataView` resets all module-level state** at entry (lines 185–188), preventing stale state from a previous route visit bleeding into a fresh render.
- **Graceful null handling** — `??` and `||` fallbacks are applied consistently throughout `buildTableBody` and `sortSessions`; no field access will throw on missing API data.
- **`formatCard` is safe for unknown suits** — falls back to the raw suit character rather than throwing or producing a blank, which is robust for unexpected API values.

---

## Overall Assessment

The implementation satisfies all five acceptance criteria. XSS posture is clean and event listener management is sound for the typical use case. The single HIGH finding — the async race condition in `handleRowClick` — is a real user-visible bug triggered by any double-click or rapid row switching while a fetch is in flight; it requires a one-line guard after the `await` to fix. The MEDIUM date-sort issue is latent and will only surface if the backend ever returns non-ISO dates, but it is cheap to harden now. The three LOW findings are clean-up items.

**Recommended next steps (in priority order):**
1. Add post-`await` `expandedSessionId` guard in `handleRowClick` (HIGH fix — ~2 lines)
2. Harden date comparison with `Date.getTime()` (MEDIUM fix — ~2 lines)
3. Remove `tbody.id` dead code and add expanded-row CSS class (LOW cleanup)

No CRITICAL issues found.

---

FINDINGS SUMMARY: C:0 H:1 M:1 L:3
