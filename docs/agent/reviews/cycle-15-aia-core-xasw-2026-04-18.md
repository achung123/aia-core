**Loop Context:** Cycle 15 | Task: aia-core-xasw (T-019) | Epic: aia-core-6o9t | Date: 2026-04-18

# Code Review Report — table-3d-revamp-010

**Date:** 2026-04-18
**Target:** `frontend/src/scenes3d/components/DealerButton.tsx` + `frontend/test/scenes3d/DealerButton.test.tsx` + `<PokerTable>` integration
**Reviewer:** Scott (automated)

**Task:** T-019 — `<DealerButton>`, SB, BB markers with rotation animation
**Beads ID:** aia-core-xasw

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 3 |
| LOW | 4 |
| **Total Findings** | **7** |

Verdict: **APPROVE CLOSE.** Zero CRITICAL/HIGH findings. All four acceptance criteria are satisfied by the implementation and observably verified by the new test suite. The `useFrame` + `setState` animation driver is safe, StrictMode-clean, and pattern-parity with `<CameraPresetController>` (Cycle 14). Mid-tween teardown on `sbSeat → null` is correctly handled. MEDIUM/LOW items are incremental polish — none block close.

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| AC-1 | Markers render adjacent to the correct seats | SATISFIED | [DealerButton.test.tsx L194–216](frontend/test/scenes3d/DealerButton.test.tsx#L194-L216) + helpers at [DealerButton.tsx L93–120](frontend/src/scenes3d/components/DealerButton.tsx#L93-L120) | World positions computed via `seatAnchorLocalToWorld(seat, seatCount, [0, 0.08, 0.9])` — verified against `dealerButtonWorldPosition` / `smallBlindWorldPosition` / `bigBlindWorldPosition` math |
| AC-2 | Hand change animates markers to new seats (~600ms) | SATISFIED | [DealerButton.test.tsx L261–307](frontend/test/scenes3d/DealerButton.test.tsx#L261-L307), `DEALER_BUTTON_ANIMATION_MS = 600` | Tween spawned in reconcile `useEffect` keyed on `[dealerSeat, sbSeat, bbSeat, seatCount]`; mid-tween, half-tween, and end-tween positions all asserted; ease-out-cubic inherited from `createTween` default |
| AC-3 | Missing `sbSeat` or `bbSeat` hides that marker | SATISFIED | [DealerButton.test.tsx L228–243](frontend/test/scenes3d/DealerButton.test.tsx#L228-L243) + null-guards at [DealerButton.tsx L253–259](frontend/src/scenes3d/components/DealerButton.tsx#L253-L259) | `positions.sb ? <group …/> : null` — the whole marker group is unmounted when target is null |
| AC-4 | Dealer button sits to the right of SB | SATISFIED (adjacent) | [DealerButton.test.tsx L174–184](frontend/test/scenes3d/DealerButton.test.tsx#L174-L184) + `dealerButtonLocalOffset` sign logic at [DealerButton.tsx L73–89](frontend/src/scenes3d/components/DealerButton.tsx#L73-L89) | `ccwDiff = (sbSeat - dealerSeat) mod N`: `+X` when SB is CCW-adjacent, `-X` when CW-adjacent, `+X` default for non-adjacent. Dist-to-SB test confirms button is biased toward SB. See M-1 for heads-up edge case. |

All four ACs are satisfied. No additional ACs in `specs/table-3d-revamp-010/tasks.md § T-019`.

---

## Findings

### [MEDIUM] Heads-up edge case — dealer IS the SB, button direction undefined

**File:** `frontend/src/scenes3d/components/DealerButton.tsx`
**Line(s):** 73–89 (`dealerButtonLocalOffset`)
**Category:** correctness

**Problem:**
In heads-up (2-player) poker, poker convention is that **the dealer posts the small blind** — i.e. `dealerSeat === sbSeat`. In that case `ccwDiff === 0`, which falls into the default `+1` branch and offsets the button toward `+X` on the same seat as the SB marker. The button thus overlays the SB puck. There is no test for `dealerSeat === sbSeat`, and the comment at L80–86 only enumerates CCW/CW/non-adjacent.

**Code:**
```ts
const ccwDiff = (((sbSeat - dealerSeat) % seatCount) + seatCount) % seatCount;
const sign = ccwDiff === seatCount - 1 ? -1 : 1;
return [sign * DEALER_BUTTON_LOCAL_X, MARKER_HEIGHT_Y, MARKER_LOCAL_Z];
```

**Suggested Fix:**
Either (a) accept this (heads-up isn't in the spec's 6-seat reference scope and `TableState` construction in CSV-replay land may never produce this arrangement) and add a test pinning the behaviour, or (b) special-case `ccwDiff === 0` to omit the dealer button's X offset (button sits flush at seat center, to the side of the SB puck by disc radius). Option (a) is lower risk; prefer filing a follow-up to confirm with Jean whether heads-up is a supported seat count.

**Impact:** Visual overlap only in 2-player mode. No functional regression; no test fails.

---

### [MEDIUM] `setPositions(…)` inside `useFrame` — safe here, but worth a JSDoc note re: perf trade-off

**File:** `frontend/src/scenes3d/components/DealerButton.tsx`
**Line(s):** 211–214, 231–233
**Category:** design

**Problem:**
Each active tween calls `setPositions` on every frame, causing up to 3 React renders per frame during a 600ms transition. React 18 auto-batches state updates from async callbacks, so the three kinds collapse to one render per frame, but the component still reconciles ~36 times over the animation window. `<DealAnimationDriver>` deliberately avoids this by mutating `object3D.position` directly (see Cycle 13). The comment on L147 calls this out ("mirrors `<CameraPresetController>`") but doesn't explain **why** the marker driver chose `setState` over direct mutation.

**Verification this is safe:**
- No infinite-render loop: the reconcile `useEffect` deps are seat indices only, not `positions`, so `setPositions` inside `useFrame` cannot retrigger tween spawning.
- No StrictMode double-fire hazard: tweens are keyed by `MarkerKind`; repeated spawns cancel the prior handle before installing the new one (L204, L225).
- Mid-tween cancellation is clean: `next === null` path (L200–206) cancels the handle, deletes from map, and hides the marker — no dangling `onComplete`.

**Suggested Fix:**
Add a JSDoc paragraph at the top of `<TableMarkers>` explaining the pattern choice: markers are 3 nodes with infrequent transitions (hand rotations), so `setState` per frame is cheap and gives us observability for happy-dom tests. Cards use direct mutation because 52 simultaneous tweens would thrash React.

**Impact:** Maintainability — future contributors need the decision framework to know which pattern to pick for new animated components.

---

### [MEDIUM] `useMemo(..., [])` for seed positions has ESLint disabled — use lazy `useState` init instead

**File:** `frontend/src/scenes3d/components/DealerButton.tsx`
**Line(s):** 166–175
**Category:** convention

**Problem:**
```ts
const initialPositions = useMemo(() => ({
  dealer: targetFor('dealer', state, seatCount),
  // …
}), []);
// eslint-disable-next-line react-hooks/exhaustive-deps
const [positions, setPositions] = useState<…>(initialPositions);
```
`useMemo([])` to capture a one-shot initial value is a code smell — this is exactly what `useState`'s lazy-initialiser form is for, and it doesn't need the `exhaustive-deps` escape hatch.

**Suggested Fix:**
```ts
const [positions, setPositions] = useState<Record<MarkerKind, Vec3 | null>>(() => ({
  dealer: targetFor('dealer', state, seatCount),
  sb: targetFor('sb', state, seatCount),
  bb: targetFor('bb', state, seatCount),
}));
```
Drop the `useMemo` and the eslint-disable. Identical semantics, cleaner intent.

**Impact:** Style / lint hygiene. No behavioural change.

---

### [LOW] Text labels ("D" / "SB" / "BB") deferred — spec does not require, but prior scene may have had them

**File:** `frontend/src/scenes3d/components/DealerButton.tsx`
**Line(s):** 253–290 (marker meshes)
**Category:** design

**Problem:**
The ACs don't mandate text labels — markers render as colored discs (white / blue / red). Hank's note calls this out as deferred. Without text, colour alone conveys kind, which may fail a colour-blindness review (WCAG-ish) at some point.

**Suggested Fix:**
File a follow-up in tasks.md for T-019 polish: add `<Text>` drei labels centred on each disc once we confirm with the design lead. No change needed now.

**Impact:** Accessibility / visual parity — non-blocking, spec-conformant as shipped.

---

### [LOW] Non-adjacent-SB default direction is undocumented in tests

**File:** `frontend/src/scenes3d/components/DealerButton.tsx`
**Line(s):** 86 (`sign = ccwDiff === seatCount - 1 ? -1 : 1`)
**Category:** correctness

**Problem:**
The non-adjacent branch (e.g. `dealerSeat=0, sbSeat=3`) defaults to `+X`. Comment says "non-adjacent only happens in degenerate / transitional states." The test at L137–140 asserts `|offset[0]| === DEALER_BUTTON_LOCAL_X` but doesn't pin the sign. If future refactors flip the default, that test silently passes.

**Suggested Fix:**
Tighten the test to `expect(off[0]).toBe(DEALER_BUTTON_LOCAL_X)` (positive sign), or add a dev-mode assertion warning when the helper is called with non-adjacent SB so the degenerate case surfaces.

**Impact:** Regression-safety gap; unlikely to matter in practice.

---

### [LOW] `onUnmount` cleanup captures `tweensRef.current` in closure

**File:** `frontend/src/scenes3d/components/DealerButton.tsx`
**Line(s):** 243–249
**Category:** convention

**Problem:**
```ts
useEffect(() => {
  const tweens = tweensRef.current;
  return () => {
    for (const kind of MARKER_KINDS) tweens[kind]?.cancel();
  };
}, []);
```
The React lint rule "prefers" reading `.current` inside the cleanup (not in the effect body) because the ref could, in principle, be reassigned. Here `tweensRef` is never reassigned so it's equivalent, but reading inside cleanup is the idiomatic pattern.

**Suggested Fix:**
```ts
useEffect(() => {
  return () => {
    const tweens = tweensRef.current;
    for (const kind of MARKER_KINDS) tweens[kind]?.cancel();
  };
}, []);
```

**Impact:** Style only.

---

### [LOW] Comment on L22 says markers "tween to their new positions when the dealer rotates" — but SB/BB changes without dealer rotation also animate

**File:** `frontend/src/scenes3d/components/DealerButton.tsx`
**Line(s):** 4–6 (header comment)
**Category:** convention

**Problem:**
The file header says the tween fires "when the dealer rotates on a hand transition." In practice the effect deps include `sbSeat` and `bbSeat` independently, so any blind-seat change (e.g. SB bust-out backfill) also animates — which is correct, but under-documented.

**Suggested Fix:**
Expand the header comment: "…when the dealer, SB, or BB seat changes."

**Impact:** Documentation accuracy.

---

## Positives

- **Pure helpers exported first-class** (`dealerButtonLocalOffset`, `dealerButtonWorldPosition`, etc.) — textbook application of the layout-helper pattern from T-009. All geometry math is unit-testable without R3F.
- **Mid-tween teardown is correct.** The `next === null` branch (L200–206) cancels the in-flight handle *before* deleting it from the map, and only then calls `setPositions` to unmount. There is no observable intermediate state where the marker is rendered at a stale tween pose.
- **StrictMode-safe.** The cleanup effect cancels every active tween on unmount; reducedMotion is captured into a ref so the initial render's value is used for the tween (not a stale closure). The marker-group DOM identity test (L332–346) confirms no remount across hand transitions.
- **Test harness mirrors Cycle 14.** The `frameCallbacks.length = 0` inside the `useFrame` mock (L15–18) correctly handles the "new callback per render" R3F contract — a common foot-gun that would have caused tests to tick tweens N× too fast.
- **Reconcile effect is correctly minimal** — deps are `[dealerSeat, sbSeat, bbSeat, seatCount]`, which is exactly the slice of `TableState` the markers depend on. Pot/community/stack churn does not spawn spurious tweens (verified by the "identical state does not restart animation" test at L312–326).
- **All 24 new tests pass** and full frontend suite is green at 1539/1539.

---

## Overall Assessment

T-019 ships a clean, testable marker system with defensible pattern choices. The `useFrame` + `setState` driver is safe in the scope of this component (3 nodes, rare transitions) and achieves test observability in happy-dom. Mixed patterns across the animation epic (`DealerButton` / `CameraPresetController` use setState; `DealAnimationDriver` mutates directly) are principled, not ad-hoc: the split tracks node count and transition frequency.

Zero CRITICAL/HIGH findings. **Approve close.** File M-1 (heads-up), M-2 (JSDoc for pattern rationale), M-3 (useState lazy init), and the four LOWs as follow-ups in `specs/table-3d-revamp-010/tasks.md` under a Cycle 15 heading.
