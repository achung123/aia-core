# Code Review Report — table-3d-revamp-010

**Date:** 2026-04-18
**Target:** `frontend/package.json`, `frontend/package-lock.json`
**Reviewer:** Scott (automated)

**Task:** T-001 — Verify R3F + React 19 compatibility and add dependencies
**Beads ID:** aia-core-zada
**Epic:** table-3d-revamp-010 (aia-core-6o9t)
**Cycle:** 1

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 0 |
| LOW | 2 |
| **Total Findings** | **2** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | `frontend/package.json` includes verified-compatible `@react-three/fiber` and `@react-three/drei` versions | SATISFIED | [frontend/package.json](frontend/package.json#L31-L32) — `@react-three/fiber@^9.6.0`, `@react-three/drei@^10.7.7` | R3F v9 officially supports React 19; drei v10 requires R3F v9 and `three ≥ 0.157`. Both compatible with `three@^0.183.2` and `react@^19.1.0` already pinned. |
| 2 | `npm install` succeeds without peer-dep errors in `frontend/` | SATISFIED | `npm ls @react-three/fiber @react-three/drei react three` resolves cleanly; no UNMET PEER DEPENDENCY warnings; `npm ls --depth=0` returns no errors | Top-level `three@0.183.2` is deduped across fiber/drei/camera-controls/three-stdlib/three-mesh-bvh/maath/meshline/gainmap-js/troika-three-text. |
| 3 | Player interface route location documented for T-032 | PARTIAL | [specs/table-3d-revamp-010/tasks.md](specs/table-3d-revamp-010/tasks.md#L46-L51) Consumer table lists `pages/TableView.tsx` at `#/player/table?game=<id>&player=<name>` | AC says "in a comment or PR note." The route is documented in tasks.md but no comment was added to `package.json` and no PR note was captured in commit metadata. Since the change is still uncommitted and the spec is authoritative, this is a documentation-placement nit, not a functional gap. |
| 4 | Existing frontend test suite still passes (`cd frontend && npm test`) | SATISFIED | User-reported: 1238 tests pass | Not independently re-run; taken on faith per loop-review handoff. |

---

## Findings

### [LOW] Nested `three@0.170.0` installed under `stats-gl` — potential "multiple Three.js instances" warning

**File:** `frontend/package-lock.json`
**Line(s):** (stats-gl entry in lockfile; not authored code)
**Category:** design

**Problem:**
`npm ls @react-three/drei` shows `stats-gl@2.4.2` ships with a **nested, non-deduped** copy of `three@0.170.0`, while every other drei sub-dep deduplicates to the top-level `three@0.183.2`:

```
├─┬ @react-three/drei@10.7.7
│ ├── ... (all others: three@0.183.2 deduped)
│ ├─┬ stats-gl@2.4.2
│ │ └── three@0.170.0        ← nested, not deduped
```

This means two distinct `three` modules are bundled. When `<Stats>`/`<StatsGl>` from drei is mounted (planned for T-028 `useFPSMonitor` / auto-degrade), R3F will emit a console warning of the form *"WARNING: Multiple instances of Three.js being imported."* and instanceof checks across library boundaries can misbehave.

**Suggested Fix:**
No change required for T-001. Track as a follow-up for T-028: either (a) add an `overrides` entry to `frontend/package.json` forcing `three@^0.183.2` across the tree, e.g.

```json
"overrides": {
  "three": "^0.183.2"
}
```

or (b) avoid drei's `<Stats*>` component and use a lightweight custom FPS hook. File as a discovered-from issue off aia-core-zada.

**Impact:** No functional break today; cosmetic console noise and potential subtle bugs once the FPS overlay lands in T-028.

---

### [LOW] AC #3 — player-interface route not called out in a comment or PR note

**File:** `frontend/package.json`
**Line(s):** 31–32 (new dependency block)
**Category:** convention

**Problem:**
AC #3 for T-001 explicitly asks that "the location of the player interface route (for T-032) is documented in a comment or PR note." The route is captured in `specs/table-3d-revamp-010/tasks.md` (Consumer table, T-001), which is adequate for downstream discovery, but the change is still uncommitted and no PR note or package.json comment was produced.

**Suggested Fix:**
Either (a) drop a one-line note in the eventual commit message, e.g.

```
setup(r3f): add @react-three/fiber ^9.6.0 and @react-three/drei ^10.7.7 (aia-core-zada)

Player POV route (consumed in T-032): frontend/src/pages/TableView.tsx
  at #/player/table?game=<id>&player=<name>
```

or (b) treat the tasks.md Consumer table as the canonical record and explicitly reference it from the commit/PR body. Not worth adding a comment inside `package.json` — JSON doesn't support comments and the spec is a better home for this.

**Impact:** Minor. Spec already documents the route; this is a process/paper-trail nit.

---

## Positives

- **Minimal, surgical diff.** Only `frontend/package.json` and `frontend/package-lock.json` changed — no source-code drift for a setup task. This is exactly right for T-001.
- **Version choices are compatibility-correct.** `@react-three/fiber@^9.6.0` is the React-19 line; `@react-three/drei@^10.7.7` is the matching drei major that targets fiber v9. Both work with `three@^0.183.2` (drei peer is `three ≥ 0.157`; fiber peer is `three ≥ 0.148`).
- **Top-level peer graph is clean.** `react@19.2.5`, `three@0.183.2`, fiber and drei all resolve without peer warnings, and every first-order drei transitive that needs `three` deduplicates to the pinned `0.183.2`.
- **Scope discipline.** No premature scaffolding of `scenes3d/` (correctly deferred to T-002), no changes to `three`, `@types/three`, React, or build config.

---

## Overall Assessment

T-001 is in good shape. All four acceptance criteria are effectively met — AC #3 is PARTIAL only in a paper-trail sense (info lives in tasks.md rather than a comment/PR note) and is easily closed by including a line in the commit message when Hank lands the change. No CRITICAL or HIGH findings; the two LOWs are informational (the `stats-gl` nested-`three` note will matter in T-028, not now).

**Recommendation:** Proceed. Before closing aia-core-zada:
1. Capture the player-route pointer in the commit message (addresses AC #3).
2. File a discovered-from follow-up off aia-core-zada for the `stats-gl`/`three` override, scheduled to land with T-028.

T-002 (scaffold `scenes3d/` + `<PokerCanvas>`) is safe to unblock.
