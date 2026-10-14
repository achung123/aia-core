# Scott Review — Cycle 34

**Task:** T-017 — Action-status badge on nameplate (beads `aia-core-nuy2`)
**Spec:** [specs/table-3d-revamp-010/tasks.md § T-017](../../../specs/table-3d-revamp-010/tasks.md)
**Date:** 2026-04-20
**Reviewer:** Scott

---

## Summary

```
CRITICAL: 0 findings
HIGH: 0 findings
MEDIUM: 2 findings
LOW: 4 findings
```

Hank implemented T-017 as a new `<ActionBadge>` component (with an `<ActionBadges>` composer) mounted as a sibling of `<Nameplates>` in `<PokerTable>`, plus an adapter upgrade that derives `lastAction` from the `HandActionResponse[]` list so the structure carries both the action's real `street` and (for bet/raise) its committed `amount`. All four T-017 ACs are satisfied by direct tests; the deferred T-003 LOW #4 (`lastAction.amount not populated`) is closed in passing. Suite: **1814 → 1839 (+25 tests)**, **115 → 116 files (+1)**. Lint: 0 errors, 1 pre-existing warning (PokerTable.tsx:153 `no-console` unused-directive) carried over from prior cycles — not introduced by T-017.

---

## AC Coverage

| AC | Requirement | Covered by |
|---|---|---|
| AC 1 | Labels `check` / `call` / `bet $X` / `raise $X` / `fold` / `all-in` | `formatActionLabel` unit tests (6) + `<ActionBadge>` render tests for `bet $25`, `call`, `check`, `raise $40` |
| AC 2 | Badge clears at new street, except `fold` / `all-in` which persist | `shouldShowBadge` transient-clears test, fold-persists test, all-in-persists test, render test "renders nothing when the action is from a prior street", adapter test "preserves the prior-street `street` on lastAction" |
| AC 3 | Missing data → no badge (no `"undefined"`) | `formatActionLabel(null)` test, unrecognised-action test, bet-without-amount test, explicit "does not emit undefined" test, `<ActionBadges>` skips null / empty / inactive seats test |
| AC 4 | No new backend endpoint; uses existing `/actions` | Adapter consumes `HandActionResponse[]` (already in scope of T-003); no new API import in `ActionBadge.tsx` |

`prefers-reduced-motion`: the badge has **no animations** (pure pill geometry + billboard orientation). The billboard driver mirrors `<Nameplate>` unconditionally — matching the T-016 contract that reduced motion only suppresses the stack-tween, not the billboarding. No new motion-honoring gaps introduced.

---

## Findings

### MEDIUM

**M-1 — Billboard `useFrame` runs for every seat even when the badge is hidden**

- **File:** [frontend/src/scenes3d/components/ActionBadge.tsx](../../../frontend/src/scenes3d/components/ActionBadge.tsx) (~L150, `<ActionBadge>` body)
- **Category:** perf / design
- **Description:** The `useFrame` hook is registered before the `if (!label) return null` early-return (correct per React rules-of-hooks), but this means every seat at a table registers one per-frame callback whether or not its badge is visible. For a 9-seat game where only 1–2 players have visible current-street actions that is 7–8 wasted camera reads + `setState` comparisons per frame. Under the test mock `useFrame` is a no-op, so this is not exercised in the test suite.
- **Suggested fix:** split the visibility gate into a parent that short-circuits rendering before the child mounts (e.g. in `<ActionBadges>` skip the child entirely when `shouldShowBadge` returns false for that seat). Or accept the cost as negligible and document it.
- **Not filed:** MEDIUM — captured in tasks.md Cycle 34 only per Anna's MED/LOW protocol.

**M-2 — Adapter silently assumes `HandActionResponse[]` is chronologically ordered**

- **File:** [frontend/src/scenes3d/data/handsToTableState.ts](../../../frontend/src/scenes3d/data/handsToTableState.ts) (~L108, `deriveLastAction`)
- **Category:** correctness / contract
- **Description:** `deriveLastAction` iterates the `actions` array and keeps the *last* matching entry as the player's most recent action. This assumes the backend returns actions in insertion order (chronological). No validation and no test locks this in. If the endpoint ever returns actions reversed or sorted by another key, `lastAction` would point at the player's *first* action and AC 2 (current-street clearing) would silently fail.
- **Suggested fix:** either sort by `created_at` explicitly inside `deriveLastAction`, or add a test using scrambled `created_at` order to pin the contract. The comment already calls out the assumption; a test would make it enforceable.
- **Not filed:** MEDIUM — captured in tasks.md Cycle 34 only.

### LOW

**L-1 — No multi-seat / multi-count coverage for `computeActionBadgeWorldPosition`**

- **File:** [frontend/test/scenes3d/ActionBadge.test.tsx](../../../frontend/test/scenes3d/ActionBadge.test.tsx) (~L150)
- **Category:** test coverage
- **Description:** Only `(seatIndex=0, seatCount=6)` is exercised against `seatAnchorLocalToWorld`. The Nameplate suite covers several seat counts for its equivalent helper; T-017 could mirror that to catch regressions in future `tableLayout` refactors.

**L-2 — No integration test asserting `<ActionBadges>` mount from `<PokerTable>`**

- **File:** [frontend/test/scenes3d/PokerTable.test.tsx](../../../frontend/test/scenes3d/PokerTable.test.tsx)
- **Category:** test coverage
- **Description:** `<ActionBadges>` is wired into `<PokerTable>` (verified by manual inspection) but no `PokerTable.test.tsx` case asserts the `<group name="action-badges">` renders and threads `state.phase` through. The component-level tests cover the props-in / DOM-out contract; a scene-level smoke case would catch an accidental removal of the `<ActionBadges>` line.

**L-3 — Unreachable `default:` branch of `formatActionLabel`**

- **File:** [frontend/src/scenes3d/components/ActionBadge.tsx](../../../frontend/src/scenes3d/components/ActionBadge.tsx) (~L95)
- **Category:** documentation
- **Description:** `parseAction` / `deriveLastAction` whitelist against `VALID_ACTIONS`, so at runtime `lastAction.action` is always a member of the `ActionName` union. The `default: return null` branch exists only as defense-in-depth for the cast path. The covering test uses `as unknown as` to force the branch. A short comment noting "defense-in-depth; production adapter enforces whitelist" would clarify intent.

**L-4 — Badge Y-coordinate overlap with seat pad not pinned by a test**

- **File:** [frontend/test/scenes3d/ActionBadge.test.tsx](../../../frontend/test/scenes3d/ActionBadge.test.tsx)
- **Category:** test coverage
- **Description:** Tests assert `ACTION_BADGE_LOCAL_Y < NAMEPLATE_LOCAL_Y - NAMEPLATE_HEIGHT/2` (badge sits below nameplate) but do not assert it stays above the seat pad surface (y ≈ 0). A camera-tilt regression could bury the badge in geometry. Low risk because the badge inherits the nameplate's vertical offset (0.6 world units) minus a small gap.

---

## Test Suite Metrics

| Metric | Before | After | Δ |
|---|---|---|---|
| Files | 115 | 116 | +1 |
| Tests | 1814 | 1839 | +25 |
| Passing | 1814 / 1814 | 1839 / 1839 | 100% |
| Runtime (frontend) | ~20.5s | ~21.4s | +~0.9s |
| Lint errors | 0 | 0 | 0 |
| Lint warnings | 1 (pre-existing) | 1 (pre-existing) | 0 (Δ) |

---

## Filed into beads

None. All findings are MEDIUM / LOW — per Anna's orchestration protocol only CRITICAL / HIGH file into beads. MEDIUM and LOW findings are recorded in this review and should be captured in `specs/table-3d-revamp-010/tasks.md` Cycle 34 post-mortem notes.

---

## Recommendation

T-017 meets all four acceptance criteria with a cohesive implementation that cleanly composes with the existing `<Nameplate>` / `<SeatHighlight>` family. The deferred T-003 LOW #4 is closed in passing. No blockers for close. Anna may close `aia-core-nuy2` after reviewing the two MEDIUM findings.
