# Code Review Report — alpha-feedback-008

**Date:** 2026-04-12
**Cycle:** 33
**Target:** `frontend/src/player/PlayerApp.tsx`, `frontend/src/player/PlayerApp.test.tsx`
**Reviewer:** Scott (automated)

**Task:** T-028 — Player session pinning (sessionStorage)
**Beads ID:** aia-core-irue

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 1 |
| LOW | 2 |
| **Total Findings** | **3** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | After selecting game + name, store `{ gameId, playerName }` in sessionStorage | SATISFIED | `PlayerApp.tsx` L23 (`saveSession`), test "stores gameId and playerName" | `handleSelectPlayer` calls `saveSession(gameId, name)` |
| 2 | On PlayerApp mount, check storage; if game still active, skip to playing screen | SATISFIED | `PlayerApp.tsx` L167-178 (mount effect), test "restores session from sessionStorage" | `loadSession()` called in useEffect; if game found in active list, sets step to `'playing'` |
| 3 | If stored game not found or inactive, clear storage and show game selector | SATISFIED | `PlayerApp.tsx` L179 (`clearSession()`), tests "clears storage when stored game is not active" and "not found" | Both inactive (complete) and missing game IDs tested |
| 4 | Leave Game button clears storage | SATISFIED | `PlayerApp.tsx` L209 (`handleLeaveGame` → `clearSession()`), test "Leave Game button clears sessionStorage" | Also resets all player/game state |
| 5 | Test verifies persistence across simulated mounts | SATISFIED | Test "restores session from sessionStorage and skips to playing step on mount" | Pre-seeds sessionStorage, renders fresh component, asserts playing step |

---

## Findings

### [MEDIUM] M1 — `saveSession()` does not catch `setItem` exceptions

**File:** `frontend/src/player/PlayerApp.tsx`
**Line(s):** 22-24
**Category:** correctness

**Problem:**
`sessionStorage.setItem()` can throw a `DOMException` (e.g., `SecurityError` in sandboxed iframes, `QuotaExceededError` in extreme edge cases, or when storage is disabled by policy). The exception would propagate into `handleSelectPlayer` (L207) or the URL-param mount path (L162), potentially crashing the React component tree since there is no error boundary wrapping this.

**Code:**
```ts
function saveSession(gameId: number, playerName: string) {
  sessionStorage.setItem(PLAYER_SESSION_KEY, JSON.stringify({ gameId, playerName }));
}
```

**Suggested Fix:**
Wrap in try/catch and silently degrade — session pinning is a convenience feature, not a critical path:
```ts
function saveSession(gameId: number, playerName: string) {
  try {
    sessionStorage.setItem(PLAYER_SESSION_KEY, JSON.stringify({ gameId, playerName }));
  } catch { /* storage unavailable — degrade gracefully */ }
}
```

**Impact:** Low probability in practice (tiny payload, standard browser contexts), but if triggered, the player would see an unhandled error instead of the playing screen. Mobile Safari private tabs and restrictive iframe policies are the most likely triggers.

---

### [LOW] L1 — `clearSession()` does not catch `removeItem` exceptions

**File:** `frontend/src/player/PlayerApp.tsx`
**Line(s):** 39-41
**Category:** correctness

**Problem:**
Same class of issue as M1 — `sessionStorage.removeItem()` can throw if storage is unavailable. Less impactful because if storage was unavailable, `saveSession` would have already failed, making `clearSession` a no-op in practice.

**Code:**
```ts
function clearSession() {
  sessionStorage.removeItem(PLAYER_SESSION_KEY);
}
```

**Suggested Fix:**
```ts
function clearSession() {
  try { sessionStorage.removeItem(PLAYER_SESSION_KEY); } catch { /* noop */ }
}
```

**Impact:** Extremely low — only reachable if storage becomes unavailable mid-session.

---

### [LOW] L2 — No test for corrupted sessionStorage data recovery

**File:** `frontend/src/player/PlayerApp.test.tsx`
**Line(s):** 1179-1350
**Category:** correctness

**Problem:**
`loadSession()` correctly handles malformed JSON and missing fields via try/catch + type validation (lines 26-37), but no test exercises this path. If a future refactor removes the guard, the regression would go undetected.

**Suggested Fix:**
Add a test that seeds `sessionStorage` with invalid JSON (e.g., `'{bad'`) and verifies the component falls through to the game selector without crashing. A second case could seed structurally valid JSON with wrong types (e.g., `{ gameId: "not-a-number" }`).

**Impact:** No runtime impact today — purely a test coverage gap for a defensive code path.

---

## Positives

- **`loadSession()` is robust**: try/catch wrapping, null-check on raw value, and type-validation of parsed fields (`typeof gameId === 'number'`, `typeof playerName === 'string'`). This is exactly the right pattern for reading untrusted storage data.
- **sessionStorage scope is correct**: sessionStorage is per-tab by spec, so two browser tabs running the player app will not conflict — no key collision issue.
- **URL params override storage**: The mount effect checks URL params first (L145-163), then falls back to storage (L165-178). This means a shared link always wins, and the test "URL params take precedence over sessionStorage" verifies it.
- **Cleanup is thorough**: Both `handleChangePlayer` and `handleLeaveGame` call `clearSession()` and reset all related state (playerStatus, captureStep, reviewData, etc.). No stale state leaks.
- **Test coverage is comprehensive**: 7 dedicated session-pinning tests plus existing tests that call `sessionStorage.clear()` in setup, ensuring no cross-test contamination.

---

## Overall Assessment

Clean implementation. The session pinning feature satisfies all 5 acceptance criteria with solid test coverage. The single MEDIUM finding (`saveSession` lacking a try/catch) is low-probability but worth hardening since the fix is a one-line wrapper. No CRITICAL or HIGH findings.
