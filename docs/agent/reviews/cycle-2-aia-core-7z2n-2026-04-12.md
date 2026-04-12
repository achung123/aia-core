# Code Review Report — alpha-feedback-008

**Date:** 2026-04-12
**Cycle:** 2
**Target:** Remove dealer-centric mode toggle and code paths (13 files)
**Reviewer:** Scott (automated)

**Task:** T-015 — Remove dealer-centric mode toggle and code paths
**Beads ID:** aia-core-7z2n

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 0 |
| LOW | 1 |
| **Total Findings** | **1** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | GameMode type only has 'participation' (or is removed entirely) | SATISFIED | `frontend/src/stores/dealerStore.ts` — no `GameMode` type exists; `frontend/src/dealer/dealerState.ts` — no `GameMode` type exists | Type removed entirely — cleaner than keeping a single-value union |
| 2 | No `gameMode === 'dealer_centric'` conditionals exist anywhere | SATISFIED | `grep -r 'dealer_centric\|gameMode' frontend/src/**/*.ts frontend/src/**/*.tsx` — zero matches in live `.ts`/`.tsx` files | Confirmed no conditionals in any compiled source |
| 3 | `dealerState.ts` and `dealerStore.ts` no longer reference dealer-centric mode | SATISFIED | Both files reviewed line-by-line: no `GameMode`, `gameMode`, `SET_GAME_MODE`, or `dealer_centric` references | `DealerState` interface has no `gameMode` field; `DealerAction` union has no `SET_GAME_MODE` variant |
| 4 | `npm run build` succeeds with zero TypeScript errors | SATISFIED | `npx tsc --noEmit` — all errors are pre-existing (DealerPreview.tsx, TableView.test.tsx, PlayerApp.test.tsx, MobilePlaybackView.tsx, PlaybackView.tsx) and unrelated to this task | No new TS errors introduced by this change |
| 5 | All frontend tests pass | SATISFIED | `npx vitest run` — 47 test files, 621 tests passed, 0 failed | Full green suite confirmed |

---

## Findings

### [LOW] Stale user-facing documentation still references dealer-centric mode

**File:** `docs/user-onboarding-guide.md`
**Line(s):** 17, 77, 106, 110, 153–168
**Category:** convention

**Problem:**
The user onboarding guide still documents dealer-centric mode as a feature, including a comparison table (Participation vs Dealer-Centric), screenshots, and workflow descriptions. With dealer-centric mode fully removed from the codebase, this documentation is now misleading.

**Suggested Fix:**
Update `docs/user-onboarding-guide.md` to remove all dealer-centric references. Replace the mode comparison section with a description of participation mode as the sole game mode. Remove or replace the `aia-recording-cards-dealer-centric.PNG` screenshot reference.

**Impact:** Users reading the onboarding guide would see instructions for a mode that no longer exists. Low severity since this is documentation only and does not affect runtime behavior.

---

## Positives

- **Clean removal** — The `GameMode` type, `SET_GAME_MODE` action, `gameMode` state field, and all conditional branches were completely excised from both `dealerStore.ts` (Zustand) and `dealerState.ts` (reducer). No half-removals or commented-out code left behind.
- **Participation behavior preserved** — The polling `useEffect` in `DealerApp.tsx` correctly removed the `gameMode !== 'participation'` guard while keeping all polling logic intact. The `handleTileSelect` function now has only the participation path (activate player → outcome) without any vestigial camera-first branches.
- **No orphaned props** — `PlayerGrid` no longer accepts a `gameMode` prop; `GameCreateForm` no longer has mode selection UI or passes `gameMode` to `onGameCreated`. The callback signature in `DealerApp.tsx` matches: `handleGameCreated(gameId, players, gameDate)` — three args, no mode.
- **Test cleanup thorough** — All test files updated to remove dealer-centric test cases. The `initialState` in `dealerState.test.ts` correctly validates the shape without `gameMode`. The `defaultTestState` in `DealerApp.test.tsx` has no `gameMode` field.
- **Zustand and reducer kept in sync** — Both the Zustand store (`dealerStore.ts`) and the legacy reducer (`dealerState.ts`) were cleaned consistently. The `DealerState` interface exported from the store is the single source of truth, and `dealerState.ts` re-exports it.
- **No accidental functionality removal** — Street-tile capture (flop/turn/river), player outcome assignment, sit-out marking, finish-hand validation, hand loading, and QR code display are all intact and tested.

---

## Overall Assessment

The implementation is clean and complete. All five acceptance criteria are satisfied. The dealer-centric mode has been fully removed without leaving dead code, orphaned references, or broken functionality in the `.ts`/`.tsx` source files. The single LOW finding is a documentation update that should be addressed in a follow-up task but does not block this work. No CRITICAL findings — no commit needed from Scott (Anna manages commits during loop reviews).
