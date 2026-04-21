# Code Review — Cycle 38 — aia-core-z6w8 (T-014 PBR table materials, lighting, and env map)

**Reviewer:** Scott (Cyclops)
**Date:** 2026-04-21
**Epic:** table-3d-revamp-010
**Cycle:** 38
**Target beads:** aia-core-z6w8
**Jean task:** T-014

---

## Scope

Implementation under review:

| File | Change |
|---|---|
| [frontend/src/scenes3d/components/Table.tsx](frontend/src/scenes3d/components/Table.tsx) | Upgraded to PBR felt + rail materials; accepts `qualityTier` prop; felt has normal + roughness maps, rail has coarse normal map + lower roughness + slight metalness. |
| [frontend/src/scenes3d/components/tableMaterials.ts](frontend/src/scenes3d/components/tableMaterials.ts) | New module — lazy, cached procedural `DataTexture` factory for felt normal, felt roughness, rail normal. Zero bundle-asset footprint. Exposes `__resetTableMaterialTexturesForTest` hook. |
| [frontend/src/scenes3d/PokerTable.tsx](frontend/src/scenes3d/PokerTable.tsx) | Adds drei `<Environment>` (gated by `qualityTier`), a named `<directionalLight name="key-light">` with `castShadow` enabled at high tier only, and forwards `qualityTier` to `<Table>`. |
| [frontend/test/scenes3d/Table.test.tsx](frontend/test/scenes3d/Table.test.tsx) | New — PBR material structural tests + theme forwarding + tier-gated normal/roughness map tests. |
| [frontend/test/scenes3d/tableMaterials.test.ts](frontend/test/scenes3d/tableMaterials.test.ts) | New — DataTexture construction, caching, reset hook, deterministic pixel payload. |
| [frontend/test/scenes3d/PokerTable.test.tsx](frontend/test/scenes3d/PokerTable.test.tsx) | Extended drei mock with `<Environment>` shim; new "T-014 PBR lighting + env map" describe block (7 tests). |
| [frontend/test/scenes3d/EquityBadge.test.tsx](frontend/test/scenes3d/EquityBadge.test.tsx), [PokerTable.playerMode.test.tsx](frontend/test/scenes3d/PokerTable.playerMode.test.tsx), [PokerTable.potSweep.test.tsx](frontend/test/scenes3d/PokerTable.potSweep.test.tsx), [PokerTable.seatHighlights.test.tsx](frontend/test/scenes3d/PokerTable.seatHighlights.test.tsx) | drei mocks extended with `Environment` passthrough (no semantic change). |

---

## AC Coverage

| AC | Requirement | Status | Evidence |
|---|---|---|---|
| **AC-1** | Felt surface has a normal + roughness map and responds to light direction. | **COVERED** | `Table.test.tsx` → "AC-1: felt material receives both a normalMap and roughnessMap on medium/high tier" asserts both map attributes attach on medium. `PokerTable.test.tsx` → "renders the key directional light" confirms a directional light is present in the scene graph. |
| **AC-2** | Rail is visually distinct from the felt. | **COVERED** | `Table.test.tsx` → "AC-2: rail material is visually distinct from felt" compares `color`, `roughness`, `metalness` attributes — all differ (rail 0.55 / felt 0.92 roughness; rail 0.1 / felt 0.0 metalness; distinct default colors; distinct normal maps). |
| **AC-3** | Total added asset weight ≤ 500KB gzipped. | **COVERED (by construction)** | `tableMaterials.ts` builds textures as `DataTexture` at runtime from a deterministic hash — **zero** new bundled asset bytes. Documented in module header. No new drei preset HDRIs shipped; drei ships its own built-in `preset` maps (already installed). |
| **AC-4** | Medium quality: shadows disabled, env map low-res. | **COVERED** | `PokerTable.test.tsx` → "qualityTier='medium' attaches a low-resolution env map" asserts `resolution ≤ 128`; "qualityTier='medium' the key light omits shadow-map sizing" asserts `shadow-mapSize-*` attrs absent. "qualityTier='low' omits the env map entirely" verifies the low-tier path. "qualityTier='high' upgrades env map resolution above medium" + "enables castShadow" verify the Medium→High delta. |

---

## Test Deltas

| | Before | After | Delta |
|---|---|---|---|
| Total test files | 117 | 121 | +4 |
| Total tests | 1872 | 1890 | +18 |
| Failures | 0 | 0 | 0 |
| Lint errors | 8 (pre-existing) | 8 | 0 |
| Lint warnings | 7 (pre-existing) | 7 | 0 |

(Pre-existing lint issues: `src/pages/HeadToHeadPage.tsx`, `src/player/PlayerApp.tsx`, `src/views/DataView.tsx`, `src/views/PlaybackView.tsx`. None touched by T-014.)

---

## Findings

### CRITICAL — 0

_None._

### HIGH — 0

_None._

### MEDIUM — 2

#### M-1 — Env-map resolutions drift below plan.md § "Quality Tiers & Performance Budget"

- **Location:** [frontend/src/scenes3d/PokerTable.tsx](frontend/src/scenes3d/PokerTable.tsx#L486)
- **Plan contract:** plan.md calls for **"256² baked"** on Medium and **"drei `<Environment>` preset"** on High.
- **Implementation:** Medium → `resolution={64}`, High → `resolution={256}`. Medium is 4× smaller than plan, and High matches what plan reserves for Medium.
- **Why it matters:** T-027 (Zustand quality-tier slice) and T-038 (tier gating of every visual feature) will read these as the canonical per-tier settings. Shipping tighter values now means a downstream caller wanting the plan's "256² baked" look on Medium has to re-tune this file — defeating the whole reason tier settings were hoisted into plan.md.
- **Suggested fix:** Medium → `resolution={256}`; High → drei preset without an explicit `resolution` override (drei defaults to 256 for preset-backed environments; use `preset="studio"` as already chosen). Relax the `≤ 128` test assertion to `≤ 256` to match plan.
- **Severity rationale:** Functional behavior is still correct (both tiers are low-res relative to a real HDRI), but the numeric values will confuse T-027/T-038 work and the passing test locks in the drift.

#### M-2 — Renderer shadow-map is not enabled, so `castShadow` at High tier is a dead signal today

- **Location:** [frontend/src/scenes3d/PokerCanvas.tsx](frontend/src/scenes3d/PokerCanvas.tsx) — no `shadows` prop on `<Canvas>`. New key light in [PokerTable.tsx](frontend/src/scenes3d/PokerTable.tsx) sets `castShadow={qualityTier === 'high'}`.
- **Issue:** Three.js requires `renderer.shadowMap.enabled = true` (or R3F's `<Canvas shadows>`) for any `castShadow` flag to produce visible shadows. Without that, AC-1's "responds to light direction" still works (diffuse shading is independent of shadow casting), but the AC-4 "shadows disabled on Medium" guarantee passes **trivially** — shadows never render in any tier.
- **Why it's MEDIUM and not HIGH:** T-014 explicitly scopes env + lighting wiring; canvas-level renderer config was never said to belong here, and plan.md § "Project Phases" places canvas-shadow enablement under quality-tier rollout (T-027 / T-038). The unit tests assert the *intent* (shadow-map props only emitted at High) which is still verifiable.
- **Suggested follow-up:** Track as a beads issue discovered-from `aia-core-z6w8`, owned by T-038. Title: "Enable `<Canvas shadows>` when qualityTier === 'high' so AC-4 shadow gating has runtime effect."
- **No regression introduced:** existing visual behavior is unchanged; the key light runs identically to the existing `<directionalLight>` in PokerCanvas, just at the scene level.

### LOW — 2

#### L-1 — `<Environment background={false}>` is drei's default; explicit prop is redundant

- **Location:** [PokerTable.tsx](frontend/src/scenes3d/PokerTable.tsx#L488)
- **Note:** drei's `<Environment>` defaults to `background={false}`. The explicit pass is harmless and makes intent readable, but it's not load-bearing. Cosmetic.

#### L-2 — `getTableMaterialTextures()` is called inline in `<Table>`'s render body without a `useMemo`

- **Location:** [Table.tsx](frontend/src/scenes3d/components/Table.tsx)
- **Note:** The module-level cache makes every call after the first an O(1) pointer read, so there is no performance hit. But future maintainers may assume a `useMemo` / `useRef` is required for renderer handles and introduce one. Either add a one-line `useMemo(() => getTableMaterialTextures(), [])` guard for consistency with other `scenes3d/components/` modules, or add an inline `// cached at module scope` comment at the call site. Cosmetic.

---

## Convention Check

- **Declarative R3F patterns:** ✓ — composition over imperative three.js.
- **Naming:** ✓ — `felt-pbr` / `rail-pbr` / `key-light` follow the existing `table-felt` / `table-rail` / `seat-N` naming scheme.
- **ESLint pragmas:** ✓ — reuses existing `/* eslint-disable react/no-unknown-property */` block.
- **Test isolation:** ✓ — `__resetTableMaterialTexturesForTest()` disposes GPU handles between tests.
- **Drei mock contract:** ✓ — `Environment` added to every test file that mocks drei and mounts `<PokerTable>`.

## Security / Correctness

- No user input paths touched; no network / crypto / auth surface.
- Procedural hash uses `Math.sin` — deterministic, no RNG leak, no timing oracle.
- `DataTexture` pixel buffer sized exactly `size*size*4`; no OOB writes (verified by visual inspection of loop bounds).
- No changes to camera clamps, visibility policy (`canSee`), equity gating, or player-mode hard-forcing. Confirmed by passing `playerMode`, `EquityBadge`, `potSweep`, `seatHighlights` suites without any semantic mock changes.

## Regression Surface

| Area | Affected? | Evidence |
|---|---|---|
| Camera presets / player lock | No | `PokerTable.playerMode.test.tsx` passes unchanged |
| Chip-slide / pot-sweep | No | `PokerTable.potSweep.test.tsx` passes unchanged |
| Theme slice | No | `theme.feltColor` / `theme.railColor` still forwarded; existing "forwards theme.feltColor" test passes |
| Animation engine | No | `useReducedMotion`, `cameraPresets`, `tweens` tests unchanged |
| Equity overlay | No | `EquityBadge.test.tsx` passes after mock-extension only |

---

## Findings Block (Anna-parseable)

```
CRITICAL: 0
HIGH: 0
MEDIUM: 2
LOW: 2
```

## Suggested Close Reason

> T-014 implemented: PBR felt + rail materials via procedural `DataTexture` (0 bytes added assets), key `<directionalLight name="key-light">` with shadow-map sizing gated to qualityTier='high', drei `<Environment>` gated to qualityTier !== 'low'. All 4 ACs covered by 18 new tests across 3 files; full suite 1890/1890 green; lint delta clean. Cycle 38 review: 0 CRIT / 0 HIGH / 2 MED / 2 LOW — M-1 (env-map resolution drift vs plan.md) and M-2 (canvas-level shadow-map enablement deferred to T-038) flagged as non-blocking follow-ups per feature-delivery contract.
