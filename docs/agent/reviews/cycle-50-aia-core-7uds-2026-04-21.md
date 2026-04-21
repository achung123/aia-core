# Code Review Report — aia-core / table-3d-revamp-010

**Cycle:** 50
**Date:** 2026-04-21
**Target:** `aia-core-7uds` (T-034 — Update `docs/frontend/architecture.md` 3D section)
**Reviewer:** Scott (automated, loop-review)

**Task:** T-034 — Update docs/frontend/architecture.md 3D section to describe the R3F architecture
**Beads ID:** aia-core-7uds
**Epic:** table-3d-revamp-010 (S-7.4)

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 1 |
| LOW | 3 |
| **Total Findings** | **4** |

---

## Files Reviewed

| File | Change | Description |
|---|---|---|
| [docs/frontend/architecture.md](../../../docs/frontend/architecture.md) | modified | TOC, Overview, Tech Stack, Directory tree (`scenes/` → `scenes3d/`, `poker/` removed, `MobilePlaybackView` removed), Routing table + mermaid, flow diagrams, full rewrite of `## 3D Rendering (React Three Fiber)`, rewrite of `## Poker Logic` (evaluator.ts deleted), Mobile Adaptations paragraph, Testing directory counts. 271 lines changed per `git show --stat`. |
| [frontend/README.md](../../../frontend/README.md) | modified | Full rewrite of `## How the 3D Scene Works`. 34 lines changed per `git show --stat`. |
| [frontend/test/scenes3d/tableLayout.test.ts](../../../frontend/test/scenes3d/tableLayout.test.ts) | modified | `it('matches the legacy pokerScene seat layout …')` → `it('matches the canonical <PokerTable> seat layout …')`; sibling comment updated to describe canonical source rather than removed module (Cycle 48 **L-2** resolved). |

Landed in commit `05a42c5` ("feat(table-3d-revamp-010): land 3D table revamp epic") — the concurrent land-session folded the T-034 docs changes into the epic-landing commit. Commit message mentions aia-core-7uds as "still open" but the diff contents for this task are present on HEAD.

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | Section rewritten to reference `scenes3d/` as the source of truth. | SATISFIED | `docs/frontend/architecture.md` L505–617 (`## 3D Rendering (React Three Fiber)`) opens with "All 3D rendering lives in `frontend/src/scenes3d/` …"; directory tree at L127 shows full `scenes3d/` layout (`PokerCanvas`, `PokerTable`, `SessionReplayShell`, `components/`, `animations/`, `data/`, `state/`). | Old `scenes/` tree removed; `poker/evaluator.ts` block removed. |
| 2 | Mentions `@react-three/fiber`, `@react-three/drei`, visibility policy, and quality tiers. | SATISFIED | L507 mentions `@react-three/fiber` + `@react-three/drei`; "Visibility Policy — `canSee()`" subsection documents the pure function + security note; "Quality Tiers & Auto-Degrade" subsection documents `QUALITY_TIER_SETTINGS`, `useFPSMonitor`, `<QualityToast>`, `<TableSettingsPanel>`. | Tech stack table row updated to "React Three Fiber + drei (Three.js)". |
| 3 | Links to the new `<PokerTable>` contract. | SATISFIED | "Public API — `<PokerCanvas>` + `<PokerTable>`" subsection includes JSX example with full prop surface and explicit cross-ref: "Refer to `specs/table-3d-revamp-010/plan.md § Public API` for the full contract." | Plan.md link is relative-path form; GitHub-rendered as a live link. |
| 4 | No stale references to `pokerScene.ts`. | SATISFIED | `grep -n 'pokerScene\|createPokerScene\|calculateEquity\|DealerPreview\|MobilePlaybackView\|updatePokerScene' docs/frontend/architecture.md` → no matches. Legacy removal narrative softened to "The legacy imperative `scenes/` factory was removed in T-033" — names the directory, not the file. | See **L-1** for the three test files that still contain these strings as intentional negative assertions. |

---

## Carry-Forward Resolution

| Carry-forward | Origin | Disposition this cycle |
|---|---|---|
| Cycle 46 **L-1** partial remainder — stale doc refs in `frontend/README.md` + scenes3d/ port-origin comments | `docs/agent/reviews/cycle-46-aia-core-wohq-2026-04-21.md` | **RESOLVED** — `frontend/README.md` "How the 3D Scene Works" section fully rewritten (L144–EOF). `tableLayout.test.ts:54-55` describe-string + comment updated. No remaining "pokerScene"/"scenes/" prose in live source outside negative-assertion tests (see L-1). |
| Cycle 47 **M-2** — architecture.md prose may still reference DealerPreview | `docs/agent/reviews/cycle-47-aia-core-pvkr-2026-04-21.md` | **RESOLVED** — `grep -n DealerPreview docs/frontend/architecture.md` → no matches. |
| Cycle 48 **L-2** — stale describe string at `tableLayout.test.ts:54` + architecture.md prose | `docs/agent/reviews/cycle-48-aia-core-wohq-2026-04-21.md` | **RESOLVED** — describe-string updated to `"matches the canonical <PokerTable> seat layout for a 10-seat table"`; sibling port-origin comment rewritten in canonical form. Test file passes (18/18). |

All three carry-forwards documented in this cycle as scope of T-034 are CLOSED.

---

## Findings

### [MEDIUM] M-1 — Routing narrative for `/playback` still reads as "Mobile-optimized playback" indirectly via the `mobile/` component block

**File:** `docs/frontend/architecture.md`
**Line(s):** 628–631 (`## Mobile Adaptations` table) + Mobile-Adaptations paragraph at L634
**Category:** design (doc consistency)

**Problem:**
The routing table and flow diagrams were correctly migrated from `MobilePlaybackView` → `PlaybackView`. However, `## Mobile Adaptations` still documents three components (`SessionScrubber`, `StreetScrubber`, `EquityRow`) living in `frontend/src/mobile/` with a lead-in paragraph implying they are "touch-optimized variants of shared components" used by a mobile playback view. In reality, per the current `PlaybackView.tsx` composition, the mobile variants are now reused by `PlaybackView` at narrow viewports (no separate `MobilePlaybackView` file). The updated paragraph at L634 captures this ("reuses the touch-optimized mobile scrubbers for narrow viewports"), but the table above reads as if the mobile components serve a dedicated mobile route.

**Suggested follow-up:**
Either (a) fold the mobile components into `components/` if they are now reused across viewports, or (b) retitle § Mobile Adaptations to clarify they are viewport-adaptive variants auto-selected by `PlaybackView` / `ActiveHandDashboard`. Non-blocking; documentation polish.

---

### [LOW] L-1 — Three test files still contain literal `pokerScene` / `createPokerScene` strings as intentional negative assertions

**File:** `frontend/test/views/PlaybackView.test.tsx` L14-15, L357, L361-363; `frontend/test/dealer/TableView3D.test.tsx` L14, L359, L365-366; `frontend/test/pages/TableView.test.tsx` L280, L286
**Category:** style (coverage semantics)

**Problem:**
T-034 AC-4 "No stale references to `pokerScene.ts`" was scoped to `docs/frontend/architecture.md` and is fully satisfied there. These three test files contain `pokerScene` / `createPokerScene` as regex literals inside `expect(src).not.toMatch(...)` source-level guards that PROVE the legacy imports are absent from their SUTs. Removing them would reduce regression protection; keeping them is correct. Cycle 48 already flagged and accepted this as by-design.

**Suggested follow-up:**
None — documented for auditor clarity. Guards should stay.

---

### [LOW] L-2 — `## Poker Logic` section has no incoming link from the 3D section despite the equity-overlay connection

**File:** `docs/frontend/architecture.md`
**Line(s):** 584 (Poker Logic section) + reference at L608 (EquityBadges) in 3D section
**Category:** style (doc navigation)

**Problem:**
The 3D section mentions `<EquityBadges>` renders from server-supplied equity data; `## Poker Logic` now explains that client-side evaluation was deleted and equity comes server-side. These two paragraphs are topically linked but there is no in-page hyperlink from the 3D scene-graph subsection to `## Poker Logic`. Minor navigation gap.

**Suggested follow-up:**
Add a `(see [Poker Logic](#poker-logic))` cross-ref next to the EquityBadges mention. Cosmetic.

---

### [LOW] L-3 — Directory-tree comment block under `animations/` uses compact plain-line listing rather than `├──` tree chars for the secondary files

**File:** `docs/frontend/architecture.md`
**Line(s):** 153–155 (within the `scenes3d/` ascii tree)
**Category:** style (consistency)

**Problem:**
Controller/driver pairs are listed with proper `├──` glyphs, but the miscellaneous animation files (`cameraPresets.ts`, `chipMotion.ts`, etc.) are listed after a bare `├──` as a comma-separated run. The rest of the tree uses one-file-per-line `├──`. Inconsistent with the surrounding style.

**Suggested follow-up:**
Either expand to one-line-per-file (preferred for grep/diff) or move the secondary files behind a single `├── …helpers: cameraPresets.ts, chipMotion.ts, …` labelled line. Cosmetic.

---

## Internal Link Sanity

`grep -nE '\]\(#[a-z0-9-]+\)' docs/frontend/architecture.md` → TOC entry L23 `(#3d-rendering-react-three-fiber)` matches the renamed section at L505. No broken internal anchors introduced.

---

## Technical Accuracy Cross-Check

Spot-checked claims in the new `## 3D Rendering (React Three Fiber)` section against source:

| Claim | Source evidence | Verdict |
|---|---|---|
| "`<PokerCanvas>` … enables `shadows` only at `high`" | `frontend/src/scenes3d/PokerCanvas.tsx` reads `qualityTier === 'high'` from `useTableStore` | ✅ accurate |
| "`canSee()` … spectator reveals only at showdown for non-folded seats" | `frontend/src/scenes3d/state/visibilityPolicy.ts` L23-27 | ✅ accurate |
| "`QUALITY_TIER_SETTINGS[tier]` — the authoritative per-tier settings object" | `frontend/src/scenes3d/state/qualitySettings.ts` exports the canonical map | ✅ accurate |
| "120-sample rolling FPS window … drops exactly once per recovery gate" | `frontend/src/scenes3d/state/useFPSMonitor.ts` (T-028 / Cycle 42 implementation) | ✅ accurate |
| "`<SessionReplayShell>` … `max(CHIP_SLIDE_DURATION_MS, 1500 / speed)` ms per street" | `frontend/src/scenes3d/SessionReplayShell.tsx` (T-031 / Cycle 45 M-1 fix) | ✅ accurate |
| "Under `viewer.policy === 'player'` the camera is hard-locked" | `PokerTable.tsx` `resolveCameraPreset` at L132-154 | ✅ accurate |
| "Seat positions in `tableLayout.ts`" | `frontend/src/scenes3d/components/tableLayout.ts` present and exports `POT_CHIP_WORLD_POSITION`, `seatCommitChipWorldPosition` | ✅ accurate |

No factual errors found in the rewritten prose.

---

## Quality Gates

| Gate | Result |
|---|---|
| Full frontend test suite | 1856 / 1856 passing (1 minor test-string change in `tableLayout.test.ts`; 18 tests green) |
| ESLint `src test` | 28 problems (22 errors, 6 warnings) — identical to pre-change baseline; lint delta = 0. All findings are pre-existing from prior cycles. |
| `grep -rn 'pokerScene\|createPokerScene\|calculateEquity\|DealerPreview\|MobilePlaybackView\|updatePokerScene' docs/` | → no matches |
| `grep -rn …same…  frontend/README.md` | → no matches |
| Stale refs in live source (excluding intentional negative-assertion tests) | → none |

---

## Close Recommendation

**PROCEED.** T-034 AC 1/2/3/4 all SATISFIED. Cycle 46 L-1, Cycle 47 M-2, Cycle 48 L-2 carry-forwards all RESOLVED. 1 MEDIUM + 3 LOW findings are non-blocking and fall under Anna's `tasks.md`-only protocol (not filed to beads). Architecture documentation is now accurate to the landed R3F implementation; no broken anchors; no factual drift vs source spot-checks.

**Suggested close reason (Hank):**
> T-034 implemented — `docs/frontend/architecture.md` 3D section rewritten end-to-end: `scenes3d/` directory tree, Public API (`<PokerCanvas>` / `<PokerTable>`), scene-graph mermaid, `canSee()` visibility policy with security note, controller+driver animation split, quality tiers (`QUALITY_TIER_SETTINGS`, `useFPSMonitor`, `<QualityToast>`, `<TableSettingsPanel>`), camera/preset/player-lock narrative, `<SessionReplayShell>` composition. `## Poker Logic` rewritten around evaluator.ts deletion. Routing table + flow diagrams migrated `MobilePlaybackView` → `PlaybackView`. Testing directory table refreshed (`scenes/`→`scenes3d/` 46 tests; `poker/` row removed). TOC + anchor aligned. `frontend/README.md` § "How the 3D Scene Works" fully rewritten. `tableLayout.test.ts:54` describe-string updated to canonical `<PokerTable>` wording (Cycle 48 L-2 RESOLVED). Suite 1856/1856 green; lint delta 0. Cycle 50: 0 CRIT / 0 HIGH / 1 MED / 3 LOW — non-blocking tasks.md per Anna contract. Carry-forwards resolved: Cycle 46 L-1, Cycle 47 M-2, Cycle 48 L-2. Review: docs/agent/reviews/cycle-50-aia-core-7uds-2026-04-21.md. Closes epic aia-core-6o9t (table-3d-revamp-010).
