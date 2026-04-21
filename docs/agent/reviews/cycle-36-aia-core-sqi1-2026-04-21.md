# Code Review Report — H-1 Pot Sweep Split Mixed-Sign profitLoss

**Loop Context:** Cycle 36 | Task: aia-core-sqi1 (H-1 P1 bug) | Epic: aia-core-6o9t | Parent feature: aia-core-bsxn (T-012) | Date: 2026-04-21

**Scope:** MODIFIED `frontend/src/scenes3d/animations/potSweeps.ts` (`computePotSweepDeltas`); MODIFIED `frontend/test/scenes3d/potSweeps.test.ts` (+5 regression tests in new `H-1 mixed-sign profitLoss among winners` describe block).

**Gate:** Frontend vitest 1866 → 1871 (+5), all pass. Lint delta 0 (touched files clean; pre-existing repo lint errors in `DataView.tsx`, `PlaybackView.tsx`, `PlayerApp.tsx`, `PokerTable.tsx` unchanged). Pre-commit pass on modified files.

---

## Summary

```
CRITICAL: 0 findings
HIGH: 0 findings
MEDIUM: 0 findings
LOW: 2 findings
```

Clean fix. The bug is correctly diagnosed and resolved: the proportional-to-PL branch now requires **every** winner to have a positive clamped PL (`allPositive`) rather than merely a positive sum. When any winner has a non-positive clamped PL, all winners receive equal shares. The last-share fixup is preserved, so `sum(shares) === state.pot` exactly for every branch. Regression coverage satisfies Cycle 35 **M-4** verbatim (the three task-specified mixed-sign fixtures plus all-zero and all-negative). No prior tests regressed. No interaction with H-2 (see Interaction Analysis below).

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| AC-bug-1 | Winners with `result === 'won'` and `profitLoss ≤ 0` alongside positive co-winners receive a non-zero proportional (or equal-split fallback) share summing with co-winners to full pot | SATISFIED | `potSweeps.ts:104` `allPositive` guard routes mixed-sign winners to the equal-shares branch; regression tests `mixed positive+negative`, `mixed positive+zero`, `three-way mixed` all assert `amount > 0` per event and `total ≈ pot` | |
| AC-bug-2 | Mixed-sign regression tests added for `[+50,-10]`, `[+40,0]`, `[+30,-5,+15]` — each yields non-zero per-`won` share summing to full pot (closes Cycle 35 M-4) | SATISFIED | `potSweeps.test.ts` — three mixed-sign tests + all-zero + all-negative = 5 new tests in the `H-1 mixed-sign profitLoss among winners` describe | Exactly the fixtures requested in the task ACs. M-4 closed in passing. |
| AC-bug-3 | Existing all-zero fallback + equal-positive-split tests remain green | SATISFIED | Full target file: 18/18 pass. Full suite: 1871/1871 pass | No regressions in `splits proportional to profitLoss shares`, `last-share fixup ensures no rounding drift`, `falls back to equal shares if no positive profitLoss available`, AC-1 single winner, AC-4 all-fold, idempotence, key-builder |

---

## Regression of parent T-012 ACs (non-regression check)

| T-012 AC | Status after fix | Evidence |
|---|---|---|
| AC-1 single winner sweeps pot to winner seat | NOT REGRESSED | `splits proportional to profitLoss shares` for `[+50]` → `allPositive=true` → proportional branch, one winner, last-share fixup assigns full pot. Existing AC-1 test `emits one delta carrying the whole pot toward the winner` passes (amount=100 for pot=100). |
| AC-2 split pot proportional to `profit_loss` (all positive) | NOT REGRESSED | `allPositive` = true when every PL > 0 → identical proportional branch as before; existing `[+60,+30]` test still asserts 80/40 split. Contract preserved for the common path. |
| AC-3 pot display drains to zero after animation | NOT REGRESSED | Invariant `sum(shares) === state.pot` is preserved in every branch (last-share fixup). `potDisplay = state.pot − potSweepInFlight() − potSweepArrived` still converges to 0. `PokerTable.potSweep` integration tests untouched and passing. |
| AC-4 all-fold resolution sweeps full pot to sole non-folded seat | NOT REGRESSED | Single winner → either `allPositive=true` with one share (proportional, last-share fixup = pot) or `allPositive=false` with equal share (pot/1 = pot). Both branches yield full pot. Existing test `sweeps entire pot to the sole non-folded seat` passes. |

---

## Interaction Analysis — interplay with unfixed H-2 (`potDisplay` first-frame flash)

**H-2 (pre-existing, Cycle 35):** `potDisplay` reads `potSweepInFlight()` from a ref populated by `<PotSweepDriver>`'s commit-phase `useEffect`. On the first render that carries winner state, the ref is still `0`, so `potDisplay === state.pot` for one frame before collapsing to zero.

**After H-1 fix — new risk?** No. The fix operates purely within the pure function `computePotSweepDeltas`; it changes **which** seats receive shares and **what amounts**, but preserves the invariant `Σ shares === state.pot`. Consequently:

- `potSweepInFlight()` (sum of registered slug amounts) is still exactly `state.pot` once the driver registers, so `potDisplay` still drains to 0 on the second commit — identical one-frame flash, no worse.
- Under reduced motion (sync completion), `potSweepArrived` receives the full pot after the sync pass — unchanged.
- Multi-slug split cases (e.g. `[+50,-10]` now emits 2 slugs of 50/50 instead of 1 slug of 100) do not amplify the flash; the total in-flight is still `state.pot`.
- One subtle observable change: previously, a `[+50, -10]` mixed-sign split would render **only one** chip slug flying (to the positive-PL seat), visually communicating "one winner got the pot"; now both seats receive slugs. This is the **intended** user-visible improvement (both `result === 'won'` seats now get animated shares) and does not create a H-2 regression — merely restores AC-2 honesty for the split-pot edge.

**Verdict:** H-1 fix and H-2 are orthogonal. H-2 remains unfixed and can be scheduled independently (`aia-core-xc33`).

---

## Findings

### [LOW] Redundant guard clause: `plSum > 0 && allPositive`

**File:** `frontend/src/scenes3d/animations/potSweeps.ts`
**Line(s):** 106
**Category:** convention / code smell

**Problem:**
If every element of `positivePls` is strictly positive (`allPositive === true`), then `plSum > 0` is necessarily true (sum of strictly positive numbers over a non-empty array; `winners.length >= 1` is guaranteed by the earlier early-return). The `plSum > 0 &&` conjunct is dead logic.

**Code:**
```ts
const allPositive = positivePls.every((pl) => pl > 0);
const shares: number[] = [];
if (plSum > 0 && allPositive) {
```

**Suggested fix:** Drop `plSum > 0 &&` (keeping only `allPositive`) or drop `allPositive` and reformulate as `positivePls.every((pl) => pl > 0)` inline. Either form clarifies intent. Do not treat as blocking; the current form is defensible as belt-and-braces.

**Impact:** Readability only. No behavioural consequence.

---

### [LOW] Variable name `positivePls` no longer reflects its role post-fix

**File:** `frontend/src/scenes3d/animations/potSweeps.ts`
**Line(s):** 95, 104, 108
**Category:** naming

**Problem:**
Pre-fix, `positivePls` (the clamped PLs) was always consumed as "positive share weights". Post-fix it is consumed both as "test for allPositive" and as "numerator for the proportional branch". The name still reads OK but `clampedPls` would more accurately describe the sequence — its elements are `max(0, pl ?? 0)`, not necessarily "positive".

**Suggested fix:** Rename `positivePls` → `clampedPls`. Pure cosmetic. Out of scope for this bug fix — flag for Jean/Hank to revisit if the split-pot semantics are ever revisited (MEDIUM M-1 from Cycle 35 still open).

**Impact:** Readability only.

---

## Positives

- **Exactly-right minimal fix.** One-line semantic change (`plSum > 0` → `plSum > 0 && allPositive`) addresses every worked example from the bug description. No drive-by refactor.
- **AC fidelity.** The three regression fixtures from the task AC (`[+50,-10]`, `[+40,0]`, `[+30,-5,+15]`) are present verbatim, plus bonus coverage for all-zero and all-negative edges that complement Cycle 35 M-4's surface area.
- **Last-share fixup preserved unconditionally.** Regardless of which branch is taken (proportional or equal), the residual-to-last-winner pattern guarantees `Σ shares === pot` down to the penny. Float drift is impossible.
- **Clear comment.** The added comment block explains *why* the `allPositive` guard is necessary (references H-1 / Cycle 35 M-4), making the tradeoff discoverable to future readers.
- **No production-code surface expansion.** Pure function, same signature, same call sites. Controller/driver/PokerTable untouched — maximally localised fix.
- **Test readability.** New describe block is well-titled, self-documenting, and each test asserts both the "no winner gets zero" invariant and the "totals reconcile to pot" invariant — the two properties the bug report calls out.

---

## Overall Assessment

**Approve.** Zero CRITICAL / zero HIGH / zero MEDIUM findings. The two LOW findings are cosmetic and out of scope for a P1 bug fix; neither blocks closure. The fix satisfies all three bug ACs, closes Cycle 35 M-4 in passing, preserves every parent T-012 AC, and has no regression interaction with the unpatched H-2 flash.

**Suggested close reason (Logan):** `H-1 split-pot math fixed — winners with clamped profitLoss ≤ 0 now equal-share via allPositive guard in computePotSweepDeltas. Totals reconcile exactly to state.pot via preserved last-share fixup. 5 regression tests added ([+50,-10], [+40,0], [+30,-5,+15], all-zero, all-negative) closing Cycle 35 M-4 in passing. Frontend suite 1866→1871; lint delta 0; pre-commit clean. Scott Cycle 36: 0 CRIT / 0 HIGH / 0 MED / 2 LOW (naming + redundant guard, non-blocking). H-2 (potDisplay first-frame flash, aia-core-xc33) unaffected. Review: docs/agent/reviews/cycle-36-aia-core-sqi1-2026-04-21.md.`

**Anna parse counts:**

```
CRITICAL: 0 findings
HIGH: 0 findings
MEDIUM: 0 findings
LOW: 2 findings
```
