# Code Review — T-009 `<PokerTable>` top-level composition

**Loop Context:** Cycle 10 | Task: aia-core-31hx (T-009) | Epic: table-3d-revamp-010 | Date: 2026-04-18

**Review summary:** 10 findings (C: 0, H: 1, M: 4, L: 5)

---

## Scope

- Target: `<PokerTable>` — the keystone composition component driven purely by `TableState`.
- Files reviewed:
  - [frontend/src/scenes3d/PokerTable.tsx](frontend/src/scenes3d/PokerTable.tsx)
  - [frontend/test/scenes3d/PokerTable.test.tsx](frontend/test/scenes3d/PokerTable.test.tsx)
  - Cross-reference: [frontend/src/scenes3d/components/CameraRig.tsx](frontend/src/scenes3d/components/CameraRig.tsx), [frontend/src/scenes3d/components/ChipInstances.tsx](frontend/src/scenes3d/components/ChipInstances.tsx), [frontend/src/scenes3d/components/Card.tsx](frontend/src/scenes3d/components/Card.tsx), [frontend/src/scenes3d/components/tableLayout.ts](frontend/src/scenes3d/components/tableLayout.ts)
  - Spec: [specs/table-3d-revamp-010/tasks.md](specs/table-3d-revamp-010/tasks.md#L215-L229), [specs/table-3d-revamp-010/spec.md](specs/table-3d-revamp-010/spec.md#L94-L103), [specs/table-3d-revamp-010/plan.md](specs/table-3d-revamp-010/plan.md#L165-L215)
  - Legacy parity: [frontend/src/scenes/communityCards.ts](frontend/src/scenes/communityCards.ts#L4-L5)

---

## Findings

### CRITICAL

*(none)*

### HIGH

#### [H-1] `onReady` fires twice under React `<StrictMode>`

- **Location:** [frontend/src/scenes3d/PokerTable.tsx](frontend/src/scenes3d/PokerTable.tsx#L142-L145)
- **Description:** The app mounts with `<StrictMode>` (see [frontend/src/main.tsx](frontend/src/main.tsx#L13)). React 18 StrictMode runs every effect `mount → cleanup → mount` again in development to expose un-idempotent side effects. The current hook has no cleanup and no guard, so `onReady?.()` is invoked twice whenever the component mounts inside `<StrictMode>`.

  ```tsx
  useEffect(() => {
    onReady?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only
  }, []);
  ```

  The docstring and test both claim "exactly once on mount," but the test uses bare `@testing-library/react` `render()` (no StrictMode wrapper), so it silently passes while the production bundle double-fires in dev. This also makes the component susceptible to spurious double-invocation under any future concurrent-render remount (Suspense boundary, React Refresh, etc.). For a callback named `onReady` — typical usages are "record telemetry" or "drive a one-shot animation" — duplicate invocation is a behavioral contract violation.

- **Suggested fix:** Guard with a ref that survives StrictMode's double-mount:

  ```tsx
  const firedRef = useRef(false);
  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    onReady?.();
  }, [onReady]);
  ```

  Add a StrictMode-wrapped test:

  ```tsx
  render(<StrictMode><PokerTable state={makeState()} onReady={fn} /></StrictMode>);
  expect(fn).toHaveBeenCalledTimes(1);
  ```

### MEDIUM

#### [M-1] `seatChipPositions` memo invalidates on every `state.seats` identity change

- **Location:** [frontend/src/scenes3d/PokerTable.tsx](frontend/src/scenes3d/PokerTable.tsx#L148-L152)
- **Description:** The positions returned by `seatCommitChipWorldPosition` depend only on `seatIndex` and `seatCount`, both of which are stable for a given table geometry. But the memo key is `[state.seats, seatCount]`, so any seat mutation (stack change, lastAction, committedThisStreet, folded, etc.) produces a new `state.seats` reference, recomputes every position, and hands a **new array of new tuples** to every `<ChipStack>`. Each `<ChipStack>` then sees a new `position` prop and fires `registry.update()` → full `flush()` across all denominations. For T-011 (chip slides), this is a hot path; the current wiring causes redundant matrix rewrites on every field change, not just on chip-relevant changes.
- **Suggested fix:** Drop `state.seats` from the dep list and key on `seatCount` only:
  ```tsx
  const seatChipPositions = useMemo(
    () => Array.from({ length: seatCount }, (_, i) => seatCommitChipWorldPosition(i, seatCount)),
    [seatCount],
  );
  ```
  The tuple references are then stable across re-renders for the lifetime of a given seat count.

#### [M-2] World-coordinate chip placement silently depends on an un-asserted invariant

- **Location:** [frontend/src/scenes3d/PokerTable.tsx](frontend/src/scenes3d/PokerTable.tsx#L87-L102), [frontend/src/scenes3d/PokerTable.tsx](frontend/src/scenes3d/PokerTable.tsx#L222-L238)
- **Description:** The docstring and commit message claim chip positions "bypass parent group transforms because `ChipInstances` writes to scene-level InstancedMesh." That is half-true: `<ChipInstances>` renders the `<primitive object={mesh}>` as a child of `<group name="chip-instances">`, which is a child of `<group name="poker-table-scene">`. If any consumer ever applies a `position` / `rotation` / `scale` to the top-level scene root (a plausible migration pattern for placing multiple tables side-by-side, or for SessionReplayShell), chip matrices — computed in "world" coordinates by `seatCommitChipWorldPosition` — will be re-transformed by the parent and desync from `<Seat>` pads (which inherit the same transform). This is not tested.
- **Suggested fix:** Pick one and document it:
  1. Assert the invariant: the `poker-table-scene` root must never carry a transform; add a defensive `console.warn` in dev or a unit test that mounts with `<group position={[5,0,0]}>…` and asserts pot chips land at (5, 0, -0.9).
  2. Actually decouple: render `<ChipInstances>` via an R3F portal to the R3F `scene` so its matrices truly are world-space. This is the T-011-safe option.

#### [M-3] Per-seat chip stack renders even for inactive (empty) seats with stale `committedThisStreet`

- **Location:** [frontend/src/scenes3d/PokerTable.tsx](frontend/src/scenes3d/PokerTable.tsx#L231-L240)
- **Description:** The per-seat chip filter is `seat.committedThisStreet <= 0`. It doesn't check `seat.isActive`. In practice the adapter zeros `committedThisStreet` for inactive seats, but there's no schema guarantee — a stale `TableState` fixture (e.g. a seat that vacates mid-hand, or an integration test payload where `isActive` toggles but `committedThisStreet` lags) would cause chips to appear floating next to an empty seat pad. The hole-card filter correctly guards on `seat.isActive && !seat.folded`; the chip-stack filter should be symmetric.
- **Suggested fix:** Tighten the guard to `seat.isActive && seat.committedThisStreet > 0` and add a regression test: inactive seat with `committedThisStreet: 5` → no chip stack.

#### [M-4] `seatCommitChipWorldPosition` is a one-off helper that T-011 will need

- **Location:** [frontend/src/scenes3d/PokerTable.tsx](frontend/src/scenes3d/PokerTable.tsx#L87-L102)
- **Description:** The seat-local-to-world projection is mathematically non-trivial (`[sx + sin φ · z, sy, sz + cos φ · z]`) and will be re-used by T-011 (chip slide origin), T-016 (nameplate billboard origin), and T-019 (dealer-button rotation). Keeping it inline in `PokerTable.tsx` invites each downstream task to re-derive it. It also isn't unit-tested in isolation — correctness is asserted only transitively via the "pot + seat chip aggregation" test (which uses a round pot total where per-seat position is indistinguishable).
- **Suggested fix:** Lift it to [frontend/src/scenes3d/components/tableLayout.ts](frontend/src/scenes3d/components/tableLayout.ts) as `seatLocalToWorld(seatIndex, seatCount, localZ, localX?)` and add unit tests pinning two or three seats at known angles. Unblocks T-011 cleanly.

### LOW

#### [L-1] Duplicated `chipCapacity` default (200)

- **Location:** [frontend/src/scenes3d/PokerTable.tsx](frontend/src/scenes3d/PokerTable.tsx#L137), [frontend/src/scenes3d/components/ChipInstances.tsx](frontend/src/scenes3d/components/ChipInstances.tsx#L40)
- **Description:** Both files bake in `200` as the default. If `DEFAULT_CAPACITY` in `ChipInstances` changes, the `<PokerTable>` default silently diverges.
- **Suggested fix:** Default to `undefined` in `<PokerTable>` and let `<ChipInstances>` apply its own default, **or** import `DEFAULT_CAPACITY` from `ChipInstances` and reference it here.

#### [L-2] `POT_CHIP_POSITION` is a module-level mutable tuple

- **Location:** [frontend/src/scenes3d/PokerTable.tsx](frontend/src/scenes3d/PokerTable.tsx#L84)
- **Description:** `const POT_CHIP_POSITION: [number, number, number] = [0, 0, -0.9];` is exported-by-reference to every `<ChipStack>` render. If `<ChipStack>` or `ChipInstances.flush` ever mutates the array (it doesn't today — it snapshots via `stack.position[0/1/2]`), this would be a time-bomb.
- **Suggested fix:** Mark with `as const` and `readonly` or wrap in `Object.freeze` at module scope for defensive immutability.

#### [L-3] Three separate `// eslint-disable-next-line @typescript-eslint/no-unused-vars` lines

- **Location:** [frontend/src/scenes3d/PokerTable.tsx](frontend/src/scenes3d/PokerTable.tsx#L124-L129)
- **Description:** Reserved props are each disabled individually. Noisy and easy to misalign if props are reordered.
- **Suggested fix:** Rename the rest-destructured locals with a leading underscore and drop the disables, or use a single block comment above the destructuring that lists all reserved names.

#### [L-4] `onReady` identity is captured at mount

- **Location:** [frontend/src/scenes3d/PokerTable.tsx](frontend/src/scenes3d/PokerTable.tsx#L142-L145)
- **Description:** If a consumer passes a fresh `onReady={() => ...}` on every render, only the first one ever fires. This is intentional (per the comment), but the contract is not documented in the public JSDoc. Minor surprise for consumers migrating from imperative APIs where `onReady` is replayed.
- **Suggested fix:** Add one line to the `onReady?` JSDoc: "Captured at mount; later updates to this callback are ignored."

#### [L-5] Public-API JSDoc omits the scene-graph guarantee that tests depend on

- **Location:** [frontend/src/scenes3d/PokerTable.tsx](frontend/src/scenes3d/PokerTable.tsx#L107-L121)
- **Description:** The downstream test suite (and T-010, T-011, T-019) relies on specific `<group name="...">` selectors: `poker-table-scene`, `community-cards`, `seats`, `hole-cards`, and `chip-instances` (from `<ChipInstances>`). None of these names are documented as contract in the component docstring. Tomorrow's refactor that renames `"seats"` → `"seat-group"` will silently break animation modules.
- **Suggested fix:** Add a "Scene-graph contract" list to the component docstring enumerating the stable group names.

---

## AC Verification

| AC | Status | Notes |
|----|--------|-------|
| AC-1 — End-to-end scene equivalent to `pokerScene.ts` | SATISFIED | Table (felt + rail), per-seat pads, community cards, face-down hole placeholders, pot + per-seat chip stacks all wired. Community spacing `0.52` and leftmost `-1.04` match [frontend/src/scenes/communityCards.ts](frontend/src/scenes/communityCards.ts#L4-L5) exactly. |
| AC-2 — State prop changes re-render without remounting canvas / leaking WebGL contexts | SATISFIED | Test "updates on state prop change without recreating the ChipInstances meshes" asserts same `InstancedMesh` identity after re-render ([test line ~260-274](frontend/test/scenes3d/PokerTable.test.tsx#L260)). Card uv attrs mutate in place. |
| AC-3 — Parity test compares scene-graph shape against expected counts | SATISFIED | "parity: 9-seat hand at flop" covers seats (9), community cards (3), hole cards (14), chip counts (decomposed via `chipCountsFor(10, 20)`). |
| AC-4 — Existing `pokerScene.ts` + consumers unchanged; new scene side-by-side | SATISFIED | New file at `frontend/src/scenes3d/PokerTable.tsx`; legacy `frontend/src/scenes/*.ts` untouched. |

### Focus-area verdicts

- **(a) Keystone correctness — state→scene-graph mapping:** Correct. Community → non-null slots only, at `y=0.02`, spacing `0.52`, leftmost `-1.04` (legacy parity). Seats → one pad per `state.seats` entry, hole cards only when `isActive && !folded`. Chips → pot when `> 0`, per-seat when `committedThisStreet > 0`. One minor gap flagged in M-3 (inactive-seat symmetry).
- **(b) Temporary hole-card placeholder safety pre-T-024:** **Safe.** Every placeholder is constructed with `id={null}` and `faceUp={false}`. [`Card.resolveCanonicalId`](frontend/src/scenes3d/components/Card.tsx#L72-L76) returns `BACK_KEY` on both conditions independently, so neither a stale id nor a flipped `faceUp` in isolation can reveal a face. The test asserts `data-card-id="back"` and `data-face-up="false"` for all placeholders. No information leak possible in T-009. T-025 will add the real gate.
- **(c) World-coordinate `<ChipStack>` placement:** Math is correct (verified below), but consistency with parent-group transforms is an un-asserted invariant — see M-2. Compatibility with T-011 animations: good in principle (shared scene-frame lets T-011 tween seat → pot positions via the same registry), but M-1 and M-4 will cause friction when T-011 lands. $\varphi = -\theta - \pi/2 \Rightarrow (\sin\varphi, \cos\varphi) = (-\cos\theta, -\sin\theta)$, matching the inward radial direction. Seat chips at `[sx + \sin\varphi \cdot 0.8, 0, sz + \cos\varphi \cdot 0.8]` land `0.8` world-units inward from the seat pad — correct.
- **(d) Community layout vs plan.md:** `COMMUNITY_CARD_SPACING = 0.52`, `COMMUNITY_START_X = -2 * 0.52 = -1.04`, `COMMUNITY_CARD_Y = 0.02`. Exact parity with [frontend/src/scenes/communityCards.ts](frontend/src/scenes/communityCards.ts#L4-L5). Plan.md does not pin specific numeric values; legacy module is the de-facto spec and matches.
- **(e) Reserved props — non-functional today?** All three (`equityOverlay`, `cameraPreset`, `onPresetChange`) are destructured with underscore aliases and explicit `@typescript-eslint/no-unused-vars` disables. No code path consumes them. Safe. (L-3 flags stylistic cleanup only.)
- **(f) StrictMode + `onReady` exactly once:** **Broken in dev.** See H-1. The `[]`-deps useEffect will invoke `onReady` twice under `<StrictMode>` (which wraps the entire app in [frontend/src/main.tsx](frontend/src/main.tsx#L13)). Production bundle mounts once so end-users aren't affected, but the documented "exactly once" contract fails under the dev invariant that StrictMode is designed to catch.
