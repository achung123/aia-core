# Code Review Report — Cycle 17

- **Target:** `aia-core-ovhb` — Nameplate real-text rasterization (bug-fix)
- **Epic:** `aia-core-6o9t` — Table 3D Revamp
- **Reviewer:** Scott (Cyclops) — loop-review
- **Date:** 2026-04-18
- **Suite at review time:** 1575 / 1575 passing; lint clean

## Scope

- [frontend/src/scenes3d/components/Nameplate.tsx](frontend/src/scenes3d/components/Nameplate.tsx)
- [frontend/test/scenes3d/Nameplate.test.tsx](frontend/test/scenes3d/Nameplate.test.tsx)
- [frontend/test/scenes3d/PokerTable.test.tsx](frontend/test/scenes3d/PokerTable.test.tsx) (drei `<Text>` mock extension)

## Acceptance Criteria Mapping

| AC | Criterion | Status | Notes |
|----|-----------|--------|-------|
| 1 | Real text glyphs render at run time | **SATISFIED (code)** | drei `<Text>` wired at [Nameplate.tsx#L286-L298](frontend/src/scenes3d/components/Nameplate.tsx#L286-L298); troika SDF path is the production render. |
| 2 | Headless playwright / screenshot test asserts label visible at nominal camera distance | **NOT SATISFIED** | No playwright/screenshot harness was added. Coverage is structural (mock spy) — see MEDIUM M-1. |
| 3 | Existing 31 Nameplate tests remain green | **SATISFIED** | 36 tests pass (31 existing + 2 consolidation + 2 M2 + 1 M4). |
| 4 | `data-*` dual-hook cleanup (M3) applied | **SATISFIED** | No `data-*` on `<group>`; regression asserted [Nameplate.test.tsx#L314-L323](frontend/test/scenes3d/Nameplate.test.tsx#L314-L323); zero `data-*` consumers across `frontend/src/**`. |

## Findings Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 0 |
| HIGH     | 0 |
| MEDIUM   | 3 |
| LOW      | 4 |

---

## CRITICAL

*(none)*

## HIGH

*(none)*

> **User question (a):** *Is this still a geometry-proxy problem dressed up as real text?*
> **No.** The production path is genuinely `drei <Text> → troika-three-text → SDF mesh`. Under happy-dom troika can't rasterize glyphs, so the test mock is a legitimate integration-surface proxy: it proves the component is invoked, with the right children, color, fontSize, anchors, maxWidth, and a two-line `"name\n$stack"` string — which are the exact inputs troika needs. The *visual* "does it actually light up pixels on a 360px viewport" assertion (bug AC 2) remains uncovered — filed below as MEDIUM M-1, not HIGH, because (i) troika is a well-known dependency, (ii) drei's `<Text>` has no conditional render paths we skip, and (iii) the world-unit legibility floor (`NAMEPLATE_FONT_SIZE ≥ 0.08`, `NAMEPLATE_WIDTH ≥ 0.6`) is still asserted. Escalate to HIGH only if the team decides screenshot coverage is a hard gate for this epic.

---

## MEDIUM

### M-1 — Bug AC 2 (screenshot / playwright) not implemented

The bug card explicitly calls for a "headless playwright or screenshot test [that] asserts label content visible at nominal camera distance." The landed change covers the *invocation surface* (spy on drei `<Text>` props/children), not the *visual* surface. Gaps this leaves open at runtime:

- troika's Roboto default font is fetched from Google Fonts at first mount ([troika-three-text `TextBuilder.js` docs comment](frontend/node_modules/troika-three-text/src/TextBuilder.js)) — a network blip in dev / corporate / offline env means **no glyphs, silently**. No test catches this.
- troika async-rasterizes in a Worker. If the Worker fails to spin up (CSP, sandboxing, Safari quirks) troika logs-and-continues — again, no glyphs, no test catches it.

**Recommendation:** add a Playwright test that loads the dev server table scene, waits for canvas readiness, and asserts pixel contrast in the nameplate bounding box exceeds a threshold. Track as a follow-up — file as P2 bug / task under epic `aia-core-6o9t`. Do **not** block this close on it; the user flagged this as acceptable deferred gap.

### M-2 — Bundled-font i18n / network risk (user question b)

troika's built-in default is **Roboto Regular** fetched at runtime from Google Fonts (confirmed in `node_modules/troika-three-text/src/TextBuilder.js:31`). Implications:

- **`$` is safe** (Basic Latin, always present in Roboto). User's currency-symbol concern is unfounded for USD.
- **Non-ASCII player names are NOT safe.** Roboto Regular doesn't ship CJK, Cyrillic, Devanagari, Hebrew, or Arabic glyphs. Players named "Иван", "陈", "محمد" will render as tofu boxes (.notdef glyphs), silently. Tests won't catch this because the mock is a div.
- **Stack amount is pinned ASCII today** by `formatStackAmount` (digits + `$` + `-` + `,`), so no immediate i18n risk on the stack line — but if locale-aware formatting lands later (e.g. `Intl.NumberFormat` with `€`, `¥`, `₱`, thin-space separators), some of those glyphs *are* in Roboto and some aren't (₱ and thin spaces are iffy).
- **Network dependency** — Google Fonts CDN is fetched on first mount in every deploy. This is a hidden SSR/offline risk for air-gapped tournament-room deploys. AIA runs in potentially-offline venue environments per `docs/deployment.md`.

**Recommendation:** self-host a font asset with broader Unicode coverage (e.g. Noto Sans Regular subset) and pass `font="/fonts/noto.woff"` to `<Text>`. Track under epic `aia-core-6o9t` as a P2 follow-up. Not blocking for this fix — safe for current English-only alpha.

### M-3 — M2 fix is narrower than user edge-cases imply (user question d)

`prevOccupiedRef` only detects the **`false → true`** (hidden → visible) transition at [Nameplate.tsx#L180-L192](frontend/src/scenes3d/components/Nameplate.tsx#L180-L192). Cases the landed M2 does **not** cover:

- **Alice → Bob seated at the same seat without an intermediate null frame** (name mutates while `occupied` stays `true`, stack is different): the reconcile branch at [Nameplate.tsx#L194-L213](frontend/src/scenes3d/components/Nameplate.tsx#L194-L213) will tween from Alice's displayed stack to Bob's new stack. This is a server-update race (same React render delivers new name + new stack) that slipped through M2. Not a regression — it's a pre-existing gap that M2 didn't widen.
- **`occupied` flipping on the same render as `stack` changes:** safe. The effect runs once with the new closure values, `wasOccupied=false` short-circuits the tween, and M2's snap branch wins. Verified by the phase-3 test at [Nameplate.test.tsx#L620-L645](frontend/test/scenes3d/Nameplate.test.tsx#L620-L645).
- **Mid-hand buy-in (stack changes, occupancy unchanged):** this is the *intended* AC 2 behavior — tween. Correct.

**Recommendation:** add a `prevPlayerNameRef` sentinel alongside `prevOccupiedRef`; treat a **name change while occupied** as another "snap, don't tween" boundary. File as P2 follow-up; reference this review in tasks.md Cycle 17. Not a regression caused by this cycle — don't block close on it.

---

## LOW

### L-1 — Mock drift risk across drei consumers (user question f)

Four files mock `@react-three/drei` with different shapes:

- [Nameplate.test.tsx#L29-L49](frontend/test/scenes3d/Nameplate.test.tsx#L29-L49) — `Text` + `textRenderSpy`
- [PokerTable.test.tsx#L28-L49](frontend/test/scenes3d/PokerTable.test.tsx#L28-L49) — `OrbitControls`, `PerspectiveCamera`, `Text` (no spy)
- [CameraRig.test.tsx](frontend/test/scenes3d/CameraRig.test.tsx) — `OrbitControls`, `PerspectiveCamera`
- [CameraPresetController.test.tsx](frontend/test/scenes3d/CameraPresetController.test.tsx) — similar

When T-022 / T-031 (or any new epic task) pulls another drei primitive (`<Html>`, `<Billboard>`, `<RoundedBox>`, `<Line>`), each consumer's mock must be updated independently. Any test that doesn't mock the new primitive will crash with the R3F unknown-tag warning (since R3F tag warnings are suppressed, the failure mode is subtle: test passes because the component silently renders nothing).

**Recommendation:** extract `frontend/test/scenes3d/__mocks__/drei.tsx` as the single mock source of truth; consumers import and extend it. File as P3 chore.

### L-2 — `BILLBOARD_EPSILON` export has no external consumer (user question e)

Grep confirms `BILLBOARD_EPSILON` is referenced only in its own file plus the Nameplate test. M4 ("export the tunable so other face-camera components can share it") is scaffolding without a consumer. No harm done, but worth either (a) marking the JSDoc "test-visibility export only until T-XXX lands `<Billboard>` helper", or (b) removing the export and widening test access via `@vitest-environment` attach — mild YAGNI.

### L-3 — `userData.stack` vs visible label divergence is intentional but undocumented

`userData.stack` mirrors the **source-of-truth prop** (the target of the tween), while the `<Text>` children show `displayedStack` (the in-flight tween value). This divergence is load-bearing — regression hooks that read `userData.stack` get the committed value, not the animation frame. The JSDoc block at the top of `Nameplate.tsx` doesn't call this out; the comment at [Nameplate.tsx#L274-L276](frontend/src/scenes3d/components/Nameplate.tsx#L274-L276) is easy to miss. Consider promoting to the file-level design notes.

### L-4 — `<planeGeometry>` background card is now structurally redundant with `<Text>` `outlineWidth`/`outlineColor` capability

troika's `<Text>` supports `outlineWidth` + `outlineColor` + `outlineOpacity` to create a legibility backdrop directly on the glyph mesh without a separate plane, which would (a) halve the draw calls per seat, (b) remove the z-fight risk currently mitigated by the `+0.001` Z offset. Not a correctness issue — pure perf/simplification. File under epic as a P3 polish task if/when perf profiling flags nameplates.

---

## Convention / Security / Design

- **Convention:** matches existing R3F component style in `frontend/src/scenes3d/components/*`. `/* eslint-disable react/no-unknown-property */` block is scoped correctly.
- **Security:** no user input paths changed; `playerName` and `stack` flow only into scene-graph text rendering. No XSS surface (three.js / troika treat text as opaque string). `formatStackAmount` uses `Math.abs` + integer paths only — no injection vector.
- **Design:** separation of concerns is clean — pure helpers (`formatStackAmount`, `computeNameplateWorldPosition`, `computeBillboardYRotation`) remain fully unit-testable and untouched by the drei migration.

---

## Close Recommendation

**APPROVE CLOSE on `aia-core-ovhb`.**

Zero CRITICAL, zero HIGH. The three MEDIUMs and four LOWs are all forward-looking — none invalidate the fix or regress T-016's four ACs. User's question (a) is resolved: this is not a geometry-proxy problem dressed up as real text; the code path is production-correct and the test coverage is the right shape for an unmockable WebGL dependency. The bug's own AC 2 (screenshot test) is a legitimate **deferred standing gap** the user already anticipated — log it against the epic as a P2 follow-up and move on.

### Follow-ups to file under epic `aia-core-6o9t`

1. **P2 task** — Playwright screenshot/contrast test for nameplate legibility (closes bug AC 2, resolves M-1 + partially M-2 network-failure detection).
2. **P2 task** — Self-hosted font asset for Unicode / offline resilience (M-2).
3. **P2 task** — `prevPlayerNameRef` snap on same-seat name change (M-3).
4. **P3 chore** — Shared `__mocks__/drei.tsx` to de-drift drei test mocks (L-1).
5. **P3 chore** — Either document `BILLBOARD_EPSILON` export intent or remove until first consumer lands (L-2).
