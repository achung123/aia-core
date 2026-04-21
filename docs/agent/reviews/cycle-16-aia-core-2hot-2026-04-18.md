# Code Review Report — Cycle 16 / T-016 `<Nameplate>`

- **Cycle:** 16
- **Target:** `aia-core-2hot` — T-016 `<Nameplate>` with live stack tween and billboarding
- **Epic:** `aia-core-6o9t` (table-3d-revamp-010)
- **Spec:** [specs/table-3d-revamp-010/tasks.md § T-016](specs/table-3d-revamp-010/tasks.md)
- **Date:** 2026-04-18
- **Reviewer:** Scott
- **Files under review:**
  - [frontend/src/scenes3d/components/Nameplate.tsx](frontend/src/scenes3d/components/Nameplate.tsx)
  - [frontend/src/scenes3d/PokerTable.tsx](frontend/src/scenes3d/PokerTable.tsx#L284)
  - [frontend/test/scenes3d/Nameplate.test.tsx](frontend/test/scenes3d/Nameplate.test.tsx)

---

## Verification

- **Unit tests:** `npx vitest run test/scenes3d/Nameplate.test.tsx` → **31/31 passed** (0.80s)
- **Full scenes3d suite (from orchestration context):** 332/332 passing
- **Full frontend suite (from orchestration context):** 1570/1570 passing
- **Lint (scoped):** `npx eslint src/scenes3d/components/Nameplate.tsx test/scenes3d/Nameplate.test.tsx` → 0 issues

---

## Acceptance Criteria Mapping

| AC | Requirement | Status | Evidence |
|---|---|---|---|
| 1 | Nameplate faces the camera at all times | **COVERED** | Billboard driver in `useFrame` + `computeBillboardYRotation` helper, tests at [Nameplate.test.tsx#L375-L423](frontend/test/scenes3d/Nameplate.test.tsx#L375-L423) (first-frame orientation, camera-move re-orient, null-camera no-op), plus 7 pure-helper tests. |
| 2 | Stack numeric value tweens between old and new amounts | **COVERED** | `createTween` with `NAMEPLATE_STACK_ANIMATION_MS=300`, mid-tween strict inequality test, completion test, mid-tween restart, same-value stability, reduced-motion snap — [Nameplate.test.tsx#L274-L367](frontend/test/scenes3d/Nameplate.test.tsx#L274-L367). |
| 3 | Legible at 360px viewport width | **PARTIAL — HIGH** | Verified only as a **geometry regression floor** (`NAMEPLATE_FONT_SIZE ≥ 0.08`, `NAMEPLATE_WIDTH ≥ 0.6` world units). Real WebGL text rasterization is explicitly deferred; the rendered "text" is a solid white plane. The proxy floor is a defensible guardrail but does not exercise actual legibility. See HIGH finding below. |
| 4 | No nameplate for empty seats | **COVERED** | `null`, empty-string, whitespace, and `isActive===false` paths all assert the `<group>` is absent; wrapper test confirms per-seat hiding in the multi-seat matrix. |

---

## Findings

### CRITICAL — 0

_None._

### HIGH — 1

**H1. AC 3 "legibility at 360px" is geometry-proxied, not observably verified — deferred text rasterization is a real AC gap.**
- **Location:** [Nameplate.tsx#L251-L262](frontend/src/scenes3d/components/Nameplate.tsx#L251-L262) (placeholder `<mesh name="nameplate-text">` — a solid `#f8fafc` plane, not glyphs)
- **What's wrong:** The spec AC reads *"Legible at 360px viewport width."* The only test enforcing this is a constants floor ([Nameplate.test.tsx#L266-L272](frontend/test/scenes3d/Nameplate.test.tsx#L266-L272)) that pins world-unit dimensions. On a 360px viewport the user would see a **rectangle of color**, not a readable `Alice $1,250`. The `data-label` attribute and `userData.label` expose the *intended* content, but neither is on-screen. AC 3 is **not observably verified**.
- **Why it matters:** This is the sole AC that speaks to user-visible output. Shipping T-016 closed with only a geometry proxy means the S-3.1 story slice cannot legitimately be marked "done" at story-close time, and a regression in the deferred rasterization path would have no test to catch it.
- **Suggested fix (no code change required this cycle):**
  1. File a P1 beads task **"T-016 follow-up: real WebGL text rasterization for `<Nameplate>`"** as `discovered-from: aia-core-2hot`, blocking S-3.1 closure.
  2. Add an explicit note in tasks.md T-016 stating AC 3 is proxy-verified only, with the follow-up task ID.
  3. Until that follow-up lands, the S-3.1 story slice should not be marked complete even if downstream T-017/T-018 close.
- **Approval-to-close impact:** Per loop-review protocol, a HIGH blocks approval. **Do not close `aia-core-2hot` until the follow-up bead is filed and linked.** The code itself is ready; the AC-coverage gap is what's outstanding.

### MEDIUM — 4

**M1. `setState` per frame for rotation + stack, fanned out across up to 10 seats simultaneously.**
- **Location:** [Nameplate.tsx#L186-L210](frontend/src/scenes3d/components/Nameplate.tsx#L186-L210) (the `useFrame` callback calls both `setDisplayedStack` during an active stack tween *and* `setRotationY` on any camera movement)
- **Concern:** At 60fps with all 10 seats billboarding during a camera transition (T-021 tween), that's ~10 `setRotationY` calls per frame (600/sec). Reconciliation is cheap for a flat `<group>` subtree, but it is still React work inside the RAF loop, which is the exact pathology Cycle 15 (markers) introduced and deferred. The bailout guard `Math.abs(prev - target) < BILLBOARD_EPSILON` effectively collapses to a no-op once the camera stops, but during a camera tween every frame produces a new `target`, defeating the epsilon guard.
- **StrictMode / reconciler:** Not a correctness hazard — React batches setState calls inside `useFrame` into a single commit per frame. No infinite loop; no cascading re-renders observed in tests.
- **Suggested fix:** When the scene-graph driver for animations (Cycle 12/13 follow-ups) lands, promote rotation to an imperative `group.rotation.y` write via `useRef` + mesh-ref, eliminating the per-seat-per-frame React commit. Track as MED follow-up.

**M2. Fresh-seat stack-change semantics: a repopulated seat tweens *from the previous occupant's stack* rather than snapping.**
- **Location:** [Nameplate.tsx#L156-L181](frontend/src/scenes3d/components/Nameplate.tsx#L156-L181) — the hidden→visible sync path sets `displayedStackRef.current = stack` only when `!occupied`, and only when the `stack` prop changes. If seat A (Alice, $1000) vacates, then seat A is reseated by Bob ($500), the tween will run `1000 → 500` over 300ms on Bob's first render.
- **Concern:** Visually wrong. The UX intent is that a newly-seated player *snaps* to their opening stack, not that we animate from the ghost of the previous occupant.
- **Suggested fix:** On the `occupied` false→true transition, set `displayedStackRef.current = stack` *before* the tween decision, so `latestFrom === stack` early-returns without a tween. Track as a MED follow-up.

**M3. Dual test-hook channels (`data-*` attributes *and* `userData`) couple tests to R3F's DOM-fallback behaviour under the vitest mock.**
- **Location:** [Nameplate.tsx#L234-L248](frontend/src/scenes3d/components/Nameplate.tsx#L234-L248)
- **Concern:** The `data-player-name` / `data-stack` / `data-displayed-stack` / `data-label` attrs exist only because the test harness mocks `@react-three/fiber`'s `Canvas` as a `<div>` and treats `<group>` as an unknown HTML element. In a real R3F build, three.js does not honour `data-*`, so these are test-only artifacts on a production component. The intent is legitimate during the R3F-without-real-text phase, but it creates two sources of truth for observability and will have to be unwound when real `<Text>` lands.
- **Suggested fix:** Consolidate to `userData` once `<Text>` rasterization lands in the T-016 follow-up; keep `data-*` only if real DOM overlays (drei `<Html>`) are chosen. Log as MED follow-up tied to H1.

**M4. `BILLBOARD_EPSILON = 1e-4` is a file-local magic number and is not exported.**
- **Location:** [Nameplate.tsx#L128](frontend/src/scenes3d/components/Nameplate.tsx#L128)
- **Concern:** Downstream tuning (e.g. deadband widening to suppress flicker during camera damping) cannot be set from tests or from T-021 without editing this file. The value is small enough that it's almost certainly fine, but the pattern is not consistent with the rest of the module, which exports all tunables.
- **Suggested fix:** Export as `NAMEPLATE_BILLBOARD_EPSILON`. Log as LOW-MED follow-up (not blocking).

### LOW — 5

**L1. No StrictMode regression test for `<Nameplates>` wrapper.**
- Cycle 10/11 taught that `onReady`-style effects double-fire under StrictMode dev double-mount. `<Nameplate>`'s effects are setState-only and do not expose external side effects, so no double-fire hazard exists today. Still, adding a StrictMode-wrapped render-and-unmount-remount test would pin the lesson into the suite. See [PokerTable.test.tsx#L370-L378](frontend/test/scenes3d/PokerTable.test.tsx#L370-L378) for the pattern.

**L2. The single `react-hooks/set-state-in-effect` eslint-disable is sound, but the pattern is worth extracting.**
- [Nameplate.tsx#L167-L172](frontend/src/scenes3d/components/Nameplate.tsx#L167-L172). The inline justification ("sync on hidden→visible transition") is accurate — the effect writes state only when `displayedStackRef.current !== stack` so it cannot loop. When the same pattern appears a third time (T-017 badge reset?), extract a `useSyncedRef(value)` helper.

**L3. Unused local in test file.**
- [Nameplate.test.tsx#L383-L394](frontend/test/scenes3d/Nameplate.test.tsx) — `const el = findNameplate(container, 0)!;` followed by `void el;` at the end. Either use `el` or drop the line; the `void` dance hides the intent.

**L4. `formatStackAmount` reimplements `Intl.NumberFormat`.**
- [Nameplate.tsx#L70-L82](frontend/src/scenes3d/components/Nameplate.tsx#L70-L82). `new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)` is one line and locale-correct. The hand-rolled version is fine and well-tested; `Intl` would simplify. Cosmetic.

**L5. `computeNameplateWorldPosition` does not take a seat-local offset argument.**
- Future nameplate variants (dealer-side badge, spectator overlay) will want to offset. Small API broadening opportunity, not blocking.

---

## Observations (not findings)

- **Billboard correctness under camera tweens (user question c):** Correct. `useFrame` reads `state.camera.position` each tick, so a smoothly tweened camera (e.g. T-021 preset transition) produces a smoothly tweened `rotationY`. There is no jump because there is no frame where `camPos` is stale. No jitter because `BILLBOARD_EPSILON` bails identical targets. The regression test `re-orients when the camera moves on subsequent frames` locks the behaviour.
- **`useReducedMotion` wiring:** Correct. `createTween({ reducedMotion: true })` synchronously fires `onUpdate(opts.to)` and returns a done-tween, so the `!tween.done` check means `tweenRef` stays `null`. Verified at [Nameplate.test.tsx#L355-L367](frontend/test/scenes3d/Nameplate.test.tsx#L355-L367).
- **`<PokerTable>` integration:** Type-clean. `TableState.seats: SeatState[]` has exactly the `{ seatIndex, playerName, isActive, stack }` shape `NameplatesProps.seats` expects — no adapter needed.
- **Identity stability:** Tested at [Nameplate.test.tsx#L473-L490](frontend/test/scenes3d/Nameplate.test.tsx#L473-L490). `<Nameplate>` keyed by `nameplate-${seatIndex}` preserves DOM identity across stack rerenders — this is exactly the Cycle 10/11 lesson applied correctly.

---

## Recommendation

**Do NOT approve close.** H1 (deferred text rasterization → AC 3 gap) is a HIGH-severity AC-coverage finding. The implementation quality is otherwise excellent — clean separation of pure helpers, strong test coverage for ACs 1/2/4, correct `useReducedMotion` handling, and no correctness bugs.

**To unblock close:**
1. File a P1 beads task `T-016 follow-up: real WebGL text rasterization` with `discovered-from: aia-core-2hot`, blocking S-3.1 story closure.
2. Note in tasks.md T-016 that AC 3 is proxy-verified only, with the follow-up task ID.
3. Then close `aia-core-2hot` with a close-reason that explicitly calls out the deferred rasterization and references the follow-up bead.

Once the follow-up is filed, the task is closeable. T-017 / T-018 / T-020 do not need real text to proceed and are not blocked by H1.

MEDIUMs (M1-M4) and LOWs (L1-L5) should be recorded as follow-ups in tasks.md Cycle 16 notes. None blocks close.
