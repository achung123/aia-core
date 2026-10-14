# Code Review — Cycle 21 / T-024 / aia-core-9tis

**Date:** 2026-04-18
**Reviewer:** Scott
**Cycle:** 21
**Epic:** aia-core-6o9t (table-3d-revamp-010)
**Task:** T-024 — Visibility policy module + `canSee`
**Beads ID:** aia-core-9tis
**Story Ref:** S-5.1

## Scope

- [frontend/src/scenes3d/state/visibilityPolicy.ts](frontend/src/scenes3d/state/visibilityPolicy.ts) — 29 lines, pure module
- [frontend/test/scenes3d/state/visibilityPolicy.test.ts](frontend/test/scenes3d/state/visibilityPolicy.test.ts) — 231 lines, 40 test cases
- Source of truth: [specs/table-3d-revamp-010/plan.md](specs/table-3d-revamp-010/plan.md#L443-L481) § Visibility Policy — Formal Contract
- AC source: [specs/table-3d-revamp-010/tasks.md](specs/table-3d-revamp-010/tasks.md#L516-L543)

## Summary

**0 CRITICAL · 0 HIGH · 2 MEDIUM · 3 LOW.** Approve close.

Implementation is a clean, minimal pure function that matches the plan's reference body line-for-line. Test coverage is exhaustive across the 7-row truth table × 6 phases (including `awaiting_cards` as a pre-showdown phase), purity is verified by both mutation and referential-equality assertions, and the `viewerSeat=null` edge case is covered. The interface is stable enough for T-025 to wire through `<PokerTable>` / `<Seats>` without touching `<Card>` internals, so the 31 Nameplate tests and 48 DealAnimation tests are unaffected.

## AC Mapping

| AC | Requirement | Status | Notes |
|---|---|---|---|
| 1 | Implementation matches plan.md § Visibility Policy byte-for-byte | **PASS** (w/ note) | Function body is byte-identical. `Policy` is re-exported from `../types` instead of being declared locally; see MED-1. |
| 2 | Test covers every row of the 7-case truth table | **PASS** | All 7 rows covered; fanned out across 5 pre-showdown phases where relevant (40 cases total). |
| 3 | Spectator hides until `phase==='showdown' && !ownerFolded` | **PASS** | Row 1–3 tests assert this directly; matches legacy `showdown.ts` / `handToPlayerCardData` semantics. |
| 4 | Function is pure (no React, no side effects) | **PASS** | Only a `type`-only import from `../types`; explicit purity tests (mutation + referential). |

## Findings

### MEDIUM

**MED-1 — "Byte-for-byte" vs. `Policy` re-export (AC 1)**
Location: [visibilityPolicy.ts#L11-L13](frontend/src/scenes3d/state/visibilityPolicy.ts#L11-L13)
Plan.md § Visibility Policy declares `export type Policy = 'spectator' | 'player';` inline in `visibilityPolicy.ts`. Hank instead imports `Policy` from `../types` and re-exports it (`export type { Policy };`) because the type already exists in `types.ts` from prior cycles. Strictly speaking, AC 1 says "byte-for-byte." Pragmatically this is the correct call — a duplicate public type is a worse outcome than a trivial spec deviation, and the external surface (`import { canSee, Policy } from '.../visibilityPolicy'`) is preserved. Recommend updating plan.md or tasks.md to record this as the accepted implementation. Non-blocking.

**MED-2 — `canSee` is a render-time guard, not a trust boundary**
Location: [visibilityPolicy.ts#L15-L30](frontend/src/scenes3d/state/visibilityPolicy.ts#L15-L30)
The function takes `viewerSeat` as an argument from the caller. A caller that forges `viewerSeat === cardOwnerSeat` bypasses the policy. This is **expected and correct** for T-024 — plan.md § Equity Overlay describes a "triple-layer defense" where the real trust boundary is the backend not shipping opponent hole-card IDs in player mode. `canSee` is layer 1 (render). It would be strengthening, not weakening, to document this assumption at the top of the module so the next engineer doesn't treat `canSee` as a security primitive. Suggest adding one line to the module doc: _"This is a render-time filter, not a trust boundary. Opponent `CardRef` payloads must already be withheld server-side in player mode; see plan.md § Equity Overlay."_

### LOW

**LOW-1 — `viewerSeat=null` semantics in player policy are undocumented**
The implementation treats `viewerSeat=null` under `policy==='player'` as "no viewer → everyone is an opponent," and the test covers this. The plan.md truth table doesn't enumerate this explicitly; it's derivable from the `viewerSeat === cardOwnerSeat` check. Recommend either (a) a short code comment on the player branch, or (b) adding the null row to the plan's truth table on next revision.

**LOW-2 — Purity test would be stronger with `Object.freeze`**
[visibilityPolicy.test.ts#L182-L192](frontend/test/scenes3d/state/visibilityPolicy.test.ts#L182-L192) compares pre/post snapshots to catch mutation. `Object.freeze(args)` before the call would fail-loudly at the mutation site rather than only at assertion time. Minor.

**LOW-3 — `awaiting_cards` phase semantics rely on plan.md implicit ordering**
Plan.md line 157 lists phases in order and line 297 treats pre-showdown uniformly; the implementation treats `awaiting_cards` identically to `preflop`/`flop`/`turn`/`river` (all return `false` for opponent cards in player policy). This is correct but worth a single inline note that pre-showdown is defined as `phase !== 'showdown'`, so future phase enum additions don't silently leak.

## Focus Area Responses

**(a) Byte-for-byte adherence** — Yes, with the deliberate exception noted in MED-1. The function body is character-identical; only the `Policy` type location differs (re-exported, not redeclared).

**(b) Security / trust model** — `canSee` cannot prevent a forged `viewerSeat`. This is correct for its role as a render-time filter. Real protection lives at the server boundary (don't ship opponent `CardRef` payloads to player clients) and the equity layer (`equityGuard.ts` + lint rule). See MED-2 for the suggested module doc clarification. No code change required.

**(c) `viewerSeat=null` semantics** — Defensible and consistent. In spectator policy the viewer is naturally absent, and the function correctly ignores `viewerSeat` in that branch (covered by the "ignores viewerSeat" test at [L74-L87](frontend/test/scenes3d/state/visibilityPolicy.test.ts#L74-L87)). In player policy, `null` is treated as a non-owner — reasonable because a `player`-policy mount without a viewer seat is already a UX contradiction; the function fails safely (hides opponent cards pre-showdown, reveals only at showdown). Spectator + showdown + null works as expected. See LOW-1 for a documentation suggestion.

**(d) `awaiting_cards` as pre-showdown** — Spec-consistent. [types.ts#L48-L53](frontend/src/scenes3d/types.ts#L48-L53) enumerates `awaiting_cards` in the phase union; plan.md line 157 confirms; plan.md line 297 groups all non-`showdown` phases together. Tests explicitly fan out over `awaiting_cards` (PRE_SHOWDOWN_PHASES at [L6-L12](frontend/test/scenes3d/state/visibilityPolicy.test.ts#L6-L12)). Correct.

**(e) Purity — actual module-level guarantees** — Verified. The only import is `import type { Policy, TableState } from '../types'` (type-only, erased at compile time). Module-level code is a single function declaration and a type re-export; no top-level expressions, no `new`, no `Math.random`, no `Date.now`, no imported side-effectful modules. Safe for use in render, reducers, selectors, and animation drivers.

**(f) Interface surface for T-025** — Clean. `<Card>` already accepts `faceUp?: boolean` as a prop ([Card.tsx#L56](frontend/src/scenes3d/components/Card.tsx#L56), default `true`). T-025 will compute `faceUp = canSee({...})` at the `<Seats>` / `<PokerTable>` level and pass the boolean down. No changes required to `Card.tsx`, so:
- The 31 Nameplate tests (different component) are unaffected.
- The 48 DealAnimation tests (animation primitives, don't assert on `faceUp`) are unaffected.
- The existing `<Card>` tests that pass `faceUp` explicitly continue to work.

Separately, T-020 EquityBadge uses `equityGuard.ts` with `no-equity-in-player` lint rule — confirmed separate path, different semantics (prop-level filtering vs. render-time boolean); `canSee` should **not** be reused there. Hank's note is correct.

## Recommendation

**Close aia-core-9tis.** Zero blocking findings. MED-1 and MED-2 are documentation-shaped follow-ups; log them in tasks.md Cycle 21 ledger and address during the T-025 / T-050 pass.
