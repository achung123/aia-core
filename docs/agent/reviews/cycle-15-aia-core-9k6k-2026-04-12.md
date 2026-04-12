# Code Review Report — alpha-feedback-008

**Date:** 2026-04-12
**Cycle:** 15
**Target:** Showdown card reveals in player viz (7 files)
**Reviewer:** Scott (automated)

**Task:** T-034 — Showdown card reveals in player viz
**Beads ID:** aia-core-9k6k

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 2 |
| LOW | 3 |
| **Total Findings** | **5** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | Detect showdown: any player with result=won or result=lost triggers reveal | SATISFIED | `showdown.ts` L9-14 checks won/lost/win/loss; 8 unit tests in `showdown.test.ts`; `TableView.tsx` L55 calls `isShowdown()` | Also handles mapped variants win/loss |
| 2 | All non-folded players' cards flip face-up with 300ms rotation animation | SATISFIED | `cards.ts` L56-84 — RAF-driven 300ms flip with z-rotation and material swap at midpoint; `holeCards.ts` L190-197 calls `.flip()` on face-down cards; 3 flip tests in `cards.test.ts` | Animation properly cancellable via `cancelFlip()` |
| 3 | Winner's cards get glow highlight | SATISFIED | `holeCards.ts` L117-122 — gold emissive (`0xffd700`, intensity 0.4); L202-208 delays glow 300ms when cards flipped, immediate otherwise | Timer IDs tracked in `winnerGlowTimers` set |
| 4 | Folded players show FOLD sprite | SATISFIED | `holeCards.ts` L40-55 creates canvas-based FOLD sprite; L125-132 adds sprite above seat; L178-181 dims cards + adds sprite for fold result | Clean dispose path in `removeSprite()` |
| 5 | Reveal triggers on finalized hand poll or scrub | SATISFIED | `TableView.tsx` L82 — `computeStreetIndex()` returns 4 at showdown; scene `update()` routes streetIndex to `goToShowdown()`; test `sets streetIndex to 4` confirms | Triggered on `fetchHands` response |

---

## Findings

### [MEDIUM-1] Type-safety bypass via `any`-typed scene ref

**File:** `frontend/src/pages/TableView.tsx`
**Line(s):** 100, 252
**Category:** design

**Problem:**
`sceneRef` is typed as `useRef<any>(null)`, which silently allows `PlayerHandData` (with `result: string`) to flow into `holeCards.initHand()` which expects `PlayerHand` (`result: 'win' | 'loss' | 'fold'`). If a result value falls outside the union (e.g., empty string `''` from the RESULT_MAP fallback), TypeScript cannot catch it at compile time.

**Code:**
```typescript
// TableView.tsx L100
const sceneRef = useRef<any>(null);
```

**Suggested Fix:**
Define a typed interface for the scene object returned by `createPokerScene` and use it as the generic parameter: `useRef<PokerScene | null>(null)`. This would surface any type mismatches between `TableView` and the scene modules at compile time.

**Impact:** Silent type mismatches could cause runtime bugs if data shapes drift. Low probability in current code but increases maintenance risk.

---

### [MEDIUM-2] Visual flash during showdown card flip

**File:** `frontend/src/scenes/holeCards.ts`
**Line(s):** 186-197
**Category:** correctness

**Problem:**
`goToShowdown()` calls `disposeCards(seatIndex)` then immediately calls `placeCards(...)` with `faceUp=false` followed by `.flip()`. Between the dispose and the first render frame of the new cards, there is a brief gap where no card meshes exist at the seat. This can produce a single-frame visual flash (cards disappear then reappear face-down before flipping).

**Code:**
```typescript
disposeCards(seatIndex);
placeCards(seatIndex, c0.rank, c0.suit, c1.rank, c1.suit, false);
data.cards[0].flip();
data.cards[1].flip();
```

**Suggested Fix:**
Create the new face-down cards and add them to the scene *before* removing the old ones, or batch the dispose + place + flip within a single synchronous block that prevents an intermediate render. Alternatively, consider keeping existing card meshes and directly swapping their material in-place during the flip.

**Impact:** Cosmetic — a single-frame flicker at showdown on some devices. Not a functional bug.

---

### [LOW-1] Fragile coupling between `isShowdown()` and `goToShowdown()` result values

**File:** `frontend/src/scenes/showdown.ts` / `frontend/src/scenes/holeCards.ts`
**Line(s):** showdown.ts L11-13; holeCards.ts L178, L200
**Category:** design

**Problem:**
`isShowdown()` recognizes four result strings: `'won'`, `'lost'`, `'win'`, `'loss'`. But `goToShowdown()` only acts on `'fold'` and `'win'` — the unmapped variants `'won'` and `'lost'` would pass the showdown check but fail to trigger glow or fold behavior. This is currently safe because `TableView.tsx` maps `won→win`, `lost→loss`, `folded→fold` via `RESULT_MAP` before the data reaches `holeCards`. But if any future caller passes unmapped results, the showdown would activate without correct per-player handling.

**Suggested Fix:**
Either (a) make `holeCards.ts` also accept the unmapped variants (`won`/`lost`), or (b) document that `holeCards` requires pre-mapped result values and enforce this at the interface level.

**Impact:** No current bug — but fragile if data flow changes.

---

### [LOW-2] No direct unit tests for `goToShowdown()` behavior in holeCards

**File:** `frontend/src/scenes/holeCards.ts`
**Line(s):** 170-215
**Category:** correctness

**Problem:**
The fold sprite creation, card dimming, winner glow, and glow-delay logic in `goToShowdown()` are only tested *indirectly* through the mocked scene in `TableView.test.tsx`. The mock scene stubs `holeCards.goToShowdown` as a no-op (`vi.fn()`), so the actual Three.js logic inside `goToShowdown()` — sprite placement, material opacity, emissive color, setTimeout delay — has zero direct test coverage.

**Suggested Fix:**
Add a `holeCards.test.ts` file with focused unit tests that exercise `goToShowdown()` with mocked Three.js primitives. Key scenarios: (1) fold result dims cards + adds sprite, (2) win result with face-down cards flips then glows after 300ms, (3) win result with face-up cards glows immediately, (4) dispose clears timers.

**Impact:** If the Three.js glow/sprite logic regresses, no test will catch it.

---

### [LOW-3] `PlayerHand` union type lacks fallback for unrecognized results

**File:** `frontend/src/scenes/holeCards.ts`
**Line(s):** 14
**Category:** design

**Problem:**
The `PlayerHand.result` type is `'win' | 'loss' | 'fold'`, but `goToShowdown()` has no `else` branch for values outside this union. An empty string (which the RESULT_MAP fallback can produce) would quietly fall through — the player's cards would remain unchanged with no fold sprite and no glow. While not a bug given current data, it makes debugging harder.

**Code:**
```typescript
result: 'win' | 'loss' | 'fold';
```

**Suggested Fix:**
Either widen the type to include `''` (and document the fall-through behavior) or add an explicit `else` logging/no-op branch for unknown results during development.

**Impact:** Silent no-op for unrecognized results. No current bug.

---

## Positives

- **Clean separation of concerns** — `isShowdown()` is a pure function in its own module with comprehensive tests (8 cases including edge cases). Easy to test and reuse.
- **Thorough RAF lifecycle management** — `flipRafId` is tracked per card, `cancelFlip()` properly calls `cancelAnimationFrame`, and `disposeCards()` cancels all in-flight animations. `winnerGlowTimers` are cleared in both `dispose()` and `goToPreFlop()`. No memory leaks detected.
- **Solid test coverage for the detection layer** — `showdown.test.ts` covers all four accepted result values plus null, undefined, empty array, folded-only, and mixed scenarios.
- **Correct showdown data flow** — The `RESULT_MAP` in TableView normalizes backend values (`won`→`win`, `folded`→`fold`, `lost`→`loss`) before passing to the scene, maintaining a single canonical vocabulary.
- **Proper Three.js resource disposal** — Geometry, materials, textures, and sprites are all explicitly disposed. The `dispose()` method on `HoleCards` cleans up everything including pending timers.
- **TableView tests cover the integration well** — 3 showdown-specific tests verify card reveal logic, streetIndex computation, and non-showdown card masking.

---

## Overall Assessment

The showdown card-reveal implementation is **solid and well-structured**. All 5 acceptance criteria are satisfied. The `isShowdown()` detection is correct and thoroughly tested. The 300ms flip animation uses RAF properly with full cleanup. Winner glow correctly delays when cards need flipping. FOLD sprites are created and disposed cleanly. No memory leaks detected. No security issues.

The 2 MEDIUM findings are a type-safety gap (any-typed scene ref) and a cosmetic flash during flip — neither are functional bugs. The 3 LOW findings relate to coupling fragility, missing direct tests for Three.js logic, and a missing fallback branch — all are improvement opportunities rather than defects.

**30/30 tests pass.** No regressions.

**Verdict: PASS** — Zero CRITICAL or HIGH findings.
