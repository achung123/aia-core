# Code Review Report — frontend-react-ts-006

**Date:** 2026-04-12
**Cycle:** 22
**Target:** `frontend/src/views/DataView.tsx`, `frontend/src/views/DataView.test.tsx`, `frontend/src/App.tsx`
**Reviewer:** Scott (automated)

**Task:** T-021 — Convert dataView to React TSX
**Beads ID:** aia-core-jmv3
**Epic:** aia-core-dthg (Frontend Migration: JS + Preact → TS + React)

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 1 |
| MEDIUM | 3 |
| LOW | 3 |
| **Total Findings** | **7** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| AC-1 | `DataView.tsx` is a React component with typed props | SATISFIED | `DataView.tsx` — exported named function component; sub-components (`CreateGameModal`, `CsvUploadModal`, `AddHandModal`, `EditHandModal`, `HandDetails`, `SessionRow`) all have typed interface props | Main component takes no props (correct — it's a route-level view) |
| AC-2 | All data fetching uses the typed API client | SATISFIED | `DataView.tsx:2-15` — all 12 API functions imported from `../api/client.ts`; types imported from `../api/types.ts` | No raw `fetch()` calls anywhere |
| AC-3 | Session/hand browsing functionality preserved | SATISFIED | Tests verify: session table rendering, sorting, row expansion, hand details with formatted cards, modals for create/CSV, collapse toggle | Core CRUD and browse features all present |
| AC-4 | Styles use CSS Modules | NOT SATISFIED | No `.module.css` file exists; no CSS Module import in `DataView.tsx`; all class names are plain strings (`className="data-view"`, `className="dv-btn"`, etc.); extensive inline `style={{}}` props | See HIGH-001 |

**Story S-4.3 ACs:**

| AC # | Criterion | Status | Evidence |
|---|---|---|---|
| S-4.3 AC-1 | `DataView.tsx` replaces imperative DOM with JSX | SATISFIED | Full JSX component tree — no `document.createElement` in rendering paths |
| S-4.3 AC-2 | All data fetching uses typed API client | SATISFIED | Same as T-021 AC-2 |
| S-4.3 AC-3 | Same session/hand browsing functionality as original | SATISFIED | Same as T-021 AC-3 |

---

## Findings

### [HIGH] HIGH-001: CSS Modules not used (AC-4 violation)

**File:** `frontend/src/views/DataView.tsx`
**Line(s):** 1–700 (entire file)
**Category:** convention (AC violation)

**Problem:**
T-021 AC-4 requires "Styles use CSS Modules." The component uses plain string class names throughout (`className="data-view"`, `className="dv-btn"`, `className="modal-overlay"`, etc.) and extensive inline `style={{}}` props. No `.module.css` file exists and no CSS Module import is present.

**Suggested Fix:**
Create `DataView.module.css`, extract all class definitions and inline styles, then import as `import styles from './DataView.module.css'` and reference as `className={styles.dataView}`.

**Impact:** Styles are global and can collide with other components. This is the one unsatisfied AC.

---

### [MEDIUM] MED-001: Imperative DOM manipulation for CSV export

**File:** `frontend/src/views/DataView.tsx`
**Line(s):** 544–549
**Category:** design

**Problem:**
`handleExportCsv()` creates a DOM anchor element, appends it to `document.body`, programmatically clicks it, then removes it. This is imperative DOM manipulation inside a React component.

**Suggested Fix:**
Use a standard `<a>` element rendered in JSX with `href={exportGameCsvUrl(session.game_id)}` and `download` attribute, or use a library like `file-saver`.

**Impact:** Functional but bypasses React's virtual DOM; minor maintainability concern.

---

### [MEDIUM] MED-002: Imperative navigation via window.location.hash and global function

**File:** `frontend/src/views/DataView.tsx`
**Line(s):** 533–540
**Category:** design

**Problem:**
`handleLoadViz()` sets `window.location.hash` directly and uses `setTimeout(300ms)` to call a global `window.__loadSessionById`. This bypasses React Router entirely and relies on a fragile global function contract.

**Code:**
```tsx
const handleLoadViz = () => {
  window.location.hash = '#/playback';
  setTimeout(() => {
    if ((window as unknown as Record<string, unknown>).__loadSessionById) {
      (window as unknown as { __loadSessionById: (id: number) => void }).__loadSessionById(session.game_id);
    }
  }, 300);
};
```

**Suggested Fix:**
Use React Router's `useNavigate()` with state: `navigate('/playback', { state: { sessionId: session.game_id } })`, then consume the state in the playback view.

**Impact:** Fragile coupling; will break silently if the global function is renamed or removed. The 300ms timeout is a race condition risk.

---

### [MEDIUM] MED-003: Browser-native `confirm()` and `alert()` dialogs

**File:** `frontend/src/views/DataView.tsx`
**Line(s):** 520, 528, 523, 531
**Category:** design

**Problem:**
`handleDelete` and `handleDeleteGame` use `window.confirm()` for confirmation and `window.alert()` for error messages. These are blocking synchronous browser dialogs that break React rendering flow and cannot be styled or tested easily.

**Suggested Fix:**
Replace with React-managed confirmation modals (consistent with the existing modal pattern in this file).

**Impact:** Functional but untestable and inconsistent with the React modal pattern already used elsewhere in this component.

---

### [LOW] LOW-001: Large single file (~700 lines)

**File:** `frontend/src/views/DataView.tsx`
**Line(s):** 1–700
**Category:** design

**Problem:**
The file contains 6 sub-components (`CreateGameModal`, `CsvUploadModal`, `AddHandModal`, `EditHandModal`, `HandDetails`, `SessionRow`) plus helper functions, all in a single file. This is manageable now but will become harder to maintain.

**Suggested Fix:**
Consider extracting modals into a `DataView/` directory with separate files per modal in a future task.

**Impact:** Readability and maintainability; not blocking.

---

### [LOW] LOW-002: Sequential await in EditHandModal for player updates

**File:** `frontend/src/views/DataView.tsx`
**Line(s):** 456–463
**Category:** correctness

**Problem:**
`handleSubmit` in `EditHandModal` loops over `playerEdits` with sequential `await` for each `updateHolecards` call. With many players, this creates unnecessary latency.

**Suggested Fix:**
Collect changed entries into an array and use `Promise.all()` to send updates in parallel.

**Impact:** Minor UX degradation with many players; no correctness issue.

---

### [LOW] LOW-003: Empty string used as React key in hand table header

**File:** `frontend/src/views/DataView.tsx`
**Line(s):** 566
**Category:** convention

**Problem:**
The hand table header maps over `['#', 'Flop', 'Turn', 'River', 'Players', '']` using each string as a key. The last column (actions) uses `''` as its key, which is technically valid but obscure.

**Code:**
```tsx
{['#', 'Flop', 'Turn', 'River', 'Players', ''].map(t => <th key={t}>{t}</th>)}
```

**Suggested Fix:**
Use `'actions'` as the key/label for the last column, or define a constant array with explicit keys.

**Impact:** Cosmetic; no runtime issue.

---

## Positives

- **Clean TypeScript throughout** — All interfaces are explicit and well-named (`CreateGameModalProps`, `PlayerInput`, `EditHandModalProps`, etc.). No `any` types.
- **Typed API client fully adopted** — All 12 API functions imported from the typed client; response types flow through correctly.
- **Thorough test suite** — 13 tests covering rendering, loading, error, sorting, expand/collapse, formatted cards, modals, and status badges. All pass.
- **Consistent error handling** — Every `catch` block uses the `e instanceof Error ? e.message : String(e)` pattern uniformly.
- **Good separation of concerns** — Sub-components are well-scoped with clear prop interfaces; `sortSessions` is a pure function extracted from the component.
- **Clean App.tsx integration** — `DataView` properly wired into React Router at `/data` in `App.tsx`.

---

## Overall Assessment

The conversion from vanilla DOM to React TSX is well-executed. Three of four ACs are satisfied — the only gap is **AC-4 (CSS Modules)**, which is a clear miss: all styles remain as plain string class names and inline style props. No bugs or security issues were found. The 13-test suite provides good coverage of the main component's happy paths.

**Recommendation:** Create a follow-up task to add CSS Modules (AC-4) and address the MEDIUM findings (imperative DOM/navigation patterns, native dialogs). The core conversion is sound.
