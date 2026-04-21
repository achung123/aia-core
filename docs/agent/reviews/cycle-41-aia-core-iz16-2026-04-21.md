# Cycle 41 — Code Review: `aia-core-iz16` (T-038)

**Cycle:** 41
**Epic:** table-3d-revamp-010
**Task:** T-038 — Tier gating cleanup + settings-panel tier dropdown
**Beads ID:** `aia-core-iz16`
**Reviewer:** Scott (loop-review)
**Date:** 2026-04-21
**Commit state:** in-flight on `achung/revamp-table`

---

## Scope

Three consolidated cleanup items against the tier-gating subsystem landed in T-014 / T-027 / T-030:

1. **Item 1 — Canvas-level shadow enablement** (Cycle 38 M-2)
2. **Item 2 — Inline tier-literal migration** (Cycle 39 L-2)
3. **Item 3 — Settings-panel tier dropdown** (Cycle 39 M-1 / T-027 AC-4)

## Files changed

| File | Action | Delta |
|---|---|---|
| [frontend/src/scenes3d/PokerCanvas.tsx](../../../frontend/src/scenes3d/PokerCanvas.tsx) | modified | reads `qualityTier` from `useTableStore`; spreads `shadows: true` only when tier === `'high'` |
| [frontend/src/scenes3d/PokerTable.tsx](../../../frontend/src/scenes3d/PokerTable.tsx) | modified | `<Environment>` gate + resolution sourced from `QUALITY_TIER_SETTINGS`; key-light `shadow-mapSize-*` reads from `settings.high.shadows.mapSize` |
| [frontend/src/scenes3d/components/Table.tsx](../../../frontend/src/scenes3d/components/Table.tsx) | modified | `mapsEnabled` now derives from `QUALITY_TIER_SETTINGS[tier].pbr !== 'lambert'` |
| [frontend/src/scenes3d/components/CardAtlas.ts](../../../frontend/src/scenes3d/components/CardAtlas.ts) | modified | `getAtlasSize` returns `QUALITY_TIER_SETTINGS[tier].cardAtlasResolution` |
| [frontend/src/scenes3d/components/TableSettingsPanel.tsx](../../../frontend/src/scenes3d/components/TableSettingsPanel.tsx) | modified | Tier radiogroup (`low`/`medium`/`high`) → `setTier` + `setManualOverride(true)` |
| [frontend/test/scenes3d/PokerCanvas.test.tsx](../../../frontend/test/scenes3d/PokerCanvas.test.tsx) | modified | +3 shadow-gating tests |
| [frontend/test/scenes3d/PokerTable.test.tsx](../../../frontend/test/scenes3d/PokerTable.test.tsx) | modified | Two drift-locked assertions retired, pinned to `QUALITY_TIER_SETTINGS.medium.envMap.resolution` + `.high.envMap.resolution === null` |
| [frontend/test/scenes3d/CardAtlas.test.ts](../../../frontend/test/scenes3d/CardAtlas.test.ts) | modified | +1 canonical-read test |
| [frontend/test/scenes3d/TableSettingsPanel.test.tsx](../../../frontend/test/scenes3d/TableSettingsPanel.test.tsx) | modified | +5 tier-dropdown tests |

## Test delta

- Suite: 1909 → 1921 (**+12**).
- Lint delta: **0** (5 pre-existing warnings/errors unchanged).
- All T-014, T-027, T-030 (theme/`aia-core-21ed`), and persistence suites stay green.

## Acceptance-criteria mapping

| AC | Status | Evidence |
|---|---|---|
| AC-1 — `<Canvas shadows>` conditional on `qualityTier === 'high'` | **SATISFIED** | [PokerCanvas.tsx](../../../frontend/src/scenes3d/PokerCanvas.tsx) line 39 (`const shadowsEnabled = qualityTier === 'high';`) spreads `shadows: true` via `{...(shadowsEnabled ? { shadows: true } : {})}`. Pinned by three new tests in [PokerCanvas.test.tsx](../../../frontend/test/scenes3d/PokerCanvas.test.tsx) (`enables <Canvas shadows> when ... 'high'`, `omits shadows prop when ... 'medium'`, `... 'low'`). Together with the existing T-014 `castShadow={qualityTier === 'high'}` and `shadow-mapSize-*` emission, the renderer now actually allocates a shadow-map framebuffer at High — intent became runtime effect. T-014 AC-4's "shadows disabled on Medium" observable (no `shadow-mapSize-width` attribute) remains pinned in [PokerTable.test.tsx](../../../frontend/test/scenes3d/PokerTable.test.tsx). |
| AC-2 — No inline tier-derived literals in `PokerTable.tsx` / `CardAtlas.ts` | **SATISFIED** | `<Environment resolution={...}>` now reads `QUALITY_TIER_SETTINGS[qualityTier].envMap.resolution` with conditional spread to honour the `null` (preset default) case on High. `getAtlasSize` returns `QUALITY_TIER_SETTINGS[tier].cardAtlasResolution`. Shadow-map dimensions read `QUALITY_TIER_SETTINGS.high.shadows.mapSize`. The env-map presence gate uses `settings.envMap.mode !== 'none'` in place of `qualityTier !== 'low'`. `Table.tsx` `mapsEnabled` now derives from `settings.pbr !== 'lambert'`. Cycle 38 M-1 (Medium 64→256 drift) closed at the call site; runtime scene now ships plan-correct values. |
| AC-3 — `TableSettingsPanel` tier dropdown drives `setTier` + `setManualOverride(true)`; T-027 AC-4 SATISFIED | **SATISFIED** | [TableSettingsPanel.tsx](../../../frontend/src/scenes3d/components/TableSettingsPanel.tsx) `handleTierSelect` calls both actions on every click; radiogroup uses `QUALITY_TIER_NAMES` and follows the existing felt/card-back/mode pattern (aria-pressed, 44×44pt tap targets, test-ids). Pinned by five new tests in [TableSettingsPanel.test.tsx](../../../frontend/test/scenes3d/TableSettingsPanel.test.tsx). T-027 AC-4 now has a landed carrier. |
| AC-4 — Full frontend suite passes | **SATISFIED** | `npx vitest run` → 1921 / 1921 green across 123 files. |

## Correctness review

- **Item 1:** Conditional spread `{...(shadowsEnabled ? { shadows: true } : {})}` is idiomatic — R3F reads `shadows` as an optional boolean/object on first render and consults `renderer.shadowMap.enabled`, so omitting the prop leaves it at Three.js's default `false`. No regression on the medium/low path.
- **Item 2:** Every tier-derived numeric or string that appears in `qualitySettings.ts` now flows from that module at the call site. The conditional-spread on `resolution` correctly distinguishes `null` (drei preset default) from a numeric value, which is the observable behaviour plan.md specifies for High (preset-backed, no explicit override).
- **Item 3:** `setTier` + `setManualOverride(true)` are both called on the same click tick; Zustand batches the two `set()` invocations into separate notifications but both land synchronously before the next render. No risk of observing an intermediate state.

## Security review

Pure render-layer + client state. No new network, IPC, or persistence surface. The tier dropdown writes to the existing persist envelope (`aia-table-3d` localStorage key) which is unchanged by this cycle.

## Convention review

- `TableSettingsPanel` tier group mirrors the existing felt/card-back/mode radiogroup pattern byte-for-byte (legend + `radiogroup` + button array + `data-testid` + `data-active` + aria-pressed + 44pt tap targets). Consistent with T-015.
- All tier reads centralise on `QUALITY_TIER_SETTINGS` — the canonical source of truth per T-027.
- Test mocks (`data-resolution`, `data-preset`, `data-background`) remain stable across [PokerTable.test.tsx](../../../frontend/test/scenes3d/PokerTable.test.tsx), [PokerTable.seatHighlights.test.tsx](../../../frontend/test/scenes3d/PokerTable.seatHighlights.test.tsx), and [PokerTable.playerMode.test.tsx](../../../frontend/test/scenes3d/PokerTable.playerMode.test.tsx).

## Design review

The `qualityTier === 'high'` predicate appears in three places now: `PokerCanvas.tsx` (canvas shadows), `PokerTable.tsx` (key-light castShadow + shadow-map emission), and `PokerTable.tsx` (env preset selection). These are intentional divergence from the canonical `settings.shadows.enabled` (which is `true` for Medium per plan.md) — T-014 chose a more conservative "shadows only on High" runtime, and the task constraint "Do NOT change tier values" keeps that. The divergence is acknowledged in the Cycle 38 M-2 carry-forward text and the task spec; no new finding.

## Findings

### [MEDIUM] M-1 — `<Environment preset>` name still tier-literal on PokerTable call site
- **File:** [frontend/src/scenes3d/PokerTable.tsx](../../../frontend/src/scenes3d/PokerTable.tsx) line 491
- **Category:** design / data-locality
- **Description:** `preset={qualityTier === 'high' ? 'studio' : 'apartment'}` remains an inline tier → drei-preset-name literal. `QUALITY_TIER_SETTINGS[tier].envMap.mode` carries `'baked' | 'preset'` but does NOT carry the specific preset name, so the mapping `high → 'studio'`, `medium → 'apartment'` is invisible to downstream callers (e.g. a future T-027 consumer or the auto-degrade hook). Not flagged in the original Cycle 39 L-2 (which targeted `resolution` only), so strictly outside this cycle's scope, but it is the last tier-derived literal on this call site and the natural cluster-point for "every tier value flows from qualitySettings."
- **Recommended fix:** Extend `EnvMapSettings` to include an optional `presetName?: 'studio' | 'apartment' | 'city' | ...`; have `PokerTable.tsx` read it; update plan.md § Quality Tiers to encode the drei preset name. Defer to the next `qualitySettings` touch. **No action this cycle** per Anna contract.

### [MEDIUM] M-2 — `castShadow` / shadow-map emission still tier-literal (canonical says Medium shadows-on)
- **File:** [frontend/src/scenes3d/PokerTable.tsx](../../../frontend/src/scenes3d/PokerTable.tsx) lines 505–513
- **Category:** canonical-vs-runtime divergence
- **Description:** `QUALITY_TIER_SETTINGS.medium.shadows.enabled === true` (512² map) per plan.md, but `PokerTable.tsx` emits shadow-map props only at `qualityTier === 'high'`. T-014 chose this more conservative runtime and the current test suite (`PokerTable.test.tsx` AC-4 medium-shadows-off) pins it. Task contract says "Do NOT change tier values" so this cycle preserves the divergence — but the inline `qualityTier === 'high'` predicate is now the only remaining tier literal driving a behaviour that diverges from `qualitySettings`. Future readers will expect `settings.shadows.enabled` to be the single source of truth and miss that Medium's canonical-true value is ignored.
- **Recommended fix:** Either (a) update the runtime to honour `settings.shadows.enabled` and relax the T-014 medium-shadows-off test to match canonical plan.md, or (b) update plan.md + `qualitySettings.ts` to reflect the implementation choice (Medium shadows-off). Requires a Jean triage pass — this is a plan-vs-implementation alignment decision, not a pure cleanup. **No action this cycle** per Anna contract.

### [LOW] L-1 — Unused eslint-disable directive in PokerCanvas.test.tsx
- **File:** [frontend/test/scenes3d/PokerCanvas.test.tsx](../../../frontend/test/scenes3d/PokerCanvas.test.tsx) line 21
- **Category:** style
- **Description:** Pre-existing `/* eslint-disable no-console */` (or similar) reported as unused. Not introduced this cycle.
- **Recommended fix:** Drop the directive when next touching the file.

### [LOW] L-2 — `handleTierSelect` could memoize per-tier callbacks
- **File:** [frontend/src/scenes3d/components/TableSettingsPanel.tsx](../../../frontend/src/scenes3d/components/TableSettingsPanel.tsx) line ~48
- **Category:** micro-perf
- **Description:** `onClick={() => handleTierSelect(tier)}` allocates a new arrow per render per tier button. Harmless at 3 buttons, but the existing felt/mode groups have the same pattern so it is consistent. Flagging for awareness only.
- **Recommended fix:** None — match the existing idiom.

---

## Findings block (Anna-parseable)

```yaml
cycle: 41
task: aia-core-iz16
jean_task: T-038
CRITICAL: 0
HIGH: 0
MEDIUM: 2
LOW: 2
findings:
  - id: M-1
    severity: MEDIUM
    file: frontend/src/scenes3d/PokerTable.tsx
    line: 491
    category: design
    summary: "Environment preset name ('studio'/'apartment') still inline tier-literal; QUALITY_TIER_SETTINGS does not carry preset name yet. Not in original L-2 scope. Defer."
  - id: M-2
    severity: MEDIUM
    file: frontend/src/scenes3d/PokerTable.tsx
    lines: "505-513"
    category: canonical-vs-runtime divergence
    summary: "castShadow + shadow-map emission still gated on inline 'qualityTier === high'; canonical settings.medium.shadows.enabled=true is ignored. Needs Jean triage (update plan OR update runtime + tests). Preserved this cycle per 'do not change tier values' constraint."
  - id: L-1
    severity: LOW
    file: frontend/test/scenes3d/PokerCanvas.test.tsx
    line: 21
    category: style
    summary: "Pre-existing unused eslint-disable directive (not introduced this cycle)."
  - id: L-2
    severity: LOW
    file: frontend/src/scenes3d/components/TableSettingsPanel.tsx
    line: ~48
    category: micro-perf
    summary: "Inline arrow allocation per tier button — matches existing felt/mode pattern; flag only."
decisions:
  - anna_contract: "MED/LOW → tasks.md only, no beads filings this cycle"
  - t014_tests: "unchanged — medium-shadows-off observable still pinned"
  - t027_tests: "unchanged — canonical settings table still pinned"
  - theme_tests: "unchanged — felt/card-back/mode groups unaffected"
  - persistence: "persist envelope unchanged (still {theme, qualityTier, manualOverride})"
unblocks:
  - none_new
```

## Regression check (explicit)

- **T-014 (PBR + env map + key-light):** [PokerTable.test.tsx](../../../frontend/test/scenes3d/PokerTable.test.tsx) AC-4 medium-shadows-off, AC-4 high-castShadow, env-map-omitted-on-low all still green. Two AC-4 env tests were reworked from `res <= 128` and `hiRes > medRes` to canonical `res === QUALITY_TIER_SETTINGS.medium.envMap.resolution (=256)` and `settings.high.envMap.resolution === null` + empty `data-resolution` — **retires the Cycle 38 drift-locked assertions** as the task spec instructed.
- **T-027 (qualityTier slice):** [tableStore.quality.test.ts](../../../frontend/test/scenes3d/tableStore.quality.test.ts) 9/9 green; [qualitySettings.test.ts](../../../frontend/test/scenes3d/qualitySettings.test.ts) 10/10 green. Canonical mapping values unchanged.
- **Theme slice (T-015 / aia-core-21ed):** [TableSettingsPanel.test.tsx](../../../frontend/test/scenes3d/TableSettingsPanel.test.tsx) 15/15 green (10 original + 5 new tier-dropdown).
- **Persistence (T-015 / T-027):** `partialize` whitelist test still green — `{manualOverride, qualityTier, theme}` exactly.
- **Full suite:** 1921 / 1921 green across 123 files.

## Remaining tier literal call sites (verification for AC-2)

Grepped `qualityTier\s*===|qualityTier\s*!==|qualityTier\s*\?` across `frontend/src/scenes3d/**`:

| File | Line | Status |
|---|---|---|
| PokerCanvas.tsx | 39 | **INTENTIONAL** — AC-1 canvas-shadow gate, task requires `=== 'high'` |
| Table.tsx | 24 | prop-type annotation (no logic) |
| PokerTable.tsx | 83 | prop-type annotation (no logic) |
| PokerTable.tsx | 491 | **M-1** — preset name not in canonical mapping |
| PokerTable.tsx | 505–506 | **M-2** — castShadow divergence (intentional per T-014 runtime) |

Original Cycle 39 L-2 scope (`resolution={qualityTier === 'high' ? 256 : 64}` + `getAtlasSize` inline 1024/2048) is fully migrated.

## Suggested close reason for Logan

> T-038 implemented — canvas shadows now runtime-enabled at `qualityTier === 'high'` via `PokerCanvas` → `useTableStore` (closes Cycle 38 M-2); every tier literal flagged in Cycle 39 L-2 migrated to `QUALITY_TIER_SETTINGS` reads (Medium env map=256 drift closed at call site, atlas sizing from `settings.cardAtlasResolution`, shadow-map dims from `settings.high.shadows.mapSize`, Table `mapsEnabled` from `settings.pbr`); `TableSettingsPanel` tier radiogroup wired to `setTier` + `setManualOverride(true)` — T-027 AC-4 now SATISFIED. Suite 1909 → 1921 (+12) green; lint delta 0. Cycle 41 review: 0 CRIT / 0 HIGH / 2 MED / 2 LOW — M-1 (env preset name not canonical) and M-2 (castShadow divergence from canonical Medium=true) are plan-vs-runtime alignment follow-ups requiring Jean triage; recorded in tasks.md per Anna contract, no beads filings this cycle. All three original cleanup items SATISFIED. Review: docs/agent/reviews/cycle-41-aia-core-iz16-2026-04-21.md.
