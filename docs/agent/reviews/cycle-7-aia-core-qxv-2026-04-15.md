# Code Review Report — aia-core

**Date:** 2026-04-15
**Target:** TanStack Query setup + analytics API hooks (Cycle 7)
**Reviewer:** Scott (automated)

**Task:** aia-core-qxv — TanStack Query setup + analytics API hooks
**Beads ID:** aia-core-qxv

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 0 |
| LOW | 1 |
| **Total Findings** | **1** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | @tanstack/react-query is added to package.json | SATISFIED | `frontend/package.json` L31 — `"@tanstack/react-query": "^5.99.0"` | Listed under `dependencies` (not devDependencies), correct |
| 2 | QueryClientProvider wraps the app in the root component | SATISFIED | `frontend/src/main.tsx` L4,7,14-16 — `QueryClientProvider` wraps `<App />` inside `<StrictMode>` | Follows standard pattern |
| 3 | Hooks created: usePlayerTrends(name), useHeadToHead(p1, p2), useAwards(gameId?), useGameHighlights(gameId), usePlayerStats(name), useGameStats(gameId) | SATISFIED | `frontend/src/hooks/useAnalytics.ts` — all 6 hooks exported with correct signatures | Signatures match AC exactly |
| 4 | Each hook returns typed data matching the backend Pydantic models | SATISFIED | TS types in `frontend/src/api/types/analytics.ts` field-by-field match `backend/src/pydantic_models/stats_schemas.py`; all hooks use explicit `useQuery<T, Error>` generics | See type comparison below |
| 5 | Hooks handle loading, error, and empty states | SATISFIED | TanStack Query exposes `isLoading`, `isError`, `error` natively; tests verify all three states (`test/hooks/useAnalytics.test.tsx` L175-185) | `enabled` guards prevent invalid fetches |

---

## Type Alignment: Backend Pydantic ↔ Frontend TypeScript

All 8 analytics types were compared field-by-field:

| Pydantic Model | TypeScript Interface | Match |
|---|---|---|
| `PlayerStatsResponse` (12 fields) | `PlayerStatsResponse` | ✅ Exact — `float` → `number`, `str` → `string` |
| `GameStatsPlayerEntry` (7 fields) | `GameStatsPlayerEntry` | ✅ Exact |
| `GameStatsResponse` (4 fields) | `GameStatsResponse` | ✅ `date` → `string` (correct — JSON serializes dates as ISO strings) |
| `PlayerSessionTrend` (6 fields) | `PlayerSessionTrend` | ✅ Exact |
| `StreetBreakdown` (4 fields) | `StreetBreakdown` | ✅ Exact |
| `HeadToHeadResponse` (11 fields) | `HeadToHeadResponse` | ✅ Exact |
| `AwardEntry` (6 fields) | `AwardEntry` | ✅ Exact |
| `GameHighlight` (3 fields) | `GameHighlight` | ✅ Exact |

---

## URL Alignment: Backend Routes ↔ Client Fetch Functions

All 4 new fetch functions use correct paths (backend prefix: `/stats`):

| Fetch Function | URL Built | Backend Route | Match |
|---|---|---|---|
| `fetchPlayerTrends` | `/stats/players/{name}/trends` | `GET /players/{player_name}/trends` | ✅ |
| `fetchHeadToHead` | `/stats/head-to-head?player1=...&player2=...` | `GET /head-to-head` | ✅ |
| `fetchAwards` | `/stats/awards[?game_id=N]` | `GET /awards` | ✅ |
| `fetchGameHighlights` | `/stats/games/{id}/highlights` | `GET /games/{game_id}/highlights` | ✅ |

All player name parameters use `encodeURIComponent()` — no injection risk.

---

## Findings

### [LOW] No custom `staleTime` on QueryClient

**File:** `frontend/src/main.tsx`
**Line(s):** 7
**Category:** design

**Problem:**
The `QueryClient` is created with default options (`staleTime: 0`). This means data is considered stale immediately after fetch, triggering background refetches on every component mount, window re-focus, and reconnect. For analytics data that typically does not change between renders, this may produce unnecessary network traffic.

**Code:**
```tsx
const queryClient = new QueryClient();
```

**Suggested Fix:**
Consider setting a project-wide `staleTime` appropriate for analytics data:
```tsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000 }, // 30 seconds
  },
});
```
Alternatively, set `staleTime` per-hook if different endpoints have different freshness needs.

**Impact:** Minor — slightly increased network traffic; no correctness issue. Default behavior is valid and many teams prefer aggressive refetching.

---

## Positives

- **Clean hook design** — each hook is minimal, correctly typed, and uses `enabled` guards to prevent invalid fetches (empty strings, zero/negative IDs)
- **Strong type fidelity** — all 8 TypeScript interfaces are a perfect field-by-field match to backend Pydantic models, including correct `date` → `string` mapping
- **Proper URL encoding** — `encodeURIComponent()` used consistently for player names in URL segments and query parameters
- **Thorough test coverage** — 14 tests covering all 6 hooks with success, disabled-state, error, and loading scenarios; fresh `QueryClient` per test prevents cache bleed
- **Good barrel exports** — `types/index.ts` re-exports all analytics types cleanly
- **Correct provider placement** — `QueryClientProvider` wraps `<App />` inside `<StrictMode>`, following React 19 best practices

---

## Overall Assessment

This is a clean, well-structured implementation. All 5 acceptance criteria are **SATISFIED**. Types align exactly with backend schemas, URLs are correct, hooks follow TanStack Query best practices with proper `enabled` guards, and test coverage is thorough. The single LOW finding (default `staleTime`) is a minor optimization opportunity, not a defect. No critical, high, or medium issues found.

**(C: 0, H: 0, M: 0, L: 1)**
