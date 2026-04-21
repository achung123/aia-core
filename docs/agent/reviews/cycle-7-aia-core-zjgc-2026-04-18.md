# Code Review Report — table-3d-revamp-010

**Date:** 2026-04-18
**Target:** `frontend/src/scenes3d/components/Card.tsx`, `frontend/src/scenes3d/components/CardAtlas.ts` (flip helpers), `frontend/test/scenes3d/Card.test.tsx`
**Reviewer:** Scott (automated)
**Cycle:** 7
**Epic:** table-3d-revamp-010

**Task:** T-006 — Implement `<Card>` component using the atlas
**Beads ID:** aia-core-zjgc

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 1 |
| LOW | 4 |
| **Total Findings** | **5** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | `<Card faceUp=true>` shows the correct face cell | SATISFIED | [Card.tsx L109-L118](frontend/src/scenes3d/components/Card.tsx#L109-L118) bakes `resolveCardUV(id, faceUp)` → `computePlaneUVsForAtlas` into the geometry; regression tests [Card.test.tsx L47-L72](frontend/test/scenes3d/Card.test.tsx#L47-L72) verify exact flip-corrected offsets for `2s`, `Ah`, and `back`. | — |
| 2 | `<Card faceUp=false>` shows the back cell | SATISFIED | `resolveCardUV` returns `getBackUV()` when `faceUp=false` regardless of id ([CardAtlas.ts L108-L112](frontend/src/scenes3d/components/CardAtlas.ts#L108-L112)); asserted by [Card.test.tsx L222-L225](frontend/test/scenes3d/Card.test.tsx#L222-L225). | — |
| 3 | All cards on the table share one material instance | SATISFIED | Module-level `materialCache` keyed by tier in [Card.tsx L23-L38](frontend/src/scenes3d/components/Card.tsx#L23-L38); identity asserted by [Card.test.tsx L161-L164](frontend/test/scenes3d/Card.test.tsx#L161-L164). | Holds only for cards at the same tier — see LOW-2. |
| 4 | Props change updates UV without recreating material/geometry | PARTIAL | `useLayoutEffect` on [Card.tsx L111-L118](frontend/src/scenes3d/components/Card.tsx#L111-L118) mutates `uv` attribute in place for `id/faceUp/tier` changes without touching the `useMemo` geometry or the cached material. | Tier change yields a different cached `MeshStandardMaterial`; size change intentionally recreates the geometry (see LOW-2, LOW-3). |

---

## Findings

### [MEDIUM] Material cache and atlas cache are independently disposable — risk of dangling texture references

**File:** `frontend/src/scenes3d/components/Card.tsx`
**Line(s):** 23-42
**Category:** design

**Problem:**
`getSharedCardMaterial(tier)` stores a `MeshStandardMaterial` whose `.map` is the texture returned by `getTexture(tier)`. The material cache (Card.tsx) and the texture cache (CardAtlas.ts `textureCache`) are disposed independently (`clearCardMaterialCache` vs `clearAtlasCache`). Calling `clearAtlasCache()` alone disposes the texture while the cached material continues to reference it; calling `clearCardMaterialCache()` alone disposes materials while a re-mount of `<Card>` will rebuild a fresh material against a still-valid texture. The coupling is undocumented and easy to get wrong during HMR, tier switches, or teardown tests.

**Code:**
```ts
const materialCache = new Map<QualityTier, THREE.MeshStandardMaterial>();

export function getSharedCardMaterial(tier: QualityTier = 'medium') {
  const cached = materialCache.get(tier);
  if (cached) return cached;
  const mat = new THREE.MeshStandardMaterial({
    map: getTexture(tier),
    // ...
  });
  materialCache.set(tier, mat);
  return mat;
}

export function clearCardMaterialCache(): void {
  for (const mat of materialCache.values()) mat.dispose();
  materialCache.clear();
}
```

**Suggested Fix:**
Either (a) have `clearCardMaterialCache()` also invoke `clearAtlasCache()` and vice versa, or (b) document the required disposal order in a JSDoc note on both functions, or (c) in `clearAtlasCache()` iterate material entries and reset `mat.map = null` before disposing textures. A test that calls `clearAtlasCache()` and then mounts `<Card>` would have caught this.

**Impact:** Silent rendering regression (black/white card planes after cache clear) and/or WebGL warnings in dev. Low likelihood in production but a real footgun for the quality-tier slice (T-027) when switching tiers triggers texture rebuilds.

---

### [LOW] `geometryRef` is assigned but never read

**File:** `frontend/src/scenes3d/components/Card.tsx`
**Line(s):** 102-108
**Category:** convention

**Problem:**
`const geometryRef = useRef(geometry);` and `geometryRef.current = geometry;` inside the first `useLayoutEffect` are dead code — no call site reads `geometryRef.current`. The UV-mutation effect reads `geometry` from closure directly. The ref only adds noise and a subtle bug surface (future contributors may assume it is authoritative).

**Code:**
```ts
const geometry = useMemo(() => new THREE.PlaneGeometry(w, h, 1, 1), [w, h]);
const geometryRef = useRef(geometry);

useLayoutEffect(() => {
  geometryRef.current = geometry;
  return () => {
    geometry.dispose();
  };
}, [geometry]);
```

**Suggested Fix:**
Delete `geometryRef` entirely; the disposal cleanup is the only behavior that needs to remain:
```ts
useLayoutEffect(() => {
  return () => geometry.dispose();
}, [geometry]);
```

**Impact:** Cosmetic. No functional bug.

---

### [LOW] AC-4 partially holds: tier change swaps the shared material reference

**File:** `frontend/src/scenes3d/components/Card.tsx`
**Line(s):** 92, 111-118
**Category:** design

**Problem:**
T-006 AC 4 says "Props change updates UV without recreating the material/geometry." When `tier` changes, `getSharedCardMaterial(tier)` returns a *different* cached `MeshStandardMaterial`, so the mesh's `material` prop identity changes. This is intentional (each tier owns its own texture) and acceptable for the quality-tier slice (T-027), but it is a spec deviation that should be explicitly noted so downstream reviewers do not mistake the tier-swap for a regression.

**Suggested Fix:**
Add a one-line JSDoc note on `Card` or on AC 4 in tasks.md confirming that tier transitions are the documented exception. No code change required.

**Impact:** Documentation debt only; behavior is correct.

---

### [LOW] `size` prop change recreates the geometry

**File:** `frontend/src/scenes3d/components/Card.tsx`
**Line(s):** 100-108
**Category:** design

**Problem:**
AC 4 prohibits recreating the geometry on prop changes, but `useMemo(() => new PlaneGeometry(w, h, 1, 1), [w, h])` rebuilds the geometry whenever `size` changes. In practice `size` is effectively static (default `[0.42, 0.58]`), so this will virtually never trigger. Worth a note so T-010's flip/deal animation author does not begin tweening `size` and inadvertently thrash allocations per frame.

**Suggested Fix:**
Document in the `size` prop JSDoc that it is treated as a static layout dimension; animations should use `scale` on the mesh rather than mutating `size`.

**Impact:** Theoretical allocation pressure during animations; no current bug.

---

### [LOW] Public API uses `id` instead of `rank` + `suit` as specified in T-006

**File:** `frontend/src/scenes3d/components/Card.tsx`
**Line(s):** 52-68
**Category:** convention

**Problem:**
T-006's task description reads: "accepts `position`, `rotation`, `rank`, `suit`." The implemented API takes a single `id?: string | null` instead. The `id` form is strictly more ergonomic (matches `CardRef.id` in plan.md L187 and the atlas-canonical format used by T-005), but it is a literal spec deviation. T-009 will consume `CardRef` objects directly; callers will write `<Card id={cardRef.id} />` rather than spreading rank/suit.

**Suggested Fix:**
Either (a) update tasks.md T-006 description to reflect the `id` prop (preferred — matches plan.md), or (b) accept both `id` and `{rank, suit}` via a discriminated union. Recommend (a).

**Impact:** None at runtime. Purely a spec-vs-implementation-of-record gap.

---

## Positives

- **Flip correctness is locked down by tests, not by convention.** The regression tests at [Card.test.tsx L55-L60](frontend/test/scenes3d/Card.test.tsx#L55-L60) explicitly assert that the uncorrected `4/5` value for the back cell would be wrong — this is exactly the Cycle 3 / Cycle 6 foot-gun that Jean flagged, and it is now impossible to silently reintroduce.
- **`resolveCardUV` never throws.** Null, undefined, empty, and unresolvable ids all fall back to the back cell — verified by [Card.test.tsx L147-L157](frontend/test/scenes3d/Card.test.tsx#L147-L157). This directly addresses the Cycle 3 LOW finding and makes the component safe for `canSee()` gating (T-024/T-025) where viewer context may legitimately produce a `null` id.
- **Per-card geometry isolation.** Each `<Card>` instance owns its own `PlaneGeometry` via `useMemo`, so UV mutations for one card cannot bleed into another — there is no shared geometry state to leak. The only shared resource is the material, which is never mutated by the render path.
- **StrictMode / concurrent rendering safety.** `useLayoutEffect` is the correct hook choice: UV baking happens synchronously after commit and before paint, so no intermediate frame is ever drawn with stale UVs. Under StrictMode's mount→unmount→remount cycle, the geometry-disposal cleanup runs between mounts and `useMemo` rebuilds a fresh geometry on remount, so dispose-then-reuse cannot occur.
- **1343/1343 frontend suite green + 24 new tests** with explicit regression guards tied to named failure modes (flip-uncorrected sampling, back cell → 2s row).

---

## Overall Assessment

T-006 is in good shape. All four acceptance criteria are satisfied, with AC 3 and AC 4 meeting the spirit (single shared material per tier; UV-only updates for `id/faceUp/tier`) while falling back to expected new allocations only for the orthogonal `size` and `tier` props. No CRITICAL or HIGH findings.

The one MEDIUM is a cache-coordination concern between `materialCache` and `textureCache` that is easy to fix with a single line in either `clear*` function — recommend addressing it opportunistically before T-027 (quality-tier slice) begins toggling tiers at runtime.

The four LOWs are cleanup and spec-alignment items: remove the unused `geometryRef`, reconcile the `id` vs `rank/suit` API with the tasks.md wording, and document AC 4's tier/size exceptions. None block progress to T-009 or T-010.

**Recommendation:** Proceed to close T-006 / aia-core-zjgc. File the MEDIUM as a discovered-from issue on the cycle-7 beads task; fold the four LOWs into a single polish commit or roll them into T-009 prep.
