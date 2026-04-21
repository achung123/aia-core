# Code Review Report — aia-core (Cycle 23)

**Date:** 2026-04-18
**Target:** `frontend/src/scenes3d/state/tableStore.ts`, `frontend/src/scenes3d/components/HandScrubberPanel.tsx`, `frontend/src/scenes3d/index.ts`, `frontend/test/scenes3d/HandScrubberPanel.test.tsx`, `frontend/test/scenes3d/tableStore.replay.test.ts`
**Reviewer:** Scott (automated)
**Cycle:** 23
**Epic:** aia-core-6o9t (table-3d-revamp-010)

**Task:** T-023 — Per-hand street scrubber UI + auto-play
**Beads ID:** aia-core-wnd2

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 4 |
| LOW | 5 |
| **Total Findings** | **9** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | Dragging the scrubber re-runs deal/chip/reveal animations for that street | PARTIAL | [HandScrubberPanel.test.tsx](frontend/test/scenes3d/HandScrubberPanel.test.tsx#L66-L77) verifies `onStreetIndexChange` fires with the new index on click | Component-level emission is satisfied. Observable animation re-run is a downstream contract — becomes verifiable only when T-030/T-031 mount the panel and feed `streetIndex` back into `<PokerTable>`. No orphan-component coverage gap vs. T-015/T-021 precedent. |
| 2 | Play/pause toggles auto-advance at 1.5s per street, scaled by `replay.speed` in `<SessionReplayShell>` | SATISFIED | [HandScrubberPanel.test.tsx](frontend/test/scenes3d/HandScrubberPanel.test.tsx#L124-L168) (1.5s @ 1x, 750ms @ 2x, 375ms @ 4x via replay slice) | Timer halts at `maxStreet` and flips `isPlaying=false` (test L171-L194). |
| 3 | Early-end hands clamp max to `streetIndexFromPhase(outcome_street)` | SATISFIED | [HandScrubberPanel.test.tsx](frontend/test/scenes3d/HandScrubberPanel.test.tsx#L79-L122) (disabled buttons, no-op clicks, shrink-clamp path) | `streetIndexFromOutcomePhase` exported and unit-tested (L25-L40). |
| 4 | Touch-drag works on iOS Safari + Android Chrome with 44×44pt tap area | PARTIAL | 44×44pt verified in [HandScrubberPanel.test.tsx](frontend/test/scenes3d/HandScrubberPanel.test.tsx#L56-L65); `touchAction:'manipulation'` set on the street group | Real-device gesture verification remains an epic-wide standing gap (acknowledged). Worth noting: "dragging" in the spec is realized as discrete button taps, not a true drag handle — matches existing [frontend/src/components/StreetScrubber.tsx](frontend/src/components/StreetScrubber.tsx) convention. |
| 5 | Live modes wire scrubber directly to local state, not the `replay` slice | SATISFIED | [HandScrubberPanel.test.tsx](frontend/test/scenes3d/HandScrubberPanel.test.tsx#L222-L230) (`does NOT write to the replay slice in live mode`) | `bindToReplay=false` default; dual-mode branching clean. |

---

## Findings

### [MEDIUM] 4x scrubber tick (375 ms) is shorter than chip-slide tween (400 ms) — deal/chip animations will tear when T-031 wires the panel

**File:** `frontend/src/scenes3d/components/HandScrubberPanel.tsx`
**Line(s):** 184-198
**Category:** design

**Problem:**
The auto-advance timer period at `speed=4` is `1500 / 4 = 375 ms` (tested line 259-269). `CHIP_SLIDE_DURATION_MS = 400` ([animations/chipSlides.ts:17](frontend/src/scenes3d/animations/chipSlides.ts#L17)) — so at 4x, a new street advance fires *before* the previous chip-slide tween completes. The deal tween (T-010) is on the same order of magnitude. Once T-030/T-031 wire this panel into `<PokerTable>`, users will observe either (a) drivers hard-snapping to new targets mid-tween, or (b) overlapping tweens depending on each driver's target-swap semantics — Cycle 20 M1 (Option B vs. Option C) is exactly this question, and it stays unresolved here.

Why MEDIUM not HIGH: the panel is not yet mounted by any route, so no user sees this today. It is a known design hazard, not a regression. Hank explicitly flagged it; filing it as a Cycle-23 ledger follow-up keeps it on the radar for T-030/T-031.

**Code:**
```tsx
useEffect(() => {
  if (!isPlaying) return;
  const periodMs = Math.max(1, msPerStreet / effectiveSpeed);
  const handle = setInterval(() => { /* advance street */ }, periodMs);
  return () => clearInterval(handle);
}, [isPlaying, effectiveSpeed, msPerStreet, setStreet, setPlaying]);
```

**Suggested Fix:**
Decide the Option B vs. Option C question *before* T-031 lands — either (B) shorten driver durations when `replay.speed >= 2` and snap-finish on each street-advance, or (C) gate `stepReplayStreet` on "all active tweens settled" and let 4x run "as fast as animations allow" (honest scrub rather than nominal 375 ms). Document the chosen option in `animations/README.md` and surface a `replay.speedCeilingForAnimations` (or equivalent) on the slice so dev assertions can fire when a period undercuts a driver duration.

**Impact:** If unresolved, first users of `<SessionReplayShell>` in playback will see visible animation tearing at 4x and (marginally) at 2x during long slides. Closing T-023 without an owner for this is acceptable; closing T-031 would not be.

---

### [MEDIUM] Live-mode instances still subscribe to all 4 replay selectors — every replay-slice write re-renders every unbound `<HandScrubberPanel>` on the page

**File:** `frontend/src/scenes3d/components/HandScrubberPanel.tsx`
**Line(s):** 104-108
**Category:** design

**Problem:**
The four `useTableStore` selector hooks at the top of the component run unconditionally regardless of `bindToReplay`. In live modes (dealer embed, player POV), those selectors subscribe the component to `replay.streetIndex`, `replay.isPlaying`, `replay.speed` even though the returned values are immediately discarded by the `bindToReplay ? … : …` ternaries. If an app later mounts a live-mode dealer scrubber *and* a playback route at the same time (or the store is mutated for any reason), every replay-slice write re-renders the live scrubber for no user-observable reason.

Also: the selectors run even when `hidden` is true (render early-return happens after the hooks, which is correct React, but the subscriptions are paid).

**Code:**
```tsx
const replayStreet = useTableStore((s) => s.replay.streetIndex);
const replayPlaying = useTableStore((s) => s.replay.isPlaying);
const replaySpeed = useTableStore((s) => s.replay.speed);
const setReplayStreetIndex = useTableStore((s) => s.setReplayStreetIndex);
const setReplayPlaying = useTableStore((s) => s.setReplayPlaying);
```

**Suggested Fix:**
Gate the subscriptions behind `bindToReplay`:
```tsx
const replayStreet = useTableStore((s) => (bindToReplay ? s.replay.streetIndex : 0));
```
or extract two small sub-components (`<LocalScrubber>` / `<BoundScrubber>`) and let the public component dispatch on the `bindToReplay` prop. The latter is cleaner but changes the testing surface — flag only if T-031 wiring proves the subscription cost matters.

**Impact:** No correctness issue. Minor perf / render-count cost in a future world with concurrent live + playback views. Acceptable for T-023 close; record for T-029/T-031.

---

### [MEDIUM] Clamp-down effect has stale-callback risk and is not StrictMode-tested

**File:** `frontend/src/scenes3d/components/HandScrubberPanel.tsx`
**Line(s):** 136-148
**Category:** correctness

**Problem:**
Two issues in the `outcomeStreet`-shrink clamp effect:

1. The dep list is `[maxStreet, bindToReplay]` with an `// eslint-disable-next-line react-hooks/exhaustive-deps` comment justifying the omission of `streetIndex`. But it also omits `setReplayStreetIndex`, `onStreetIndexChange`, and `setLocalStreet`. In practice these are all stable Zustand setters / setState functions, but if a caller passes a new `onStreetIndexChange` on each render (common with inline arrow functions — and in fact the way Anna's orchestration renders callers), a shrink that happens between two renders fires the *previous* callback closure, not the current one.
2. Under React 18 StrictMode (dev), the effect runs → cleanup → runs again. If the initial prop is `initialStreetIndex=3 outcomeStreet='flop'`, the first mount clamps and fires `onStreetIndexChange(1)` twice. This mirrors the Cycle 10/11 `<PokerTable>` `onReady` double-fire (aia-core-jbyh) that the project already paid to fix. No regression test is StrictMode-wrapped.

**Code:**
```tsx
useEffect(() => {
  if (streetIndex > maxStreet) {
    if (bindToReplay) setReplayStreetIndex(maxStreet);
    else setLocalStreet(maxStreet);
    onStreetIndexChange?.(maxStreet);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [maxStreet, bindToReplay]);
```

**Suggested Fix:**
Store `onStreetIndexChange` in a `useRef` (same pattern as `streetRef`/`maxRef` below it) and read `.current` inside the effect. Add one StrictMode-wrapped regression test for the clamp-down path to the Cycle-23 follow-up ledger. Consider folding into the epic-wide "StrictMode suite coverage" item (L3 since Cycle 11).

**Impact:** Low user-visible risk today (setters are stable, callback consumers don't inline). Becomes a foot-gun once T-031 wires this up with inline lambdas. Not a close-blocker.

---

### [MEDIUM] `replay` slice sharing a store with `theme` is fine, but the persist envelope has no regression guard against future slice drift

**File:** `frontend/src/scenes3d/state/tableStore.ts`
**Line(s):** 141-147
**Category:** design

**Problem:**
Coupling `replay` and `theme` into one `useTableStore` is idiomatic Zustand and has a passing test ([tableStore.replay.test.ts](frontend/test/scenes3d/tableStore.replay.test.ts#L76-L87) confirms `partialize` excludes replay). The structural risk: `partialize: (s) => ({ theme: s.theme })` is an **allow-list**, which is the right shape — but there is no test that asserts *new* slices added later are excluded by default. If T-027's `qualityTier` slice is added and someone writes `partialize: (s) => ({ theme: s.theme, qualityTier: s.qualityTier })` while accidentally touching `replay`, the test suite will not catch a regression.

**Code:**
```ts
partialize: (s) => ({ theme: s.theme }),
version: 1,
```

**Suggested Fix:**
Add a "persisted shape is exactly this set of keys" structural test — e.g., assert `Object.keys(parsed.state).sort()` equals an explicit whitelist after all setters have been poked. Lightweight and guards every future slice landing. Record as a T-027 / T-023b dependency in the ledger.

**Impact:** No correctness issue today. Structural regression risk for T-027 (quality tier) and T-023b (playback progression). Medium only because the cost of the guard is trivial and the blast radius of regressing it (silently persisting `replay` across tabs) is real.

---

### [LOW] `setInterval` (vs. `requestAnimationFrame`) has measurable drift + tab-background throttling, but is acceptable for discrete step semantics

**File:** `frontend/src/scenes3d/components/HandScrubberPanel.tsx`
**Line(s):** 186-197
**Category:** design

**Problem:**
`setInterval(…, 1500/speed)` drifts ~1-3 ms per tick on a loaded main thread and is clamped to ≥1000 ms in backgrounded tabs (Chrome/Safari). At `speed=4` (nominal 375 ms) a backgrounded tab will tick ~1 Hz until refocused; a user returning to the tab sees the playhead "catch up" slowly instead of jumping. RAF-driven "elapsed time since last tick" would give crisper recovery and monotonic timing vs. the driver tweens (which also use RAF via `useFrame`).

Counterpoint: scrubber semantics are discrete (street 0→1→2→3→4), not continuous, so sub-frame drift is invisible. setInterval is legitimately the simpler primitive here. Most users pause before backgrounding the tab.

**Suggested Fix:**
Leave as-is for T-023. If T-031 user-test reveals visible catch-up on tab refocus, switch to a `useFrame`-coupled accumulator inside `<PokerCanvas>` (requires moving the auto-advance out of the DOM panel and into a scene-graph driver — larger change). Note in the ledger so we don't re-debate it.

**Impact:** Cosmetic, refocus-only. No AC regression.

---

### [LOW] `msPerStreet` prop is public but not documented in the panel's type surface — consumers could accidentally set a value smaller than driver durations

**File:** `frontend/src/scenes3d/components/HandScrubberPanel.tsx`
**Line(s):** 46-47
**Category:** convention

**Problem:**
`msPerStreet?: number` accepts any number. The 375 ms floor at 4x is implicit; a caller passing `msPerStreet={200}` at any speed undercuts every driver tween. This is the generalization of MEDIUM-1.

**Suggested Fix:**
Either (a) tighten the JSDoc to "Base interval — keep ≥ `max(CHIP_SLIDE_DURATION_MS, DEAL_TWEEN_DURATION_MS)` for non-tearing animations" and surface a `Math.max` clamp with a dev-only `console.warn` when undercut; or (b) drop the prop entirely and let `REPLAY_SPEEDS` be the only public knob. Deferrable.

**Impact:** Developer foot-gun only; no direct user impact.

---

### [LOW] `setStreet` useCallback depends on `maxStreet`, which causes the auto-advance interval to tear down and restart whenever `outcomeStreet` changes

**File:** `frontend/src/scenes3d/components/HandScrubberPanel.tsx`
**Line(s):** 151-157, 186-197
**Category:** design

**Problem:**
`setStreet` is in the timer effect's dep list. `setStreet` changes identity whenever `maxStreet` / `bindToReplay` / `onStreetIndexChange` / `setReplayStreetIndex` changes. During playback of a hand whose `outcomeStreet` resolves mid-scrub (e.g., a late-folding hand hydrating from a WebSocket update), the interval will be torn down and recreated — which re-phases the tick. At 4x this means up to +375 ms of added perceived delay.

**Suggested Fix:**
Mirror the `streetRef`/`maxRef` pattern for `setStreet` and `setPlaying` — store latest in a ref, let the effect depend only on `[isPlaying, effectiveSpeed, msPerStreet]`. Small win, no behavior change for the happy path.

**Impact:** Marginal, edge-case only.

---

### [LOW] `REPLAY_SPEEDS` and `StreetIdx` are exported but the reverse mapping (street index → phase name) is not — T-023b, T-030, T-031 will each need it

**File:** `frontend/src/scenes3d/components/HandScrubberPanel.tsx`, `frontend/src/scenes3d/state/tableStore.ts`
**Line(s):** n/a
**Category:** design

**Problem:**
`streetIndexFromOutcomePhase` is exported and tested. The inverse (`phaseFromStreetIndex(i: StreetIdx): TableStatePhase`) is not. T-023b will need it to label the session-timeline segments; T-031 will need it to drive `<PokerTable state.phase>` from `replay.streetIndex`. Each consumer will reinvent it.

**Suggested Fix:**
Add `phaseFromStreetIndex` next to `streetIndexFromOutcomePhase` and test the roundtrip (`phaseFromStreetIndex(streetIndexFromOutcomePhase(p)) === p` for `p ∈ {'preflop','flop','turn','river','showdown'}`). 4-line helper + 1 test.

**Impact:** Duplication risk in T-023b/T-030/T-031. Not a blocker.

---

### [LOW] `STREET_SLUGS` duplicates information already encoded in `STREET_LABELS` and could drift

**File:** `frontend/src/scenes3d/components/HandScrubberPanel.tsx`
**Line(s):** 60-61
**Category:** convention

**Problem:**
`STREET_LABELS = ['Pre-Flop', 'Flop', 'Turn', 'River', 'Showdown']` and `STREET_SLUGS = ['preflop', 'flop', 'turn', 'river', 'showdown']` can drift. The label's slug is mechanically derivable (`label.toLowerCase().replace('-', '')`).

**Suggested Fix:**
Either derive the slug inline or build both from a single source-of-truth tuple array. Trivial.

**Impact:** Maintenance hygiene.

---

## Positives

- **Dual-mode API is clean.** The `bindToReplay` ternary pattern keeps a single rendering pathway — no duplicated JSX — and the five selectors / setters are gated via three tight ternaries at lines 111-113. Easy to read; easy to delete when T-023b supersedes live mode.
- **`partialize` correctly excludes `replay`.** The session-vs-persistent boundary is drawn explicitly in the tableStore JSDoc and enforced by a real localStorage regression test ([tableStore.replay.test.ts](frontend/test/scenes3d/tableStore.replay.test.ts#L76-L87)).
- **Ref-based tick reading.** `streetRef` / `maxRef` (lines 161-164) correctly avoid re-creating the interval on every street change. Good idiom; matches the DealAnimation / ChipSlide driver conventions the epic has been converging on.
- **AC 3 coverage is exhaustive.** Every outcome phase (preflop / flop / turn / river / showdown / awaiting_cards / undefined) has a parameterized test (HandScrubberPanel.test.tsx L25-L40) plus the interaction-level shrink-clamp and disabled-button paths (L79-L122).
- **AC 5 negative assertion is the right test shape.** Proving `replay` stays at `DEFAULT_REPLAY` after live-mode interactions is the exact regression guard S-4.3 needs.
- **Orphan-component deferral follows established precedent.** T-015 (`<TableSettingsPanel>` — Cycle 18) and T-021 (`<CameraPresetToolbar>` — Cycle 15) both landed as orphans and were re-verified when T-030/T-031 mounted them. Same pattern here is acceptable; no new coverage gap.
- **32/32 new tests, suite 1704/1704, lint clean.** Full frontend suite green; no flakes introduced.

---

## Overall Assessment

**0 CRITICAL, 0 HIGH.** Approve close of aia-core-wnd2.

T-023 lands the slice + the panel exactly as plan.md §"State Shape (Zustand Slices)" sketched, with session-scoped persistence enforced and dual-mode (live vs. bound) behavior tested on both sides of the ternary. All five ACs are either SATISFIED or PARTIAL-for-the-expected-orphan-component reason that matches T-015/T-021 precedent — no new coverage debt accrues.

The four MEDIUM findings are all design-class items that become live risks only when the next consumers (T-030 dealer embed, T-031 playback view) mount the panel. In priority order for the Cycle-23 follow-up ledger and next-cycle pecking order:

1. **MED-1 (4x tearing vs. driver durations)** — this is the Cycle 20 M1 "Option B vs. Option C" question Hank flagged; it must be resolved *before* T-031 lands, not after. Not a standalone bead yet — fold into T-031's design-prep.
2. **MED-3 (clamp-effect StrictMode + stale-callback)** — fold into the epic-wide "StrictMode suite coverage" item that has been accumulating since Cycle 11. One ref + one test.
3. **MED-2 (live-mode sub-subscriptions)** — only matters if T-030's dealer embed mounts the panel alongside a playback view; revisit then.
4. **MED-4 (persist whitelist regression guard)** — small, add during T-027 when `qualityTier` slice lands.

The five LOWs are hygiene and developer-ergonomics items — record in the ledger, don't file beads.

**Recommended close:** close `aia-core-wnd2` with the Cycle 23 summary; record the 4 MED + 5 LOW items in [specs/table-3d-revamp-010/tasks.md](specs/table-3d-revamp-010/tasks.md) under a "Cycle 23 — T-023 follow-ups" ledger block; carry MED-1 into T-031's pre-implementation design note.
