# Code Review Report — table-3d-revamp-010

**Date:** 2026-04-18
**Cycle:** 6
**Target:** `frontend/src/scenes3d/components/CardAtlas.ts` + `frontend/src/scenes3d/index.ts` + `frontend/test/scenes3d/CardAtlas.test.ts`
**Reviewer:** Scott (automated, loop-review)

**Task:** T-005 — Implement `CardAtlas` texture builder
**Beads ID:** aia-core-rk6j
**Epic:** table-3d-revamp-010

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 2 |
| LOW | 4 |
| **Total Findings** | **6** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | `CardAtlas.getTexture(tier)` returns a memoized `THREE.Texture` | SATISFIED | [CardAtlas.ts#L119-L125](../../../frontend/src/scenes3d/components/CardAtlas.ts#L119-L125); tests "returns a THREE.Texture instance" / "memoizes by tier" | Module-level `Map<QualityTier, THREE.Texture>` cache. |
| 2 | `CardAtlas.getUV(rank, suit)` returns `{ u, v, w, h }` for the face cell | SATISFIED | [CardAtlas.ts#L78-L89](../../../frontend/src/scenes3d/components/CardAtlas.ts#L78-L89); tests in `CardAtlas.getUV` describe block | Throws on invalid rank/suit — stricter than AC but reasonable. |
| 3 | Atlas contains exactly 53 cells (52 faces + 1 back) at predictable coordinates | SATISFIED | [CardAtlas.ts#L28-L45](../../../frontend/src/scenes3d/components/CardAtlas.ts#L28-L45); test "produces exactly 52 unique face UVs" + back-collision test | Grid is 13×5 (not plan.md's 7×8) — see Finding M-1. |
| 4 | Test asserts deterministic UV mapping for a sample of ranks/suits | SATISFIED | [CardAtlas.test.ts#L40-L73](../../../frontend/test/scenes3d/CardAtlas.test.ts#L40-L73) | 2s / Ah / 10d / Kc corner checks + determinism test. |

All four AC satisfied.

---

## Findings

### [MEDIUM] UV convention places a non-trivial contract on every T-006 consumer

**File:** [frontend/src/scenes3d/components/CardAtlas.ts](../../../frontend/src/scenes3d/components/CardAtlas.ts)
**Line(s):** 12–16, 68–70
**Category:** design

**Problem:**
`AtlasUV` is returned in **image space** (v measured from the top), but `THREE.CanvasTexture` defaults to `flipY = true`, which means `material.map.offset.y` is measured from the **bottom**. The header comment tells consumers they must translate `v → 1 - v - h` themselves. This is an easy-to-forget foot-gun — T-006 has to remember this for every `<Card>` instance, and any future consumer (showdown glow, deal animation, etc.) has the same hazard. A single off-by-one mistake will render the wrong card and the bug will be visually subtle (e.g. `10d` appearing where `9d` should be).

**Code:**
```ts
// UV convention: { u, v, w, h } describe the cell in *image* space
// (u from the left, v from the top, both in [0,1]). Consumers that set
// `material.map.offset`/`repeat` on a texture with `flipY = true`
// (default for CanvasTexture) should translate v → 1 - v - h.
```

**Suggested Fix:**
Either (a) expose a small helper `getTextureOffsetRepeat(rank, suit)` that returns the three.js-ready `{ offsetX, offsetY, repeatX, repeatY }` with the flip pre-applied, or (b) set `texture.flipY = false` in `buildAtlasTexture` and document image-space as the single truth. Option (a) keeps the raw UV useful for non-three.js callers (SVG previews, debug overlays) and is the safer default for T-006.

**Impact:** Mitigates predictable T-006 integration bugs without changing the current public API shape.

---

### [MEDIUM] No test exercises the `ctx === null` fallback path

**File:** [frontend/src/scenes3d/components/CardAtlas.ts](../../../frontend/src/scenes3d/components/CardAtlas.ts)
**Line(s):** 147–163
**Category:** correctness

**Problem:**
`buildAtlasTexture` guards `if (ctx)` and then builds a `CanvasTexture` regardless of whether drawing happened. If `getContext('2d')` returns `null` (which is the actual behavior in many JSDOM-without-canvas test environments), `getTexture` silently returns an empty texture. None of the 24 tests verify that this branch produces a usable texture object (they only assert `instanceof THREE.Texture` and `image.width`, both of which pass with an undrawn canvas). If a future quality-tier change or a real headless browser ever hits this path in production, blank cards would ship undetected.

**Code:**
```ts
if (ctx) {
  ctx.clearRect(0, 0, size, size);
  for (const suit of SUITS) {
    for (const rank of RANKS) { /* ... */ }
  }
  drawCardBack(/* ... */);
}

const texture = new THREE.CanvasTexture(canvas as HTMLCanvasElement);
```

**Suggested Fix:**
Add one test that forces the null-ctx path (e.g. spy on `HTMLCanvasElement.prototype.getContext` to return `null`) and asserts either that a texture is still returned without throwing **or** that `buildAtlasTexture` throws a clear error. Either contract is fine — what matters is that it's pinned by a test so it can't silently regress.

**Impact:** Closes an AC-adjacent gap: AC #1 says "returns a memoized `THREE.Texture`", but there's no evidence the texture is *drawn* in the environment the tests run in.

---

### [LOW] 13×5 grid layout diverges from plan.md's 7×8 pseudocode (accepted)

**File:** [frontend/src/scenes3d/components/CardAtlas.ts](../../../frontend/src/scenes3d/components/CardAtlas.ts)
**Line(s):** 28–45
**Category:** convention

**Problem:**
plan.md § "Card Atlas" shows `cellW = size / 8, cellH = size / 7` with `RANKS.forEach((rank, col) => …)`. Since `RANKS.length === 13`, that loop overflows column 7 and writes outside the grid — the pseudocode is internally inconsistent. Hank chose a 13×5 layout (13 cols for ranks × 4 suit rows + 1 back row). This is the obvious correct fix; the divergence is with a spec artifact that could not have compiled.

**Suggested Fix:**
No code change required. Update plan.md § "Card Atlas" to describe the realized 13×5 layout so downstream readers aren't misled. Consider filing a discovered-from issue against the plan, or letting Jean fold the correction into the next planning pass.

**Impact:** Documentation hygiene only — AC #3 ("53 cells at predictable coordinates") is honored.

---

### [LOW] Duplicate `ctx.font` assignment when drawing face glyphs

**File:** [frontend/src/scenes3d/components/CardAtlas.ts](../../../frontend/src/scenes3d/components/CardAtlas.ts)
**Line(s):** 208–211
**Category:** convention

**Problem:**
`drawCardFace` sets `ctx.font` twice to the same value before drawing the rank and the suit glyph. The second assignment is a no-op — likely a copy-paste leftover that hints the two draws were originally meant to use different font sizes (e.g. larger suit glyph).

**Code:**
```ts
ctx.font = `bold ${Math.round(h * 0.38)}px sans-serif`;
ctx.fillText(rank, cx, y + h * 0.38);
ctx.font = `bold ${Math.round(h * 0.38)}px sans-serif`;
ctx.fillText(glyph, cx, y + h * 0.7);
```

**Suggested Fix:**
Either drop the redundant line or change the glyph line to a deliberately different size (e.g. `h * 0.5`). The redundancy is harmless but confusing.

**Impact:** Readability only.

---

### [LOW] `clearAtlasCache` has no test that asserts a rebuild occurs

**File:** [frontend/test/scenes3d/CardAtlas.test.ts](../../../frontend/test/scenes3d/CardAtlas.test.ts)
**Line(s):** 155–157
**Category:** correctness

**Problem:**
`clearAtlasCache` is called in `beforeEach` to isolate tests, but no test asserts the observable contract: that after `clearAtlasCache()`, the next `getTexture(tier)` returns a **new** instance (not the disposed one) and that the previous texture was disposed. Without this, a future refactor could silently break the disposal path (e.g. `clear()` on the map without walking values and calling `dispose()`) and the suite would stay green.

**Suggested Fix:**
Add a test that does: `const a = getTexture('high'); clearAtlasCache(); const b = getTexture('high'); expect(a).not.toBe(b);` plus a spy on `THREE.Texture.prototype.dispose` asserting it was called once.

**Impact:** Tightens the test hook's contract so future refactors can't drift.

---

### [LOW] `getUVById` silently diverges on case, but the policy isn't pinned

**File:** [frontend/src/scenes3d/components/CardAtlas.ts](../../../frontend/src/scenes3d/components/CardAtlas.ts)
**Line(s):** 91–105
**Category:** design

**Problem:**
`getUVById('AH')` returns `null` because suit letters are case-sensitive. The test at [CardAtlas.test.ts#L134](../../../frontend/test/scenes3d/CardAtlas.test.ts#L134) encodes this as intentional, but neither the module doc comment nor the JSDoc on `getUVById` states the case-sensitivity contract. Existing card-id formats elsewhere in the codebase (`handsToTableState`, dealer fixtures) should be verified to match `lowercase-suit` before T-006 binds this function.

**Suggested Fix:**
Add one sentence to the `getUVById` JSDoc: `"Suit letters must be lowercase ('s'|'h'|'d'|'c'); ranks are uppercase except '10'."` Optionally normalize input with `.toLowerCase()` on the suit character if upstream card ids turn out to be inconsistent — defer that call to T-006 once real consumer data is in view.

**Impact:** Prevents a likely T-006 integration hiccup; no production risk today.

---

## Positives

- **Module-level API is clean and minimal.** Switching from a component to a plain TS module is the right call for a build-once texture; it avoids an unnecessary React lifecycle and makes the memoization trivially reasoned about.
- **Strong runtime guards on `getUV`** — unknown rank/suit throw with named-parameter error messages rather than returning `undefined` UVs that would silently break rendering.
- **Memoization is correct and tier-aware** — verified by tests that same-tier returns identical instances and different tiers return distinct instances.
- **`clearAtlasCache` walks the map and calls `dispose()` on each texture** before clearing — the correct disposal order (`dispose()` first, then drop references). This is better than many atlas implementations that leak GPU memory on test teardown.
- **Canvas acquisition has a graceful `OffscreenCanvas` → `document.createElement('canvas')` fallback** wrapped in try/catch, which will keep tests portable across JSDOM, happy-dom, and real browsers.
- **Atlas size matches plan.md exactly** — 1024² on low, 2048² on medium/high, with a single source of truth (`getAtlasSize`) used both by consumers and by `buildAtlasTexture`.
- **24 unit tests is thorough for ~230 LOC** — constants, corner cells, determinism, full 52-face uniqueness, invalid inputs, back non-collision, id resolution, memoization, sizing — all covered.

---

## Overall Assessment

**Ship-ready with two MEDIUM follow-ups.** T-005 cleanly satisfies all four acceptance criteria. The implementation is simpler, more testable, and better scoped than plan.md's pseudocode (which could not have compiled as written). The 13×5 grid is the obvious pragmatic correction and should be back-ported to plan.md.

The two MEDIUMs are not blockers for T-005 itself, but both meaningfully de-risk T-006:

1. **Finding M-1 (UV convention)** is the single most important follow-up. A one-line helper that returns three.js-ready offset/repeat values — or flipping the texture's `flipY` — would prevent an entire class of visually subtle T-006 bugs. Recommend handling this either in a T-005 follow-up commit or as the first step of T-006 before any `<Card>` mesh is wired.
2. **Finding M-2 (null-ctx path)** is cheap to pin down with one test and prevents silent regressions in headless environments.

The four LOWs are polish and documentation hygiene. None block progress on T-006.

**Recommendation:** Accept T-005 as satisfying AC, file follow-up issues for M-1 and M-2 (discovered-from aia-core-rk6j), and proceed to T-006.
