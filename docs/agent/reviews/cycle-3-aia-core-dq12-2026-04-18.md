# Code Review Report — table-3d-revamp-010

**Cycle:** 3
**Epic:** table-3d-revamp-010
**Date:** 2026-04-18
**Target:** T-003 — scenes3d types + handsToTableState adapter
**Reviewer:** Scott (automated, loop-review)

**Task:** T-003 — Define `TableState` types and `handsToTableState` adapter
**Beads ID:** aia-core-dq12

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
| 1 | `TableState` matches plan.md § "Public API" | SATISFIED | [frontend/src/scenes3d/types.ts](frontend/src/scenes3d/types.ts#L20-L74) | Field-by-field match; `phase` narrowed from `string` to `TableStatePhase` union (tightening, see M-2). |
| 2 | Handles awaiting_cards / preflop / flop / turn / river / showdown / all-in / split pot / fold-before-showdown / null status / null actions | SATISFIED | [frontend/test/scenes3d/handsToTableState.test.ts](frontend/test/scenes3d/handsToTableState.test.ts#L107-L173), regression block L397-L479 | Every listed case exercised; split pot fixture covers 6-player all-in with two side pots. |
| 3 | `sbSeat` / `bbSeat` / `currentSeat` resolve via `seatByName`; unknown → null (no throw) | SATISFIED | [handsToTableState.ts](frontend/src/scenes3d/data/handsToTableState.ts#L179-L186), test L292-L300 | Map-lookup with `?? null` for each; `null` name is short-circuited before the lookup (safer than plan pseudocode's `?? ''`). |
| 4 | streetIndex: awaiting_cards/preflop=0, flop=1, turn=2, river=3, showdown=4 | SATISFIED | [handsToTableState.ts](frontend/src/scenes3d/data/handsToTableState.ts#L52-L68), test L115-L126 | Exhaustive switch with `default: 0` safety net. |
| 5 | Vitest covers each case + 6-player all-in + split pot regression | SATISFIED | [handsToTableState.test.ts](frontend/test/scenes3d/handsToTableState.test.ts#L413-L455) | 30 tests total; lint + tsc clean; full frontend suite reports 1276/1276. |

---

## Findings

### [MEDIUM] Dealer-seat derivation assumes `seat_number` order equals physical table order

**File:** [frontend/src/scenes3d/data/handsToTableState.ts](frontend/src/scenes3d/data/handsToTableState.ts#L132-L147)
**Line(s):** 132–147
**Category:** correctness

**Problem:**
`deriveDealerSeat` sorts all seated `seat_number`s ascending and returns the seat "before" SB in that list. This is only correct when seats are contiguous (`1,2,3,…`). For non-contiguous seating (e.g. players at seats `1, 3, 7` with SB on `3`), the "previous" sorted seat (`1`) is not necessarily the physically adjacent seat clockwise from SB — it is merely the lower-numbered occupied seat. The plan section does not constrain the algorithm, but physical seat ordering around a poker table is not guaranteed by numeric order alone.

**Code:**
```ts
const seated = (game.players ?? [])
  .map((p) => p.seat_number)
  .filter((n): n is number => typeof n === 'number')
  .sort((a, b) => a - b);
if (seated.length === 0) return null;
if (seated.length <= 2) return sbSeat; // heads-up: dealer == SB
const idx = seated.indexOf(sbSeat);
if (idx === -1) return null;
return idx === 0 ? seated[seated.length - 1] : seated[idx - 1];
```

**Suggested Fix:**
Either (a) document explicitly that seat numbers are assumed dense/contiguous in the AIA model, or (b) add a regression test with non-contiguous seats and, if the current behaviour is intentional, assert it; or (c) consume `hand.dealer_seat` / a dealer field if/when the backend exposes one (plan pseudocode already passes `input.hand` and `seatByName` into `deriveDealerSeat`, which Hank's signature drops).

**Impact:** Silent logical drift in multi-table / custom-seating scenarios. Does not affect current fixtures or runtime because seat assignment is dense today, but the assumption should be pinned by either a doc comment or a test.

---

### [MEDIUM] Unsafe cast of `status.phase` to `TableStatePhase`

**File:** [frontend/src/scenes3d/data/handsToTableState.ts](frontend/src/scenes3d/data/handsToTableState.ts#L158)
**Line(s):** 158
**Category:** correctness

**Problem:**
`HandStatusResponse.phase` is typed as `string` in [frontend/src/api/types/dealer.ts](frontend/src/api/types/dealer.ts#L31). The adapter coerces via `as TableStatePhase | undefined`, then the value flows unchanged into `TableState.phase`. If the backend returns any value outside the 6-member union (e.g. `"finished"`, `"complete"`, or a misspelling), TypeScript will believe the field is a valid `TableStatePhase` at consumer sites while at runtime it is not. Downstream `streetIndexFromPhase` is safe (has `default: 0`), but consumers that `switch` on `phase` without a default branch will silently miss cases.

**Code:**
```ts
const phase: TableStatePhase =
  (status?.phase as TableStatePhase | undefined) ?? derivePhase(hand);
```

**Suggested Fix:**
Add a small validator that narrows unknown phase strings back to `derivePhase(hand)` (or an explicit `"unknown"` fallback). Example:
```ts
const VALID_PHASES = new Set<TableStatePhase>([
  'awaiting_cards','preflop','flop','turn','river','showdown',
]);
const statusPhase = status?.phase as string | undefined;
const phase: TableStatePhase =
  statusPhase && VALID_PHASES.has(statusPhase as TableStatePhase)
    ? (statusPhase as TableStatePhase)
    : derivePhase(hand);
```

**Impact:** Defensive only; no known backend path emits invalid phases today. Preserves the tightened union the plan implied without sacrificing runtime safety.

---

### [LOW] `parseCard` accepts arbitrary rank strings

**File:** [frontend/src/scenes3d/data/handsToTableState.ts](frontend/src/scenes3d/data/handsToTableState.ts#L27-L35)
**Line(s):** 27–35
**Category:** correctness / design

**Problem:**
Only the suit character is validated; any non-empty leading substring becomes `rank`. Strings like `"Xh"`, `"1d"`, or `"Asd"` produce technically-valid-looking `CardRef` objects. `CardAtlas` UV lookup will silently fail to render when such a rank reaches the scene.

**Suggested Fix:**
Whitelist ranks against `['2','3','4','5','6','7','8','9','10','J','Q','K','A']` (the same set `CardAtlas` uses) and return `null` otherwise. Cheap to add and collapses a whole class of silent rendering bugs.

**Impact:** Low — backend is the only source of these strings and is already validated server-side. Worth tightening for belt-and-braces.

---

### [LOW] `lastAction.amount` is never populated

**File:** [frontend/src/scenes3d/data/handsToTableState.ts](frontend/src/scenes3d/data/handsToTableState.ts#L86-L96)
**Line(s):** 86–96
**Category:** design / deferred

**Problem:**
`parseAction` only emits `{ action, street }`; `amount` (optional on `SeatState.lastAction`) is always undefined even when the trailing action in `actions[]` has an `amount`. Hank's note documents this is deferred to T-017.

**Suggested Fix:**
Acceptable as deferred; recommend adding a `// TODO(T-017): populate amount from last action` comment at the call site so the deferral is discoverable in-code, not just in task history.

**Impact:** No AC is missed today (plan keeps `amount?` optional); the action-badge UI in T-017 will need this, so a breadcrumb here will save a round-trip.

---

### [LOW] Type fidelity narrower than plan literal

**File:** [frontend/src/scenes3d/types.ts](frontend/src/scenes3d/types.ts#L46-L57)
**Line(s):** 46–57
**Category:** convention

**Problem:**
The plan literally writes `phase: HandStatusResponse['phase']` (which resolves to `string`). Hank intentionally tightened this to the `TableStatePhase` union. The tightening is an *improvement* and matches the spirit of the plan (the 6 named phases are enumerated in the same section), but it is a silent divergence from the literal pseudocode. Pairs with M-2.

**Suggested Fix:**
Keep the tighter type; add a one-line comment in `types.ts` noting the intentional narrowing (e.g. `// narrower than plan's HandStatusResponse['phase']; validated in adapter`). Doing so protects future readers reconciling the two artifacts.

**Impact:** Purely documentation clarity.

---

## Positives

- **Adapter is strictly pure**: no I/O, no mutation of inputs, no `Date.now`/random; `.sort()` only applied to a freshly-built array.
- **Fallback chains match plan intent exactly**: `status?.current_chips ?? player.current_chips ?? 0`, `status?.pot ?? hand.pot`, `status?.side_pots ?? hand.side_pots`.
- **Null/empty-string handling is stricter than plan pseudocode**: the adapter guards `sb_player_name != null` *before* the map lookup, avoiding the `seatByName.get('')` pattern in the plan pseudocode (AC #3 safer-by-default).
- **Side-pot casing tolerance** handles both `eligible_players` (snake, backend) and `eligiblePlayers` (camel) with graceful degradation on malformed rows.
- **Exhaustive switch + default safety net** in `streetIndexFromPhase` means the return type `0|1|2|3|4` is always honoured even if `phase` violates its type (defense in depth with M-2).
- **Fixture helpers in the test file** (`makePlayer`, `makeGame`, `makeHand`, `makeStatus`, `makeStatusPlayer`) are well-factored and will be reusable for T-004..T-009 tests.
- **30 tests / 1276 full suite** passing; lint and tsc clean on new files.

---

## Overall Assessment

T-003 meets all five acceptance criteria. The adapter is pure, deterministic, and the type surface mirrors plan.md § "Public API" with one minor, safety-positive narrowing on `phase`. The test suite is thorough — every case enumerated in AC #2 is directly exercised, plus a realistic 6-player all-in + split pot regression.

No blockers for downstream tasks (T-009 in particular). The two MEDIUM items are worth addressing in a follow-up rather than gating this task: M-1 is a latent correctness assumption that should at minimum be pinned by a comment or test; M-2 is a hardening opportunity around the string → union coercion. The LOW items are polish.

**Recommendation:** accept T-003. File a single follow-up (discovered-from aia-core-dq12) covering M-1 + M-2 + the `// TODO(T-017)` breadcrumb from L-4.
