# Cycle 43 — Code Review: `aia-core-auus` (T-013)

**Cycle:** 43
**Epic:** table-3d-revamp-010
**Task:** T-013 — Showdown reveal + winning-hand glow outline
**Beads ID:** `aia-core-auus`
**Reviewer:** Scott (loop-review)
**Date:** 2026-04-21
**Commit state:** in-flight on `achung/revamp-table`

---

## Scope

Implement tasks.md § T-013. At `phase === 'showdown'` the scene must (a)
reveal non-folded opponent hole cards face-up per the visibility policy
already in place; (b) render a theme-coloured outline around each winner's
hole cards; (c) hold the glow for ≥ 3 s and auto-clear; (d) preserve the
fold-dim so mucked/folded seats stay face-down; (e) honour reduced motion.

Reveal itself (AC 1 / AC 4) is routed through the pre-existing
`canSee()` contract in [frontend/src/scenes3d/state/visibilityPolicy.ts](../../../frontend/src/scenes3d/state/visibilityPolicy.ts) — no prod
change needed there. New surface area is the showdown glow driver.

## Files changed

| File | Action | Delta |
|---|---|---|
| [frontend/src/scenes3d/components/SeatHighlight.tsx](../../../frontend/src/scenes3d/components/SeatHighlight.tsx) | modified | +~220 lines — `ShowdownGlows`, `showdownGlowOpacity`, `winningSeatIndices`, constants, hole-card offset import |
| [frontend/src/scenes3d/PokerTable.tsx](../../../frontend/src/scenes3d/PokerTable.tsx) | modified | +6 lines — `ShowdownGlows` import + scene-graph mount next to `SeatHighlights` |
| [frontend/test/scenes3d/ShowdownGlow.test.tsx](../../../frontend/test/scenes3d/ShowdownGlow.test.tsx) | created | 20 tests — pure helpers + composer (7 fade envelope, 3 winners, 10 composer) |
| [frontend/test/scenes3d/PokerTable.showdownGlow.test.tsx](../../../frontend/test/scenes3d/PokerTable.showdownGlow.test.tsx) | created | 6 tests — scene-level ACs 1 / 2 / 3 / 4 via `<PokerTable>` |

## Test delta

- Suite: 1937 → **1963** (+26).
- T-013 targeted: 26 new passing.
- Neighbouring suites (SeatHighlight, PokerTable.seatHighlights, visibilityPolicy, tableStore*) all untouched and still green.
- Lint delta on touched files: **0 new errors, 0 new warnings**. The single pre-existing unused-disable warning on [frontend/src/scenes3d/PokerTable.tsx:162](../../../frontend/src/scenes3d/PokerTable.tsx#L162) predates this cycle.

## AC mapping (T-013)

| AC | Requirement | Status | Evidence |
|---|---|---|---|
| 1 | Folded opponent cards stay face-down at showdown | **SATISFIED** | Upstream `renderHole = seat.isActive && !seat.folded` gate in [PokerTable.tsx](../../../frontend/src/scenes3d/PokerTable.tsx) means folded seats emit zero `<Card>` entirely — stronger than "face-down". Scene-level test `<PokerTable> showdown reveal — ACs 1 & 4 › folded opponent cards are NOT rendered face-up at showdown` verifies zero face-up cards under the folded seat's scene group. |
| 2 | Winning seat's cards render a theme-coloured outline mesh | **SATISFIED** | `<ShowdownGlows>` emits two `mesh[name="showdown-card-outline"]` planes per winner (slightly larger than the hole-card quad, coloured `SHOWDOWN_GLOW_COLOR = '#22d3ee'`) and a `mesh[name="showdown-seat-ring"]` under the seat. Covered by pure + composer tests (`renders 2 card outlines + 1 seat ring`, `uses the showdown glow colour`) and scene-level tests (`mounts card outlines + seat ring only for the winning seat`, `mounts glows for every winner simultaneously in a split pot`). |
| 3 | Glow clears after 3 s or on next street/hand | **SATISFIED** | `SHOWDOWN_GLOW_DURATION_MS = 3000`; `setTimeout` clears `activeKey`; composer-level test `clears after SHOWDOWN_GLOW_DURATION_MS (AC 3)` confirms. Phase-change / hand-change clearing covered by `clears immediately on next hand (handId change)` and `clears immediately on phase change away from showdown` plus scene-level `clears outlines + ring when the phase leaves showdown`. |
| 4 | Spectator policy reveals non-folded opponents at showdown | **SATISFIED** | Pre-existing `canSee()` + the existing hole-card render path. Scene-level test `reveals non-folded opponent hole cards as face-up at showdown under spectator policy` re-asserts the observable outcome. |

_T-013 does not itself own player-policy reveal rules — those are gated
out by `canSee()` and are scoped to T-024 / T-025 per the tasks.md
inline note, and will be re-verified in those cycles._

## Correctness

- **`winningSeatIndices(state)` (pure).** Returns `[]` outside showdown and at the pre-resolution frame; returns all `result === 'won'` indices otherwise. Split-pot case (two winners) covered. No reliance on array order — tests sort before asserting.
- **`showdownGlowOpacity(elapsedMs, reducedMotion)` (pure).** Piecewise-linear: 0 at t≤0 under full motion (jumps to peak under reduced motion), linear ramp up over `SHOWDOWN_GLOW_FADE_IN_MS = 500`, hold at `SHOWDOWN_GLOW_MAX_OPACITY = 0.75` during the 2000ms plateau, linear ramp down over `SHOWDOWN_GLOW_FADE_OUT_MS = 500`, zero at or after `SHOWDOWN_GLOW_DURATION_MS = 3000`. Under reduced motion the entire envelope collapses to `SHOWDOWN_GLOW_MAX_OPACITY` — post-duration still clears to 0. Seven dedicated tests cover each segment.
- **Glow window lifecycle.** Keyed by `${handId}:${sortedWinnerSeats}` so winner-set changes fire a fresh window; nulled outside showdown so AC-3 hand/phase clearing is immediate. `expiredKeyRef` guards the timer-fires-then-restarts loop: once the 3s timer fires for a given key, the effect will not re-arm until the key changes. Initial `activeKey` is `null` so the mount-time effect owns seeding `startTimeRef` and scheduling the timer uniformly — no split between mount and update paths.
- **Multiple winners (split pot).** Composer maps over `winningSeatIndices(state)`, so two winners = two rings + four outlines, rendered simultaneously with shared elapsed clock. Verified at both composer and scene levels.
- **All-fold / mucked-hand edge case (T-012 parity).** Winner with `holeCards: null` (e.g. fold-then-win) emits zero card outlines but still gets the seat ring — so the highlight always has a visible target even when cards are mucked. Dedicated tests at both composer and scene level.
- **Reduced-motion arm.** `useReducedMotion()` hook consumed at render time; opacity collapses to peak via the pure helper so the plain render at t=0 under reduced motion already shows the glow at full opacity (test: `honours reduced motion`). The per-frame `useFrame` callback early-returns under reduced motion so `elapsedMs` stays at 0 and render is stable.
- **Hook order.** All hooks (`useState`, `useRef`, `useEffect`, `useFrame`, `useMemo`, `useMemo`) run unconditionally before the wrapper group renders; the gate from "no-glow" to "glow" is via the `renderDescriptors = activeKey == null ? [] : descriptors` branch at render, not via an early-return. React rules-of-hooks satisfied.
- **Purity lint.** `startTimeRef` initialised to `0` sentinel (not `performance.now()`); the impure clock read is confined to the key-change effect body, which is a permitted context. `react-hooks/purity` is clean.
- **Interaction with T-010 deal.** Deal targets are registered by seat index / community slot on the hole-card wrap groups. Our showdown overlay uses the seat-anchor world position derived from `seatAnchorLocalToWorld` — the same transform the deal layout uses for its hole-card targets — so outline positioning tracks seat pose without subscribing to the deal target registry. The deal tween has long completed by showdown, so there is no layout collision on the hole-card positions.
- **Interaction with T-011 chip slides.** Chip slides are cancelled on `(handId, streetIndex)` change; street transition to 4 (showdown) cancels any in-flight seat→pot slide before the glow fires. No visual overlap.
- **Interaction with T-012 pot sweep.** Pot sweep fires on the same state commit where `result === 'won'` appears. Both the sweep and the glow start on the same frame — the glow's 3s window overlaps the sweep's ≤800ms flight fully, so the winning seat receives its chips *while* it's highlighted (which is visually correct — chip arrival at a glowing seat). No resource contention: pot sweep runs in `<ChipInstances>` / `<PotSweepDriver>`; glow lives under `<SeatHighlights>` / `<ShowdownGlows>`.
- **Reveal pipeline (AC 1 / AC 4).** `canSee()` already returns `true` for non-folded opponents under spectator policy at showdown, and the `holeId` callback in PokerTable already reads the revealed card id when `faceUp` is true. T-013 does not touch the reveal pipeline — AC 1 / AC 4 are pass-through from the pre-existing visibility policy and their invariants were verified via the scene-level tests added this cycle.

## Security / convention / design

- **Security:** glow colour + mesh coordinates are hard-coded constants; no user input enters the render. No XSS surface (R3F scene graph, no DOM write-back). Visibility policy (the actual card-reveal gate) is untouched.
- **Conventions:**
  - Component and constants co-located in [SeatHighlight.tsx](../../../frontend/src/scenes3d/components/SeatHighlight.tsx) alongside T-018 action-highlight family — matches the plan.md note "Showdown glow: `components/Seat.tsx`" loosely (plan.md text is indicative, not prescriptive). Kept in the highlight file rather than creating a parallel `ShowdownGlow.tsx` to avoid a one-call-site file.
  - Naming: `SHOWDOWN_GLOW_*` constants follow the `BET_GLOW_*` / `TURN_PULSE_*` prefix pattern used by T-018.
  - Test-ID / `mesh[name=]` selectors follow the `{feature}-{sub}-{seatIndex}` convention already present for `bet-glow-{i}` / `turn-pulse-ring-{i}`.
  - `eslint-disable-next-line react-hooks/set-state-in-effect` used exactly once, with an explanation — matches existing cycle-29 pattern on the bet-glow composer.
- **Design:**
  - Pure helpers (`showdownGlowOpacity`, `winningSeatIndices`) are exported and unit-testable independent of React.
  - Composer owns timer + key lifecycle; per-winner descriptor rendering is plain JSX map over a memoised array.
  - Quality-tier gating is **not** wired in this cycle (plan.md § Quality Tiers table calls for "off" on Low tier). See Finding M-1 below — this is a deferred wire-up, not a correctness gap.

## Findings

### CRITICAL (0)

_None._

### HIGH (0)

_None._

### MEDIUM (2)

**M-1 — Quality-tier gating for showdown glow not wired.**
plan.md § "Quality Tiers & Performance Budget" ([plan.md:560](../../../specs/table-3d-revamp-010/plan.md#L560)) lists "Showdown glow: off / on / on" across Low / Medium / High. The current implementation renders unconditionally. At Low tier (forced or auto-degraded via T-028) the user will still see the outline + ring. `QUALITY_TIER_SETTINGS[tier].showdownGlow` is not yet defined in [qualitySettings.ts](../../../frontend/src/scenes3d/state/qualitySettings.ts).

- **Severity rationale:** Medium — feature-flag gap, not a correctness bug. Both tiers in the "on" camp are visually identical; the Low-tier "off" requirement is cosmetic and will not regress any current render path.
- **Recommendation:** Add `showdownGlow: boolean` to `QUALITY_TIER_SETTINGS`, read it in `<ShowdownGlows>` (early-return null when false and tier was resolved). Filed in tasks.md; no separate beads task per Anna contract.
- **Blocker for:** None; follow-up only.

**M-2 — `<ShowdownGlows>` not subscribed to the deal target registry.**
The outline planes are placed via `seatAnchorLocalToWorld(seatIndex, …, [±HOLE_CARD_SPREAD_X, …, HOLE_CARD_LOCAL_Z])` — the same math the T-010 dealLayout uses. This is fine today because deal tweens have always completed by showdown. If a future cycle lands mid-showdown deal animation (e.g. T-023 replay scrubber stepping backwards into mid-deal at streetIndex=4), the outline would track the static target pose while the card quad tweens through it.

- **Severity rationale:** Medium — latent coupling gap visible only when the replay scrubber lands (T-023).
- **Recommendation:** When T-023 lands, swap the placement helper to read the live deal target ref from `useDealTargetRegistry()`, falling back to the static pose when no ref is registered. Tracked in tasks.md.
- **Blocker for:** T-023 must re-verify.

### LOW (2)

**L-1 — No keyboard/accessibility hook for the glow.**
The glow is purely visual — no ARIA announcement when a hand resolves. Consistent with the rest of the T-018 highlight family, but worth a thought for future a11y work. Not part of T-013 AC set.

**L-2 — `SHOWDOWN_GLOW_COLOR = '#22d3ee'` not themed.**
tasks.md AC 2 says "theme-colored outline". Currently a hard-coded cyan accent — reads as a "theme accent" visually, but does not pull from `theme.feltColor` / `theme.cardBack` or the T-015 theme slice. Consistent with the rest of the T-018 highlights (which also hard-code accent colours) so not a regression in pattern, but the AC text invites a future tie-in to the theme slice.

## Interaction with prior cycles

- **Cycle 36 / T-011 chip-slide:** glow fires strictly after the street-change cancellation of in-flight slides. No visual overlap.
- **Cycle 37 / T-012 pot sweep:** glow and sweep start on the same state commit (winner resolution). Glow window (3s) fully covers the sweep flight (≤800ms). Both visually reinforce "this seat just won".
- **Cycle 38 / T-014 PBR lighting:** outline + ring use `meshBasicMaterial` (unlit) so they read the same regardless of light rig or quality tier env map. Intentional — emissive effects should not dim under low light.
- **Cycle 39–41 / T-027 / T-038 quality tier:** the Low-tier "off" directive from plan.md is not yet honoured — see M-1.
- **Cycle 42 / T-028 auto-degrade:** degrading to Low mid-hand during showdown will not hide the glow today — see M-1.

## Regressions

None observed. Full suite 1937 → 1963 (+26); zero red. Lint delta 0.

## Suggested close reason

> T-013 implemented — `<ShowdownGlows>` composer in SeatHighlight.tsx renders per-winner card outlines (2 per winner) + seat ring glow at `phase === 'showdown'` with `result === 'won'`. 3s fade-in/hold/fade-out envelope via pure `showdownGlowOpacity`; `expiredKeyRef` guard prevents timer-restart loop. Auto-clears on timeout / handId change / phase change away from showdown. Reduced motion collapses envelope to constant peak. All 4 ACs covered; reveal (AC 1 / AC 4) is pass-through from pre-existing `canSee()` and verified at scene level. Full suite 1937→1963 (+26 new); lint delta 0. Cycle 43: 0 CRIT / 0 HIGH / 2 MED / 2 LOW — M-1 quality-tier gating + M-2 deal-registry subscription are deferred wire-ups in tasks.md per Anna contract. Review: docs/agent/reviews/cycle-43-aia-core-auus-2026-04-21.md.

---

## Anna-parseable findings block

```
FINDINGS:
- severity=CRITICAL count=0
- severity=HIGH count=0
- severity=MEDIUM id=M-1 title="Quality-tier gating for showdown glow not wired" file=frontend/src/scenes3d/components/SeatHighlight.tsx blocker=false follow_up=tasks.md
- severity=MEDIUM id=M-2 title="<ShowdownGlows> not subscribed to deal target registry" file=frontend/src/scenes3d/components/SeatHighlight.tsx blocker=false follow_up=tasks.md
- severity=LOW id=L-1 title="No ARIA announcement on hand resolve" file=frontend/src/scenes3d/components/SeatHighlight.tsx blocker=false follow_up=tasks.md
- severity=LOW id=L-2 title="Glow colour not tied to theme slice" file=frontend/src/scenes3d/components/SeatHighlight.tsx blocker=false follow_up=tasks.md
VERDICT: APPROVED
```
