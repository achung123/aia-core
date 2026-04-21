# Code Review Report — table-3d-revamp-010

**Date:** 2026-04-18
**Target:** T-020 `<EquityBadge>` wired to equity endpoint (triple-layer gated)
**Reviewer:** Scott (automated, orchestration loop)
**Cycle:** 25
**Epic:** aia-core-6o9t — table-3d-revamp-010

**Task:** T-020 — `<EquityBadge>` wired to equity endpoint (triple-layer gated)
**Beads ID:** aia-core-3wsi

**Files reviewed:**
- [frontend/src/scenes3d/state/equityGuard.ts](frontend/src/scenes3d/state/equityGuard.ts)
- [frontend/src/scenes3d/data/useEquityQuery.ts](frontend/src/scenes3d/data/useEquityQuery.ts)
- [frontend/src/scenes3d/components/EquityBadge.tsx](frontend/src/scenes3d/components/EquityBadge.tsx)
- [frontend/src/scenes3d/PokerTable.tsx](frontend/src/scenes3d/PokerTable.tsx) (equity integration only)
- [frontend/test/scenes3d/state/equityGuard.test.ts](frontend/test/scenes3d/state/equityGuard.test.ts)
- [frontend/test/scenes3d/EquityBadge.test.tsx](frontend/test/scenes3d/EquityBadge.test.tsx)

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 2 |
| LOW | 3 |
| **Total Findings** | **5** |

Suite: **1753/1753 passed** (full `npx vitest run`, 20.04s). T-020-scoped files lint-clean; pre-existing unrelated lint errors in `views/DataView.tsx`, `views/PlaybackView.tsx`, `dealer/*`, `pages/HeadToHeadPage.tsx`, etc. are out of scope and already on the roll-forward ledger. The only new warning on a T-020-touched file is [PokerTable.tsx:119](frontend/src/scenes3d/PokerTable.tsx#L119) (unused eslint-disable for `no-console`) — pre-existing, not introduced by this task.

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | `<PokerTable>` accepts `equityOverlay: boolean` (default `false`); badges render + endpoint called only when `true` | SATISFIED | [PokerTable.tsx:155](frontend/src/scenes3d/PokerTable.tsx#L155), [EquityBadge.test.tsx](frontend/test/scenes3d/EquityBadge.test.tsx) test `defaults equityOverlay to false — no fetch on mount` | Default wired at the parameter; integration test asserts zero fetches |
| 2 | Player policy forces `false`, endpoint never called, dev warning on `prop=true` | SATISFIED | [equityGuard.ts:32-44](frontend/src/scenes3d/state/equityGuard.ts#L32-L44), [equityGuard.test.ts](frontend/test/scenes3d/state/equityGuard.test.ts) (`hard-forces false`, `logs a dev warning`), [EquityBadge.test.tsx](frontend/test/scenes3d/EquityBadge.test.tsx) (`never fetches and never renders under player policy`) | Enforced at both render site and `enabled` gate |
| 3 | Badges appear only when overlay=true AND data available AND ≥2 seats have hole cards | SATISFIED | [EquityBadge.tsx:153-160](frontend/src/scenes3d/components/EquityBadge.tsx#L153-L160), test `hides badges when fewer than 2 seats have hole cards` | Three short-circuits at render top |
| 4 | Values refresh on street change | SATISFIED | [useEquityQuery.ts:33-38](frontend/src/scenes3d/data/useEquityQuery.ts#L33-L38) (streetIndex in queryKey), test `re-fetches on street change` | Query key includes `streetIndex` |
| 5 | On fetch failure, badges silently hide — no error UI | SATISFIED | [EquityBadge.tsx:156](frontend/src/scenes3d/components/EquityBadge.tsx#L156) (`!data → null`), [useEquityQuery.ts:52](frontend/src/scenes3d/data/useEquityQuery.ts#L52) (`retry: false`), test `silently hides on fetch failure — no error UI` | `retry:false` prevents hammer-looping |
| 6 | Badge text readable at 360px width | PARTIAL | [EquityBadge.tsx:38-44](frontend/src/scenes3d/components/EquityBadge.tsx#L38-L44) (world-unit constants) | Same proxy pattern as T-016 `<Nameplate>` — world-unit geometry regression, not real 360px WebGL rasterization. Matches cycle-16 precedent; no new gap |
| 7a | Player mode + overlay=true → zero fetches, zero badges | SATISFIED | [EquityBadge.test.tsx](frontend/test/scenes3d/EquityBadge.test.tsx) `player policy + equityOverlay=true — zero fetches, zero badges` | Asserted at both `<EquityBadges>` and `<PokerTable>` integration levels |
| 7b | Spectator + overlay=true → fetches once, badges render | SATISFIED | Same file, `fetches and renders badges when equityOverlay=true + spectator + ≥2 hole cards` | `toHaveBeenCalledTimes(1)` |
| 7c | Spectator + overlay=false → zero fetches | SATISFIED | Same file, `does not fetch and renders nothing when equityOverlay=false` | — |

All 9 ACs satisfied (AC 6 uses the same world-unit proxy that was accepted in T-016; a real WebGL legibility test is already filed under BUG-CYCLE16-01).

---

## Findings

### [MEDIUM] Hole-card short-circuit is render-only, not `enabled`-gated

**File:** [frontend/src/scenes3d/components/EquityBadge.tsx](frontend/src/scenes3d/components/EquityBadge.tsx)
**Line(s):** 151-158
**Category:** design

**Problem:**
The ≥2-hole-card rule from AC 3 is enforced only at render time (`countSeatsWithHoleCards(state) < 2 → null`). The query's `enabled` flag is computed solely from `resolveEquityOverlay(equityOverlay, viewer)` — so while `<EquityBadges>` is mounted under a spectator with overlay=true, the equity endpoint fetches even when nobody has hole cards yet (e.g. before the deal, or mid-deal between seats). The test `hides badges when fewer than 2 seats have hole cards` acknowledges this explicitly with the comment *"Fetch is allowed (gate pure on overlay+policy), but render is blocked."*

```tsx
const { data } = useEquityQuery({
  gameId: state.gameId,
  handNumber: state.handNumber,
  streetIndex: state.streetIndex,
  enabled: allowed, // only overlay+policy — not hole-card count
});
if (!allowed) return null;
if (!data) return null;
if (countSeatsWithHoleCards(state) < 2) return null;
```

**Suggested Fix:**
Fold the count into `enabled`:

```tsx
const enoughHoleCards = countSeatsWithHoleCards(state) >= 2;
const { data } = useEquityQuery({ ..., enabled: allowed && enoughHoleCards });
```

This avoids a (usually short-lived) pre-deal equity request on every hand-open. Not a privacy or AC violation — AC 3 says "Badges appear only when …", which is render-side, and AC 1 says the endpoint is called only when `equityOverlay === true` (true here). Purely an efficiency tightening.

**Impact:** One extra GET per hand-open under spectator + overlay=true; backend already serves the endpoint (pre-existing). No data leakage; no test regression.

---

### [MEDIUM] Triple-layer defence has a build-time hole until T-032 lands

**File:** [frontend/src/scenes3d/components/EquityBadge.tsx](frontend/src/scenes3d/components/EquityBadge.tsx), [frontend/src/scenes3d/PokerTable.tsx](frontend/src/scenes3d/PokerTable.tsx)
**Line(s):** EquityBadge.tsx whole file; PokerTable.tsx:11, 450-454
**Category:** design

**Problem:**
Per the focus question: `<PokerTable>` unconditionally imports `EquityBadges` (PokerTable.tsx:11), which transitively pulls in `useEquityQuery` → `fetchEquity`. The runtime guard correctly prevents the *fetch* under player policy (layers 1+2 verified by tests), but the *code path and endpoint URL string* land in the player-route bundle as dead weight. This is precisely what layer 3 (the `no-equity-in-player` ESLint rule) is designed to prevent — and that rule is explicitly deferred to T-032 by both task bodies:

- [tasks.md:405](specs/table-3d-revamp-010/tasks.md#L405): *"The ESLint rule that blocks equity imports under player files ships separately in T-032 as part of the player-route migration."*
- [tasks.md:700](specs/table-3d-revamp-010/tasks.md#L700): T-032 owns "Also land the ESLint rule (layer 3 of the equity enforcement model)…"
- [plan.md:502](specs/table-3d-revamp-010/plan.md#L502): Enforcement Model §3 assigns the lint rule to T-032.

So the deferral is **spec-compliant** and not a CRITICAL/HIGH gap — the spec explicitly stages it that way, and the player route (`pages/TableView.tsx`) has not yet been migrated to import `<PokerTable>`; until T-032, no player bundle even references this scene graph. The window where a player-route build could ship dead equity code without the ESLint fence is opened exactly when T-032 starts and is scheduled to be closed in the same task.

**Suggested Fix:**
No change to T-020. Log a reminder in T-032's acceptance criteria that the ESLint rule **must** land in the same commit/PR that wires `<PokerTable>` into `pages/TableView.tsx` — never after. The existing T-032 body already couples these ("Also land the ESLint rule… and wire it into `frontend/eslint.config.js`"), but an AC-level assertion ("ESLint rule is active before `pages/TableView.tsx` imports `<PokerTable>`") would make the ordering auditable.

**Impact:** Design clarity only. Runtime behaviour under player policy is fully guarded by layers 1 and 2, which are exercised by six dedicated tests. No CRITICAL: the player route does not currently import anything from `scenes3d/` (T-032 hasn't started).

---

### [LOW] `userData.testid` on R3F `<group>` is inert

**File:** [frontend/src/scenes3d/components/EquityBadge.tsx](frontend/src/scenes3d/components/EquityBadge.tsx)
**Line(s):** 105
**Category:** convention

**Problem:**
```tsx
<group
  name={`equity-badge-${seatIndex}`}
  position={worldPosition}
  userData={{ seatIndex, equity, label, testid: 'equity-badge' }}
>
```
`testid` in `userData` is unreachable by `@testing-library/react`'s `getByTestId` because R3F `<group>` is not a DOM node — it only shows up in tests because `@react-three/fiber` is mocked to a passthrough `<div>`. Every test in this file queries either `group[name="equity-badge-2"]` (DOM attribute from the passthrough) or `[data-testid="equity-badge-text"]` on the mocked drei `<Text>` — never `testid=equity-badge`. Other 3D components either omit this (Nameplate, Card) or use `data-testid` on HTML overlays ([TableSettingsPanel.tsx:46](frontend/src/scenes3d/components/TableSettingsPanel.tsx#L46), [HandScrubberPanel.tsx:189](frontend/src/scenes3d/components/HandScrubberPanel.tsx#L189)).

**Suggested Fix:**
Drop the `testid` key from `userData`, or rename to `testId` if there's a planned scene-traversal test harness. The `name` attribute already serves the same purpose and is what the tests actually use.

**Impact:** Cosmetic; dead-data only.

---

### [LOW] Dumb leaf + smart wrapper co-located in one file

**File:** [frontend/src/scenes3d/components/EquityBadge.tsx](frontend/src/scenes3d/components/EquityBadge.tsx)
**Line(s):** whole file
**Category:** design

**Problem:**
`EquityBadge` (pure R3F leaf) and `EquityBadges` (react-query wrapper) share one module. Repo convention for the parallel pattern (`<Nameplate>` vs `<Nameplates>`) splits them across two files (`Nameplate.tsx`, `Nameplates.tsx`). The single-file co-location here mixes a DOM-testable leaf with a component that requires `QueryClientProvider` to render, which complicates future snapshot or visual testing of the leaf in isolation.

**Suggested Fix:**
Optional — match the Nameplate convention by extracting `EquityBadges` into `components/EquityBadges.tsx`. Re-export from the current file to avoid a wide import churn.

**Impact:** Consistency with adjacent patterns; non-blocking.

---

### [LOW] `fetchEquity` endpoint is handNumber-scoped but queryKey is street-scoped

**File:** [frontend/src/scenes3d/data/useEquityQuery.ts](frontend/src/scenes3d/data/useEquityQuery.ts)
**Line(s):** 33-38, 47-48
**Category:** correctness

**Problem:**
```ts
queryKey: buildEquityQueryKey(gameId, handNumber, streetIndex),
queryFn: () => fetchEquity(gameId, handNumber), // no streetIndex
```
The query key changes on street transitions (which correctly triggers AC 4 refetch), but the `fetchEquity` URL is identical across streets for the same hand — `GET /games/{gameId}/hands/{handNumber}/equity`. This works today **only** because the backend endpoint re-computes equity based on whatever community cards are currently persisted for the hand; any backend change that caches by URL (e.g. CDN, server-side memoize on `handNumber` alone) would silently serve stale equity. The assumption is load-bearing but implicit.

**Suggested Fix:**
Add a one-line comment above `queryFn` documenting the invariant: *"Backend derives equity from the current community state of the hand — same URL, different response per street. If this ever changes, thread `streetIndex` through as a query param."*

**Impact:** Documentation / future-proofing; no current bug.

---

## Positives

- **Triple-layer enforcement model implemented exactly as spec'd** — the `resolveEquityOverlay` pseudocode in [plan.md:486-494](specs/table-3d-revamp-010/plan.md#L486-L494) is matched line-for-line in [equityGuard.ts:32-44](frontend/src/scenes3d/state/equityGuard.ts#L32-L44), including the DEV-only warn.
- **Privacy invariant is belt-and-suspenders at runtime** — `<PokerTable>` also gates the *mount* of `<EquityBadges>` via `resolveEquityOverlay(...)` at [PokerTable.tsx:450](frontend/src/scenes3d/PokerTable.tsx#L450), so even if a consumer bypassed `QueryClientProvider`, the player policy still produces zero badges. This is the "avoids needing QueryClientProvider in existing tests" tradeoff the user flagged, and it's the right call.
- **QueryClientProvider is rooted at the app boundary** ([main.tsx:14-16](frontend/src/main.tsx#L14-L16)) inside `<StrictMode>`. Any mid-hand flip of `viewer.policy` from `player` → `spectator` is safe — the provider is always mounted for real consumers.
- **`retry: false` + `refetchOnWindowFocus: false`** directly implement AC 5 (silent hide) without letting a 500-ing endpoint pound the server while the hand is on-screen.
- **StrictMode fetch-count safety** — tests assert `toHaveBeenCalledTimes(1)` and full suite runs 1753/1753 under vitest's default effect semantics. React-Query dedupes by queryKey across the StrictMode mount/unmount/mount cycle; no flakiness observed.
- **26 new tests with crisp AC mapping** — each `<EquityBadges>` test names the AC it covers (`AC 7a`, `AC 7b`, `AC 3`, `AC 4`, `AC 5`).
- **Pure helpers extracted** (`formatEquityPercent`, `countSeatsWithHoleCards`, `computeEquityBadgeWorldPosition`) — testable without R3F/WebGL, clamps `NaN` / out-of-range equity defensively.

---

## Overall Assessment

**APPROVE CLOSE.** Zero CRITICAL, zero HIGH findings. All 9 ACs satisfied; the AC 6 legibility proxy reuses the same world-unit regression pattern accepted in T-016 and its real-WebGL follow-up is already filed.

Focus-question resolution:
- **(a) ESLint rule deferral:** spec-compliant, explicitly owned by T-032 at three spec sites ([plan.md:502](specs/table-3d-revamp-010/plan.md#L502), [tasks.md:405](specs/table-3d-revamp-010/tasks.md#L405), [tasks.md:700](specs/table-3d-revamp-010/tasks.md#L700)). Not a HIGH gap. Filed as MED so T-032 AC explicitly orders "ESLint rule active before player route imports `<PokerTable>`".
- **(b) Runtime player-mode leak surface:** none. `<PokerTable>` unconditionally imports `<EquityBadges>` but *conditionally mounts* it via `resolveEquityOverlay(...)`; `useEquityQuery` further gates the fetcher via `enabled`. Two independent tests (`never fetches and never renders under player policy`, `player policy + equityOverlay=true — zero fetches, zero badges`) assert `fetchEquity` is not called. The only residual is compile-time bundle inclusion when T-032 eventually imports `<PokerTable>` from the player route — that's exactly the surface layer 3 exists to close, and T-032 owns it.
- **(c) Silent hide + `retry: false`:** matches AC 5 verbatim; spectator doesn't need a visible signal per spec.
- **(d) Conditional mount + QueryClientProvider:** provider is at app root in `main.tsx`. No failure mode where guard flips to `true` without a provider in real usage. Consumer contract (provider required) is standard React-Query idiom.
- **(e) StrictMode double-fetch:** tests use `render(...)` not `renderHook` (user's description was slightly off). StrictMode double-invokes effects but React-Query dedupes by key — asserted `toHaveBeenCalledTimes(1)` is stable, full suite 1753/1753.

Roll-forward ledger: 2 MEDIUM (fetch-gating tightening, T-032 AC ordering note), 3 LOW (userData.testid, file-split convention, endpoint-scope comment). None block close.
