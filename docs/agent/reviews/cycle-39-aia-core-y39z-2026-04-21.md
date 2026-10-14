# Code Review — Cycle 39 — aia-core-y39z (T-027 Zustand quality-tier slice + tier mappings)

**Reviewer:** Scott (Cyclops)
**Date:** 2026-04-21
**Epic:** table-3d-revamp-010
**Cycle:** 39
**Target beads:** aia-core-y39z
**Jean task:** T-027
**Blocked dependents (pre-review):** aia-core-t4dp (H-1(b) qualityTier wiring), aia-core-cas4 (T-028 FPS monitor)

---

## Scope

Implementation under review:

| File | Change |
|---|---|
| [frontend/src/scenes3d/state/qualitySettings.ts](frontend/src/scenes3d/state/qualitySettings.ts) | New tier-mapping module — promoted from 2-line stub. Exports `QUALITY_TIER_NAMES`, `QUALITY_TIER_SETTINGS` (one row per tier, 10 fields each), `resolveDefaultQualityTier`, `nextLowerTier`, `nextHigherTier`, `MOBILE_BREAKPOINT_PX`, `DEFAULT_QUALITY_TIER_DESKTOP`, `DEFAULT_QUALITY_TIER_MOBILE`, plus supporting types (`QualityTierSettings`, `ShadowSettings`, `EnvMapSettings`, `EnvMapMode`, `PBRMode`, `AntiAliasingMode`). |
| [frontend/src/scenes3d/state/tableStore.ts](frontend/src/scenes3d/state/tableStore.ts) | Extends `TableStoreState` with `qualityTier`, `manualOverride`, `setTier`, `setManualOverride`. Initial `qualityTier` comes from `resolveDefaultQualityTier()`; `manualOverride` defaults `false`. `partialize` widened to include both new keys alongside existing `theme`. |
| [frontend/src/scenes3d/index.ts](frontend/src/scenes3d/index.ts) | Re-exports all public qualitySettings symbols + types. |
| [frontend/test/scenes3d/qualitySettings.test.ts](frontend/test/scenes3d/qualitySettings.test.ts) | New — 10 tests covering canonical tier values (one per tier), Cycle-38-M-1 env-map assertions, defaults, breakpoint logic, `window.innerWidth` fallback, and tier-step helpers. |
| [frontend/test/scenes3d/tableStore.quality.test.ts](frontend/test/scenes3d/tableStore.quality.test.ts) | New — 9 tests covering slice shape, defaults, action mutation, separation of `setTier`/`setManualOverride`, persist roundtrip, partialize whitelist shape, subscriber notification (AC-2). |

Unchanged on purpose (per user contract): `PokerTable.tsx` / `Table.tsx` keep their T-014 inline env-map and shadow-map literals. Migration to read from `QUALITY_TIER_SETTINGS` is the scope of T-038 + `aia-core-t4dp`.

---

## AC Coverage

| AC | Requirement | Status | Evidence |
|---|---|---|---|
| **AC-1** | Default `high` on desktop, `medium` on mobile (≤ 768px). | **COVERED** | `qualitySettings.test.ts` → "defaults: desktop=high, mobile=medium" pins the constants; "resolveDefaultQualityTier picks medium for viewports ≤ 768px, high above" pins the boundary at 768/769; "reads window.innerWidth when no argument given" pins the runtime fallback via happy-dom. The store wires `resolveDefaultQualityTier()` in the `create()` body so the first `useTableStore.getState().qualityTier` on a fresh session reflects viewport size. |
| **AC-2** | Tier change applies without page reload (re-renders scene props). | **COVERED** | `tableStore.quality.test.ts` → "notifies subscribers on setTier" asserts Zustand's subscribe callback fires exactly once per `setTier` — i.e. downstream React components re-render via the store hook without remount. Zustand's reactive pattern is the same one AC-2 relies on for the theme slice. |
| **AC-3** | Tier mapping is exported from a single module consumed by `<PokerTable>` children. | **COVERED** | `qualitySettings.ts` is the sole source of truth; `index.ts` re-exports `QUALITY_TIER_SETTINGS` + helpers; `qualitySettings.test.ts` asserts every field for every tier. Consumer migration to read from this module is the scope of T-038 / `aia-core-t4dp` (explicitly out of scope per T-027 contract). |
| **AC-4** | Settings panel includes a tier dropdown. | **DEFERRED** | Explicitly out of scope per cycle contract — no settings panel exists for quality yet (`TableSettingsPanel.tsx` covers theme only). Tracked as follow-up (see M-1 below). |

**Cycle 38 carry-forward check:**

| Prior finding | Status | Evidence |
|---|---|---|
| Cycle 38 **M-1** (env-map drift vs plan.md) | **TRANSITIVELY CLOSED at the mapping layer** | `qualitySettings.ts` encodes `medium.envMap = { mode: 'baked', resolution: 256 }` and `high.envMap = { mode: 'preset', resolution: null }` — exact plan.md values. Dedicated test "Cycle 38 M-1: Medium env map is 256 and High uses drei preset" pins the fix. The PokerTable.tsx inline literals (`resolution={64}` / `resolution={256}`) remain unchanged per user contract — call-site migration is T-038 / `aia-core-t4dp` scope. |
| Cycle 38 **M-2** (canvas-level shadow-map not enabled) | **NOT IN SCOPE for T-027** | `<Canvas shadows>` enablement is T-038 territory; qualitySettings.ts exposes `shadows.enabled / mapSize / soft` so T-038 has canonical data to consume. |

---

## Test Deltas

| | Before | After | Delta |
|---|---|---|---|
| Total test files | 121 | 123 | +2 |
| Total tests | 1890 | 1909 | +19 |
| Failures | 0 | 0 | 0 |
| Lint errors (touched files) | 0 | 0 | 0 |
| Lint warnings (touched files) | 0 | 0 | 0 |

(Pre-existing repo-wide lint inventory from Cycle 38: 8 errors / 7 warnings in `src/pages/HeadToHeadPage.tsx`, `src/player/PlayerApp.tsx`, `src/views/DataView.tsx`, `src/views/PlaybackView.tsx`. None touched by T-027 — verified by `eslint src/scenes3d/state/qualitySettings.ts src/scenes3d/state/tableStore.ts src/scenes3d/index.ts test/scenes3d/qualitySettings.test.ts test/scenes3d/tableStore.quality.test.ts` → clean.)

---

## Review Checklist Results

### 1. Slice API matches plan.md § "State Shape (Zustand Slices)"

**PASS.** plan.md declares:
```ts
qualityTier: QualityTier;
manualOverride: boolean;
setTier: (t: QualityTier) => void;
setManualOverride: (b: boolean) => void;
```
Implementation matches name-for-name, type-for-type. The theme + replay slices of `TableStoreState` are untouched; no renames, no breakage of existing selectors.

### 2. Tier mapping values match plan.md § "Quality Tiers & Performance Budget"

**PASS.** 10 attributes × 3 tiers = 30 values; every one pinned by a dedicated test and cross-checked against plan.md:

| Attribute | Low | Medium | High |
|---|---|---|---|
| `dprCap` | 1.0 ✓ | 1.5 ✓ | 2.0 ✓ |
| `antiAliasing` | off ✓ | off ✓ | msaa4x ✓ |
| `shadows.enabled` / `mapSize` / `soft` | false / 0 / false ✓ | true / 512 / false ✓ | true / 1024 / true ✓ |
| `envMap.mode` / `resolution` | none / null ✓ | baked / **256** ✓ | preset / null ✓ |
| `pbr` | lambert ✓ | pbr-no-env ✓ | pbr-env ✓ |
| `cardAtlasResolution` | 1024 ✓ | 2048 ✓ | 2048 ✓ |
| `chipCap` | 10 ✓ | 15 ✓ | 20 ✓ |
| `showdownGlow` | off ✓ | on ✓ | on ✓ |
| `seatPulse` | on ✓ | on ✓ | on ✓ |
| `cinematicAutoOrbit` | off ✓ | on ✓ | on ✓ |

Cycle 38 M-1 is closed at the canonical-data layer.

### 3. `manualOverride` semantics (user pick vs auto-degrade)

**PASS.** plan.md §"State Shape" defines `setTier` and `setManualOverride` as independent actions, and the auto-degrade pseudocode in §"Quality Tiers" reads:
```ts
if (avg < 30 && !store.manualOverride) { store.setTier(nextLower(store.tier)); ... }
```
Observe: the pseudocode **reads** `manualOverride` but never writes it from `setTier`. The implementation mirrors this exactly — `setTier` touches only `qualityTier`, `setManualOverride` touches only `manualOverride`. The dedicated test "setTier does NOT auto-flip manualOverride" pins this behavior from both directions (setting `false→setTier→false`, `true→setTier→true`).

This keeps auto-degrade (T-028) and user-initiated picks (future settings panel, AC-4) on disjoint write paths, which is the exact property plan.md relies on. The UI layer — when it lands — is responsible for calling `setManualOverride(true)` alongside a user-initiated `setTier(...)`; this is idiomatic for Zustand and matches the theme-slice composition pattern.

### 4. Persistence (localStorage roundtrip)

**PASS.** `partialize` now returns `{ theme, qualityTier, manualOverride }`. Two dedicated tests:
- "persists qualityTier and manualOverride" — sets values, reads them back from `localStorage.getItem(TABLE_STORE_PERSIST_KEY)`.
- "partialize whitelist: ONLY theme, qualityTier, manualOverride are persisted" — does an allowlist-shape check via `Object.keys(parsed.state).sort()`, confirming no accidental inclusion of `replay` and no drift if new slices land later. This is the whitelist-shape test that the Cycle 33 review flagged as missing for T-015 (`tasks.md` line 1923-1924: *"add a whitelist-shape test during T-027 that asserts the partialize output structure."*) — **now satisfied**.

`persist` version remains `1`; no migration necessary because adding optional keys is backward-compatible (zustand merges persisted partial over the initial state, so pre-T-027 persisted payloads simply pick up the fresh `qualityTier` / `manualOverride` from the initializer).

### 5. No regression to theme slice or other consumers

**PASS.**
- Full suite: **1909/1909** passing (up from 1890/1890).
- Existing `tableStore.test.ts` (7 tests) + `tableStore.replay.test.ts` (8 tests): all green, no modification needed.
- `scenes3d/index.ts` additions are additive — no renamed or removed exports.
- Consumer files `PokerTable.tsx` / `Table.tsx` unchanged (verified per user contract).

---

## Findings

### CRITICAL — 0

_None._

### HIGH — 0

_None._

### MEDIUM — 1

#### M-1 — T-027 AC-4 (settings-panel tier dropdown) deferred with no open carrier

- **Location:** `specs/table-3d-revamp-010/tasks.md` T-027 AC-4.
- **Observation:** AC-4 requires a tier dropdown in the settings panel; the only existing `TableSettingsPanel.tsx` handles theme + card back. The user's T-027 scope explicitly bounded the cycle to slice + mapping, so the deferral is expected — but there is currently no beads task covering the UI surface. `aia-core-t4dp` covers wiring into the dealer route; `aia-core-cas4` (T-028) covers the FPS monitor. Neither owns the dropdown.
- **Why it matters:** AC-4 can silently fall through the Jean → Logan → Hank seam because the slice is landed and looks "done" from the outside.
- **Suggested follow-up:** Route to **tasks.md carry-forward ledger** per the Anna contract — no beads filing required from a review-only pass. Jean should decide whether AC-4 rolls into `TableSettingsPanel` extension (part of T-015's panel) or into a new "quality settings" sub-task during T-028 work.
- **Severity rationale:** MEDIUM, not HIGH — the scope limitation was explicit, no functional gap in code shipped, and the slice works correctly without the UI.

### LOW — 2

#### L-1 — `QUALITY_TIER_SETTINGS` is `Readonly<Record<...>>` but nested objects aren't deep-frozen

- **Location:** [frontend/src/scenes3d/state/qualitySettings.ts](frontend/src/scenes3d/state/qualitySettings.ts)
- **Note:** TypeScript's `Readonly<Record<QualityTier, QualityTierSettings>>` only freezes the top-level map. A consumer could still write `QUALITY_TIER_SETTINGS.low.shadows.enabled = true` at runtime without a type error if they first cast. This is idiomatic TS and matches `FELT_COLORS` / `CARD_BACKS` in the same store, so no hard need to fix — but a `DeepReadonly<T>` helper or a runtime `Object.freeze` pass would harden the canonical data against accidental mutation now that multiple future consumers (T-028 auto-degrade, T-038 tier gating, t4dp prop wiring) will read this table.
- **Suggested fix:** none required; optional `structuredClone` at read sites or a `Object.freeze` recursive helper if drift becomes a worry.

#### L-2 — `PokerTable.tsx` / `Card.tsx` / `CardAtlas.ts` still read inline `qualityTier`-derived literals instead of `QUALITY_TIER_SETTINGS`

- **Location:** [frontend/src/scenes3d/PokerTable.tsx](frontend/src/scenes3d/PokerTable.tsx#L485-L497), [frontend/src/scenes3d/components/CardAtlas.ts](frontend/src/scenes3d/components/CardAtlas.ts#L119)
- **Note:** T-014 shipped inline values (env-map `resolution={64}`/`256`, `castShadow={tier === 'high'}`) that now diverge from the canonical `QUALITY_TIER_SETTINGS.medium.envMap.resolution = 256` this cycle introduced. The user's T-027 contract explicitly said "**Do not modify T-014's inline default**" — migration is scoped to T-038 + t4dp. Flagging so Anna and Jean see the open seam in carry-forward.
- **Suggested follow-up:** Track in tasks.md carry-forward ledger; T-038 (or its successor) should (a) rewrite `PokerTable.tsx` env-map / light gating to read from `QUALITY_TIER_SETTINGS`, (b) relax the `PokerTable.test.tsx` `resolution ≤ 128` assertion to `≤ 256` (which was the Cycle-38-M-1 suggested fix), (c) enable `<Canvas shadows>` gated by tier (Cycle 38 M-2 follow-up).

---

## Anna-Parseable Summary

```
CYCLE: 39
TARGET: aia-core-y39z
JEAN_TASK: T-027
ACS_COVERED: AC-1, AC-2, AC-3
ACS_DEFERRED: AC-4
TESTS_ADDED: 19
TEST_FILES_ADDED: 2
FULL_SUITE: 1909/1909
LINT_DELTA: 0
CRITICAL: 0
HIGH: 0
MEDIUM: 1
LOW: 2
CYCLE_38_M1_TRANSITIVELY_CLOSED: true
BEADS_FILINGS_THIS_CYCLE: 0
```

Findings routed to `tasks.md` carry-forward ledger per Anna contract (all MEDIUM / LOW, none block close).

---

## Recommended Close Reason (for Anna)

> T-027 implemented — `qualityTier` + `manualOverride` slice added to `useTableStore` with `setTier` / `setManualOverride` actions per plan.md § "State Shape (Zustand Slices)"; canonical tier mapping landed in `frontend/src/scenes3d/state/qualitySettings.ts` with all 10 attributes × 3 tiers matching plan.md § "Quality Tiers & Performance Budget" exactly (closes Cycle 38 M-1 at the canonical-data layer). Persist envelope widened via `partialize` to include both new keys; whitelist-shape test satisfies the Cycle-33 carry-forward ask. AC-1 / AC-2 / AC-3 covered by 19 new tests across 2 files; AC-4 (settings-panel dropdown) deferred per scope contract. Full suite 1909/1909 green (up from 1890); lint delta 0 on touched files. Cycle 39 Scott review: 0 CRIT / 0 HIGH / 1 MED (M-1 AC-4 carry-forward) / 2 LOW (L-1 nested readonly, L-2 PokerTable/CardAtlas inline-literal migration — explicitly deferred to T-038 / `aia-core-t4dp` per user contract). No beads filings this cycle. Review: docs/agent/reviews/cycle-39-aia-core-y39z-2026-04-21.md. **Unblocks:** `aia-core-t4dp` (H-1(b) qualityTier wiring) and `aia-core-cas4` (T-028 FPS monitor).
