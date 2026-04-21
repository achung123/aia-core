# Tasks — 3D Table View Revamp

**Project ID:** table-3d-revamp-010
**Date:** 2026-04-18
**Total Tasks:** 35
**Status:** Draft

> **Reference material for every task below:** [plan.md](plan.md) contains the formal `canSee()` truth table, the `<PokerTable>` public API, the `TableState` / `SeatState` interfaces, the endpoint catalog, the quality-tier settings matrix, and the triple-layer equity enforcement model. Tasks cite plan sections by name rather than restating them.

---

## Task Index

| ID | Title | Category | Dependencies | Story Ref |
|---|---|---|---|---|
| T-001 | Verify R3F + React 19 compatibility and add dependencies | setup | none | S-1.1 |
| T-002 | Scaffold `scenes3d/` directory and `<PokerCanvas>` | setup | T-001 | S-1.1 |
| T-003 | Define `TableState` types and `handsToTableState` adapter | feature | T-002 | S-1.5 |
| T-004 | Build `<Table>` and `<Seat>` components with circular layout | feature | T-002 | S-1.2 |
| T-005 | Implement `CardAtlas` texture builder | feature | T-002 | S-1.3 |
| T-006 | Implement `<Card>` component using the atlas | feature | T-005 | S-1.3 |
| T-007 | Implement `<ChipStack>` with shared `InstancedMesh` | feature | T-002 | S-1.4 |
| T-008 | Implement `<CameraRig>` with drei OrbitControls | feature | T-004 | S-1.2 |
| T-009 | Wire `<PokerTable>` top-level component from state prop | feature | T-003,T-004,T-006,T-007,T-008 | S-1.5 |
| T-010 | Card deal + flip animation module with reduced-motion | feature | T-009 | S-2.1 |
| T-011 | Chip-slide animation (seat → pot) on bets/calls/raises | feature | T-009 | S-2.2 |
| T-012 | Pot sweep animation to winner(s) at hand end | feature | T-011 | S-2.3 |
| T-013 | Showdown reveal + winning-hand glow outline | feature | T-010 | S-2.4 |
| T-014 | PBR table materials, lighting, and env map | feature | T-004 | S-2.5 |
| T-015 | Zustand theme slice + settings panel UI | feature | T-009 | S-2.6 |
| T-016 | `<Nameplate>` with live stack tween and billboarding | feature | T-009 | S-3.1 |
| T-017 | Action-status badge on nameplate (fetch + render) | feature | T-016 | S-3.2 |
| T-018 | Action highlights: fold dim, bet glow, turn pulse | feature | T-016 | S-3.3 |
| T-019 | `<DealerButton>`, SB, BB markers with rotation animation | feature | T-009 | S-3.4 |
| T-020 | `<EquityBadge>` wired to equity endpoint | feature | T-016 | S-3.5 |
| T-021 | Camera presets: top-down / default / cinematic | feature | T-008 | S-4.1 |
| T-022 | Seat-POV camera preset with constrained orbit | feature | T-021 | S-4.2,S-5.2 |
| T-023 | Per-hand street scrubber UI + auto-play | feature | T-010 | S-4.3 |
| T-023b | `<SessionReplayShell>` — cross-hand timeline + speed controls (playback-only) | feature | T-023 | S-4.4 |
| T-024 | Visibility policy module + `canSee` function | feature | T-006 | S-5.1 |
| T-025 | Apply visibility policy through `<Card>` faceUp | feature | T-024,T-009 | S-5.1 |
| T-026 | Player-scoped equity + camera lock composition | feature | T-020,T-022,T-025 | S-5.3 |
| T-027 | Zustand quality-tier slice + tier mappings | feature | T-014 | S-6.1 |
| T-028 | `useFPSMonitor` + auto-degrade with toast | feature | T-027 | S-6.2 |
| T-029 | Mobile touch / tap-target / 360px-width audit | test | T-023 | S-6.3 |
| T-030 | Migrate `TableView3D.tsx` (dealer embed) to `<PokerTable>` | refactor | T-009,T-015,T-018,T-020 | S-7.1 |
| T-031 | Migrate `views/PlaybackView.tsx` (full-page playback + Session Timeline) | refactor | T-021,T-023,T-023b,T-015 | S-7.2 |
| T-032 | Migrate `pages/TableView.tsx` (player POV route) | refactor | T-025,T-026 | S-7.3 |
| T-033 | Delete `pokerScene.ts`, its tests, and dead helpers | refactor | T-030,T-031,T-032 | S-7.4 |
| T-034 | Update `docs/frontend/architecture.md` 3D section | docs | T-033 | S-7.4 |

---

## Task Details

### T-001 — Verify R3F + React 19 compatibility and add dependencies

**Category:** setup
**Dependencies:** none
**Story Ref:** S-1.1

Look up current `@react-three/fiber` and `@react-three/drei` versions via Context7 MCP, confirm React 19 + `three@0.183.2` compatibility, and add them to `frontend/package.json`. The three consumer file paths are now confirmed (no discovery needed):

| Consumer | File | Route |
|---|---|---|
| Dealer embed | [frontend/src/dealer/TableView3D.tsx](frontend/src/dealer/TableView3D.tsx) | `#/dealer` (embedded) |
| Full-page playback | [frontend/src/views/PlaybackView.tsx](frontend/src/views/PlaybackView.tsx) | `#/playback?gameId=<id>` (entered from "▶ Playback" button in [DataView.tsx](frontend/src/views/DataView.tsx) ~line 833) |
| Player POV | [frontend/src/pages/TableView.tsx](frontend/src/pages/TableView.tsx) | `#/player/table?game=<id>&player=<name>` |

**Install command:**
```bash
cd frontend && npm install @react-three/fiber@latest @react-three/drei@latest
```

**Acceptance Criteria:**
1. `frontend/package.json` includes verified-compatible `@react-three/fiber` and `@react-three/drei` versions.
2. `npm install` succeeds without peer-dep errors in the `frontend/` workspace.
3. The location of the player interface route (for T-032) is documented in a comment or PR note.
4. Existing frontend test suite still passes (`cd frontend && npm test`).

---

### T-002 — Scaffold `scenes3d/` directory and `<PokerCanvas>`

**Category:** setup
**Dependencies:** T-001
**Story Ref:** S-1.1

Create the `frontend/src/scenes3d/` tree (empty files per the Plan structure) and implement a minimal `<PokerCanvas>` that wraps R3F `<Canvas>` with baseline camera, ambient + directional lighting, and dpr defaults. Add a Vitest smoke test.

**Acceptance Criteria:**
1. The directory structure matches the Plan's `scenes3d/` tree (files can be empty stubs where appropriate).
2. `<PokerCanvas>` renders an empty R3F scene with `PerspectiveCamera`, ambient + directional light, and dpr capped at 2.
3. A smoke test mounts `<PokerCanvas>` (with the R3F test renderer or a mocked WebGL context) and asserts no errors.
4. Existing `pokerScene.ts` is unchanged.

---

### T-003 — Define `TableState` types and `handsToTableState` adapter

**Category:** feature
**Dependencies:** T-002
**Story Ref:** S-1.5

Define `TableState`, `SeatState`, `CardRef`, `ViewerContext`, `QualityTier` in `scenes3d/types.ts` — exact shapes specified in plan.md § "Public API". Implement `handsToTableState` in `scenes3d/data/handsToTableState.ts` — exact pseudocode in plan.md § "Adapter". Replaces the scattered `handToCardData` / `buildSeatPlayerMap` / `computeStreetIndex` helpers in [frontend/src/dealer/TableView3D.tsx](frontend/src/dealer/TableView3D.tsx).

**Signature:**
```ts
export function handsToTableState(input: {
  game: GameSessionResponse;
  hand: HandResponse;
  status?: HandStatusResponse;
  actions?: HandActionResponse[];
  viewer: { policy: 'spectator'|'player'; seat?: number };
}): TableState;
```

**Inputs (all shapes documented in [frontend/src/api/types/game.ts](frontend/src/api/types/game.ts) and [frontend/src/api/types/dealer.ts](frontend/src/api/types/dealer.ts)):**
- `GameSessionResponse.players[].seat_number` → drives seat layout
- `HandResponse.player_hands[]` → hole cards, result, profit_loss, outcome_street
- `HandResponse.{flop_1, flop_2, flop_3, turn, river, pot, side_pots, sb_player_name, bb_player_name}` → community + blinds
- `HandStatusResponse.players[].{current_chips, pot_contribution, last_action, is_current_turn}` → live seat state
- `HandStatusResponse.{phase, current_player_name, pot, side_pots}` → phase + active seat
- `HandActionResponse[]` → `sumActions(name, phase)` for `committedThisStreet`

**Acceptance Criteria:**
1. `TableState` matches the shape in plan.md § "Public API".
2. `handsToTableState` handles fixture cases: `awaiting_cards`, `preflop`, `flop`, `turn`, `river`, `showdown`, all-in, multi-way split pot, fold-before-showdown, null `status` (falls back to `derivePhase(hand)`), null `actions` (committedThisStreet=0).
3. `sbSeat` / `bbSeat` / `currentSeat` correctly resolve `player_name` → seat number via the `seatByName` map; unknown names → `null` (not thrown).
4. `streetIndex` follows: `awaiting_cards|preflop`=0, `flop`=1, `turn`=2, `river`=3, `showdown`=4 (matches existing [frontend/src/components/StreetScrubber.tsx](frontend/src/components/StreetScrubber.tsx) ordering).
5. Vitest tests cover each case plus a regression fixture for a 6-player all-in + split pot taken from an existing backend test fixture.

---

### T-004 — Build `<Table>` and `<Seat>` components with circular layout

**Category:** feature
**Dependencies:** T-002
**Story Ref:** S-1.2

Implement `<Table>` (flat cylinder + rail) and `<Seat>` (seat marker/pad) with the same circular seat positioning as `pokerScene.ts`.

**Acceptance Criteria:**
1. `<Table>` renders a felt disc + rail ring.
2. `<Seat>` accepts `seatIndex`, `seatCount`, `playerName`, `isActive` and positions itself on a circle.
3. Tests assert 9 seats spaced at 360/9 degrees and that `isActive=false` reduces opacity.
4. Component output matches (within tolerance) the current seat layout from `pokerScene.ts`.

---

### T-005 — Implement `CardAtlas` texture builder

**Category:** feature
**Dependencies:** T-002
**Story Ref:** S-1.3

Build a module that generates a single texture atlas (2048×2048 default, 1024×1024 Low tier) containing 52 faces + 1 back. Re-use the existing glyph-drawing logic from `pokerScene.ts`.

**Acceptance Criteria:**
1. `CardAtlas.getTexture(tier)` returns a memoized `THREE.Texture`.
2. `CardAtlas.getUV(rank, suit)` returns `{ u, v, w, h }` for the face cell.
3. The atlas contains exactly 53 cells (52 faces + 1 back), mapped to predictable coordinates.
4. A test asserts deterministic UV mapping for a sample of ranks/suits.

---

### T-006 — Implement `<Card>` component using the atlas

**Category:** feature
**Dependencies:** T-005
**Story Ref:** S-1.3

`<Card>` renders a textured plane with atlas UV offsets. Supports `faceUp` toggle (flip to back texture UV) and accepts `position`, `rotation`, `rank`, `suit`.

**Acceptance Criteria:**
1. `<Card>` with `faceUp=true` shows the correct face cell.
2. `<Card>` with `faceUp=false` shows the back cell.
3. All cards on the table share a single material reference (verified by a test mounting multiple cards and asserting one shared material instance).
4. Props change updates UV without recreating the material/geometry.

---

### T-007 — Implement `<ChipStack>` with shared `InstancedMesh`

**Category:** feature
**Dependencies:** T-002
**Story Ref:** S-1.4

Provide a scene-level `<ChipInstances>` container that owns one `InstancedMesh` per denomination, plus a `<ChipStack>` child component that writes instance matrices for its assigned amount.

**Acceptance Criteria:**
1. `<ChipInstances>` allocates 4 `InstancedMesh` objects (one per denomination) with a capacity budget.
2. `<ChipStack amount={x} position={…}>` decomposes `x` into denominations using the existing chip constants and writes matrices.
3. Updating one stack's amount does not reallocate the mesh (verified via a test using a mesh-recreation spy).
4. Draw-call count stays constant (4) regardless of the number of `<ChipStack>` instances.

---

### T-008 — Implement `<CameraRig>` with drei OrbitControls

**Category:** feature
**Dependencies:** T-004
**Story Ref:** S-1.2

`<CameraRig>` wraps drei `PerspectiveCamera` + `OrbitControls` with damping, touch gestures, reasonable zoom/pitch bounds, and a `target` prop.

**Acceptance Criteria:**
1. OrbitControls has `enableDamping`, touch gestures enabled, and zoom/pitch clamped for above-table viewing.
2. On touch devices, single-finger orbits, pinch zooms, two-finger pans.
3. A test mounts `<CameraRig>` and asserts OrbitControls config values.
4. `target` prop updates re-center the camera smoothly.

---

### T-009 — Wire `<PokerTable>` top-level component

**Category:** feature
**Dependencies:** T-003, T-004, T-006, T-007, T-008
**Story Ref:** S-1.5

Compose `<Table>`, `<Seat>[]`, `<Card>` (hole + community), `<ChipStack>` (seat + pot), and `<CameraRig>` inside `<PokerCanvas>` driven purely by the `TableState` prop.

**Acceptance Criteria:**
1. `<PokerTable state={…}>` renders an end-to-end scene equivalent to `pokerScene.ts` output.
2. Changing the `state` prop re-renders cards/chips without remounting the canvas or leaking WebGL contexts.
3. A parity test compares the rendered scene graph shape against expected counts (seats, hole cards, community cards, chip stacks) for fixture hands.
4. Existing `pokerScene.ts` + all consumers remain unchanged — the new scene is side-by-side only.

---

### T-010 — Card deal + flip animation module

**Category:** feature
**Dependencies:** T-009
**Story Ref:** S-2.1

Implement `animations/dealCards.ts`. On street transitions, newly revealed cards animate from a deck position to their slot and flip face-up. Honor `prefers-reduced-motion`.

**Acceptance Criteria:**
1. Street change `preflop → flop` animates three flop cards sequentially within 500ms total.
2. Hole-card deal animates in dealer rotation order.
3. With `prefers-reduced-motion`, cards appear instantly at their final positions.
4. Rapid street toggles during an in-flight animation do not leave stale card meshes (test via repeated prop churn).

---

### T-011 — Chip-slide animation (seat → pot) on bets/calls/raises

**Category:** feature
**Dependencies:** T-009
**Story Ref:** S-2.2

When `SeatState.committedThisStreet` increases, animate a chip-slug from the seat's stack to the pot over ~400ms. Originating `<ChipStack>` shrinks immediately; pot grows on arrival.

**Acceptance Criteria:**
1. Increasing `committedThisStreet` triggers the slide animation.
2. Multiple concurrent slides from different seats do not collide visually.
3. Fold does not trigger chip motion.
4. A test with two seats firing simultaneous bets asserts both animations start and complete.

---

### T-012 — Pot sweep animation to winner(s)

**Category:** feature
**Dependencies:** T-011
**Story Ref:** S-2.3

At hand resolution, the pot animates toward each `won` seat (split proportionally by `profit_loss` for multi-winner cases), merging into their stack over ≤ 800ms.

**Acceptance Criteria:**
1. Single winner: entire pot slides to them.
2. Split pot: pot splits proportional to `profit_loss` shares.
3. After animation, pot `<ChipStack>` shows zero.
4. All-fold resolution: pot sweeps to the sole active seat.

---

### T-013 — Showdown reveal + winning-hand glow

**Category:** feature
**Dependencies:** T-010
**Story Ref:** S-2.4

At `street === 'showdown'`, flip non-folded opponent hole cards face-up (subject to visibility policy) and apply a glow outline to the winning seat's hole cards + relevant community cards for ≥ 3s.

**Acceptance Criteria:**
1. Folded opponent cards stay face-down at showdown.
2. Winning seat's cards render a theme-colored outline mesh or shader pass.
3. Glow clears automatically after 3s or on next street/hand.
4. Spectator policy reveals non-folded opponents; player policy restricts per S-5.1 (covered in T-024/T-025).

---

### T-014 — PBR table materials, lighting, and env map

**Category:** feature
**Dependencies:** T-004
**Story Ref:** S-2.5

Replace the flat material with PBR felt + rail, add a key light with soft shadows, and attach a subtle HDRI env map via drei.

**Acceptance Criteria:**
1. Felt surface has a normal + roughness map and responds to light direction.
2. Rail is visually distinct from the felt.
3. Total added asset weight ≤ 500KB gzipped.
4. On Medium quality (per T-027 tier settings), shadows are disabled and env map is low-res.

---

### T-015 — Zustand theme slice + settings panel UI

**Category:** feature
**Dependencies:** T-009
**Story Ref:** S-2.6

Add a `theme` slice to Zustand with `persist` (`mode`, `feltColor`, `cardBack`). Build a compact settings panel component that edits the slice. `<PokerTable>` subscribes to theme and passes values down.

**Acceptance Criteria:**
1. Three felt colors + two card backs + dark/light mode ship initially.
2. Selection persists across reload.
3. Theme change applies without remounting the canvas.
4. Settings panel is accessible from the dealer embed and full-page playback routes.

---

### T-016 — `<Nameplate>` with live stack tween

**Category:** feature
**Dependencies:** T-009
**Story Ref:** S-3.1

Billboarded nameplate (drei `Html` or `Billboard` + `Text`) above each seat. Shows player name + formatted stack amount. Stack changes tween over ~300ms.

**Acceptance Criteria:**
1. Nameplate faces the camera at all times.
2. Stack numeric value tweens between old and new amounts.
3. Legible at 360px viewport width.
4. No nameplate for empty seats.

---

### T-017 — Action-status badge on nameplate

**Category:** feature
**Dependencies:** T-016
**Story Ref:** S-3.2

Fetch per-hand actions from the existing actions endpoint; render the current-street action label as a small badge on each seat's nameplate.

**Acceptance Criteria:**
1. Badge shows `check` / `call` / `bet $X` / `raise $X` / `fold` / `all-in`.
2. Badge clears at new street except `fold` / `all-in` (persist to hand end).
3. Missing data renders no badge (no "undefined" placeholder).
4. No new backend endpoint; existing `/actions` endpoint is used.

---

### T-018 — Action highlights: fold dim, bet glow, turn pulse

**Category:** feature
**Dependencies:** T-016
**Story Ref:** S-3.3

Apply per-seat visual state: folded → opacity reduced across seat+cards+stack+nameplate; bet/raise → 1.5s color-accent glow on nameplate; currentSeat → soft ring pulse.

**Acceptance Criteria:**
1. Folded seat dims all associated meshes.
2. Bet/raise glow auto-clears after 1.5s.
3. Exactly one seat pulses at a time; pulse stops on seat change.
4. `prefers-reduced-motion` disables pulse and glow (state-only coloring).

---

### T-019 — Dealer button + SB/BB markers with rotation animation

**Category:** feature
**Dependencies:** T-009
**Story Ref:** S-3.4

`<DealerButton>`, `<SmallBlindMarker>`, `<BigBlindMarker>` render at the correct seats with a ~600ms animation when they rotate to a new seat.

**Acceptance Criteria:**
1. Markers render adjacent to the correct seats.
2. Hand change animates markers to new seats.
3. Missing `sbSeat` or `bbSeat` hides that marker.
4. Dealer button sits to the right of SB (poker convention).

---

### T-020 — `<EquityBadge>` wired to equity endpoint (triple-layer gated)

**Category:** feature
**Dependencies:** T-016
**Story Ref:** S-3.5

Implement the triple-layer equity enforcement described in plan.md § "Equity Overlay — Enforcement Model":

1. **Prop guard** — create [frontend/src/scenes3d/state/equityGuard.ts](frontend/src/scenes3d/state/equityGuard.ts) exporting `resolveEquityOverlay(prop, viewer)` (pseudocode in plan.md).
2. **Query gate** — create [frontend/src/scenes3d/data/useEquityQuery.ts](frontend/src/scenes3d/data/useEquityQuery.ts) wrapping `fetchEquity(gameId, handNumber)` in `useQuery` with `enabled = resolveEquityOverlay(prop, viewer)`.
3. **Badge render** — `<EquityBadge>` inside `<Nameplate>`, rendered only when `equity` data available AND ≥2 seats have hole cards AND `resolveEquityOverlay(...)` returns `true`.

Backend endpoint (already exists, no changes): `GET /games/{gameId}/hands/{handNumber}/equity` → `EquityResponse { equities: PlayerEquityEntry[] }`.

The ESLint rule that blocks equity imports under player files ships separately in T-032 as part of the player-route migration.

**Acceptance Criteria:**
1. `<PokerTable>` accepts `equityOverlay: boolean` (default `false`). Badges render and the endpoint is called only when `equityOverlay === true`.
2. When `viewer.policy === 'player'`, `equityOverlay` is forced to `false` via a runtime guard — the equity endpoint is never called regardless of the prop value. A dev-only warning is logged if a caller passes `true` in player mode.
3. Badges appear only when `equityOverlay === true`, equity data is available, and ≥2 seats have hole cards.
4. Values refresh on street change.
5. On fetch failure, badges silently hide — no error UI in scene.
6. Badge text readable at 360px width.
7. A unit test asserts: (a) player-mode mount with `equityOverlay=true` makes zero fetch calls and renders zero badges; (b) spectator-mode mount with `equityOverlay=true` fetches once and renders badges; (c) spectator-mode mount with `equityOverlay=false` makes zero fetch calls.

---

### T-021 — Camera presets: top-down / default / cinematic

**Category:** feature
**Dependencies:** T-008
**Story Ref:** S-4.1

Toolbar overlay with three buttons; each tweens camera position + target over ~600ms. Cinematic runs a slow orbit until user input.

**Acceptance Criteria:**
1. Three buttons render in a toolbar overlay; active preset is highlighted.
2. Preset change tweens smoothly.
3. Cinematic auto-orbits until the user interacts, then yields.
4. Tap targets meet the 44×44pt mobile minimum.

---

### T-022 — Seat-POV camera preset with constrained orbit

**Category:** feature
**Dependencies:** T-021
**Story Ref:** S-4.2, S-5.2

Dropdown or menu selects a seat; camera tweens to behind that seat. OrbitControls is constrained to ±30° yaw + limited pitch. Double-tap resets POV. Player mode hides the preset buttons and locks to viewer seat.

**Acceptance Criteria:**
1. Selecting a seat animates the camera to behind it.
2. Orbit is constrained (±30° yaw, limited pitch, tighter zoom).
3. Double-tap resets to the default seat POV for the viewer.
4. In player mode the toolbar buttons are hidden and the camera is locked.

---

### T-023 — Per-hand street scrubber UI + auto-play

**Category:** feature
**Dependencies:** T-010
**Story Ref:** S-4.3

Horizontal 5-segment scrubber (Preflop/Flop/Turn/River/Showdown) with play/pause. Reuses [frontend/src/components/StreetScrubber.tsx](frontend/src/components/StreetScrubber.tsx) (which already defines `STREETS = ['Pre-Flop','Flop','Turn','River','Showdown']`). The scrubber reads/writes the Zustand `replay.streetIndex` slice so that in playback it composes with the Session Timeline (T-023b). Dragging updates the scene's `streetIndex`; play auto-advances at 1.5s per street. Clamps to the reached street for early-end hands (e.g., hand ended at flop → scrubber clamps to index 1).

**Acceptance Criteria:**
1. Dragging the scrubber re-runs deal/chip/reveal animations for that street.
2. Play/pause button toggles auto-advance at 1.5s per street (scaled by `replay.speed` when mounted inside `<SessionReplayShell>`).
3. Early-end hands clamp the scrubber's max position to `streetIndexFromPhase(hand.outcome_street)`.
4. Touch-drag works on iOS Safari + Android Chrome with 44×44pt tap area.
5. In dealer/player live modes (no Session Timeline), the scrubber is wired directly to local component state, not the `replay` slice.

---

### T-023b — `<SessionReplayShell>` — cross-hand timeline + speed controls (playback-only)

**Category:** feature
**Dependencies:** T-023
**Story Ref:** S-4.4

Implement [frontend/src/scenes3d/SessionReplayShell.tsx](frontend/src/scenes3d/SessionReplayShell.tsx) per plan.md § "Public API". This component is **only** mounted inside [frontend/src/views/PlaybackView.tsx](frontend/src/views/PlaybackView.tsx) at route `#/playback?gameId=<id>`. The dealer embed and player POV never mount it.

**Contract:**
```tsx
<SessionReplayShell
  gameId={number}
  hands={HandResponse[]}            // from fetchHands(gameId)
  initialHandIndex={number}
  initialSpeed={0.5 | 1 | 2 | 4}
>
  {/* children read TableState via context, computed from hands[replay.handIndex] + replay.streetIndex */}
</SessionReplayShell>
```

**Responsibilities (all driven via the `replay` slice in `useTableStore`):**

1. Reuses [frontend/src/components/SessionScrubber.tsx](frontend/src/components/SessionScrubber.tsx) for `handCount`/`currentHand`/`onChange` binding to `replay.handIndex`.
2. Renders speed control (`0.5x`, `1x`, `2x`, `4x`) that writes `replay.speed`.
3. Play/pause button writes `replay.isPlaying`.
4. Internal state machine:
   ```
   IDLE ──play──▶ PLAYING_STREET(h, s) ──1500ms/speed──▶ advance s
                                        ──reaches showdown──▶ INTER_HAND_PAUSE(h)
                                              ──1000ms/speed──▶ PLAYING_STREET(h+1, 0)
                                              ──h+1 > last──▶ IDLE
   ```
5. Derives `TableState` for each frame via `handsToTableState({ game, hand: hands[handIndex], status: undefined, actions: cachedActions[handIndex], viewer })`. For playback, `status` is **not** fetched (the hand is terminal); `phase` and `streetIndex` come directly from `replay.streetIndex` → phase mapping.
6. Equity is fetched per-hand via `useEquityQuery({ gameId, handNumber: hands[handIndex].hand_number, enabled: true })` — keyed by `handNumber` so react-query caches per hand.
7. Exposes `TableState` + `viewer` to children via React context.

**Data fetches:** `fetchHands(gameId)` once on mount; `fetchEquity(gameId, handNumber)` per-hand on demand. No `fetchHandStatus` polling (playback is deterministic).

**Acceptance Criteria:**
1. Session Timeline (SessionScrubber) displays `hands.length` segments; current index highlighted.
2. Play auto-advances streets within a hand (1500/speed ms per street), then pauses 1000/speed ms between hands, then advances to the next hand.
3. Pausing freezes the state; resuming continues from the exact `handIndex` + `streetIndex`.
4. Scrubbing the SessionScrubber seeks directly to that hand and resets `streetIndex=0`.
5. Hand-change clears any in-flight tweens keyed by previous hand-id (no stale chip animations).
6. Mounting `<SessionReplayShell>` from any route other than playback is caught by a dev-only runtime warning (not a hard error, to keep tests flexible).
7. `frontend/test/scenes3d/SessionReplayShell.test.tsx` asserts: play→auto-advance→inter-hand pause→next-hand; scrub re-entry; speed 2x halves timing.

---

### T-024 — Visibility policy module + `canSee` function

**Category:** feature
**Dependencies:** T-006
**Story Ref:** S-5.1

Implement [frontend/src/scenes3d/state/visibilityPolicy.ts](frontend/src/scenes3d/state/visibilityPolicy.ts) per the exact signature + body in plan.md § "Visibility Policy — Formal Contract". Note: this replaces the earlier 4-case description with the formal 7-case truth table that also handles the *spectator* policy's hide-until-showdown behavior.

**Signature:**
```ts
export type Policy = 'spectator' | 'player';
export function canSee(args: {
  viewerSeat: number | null;
  cardOwnerSeat: number;
  policy: Policy;
  phase: TableState['phase'];
  ownerFolded: boolean;
}): boolean;
```

**Acceptance Criteria:**
1. Implementation matches plan.md § "Visibility Policy — Formal Contract" byte-for-byte.
2. `frontend/test/scenes3d/state/visibilityPolicy.test.ts` covers every row of the 7-case truth table in plan.md.
3. `spectator` policy hides cards until `phase === 'showdown'` AND `!ownerFolded` — matching the current behavior of [frontend/src/scenes/showdown.ts](frontend/src/scenes/showdown.ts) + [frontend/src/pages/TableView.tsx](frontend/src/pages/TableView.tsx) `handToPlayerCardData` for spectator-shape inputs.
4. The function is pure (no React hooks, no side effects).

---

### T-025 — Apply visibility policy through `<Card>` faceUp

**Category:** feature
**Dependencies:** T-024, T-009
**Story Ref:** S-5.1

`<PokerTable>` accepts `viewer={ seat, policy }` and all hole `<Card>` renders route their `faceUp` through `canSee(...)`.

**Acceptance Criteria:**
1. In player mode, opponent `<Card>` with folded=true always renders `faceUp=false`.
2. At showdown with non-folded opponent in player mode, opponent cards render `faceUp=true`.
3. Own hole cards always render `faceUp=true`.
4. Integration test asserts no opponent `<Card>` has `faceUp=true` while street < showdown.

---

### T-026 — Player-mode composition (no equity + camera lock)

**Category:** feature
**Dependencies:** T-020, T-022, T-025
**Story Ref:** S-5.3

Compose player mode: **zero** equity badges and **zero** equity fetches; camera locked to viewer seat POV (T-022); action highlights + nameplates + blind markers still render for all seats.

**Acceptance Criteria:**
1. No `<EquityBadge>` renders in player mode (viewer, opponents, or pot) and the equity endpoint is never called.
2. Camera is locked to viewer seat POV.
3. Nameplates / action highlights / blind markers render for all seats.
4. Preset toolbar is hidden.
5. Integration test asserts zero network calls to the equity endpoint throughout a full player-mode hand lifecycle (preflop → showdown).

---

### T-027 — Zustand quality-tier slice + tier mappings

**Category:** feature
**Dependencies:** T-014
**Story Ref:** S-6.1

Add a `qualityTier` slice (`low`|`medium`|`high`) with `persist`. Define a mapping that controls: shadow enable/quality, light count, DPR cap, material tier, AA, atlas resolution.

**Acceptance Criteria:**
1. Default: `high` on desktop, `medium` on mobile (viewport ≤ 768px).
2. Tier change applies without page reload (re-renders scene props).
3. Tier mapping is exported from a single module consumed by `<PokerTable>` children.
4. Settings panel includes a tier dropdown.

---

### T-028 — `useFPSMonitor` + auto-degrade with toast

**Category:** feature
**Dependencies:** T-027
**Story Ref:** S-6.2

Implement [frontend/src/scenes3d/state/useFPSMonitor.ts](frontend/src/scenes3d/state/useFPSMonitor.ts) per the exact pseudocode in plan.md § "Quality Tiers & Performance Budget". Hook samples R3F's `useFrame` loop, maintains a 2-second rolling window of instantaneous FPS, and drops the current tier one level (`high→medium→low`) when the window average stays below 30fps for 3 continuous seconds. Emits a toast on tier change. `manualOverride=true` halts further auto-degrade for the session.

**Acceptance Criteria:**
1. Implementation matches plan.md pseudocode (rolling window size 120 samples, 3000ms sustained threshold).
2. Auto-drop occurs only after 3s sustained below 30fps.
3. Toast appears on tier change; dismissible; includes "Quality adjusted for smoother playback" copy.
4. Setting `manualOverride=true` via the settings panel halts further auto-degrade for the session (session-scoped, not persisted).
5. Does not degrade below `low`.
6. Test: feeds 120 synthetic frames at 20fps followed by 120 at 60fps and asserts exactly one tier drop.

---

### T-029 — Mobile touch / tap-target / 360px-width audit

**Category:** test
**Dependencies:** T-023
**Story Ref:** S-6.3

Manual + automated audit: OrbitControls gestures on iOS Safari + Android Chrome; toolbar + scrubber + settings buttons meet 44×44pt; canvas + overlays render without horizontal scroll at 360px width; orientation change handled without flicker.

**Acceptance Criteria:**
1. Gesture matrix verified on two physical or emulated devices (document versions).
2. Automated test asserts all interactive overlays' rendered size ≥ 44px.
3. Visual regression or screenshot test at 360px viewport passes.
4. Orientation-change smoke test passes.

---

### T-030 — Migrate `TableView3D.tsx` (dealer embed)

**Category:** refactor
**Dependencies:** T-009, T-015, T-018, T-020
**Story Ref:** S-7.1

Replace the imperative `createPokerScene` usage in [frontend/src/dealer/TableView3D.tsx](frontend/src/dealer/TableView3D.tsx) with `<PokerTable>`. The dealer embed uses **live polling**: wrap with `useTableStateQuery({ gameId, handNumber, viewer, equityOverlay: true, live: true })` so `fetchHandStatus` is re-polled at 1s intervals.

**Call site:**
```tsx
<PokerTable
  state={tableState}
  viewer={{ policy: 'spectator' }}
  theme={theme}
  qualityTier={qualityTier}
  equityOverlay={true}
  cameraPreset="topDown"
/>
```

**Acceptance Criteria:**
1. `TableView3D.tsx` renders `<PokerTable>` with `viewer.policy='spectator'`, `equityOverlay={true}`, no `<SessionReplayShell>`.
2. `frontend/test/dealer/TableView3D.test.tsx` preserves the cycle-11 behavioral guarantees (renders canvas, updates on hand change, no WebGL leak on mount/unmount cycles). Tests rewritten against `<PokerTable>` public API.
3. Container sizing `min(400px, 50vh)` preserved.
4. `externalResize:true` semantics preserved — `<PokerCanvas>` does NOT attach its own window resize listener when embedded; sizing follows the container's `ResizeObserver`.
5. Equity badges, action highlights, and theme all active.

---

### T-031 — Migrate `views/PlaybackView.tsx` (full-page playback + Session Timeline)

**Category:** refactor
**Dependencies:** T-021, T-023, T-023b, T-015
**Story Ref:** S-7.2, S-4.4

Rewrite [frontend/src/views/PlaybackView.tsx](frontend/src/views/PlaybackView.tsx) — the route reached from the "▶ Playback" button in [frontend/src/views/DataView.tsx](frontend/src/views/DataView.tsx) (~line 833, `navigate('/playback?gameId=${session.game_id}')`).

**Structure:**
```tsx
const { data: hands } = useQuery(['hands', gameId], () => fetchHands(gameId));
return (
  <SessionReplayShell gameId={gameId} hands={hands} initialHandIndex={0} initialSpeed={1}>
    <PresetToolbar />
    <ThemePanel />
    <PokerTable
      state={tableState}
      viewer={{ policy: 'spectator' }}
      equityOverlay={true}
    />
  </SessionReplayShell>
);
```

The existing inline `EquityRow` and client-side `calculateEquity` are **removed** — replaced by the server `useEquityQuery` hook. The existing `SessionScrubber` + `StreetScrubber` components are reused inside `<SessionReplayShell>`.

**Acceptance Criteria:**
1. Route `#/playback?gameId=<id>` renders the full-page R3F scene with Session Timeline + speed controls + preset toolbar + theme panel.
2. `SessionReplayShell` drives `handIndex` (0..hands.length-1) and `streetIndex` (0..4); per-hand scrubber reads/writes the same Zustand `replay` slice.
3. Play button auto-advances at 1.5s per street, then pauses 1s between hands before advancing to the next.
4. Speed control applies to both intra-hand and inter-hand advance timers.
5. Client-side `calculateEquity` import from `poker/evaluator.ts` is removed from this file; equity now comes from the server endpoint.
6. Visibility policy = `spectator` (NOT player). Existing playback tests updated to match.

---

### T-032 — Migrate `pages/TableView.tsx` (player POV route) + ESLint rule

**Category:** refactor
**Dependencies:** T-025, T-026
**Story Ref:** S-7.3

Rewrite [frontend/src/pages/TableView.tsx](frontend/src/pages/TableView.tsx) (route `#/player/table?game=<id>&player=<name>`) to use `<PokerTable>` with `viewer.policy='player'`. The viewer's seat is derived from the `player` query param → `GameSessionResponse.players[].seat_number` lookup. Live polling via `useTableStateQuery({ live: true })` sources from `fetchLatestHand` + `fetchHandStatusConditional`.

**Also land the ESLint rule** (layer 3 of the equity enforcement model) at [frontend/eslint-rules/no-equity-in-player.js](frontend/eslint-rules/no-equity-in-player.js) and wire it into `frontend/eslint.config.js` scoped to `frontend/src/pages/TableView.tsx` + `frontend/src/player/**`.

**Call site:**
```tsx
<PokerTable
  state={tableState}
  viewer={{ policy: 'player', seat: viewerSeat }}
  theme={theme}
  qualityTier={qualityTier}
  equityOverlay={false}
  cameraPreset={{ kind: 'seat', seat: viewerSeat }}
/>
```

**Acceptance Criteria:**
1. Route `#/player/table` renders `<PokerTable>` with `viewer.policy='player'`, `viewer.seat=viewerSeat`, `equityOverlay={false}`. No `<SessionReplayShell>`.
2. Legacy `handToPlayerCardData` + direct `isShowdown` usage in this file are removed — visibility now flows exclusively through `canSee()` in `<Card>.faceUp`.
3. ESLint rule blocks any import of `fetchEquity` / `useEquityQuery` / `calculateEquity` under `frontend/src/pages/TableView.tsx` or `frontend/src/player/**`. Rule is covered by a unit test in `frontend/eslint-rules/no-equity-in-player.test.js`.
4. Integration test ([frontend/test/pages/TableView.test.tsx](frontend/test/pages/TableView.test.tsx)) asserts across a full scripted hand (preflop → flop → turn → river → showdown): (a) `screen.queryAllByTestId('card-face-up').filter(c => c.dataset.ownerSeat !== viewerSeat)` has length 0 until `phase === 'showdown'`; (b) MSW-captured network log contains **zero** calls to `/equity`; (c) camera target remains near the viewer seat's expected coordinates.
5. Preset toolbar is hidden in player mode.

---

### T-033 — Delete `pokerScene.ts`, its tests, and dead helpers

**Category:** refactor
**Dependencies:** T-030, T-031, T-032
**Story Ref:** S-7.4

Delete [frontend/src/scenes/pokerScene.ts](frontend/src/scenes/pokerScene.ts), [frontend/test/scenes/pokerScene.test.ts](frontend/test/scenes/pokerScene.test.ts), and any now-unused helpers: [frontend/src/scenes/tableGeometry.ts](frontend/src/scenes/tableGeometry.ts), [frontend/src/scenes/chipStacks.ts](frontend/src/scenes/chipStacks.ts), [frontend/src/scenes/holeCards.ts](frontend/src/scenes/holeCards.ts), [frontend/src/scenes/communityCards.ts](frontend/src/scenes/communityCards.ts), [frontend/src/scenes/seatCamera.ts](frontend/src/scenes/seatCamera.ts), [frontend/src/scenes/showdown.ts](frontend/src/scenes/showdown.ts), [frontend/src/scenes/cards.ts](frontend/src/scenes/cards.ts), [frontend/src/scenes/table.ts](frontend/src/scenes/table.ts). Do **not** delete any file still referenced outside `scenes/` (verify with grep before each deletion).

If [frontend/src/poker/evaluator.ts](frontend/src/poker/evaluator.ts)'s `calculateEquity` is unreferenced after T-031 removes the PlaybackView client-side equity path, delete it too; otherwise leave it.

**Acceptance Criteria:**
1. `frontend/src/scenes/pokerScene.ts` removed.
2. `frontend/test/scenes/pokerScene.test.ts` removed.
3. `grep -r "pokerScene\|createPokerScene" frontend/src frontend/test` returns no matches.
4. Each scene helper file deleted only if `grep -r <filename-stem>` confirms zero external references.
5. Full frontend test suite passes (`cd frontend && npm test`).
6. Full backend suite still passes (`cd backend && uv run pytest test/`) — sanity check, unchanged.

---

### T-034 — Update `docs/frontend/architecture.md` 3D section

**Category:** docs
**Dependencies:** T-033
**Story Ref:** S-7.4

Update the "3D Rendering (Three.js)" section of [docs/frontend/architecture.md](docs/frontend/architecture.md) to describe the new R3F-based architecture, scene graph, visibility policy, and performance controller. Keep it concise.

**Acceptance Criteria:**
1. Section rewritten to reference `scenes3d/` as the source of truth.
2. Mentions `@react-three/fiber`, `@react-three/drei`, visibility policy, and quality tiers.
3. Links to the new `<PokerTable>` contract.
4. No stale references to `pokerScene.ts`.

---

### T-038 — Tier gating cleanup + settings-panel tier dropdown

**Category:** refactor
**Dependencies:** T-027, T-030
**Story Ref:** S-6.1, S-6.2

Close out the tier-gating carry-forwards from Cycles 38 / 39 that were parked under a phantom "T-038 / `aia-core-t4dp`" owner. `aia-core-t4dp` landed the route-level `qualityTier` store → props wiring only (T-030 AC-5 dim); this task picks up the **render-layer + UI** leftovers so every visual feature reads from `QUALITY_TIER_SETTINGS[tier]` and users have a control to change tier + flip `manualOverride`.

**Scope (three work items):**

1. **Canvas-level `<Canvas shadows>` enablement** (Cycle 38 **M-2**) — enable `<Canvas shadows>` on [frontend/src/scenes3d/PokerCanvas.tsx](frontend/src/scenes3d/PokerCanvas.tsx) conditionally when `qualityTier === 'high'` (read via `useTableStore`), so the T-014 key-light `castShadow={qualityTier === 'high'}` gate has runtime effect instead of being a dead signal. Test: asserts the canvas receives `shadows` at `high` and no `shadows` prop at `medium`/`low`.

2. **Inline tier literals migration** (Cycle 39 **L-2**) — replace hardcoded tier-derived literals in [frontend/src/scenes3d/PokerTable.tsx](frontend/src/scenes3d/PokerTable.tsx) (`<Environment resolution={qualityTier === 'high' ? 256 : 64}>`) and [frontend/src/scenes3d/CardAtlas.ts](frontend/src/scenes3d/CardAtlas.ts) (any tier-gated atlas sizing) with reads from `QUALITY_TIER_SETTINGS[tier]` in [frontend/src/scenes3d/state/qualitySettings.ts](frontend/src/scenes3d/state/qualitySettings.ts). Update the pinning tests to read expected values from the same canonical source and retire the Cycle-38 drift-locked-in assertions.

3. **Settings-panel tier dropdown** (Cycle 39 **M-1** / T-027 **AC-4**) — extend [frontend/src/scenes3d/components/TableSettingsPanel.tsx](frontend/src/scenes3d/components/TableSettingsPanel.tsx) with a tier dropdown (options: `low` / `medium` / `high`) that calls `setTier(nextTier)` and `setManualOverride(true)` on change. Covers T-027 AC-4. Test: asserts selection change mutates the store slice and flips `manualOverride`.

**Acceptance Criteria:**
1. `<Canvas shadows>` is conditional on `qualityTier === 'high'`; T-014 AC-4 "shadows disabled on Medium" now has runtime effect (not just prop-emission intent).
2. `PokerTable.tsx` and `CardAtlas.ts` no longer hold inline tier-derived literals — every tier-gated value flows from `QUALITY_TIER_SETTINGS[tier]`.
3. `TableSettingsPanel` exposes a tier dropdown that drives `setTier` + `setManualOverride(true)`; T-027 AC-4 SATISFIED.
4. Full frontend suite passes (`cd frontend && npm test`).

---

## Bugs / Findings

> Low-severity findings surfaced during review loops. Per Anna's protocol, **LOW** findings are recorded here only and are **not** filed into beads. Medium/high findings are filed as separate beads issues.

### Cycle 1 — T-001 / `aia-core-zada` (Scott review, 2026-04-18)

**Source:** [docs/agent/reviews/cycle-1-aia-core-zada-2026-04-18.md](../../docs/agent/reviews/cycle-1-aia-core-zada-2026-04-18.md)

1. **[LOW] Nested `three@0.170.0` under `stats-gl` — multiple Three.js instances risk**
   - **File:** [frontend/package-lock.json](../../frontend/package-lock.json) (stats-gl entry)
   - **Category:** design
   - **Description:** `stats-gl@2.4.2` (drei transitive) bundles a non-deduped `three@0.170.0` while the rest of the graph dedupes to `three@0.183.2`. When drei's `<Stats>` / `<StatsGl>` mounts (planned in T-028), R3F may warn about multiple `three` instances and `instanceof` checks can misfire.
   - **Recommended fix:** land with T-028 — add `"overrides": { "three": "^0.183.2" }` in [frontend/package.json](../../frontend/package.json), or use a custom lightweight FPS hook instead of drei's `<Stats*>`.

2. **[LOW] AC #3 paper trail — player-interface route not in commit/PR note**
   - **File:** [frontend/package.json](../../frontend/package.json) (commit message convention)
   - **Category:** convention
   - **Description:** AC #3 asks for the player-route location to be documented in a comment or PR note. The route is authoritative in tasks.md but the T-001 change has no commit/PR note yet.
   - **Recommended fix:** when landing T-001, include a line in the commit body: `Player POV route (T-032): frontend/src/pages/TableView.tsx at #/player/table?game=<id>&player=<name>`. Do not add comments inside package.json (JSON does not support comments).

### Cycle 2 — T-002 / `aia-core-2au1` (Scott review, 2026-04-18)

**Source:** [docs/agent/reviews/cycle-2-aia-core-2au1-2026-04-18.md](../../docs/agent/reviews/cycle-2-aia-core-2au1-2026-04-18.md)

1. **[LOW] Smoke test swallows unexpected `console.error` instead of failing**
   - **File:** [frontend/test/scenes3d/PokerCanvas.test.tsx](../../frontend/test/scenes3d/PokerCanvas.test.tsx) (lines ~14–27)
   - **Category:** convention
   - **Description:** The `console.error` spy re-logs unexpected errors via `console.warn` instead of failing the test. The `it('mounts without errors')` assertion is weaker than its name — a future React regression that only calls `console.error` would pass silently.
   - **Recommended fix:** maintain a counter of non-`R3F_TAG_WARNING` calls and `expect(count).toBe(0)` in `afterEach`, or re-throw.

2. **[LOW] Redundant `export default` alongside named export**
   - **File:** [frontend/src/scenes3d/PokerCanvas.tsx](../../frontend/src/scenes3d/PokerCanvas.tsx) (lines ~29–50)
   - **Category:** convention
   - **Description:** `PokerCanvas` is exported as both named and default. `scenes3d/index.ts` only re-exports the named binding and the rest of the frontend uses named exports. Dual exports invite inconsistent import sites in T-009 / T-030..T-032.
   - **Recommended fix:** remove `export default PokerCanvas;`. Can be picked up opportunistically in T-009.

### Cycle 3 — T-003 / `aia-core-dq12` (Scott review, 2026-04-18)

**Source:** [docs/agent/reviews/cycle-3-aia-core-dq12-2026-04-18.md](../../docs/agent/reviews/cycle-3-aia-core-dq12-2026-04-18.md)

Scott flagged 0 CRITICAL, 0 HIGH, 2 MEDIUM, 3 LOW. Per Anna's orchestration protocol, only CRITICAL and HIGH findings are filed into beads; MEDIUM and LOW are recorded here only. Scott's recommendation to bundle M-1, M-2, and L-2 into a discovered-from bead is superseded by the protocol — nothing is filed.

1. **[MEDIUM] Dealer-seat derivation assumes `seat_number` order equals physical table order**
   - **File:** [frontend/src/scenes3d/data/handsToTableState.ts](../../frontend/src/scenes3d/data/handsToTableState.ts) (lines ~132–147, `deriveDealerSeat`)
   - **Category:** logic
   - **Description:** `deriveDealerSeat` sorts occupied `seat_number`s ascending and picks the one immediately before SB. This is correct only when occupied seats are contiguous; with non-contiguous seating (e.g. seats 1, 3, 7) it selects a non-adjacent seat. The plan's pseudocode passes the full `hand` to `deriveDealerSeat`, but the implementation drops that argument.
   - **Recommended fix:** add a doc comment explaining the contiguous-seats assumption and add a non-contiguous-seats test, or prefer a backend-provided dealer field when available.

2. **[MEDIUM] Unsafe cast of `status.phase` to `TableStatePhase`**
   - **File:** [frontend/src/scenes3d/data/handsToTableState.ts](../../frontend/src/scenes3d/data/handsToTableState.ts) (line ~158)
   - **Category:** type-safety
   - **Description:** The backend types `phase` as `string`, but the adapter casts it to the 6-member `TableStatePhase` union without runtime validation. Unexpected values (e.g. `"finished"`) become type-system lies. `streetIndexFromPhase` has a `default: 0` safety net, but downstream consumers that `switch` on `phase` will silently miss unhandled cases.
   - **Recommended fix:** validate `status.phase` against a `VALID_PHASES` set and fall back to `derivePhase(hand)` when it does not match.

3. **[LOW] `parseCard` accepts arbitrary rank strings**
   - **File:** [frontend/src/scenes3d/data/handsToTableState.ts](../../frontend/src/scenes3d/data/handsToTableState.ts) (lines ~27–35)
   - **Category:** validation
   - **Description:** Only the suit character is validated; inputs like `"Xh"`, `"1d"`, or `"Asd"` produce `CardRef`s that `CardAtlas` will silently fail to resolve at render time.
   - **Recommended fix:** whitelist ranks against the `CardAtlas` rank table.

4. **[LOW] `lastAction.amount` not populated (deferred to T-017)**
   - **File:** [frontend/src/scenes3d/data/handsToTableState.ts](../../frontend/src/scenes3d/data/handsToTableState.ts) (lines ~86–96)
   - **Category:** convention
   - **Description:** The deferral is acceptable per Hank, but there is currently no breadcrumb in the code pointing to where the amount will be populated.
   - **Recommended fix:** add a `// TODO(T-017)` comment so the deferral is discoverable from the adapter.

5. **[LOW] Type narrower than plan literal**
   - **File:** [frontend/src/scenes3d/types.ts](../../frontend/src/scenes3d/types.ts) (lines ~46–57)
   - **Category:** documentation
   - **Description:** The plan literally writes `phase: HandStatusResponse['phase']` (which resolves to `string`); Hank tightened the field to the `TableStatePhase` union. This is an improvement, but pairs with finding #2 — without a runtime validator the narrower type is not guaranteed at runtime.
   - **Recommended fix:** leave a short comment on the `TableState.phase` field explaining the intentional narrowing vs. the plan literal, and pair with finding #2's runtime validation.

### Cycle 4 — T-004 / `aia-core-ui44` (Scott review, 2026-04-18)

**Source:** [docs/agent/reviews/cycle-4-aia-core-ui44-2026-04-18.md](../../docs/agent/reviews/cycle-4-aia-core-ui44-2026-04-18.md)

Scott flagged 0 CRITICAL, 1 HIGH, 1 MEDIUM, 3 LOW. Per Anna's orchestration protocol, only CRITICAL and HIGH findings are filed into beads; the HIGH finding (#1) is filed as a P1 bug (see **Filed Bug Cards** below). MEDIUM finding #2 is naturally bundled with the HIGH fix.

1. **[HIGH] `<Seat>` local +Z does not face the table center**
   - **File:** [frontend/src/scenes3d/components/Seat.tsx](../../frontend/src/scenes3d/components/Seat.tsx) (~L45)
   - **Category:** correctness
   - **Description:** Code uses `rotation={[0, -angle, 0]}` but the comment and downstream consumers expect local +Z pointing at the table center. A Y-rotation by φ sends `(0, 0, 1)` → `(sin φ, 0, cos φ)`; to hit the inward radial `(−cos θ, 0, −sin θ)` we need φ = −θ − π/2. Every seat is 90° off.
   - **Recommended fix:** change rotation to `rotation={[0, -angle - Math.PI / 2, 0]}`; export `computeSeatRotationY` from [frontend/src/scenes3d/components/tableLayout.ts](../../frontend/src/scenes3d/components/tableLayout.ts); add a unit test asserting world-space +Z matches the inward radial unit vector for several seat counts.
   - **Blocks downstream:** T-009 `<PokerTable>`, T-010 deal slots, T-016 nameplate billboard origin, T-018 pulse ring — all consume the seat-local frame with +Z toward felt center.
   - **→ Filed into beads as a P1 bug with `discovered-from: aia-core-ui44`** (see Filed Bug Cards below).

2. **[MEDIUM] No test pins seat-local orientation**
   - **Files:** [frontend/test/scenes3d/TableSeat.test.tsx](../../frontend/test/scenes3d/TableSeat.test.tsx), [frontend/test/scenes3d/tableLayout.test.ts](../../frontend/test/scenes3d/tableLayout.test.ts)
   - **Category:** test coverage
   - **Description:** Existing orientation coverage only checks the delta between adjacent seat rotations, which equals `2π/n` regardless of any constant offset — so a wrong absolute orientation passes silently. This is why finding #1 landed on a green 1290/1290 test run.
   - **Recommended fix:** export `computeSeatRotationY` and add a test asserting the world-space +Z direction matches the inward radial unit vector. Naturally bundled with the finding #1 fix.

3. **[LOW] `<Table>` rail is a solid cylinder, not a ring**
   - **File:** [frontend/src/scenes3d/components/Table.tsx](../../frontend/src/scenes3d/components/Table.tsx) (~L41–50)
   - **Category:** design
   - **Description:** AC says "rail ring" but the rail is implemented as a solid wider cylinder with its center hidden by the felt. Visually acceptable and T-014 will supersede with an extruded rail.
   - **Recommended fix:** document the simplification as a placeholder until T-014, or swap to `ringGeometry` / `extrudeGeometry`.

4. **[LOW] Seat pad sets `transparent={true}` unconditionally**
   - **File:** [frontend/src/scenes3d/components/Seat.tsx](../../frontend/src/scenes3d/components/Seat.tsx) (~L58–66)
   - **Category:** design
   - **Description:** Always-transparent materials route through the alpha-sorted pass even when opacity is 1.0, which risks sort flicker against other opaque table meshes.
   - **Recommended fix:** gate both `transparent` and `depthWrite` on `opacity < 1`.

5. **[LOW] `computeSeatAngle` does not guard negative `seatIndex`**
   - **File:** [frontend/src/scenes3d/components/tableLayout.ts](../../frontend/src/scenes3d/components/tableLayout.ts) (~L35–40)
   - **Category:** robustness
   - **Description:** `(-1 % 9) === -1` in JS, so a negative `seatIndex` yields a negative angle. Unlikely to occur in practice given current call sites.
   - **Recommended fix:** normalize with `(((i % n) + n) % n)` before computing the angle.

#### Filed Bug Cards

The following findings have been converted into task-card form so Logan can sync them into beads as discovered-from bugs.

##### [BUG-CYCLE4-01] HIGH — Seat local +Z does not face table center
- **Source:** T-004 / `aia-core-ui44` (Cycle 4 review)
- **Priority:** P1 (HIGH)
- **Type:** bug
- **File:** [frontend/src/scenes3d/components/Seat.tsx](../../frontend/src/scenes3d/components/Seat.tsx) (~L45)
- **Summary:** Seat rotation uses `[0, -angle, 0]` but should be `[0, -angle - π/2, 0]` so local +Z points at the table center. Every seat is 90° off. Blocks T-009, T-010, T-016, T-018, which all consume the seat-local frame.
- **Fix:** Update rotation to `[0, -angle - Math.PI / 2, 0]`; export `computeSeatRotationY` from [frontend/src/scenes3d/components/tableLayout.ts](../../frontend/src/scenes3d/components/tableLayout.ts); add an orientation test asserting the inward radial direction.
- **Deps:** `discovered-from: aia-core-ui44`
- **Acceptance:** All existing tests still pass; new test asserts `[sin φ, 0, cos φ]` ≈ inward radial unit vector for n ∈ {2, 6, 9, 10}.

### Cycle 5 — `aia-core-fl4s` (Scott review, 2026-04-18)

**Source:** [docs/agent/reviews/cycle-5-aia-core-fl4s-2026-04-18.md](../../docs/agent/reviews/cycle-5-aia-core-fl4s-2026-04-18.md)
**Source task:** bug `aia-core-fl4s` (`discovered-from: aia-core-ui44` / T-004)

Scott flagged 0 CRITICAL, 0 HIGH, 0 MEDIUM, 2 LOW. Per Anna's orchestration protocol, only CRITICAL and HIGH findings are filed into beads; none of these findings meet that bar, so they are recorded here for informational / follow-up purposes only.

1. **[LOW] Docstring overstates "points toward table center" on the elliptical ring**
   - **File:** [frontend/src/scenes3d/components/tableLayout.ts](../../frontend/src/scenes3d/components/tableLayout.ts) (~L64–77, `computeSeatRotationY`)
   - **Category:** documentation
   - **Description:** The seat ring is elliptical (Rx'=4.3, Rz'=2.8), so the true geometric direction from a seat to the origin differs from the uniform circular inward radial the helper returns. They agree at cardinal angles; at θ=π/4 the angular error is ~10°. This matches the legacy `pokerScene` behavior and is intentional, but the phrasing "points toward the table center" in the docstring is not strictly accurate.
   - **Recommended fix:** reword the docstring to describe the return as a "circular inward radial — an intentional approximation on the elliptical ring." Documentation only; no behavior change.

2. **[LOW] `TableSeat.test` seat-0 orientation pin is tautological**
   - **File:** [frontend/test/scenes3d/TableSeat.test.tsx](../../frontend/test/scenes3d/TableSeat.test.tsx) (~L100–104)
   - **Category:** test coverage
   - **Description:** The assertion uses `computeSeatRotationY(0, n)` as its expected value, so if the helper regressed to `-angle` the test would still pass. The genuine absolute invariant is covered in [frontend/test/scenes3d/tableLayout.test.ts](../../frontend/test/scenes3d/tableLayout.test.ts), so this is not a coverage gap — but the comment claiming to "pin absolute orientation" is technically inaccurate at the component layer.
   - **Recommended fix (optional):** add a sibling hard-coded assertion `expect(rotations[0][1]).toBeCloseTo(-Math.PI / 2, 5)` so the component-level test independently catches a helper regression.

### Cycle 6 — `aia-core-rk6j` (Scott review, 2026-04-18)

**Source:** [docs/agent/reviews/cycle-6-aia-core-rk6j-2026-04-18.md](../../docs/agent/reviews/cycle-6-aia-core-rk6j-2026-04-18.md)
**Source task:** T-005 / `aia-core-rk6j`

Scott flagged 0 CRITICAL, 0 HIGH, 2 MEDIUM, 4 LOW. Per Anna's orchestration protocol, only CRITICAL and HIGH findings are filed into beads; MEDIUM and LOW findings are recorded here for informational / follow-up purposes only.

1. **[MEDIUM] UV convention places a flip-y contract on every consumer**
   - **File:** [frontend/src/scenes3d/components/CardAtlas.ts](../../frontend/src/scenes3d/components/CardAtlas.ts) (~L12–16, UV convention documentation)
   - **Category:** API ergonomics
   - **Description:** `getUV` returns `v` in image-space (top-down) while `CanvasTexture` defaults to `flipY=true`, so consumers must apply `v → 1 - v - h`. This is a foot-gun for T-006 and every future consumer.
   - **Recommended fix:** expose a `getTextureOffsetRepeat()` helper with the flip pre-applied, or set `texture.flipY=false`. **T-006 should address this before wiring `<Card>` meshes.**

2. **[MEDIUM] No test exercises the `ctx === null` fallback in texture build**
   - **File:** [frontend/src/scenes3d/components/CardAtlas.ts](../../frontend/src/scenes3d/components/CardAtlas.ts) (~L147–163, canvas context acquisition)
   - **Category:** test coverage
   - **Description:** Silently returns an undrawn texture if `getContext('2d')` returns null. Existing tests only check `instanceof` and `image.width`, both of which pass on an empty canvas.
   - **Recommended fix:** add a test forcing null-ctx and pin the contract (empty tex OR throws — either is fine).

3. **[LOW] 13×5 grid diverges from plan.md's 7×8 pseudocode (accepted divergence)**
   - **File:** [specs/table-3d-revamp-010/plan.md](./plan.md) § "Card Atlas"
   - **Category:** documentation
   - **Description:** Plan pseudocode `cellW = size/8` with 13-element `RANKS.forEach((r,col)=>)` overflows col 7 — self-contradictory. Hank's 13×5 layout is the only correct fix.
   - **Recommended fix:** update plan.md to reflect the 13×5 layout; no code change needed.

4. **[LOW] Duplicate `ctx.font` assignment in `drawCardFace`**
   - **File:** [frontend/src/scenes3d/components/CardAtlas.ts](../../frontend/src/scenes3d/components/CardAtlas.ts) (~L208–211)
   - **Category:** code hygiene
   - **Description:** Same font set twice — copy-paste leftover.
   - **Recommended fix:** drop redundant assignment or intentionally size the glyph differently.

5. **[LOW] `clearAtlasCache` has no observable-contract test**
   - **File:** [frontend/test/scenes3d/CardAtlas.test.ts](../../frontend/test/scenes3d/CardAtlas.test.ts)
   - **Category:** test coverage
   - **Description:** Used in `beforeEach` but no test asserts "after clear, a fresh instance is returned + prior was disposed."
   - **Recommended fix:** add a `dispose` spy + identity test.

6. **[LOW] `getUVById` case-sensitivity not pinned in JSDoc**
   - **File:** [frontend/src/scenes3d/components/CardAtlas.ts](../../frontend/src/scenes3d/components/CardAtlas.ts) (`getUVById`)
   - **Category:** documentation
   - **Description:** `getUVById('AH')` returns null (encoded in tests) but JSDoc doesn't state lowercase-suit policy.
   - **Recommended fix:** add one sentence to JSDoc; verify upstream card-id formats use lowercase suits before T-006 binds this.

### Cycle 7 — `aia-core-zjgc` (Scott review, 2026-04-18)

**Source:** [docs/agent/reviews/cycle-7-aia-core-zjgc-2026-04-18.md](../../docs/agent/reviews/cycle-7-aia-core-zjgc-2026-04-18.md)
**Source task:** T-006 / `aia-core-zjgc`

Scott flagged 0 CRITICAL, 0 HIGH, 1 MEDIUM, 4 LOW. Per Anna's orchestration protocol, only CRITICAL and HIGH findings are filed into beads; MEDIUM and LOW findings are recorded here for informational / follow-up purposes only.

1. **[MEDIUM] Material cache and atlas texture cache are independently disposable — dangling texture risk**
   - **File:** [frontend/src/scenes3d/components/Card.tsx](../../frontend/src/scenes3d/components/Card.tsx) (~L23–42)
   - **Category:** design
   - **Description:** `materialCache` in `Card.tsx` and `textureCache` in `CardAtlas.ts` have independent `clear*` functions. `clearAtlasCache()` disposes the texture while cached materials still reference it via `.map`; `clearCardMaterialCache()` disposes materials while textures persist. The coupling is undocumented and becomes a foot-gun for T-027 tier transitions and HMR.
   - **Recommended fix:** have `clearAtlasCache()` and `clearCardMaterialCache()` coordinate (call each other, or the former nulls `.map` on cached materials before disposing textures). Add a test that clears atlas then remounts `<Card>`.

2. **[LOW] `geometryRef` assigned but never read**
   - **File:** [frontend/src/scenes3d/components/Card.tsx](../../frontend/src/scenes3d/components/Card.tsx) (~L102–108)
   - **Category:** convention
   - **Description:** `useRef(geometry)` and `geometryRef.current = geometry` are dead code.
   - **Recommended fix:** replace the effect body with just the disposal cleanup `useLayoutEffect(() => () => geometry.dispose(), [geometry]);`.

3. **[LOW] AC-4 partially holds: tier change swaps material reference**
   - **File:** [frontend/src/scenes3d/components/Card.tsx](../../frontend/src/scenes3d/components/Card.tsx) (~L92, L111–118)
   - **Category:** design / documentation
   - **Description:** A tier change returns a different cached `MeshStandardMaterial`, changing the mesh's `material` identity. This is intentional (per-tier texture) but technically violates the literal wording of AC-4 ("material identity stable across re-renders").
   - **Recommended fix:** document the exception on T-006 AC-4 in tasks.md so the T-027 integration review doesn't flag it as a regression.

4. **[LOW] `size` prop change recreates the geometry**
   - **File:** [frontend/src/scenes3d/components/Card.tsx](../../frontend/src/scenes3d/components/Card.tsx) (~L100–108)
   - **Category:** design
   - **Description:** `useMemo([w, h])` rebuilds `PlaneGeometry` on size change. Fine today (size is static) but T-010 animation authors might try to tween `size` and thrash allocations.
   - **Recommended fix:** add a JSDoc note steering animations toward `mesh.scale` instead of `size`.

5. **[LOW] Public API uses `id` instead of `rank` + `suit` as specified in T-006**
   - **File:** [frontend/src/scenes3d/components/Card.tsx](../../frontend/src/scenes3d/components/Card.tsx) (~L52–68)
   - **Category:** convention / spec alignment
   - **Description:** T-006 description says "accepts `position, rotation, rank, suit`"; the implementation uses a single `id?: string | null`. The `id` form is better (matches plan.md's `CardRef.id` and the T-005 atlas API), but is a literal spec deviation.
   - **Recommended fix:** amend T-006's AC in tasks.md to say `id` rather than changing the code.

### Cycle 8 — `aia-core-18ns` (Scott review, 2026-04-18)

**Source:** [docs/agent/reviews/cycle-8-aia-core-18ns-2026-04-18.md](../../docs/agent/reviews/cycle-8-aia-core-18ns-2026-04-18.md)
**Source task:** T-007 / `aia-core-18ns`

Scott flagged 0 CRITICAL, 0 HIGH, 4 MEDIUM, 5 LOW. Per Anna's orchestration protocol, only CRITICAL and HIGH findings are filed into beads; MEDIUM and LOW findings are recorded here for informational / follow-up purposes only.

1. **[MEDIUM] Silent overflow past per-denom cap for large amounts**
   - **File:** [frontend/src/scenes3d/components/ChipInstances.tsx](../../frontend/src/scenes3d/components/ChipInstances.tsx) (~L58–83, `chipCountsFor`)
   - **Category:** correctness
   - **Description:** at cap=20 the maximum displayable is `20 × ($1 + $0.50 + $0.25 + $0.10) = $37`. An `amount=$50` silently clips to $37 worth of chips; realistic pot amounts (T-011/T-012) will hit this.
   - **Recommended fix:** let the smallest denom absorb the remainder, or warn in dev.

2. **[MEDIUM] StrictMode double-mount disposes GPU buffers mid-lifecycle**
   - **File:** [frontend/src/scenes3d/components/ChipInstances.tsx](../../frontend/src/scenes3d/components/ChipInstances.tsx) (~L230–235)
   - **Category:** correctness
   - **Description:** the app runs under `<StrictMode>`. `useState` preserves the same `ChipMeshPool` across the double-mount, but the disposal cleanup fires between mount phases, calling `pool.dispose()` on a still-live pool — wasted GPU upload and a latent crash if `dispose()` becomes more aggressive. Happy-dom tests don't catch this (no WebGL).
   - **Recommended fix:** pair creation + disposal in one effect, or make `ChipMeshPool.dispose()` idempotent with lazy re-alloc.

3. **[MEDIUM] O(N²) flush on cascading mount/update**
   - **File:** [frontend/src/scenes3d/components/ChipInstances.tsx](../../frontend/src/scenes3d/components/ChipInstances.tsx) (~L288–304)
   - **Category:** performance
   - **Description:** every register/update/unregister calls flush synchronously, rewriting all matrices; 2N effects across N mounting stacks → O(N²) writes. OK at N=10, pain point once T-011 mutates `committedThisStreet` per frame.
   - **Recommended fix:** debounce flush to a microtask or to R3F's `useFrame`.

4. **[MEDIUM] `yIndex` advances on capacity overflow — floating chips**
   - **File:** [frontend/src/scenes3d/components/ChipInstances.tsx](../../frontend/src/scenes3d/components/ChipInstances.tsx) (~L266–273)
   - **Category:** correctness
   - **Description:** when `slot >= pool.capacity` the chip is dropped but `yIndex++` still runs — the next denom's chip sits at a higher y, leaving a visible gap in the stack.
   - **Recommended fix:** `continue` without incrementing `yIndex`, or `break` the stack loop. Warn in dev.

5. **[LOW] Double flush on mount (register + update)**
   - **File:** [frontend/src/scenes3d/components/ChipStack.tsx](../../frontend/src/scenes3d/components/ChipStack.tsx) (~L44–60)
   - **Category:** performance
   - **Description:** two `useLayoutEffect` hooks both fire on mount with identical values → register + update back-to-back, each doing a full flush.
   - **Recommended fix:** collapse into one effect with a `mounted` ref, or drop the update effect on the first render.

6. **[LOW] Module-level mutable state leaks across `<ChipInstances>` instances**
   - **File:** [frontend/src/scenes3d/components/ChipInstances.tsx](../../frontend/src/scenes3d/components/ChipInstances.tsx) (~L108, L114)
   - **Category:** design
   - **Description:** `_latestMeshes` and `_stackIdCounter` are module-scoped; two `<ChipInstances>` in the same app would collide, and stack IDs are globally unique across unrelated scenes.
   - **Recommended fix:** use `useId()` for stack IDs; attach probe meshes to the registry object rather than a module-level variable.

7. **[LOW] `__getTestProbe` exported from the production bundle**
   - **File:** [frontend/src/scenes3d/components/ChipInstances.tsx](../../frontend/src/scenes3d/components/ChipInstances.tsx) (~L117–130)
   - **Category:** design
   - **Description:** ships in the production bundle and exposes internal `InstancedMesh` handles; the double-underscore is convention only.
   - **Recommended fix:** guard with `import.meta.env.DEV` or move to a separate test-only module.

8. **[LOW] `cap` default duplicated across two files**
   - **Files:** [frontend/src/scenes3d/components/ChipStack.tsx](../../frontend/src/scenes3d/components/ChipStack.tsx) (~L48, L58), [frontend/src/scenes3d/components/ChipInstances.tsx](../../frontend/src/scenes3d/components/ChipInstances.tsx) (~L42)
   - **Category:** convention
   - **Description:** `DEFAULT_CHIP_CAP = 20` is not exported; `ChipStack` hard-codes `cap ?? 20` in two spots.
   - **Recommended fix:** export the constant and consume it from both files.

9. **[LOW] No-provider no-op path is silent**
   - **File:** [frontend/src/scenes3d/components/ChipStack.tsx](../../frontend/src/scenes3d/components/ChipStack.tsx) (~L45, L55)
   - **Category:** DX
   - **Description:** rendering `<ChipStack>` without a provider silently no-ops (correct per contract), which makes wiring mistakes hard to catch.
   - **Recommended fix:** add a dev-only `console.warn` on the first such render.

### Cycle 9 — `aia-core-wqon` (Scott review, 2026-04-18)

**Source:** [docs/agent/reviews/cycle-9-aia-core-wqon-2026-04-18.md](../../docs/agent/reviews/cycle-9-aia-core-wqon-2026-04-18.md)
**Source task:** T-008 / `aia-core-wqon`

Scott flagged 0 CRITICAL, 0 HIGH, 3 MEDIUM, 3 LOW. Per Anna's orchestration protocol, only CRITICAL and HIGH findings are filed into beads; MEDIUM and LOW findings are recorded here for informational / follow-up purposes only.

1. **[MEDIUM] Player yaw clamp ±π/6 is world-absolute — privacy regression vector for non-facing seats**
   - **File:** [frontend/src/scenes3d/components/CameraRig.tsx](../../frontend/src/scenes3d/components/CameraRig.tsx) (~L85–96)
   - **Category:** privacy / correctness
   - **Description:** yaw clamp `[-π/6, +π/6]` is measured in world coordinates. T-022 will supply seat-specific positions for every seat; at seats not naturally facing world +z, the ±30° cone decouples from player's actual forward direction — clamp may permit looking toward another player's seat.
   - **Recommended fix:** accept a `yawCenter` offset and express clamp as `[yawCenter ± π/6]`, computed from seat angle. **Must be landed by T-022** before player POV ships — tracked here until T-022 begins.

2. **[MEDIUM] Player camera clamp tests not pinned to absolute numeric values**
   - **File:** [frontend/test/scenes3d/CameraRig.test.tsx](../../frontend/test/scenes3d/CameraRig.test.tsx) (~L113–117)
   - **Category:** test coverage
   - **Description:** yaw is pinned with `toBeCloseTo(±π/6, 6)` but `minDistance`, `maxDistance`, and polar clamps are only asserted as "≤ spectator.maxDistance" — a regression from 6 to 13 would pass silently, widening a privacy-relevant bound.
   - **Recommended fix:** add absolute-value assertions `expect(...minDistance).toBe(3)`, `.toBe(6)`, `.toBeCloseTo(π/4, 6)`, `.toBeCloseTo(0.425π, 6)`.

3. **[MEDIUM] `position`/`target` props forwarded without memoization — per-frame reissue risk**
   - **File:** [frontend/src/scenes3d/components/CameraRig.tsx](../../frontend/src/scenes3d/components/CameraRig.tsx) (~L143–145)
   - **Category:** performance
   - **Description:** inline array literals from callers allocate new refs per parent render → drei reissues `camera.position.set()` / `controls.target.copy()` every frame. `touches` is memoized but the more consequential vectors escape.
   - **Recommended fix:** either document a "pass stable refs" contract, or memoize inside the rig by element values. Matters once T-021 cinematic orbit and T-022 seat POV drive these imperatively.

4. **[LOW] Single `makeDefault` toggles both camera + controls; no StrictMode double-mount smoke test**
   - **File:** [frontend/src/scenes3d/components/CameraRig.tsx](../../frontend/src/scenes3d/components/CameraRig.tsx) (~L160, L168)
   - **Category:** test coverage
   - **Description:** drei handles restore correctly today but the StrictMode remount path is untested.
   - **Recommended fix:** add StrictMode mount/unmount test under T-009, or split into `cameraMakeDefault` / `controlsMakeDefault`.

5. **[LOW] Spectator camera defaults duplicated between PokerCanvas and `SPECTATOR_CAMERA_CONFIG`**
   - **Files:** [frontend/src/scenes3d/PokerCanvas.tsx](../../frontend/src/scenes3d/PokerCanvas.tsx) (~L37), [frontend/src/scenes3d/components/CameraRig.tsx](../../frontend/src/scenes3d/components/CameraRig.tsx) (~L51–53)
   - **Category:** convention
   - **Description:** `[0,6,8]` / `fov:45` duplicated. Intentional (rig-absent visual continuity) but undocumented.
   - **Recommended fix:** import `SPECTATOR_CAMERA_CONFIG` into `PokerCanvas` and seed inline camera from it, or add a comment on the coupling.

6. **[LOW] `viewer.seat` is typed as required-when-player but never read**
   - **File:** [frontend/src/scenes3d/components/CameraRig.tsx](../../frontend/src/scenes3d/components/CameraRig.tsx) (~L98–102)
   - **Category:** DX
   - **Description:** caller passing `{policy:'player'}` without `seat` silently gets the generic pose.
   - **Recommended fix:** add `import.meta.env.DEV` warn; align with T-022.

### Cycle 10 — T-009 / `aia-core-31hx` (Scott review, 2026-04-18)

**Source:** [docs/agent/reviews/cycle-10-aia-core-31hx-2026-04-18.md](../../docs/agent/reviews/cycle-10-aia-core-31hx-2026-04-18.md)
**Source task:** T-009 / `aia-core-31hx`

Scott flagged 0 CRITICAL, 1 HIGH, 4 MEDIUM, 5 LOW. Per Anna's orchestration protocol, only CRITICAL and HIGH findings are filed into beads; the HIGH finding (#1) is filed as a P1 bug (see **Filed Bug Cards** below). MEDIUM and LOW findings are recorded here for informational / follow-up purposes only.

1. **[HIGH] `onReady` fires twice under React `<StrictMode>`**
   - **File:** [frontend/src/scenes3d/PokerTable.tsx](../../frontend/src/scenes3d/PokerTable.tsx) (~L142–145)
   - **Category:** correctness
   - **Description:** app is StrictMode-wrapped in [frontend/src/main.tsx](../../frontend/src/main.tsx) (~L13). The `[]`-deps useEffect runs `mount → cleanup → mount` in dev, invoking `onReady?.()` twice. Test passes because `@testing-library/react` `render()` doesn't apply StrictMode. Contradicts the "exactly once on mount" docstring / AC.
   - **Recommended fix:** guard with a `useRef<boolean>(false)` sentinel and add a StrictMode-wrapped test.
   - **→ Filed into beads as a P1 bug with `discovered-from: aia-core-31hx`** (see Filed Bug Cards below).

2. **[MEDIUM] `seatChipPositions` memo re-allocates on any seat-field change**
   - **File:** [frontend/src/scenes3d/PokerTable.tsx](../../frontend/src/scenes3d/PokerTable.tsx) (~L148–152)
   - **Category:** performance
   - **Description:** memo keyed on `state.seats` invalidates on any seat-field change → new tuples → `<ChipStack>` update → full flush per render. Positions depend only on `seatIndex` / `seatCount`.
   - **Recommended fix:** key the memo on `[seatCount]` only.

3. **[MEDIUM] World-coordinate chip placement silently assumes root group carries no transform**
   - **File:** [frontend/src/scenes3d/PokerTable.tsx](../../frontend/src/scenes3d/PokerTable.tsx) (~L87–102)
   - **Category:** correctness
   - **Description:** `<ChipInstances>` is still a descendant of the `poker-table-scene` root. Any future position / rotation on the root would desync pot and seat chips from seat pads. Not currently tested.
   - **Recommended fix:** assert the invariant with a test, or render `<ChipInstances>` via an R3F scene portal so it's truly world-space (T-011 safe).

4. **[MEDIUM] Per-seat chip filter ignores `isActive` — asymmetric with hole-card filter**
   - **File:** [frontend/src/scenes3d/PokerTable.tsx](../../frontend/src/scenes3d/PokerTable.tsx) (~L231–240)
   - **Category:** correctness
   - **Description:** the filter checks only `committedThisStreet <= 0`, not `isActive`. Hole cards use `isActive && !folded`. A stale `TableState` with `isActive: false, committedThisStreet: 5` would float chips next to an empty seat.
   - **Recommended fix:** change the predicate to `seat.isActive && seat.committedThisStreet > 0` and add a regression test.

5. **[MEDIUM] `seatCommitChipWorldPosition` inline and untested — duplicated-risk for downstream consumers**
   - **File:** [frontend/src/scenes3d/PokerTable.tsx](../../frontend/src/scenes3d/PokerTable.tsx) (~L87–102)
   - **Category:** design
   - **Description:** this helper will be needed by T-011 (slide origin), T-016 (nameplate), and T-019 (dealer button).
   - **Recommended fix:** lift it to [frontend/src/scenes3d/components/tableLayout.ts](../../frontend/src/scenes3d/components/tableLayout.ts) as `seatLocalToWorld(seatIndex, seatCount, localZ, localX?)` with unit tests.

6. **[LOW] `chipCapacity = 200` default duplicates `DEFAULT_CAPACITY`**
   - **File:** [frontend/src/scenes3d/PokerTable.tsx](../../frontend/src/scenes3d/PokerTable.tsx) (~L137)
   - **Category:** convention
   - **Description:** duplicates the `DEFAULT_CAPACITY` constant in [frontend/src/scenes3d/components/ChipInstances.tsx](../../frontend/src/scenes3d/components/ChipInstances.tsx) (~L40).
   - **Recommended fix:** default the prop to `undefined` (let the provider apply its own default) or import the constant.

7. **[LOW] `POT_CHIP_POSITION` is a mutable module-level tuple**
   - **File:** [frontend/src/scenes3d/PokerTable.tsx](../../frontend/src/scenes3d/PokerTable.tsx) (~L84)
   - **Category:** convention
   - **Recommended fix:** wrap in `Object.freeze` or declare `as const readonly`.

8. **[LOW] Three separate `eslint-disable-next-line` comments**
   - **File:** [frontend/src/scenes3d/PokerTable.tsx](../../frontend/src/scenes3d/PokerTable.tsx) (~L124–129)
   - **Category:** convention
   - **Recommended fix:** consolidate via leading-underscore destructure names or a single block-disable.

9. **[LOW] `onReady` JSDoc is silent on identity capture**
   - **File:** [frontend/src/scenes3d/PokerTable.tsx](../../frontend/src/scenes3d/PokerTable.tsx) (~L56)
   - **Category:** documentation
   - **Description:** the callback identity is captured at mount; consumers passing fresh lambdas will be surprised.
   - **Recommended fix:** note the identity-capture semantic in the JSDoc.

10. **[LOW] Stable group names are a downstream selector contract but undocumented**
    - **File:** [frontend/src/scenes3d/PokerTable.tsx](../../frontend/src/scenes3d/PokerTable.tsx) (~L107–121)
    - **Category:** documentation
    - **Description:** the names (`poker-table-scene`, `community-cards`, `seats`, `hole-cards`, `chip-instances`) will be consumed as a test / selector contract by T-010, T-011, and T-019.
    - **Recommended fix:** document this as a contract in the file header.

#### Filed Bug Cards

The following finding has been converted into task-card form so Logan can sync it into beads as a discovered-from bug.

##### [BUG-CYCLE10-01] HIGH — PokerTable onReady fires twice under StrictMode
- **Source:** T-009 / `aia-core-31hx` (Cycle 10 review)
- **Priority:** P1 (HIGH)
- **Type:** bug
- **File:** [frontend/src/scenes3d/PokerTable.tsx](../../frontend/src/scenes3d/PokerTable.tsx) (~L142–145)
- **Summary:** The `[]`-deps useEffect that invokes `onReady` runs twice under React StrictMode (dev) because mount → cleanup → mount double-invokes. Current test didn't catch it since testing-library's `render()` doesn't apply StrictMode. Contradicts the docstring / AC.
- **Fix:** add a `useRef<boolean>(false)` sentinel guarding the `onReady` call; add a StrictMode-wrapped regression test.
- **Deps:** `discovered-from: aia-core-31hx`
- **Acceptance:** Mount under StrictMode fires `onReady` exactly once; new test asserts the call count; full frontend suite still passes.

### Cycle 11 — `aia-core-jbyh` (Scott review, 2026-04-18)

**Source:** [docs/agent/reviews/cycle-11-aia-core-jbyh-2026-04-18.md](../../docs/agent/reviews/cycle-11-aia-core-jbyh-2026-04-18.md)
**Source task:** bug `aia-core-jbyh` (discovered-from `aia-core-31hx` / T-009)

Scott flagged 0 CRITICAL, 0 HIGH, 0 MEDIUM, 3 LOW. Per Anna's orchestration protocol, only CRITICAL and HIGH findings are filed into beads; all 3 LOW findings below are recorded here for informational / follow-up purposes only — none filed into beads.

1. **[LOW] No reusable abstraction for one-shot mount callbacks**
   - **File:** [frontend/src/scenes3d/PokerTable.tsx](../../frontend/src/scenes3d/PokerTable.tsx) (~L143–152)
   - **Category:** design
   - **Description:** the sentinel + empty-deps + `eslint-disable` trio is inlined. When a second one-shot prop lands (e.g. `onFirstFrame`, `onSceneInit`), copy-paste creates a fresh chance to forget the sentinel.
   - **Recommended fix:** defer until a second one-shot callback appears, then extract `useOneShotEffect(fn)` at `frontend/src/scenes3d/hooks/useOneShotEffect.ts`. YAGNI for today.

2. **[LOW] `onReady` identity-stability semantics undocumented**
   - **File:** [frontend/src/scenes3d/PokerTable.tsx](../../frontend/src/scenes3d/PokerTable.tsx) (~L62)
   - **Category:** convention
   - **Description:** the `[]`-deps effect + sentinel latches the `onReady` closure from the first render. Later renders with updated `onReady` are silently ignored. Correct "once per instance" semantic but undocumented; callers closing over mutable state will be surprised.
   - **Recommended fix:** expand the prop JSDoc: "Fires exactly once per component instance; the first-render identity is captured and later updates are ignored — do not close over mutable state, use refs."

3. **[LOW] StrictMode regression coverage is local to `<PokerTable>`**
   - **File:** [frontend/test/scenes3d/PokerTable.test.tsx](../../frontend/test/scenes3d/PokerTable.test.tsx) (suite-wide recommendation)
   - **Category:** test strategy
   - **Description:** the StrictMode assertion lives only in this file, but the hazard (mount-only `useEffect` with non-idempotent side effects) applies to every scenes3d component. T-020 / T-021 / T-022 are likely to introduce more mount-only effects.
   - **Recommended fix (do NOT generalize proactively this cycle):** file a separate follow-up with two options — (a) shared `renderInStrictMode` test helper + convention, or (b) flip the default so all scenes3d tests render under `<StrictMode>`.

### Cycle 12 — T-010 / `aia-core-c8xh` (Scott review, 2026-04-18)

**Source:** [docs/agent/reviews/cycle-12-aia-core-c8xh-2026-04-18.md](../../docs/agent/reviews/cycle-12-aia-core-c8xh-2026-04-18.md)
**Source task:** T-010 / `aia-core-c8xh`

Scott flagged 0 CRITICAL, 1 HIGH, 3 MEDIUM, 4 LOW. Per Anna's orchestration protocol, only CRITICAL and HIGH findings are filed into beads; the HIGH finding (#1) is filed as a P1 bug (see **Filed Bug Cards** below). MEDIUM and LOW findings are recorded here for informational / follow-up purposes only.

1. **[HIGH] T-010 ACs describe observable animation; module-only deferral leaves all four ACs unverified on canvas**
   - **Files:** [frontend/src/scenes3d/animations/dealCards.ts](../../frontend/src/scenes3d/animations/dealCards.ts), [frontend/src/scenes3d/components/Card.tsx](../../frontend/src/scenes3d/components/Card.tsx) (~L95–142)
   - **Category:** correctness / scope
   - **Description:** `computeDealSequence` has zero consumers outside its test file; `<Card>` still renders at its `position` prop with no tween driver. `tasks.md` T-010 says "newly revealed cards animate" and `spec.md` S-2.1 says "cards fly in and flip" — present-tense verbs are the ACs. Without a `useFrame` driver, no AC can be validated end-to-end.
   - **Recommended fix:** wire `computeDealSequence` + `createTween` into `<Card>` via a `useFrame` driver component (e.g., `<DealAnimationDriver>` holding per-card refs), and add R3F render tests that verify ACs 1–4. Blocker for T-013 (showdown reveal) and T-023 (replay scrubber).
   - **→ Filed into beads as a P1 bug with `discovered-from: aia-core-c8xh`** (see Filed Bug Cards below).

2. **[MEDIUM] Hole-deal schedule exceeds spec.md S-2.1 AC 1 500ms cap for ≥5 active seats**
   - **File:** [frontend/src/scenes3d/animations/dealCards.ts](../../frontend/src/scenes3d/animations/dealCards.ts) (~L155–175)
   - **Category:** spec conflict
   - **Description:** with `DEAL_HOLE_STAGGER_MS=80` × 2 passes × N seats, the last hole tween ends at `(2N−1)·80 + 120` — 680ms @ 4 seats, 1000ms @ 6, 1480ms @ 9. `spec.md` AC 1 (≤500ms for any street transition) vs `tasks.md` T-010 AC 1 (500ms only preflop→flop) are in tension.
   - **Recommended fix:** reconcile with Jean — tighten spec or add a hole-deal total budget with compressed stagger for large tables.

3. **[MEDIUM] Driver cancellation contract for AC 4 not documented or encoded**
   - **File:** [frontend/src/scenes3d/animations/dealCards.ts](../../frontend/src/scenes3d/animations/dealCards.ts) (~L44–50)
   - **Category:** API design
   - **Description:** AC 4 ("no stale card meshes") requires drivers to cancel every in-flight tween whose `key` is absent from the new event set. JSDoc says "drivers should reuse or cancel" — permissive. No helper API (e.g., `diffDealEvents`).
   - **Recommended fix:** add a "Driver Contract" JSDoc block covering cancel-on-absent-key + handId rotation, or ship a pure `diffDealEvents` partitioner.

4. **[MEDIUM] `createTween` `reducedMotion` silently short-circuits `delayMs`**
   - **File:** [frontend/src/scenes3d/animations/tweens.ts](../../frontend/src/scenes3d/animations/tweens.ts) (~L82–96)
   - **Category:** API ergonomics
   - **Description:** `createTween({ delayMs: 200, reducedMotion: true })` collapses the delay + fires synchronously. Undocumented; trap for choreographed tweens.
   - **Recommended fix:** one-line JSDoc clarifying, or add `preserveDelayUnderReducedMotion?: boolean`.

5. **[LOW] `createTween` callbacks can throw and poison the `useFrame` loop**
   - **File:** [frontend/src/scenes3d/animations/tweens.ts](../../frontend/src/scenes3d/animations/tweens.ts) (~L128–163)
   - **Category:** robustness
   - **Recommended fix:** document "callbacks must not throw" or try/catch + mark handle cancelled.

6. **[LOW] Pure re-calls on identical transitions re-emit identical events; naïve drivers re-animate**
   - **File:** [frontend/src/scenes3d/animations/dealCards.ts](../../frontend/src/scenes3d/animations/dealCards.ts) (~L138–213)
   - **Category:** DX / documentation
   - **Recommended fix:** document the memoization expectation (`useMemo` by `[prev, next]` identity) or ship a diff helper.

7. **[LOW] `useReducedMotion` legacy branch silently no-ops if neither listener API exists**
   - **File:** [frontend/src/scenes3d/state/useReducedMotion.ts](../../frontend/src/scenes3d/state/useReducedMotion.ts) (~L35–37)
   - **Category:** convention
   - **Recommended fix:** comment noting graceful-degradation intent, or dev-only warn.

8. **[LOW] `DealEvent` omits card identity**
   - **File:** [frontend/src/scenes3d/animations/dealCards.ts](../../frontend/src/scenes3d/animations/dealCards.ts) (~L33–51)
   - **Category:** API design
   - **Description:** forces drivers to cross-reference `TableState` for flip content.
   - **Recommended fix:** consider adding `cardId?: string | null` to `DealEvent`, resolved by the sequencer.

#### Filed Bug Cards

The following finding has been converted into task-card form so Logan can sync it into beads as a discovered-from bug.

##### [BUG-CYCLE12-01] HIGH — Wire deal animations into `<Card>` via `useFrame` driver (T-010 observable ACs)
- **Source:** T-010 / `aia-core-c8xh` (Cycle 12 review)
- **Priority:** P1 (HIGH)
- **Type:** bug
- **Files:** [frontend/src/scenes3d/animations/dealCards.ts](../../frontend/src/scenes3d/animations/dealCards.ts), [frontend/src/scenes3d/components/Card.tsx](../../frontend/src/scenes3d/components/Card.tsx), new `<DealAnimationDriver>` component (likely in `scenes3d/animations/` or `scenes3d/components/`)
- **Summary:** T-010 landed the deterministic animation primitives (`computeDealSequence`, `createTween`, `useReducedMotion`) but no consumer wires them into the scene graph. `<Card>` still renders at its `position` prop with no tween. All four T-010 ACs (sequential flop ≤500ms, hole rotation order, reduced-motion instant, rapid-toggle no stale meshes) are observably unverified on canvas.
- **Fix:** Add a driver component (e.g. `<DealAnimationDriver state={state} layout={...}>` child of `<PokerTable>`) that memoizes `computeDealSequence(prev, next, layout)`, holds per-card refs, and in `useFrame` ticks active tweens, assigning world-space position / rotation to the referenced `<Card>` meshes. Cancel in-flight tweens whose `key` is absent from the new event set. Respect `useReducedMotion()`. Add R3F render tests asserting observable animation for ACs 1–4.
- **Deps:** `discovered-from: aia-core-c8xh`
- **Blocker for:** T-013 (showdown reveal), T-023 (replay scrubber)
- **Acceptance:** All four T-010 ACs verifiable in-canvas; driver cancels on key-absence; reduced-motion branch snaps instantly; full frontend suite remains green.

### Cycle 13 — aia-core-ji66 (Deal animation driver, Scott review, 2026-04-18)

**Source:** [docs/agent/reviews/cycle-13-aia-core-ji66-2026-04-18.md](../../docs/agent/reviews/cycle-13-aia-core-ji66-2026-04-18.md)
**Source task:** `aia-core-ji66` (follow-up fix for Cycle 12's BUG-CYCLE12-01 — wire `<DealAnimationDriver>` into `<PokerTable>`)

#### Summary

Scott flagged 0 CRITICAL, 2 HIGH, 3 MEDIUM, 4 LOW. Both HIGH findings were fixed by Hank in-cycle and re-confirmed by Scott; **no HIGH findings remain, and no bug cards are filed into beads this cycle**. The 3 MEDIUM + 4 LOW findings are rolled forward here per severity protocol (tasks.md ledger is their final home).

**HIGH findings fixed in-cycle:**

- **H-1 — Hole-target Y offset wrong** — hole-card tween targets resolved at table-surface Y rather than the seat's card-rest Y, causing hole cards to visually clip into the felt at landing. **Resolution:** driver now resolves `DealTarget.position.y` from the seat layout's card-rest offset; added R3F render test covering landing Y for a 6-seat table. Confirmed by Scott.
- **H-2 — Same-hand cancel-on-absent regression** — when a second `computeDealSequence` call within the same `handId` produced an event set that dropped a key (e.g., mid-street correction), the driver left the prior tween running instead of cancelling. **Resolution:** driver now diffs prev/next event keys per sequence update and calls `cancel()` on any orphaned tween handle within the same hand, not only across `handId` rotation; regression test added. Confirmed by Scott.

#### Rolled-forward findings (MEDIUM / LOW — not filed to beads)

1. **[MEDIUM] M-3 — StrictMode lifecycle unpinned for `<DealAnimationDriver>`**
   - **File:** [frontend/src/scenes3d/animations/DealAnimationDriver.tsx](../../frontend/src/scenes3d/animations/DealAnimationDriver.tsx)
   - **Category:** test strategy
   - **Description:** no mount / unmount / remount assertion for the driver under `<StrictMode>`. Matches the hazard pattern called out in Cycle 10 / Cycle 11 reviews — mount-only effects in scenes3d components need StrictMode coverage to catch double-invocation and stale-ref bugs.
   - **Recommended fix:** add a StrictMode mount→unmount→remount test asserting (a) tweens are cancelled on unmount, (b) remount does not leak prior-mount handles, (c) no duplicate `useFrame` subscriptions.

2. **[MEDIUM] M-4 — Ref mutation during render**
   - **File:** [frontend/src/scenes3d/animations/DealAnimationDriver.tsx](../../frontend/src/scenes3d/animations/DealAnimationDriver.tsx) (~L139)
   - **Category:** React correctness
   - **Description:** `reducedMotionRef.current = reducedMotion` executes in the render body. React renders must be pure; ref mutation during render is a concurrent-rendering hazard (double-invocation under StrictMode, tearing under transitions).
   - **Recommended fix:** move the assignment into a `useEffect(() => { reducedMotionRef.current = reducedMotion; }, [reducedMotion])`.

3. **[MEDIUM] M-5 — Unmount-mid-tween stale `DealTarget` closure**
   - **File:** [frontend/src/scenes3d/animations/DealAnimationDriver.tsx](../../frontend/src/scenes3d/animations/DealAnimationDriver.tsx)
   - **Category:** correctness
   - **Description:** `createTween` captures the `DealTarget` once at construction. If a target is replaced (seat re-layout, card ref swap) mid-tween, `onUpdate` writes to the stale target and the new mesh never receives the frame.
   - **Recommended fix:** inside `onUpdate`, resolve `getTarget(key)` per tick from the driver's current ref map rather than closing over the snapshot; bail gracefully if the target is absent.

4. **[LOW] L-2 — Unused `DealTarget.setRotation` method**
   - **File:** [frontend/src/scenes3d/animations/DealAnimationDriver.tsx](../../frontend/src/scenes3d/animations/DealAnimationDriver.tsx)
   - **Category:** dead code
   - **Recommended fix:** remove, or wire in once flip animation (T-013 showdown reveal) lands.

5. **[LOW] L-3 — Unused `layout.deckPosition` override**
   - **File:** driver layout prop surface
   - **Category:** dead code / API surface
   - **Recommended fix:** drop the override prop until a consumer needs it; keep default-from-layout path only.

6. **[LOW] L-4 — Comment drift in `DealAnimationController` zero-duration `onComplete` ordering**
   - **File:** [frontend/src/scenes3d/animations/DealAnimationDriver.tsx](../../frontend/src/scenes3d/animations/DealAnimationDriver.tsx) (controller inline comment)
   - **Category:** documentation
   - **Description:** comment describes a prior ordering of `onUpdate` → `onComplete` for zero-duration tweens that no longer matches the implementation (`createTween` fires `onComplete` synchronously after the single `onUpdate(1)` call).
   - **Recommended fix:** update the comment to match current behavior.

7. **[LOW] L-6 — `<PokerTable>` reserved-prop / lifecycle-sentinel crowding**
   - **File:** [frontend/src/scenes3d/PokerTable.tsx](../../frontend/src/scenes3d/PokerTable.tsx)
   - **Category:** maintainability
   - **Description:** the driver wiring added another once-per-instance sentinel + prop on `<PokerTable>`, compounding the pattern Scott flagged in Cycle 12 finding #2. No correctness issue; refactor candidate.
   - **Recommended fix:** defer to a dedicated refactor pass on `<PokerTable>` prop shape — do not address in-flight.

#### Recommendation

Batch **M-3 / M-4 / M-5** into a single "driver robustness" follow-up task under epic `aia-core-6o9t` when a natural slot opens — e.g., alongside **T-013 (showdown reveal)** or **T-023 (replay scrubber)**, both of which will exercise the driver's lifecycle and target-swap paths and will naturally benefit from StrictMode coverage, render-purity fixes, and per-tick target resolution. Do not file this as a standalone bead this cycle; schedule it when the next consumer lands.

#### Links

- Review artifact: [docs/agent/reviews/cycle-13-aia-core-ji66-2026-04-18.md](../../docs/agent/reviews/cycle-13-aia-core-ji66-2026-04-18.md)
- Parent finding (resolved): BUG-CYCLE12-01 / `aia-core-ji66`
- Prior cycle: [Cycle 12 — T-010 / `aia-core-c8xh`](#cycle-12--t-010--aia-core-c8xh-scott-review-2026-04-18)

### Cycle 14 — aia-core-6p63 (T-021 Camera presets, Scott review, 2026-04-18)

**Source:** [docs/agent/reviews/cycle-14-aia-core-6p63-2026-04-18.md](../../docs/agent/reviews/cycle-14-aia-core-6p63-2026-04-18.md)
**Source task:** `aia-core-6p63` — T-021 camera presets (top-down / default / cinematic)

#### Summary

Scott approved close with **0 CRITICAL / 0 HIGH**. All four T-021 acceptance criteria were observably verified. **4 MEDIUM + 5 LOW findings remain** and are rolled forward here per severity protocol — no bug cards are filed to beads this cycle.

#### Rolled-forward findings (MEDIUM / LOW — not filed to beads)

1. **[MEDIUM] M-1 — Re-clicking "Cinematic" after interrupt is a silent no-op**
   - **File:** [frontend/src/scenes3d/camera/cameraPresets.ts](../../frontend/src/scenes3d/camera/cameraPresets.ts) (~L128)
   - **Category:** UX / state machine
   - **Description:** the guard at `cameraPresets.ts` ~L128 exits early when `next === preset && transition === null`, so once a cinematic orbit has been interrupted by user input, re-clicking the **Cinematic** button is a silent no-op — the orbit does not resume.
   - **Recommended fix:** special-case same-preset re-click on `cinematic` to re-run `beginCinematicOrbit()` when the machine is idle (no active transition) and reduced-motion is not set.

2. **[MEDIUM] M-2 — `useFrame` mock inconsistent with the rest of the scenes3d suite**
   - **File:** [frontend/src/scenes3d/camera/CameraPresetController.test.tsx](../../frontend/src/scenes3d/camera/CameraPresetController.test.tsx)
   - **Category:** test strategy
   - **Description:** the controller test uses a replace-latest `useFrame` mock pattern, while the rest of the scenes3d suite uses append-only. Divergence risks false-negatives on unmount leakage and subscription-count assertions.
   - **Recommended fix:** align the mock pattern with the suite, or add explicit unmount cleanup assertions to close the gap.

3. **[MEDIUM] M-3 — `reducedMotion` captured at mount; post-mount OS toggles ignored**
   - **File:** [frontend/src/scenes3d/camera/CameraPresetController.tsx](../../frontend/src/scenes3d/camera/CameraPresetController.tsx)
   - **Category:** React correctness / accessibility
   - **Description:** `reducedMotion` is read once at mount. If the user toggles the OS-level preference after the controller mounts, the change is ignored until the component is re-keyed or the app reloads.
   - **Recommended fix:** add `machine.setReducedMotion()` and a `useEffect([reducedMotion])` that forwards updates into the machine, **or** re-key the controller on `reducedMotion` change.

4. **[MEDIUM] M-4 — `<CameraPresetToolbar>` has zero production consumers**
   - **File:** `<CameraPresetToolbar>` (exported + tested, no consumer)
   - **Category:** API drift / integration risk
   - **Description:** the toolbar is exported and fully tested, but nothing in production imports it yet. API drift risk accumulates until T-022 (seat-POV) or T-031 (playback) wires it up.
   - **Recommended fix:** re-review `CameraPresetToolbarProps` before any consumer integration lands; treat the current shape as provisional.

5. **[LOW] L-1 — Silent Seat-POV fallback in `resolveNamedPreset`**
   - **File:** [frontend/src/scenes3d/PokerTable.tsx](../../frontend/src/scenes3d/PokerTable.tsx) (~L92–L95)
   - **Category:** diagnostics
   - **Description:** Seat-POV requests silently fall back to the default preset; no signal to the developer that the dedicated branch hasn't landed yet.
   - **Recommended fix:** add a dev-mode `console.warn` on the fallback path until T-022 lands the dedicated Seat-POV branch.

6. **[LOW] L-2 — `cameraPresets.test.ts` declares `@vitest-environment happy-dom` unnecessarily**
   - **File:** [frontend/src/scenes3d/camera/cameraPresets.test.ts](../../frontend/src/scenes3d/camera/cameraPresets.test.ts)
   - **Category:** test hygiene
   - **Description:** the file exercises pure logic (no DOM), but declares `happy-dom` at the top.
   - **Recommended fix:** switch the env directive to `node`.

7. **[LOW] L-3 — No explicit StrictMode test for the camera preset controller**
   - **File:** `CameraPresetController.test.tsx`
   - **Category:** test coverage
   - **Description:** mount / unmount / remount under `<StrictMode>` is not asserted for the controller. Subsumed by the prior suite-wide StrictMode follow-up recommendation (see Cycle 13 M-3).
   - **Recommended fix:** roll into the existing driver-robustness / StrictMode follow-up.

8. **[LOW] L-4 — `onInteract` prop name is broader than its semantic**
   - **File:** controller prop surface
   - **Category:** API naming
   - **Description:** `onInteract` only fires on cinematic-yield (user input that aborts the cinematic orbit); the name implies any interaction.
   - **Recommended fix:** rename to `onCinematicYield` before external consumers attach.

9. **[LOW] L-5 — Per-frame 6-scalar pose equality in `setPose`**
   - **File:** [frontend/src/scenes3d/camera/CameraPresetController.tsx](../../frontend/src/scenes3d/camera/CameraPresetController.tsx) (~L66–L82)
   - **Category:** micro-perf / clarity
   - **Description:** `setPose` compares six scalars per frame to decide whether to commit. Negligible perf cost, but noisy.
   - **Recommended fix:** replace with a version counter or an array-identity check.

#### Recommendation

**M-1** and **M-3** should be resolved before either **T-022** (seat-POV preset) or **T-031** (playback wire-up) consumes the toolbar — both are user-facing behavior gaps that will surface immediately once the toolbar has real consumers. **M-2** and **L-3** roll into the existing "driver robustness / StrictMode" follow-up accumulating against the epic (see Cycle 13 recommendation). **M-4**, **L-1**, **L-2**, **L-4**, and **L-5** are low-urgency and can be cleaned up alongside the first consumer integration.

#### Links

- Review artifact: [docs/agent/reviews/cycle-14-aia-core-6p63-2026-04-18.md](../../docs/agent/reviews/cycle-14-aia-core-6p63-2026-04-18.md)
- Prior cycle: [Cycle 13 — aia-core-ji66](#cycle-13--aia-core-ji66-deal-animation-driver-scott-review-2026-04-18)

### Cycle 15 — aia-core-xasw (T-019 Dealer/SB/BB markers, Scott review, 2026-04-18)

**Source:** [docs/agent/reviews/cycle-15-aia-core-xasw-2026-04-18.md](../../docs/agent/reviews/cycle-15-aia-core-xasw-2026-04-18.md)
**Source task:** `aia-core-xasw` — T-019 Dealer / SB / BB seat markers

#### Summary

Scott approved close with **0 CRITICAL / 0 HIGH**. All four T-019 acceptance criteria were observably verified and T-019 is closed. **3 MEDIUM + 4 LOW findings remain** and are rolled forward here per severity protocol — no bug cards are filed to beads this cycle.

#### Rolled-forward findings (MEDIUM / LOW — not filed to beads)

1. **[MEDIUM] M-1 — Heads-up (2-player) edge case: dealer IS SB**
   - **File:** [frontend/src/scenes3d/markers/DealerButton.tsx](../../frontend/src/scenes3d/markers/DealerButton.tsx) (~L73–L89)
   - **Category:** correctness / poker-rules edge case
   - **Description:** in heads-up play the dealer is also the small blind, so `ccwDiff === 0` and the default `+X` offset places the dealer button overlay directly on top of the SB disc.
   - **Recommended fix:** either confirm heads-up is out of scope with a pinning test, or special-case `ccwDiff === 0` to pick a non-overlapping offset.

2. **[MEDIUM] M-2 — `setState` vs. direct `object3D` mutation pattern split is undocumented**
   - **File:** [frontend/src/scenes3d/markers/DealerButton.tsx](../../frontend/src/scenes3d/markers/DealerButton.tsx) (~L211–L233)
   - **Category:** maintainability / epic-wide convention
   - **Description:** the choice between React `setState` and direct `object3D` mutation is now principled but undocumented across the epic. New contributors have to infer the rule from prior PRs.
   - **Recommended fix:** add JSDoc to `<TableMarkers>` explaining the pattern-selection rule — few/rare transitions → `setState`; many/continuous → direct mutation.

3. **[MEDIUM] M-3 — `useMemo(…, [])` + `eslint-disable exhaustive-deps` for seed state**
   - **File:** [frontend/src/scenes3d/markers/DealerButton.tsx](../../frontend/src/scenes3d/markers/DealerButton.tsx) (~L166–L175)
   - **Category:** React idiom / code smell
   - **Description:** `useMemo(…, [])` with an `eslint-disable exhaustive-deps` comment is being used to seed mount-time state. This is a recognised smell.
   - **Recommended fix:** replace with a `useState(() => …)` lazy initializer.

4. **[LOW] L-1 — Marker text labels ("D" / "SB" / "BB") deferred**
   - **File:** [frontend/src/scenes3d/markers/DealerButton.tsx](../../frontend/src/scenes3d/markers/DealerButton.tsx) (~L253–L290)
   - **Category:** accessibility polish
   - **Description:** color-only encoding of Dealer / SB / BB may fail a future accessibility review.
   - **Recommended fix:** polish follow-up — add drei `<Text>` labels on each marker.

5. **[LOW] L-2 — Non-adjacent-SB default direction test does not pin sign**
   - **File:** [frontend/src/scenes3d/markers/DealerButton.test.tsx](../../frontend/src/scenes3d/markers/DealerButton.test.tsx) (~L137–L140)
   - **Category:** test precision
   - **Description:** the test asserts `|offset| === X` without pinning the sign; a regression that flipped to `-X` would still pass.
   - **Recommended fix:** tighten the assertion to `toBe(+X)`.

6. **[LOW] L-3 — Unmount cleanup captures `tweensRef.current` in effect body**
   - **File:** [frontend/src/scenes3d/markers/DealerButton.tsx](../../frontend/src/scenes3d/markers/DealerButton.tsx) (~L243–L249)
   - **Category:** React idiom
   - **Description:** the effect captures `tweensRef.current` in the effect body. Idiomatic React reads `.current` inside the cleanup closure so unmount sees the latest value.
   - **Recommended fix:** move the `.current` read inside the cleanup function.

7. **[LOW] L-4 — Header comment understates what triggers re-placement**
   - **File:** [frontend/src/scenes3d/markers/DealerButton.tsx](../../frontend/src/scenes3d/markers/DealerButton.tsx) (~L4–L6)
   - **Category:** documentation
   - **Description:** the header says "when the dealer rotates", but SB/BB can also change independently on bust-outs.
   - **Recommended fix:** expand to "when the dealer, SB, or BB seat changes".

#### Recommendation

**M-1** should be resolved before **T-025** or any heads-up scenario tests land — the overlap will surface immediately once a 2-player fixture exists. **M-2** joins the epic-wide **"driver robustness + pattern documentation"** follow-up accumulating against the epic. **M-3** and **L-3** are quick wins and can piggyback on the next marker or driver touch-up. **L-1**, **L-2**, and **L-4** are low-urgency polish.

#### Links

- Review artifact: [docs/agent/reviews/cycle-15-aia-core-xasw-2026-04-18.md](../../docs/agent/reviews/cycle-15-aia-core-xasw-2026-04-18.md)
- Prior cycle: [Cycle 14 — aia-core-6p63](#cycle-14--aia-core-6p63-t-021-camera-presets-scott-review-2026-04-18)

### Cycle 16 — aia-core-2hot (T-016 Nameplate, Scott review, 2026-04-18)

**Source:** [docs/agent/reviews/cycle-16-aia-core-2hot-2026-04-18.md](../../docs/agent/reviews/cycle-16-aia-core-2hot-2026-04-18.md)
**Source task:** `aia-core-2hot` — T-016 Nameplate (name + stack label)

#### Summary

T-016 implementation landed and is **closed**. Scott flagged **1 HIGH** — AC 3 "legibility at 360px" is currently proxied by world-unit geometry regression floors rather than actual text rasterization, because the placeholder `<Nameplate>` renders a solid plane, not glyphs. The HIGH is filed as **BUG-CYCLE16-01** (real WebGL text rasterization) and T-016 closes with the deferred rasterization explicitly called out. **4 MEDIUM + 5 LOW findings** are recorded below.

#### Filed bug card — BUG-CYCLE16-01

- **Title:** Nameplate real WebGL text rasterization (AC 3 legibility)
- **Severity:** HIGH → **P1** in beads
- **Parent:** `aia-core-6o9t` (epic)
- **Discovered-from:** `aia-core-2hot` (T-016)
- **Description:** `<Nameplate>` currently renders a solid `#f8fafc` plane placeholder at [frontend/src/scenes3d/Nameplate.tsx](../../frontend/src/scenes3d/Nameplate.tsx) ~L251–L262 instead of real glyphs. AC 3 legibility at 360px is proxied by world-unit regression floors (`NAMEPLATE_FONT_SIZE ≥ 0.08`, `NAMEPLATE_WIDTH ≥ 0.6`) — geometry check, not actual text rendering. Needs drei `<Text>` / troika SDF text mesh wired to the already-computed `data-label` content (name + formatted stack). Preserve reduced-motion snap, billboard driver, and stack-tween write-through to the glyph label. Must not regress the 31 existing Nameplate tests. Consolidate the `data-*` + `userData` dual test-hook channels (M3) while there — three.js ignores `data-*` in production.
- **Acceptance:**
  1. Real text glyphs render at run time.
  2. Headless playwright or screenshot test asserts label content visible at nominal camera distance.
  3. Existing 31 Nameplate tests remain green.
  4. `data-*` dual-hook cleanup (M3) applied in same change.

#### Rolled-forward findings (MEDIUM / LOW — not filed to beads)

1. **[MEDIUM] M-1 — `setRotationY` per-seat per-frame defeats epsilon bailout during camera tweens**
   - **File:** [frontend/src/scenes3d/Nameplate.tsx](../../frontend/src/scenes3d/Nameplate.tsx)
   - **Category:** performance
   - **Description:** ~600 commits/sec at 10 seats during camera tweens; the epsilon bailout is bypassed because `setRotationY` is called on every frame.
   - **Recommended fix:** imperative `group.rotation.y` write via a mesh-ref, once the scene-graph driver lands.

2. **[MEDIUM] M-2 — Repopulated-seat stack tween bug**
   - **File:** [frontend/src/scenes3d/Nameplate.tsx](../../frontend/src/scenes3d/Nameplate.tsx)
   - **Category:** correctness
   - **Description:** if seat 0 (Alice $1000) becomes Bob ($500), Bob's nameplate tweens 1000→500 over 300ms on first render.
   - **Recommended fix:** on occupied `false → true` transition, set `displayedStackRef.current = stack` **before** the tween decision so it early-returns.

3. **[MEDIUM] M-3 — Dual `data-*` + `userData` test-hook channels**
   - **File:** [frontend/src/scenes3d/Nameplate.tsx](../../frontend/src/scenes3d/Nameplate.tsx)
   - **Category:** test hygiene
   - **Description:** the dual channel is an R3F-mock artifact; three.js ignores `data-*` in production, so the prop-channel is dead weight at run time.
   - **Recommended fix:** consolidate when real `<Text>` lands — tied to **BUG-CYCLE16-01** scope.

4. **[MEDIUM] M-4 — `BILLBOARD_EPSILON = 1e-4` is unexported**
   - **File:** [frontend/src/scenes3d/Nameplate.tsx](../../frontend/src/scenes3d/Nameplate.tsx)
   - **Category:** consistency
   - **Description:** inconsistent with the rest of the module's exported tunables (`NAMEPLATE_FONT_SIZE`, `NAMEPLATE_WIDTH`, etc.).
   - **Recommended fix:** export alongside the other tunables.

5. **[LOW] L-1 — No StrictMode-wrapped test for `<Nameplates>` wrapper**
   - **File:** [frontend/src/scenes3d/Nameplate.tsx](../../frontend/src/scenes3d/Nameplate.tsx)
   - **Category:** test coverage
   - **Description:** `<PokerTable>` has a StrictMode double-invocation pin; the `<Nameplates>` wrapper does not.
   - **Recommended fix:** mirror the PokerTable StrictMode test pattern.

6. **[LOW] L-2 — `react-hooks/set-state-in-effect` eslint-disable is sound but pattern is repeating**
   - **File:** [frontend/src/scenes3d/Nameplate.tsx](../../frontend/src/scenes3d/Nameplate.tsx)
   - **Category:** DRY / idiom
   - **Description:** the disable is justified locally, but the same shape is starting to appear elsewhere.
   - **Recommended fix:** extract into a `useSyncedRef(value)` helper if the pattern repeats — candidate for **T-017**.

7. **[LOW] L-3 — Unused `const el = ...; void el;` in billboard first-frame test**
   - **File:** [frontend/src/scenes3d/Nameplate.test.tsx](../../frontend/src/scenes3d/Nameplate.test.tsx)
   - **Category:** test hygiene
   - **Description:** the binding is captured and immediately discarded with `void el;`.
   - **Recommended fix:** either use `el` in an assertion or drop the binding.

8. **[LOW] L-4 — `formatStackAmount` reimplements currency formatting**
   - **File:** [frontend/src/scenes3d/Nameplate.tsx](../../frontend/src/scenes3d/Nameplate.tsx)
   - **Category:** DRY
   - **Description:** duplicates what `Intl.NumberFormat` already provides for currency/compact formatting.
   - **Recommended fix:** delegate to `Intl.NumberFormat`.

9. **[LOW] L-5 — `computeNameplateWorldPosition` hardcodes local offset**
   - **File:** [frontend/src/scenes3d/Nameplate.tsx](../../frontend/src/scenes3d/Nameplate.tsx)
   - **Category:** extensibility
   - **Description:** hardcodes `[0, NAMEPLATE_LOCAL_Y, 0]`; future badge/overlay work will want a configurable offset.
   - **Recommended fix:** accept an optional offset argument.

#### Recommendation

**BUG-CYCLE16-01** should land before any visual QA / alpha screencap review — the current placeholder plane will read as a rendering defect in any screenshot. **M-1** and **M-2** should batch with BUG-CYCLE16-01 (same file, same touch window). **M-3** consolidation is explicitly in BUG-CYCLE16-01's scope. **M-4** and the LOW findings are polish that can piggyback on the next Nameplate touch.

#### Links

- Review artifact: [docs/agent/reviews/cycle-16-aia-core-2hot-2026-04-18.md](../../docs/agent/reviews/cycle-16-aia-core-2hot-2026-04-18.md)
- Prior cycle: [Cycle 15 — aia-core-xasw](#cycle-15--aia-core-xasw-t-019-dealersbbb-markers-scott-review-2026-04-18)

### Cycle 17 — aia-core-ovhb (Nameplate real text rasterization, Scott review, 2026-04-18)

**Source:** [docs/agent/reviews/cycle-17-aia-core-ovhb-2026-04-18.md](../../docs/agent/reviews/cycle-17-aia-core-ovhb-2026-04-18.md)
**Source task:** `aia-core-ovhb` — BUG-CYCLE16-01 follow-up (real WebGL text rasterization)

#### Summary

`aia-core-ovhb` is **closed**. Real text rasterization via drei `<Text>` (troika SDF) replaced the placeholder plane in `<Nameplate>`, and the Cycle 16 rolled-forward **M-2** (repopulated-seat snap) and **M-4** (`BILLBOARD_EPSILON` export) were folded into the same change. Scott flagged **0 HIGH** — no Filed Bug Card this cycle. **3 MEDIUM + 4 LOW findings** roll forward.

#### Rolled-forward findings (MEDIUM / LOW — not filed to beads)

1. **[MEDIUM] M-1 — No headless / screenshot legibility test (AC 2 of BUG-CYCLE16-01)**
   - **Category:** test coverage
   - **Description:** AC 2 of BUG-CYCLE16-01 called for a headless playwright / screenshot assertion that the label is visible at nominal camera distance. happy-dom cannot render WebGL, so the assertion is deferred as a **standing gap**.
   - **Recommended fix:** optional playwright screenshot test in a future dedicated visual-QA task.

2. **[MEDIUM] M-2 — Troika default font fetches Roboto Regular from Google Fonts at runtime**
   - **File:** [frontend/src/scenes3d/Nameplate.tsx](../../frontend/src/scenes3d/Nameplate.tsx)
   - **Category:** correctness / deployability
   - **Description:** drei `<Text>` with no `font` prop falls back to troika's default (Roboto Regular fetched from Google Fonts). Two risks: (a) non-ASCII player names (Cyrillic / CJK / Arabic / Hebrew) render as `.notdef` tofu because Roboto Regular lacks those glyph ranges; (b) offline / air-gapped venue deploys silently fail the font fetch.
   - **Recommended fix:** self-host a font asset under `frontend/public/fonts/` and pass `font={...}` to drei `<Text>`.

3. **[MEDIUM] M-3 — Repopulated-seat snap covers `occupied` false→true only, not same-seat name change**
   - **File:** [frontend/src/scenes3d/Nameplate.tsx](../../frontend/src/scenes3d/Nameplate.tsx)
   - **Category:** correctness
   - **Description:** the M-2 fix snaps `displayedStack` on `occupied` false→true, but an Alice→Bob same-seat swap **without** a null frame in between still tweens Alice's stack down to Bob's. Pre-existing gap, not widened by the M-2 fix, but still live.
   - **Recommended fix:** add a `prevPlayerNameRef` sentinel so a name change also snaps `displayedStack`.

4. **[LOW] L-1 — Four files independently mock `@react-three/drei`**
   - **Files:** Nameplate, PokerTable, CameraRig, CameraPresetController test modules
   - **Category:** test hygiene / DRY
   - **Description:** when T-022 / T-031 pull another drei primitive, a missed mock in one of the four will fail silently.
   - **Recommended fix:** extract a shared `__mocks__/drei.tsx` before the next drei consumer lands.

5. **[LOW] L-2 — `BILLBOARD_EPSILON` export has no external consumers**
   - **File:** [frontend/src/scenes3d/Nameplate.tsx](../../frontend/src/scenes3d/Nameplate.tsx)
   - **Category:** consistency
   - **Description:** exported for parity with the other tunables (M-4 fix) but nothing imports it today.
   - **Recommended fix:** either document intended use or drop the export.

6. **[LOW] L-3 — Prior-cycle LOW carries (no change)**
   - **Category:** carry-forward
   - **Description:** existing LOW items recorded in Cycle 16 remain open; not widened or narrowed this cycle.

7. **[LOW] L-4 — Mid-hand buy-in is intended tween behavior but not commented**
   - **File:** [frontend/src/scenes3d/Nameplate.tsx](../../frontend/src/scenes3d/Nameplate.tsx)
   - **Category:** documentation
   - **Description:** the stack tween intentionally animates mid-hand buy-ins; a future reader may misread this as a bug.
   - **Recommended fix:** add an explicit comment in `<Nameplate>` calling out the intended behavior.

#### Recommendation

**M-2** (self-hosted font) should land before any public alpha deployment — non-ASCII names and offline deploys will break silently otherwise. **M-1** (screenshot test) can batch with T-032 if that story picks up visual QA, or live as a standing deferred gap. **M-3** is a quick win next time `<Nameplate>` is touched. **L-1** should land before T-022 adds the next drei consumer.

#### Links

- Review artifact: [docs/agent/reviews/cycle-17-aia-core-ovhb-2026-04-18.md](../../docs/agent/reviews/cycle-17-aia-core-ovhb-2026-04-18.md)
- Prior cycle: [Cycle 16 — aia-core-2hot](#cycle-16--aia-core-2hot-t-016-nameplate-scott-review-2026-04-18)

### Cycle 18 — aia-core-i9s6 (T-015 theme slice + settings panel, Scott review, 2026-04-18)

**Source:** [docs/agent/reviews/cycle-18-aia-core-i9s6-2026-04-18.md](../../docs/agent/reviews/cycle-18-aia-core-i9s6-2026-04-18.md)
**Source task:** T-015 — Zustand `useTableStore` theme slice + `<TableSettingsPanel>`

#### Summary

T-015 is **closed**. The Zustand theme slice and `<TableSettingsPanel>` landed; ACs 1 / 2 / 3 are satisfied. **AC 4** (route-level consumption) is intentionally deferred to T-030 / T-031 route migrations. Scott flagged **0 HIGH** — no Filed Bug Card this cycle. **3 MEDIUM + 4 LOW findings** roll forward.

#### Rolled-forward findings (MEDIUM / LOW — not filed to beads)

1. **[MEDIUM] M-1 — Plan drift: `<PokerTable>` does not subscribe to the theme store**
   - **Category:** plan / task-description drift
   - **Description:** The T-015 task text says "`<PokerTable>` subscribes to theme," but the shipped implementation keeps `theme` as a prop on `<PokerTable>` and only `<TableSettingsPanel>` reads the store directly. This is a **better design** — it preserves `<PokerTable>` identity isolation and keeps the component free of global-store coupling — but the downstream task descriptions need to reflect the actual wiring.
   - **Recommended fix:** amend T-030 and T-031 task descriptions to read "wire `useTableStore(s => s.theme)` at the route shell and forward as `<PokerTable theme={...}>` prop" **before** those tasks are claimed.

2. **[MEDIUM] M-2 — AC 3 "no canvas remount" verified via proxy, not real-canvas stability**
   - **Category:** test coverage
   - **Description:** AC 3 was validated via a Zustand subscribe-count assertion plus a DOM re-render proxy. That proves the store wiring is sane but does not prove the real R3F canvas keeps a stable renderer identity across `setTheme`. happy-dom cannot render WebGL, so the real assertion has to move to the route integration layer.
   - **Recommended fix:** T-030 must add an integration assertion that renderer identity (or `onReady` call count) is stable across `setTheme` transitions.

3. **[MEDIUM] M-3 — No persistence migration story**
   - **Category:** forward compatibility
   - **Description:** The slice reserves `version: 1` and uses `partialize: { theme }` only. Additive new slices are safe, but **reshaping the `theme` field is not** — a future rename or type change will silently hydrate stale payloads into the new shape. There is no `migrate(state, version)` scaffold yet.
   - **Recommended fix:** add a 2-line contract comment at the `version: 1` declaration documenting what is persisted and what a bump requires, and scaffold `migrate(state, version)` the first time `partialize` expands. T-021 (camera preset persistence) is the likely trigger.

4. **[LOW] L-1 — Module-level `create()` singleton needs a doc comment**
   - **Category:** documentation
   - **Description:** The module-level `create()` call is StrictMode-safe and **intentional** for cross-canvas user preferences (one store, many mount points). Without a comment, a future reader may mistake it for accidental global state.
   - **Recommended fix:** add a one-line doc comment above `create()` calling out the intentional cross-canvas singleton.

5. **[LOW] L-2 — `createJSONStorage(() => localStorage)` is SSR-unsafe**
   - **Category:** portability
   - **Description:** `createJSONStorage(() => localStorage)` will throw at module load time if this slice is ever imported by an SSR surface. No such surface exists today (Vite SPA only), but the moment one ships the slice will crash on the server.
   - **Recommended fix:** add a `typeof window !== 'undefined'` guard before any SSR surface ships.

6. **[LOW] L-3 — `act()` wrap in the external-update test is correct React 18 hygiene**
   - **Category:** confirmation (no action)
   - **Description:** The `act()` wrap around external store mutations in the hook test is correct React 18 testing hygiene — not a reconciler concern, not a code smell. Logged here only to head off a future reviewer removing it as "unnecessary."

7. **[LOW] L-4 — `TABLE_STORE_PERSIST_KEY` not re-exported from `scenes3d/index.ts` barrel**
   - **Category:** consistency
   - **Description:** `TABLE_STORE_PERSIST_KEY` is exported from the slice module but not re-exported from the `scenes3d/index.ts` barrel alongside the other public symbols.
   - **Recommended fix:** add it to the barrel re-exports.

#### Recommendation

**M-1** must be addressed **inside** the T-030 and T-031 task descriptions before either task is claimed — the current wording will mislead the implementer. **M-2** is the integration test those same two tasks should carry. **M-3** (migration scaffold + contract comment) becomes relevant the moment T-021 persists camera preset; land the comment now, land `migrate(...)` the first time `partialize` expands. The four LOWs are small documentation / barrel / guard hygiene items that can batch into the next touch of the slice.

#### Links

- Review artifact: [docs/agent/reviews/cycle-18-aia-core-i9s6-2026-04-18.md](../../docs/agent/reviews/cycle-18-aia-core-i9s6-2026-04-18.md)
- Prior cycle: [Cycle 17 — aia-core-ovhb](#cycle-17--aia-core-ovhb-nameplate-real-text-rasterization-scott-review-2026-04-18)

### Cycle 19 — aia-core-nwmf (T-011 chip-slide primitives, Scott review, 2026-04-18)

**Source:** [docs/agent/reviews/cycle-19-aia-core-nwmf-2026-04-18.md](../../docs/agent/reviews/cycle-19-aia-core-nwmf-2026-04-18.md)
**Source task:** T-011 — chip-slide animation primitives (`chipSlides.ts` + `ChipSlideController` + `<ChipSlideDriver>`)

#### Summary

T-011 is **closed**. The chip-slide primitives (`chipSlides.ts` sequencer, `ChipSlideController` tween manager, `<ChipSlideDriver>` R3F component) shipped cleanly but the visual wiring into `<PokerTable>` is deferred — same pattern as Cycle 12's T-010. Scott flagged **1 HIGH**, filed as **BUG-CYCLE19-01** (P1, `discovered-from: aia-core-nwmf`, parent `aia-core-6o9t`). **3 MEDIUM + 4 LOW findings** roll forward.

#### Filed Bug Cards

The following finding has been converted into task-card form so Logan can sync it into beads as a discovered-from bug.

##### [BUG-CYCLE19-01] HIGH — Wire chip-slide driver into `<PokerTable>` (T-011 observable ACs)
- **Source:** T-011 / `aia-core-nwmf` (Cycle 19 review)
- **Priority:** P1 (HIGH)
- **Type:** bug
- **Parent:** `aia-core-6o9t`
- **Deps:** `discovered-from: aia-core-nwmf`
- **Files:** [frontend/src/scenes3d/components/PokerTable.tsx](../../frontend/src/scenes3d/components/PokerTable.tsx), [frontend/src/scenes3d/animations/ChipSlideDriver.tsx](../../frontend/src/scenes3d/animations/ChipSlideDriver.tsx), [frontend/src/scenes3d/animations/chipSlides.ts](../../frontend/src/scenes3d/animations/chipSlides.ts), [frontend/src/scenes3d/components/ChipStack.tsx](../../frontend/src/scenes3d/components/ChipStack.tsx), [frontend/src/scenes3d/tableLayout.ts](../../frontend/src/scenes3d/tableLayout.ts)
- **Summary:** T-011 shipped `ChipSlideController` + `<ChipSlideDriver>` + `chipSlides.ts` primitives, but `<PokerTable>` never mounts the driver or subtracts in-flight amounts. Seat `<ChipStack amount={seat.committedThisStreet}>` and pot `<ChipStack amount={state.pot}>` bypass the controller; no flying chip-slug mesh renders. Spec sentence "Originating `<ChipStack>` shrinks immediately; pot grows on arrival" is unverified in-canvas.
- **Work items:**
  1. Mount `<ChipSlideDriver>` inside `<PokerTable>` passing `state` + `buildPokerTableChipSlideLayout`.
  2. Subtract `getInFlightAmountForSeat(seatIndex)` from each seat's displayed `<ChipStack>` amount.
  3. Subtract/add `getInFlightPotAmount()` to pot `<ChipStack>`; add arrivals as they complete.
  4. Render a small moving `<ChipStack>` at `getInFlightPosition(key)` for each active slide key.
  5. Handle street-transition in-flight edge (Cycle 19 M-2): when `committedThisStreet` resets to 0 mid-slide, clamp the subtraction at 0 OR clear `inFlight` on street change and let the slug keep flying. Pick one and document.
  6. Resolve Cycle 19 L-1 — hoist `POT_CHIP_POSITION` / `POT_CHIP_WORLD_POSITION` into `tableLayout.ts`.
- **Acceptance:** T-011 ACs 1 / 2 / 4 observable in-canvas: integration test asserts seat `<ChipStack>` shrinks within one frame of a bet action; pot `<ChipStack>` grows after tween completes; two concurrent seat bets both shrink + both arrive at pot; fold does not trigger a slide. Full frontend suite green.

#### Rolled-forward findings (MEDIUM / LOW — not filed to beads)

1. **[MEDIUM] M-1 — Controller tests use geometrically synthetic layouts; no end-to-end anchor to `buildPokerTableChipSlideLayout`**
   - **Category:** test coverage
   - **Description:** `ChipSlideController` tests synthesize layouts with `(i) => [i, 0, 0]` and assert only that the controller tweens between abstract points. There is no test that wires the controller to the real `buildPokerTableChipSlideLayout` output, so anchor drift (seat-ring radius, pot z-offset) would not be caught here.
   - **Recommended fix:** covered by the integration test required by **BUG-CYCLE19-01 acceptance**; no standalone follow-up needed.

2. **[MEDIUM] M-2 — Street-transition in-flight edge: `inFlight` persists across street resets by design**
   - **Category:** API design / consumer contract
   - **Description:** On street transition, `committedThisStreet` resets to 0 for every seat, but any chip slide still mid-flight keeps its `inFlight` entry. A naïve render consumer will compute `committedThisStreet − inFlight = 0 − delta = negative`.
   - **Recommended fix:** handled as **BUG-CYCLE19-01 work item (5)** — either clamp the subtraction at 0 or clear `inFlight` on street change and let the slug keep flying. Pick one and document at the controller API.

3. **[MEDIUM] M-3 — Reduced-motion ordering: `onSlideStart` fires AFTER `onSlideComplete`**
   - **File:** [frontend/src/scenes3d/animations/ChipSlideController.ts](../../frontend/src/scenes3d/animations/ChipSlideController.ts)
   - **Category:** correctness (reduced-motion branch)
   - **Description:** Under reduced-motion, `createTween` completes synchronously inside the same tick. Because `onSlideStart` is invoked **after** `createTween(...)` in `ChipSlideController.sync`, the start callback fires *after* the complete callback under reduced-motion — breaking lifecycle ordering for any consumer that gates render state on `onSlideStart`.
   - **Recommended fix:** move the `onSlideStart` invocation to fire **before** `createTween(...)` in `ChipSlideController.sync`. Can piggyback on **BUG-CYCLE19-01** since that claim is already in the same file.

4. **[LOW] L-1 — `POT_CHIP_WORLD_POSITION` in `ChipSlideDriver` duplicates `POT_CHIP_POSITION` in `<PokerTable>`**
   - **Category:** DRY / consistency
   - **Description:** Both constants resolve to the identical `[0, 0, -0.9]`. A future layout change in one place will silently drift from the other.
   - **Recommended fix:** hoist into `tableLayout.ts` as the single source of truth — listed as **BUG-CYCLE19-01 work item (6)**.

5. **[LOW] L-2 — `<ChipSlideDriver>` `onController` fires per-instance under StrictMode**
   - **Category:** DX / documentation
   - **Description:** Under React 18 StrictMode, the driver mounts twice, so `onController` fires twice with different controller instances. Parent handlers that store the controller in `useState` will end up with a stale reference to the unmounted copy; storing in a `useRef` avoids this.
   - **Recommended fix:** add a JSDoc note on the `onController` prop calling out the StrictMode double-mount and recommending a ref sink.

6. **[LOW] L-3 — `chipSlides.ts` "missing prev seat" branch has JSDoc but no test**
   - **File:** [frontend/src/scenes3d/animations/chipSlides.ts](../../frontend/src/scenes3d/animations/chipSlides.ts)
   - **Category:** test coverage
   - **Description:** The sequencer's documented behavior for the "seat present in `next` but absent from `prev`" case is not exercised by any test. A minimal `{ prev: [seat0], next: [seat0, seat1 committed: 50] }` case would lock it in.
   - **Recommended fix:** add the test case; can piggyback on **BUG-CYCLE19-01** since work already touches this file.

7. **[LOW] L-4 — `CHIP_SLIDE_DURATION_MS = 400` bare constant; T-027 quality-tier variation deferred**
   - **File:** [frontend/src/scenes3d/animations/ChipSlideController.ts](../../frontend/src/scenes3d/animations/ChipSlideController.ts)
   - **Category:** forward compatibility
   - **Description:** `CHIP_SLIDE_DURATION_MS` is a bare module constant with no hook into the quality-tier system that T-027 will introduce. Acceptable today; note it so T-027 catches it.
   - **Recommended fix:** none now — flag this constant in the T-027 task description when that work is claimed.

#### Recommendation

**BUG-CYCLE19-01** should be the next claim on this theme — it converts three shipped primitives into observable chip motion and unblocks T-011's ACs on canvas. **M-3** (reduced-motion ordering) and **L-3** (sequencer test case) can piggyback on that same claim since the work already opens those files. **L-1** (position constant hoist) is folded into the bug card as work item (6). **M-1** and **M-2** are covered directly by the bug's own acceptance criteria. **L-2** (JSDoc) and **L-4** (T-027 hand-off note) are small hygiene items that do not need their own claim.

#### Links

- Review artifact: [docs/agent/reviews/cycle-19-aia-core-nwmf-2026-04-18.md](../../docs/agent/reviews/cycle-19-aia-core-nwmf-2026-04-18.md)
- Prior cycle: [Cycle 18 — aia-core-i9s6](#cycle-18--aia-core-i9s6-t-015-theme-slice--settings-panel-scott-review-2026-04-18)

### Cycle 20 — aia-core-4c94 (Chip-slide driver wiring, Scott review, 2026-04-18)

**Source:** [docs/agent/reviews/cycle-20-aia-core-4c94-2026-04-18.md](../../docs/agent/reviews/cycle-20-aia-core-4c94-2026-04-18.md)
**Source task:** BUG-CYCLE19-01 — wire `<ChipSlideDriver>` into `<PokerTable>` so T-011 ACs become observable in-canvas

#### Summary

`aia-core-4c94` is **closed**. `<ChipSlideDriver>` is now mounted inside `<PokerTable>`, and T-011 ACs **1 / 2 / 3 / 4** are all satisfied in-canvas via `<FlyingChipSlug>` rendering plus `depositedBySeat` accounting against seat and pot `<ChipStack>`s. Cycle 19's **M-3** (reduced-motion `onSlideStart` ordering), **L-2** (StrictMode `onController` JSDoc), and **L-3** ("missing prev seat" sequencer test) all folded in on this claim. For the street-transition in-flight edge (Cycle 19 M-2), **Option B** was chosen: cancel in-flight slides on scope change. Scott flagged **0 HIGH**; **2 MEDIUM + 4 LOW findings** roll forward. No Filed Bug Card.

#### Rolled-forward findings (MEDIUM / LOW — not filed to beads)

1. **[MEDIUM] M1 — Option B UX regression: cancel-on-scope-change teleports mid-flight slugs**
   - **Category:** UX / animation polish
   - **Description:** The chosen Option B cancels in-flight slides when the betting scope changes (e.g. turn card arrives mid-call), which visibly teleports any slug ≤400 ms into its tween. Rare in live play, but visible in fast replay and reduced-motion. Option C — let in-flight tweens complete while deferring the bookkeeping clear (tween-to-completion with a post-transition `state.pot` absorbing the delta in parallel) — preserves motion continuity.
   - **Recommended fix:** batch with **T-012** (pot-sweep animation) or **T-023** (replay scrubber polish); different tasks may legitimately pick Option B vs. Option C based on context.

2. **[MEDIUM] M2 — `bumpFrameTick` forces full `<PokerTable>` re-render every frame any slide is active**
   - **File:** [frontend/src/scenes3d/components/PokerTable.tsx](../../frontend/src/scenes3d/components/PokerTable.tsx)
   - **Category:** performance / dead plumbing
   - **Description:** `bumpFrameTick` triggers a full `<PokerTable>` re-render on every animation frame while any slide is active. `FlyingChipSlug.setPos` already re-renders the slug directly; the parent scope only needs to change on slide start and complete. Deleting `bumpFrameTick` + `onFrameTick` reduces per-slide work from ~24 full-scene renders to 2 (start + complete).
   - **Recommended fix:** delete `bumpFrameTick` + `onFrameTick` before **T-012** winner-slug work or **T-019** multiplies the active-slide count — quick-win cleanup.

3. **[LOW] L1 — `<ChipSlideDriver>` sync in `useEffect` causes ≤16 ms flash of full seat stack**
   - **File:** [frontend/src/scenes3d/animations/ChipSlideDriver.tsx](../../frontend/src/scenes3d/animations/ChipSlideDriver.tsx)
   - **Category:** visual correctness
   - **Description:** The driver syncs inside `useEffect`, so there is a one-frame (≤16 ms) window where the seat `<ChipStack>` renders its full pre-bet amount before `inFlightForSeat` reflects the new bet. Tests pass because RTL `rerender` awaits effects; on-canvas there is a visible flash.
   - **Recommended fix:** switch to `useLayoutEffect`, or write a synchronous shadow map before `onSlideStart` fires.

4. **[LOW] L2 — `ChipInstances.__getTestProbe().getStacks()` observable boundary undocumented**
   - **File:** [frontend/src/scenes3d/components/ChipInstances.tsx](../../frontend/src/scenes3d/components/ChipInstances.tsx)
   - **Category:** documentation
   - **Description:** `__getTestProbe().getStacks()` is a legitimate observable boundary — it returns the same `stacksRef.current` that `flush()` writes into. Without a JSDoc note, future readers may treat it as a testing shortcut and refactor it out.
   - **Recommended fix:** add a JSDoc comment on `__getTestProbe` stating the contract explicitly.

5. **[LOW] L3 — No StrictMode pinning test for `<PokerTable>` `controllerRef` + `handleController`**
   - **File:** [frontend/src/scenes3d/components/PokerTable.tsx](../../frontend/src/scenes3d/components/PokerTable.tsx)
   - **Category:** test coverage
   - **Description:** `<PokerTable>`'s `controllerRef` + `handleController` lifecycle is correct but has no StrictMode pinning test analogous to the Cycle 11 `onReady` pin. Regression surface is unpinned.
   - **Recommended fix:** folds into the epic-wide "suite StrictMode pinning" follow-up accumulating since Cycle 11 — not a separate claim.

6. **[LOW] L4 — `inFlightForSeat` iterates controller's `inFlight` Map per seat per render**
   - **File:** [frontend/src/scenes3d/components/PokerTable.tsx](../../frontend/src/scenes3d/components/PokerTable.tsx)
   - **Category:** forward compatibility / performance
   - **Description:** `inFlightForSeat` is O(seats × slides) per render. Trivial at today's slide counts; could matter once **T-012** / **T-019** multiply active slide concurrency. A `getInFlightBySeat()` Map builder on the controller would flatten this to O(slides).
   - **Recommended fix:** defer until load profile justifies.

#### Recommendation

**M2** is the quick-win — delete `bumpFrameTick` + `onFrameTick` before **T-012** winner-slug work multiplies slide concurrency and the wasted renders compound. **M1** warrants a design discussion during **T-012** or **T-023** (replay scrubber); Option B vs. Option C is a context-dependent call and different tasks may legitimately land different choices. **L3** folds into the epic-wide "suite StrictMode pinning" follow-up that has been accumulating since Cycle 11. **L1** and **L2** are small hygiene items. **L4** is deferred until load profile justifies it.

#### Links

- Review artifact: [docs/agent/reviews/cycle-20-aia-core-4c94-2026-04-18.md](../../docs/agent/reviews/cycle-20-aia-core-4c94-2026-04-18.md)
- Prior cycle: [Cycle 19 — aia-core-nwmf](#cycle-19--aia-core-nwmf-t-011-chip-slide-primitives-scott-review-2026-04-18)

### Cycle 21 — aia-core-9tis (T-024 Visibility policy, Scott review, 2026-04-18)

**Source:** [docs/agent/reviews/cycle-21-aia-core-9tis-2026-04-18.md](../../docs/agent/reviews/cycle-21-aia-core-9tis-2026-04-18.md)
**Source task:** T-024 — pure `canSee` visibility policy module

#### Summary

`aia-core-9tis` is **closed**. The pure `canSee` module is implemented byte-for-byte per plan.md, with 40 exhaustive tests covering the full policy matrix. Suite green at **1664/1664**. Scott flagged **0 HIGH**; **2 MEDIUM + 3 LOW findings** roll forward. No Filed Bug Card.

#### Rolled-forward findings (MEDIUM / LOW — not filed to beads)

1. **[MEDIUM] MED-1 — `Policy` re-exported from `../types` rather than declared inline**
   - **Category:** spec fidelity / documentation
   - **Description:** `Policy` is re-exported from `../types` rather than declared inline in the visibility module. This is the right call — an inline declaration would create a duplicate public type — but it is a deliberate deviation from the literal plan.md spec and should be documented so future readers don't treat the spec as a source-of-truth mismatch.
   - **Recommended fix:** update plan.md on next revision to document the re-export pattern (plan.md edit, not a code change).

2. **[MEDIUM] MED-2 — `canSee` is a render-time filter, not a trust boundary**
   - **Category:** security boundaries / documentation
   - **Description:** A caller passing a forged `viewerSeat === cardOwnerSeat` bypasses the policy by design — `canSee` is a render-time filter, not a trust boundary. Real enforcement lives server-side: `CardRef` omission, `equityGuard.ts`, and the `no-equity-in-player` lint rule. Without an inline comment, future engineers risk mistaking this module for a security primitive.
   - **Recommended fix:** add one comment line to `visibilityPolicy.ts` stating the boundary explicitly — fold into the **T-025** touch.

3. **[LOW] LOW-1 — `viewerSeat=null` under player policy is implicit**
   - **Category:** documentation
   - **Description:** Under the player policy, `viewerSeat=null` resolves to `false` implicitly via `viewerSeat === cardOwnerSeat`. Correct, but non-obvious without a truth-table row or inline comment.
   - **Recommended fix:** add an inline comment or a truth-table row in plan.md.

4. **[LOW] LOW-2 — Purity test uses snapshot diff instead of `Object.freeze`**
   - **Category:** test strength
   - **Description:** The purity test compares argument snapshots before/after the call. `Object.freeze(args)` would fail at the mutation site directly, giving a sharper, more localized failure mode.
   - **Recommended fix:** swap snapshot diff for `Object.freeze(args)` the next time the test is touched.

5. **[LOW] LOW-3 — `awaiting_cards == pre-showdown` is implicit in branch logic**
   - **Category:** documentation / forward compatibility
   - **Description:** Treating `awaiting_cards` identically to pre-showdown works only because non-`showdown` phases are handled uniformly. If a future phase lands between `awaiting_cards` and `showdown`, the branch will silently behave the same way.
   - **Recommended fix:** add a one-line comment flagging the assumption so a future phase-add forces the author to reconsider.

#### Recommendation

**MED-1** is a plan.md update, not a code change — bundle into the next plan.md revision. **MED-2** is a 1-line inline comment on `visibilityPolicy.ts` and should fold into the **T-025** touch. **LOW items** are polish. **T-025** (`Card` faceUp) should land the security comment (MED-2) plus the `testid` wiring discussed in Cycle 21.

#### Links

- Review artifact: [docs/agent/reviews/cycle-21-aia-core-9tis-2026-04-18.md](../../docs/agent/reviews/cycle-21-aia-core-9tis-2026-04-18.md)
- Prior cycle: [Cycle 20 — aia-core-4c94](#cycle-20--aia-core-4c94-chip-slide-driver-wiring-scott-review-2026-04-18)

### Cycle 22 — aia-core-n2yu (T-025 Card faceUp wiring, Scott review, 2026-04-18)

**Source:** [docs/agent/reviews/cycle-22-aia-core-n2yu-2026-04-18.md](../../docs/agent/reviews/cycle-22-aia-core-n2yu-2026-04-18.md)
**Source task:** T-025 — `<PokerTable>` wiring of `canSee` visibility policy into `<Card>` faceUp

#### Summary

`aia-core-n2yu` is **closed**. `<PokerTable>` now computes `faceUp` per hole card via `canSee`; when `faceUp=false` it passes `id={null}` so face data never reaches the render tree. Default viewer is **spectator** (fail-safe). `data-testid="card-face-up|card-face-down"` was added to `<Card>`. **MED-2** from Cycle 21 (security-boundary comment on `visibilityPolicy.ts`) folded in. Suite green at **1672/1672**. Scott flagged **0 HIGH**; **3 MEDIUM + 4 LOW findings** roll forward. No Filed Bug Card.

#### Rolled-forward findings (MEDIUM / LOW — not filed to beads)

1. **[MEDIUM] MED-1 — AC 1 wiring test for folded opponent is vacuous**
   - **Category:** test strength
   - **Description:** The T-009 short-circuit skips rendering folded seats, so the for-loop never executes — the AC 1 wiring test passes by not asserting anything. The unit matrix for `canSee` **is** exhaustive for the folded-opponent case; the wiring test just duplicates the guarantee poorly.
   - **Recommended fix:** rewrite the wiring test to assert `holeCardsOfSeat(container, 1).length === 0` explicitly, or convert it to a comment pointing at the unit test.

2. **[MEDIUM] MED-2 — `data-testid` on `<Card>` is a redundant test-only hook**
   - **Category:** API surface / test hygiene
   - **Description:** `data-face-up` already carries the face-up/down state on the DOM node; `data-testid="card-face-up|card-face-down"` duplicates it and adds a test-only attribute to the public component surface.
   - **Recommended fix:** either drop `data-testid` in favour of `data-face-up` scraping, or document it as the T-055 integration hook so future cleanup doesn't remove it. Resolve during T-055 when the real integration shape is known.

3. **[MEDIUM] MED-3 — Wiring tests only exercise 4 of 6 phases**
   - **Category:** test coverage
   - **Description:** The existing wiring tests skip `awaiting_cards` and `river`. The canSee unit matrix covers them, but the wiring layer does not.
   - **Recommended fix:** parameterize the existing wiring tests over `ALL_PHASES` / `PRE_SHOWDOWN_PHASES` (already exported from test helpers). Quick win on the next `<PokerTable>` touch.

4. **[LOW] LOW-1 — `holeId` closure allocated per seat per render**
   - **Category:** performance / style
   - **Description:** In `PokerTable.tsx` ~L338-339, `holeId` is a closure allocated per seat per render. It is trivially inlineable.
   - **Recommended fix:** inline the expression at the call site.

5. **[LOW] LOW-2 — `typeof viewer.seat === 'number'` guard is defensive redundancy**
   - **Category:** documentation
   - **Description:** In `PokerTable.tsx` ~L330-333, the `typeof viewer.seat === 'number'` guard is redundant — `canSee` tolerates `null`. Correct to keep defensively, but a future refactor could simplify it away and subtly change semantics.
   - **Recommended fix:** add an inline comment explaining why the guard is kept so it isn't simplified away.

6. **[LOW] LOW-3 — `viewer` prop not propagated to sibling components**
   - **Category:** documentation
   - **Description:** `viewer` is not forwarded to `<Nameplates>`, `<DealAnimationDriver>`, or `<ChipSlideDriver>`. This is correct by design — those components render only public information — but the omission is non-obvious.
   - **Recommended fix:** add a JSDoc note on `<PokerTable>` explaining why `viewer` stays local to hole-card rendering.

7. **[LOW] LOW-4 — `viewerPolicy` computed twice per render**
   - **Category:** performance / style
   - **Description:** `viewerPolicy` is derived twice in `PokerTable.tsx` (~L293 and ~L329).
   - **Recommended fix:** hoist to a single `const` near the top of the component body.

#### Recommendation

**MED-2** is a documentation decision (keep-and-document vs. remove) — resolve during **T-055** work when the real integration shape is known. **MED-3** is a quick parameterize task on the next `<PokerTable>` touch. **MED-1** is a 2-line test improvement. **LOW items** batch into any `<PokerTable>` refactor.

#### Links

- Review artifact: [docs/agent/reviews/cycle-22-aia-core-n2yu-2026-04-18.md](../../docs/agent/reviews/cycle-22-aia-core-n2yu-2026-04-18.md)
- Prior cycle: [Cycle 21 — aia-core-9tis](#cycle-21--aia-core-9tis-t-024-visibility-policy-scott-review-2026-04-18)

### Cycle 23 — aia-core-wnd2 (T-023 Scrubber, Scott review, 2026-04-18)

**Source:** [docs/agent/reviews/cycle-23-aia-core-wnd2-2026-04-18.md](../../docs/agent/reviews/cycle-23-aia-core-wnd2-2026-04-18.md)
**Source task:** T-023 — `<HandScrubberPanel>` + `replay` store slice

#### Summary

`aia-core-wnd2` is **closed**. `<HandScrubberPanel>` and the `replay` store slice landed (session-only, not persisted). Play/pause auto-advance at 1x/2x/4x speeds. Component is dual-mode: live local-state or replay-store-bound via `bindToReplay`. Currently an **orphan** — no consumers yet; downstream wiring is T-030 / T-031 / T-032 / T-023b. Suite green at **1704/1704**. Scott flagged **0 HIGH**; **4 MEDIUM + 5 LOW findings** roll forward. No Filed Bug Card.

#### Rolled-forward findings (MEDIUM / LOW — not filed to beads)

1. **[MEDIUM] MED-1 — 4x speed (375ms/street) undercuts `CHIP_SLIDE_DURATION_MS` (400ms)**
   - **Category:** animation correctness
   - **Description:** At 4x playback the per-street interval (375ms) is shorter than the chip-slide animation duration (400ms), causing animation tearing. Same decision point as **Cycle 20 M1** — Option B (cancel-in-flight) vs Option C (defer advance until driver idle).
   - **Recommended fix:** **HARD PRE-IMPLEMENTATION GATE for T-031** — must be resolved before the playback view mounts the scrubber. Fold into T-031 design-prep.

2. **[MEDIUM] MED-2 — Live-mode instances re-render on all replay-slice writes**
   - **Category:** performance
   - **Description:** Live-mode panel instances subscribe to all 4 replay selectors unconditionally, so they re-render on every replay-slice write even when `bindToReplay=false`. Cosmetic/perf only.
   - **Recommended fix:** use `useSyncExternalStore` with a conditional subscription, or gate selector subscriptions behind `bindToReplay`. Fix when **T-030** mounts the dealer embed.

3. **[MEDIUM] MED-3 — Clamp-down effect has stale-callback risk; no StrictMode test**
   - **Category:** correctness / test coverage
   - **Description:** Same shape as **aia-core-jbyh** `onReady` double-fire — `onStreetIndexChange` is captured by stale closure. No StrictMode coverage for the clamp-down effect.
   - **Recommended fix:** mirror the `streetRef` / `maxRef` ref pattern for `onStreetIndexChange`. Fold StrictMode coverage into the epic-wide StrictMode-test follow-up accumulating since **Cycle 11**.

4. **[MEDIUM] MED-4 — `partialize` persist envelope has no structural regression guard**
   - **Category:** test coverage / persistence safety
   - **Description:** The persist allow-list is correct today, but no test pins that future slices (e.g., `qualityTier` from T-027) or other session-only state stay excluded from persistence.
   - **Recommended fix:** add a whitelist-shape test during **T-027** that asserts the `partialize` output structure.

5. **[LOW] LOW-1 — `setInterval` drift + tab-background throttling**
   - **Category:** UX polish
   - **Description:** `setInterval` drifts over long playbacks, and browsers throttle background tabs, causing catch-up jank when the tab refocuses.
   - **Recommended fix:** revisit if **T-031** user testing surfaces it (e.g., switch to `requestAnimationFrame` + elapsed-time accounting).

6. **[LOW] LOW-2 — `msPerStreet` prop is public and unvalidated**
   - **Category:** API surface / safety
   - **Description:** `msPerStreet` is exposed on the public component props with no validation — a consumer passing a small value could undercut driver animation durations.
   - **Recommended fix:** either clamp + dev-warn on out-of-range values, or drop the prop entirely and derive `msPerStreet` from the internal speed table.

7. **[LOW] LOW-3 — `setStreet` useCallback depends on `maxStreet`; interval tears down on `outcomeStreet` change**
   - **Category:** correctness / perf
   - **Description:** `setStreet` `useCallback` lists `maxStreet` in deps, so the auto-advance interval tears down and rebuilds whenever `outcomeStreet` changes. Same shape as **MED-3**.
   - **Recommended fix:** mirror the `maxRef` pattern so `setStreet` has a stable identity.

8. **[LOW] LOW-4 — Missing `phaseFromStreetIndex` inverse helper**
   - **Category:** code duplication / ergonomics
   - **Description:** There is no inverse of `streetIndexFromPhase`. T-023b / T-030 / T-031 will each reinvent it.
   - **Recommended fix:** add 4 lines + 1 roundtrip test. Trivial; land **before the first consumer (T-030)**.

9. **[LOW] LOW-5 — `STREET_LABELS` / `STREET_SLUGS` drift risk**
   - **Category:** maintainability
   - **Description:** Two parallel constant arrays (`STREET_LABELS` and `STREET_SLUGS`) can drift out of sync on future edits.
   - **Recommended fix:** derive slug from label (lowercase + slugify), or collapse to a single-source tuple array and derive both views from it.

#### Recommendation

**MED-1** is a **hard prerequisite for T-031** (playback view migration) — no playback consumer can mount the scrubber until the 4x-vs-chip-slide conflict is resolved. **MED-2** and **MED-3** fold naturally into **T-030 / T-031** work when real consumers land. **MED-4** and **LOW-2** resolve during the **T-027** quality tier slice. **LOW-4** is trivial and should land before the first consumer (T-030) to prevent reinvention.

#### Links

- Review artifact: [docs/agent/reviews/cycle-23-aia-core-wnd2-2026-04-18.md](../../docs/agent/reviews/cycle-23-aia-core-wnd2-2026-04-18.md)
- Prior cycle: [Cycle 22 — aia-core-n2yu](#cycle-22--aia-core-n2yu-t-025-card-faceup-wiring-scott-review-2026-04-18)

### Cycle 24 — aia-core-yyn0 (T-022 Seat-POV camera, Scott review, 2026-04-18)

**Source:** [docs/agent/reviews/cycle-24-aia-core-yyn0-2026-04-18.md](../../docs/agent/reviews/cycle-24-aia-core-yyn0-2026-04-18.md)
**Source task:** T-022 — Seat-POV camera preset

#### Summary

`aia-core-yyn0` is **closed**. Most seat-POV primitives pre-landed in **Cycle 14** follow-ups; this cycle closed the remaining gap by forcing `PLAYER_CAMERA_CONFIG` pitch / zoom / pan in `<CameraRig>` when `yawCenter != null`. **AC 1** (seat yaw) and **AC 2** (pan + pitch + zoom clamp) are satisfied. **AC 3** (double-tap reset) and **AC 4** (hide toolbar + lock controls) are deferred to **T-026** player-mode composition — same deferral shape as T-015 AC 4 → T-030/T-031. **Cycle 14 L-1** (silent seat fallback on unknown kinds) is **resolved** — `<PokerTable>.resolveCameraPreset` now dev-warns. Suite green at **1727/1727**. Scott flagged **0 HIGH**; **0 MEDIUM + 3 LOW findings** roll forward. No Filed Bug Card.

#### Rolled-forward findings (LOW — not filed to beads)

1. **[LOW] LOW-1 — Cycle 14 L-1 dev-warn has no regression test**
   - **Category:** test coverage
   - **Description:** The unknown-preset dev-warn is wired in `<PokerTable>.resolveCameraPreset` but no test pins the behavior. Easy to silently regress.
   - **Recommended fix:** one-test follow-up — spy `console.warn`, mount `<PokerTable>` with a fabricated unknown preset kind, assert the warn fires. ~5 lines.

2. **[LOW] LOW-2 — `yawCenter != null` over-applies `PLAYER_CAMERA_CONFIG` to spectator seat POV**
   - **Category:** spec compliance / scope
   - **Description:** The current gate unconditionally applies `PLAYER_CAMERA_CONFIG` pitch / zoom / pan whenever `yawCenter != null`, including for spectator viewers. Per spec, **S-4.2 AC 2** (yaw + pan + pitch) is defined for all seat POV, but **S-5.2** zoom clamp is defined specifically for player mode — so current code slightly over-applies zoom to spectator seat POV.
   - **Recommended fix:** either keep as-is and confirm with product at **T-026**, or gate the zoom override on `viewer?.policy === 'player'`.

3. **[LOW] LOW-3 — New T-022 tests assert drei `<OrbitControls>` mocked boundary props**
   - **Category:** test harness
   - **Description:** All 3 new T-022 tests assert props on a mocked `<OrbitControls>` rather than exercising real drei behavior. Matches existing `scenes3d` convention — no T-022-specific fix warranted.
   - **Recommended fix:** defer to the **epic-level driver-robustness / real-drei harness** follow-up accumulating since **Cycle 11**.

#### Recommendation

**LOW-1** is a ~5-line regression test and should land opportunistically. **LOW-2** is a spec-scope question — confirm with product during **T-026** player-mode composition (gate zoom override on `viewer?.policy === 'player'` if product wants strict spec compliance). **LOW-3** is the standing epic-level drei-harness gap and stays on the epic backlog.

#### Links

- Review artifact: [docs/agent/reviews/cycle-24-aia-core-yyn0-2026-04-18.md](../../docs/agent/reviews/cycle-24-aia-core-yyn0-2026-04-18.md)
- Prior cycle: [Cycle 23 — aia-core-wnd2](#cycle-23--aia-core-wnd2-t-023-scrubber-scott-review-2026-04-18)

### Cycle 25 — aia-core-3wsi (T-020 EquityBadge, Scott review, 2026-04-18)

**Source:** [docs/agent/reviews/cycle-25-aia-core-3wsi-2026-04-18.md](../../docs/agent/reviews/cycle-25-aia-core-3wsi-2026-04-18.md)
**Source task:** T-020 — `<EquityBadge>` + overlay gating

#### Summary

`aia-core-3wsi` is **closed**. `<EquityBadge>` + `<EquityBadges>` landed with the triple-layer gate: prop default `false`, `resolveEquityOverlay` policy check with DEV `console.warn` on attempted-by-non-spectator, and the ESLint rule (layer 3) explicitly deferred to **T-032** per spec (plan.md L502, tasks.md L405, L700). Data path is a `useEquityQuery` react-query wrapper keyed on `streetIndex` with `retry: false` for silent-hide on error, reusing the existing backend endpoint via `fetchEquity`. 26 new tests, suite green at **1753/1753**. Unblocks **T-026** (player-mode composition) and **T-030** (dealer embed migration). Scott flagged **0 CRIT, 0 HIGH, 2 MED, 3 LOW**. No Filed Bug Card.

#### Rolled-forward findings (MED + LOW — not filed to beads)

1. **[MED] MED-1 — Hole-card `<2` short-circuit is render-only; fetch is not gated on it**
   - **Category:** performance / spec interpretation
   - **Description:** The `enoughHoleCards` check short-circuits rendering, but the react-query `enabled` flag is gated on overlay + policy only. Spectator + overlay=true triggers one GET pre-deal before any hole cards exist. Spec-compliant (AC 3 is render-side) but inefficient.
   - **Recommended fix:** fold `enoughHoleCards` into the query `enabled` predicate in `useEquityQuery`.

2. **[MED] MED-2 — Triple-layer defense has a build-time hole until T-032 lands**
   - **Category:** defense-in-depth / scope boundary
   - **Description:** `<PokerTable>` unconditionally imports `<EquityBadges>`, which means `fetchEquity` is statically reachable from any future bundle that pulls in `scenes3d/`. Runtime layers 1 (prop default) and 2 (`resolveEquityOverlay` policy check) fully block leakage and are verified by tests. Layer 3 (ESLint rule forbidding `fetchEquity` import from player-route modules) is explicitly deferred to **T-032** per spec. Currently no player route imports `scenes3d/`, so there is no active leak.
   - **Recommended fix:** add an explicit AC to **T-032** that the ESLint rule lands **before** `<PokerTable>` is wired into the player route.

3. **[LOW] LOW-1 — `userData.testid` on R3F `<group>` is inert**
   - **Category:** dead code
   - **Description:** `userData.testid` is not a DOM attribute and never reaches the test renderer; existing tests match on `name=` + mocked drei `<Text>`.
   - **Recommended fix:** drop the `userData.testid` assignment.

4. **[LOW] LOW-2 — Dumb leaf + smart wrapper co-located in `EquityBadge.tsx`**
   - **Category:** convention
   - **Description:** Elsewhere the convention is to split dumb/smart (`Nameplate.tsx` / `Nameplates.tsx`). Non-blocking.
   - **Recommended fix:** optional split into `EquityBadge.tsx` (leaf) + `EquityBadges.tsx` (smart wrapper) on next touch.

5. **[LOW] LOW-3 — `fetchEquity` URL is hand-scoped but queryKey is street-scoped**
   - **Category:** documentation / invariant
   - **Description:** The correctness contract relies on the backend re-computing equity per community-card state for a given hand. The coupling is implicit.
   - **Recommended fix:** add a one-line invariant comment in `useEquityQuery.ts` explaining that the `streetIndex` key relies on backend re-computation per community state.

#### Recommendation

**MED-1** is a local tweak to the `enabled` predicate and should land opportunistically before **T-026** wires the overlay into player-mode. **MED-2** is the critical cross-task item — its recommendation (ESLint rule lands before player-route wiring) should be propagated into **T-032**'s AC list when that task is refined. **LOW-1** through **LOW-3** are small cleanups to fold into the next touch on `scenes3d/equity/`.

#### Links

- Review artifact: [docs/agent/reviews/cycle-25-aia-core-3wsi-2026-04-18.md](../../docs/agent/reviews/cycle-25-aia-core-3wsi-2026-04-18.md)
- Prior cycle: [Cycle 24 — aia-core-yyn0](#cycle-24--aia-core-yyn0-t-022-seat-pov-camera-scott-review-2026-04-18)


### Cycle 27 — aia-core-olix (T-026 Player-mode composition, Scott review, 2026-04-20)

**Source:** [docs/agent/reviews/cycle-27-aia-core-olix-2026-04-20.md](../../docs/agent/reviews/cycle-27-aia-core-olix-2026-04-20.md)
**Source task:** T-026 — Player-mode composition (no equity + camera lock)

#### Summary

`aia-core-olix` is **closed**. `<PokerTable>` now composes the player-mode lock: under `viewer.policy === 'player'`, `resolveEquityOverlay` gates the equity overlay off (DEV-warn if attempted), `resolveCameraPreset` forces the seat-POV preset from `viewer.seat` (overriding caller-supplied `preset` with a DEV warn), and the scrubber/camera toolbar surface is suppressed. Spectator default preserved (fail-safe). Scott flagged **0 CRITICAL, 0 HIGH, 1 MEDIUM, 4 LOW**. **AC 1, AC 2, AC 4 PASS; AC 3 PARTIAL** — nameplates + dealer/SB/BB markers verified under player mode, but action highlights (fold dim / bet glow / turn pulse, S-3.3) have no production surface yet and were not asserted. No Filed Bug Card.

#### Rolled-forward findings (MEDIUM / LOW — not filed to beads)

1. **[MEDIUM] M-1 — AC-3 "action highlights" dimension unverified**
   - **Location:** `frontend/test/scenes3d/PokerTable.playerMode.test.tsx:259-281`
   - **Category:** test coverage / spec fidelity
   - **Description:** AC 3 wording is "Nameplates / action highlights / blind markers render for all seats" but the test only covers nameplates + `<TableMarkers>` (dealer/SB/BB). Action highlights (fold dim / bet glow / turn pulse, S-3.3) have no production surface yet — T-018 (`aia-core-lpto`) is still open — so closing T-026 against this AC silently defers the highlights-survive-player-mode check.
   - **Recommended fix:** carry-forward — add a `viewer.policy === 'player'` regression to **T-018** when it lands (discovered-from note on `aia-core-lpto`).

2. **[LOW] L-1 — `resolveCameraPreset` accepts out-of-range `viewer.seat` silently**
   - **Location:** `frontend/src/scenes3d/PokerTable.tsx:116-141`
   - **Category:** input validation / dev signal
   - **Description:** `typeof viewer.seat === 'number'` admits negatives and values `>= seatCount`; downstream computes nonsense pose via modular geometry with no dev signal.
   - **Recommended fix:** add a bounds check and DEV-warn fallback to `'default'`.

3. **[LOW] L-2 — `onPresetChange` silently suppressed under player policy**
   - **Location:** `frontend/src/scenes3d/PokerTable.tsx:176-183`
   - **Category:** API contract / documentation
   - **Description:** Caller-supplied preset is overridden with a DEV warn, but `onPresetChange` is never fired to notify an external state store that its preset is being ignored.
   - **Recommended fix:** document in `PokerTableProps` JSDoc that `onPresetChange` is a no-op under player policy, or emit a matching DEV warn when both are set.

4. **[LOW] L-3 — AC-4 lockout proved only in toolbar isolation**
   - **Location:** `frontend/test/scenes3d/PokerTable.playerMode.test.tsx:315-324`
   - **Category:** integration coverage
   - **Description:** No test asserts any consumer route actually threads `viewer` through to `<PokerTable>` — the lockout is proved in component isolation only.
   - **Recommended fix:** carry-forward — discovered-from against **T-032**; add integration assertion at `pages/TableView.tsx` test when the player-POV route migration lands.

5. **[LOW] L-4 — Global `console.warn` mock swallows dev-signal assertions**
   - **Location:** `frontend/test/scenes3d/PokerTable.playerMode.test.tsx:89-101`
   - **Category:** test strength
   - **Description:** `vi.spyOn(console, 'warn').mockImplementation(() => {})` silences all warnings, so load-bearing DEV warnings in `resolveCameraPreset` and `equityGuard` are never asserted.
   - **Recommended fix:** add `expect(consoleWarnSpy).toHaveBeenCalledWith(...)` assertions mirroring the equity-guard test pattern.

#### Recommendation

**M-1** is a carry-forward to **T-018** (`aia-core-lpto`) — the action-highlights production surface must arrive with a `viewer.policy === 'player'` regression test; attach as a discovered-from note when T-018 is claimed. **L-3** is a carry-forward to **T-032** player-POV route migration — add the integration assertion at `pages/TableView.tsx` there. **L-1**, **L-2**, **L-4** are small, local polish items to fold into the next touch on `scenes3d/PokerTable.tsx` or `PokerTable.playerMode.test.tsx`. Nothing filed to beads this cycle (no CRITICAL/HIGH).

#### Links

- Review artifact: [docs/agent/reviews/cycle-27-aia-core-olix-2026-04-20.md](../../docs/agent/reviews/cycle-27-aia-core-olix-2026-04-20.md)
- Prior cycle: [Cycle 25 — aia-core-3wsi](#cycle-25--aia-core-3wsi-t-020-equitybadge-scott-review-2026-04-18)
- Carry-forward targets: **T-018** (`aia-core-lpto`) for M-1; **T-032** for L-3


### Cycle 28 — aia-core-36z4 (T-032 Migrate pages/TableView.tsx player POV route + ESLint rule, Scott review, 2026-04-20)

**Source:** [docs/agent/reviews/cycle-28-aia-core-36z4-2026-04-20.md](../../docs/agent/reviews/cycle-28-aia-core-36z4-2026-04-20.md)
**Source task:** T-032 — Migrate `pages/TableView.tsx` (player POV route) + ESLint rule `no-equity-in-player`

#### Summary

`aia-core-36z4` is **closed**. `pages/TableView.tsx` is migrated to the player-POV composition: under `?player=<name>`, the route constructs `viewer = { policy: 'player', seat }` and threads it through `<PokerTable>` so the Cycle-27 lockout (no equity overlay, forced seat-POV camera, suppressed scrubber/toolbar) applies at the route boundary; spectator (no `?player`) remains the default. A new `frontend/eslint-rules/no-equity-in-player.js` rule forbids equity imports / `fetchEquity` usage under `src/player/**`. Scott flagged **0 CRITICAL, 0 HIGH, 3 MEDIUM, 5 LOW**. **AC 1, AC 2, AC 3, AC 5 PASS; AC 4 PARTIAL** — prop-threading and mock-spy assertions land, but the literal `queryAllByTestId('card-face-up')` DOM check and MSW-captured `/equity` network log deferred. No Filed Bug Card.

#### Rolled-forward findings (MEDIUM / LOW — not filed to beads)

1. **[MEDIUM] M-1 — ESLint rule bypassed by `ImportNamespaceSpecifier`**
   - **Location:** `frontend/eslint-rules/no-equity-in-player.js:47-62`
   - **Category:** lint rule completeness
   - **Description:** The rule handles `ImportSpecifier` and `ImportDefaultSpecifier` but not `ImportNamespaceSpecifier`. `import * as client from '../api/client'; client.fetchEquity()` passes lint clean under `src/player/**`.
   - **Recommended fix:** add a namespace-specifier branch implementing a two-pass rule — flag namespace imports of forbidden source modules plus `MemberExpression` access to forbidden names — with a matching `RuleTester` case. Carry-forward: track against **T-033** or file standalone if priority warrants.

2. **[MEDIUM] M-2 — AC-4 DOM assertion weakened to prop-threading**
   - **Location:** `frontend/test/pages/TableView.test.tsx` (`consumer lockout integration (AC-4)`)
   - **Category:** test fidelity / acceptance-criterion drift
   - **Description:** The rewrite spy-mocks `<PokerTable>` to a bare `<div>` and asserts prop threading instead of the literal `queryAllByTestId('card-face-up').filter(...)` DOM check called out in AC-4. The Cycle-27 L-3 carry-forward intent ("prove the route actually threads `viewer` through") is satisfied, but regressions inside `<PokerTable>` that still accept a valid viewer won't be caught at the route boundary.
   - **Recommended fix:** add one un-mocked render with a minimal stub emitting `data-testid="card-face-up"` driven by `canSee()`, OR update AC-4 wording in this file to reflect explicit delegation to **T-025**/**T-026** coverage.

3. **[MEDIUM] M-3 — AC-4(b) `/equity` check is tautological**
   - **Location:** `frontend/test/pages/TableView.test.tsx` (`fires zero /equity fetches`)
   - **Category:** test strength / spec fidelity
   - **Description:** AC-4(b) names "MSW-captured network log … zero `/equity` calls". The implementation uses `vi.mock('../../src/api/client.ts')` and asserts the mocked `fetchEquity` spy was never called — tautological, since `fetchEquity` is never imported in the player-POV code path.
   - **Recommended fix:** add a global `fetch` / `XMLHttpRequest` spy asserting no URL contains `/equity` across the five-phase loop; keep the `fetchEquity` mock as defense in depth.

4. **[LOW] L-1 — `react-hooks/set-state-in-effect` disable is correctly scoped**
   - **Location:** `frontend/src/pages/TableView.tsx:63-78`
   - **Category:** code review observation
   - **Description:** Textbook external-source-sync exemption guarding `useHandPolling`'s intentional first-load gap. Not masking a bug.
   - **Recommended fix:** none required; an `onFirstLoad` callback on the hook would be cleaner but is out of scope.

5. **[LOW] L-2 — AC-2 missing `isShowdown` regex check**
   - **Location:** `frontend/test/pages/TableView.test.tsx` (`does not import createPokerScene`)
   - **Category:** test coverage / AC fidelity
   - **Description:** AC-2 wording names `isShowdown` explicitly, but the source regex only checks `createPokerScene`, `handToPlayerCardData`, and `from '../scenes/showdown`.
   - **Recommended fix:** add `expect(src).not.toMatch(/\bisShowdown\b/)`.

6. **[LOW] L-3 — ESLint rule tests missing namespace case**
   - **Location:** `frontend/eslint-rules/no-equity-in-player.test.js`
   - **Category:** test coverage (pairs with M-1)
   - **Description:** No `ImportNamespaceSpecifier` case in the `valid` or `invalid` arrays — the M-1 gap is untested.
   - **Recommended fix:** add a currently-`valid` namespace case to document the gap; flip to `invalid` when M-1 lands.

7. **[LOW] L-4 — AC-1 `SessionReplayShell` absence is implicit**
   - **Location:** `frontend/test/pages/TableView.test.tsx`
   - **Category:** test coverage / AC fidelity
   - **Description:** AC-1 says "No `<SessionReplayShell>`" but there is no explicit assertion to that effect.
   - **Recommended fix:** add `expect(src).not.toMatch(/SessionReplayShell/)` inside the AC-5 block.

8. **[LOW] L-5 — Unknown-player query param silently falls back**
   - **Location:** `frontend/src/pages/TableView.tsx:82-91`
   - **Category:** input validation / dev signal (links Cycle-27 L-1)
   - **Description:** When `?player=Unknown` (no matching seat), `viewer` becomes `{ policy: 'player' }` with no `seat` and `cameraPreset` falls back to `'default'` — hits the Cycle-27 **L-1** silent-accept path in `resolveCameraPreset`. No test covers this shape.
   - **Recommended fix:** add a `?game=5&player=Unknown` test asserting the fallback viewer shape and no crash; resolution pairs with Cycle-27 L-1.

#### Recommendation

**M-1** is the most consequential — the ESLint rule is the structural guardrail behind the player-POV lockout, and the namespace-import bypass defeats it. Carry-forward to **T-033** with **L-3** pairing its test; file standalone if T-033 priority is not imminent. **M-2** and **M-3** are AC-4 fidelity gaps — either tighten the tests (preferred: un-mocked DOM stub for M-2, global fetch spy for M-3) or amend AC-4 wording to reflect the delegation to **T-025**/**T-026**. **L-2**, **L-4** are one-line regex additions to fold into the next touch on `TableView.test.tsx`. **L-5** is a small route-boundary validation pairing with Cycle-27 **L-1** — resolve both together on the next touch of `resolveCameraPreset`. **L-1** needs no action. Nothing filed to beads this cycle (no CRITICAL/HIGH).

#### Links

- Review artifact: [docs/agent/reviews/cycle-28-aia-core-36z4-2026-04-20.md](../../docs/agent/reviews/cycle-28-aia-core-36z4-2026-04-20.md)
- Prior cycle: [Cycle 27 — aia-core-olix](#cycle-27--aia-core-olix-t-026-player-mode-composition-scott-review-2026-04-20)
- Carry-forward targets: **T-033** for M-1 + L-3; **T-025**/**T-026** regression tightening for M-2; local follow-ups for M-3, L-2, L-4, L-5 (paired with Cycle-27 **L-1**)


### Cycle 29 — aia-core-lpto (T-018 Action highlights: fold dim / bet glow / turn pulse, Scott review, 2026-04-20)

**Source:** [docs/agent/reviews/cycle-29-aia-core-lpto-2026-04-20.md](../../docs/agent/reviews/cycle-29-aia-core-lpto-2026-04-20.md)
**Source task:** T-018 — Action highlights (fold dim / bet glow / turn pulse, S-3.3)

#### Summary

`aia-core-lpto` implements S-3.3 action highlights via `<SeatHighlight>` (composing `<FoldedSeatDim>`, `<BetGlowOverlay>`, `<TurnPulseRing>`) threaded through `<PokerTable>` per seat, with reduced-motion fallbacks (static ring / instant glow mount). Scott flagged **0 CRITICAL, 2 HIGH, 2 MEDIUM, 3 LOW**. **AC-1 PARTIAL** — pad + nameplate are dimmed on fold, but chip stack is NOT dimmed (H-1) and hole cards are hidden rather than dimmed (M-2); **AC-2 SATISFIED with caveat** — bet glow mounts/opacity-ramps per `committedThisStreet > 0` but the glow plane does not billboard to camera (H-2), rendering edge-on and effectively invisible on most seats of a 6-seat ellipse; **AC-3, AC-4 SATISFIED** — turn pulse + reduced-motion branches verified. Cycle-27 **M-1** carry-forward ("`viewer.policy === 'player'` regression on action highlights") is **GENUINELY CLOSED** by the new player-mode coverage in `PokerTable.playerMode.test.tsx`. **Filed Bug Cards:** H-1, H-2 (filed to beads as P1 by Logan next step).

#### Filed Bug Cards (HIGH — filed to beads as P1 next step by Logan)

1. **[HIGH] H-1 — Folded seat's chip stack is NOT dimmed** *(beads: `aia-core-6o9t.1`)*
   - **Location:** `frontend/src/scenes3d/PokerTable.tsx:470-497`
   - **Category:** spec fidelity / AC-1 violation
   - **Description:** S-3.3 AC-1 explicitly names "chip stack" in the dim set, but the current implementation only dims the seat pad + nameplate. `<ChipStack amount={display}>` renders at full brightness for any folded seat with `committedThisStreet > 0` — e.g. a bet-then-fold on the same street leaves a bright committed stack under a dimmed pad/nameplate, contradicting AC-1. Makes AC-1 **PARTIAL**.
   - **Recommended fix:** thread a `folded` prop into `<ChipStack>` / `<ChipInstances>` and drive a shared fold opacity (same factor as pad/nameplate); add a scene-level assertion that committed-chip material opacity ≈ fold opacity when `folded === true`.

2. **[HIGH] H-2 — `<BetGlowOverlay>` plane does not billboard to camera** *(beads: `aia-core-6o9t.2`)*
   - **Location:** `frontend/src/scenes3d/components/SeatHighlight.tsx:238-253`
   - **Category:** rendering correctness / AC-2 caveat
   - **Description:** The sibling `<Nameplate>` billboards to the camera, but the `<BetGlowOverlay>` plane stays world-+Z-facing. On a 6-seat ellipse, most seats render the glow edge-on — i.e. invisible — so AC-2 passes in test (opacity ramp + mount lifecycle) but fails visually in scene. happy-dom tests cannot catch this because orientation-to-camera is a three.js matrix concern outside the DOM surface.
   - **Recommended fix:** mount `<BetGlowOverlay>` as a child of the billboarded `<Nameplate>` group OR share billboard rotation via a shared ref / `useFrame` lookAt; add a frame-advanced rotation-tracks-camera test (see M-1).

#### Rolled-forward findings (MEDIUM / LOW — not filed to beads)

1. **[MEDIUM] M-1 — Test probe gaps for H-1 and H-2**
   - **Location:** `frontend/test/scenes3d/SeatHighlight.test.tsx`, `frontend/test/scenes3d/PokerTable.seatHighlights.test.tsx`
   - **Category:** test coverage (same shape as Cycle-27 M-1)
   - **Description:** No test exercises bet-glow orientation or chip-stack fold-dim. Without these probes H-1 and H-2 silently pass CI even after a fix regresses, mirroring Cycle 27's M-1 carry-forward shape.
   - **Recommended fix:** (a) add a frame-advanced glow-rotation-tracks-camera test asserting the glow plane's world rotation matches the camera-facing plane after `useFrame` tick; (b) add a folded-seat-with-committed-chips test asserting the committed `<ChipStack>`'s material opacity is `< 1` when `folded === true`. Pair these with the H-1 / H-2 fixes.

2. **[MEDIUM] M-2 — Folded hole cards hidden rather than dimmed**
   - **Location:** `frontend/src/scenes3d/PokerTable.tsx:377`
   - **Category:** spec interpretation
   - **Description:** `renderHole = seat.isActive && !seat.folded` hides the hole cards on fold; the AC-1 spec text says "dimmed". Defensible as a UX choice (folded hands are out of play), but drifts from the literal spec wording. Routes to Jean for AC-1 disambiguation.
   - **Recommended fix:** Jean decides — either (a) amend AC-1 wording to permit hide-on-fold, or (b) render a dimmed face-down placeholder matching the pad/nameplate fold opacity.

3. **[LOW] L-1 — Dead `seatIndex` dependency on `<TurnPulseRing>` effect**
   - **Location:** `frontend/src/scenes3d/components/SeatHighlight.tsx:165-170`
   - **Category:** dead code
   - **Description:** `<TurnPulseRing>` is key-mounted by the composer, so the inner `useEffect` with `seatIndex` in its deps array is dead code for that branch — the ring remounts on seatIndex change before the effect can observe the prior value.
   - **Recommended fix:** drop `seatIndex` from the deps array, or delete the effect if no remaining branch depends on it.

4. **[LOW] L-2 — Carry-forward test block has mid-file imports**
   - **Location:** `frontend/test/scenes3d/PokerTable.playerMode.test.tsx:455`
   - **Category:** style drift
   - **Description:** ESM hoists imports so the code works, but mid-file imports drift from the repo convention of a top-of-file import block.
   - **Recommended fix:** hoist the mid-file imports to the top-of-file import block on next touch.

5. **[LOW] L-3 — Bet-glow mount/unmount is itself a motion signal under reduced-motion**
   - **Location:** `frontend/src/scenes3d/components/SeatHighlight.tsx:304-322`
   - **Category:** spec interpretation / AC-4 strictness
   - **Description:** Under `prefers-reduced-motion`, the glow opacity ramp is skipped (instant mount) but the mount/unmount transition is itself a visual change. A strict reading of AC-4 argues reduced-motion should either persist the glow across street changes or suppress its appearance altogether. Current code passes AC-4 as written, but the interpretation is loose.
   - **Recommended fix:** flag to Jean for AC-4 disambiguation; no code change without spec clarification.

#### Recommendation

**H-1** and **H-2** are Filed Bug Cards — Logan files as P1 beads bugs in the next step, and Hank closes them alongside T-018 reopen or as immediate follow-ups. **M-1** must pair with the H-1/H-2 fixes (same carry-forward shape as Cycle 27 M-1 — without the test probes, CI cannot catch regression). **M-2** and **L-3** route to Jean for AC wording disambiguation (AC-1 hide-vs-dim, AC-4 reduced-motion mount semantics). **L-1** is a local dead-code cleanup; **L-2** is a one-block hoist to fold into the next touch on `PokerTable.playerMode.test.tsx`. Cycle-27 **M-1** carry-forward is **genuinely closed** by this cycle's player-mode regression coverage.

#### Links

- Review artifact: [docs/agent/reviews/cycle-29-aia-core-lpto-2026-04-20.md](../../docs/agent/reviews/cycle-29-aia-core-lpto-2026-04-20.md)
- Prior cycle: [Cycle 28 — aia-core-36z4](#cycle-28--aia-core-36z4-t-032-migrate-pagestableviewtsx-player-pov-route--eslint-rule-scott-review-2026-04-20)
- Filed to beads: **H-1** (`aia-core-6o9t.1`), **H-2** (`aia-core-6o9t.2`) — filed this cycle as P1 bugs by Logan
- Carry-forward targets: **M-1** pairs with H-1/H-2 fixes; **M-2** + **L-3** route to Jean for AC disambiguation; **L-1**, **L-2** are local cleanups
- Closed carry-forward: Cycle-27 **M-1** (action-highlights `viewer.policy === 'player'` regression) — GENUINELY CLOSED

### Cycle 30 — aia-core-6o9t.1 (H-1 Dim folded seat's chip stack, Scott review, 2026-04-20)

**Source:** [docs/agent/reviews/cycle-30-aia-core-6o9t.1-2026-04-20.md](../../docs/agent/reviews/cycle-30-aia-core-6o9t.1-2026-04-20.md)
**Source task:** aia-core-6o9t.1 — H-1 Dim folded seat's chip stack (Cycle 29 carry-forward)

#### Summary

`aia-core-6o9t.1` closes the Cycle 29 **H-1** carry-forward by threading a `folded` signal from `<PokerTable>` through `<ChipStack>` into `<ChipInstances>`, where a dual-material-pool split (opaque + dim) routes folded seats' committed chips to a shared `MeshStandardMaterial` with the fold opacity. Scott flagged **0 CRITICAL, 0 HIGH, 3 MEDIUM, 3 LOW**. **AC-1 upgraded from PARTIAL → SATISFIED** — pad, nameplate, and chip stack now all dim together on fold; the bet-then-fold visual inconsistency is gone. The **Cycle 29 M-1(b)** probe gap (folded-seat-with-committed-chips test) is also **closed** by the new chip-stack fold-dim test coverage. **Cycle 29 M-1(a)** (glow-rotation-tracks-camera probe) remains open pending `aia-core-6o9t.2` (H-2). **No beads filings this cycle** — all findings are MEDIUM / LOW and tracked in this ledger only.

#### Filed Bug Cards

_None. 0 CRITICAL, 0 HIGH this cycle._

#### Rolled-forward findings (MEDIUM / LOW — not filed to beads)

1. **[MEDIUM] M-1 — Single-material-per-denom forecloses future differential dim levels**
   - **Location:** `frontend/src/scenes3d/components/ChipInstances.tsx:305-330`
   - **Category:** architecture / forward-compat
   - **Description:** The dual-pool split shares one `MeshStandardMaterial` across all live dim stacks, so min-wins across differing opacities is architecturally forced. A future story like "showdown losers dim to 0.5 while folded dim to 0.3" would silently clamp all dimmed seats to 0.3. Race-free today (only one dim consumer), but a latent constraint.
   - **Recommended fix:** if a second dim consumer lands, bucket by rounded opacity into N pools; OR narrow the `opacity?: 0.3 | 1` type union to match actual capability and surface the constraint in the type. Track as P3 follow-up.

2. **[MEDIUM] M-2 — `_latestMeshes` / `_latestDimmedMeshes` not nulled on unmount**
   - **Location:** `frontend/src/scenes3d/components/ChipInstances.tsx:262-278`
   - **Category:** test-surface hygiene
   - **Description:** Inconsistent with the `_latestStacks` cleanup pattern — after unmount + `pool.dispose()`, the test probe returns disposed meshes until a subsequent `reset()`. The current suite masks this via `afterEach`; future test authors writing tests that assert post-unmount probe behavior will hit it.
   - **Recommended fix:** mirror the `_latestStacks` cleanup pattern — null out both refs in the effect's return path, guarded by identity check against the current pool.

3. **[MEDIUM] M-3 — `__getTestProbe` not DEV-gated in production bundle**
   - **Location:** `frontend/src/scenes3d/components/ChipInstances.tsx:118-162`
   - **Category:** prod surface hygiene
   - **Description:** The double-underscore prefix is convention, not a guard — `__getTestProbe` ships in production bundles. Consistent with the pre-existing baseline in this file, but worth addressing to prevent test-only surfaces from leaking into prod builds.
   - **Recommended fix:** wrap the probe in `if (import.meta.env.DEV)` and return a stub in prod, or explicitly document `__getTestProbe` as a whitelisted test API in a module-level comment.

4. **[LOW] L-1 — `<ChipStack>` opacity JSDoc claims upper clamp not enforced**
   - **Location:** `frontend/src/scenes3d/components/ChipStack.tsx:14-22`
   - **Category:** docs drift
   - **Description:** The JSDoc claims "Clamped to (0, 1]" but only the lower bound is enforced in code. `opacity={1.5}` passes through harmlessly (routes to the opaque pool via `isDim = opacity < 1`), but the contract and the implementation disagree.
   - **Recommended fix:** apply `Math.min(1, ...)` at the clamp site, or correct the JSDoc to match actual behavior.

5. **[LOW] L-2 — Dimmed pool primitives always mounted**
   - **Location:** `frontend/src/scenes3d/components/ChipInstances.tsx:430-440`
   - **Category:** scene-graph footprint
   - **Description:** The dual-pool split doubles the mounted `InstancedMesh` count (4 → 8) even when no seat is folded. GPU cost is negligible (count=0 short-circuits draw calls), and scene-graph traversal cost is minor.
   - **Recommended fix:** none required. If profiling ever flags scene-graph traversal, gate the dimmed pool mount on a `hasAnyDimmed` boolean derived from the stacks prop.

6. **[LOW] L-3 — `dimmedPool.setOpacity` stale when no dim stacks**
   - **Location:** `frontend/src/scenes3d/components/ChipInstances.tsx:345-350`
   - **Category:** defensive hygiene
   - **Description:** `setOpacity` is only called when `anyDimmed === true`; when the last folded seat clears, the dimmed material retains its stale opacity value. Harmless because count=0 means nothing draws.
   - **Recommended fix:** optional — reset `dimmedPool` opacity to 1 when `!anyDimmed`, for defensive consistency.

#### Recommendation

No beads filings this cycle — all findings are MEDIUM / LOW and tracked in this ledger. **M-1** is a latent architectural constraint; revisit if/when a second dim consumer (e.g. showdown losers) lands. **M-2** and **M-3** are test-surface / prod-surface hygiene — fold into the next touch on `ChipInstances.tsx`. **L-1** is a one-line JSDoc-vs-code reconciliation; **L-2** and **L-3** are no-ops today. **AC-1 is now SATISFIED** — the Cycle 29 H-1 carry-forward is genuinely closed, and Cycle 29 **M-1(b)** (chip-stack fold-dim test probe) is closed by this cycle's test coverage. Cycle 29 **M-1(a)** (glow-rotation-tracks-camera probe) remains open pending `aia-core-6o9t.2` (H-2).

#### Links

- Review artifact: [docs/agent/reviews/cycle-30-aia-core-6o9t.1-2026-04-20.md](../../docs/agent/reviews/cycle-30-aia-core-6o9t.1-2026-04-20.md)
- Prior cycle: [Cycle 29 — aia-core-lpto](#cycle-29--aia-core-lpto-t-018-action-highlights-fold-dim--bet-glow--turn-pulse-scott-review-2026-04-20)
- Filed to beads: _none this cycle_ (0 CRIT, 0 HIGH)
- Carry-forward targets: **M-1**, **M-2**, **M-3**, **L-1**, **L-2**, **L-3** — all local to `ChipInstances.tsx` / `ChipStack.tsx`, fold into next touch
- Closed carry-forward: Cycle 29 **H-1** (chip stack not dimmed on fold) — GENUINELY CLOSED; Cycle 29 **M-1(b)** (chip-stack fold-dim probe gap) — CLOSED; AC-1 upgraded PARTIAL → SATISFIED
- Still open carry-forward: Cycle 29 **M-1(a)** (glow-rotation-tracks-camera probe) — pending `aia-core-6o9t.2` (H-2)

### Cycle 31 — aia-core-6o9t.2 (H-2 Billboard `<BetGlowOverlay>`, Scott review, 2026-04-20)

**Source:** [docs/agent/reviews/cycle-31-aia-core-6o9t.2-2026-04-20.md](../../docs/agent/reviews/cycle-31-aia-core-6o9t.2-2026-04-20.md)
**Source task:** aia-core-6o9t.2 — H-2 Billboard `<BetGlowOverlay>` so its rotation tracks the camera (Cycle 29 carry-forward)

#### Summary

`aia-core-6o9t.2` closes the Cycle 29 **H-2** carry-forward by giving `<BetGlowOverlay>` the same per-frame billboard Y-rotation driver that `<Nameplate>` already uses, so the bet-glow plaque tracks the camera instead of painting edge-on from oblique POVs. The shared `computeBillboardYRotation` helper is reused; the state + epsilon-compare + `setRotationY` loop is co-located on the overlay. Scott flagged **0 CRITICAL, 0 HIGH, 1 MEDIUM, 3 LOW**. **T-018 AC-2 caveat from Cycle 29 is resolved** — bet-glow rotation now matches nameplate rotation across viewer POVs. The **Cycle 29 M-1(a)** probe gap (glow-rotation-tracks-camera) is **closed** by the new sibling-parity test. Both Cycle 29 HIGH carry-forwards (H-1 in Cycle 30, H-2 in Cycle 31) are now closed, and **T-018 ACs are all SATISFIED retroactively**. **No beads filings this cycle** — all findings are MEDIUM / LOW and tracked in this ledger only.

#### Filed Bug Cards

_None. 0 CRITICAL, 0 HIGH this cycle._

#### Rolled-forward findings (MEDIUM / LOW — not filed to beads)

1. **[MEDIUM] M-1 — Billboard `useFrame` driver copy-pasted across Nameplate + BetGlowOverlay**
   - **Location:** `frontend/src/scenes3d/components/SeatHighlight.tsx:243-271`, `frontend/src/scenes3d/components/Nameplate.tsx:240-267`
   - **Category:** architecture / DRY
   - **Description:** Only the `computeBillboardYRotation` helper is shared; the state + epsilon-compare + `setRotationY` driver is duplicated across both components. Future billboard tweaks (epsilon value, rotation-axis swap, camera-ref handling) will silently diverge; parity currently rests on the sibling-parity test rather than a shared hook.
   - **Recommended fix:** extract `useBillboardYRotation(objectPos): number` hook that owns the state, the `useFrame` subscription, the epsilon compare, and the `RootState` typing. File as follow-up refactor; revisit when a third billboard consumer lands.

2. **[LOW] L-1 — Initial `rotationY = 0` paints one frame edge-on on first mount**
   - **Location:** `frontend/src/scenes3d/components/SeatHighlight.tsx:225`
   - **Category:** pre-existing cosmetic
   - **Description:** Pre-existing `<Nameplate>` behavior — first frame after mount uses `rotationY = 0` before `useFrame` runs. `<BetGlowOverlay>` mounts for all seats and toggles visibility via `active`/`return null`, so rotation state persists across glow activations and there's no per-bet flash. Only visible once, on initial scene mount.
   - **Recommended fix:** seed the initial rotation via `useLayoutEffect` (pre-paint), or accept as-is matching the nameplate baseline.

3. **[LOW] L-2 — Ad-hoc `frameState as { camera?: ... }` cast duplicated from Nameplate**
   - **Location:** `frontend/src/scenes3d/components/SeatHighlight.tsx:248-257`
   - **Category:** types hygiene
   - **Description:** The `useFrame` callback casts `frameState` to an ad-hoc `{ camera?: { position?: Vector3Like } }` shape rather than using R3F's `RootState`. Copied from the Nameplate baseline.
   - **Recommended fix:** use `RootState` from `@react-three/fiber` directly when the M-1 refactor lands; fold into the extracted hook.

4. **[LOW] L-3 — Billboard driver runs on all 6 overlays every frame, even inactive**
   - **Location:** `frontend/src/scenes3d/components/SeatHighlight.tsx:243-270`
   - **Category:** perf (micro)
   - **Description:** `<BetGlowOverlay>` mounts for every seat and the `useFrame` callback runs regardless of `active`; this matches the Nameplate always-on pattern. ~6 extra `atan2` calls per frame plus epsilon-gated `setRotationY`. Negligible at steady state.
   - **Recommended fix:** none required — documenting suffices. If profiling ever flags, gate the `useFrame` subscription on `active`, accepting the first-frame edge-on paint when glow re-activates.

#### Recommendation

No beads filings this cycle — all findings are MEDIUM / LOW and tracked in this ledger. **M-1** is the only item worth active tracking: extract a shared `useBillboardYRotation` hook when a third consumer lands (or sooner, to lock in parity by construction rather than by test). **L-1**, **L-2**, **L-3** are pre-existing nameplate-baseline behaviors inherited by the overlay; fold into the M-1 refactor. **T-018 AC-2 is now SATISFIED** — the Cycle 29 H-2 carry-forward is genuinely closed, and Cycle 29 **M-1(a)** (glow-rotation-tracks-camera probe) is closed by this cycle's sibling-parity test. With H-1 closed in Cycle 30 and H-2 closed in Cycle 31, **T-018 ACs are all SATISFIED retroactively**.

#### Links

- Review artifact: [docs/agent/reviews/cycle-31-aia-core-6o9t.2-2026-04-20.md](../../docs/agent/reviews/cycle-31-aia-core-6o9t.2-2026-04-20.md)
- Prior cycle: [Cycle 30 — aia-core-6o9t.1](#cycle-30--aia-core-6o9t1-h-1-dim-folded-seats-chip-stack-scott-review-2026-04-20)
- Filed to beads: _none this cycle_ (0 CRIT, 0 HIGH)
- Carry-forward targets: **M-1** (shared `useBillboardYRotation` hook refactor); **L-1**, **L-2**, **L-3** fold into the M-1 extraction
- Closed carry-forward: Cycle 29 **H-2** (bet-glow rotation does not track camera) — GENUINELY CLOSED; Cycle 29 **M-1(a)** (glow-rotation-tracks-camera probe gap) — CLOSED; T-018 AC-2 Cycle 29 caveat — RESOLVED; **T-018 all ACs SATISFIED retroactively** (with Cycle 30 closing H-1)
- Still open carry-forward: _none from Cycle 29_ — both HIGH carry-forwards (H-1, H-2) and both M-1 probe sub-items (a, b) are now closed

### Cycle 32 — aia-core-21ed (T-030 Migrate `TableView3D.tsx` dealer embed, Scott review, 2026-04-20)

**Source:** [docs/agent/reviews/cycle-32-aia-core-21ed-2026-04-20.md](../../docs/agent/reviews/cycle-32-aia-core-21ed-2026-04-20.md)
**Source task:** aia-core-21ed — T-030 Migrate `TableView3D.tsx` to embed the new `<PokerTable>` scene in the dealer route

#### Summary

`aia-core-21ed` migrates the dealer-route `TableView3D.tsx` shim from the legacy scene to the new `<PokerTable>` composition built across T-018…T-029. The embed wires `gameId` / `handNumber` / `streetIndex` / `viewerSeatNumber` through, preserves the fixed-height container contract from T-006, and keeps the existing `useHandPolling` / `useStreetScrubber` flow intact in the parent dashboard. Scott flagged **0 CRITICAL, 1 HIGH, 3 MEDIUM, 4 LOW**. **AC-1 / AC-2 / AC-3 SATISFIED**; **AC-4 PARTIAL** (source-string-only assertion, no runtime listener spy); **AC-5 PARTIAL** — `theme` and `qualityTier` are not forwarded to `<PokerTable>` despite the T-030 call-site spec (L629-636) and the Cycle 14 **MED-1** route-level-theme-wiring assignment (L1621, L1654). One HIGH (**H-1**) is filed to beads as P1 for Logan in the next step; MEDIUM / LOW findings are tracked in this ledger only.

#### Filed Bug Cards

1. **[HIGH] H-1 — `theme` and `qualityTier` not forwarded from `TableView3D` to `<PokerTable>`** _(split during Logan rescope, 2026-04-20)_
   - **Location:** `frontend/src/dealer/TableView3D.tsx:79-85`
   - **Category:** prop-threading / spec compliance
   - **Description:** T-030 tasks.md call-site (L629-636) threads both `theme` and `qualityTier` into `<PokerTable>`, and Cycle 14 **MED-1** (tasks.md L1621, L1654) explicitly routed the top-level `useTableStore(s => s.theme)` wiring to T-030. AC-5 requires "theme all active across the embed." The current impl omits both props, so the dealer route always renders `<PokerTable>` with its default theme/quality regardless of the store — the theme toggle is inert on the dealer surface.
   - **Recommended fix:** select `theme` and `qualityTier` at the `TableView3D` route via `useTableStore`, forward to `<PokerTable>`, and add two prop-threading assertions to `frontend/test/dealer/TableView3D.test.tsx`.
   - **Split note (Logan, 2026-04-20):** Hank discovered while claiming `aia-core-r11d` that `useTableStore` has no `qualityTier` slice yet — that slice is the scope of T-027 (`aia-core-y39z`, currently `blocked`). `theme` slice IS present. H-1 was therefore split into two bugs so the unblocked half can land now:
     - **H-1(a) — theme wiring (unblocked):** `aia-core-r11d` (rescoped in place; P1). Title: "Forward `theme` from TableView3D route to `<PokerTable>` (T-030 AC-5 theme-only completion)".
     - **H-1(b) — qualityTier wiring (blocked on T-027):** `aia-core-t4dp` (P2, `blocked-by: aia-core-y39z`, `discovered-from: aia-core-21ed`, `parent: aia-core-6o9t`).
   - **Beads ids:** `aia-core-r11d` (theme half), `aia-core-t4dp` (qualityTier half)

#### Rolled-forward findings (MEDIUM / LOW — not filed to beads)

1. **[MEDIUM] M-1 — `<PokerTable>` test double re-implements prod equity-guard wiring**
   - **Location:** `frontend/test/dealer/TableView3D.test.tsx:56-78`
   - **Category:** test coupling / drift risk
   - **Description:** The `<PokerTable>` mock re-implements the equity-guard → `fetchEquity` path rather than delegating to the real component. Strength: catches wrong-viewer-policy regressions directly. Weakness: if `<PokerTable>` later adds hole-card-count gating (see `frontend/src/scenes3d/equityGuard.ts:11`, `EquityBadge.tsx:12`), the mock will silently drift and the test will stay green while prod diverges. Additionally, `fetchEquity.mock.calls[0] === [42, 1]` couples to the exact `fetchEquity` signature.
   - **Recommended fix:** add a "mirror of `<PokerTable>` composition" comment to the mock, and file a follow-up to collapse this suite into a real-`<PokerTable>` integration test once T-033 lands.

2. **[MEDIUM] M-2 — Redundant `/equity` fetches between parent dashboard and embed**
   - **Location:** `frontend/src/dealer/ActiveHandDashboard.tsx:97-105`
   - **Category:** perf / duplication
   - **Description:** The parent dashboard has a raw-`fetch` effect keyed on `[viewMode, gameId, handNumber, community]` that calls `/equity`, while the embedded `<TableView3D>` → `<PokerTable>` → `useEquityQuery` also fetches `/equity` on `(gameId, handNumber, streetIndex)`. Result: 2× network per street, and the equity-row UI duplicates the in-scene `<EquityBadges>`.
   - **Recommended fix:** drop the parent-side `/equity` effect and its equity-row and rely on the in-scene badges, OR migrate the parent to `useEquityQuery`. Resolve as part of T-033.

3. **[MEDIUM] M-3 — Data drift between parent `hands3D` (one-shot) and embed polling**
   - **Location:** `frontend/src/dealer/ActiveHandDashboard.tsx:87,334`
   - **Category:** state consistency
   - **Description:** Parent loads `hands3D` once (or on narrow deps) while `<TableView3D>` polls for hands; when hand N+1 arrives, the sibling `<StreetScrubber>` still shows hand N until the user toggles view mode.
   - **Recommended fix:** hoist `useHandPolling` to the parent dashboard, OR have `<TableView3D>` surface hands upward via callback / a shared store slice.

4. **[LOW] L-1 — AC-3 height test is regex-coupled**
   - **Location:** `frontend/test/dealer/TableView3D.test.tsx:267-277`
   - **Category:** test brittleness
   - **Description:** AC-3 is asserted by regex-matching a `500px` literal in the component source string; any reformat (template-literal, extracted constant, CSS variable) breaks the test without a behavior change.
   - **Recommended fix:** export a `CONTAINER_HEIGHT` constant from `TableView3D.tsx` and import it in the test, or parse the rendered DOM's inline style via jsdom.

5. **[LOW] L-2 — AC-4 has no runtime window-listener spy**
   - **Location:** `frontend/test/dealer/TableView3D.test.tsx:283-295`
   - **Category:** test depth
   - **Description:** AC-4 (no manual `resize` listener on the dealer embed — R3F owns resize) is asserted only by absence-in-source-string, with `<Canvas>` mocked. A future regression that re-adds `window.addEventListener('resize', ...)` inside `<PokerTable>` or a child would not be caught here.
   - **Recommended fix:** add `vi.spyOn(window, 'addEventListener')` and assert zero `'resize'` registrations during render.

6. **[LOW] L-3 — Null-guard on `gameId` is tautological**
   - **Location:** `frontend/src/dealer/TableView3D.tsx:41`
   - **Category:** dead code / type hygiene
   - **Description:** The `enabled: gameId !== null && gameId !== undefined` guard is tautological given `gameId: number` — TS can't produce `null`/`undefined` here, and `gameId === 0` still passes through.
   - **Recommended fix:** replace with `Number.isFinite(gameId) && gameId > 0` to match the real "valid game" invariant, or drop the guard entirely.

7. **[LOW] L-4 — `useTableStateQuery` stub referenced in spec but never built**
   - **Location:** `specs/table-3d-revamp-010/tasks.md:627`
   - **Category:** spec drift
   - **Description:** The `useTableStateQuery` helper is referenced by T-030 / T-031 / T-032 call-site prescriptions but was never implemented; Hank inlined the equivalent `useQuery` call in `TableView3D.tsx`. Risk: T-031 and T-032 will each re-inline their own copies and drift three ways.
   - **Recommended fix:** either build the shared `useTableStateQuery` helper now (before T-031 / T-032 land) or amend the spec to drop the reference. Route to Jean.

#### Recommendation

File **H-1** to beads as P1 (Logan follows in the next step) — the `theme` / `qualityTier` prop-threading gap is a direct AC-5 miss and the Cycle 14 MED-1 handoff. **M-1 / M-2 / M-3** cluster around the dealer embed's data-layer seams; resolve as part of T-033 rather than piecemeal. **L-4** is spec-level and should route to Jean before T-031 / T-032 claim — either build the `useTableStateQuery` helper or amend the spec. **L-1 / L-2** are test-depth upgrades that can fold into the H-1 follow-up (same test file). **AC-1 / AC-2 / AC-3 SATISFIED**; **AC-4 PARTIAL** (pending L-2); **AC-5 PARTIAL** (pending H-1).

#### Links

- Review artifact: [docs/agent/reviews/cycle-32-aia-core-21ed-2026-04-20.md](../../docs/agent/reviews/cycle-32-aia-core-21ed-2026-04-20.md)
- Prior cycle: [Cycle 31 — aia-core-6o9t.2](#cycle-31--aia-core-6o9t2-h-2-billboard-betglowoverlay-scott-review-2026-04-20)
- Filed to beads: **H-1(a)** (`aia-core-r11d`, P1, theme-only) + **H-1(b)** (`aia-core-t4dp`, P2, `blocked-by: aia-core-y39z`) — filed this cycle by Logan; H-1 split on 2026-04-20 after Hank found `useTableStore.qualityTier` slice missing (owned by T-027 `aia-core-y39z`, blocked)
- Carry-forward targets: **H-1(a)** (`aia-core-r11d`, AC-5 theme prop-threading, unblocked) + **H-1(b)** (`aia-core-t4dp`, AC-5 qualityTier prop-threading, blocked on T-027 `aia-core-y39z`) — both filed to beads; **M-1 / M-2 / M-3** — resolve during T-033; **L-1 / L-2** — fold into H-1 follow-up test work; **L-3** — drive-by during H-1 fix; **L-4** — route to Jean (spec amendment or helper build)
- Closed carry-forward: _none — this is the first cycle in the T-030 / T-031 / T-032 dealer-embed arc_
- Still open carry-forward: **AC-4** (source-string-only assertion, L-2); **AC-5** (theme gap → H-1(a) `aia-core-r11d`; qualityTier gap → H-1(b) `aia-core-t4dp`, blocked on T-027) — all tracked above

### Cycle 33 — aia-core-r11d (H-1(a) theme-only forwarding in dealer embed, Scott review, 2026-04-20)

**Source:** [docs/agent/reviews/cycle-33-aia-core-r11d-2026-04-20.md](../../docs/agent/reviews/cycle-33-aia-core-r11d-2026-04-20.md)
**Source task:** aia-core-r11d — Forward `theme` from `TableView3D` route to `<PokerTable>` (T-030 AC-5 theme-only completion; H-1(a) of Cycle 32)

#### Summary

`aia-core-r11d` closes the unblocked half of the Cycle 32 **H-1** carry-forward by wiring `useTableStore((s) => s.theme)` through the dealer-embed route into `<PokerTable theme={theme}>`. Surgical diff: 1 selector + 1 prop on `TableView3D.tsx`, 1 new prop-threading test on `TableView3D.test.tsx`. Gates 1813 → 1814 (+1), lint clean on touched files. Scott flagged **0 CRITICAL, 0 HIGH, 1 MEDIUM, 2 LOW**. **T-030 AC-5 theme dimension SATISFIED**; **qualityTier dimension DEFERRED** to `aia-core-t4dp` (blocked on T-027 `aia-core-y39z`). No regression to Cycle 32 AC-1 / AC-2 / AC-3. **No beads filings this cycle** — all findings are MEDIUM / LOW and tracked in this ledger only.

#### Rolled-forward findings (MEDIUM / LOW — not filed to beads)

1. **[MEDIUM] M-1 — Theme test mutates shared `useTableStore` without symmetric setup/teardown**
   - **Location:** `frontend/test/dealer/TableView3D.test.tsx:~248-263`
   - **Category:** test isolation / drift risk
   - **Description:** The new prop-threading test calls `useTableStore.getState().setTheme(customTheme)` before `renderView()` and inline-resets to `DEFAULT_THEME` at the end of the test body. `useTableStore` is a persisted Zustand singleton shared across all tests. If any assertion throws before the reset line executes, the store remains polluted for the remainder of the run; the existing `beforeEach` (`vi.clearAllMocks(); cleanup();`) does not touch Zustand state. Low impact today (no other test reads theme) but becomes a latent flake source as more theme-aware assertions land in T-031 / T-033.
   - **Recommended fix:** move the reset into a block-scoped `afterEach` — `afterEach(() => useTableStore.getState().setTheme(DEFAULT_THEME))` — or wrap the mutation in try/finally. Fold into the L-1 test-depth work.

2. **[LOW] L-1 — No negative test for `qualityTier` prop**
   - **Location:** `frontend/test/dealer/TableView3D.test.tsx` (prop-threading describe)
   - **Category:** test depth / contract protection
   - **Description:** The H-1 split (r11d = theme only; t4dp = qualityTier blocked on T-027) is documented in prod via the comment at `TableView3D.tsx:L41-L45`, but no test asserts absence of `qualityTier` threading today. If someone adds `qualityTier={qualityTier}` before the store slice lands in T-027, the prop would silently be `undefined` at runtime and the split contract would drift.
   - **Recommended fix:** add `expect(latestPokerTableProps()).not.toHaveProperty('qualityTier')` as a single-line guard, or fold a comment-only note if the team prefers not to lock absence. Resolve during `aia-core-t4dp` implementation.

3. **[LOW] L-2 — Store `TableTheme` shape narrower than `PokerTableTheme` (no `railColor`)**
   - **Location:** `frontend/src/scenes3d/state/tableStore.ts:L49-L61` + forward at `frontend/src/dealer/TableView3D.tsx:L87`
   - **Category:** spec drift / design
   - **Description:** `<PokerTable>`'s `PokerTableTheme` has an optional `railColor?: string` field used by `<Table feltColor railColor />`, but the store's `TableTheme` has only `(mode, feltColor, cardBack)`. Every consumer wiring through `useTableStore` renders `theme.railColor === undefined` — the prop is dead for store-driven surfaces. Consistent with T-015 spec but exposes a structural mismatch.
   - **Recommended fix:** route to Jean — either (a) extend the store slice with `railColor` (separate task) or (b) drop `railColor` from `PokerTableTheme` and derive it from `feltColor` + `mode` inside `<Table>`. Not blocking.

#### Recommendation

**No beads filings** — all findings are MEDIUM / LOW. **M-1** and **L-1** are test-depth upgrades that cluster naturally with `aia-core-t4dp` (the qualityTier half of the H-1 split) whenever T-027 unblocks it; keep them both in this ledger. **L-2** is spec-level and should route to Jean for a railColor decision when T-015's theme slice is next revisited — not urgent. **T-030 AC-5 (theme dimension) is SATISFIED**; the qualityTier dimension remains open under `aia-core-t4dp` as expected.

#### Links

- Review artifact: [docs/agent/reviews/cycle-33-aia-core-r11d-2026-04-20.md](../../docs/agent/reviews/cycle-33-aia-core-r11d-2026-04-20.md)
- Prior cycle: [Cycle 32 — aia-core-21ed](#cycle-32--aia-core-21ed-t-030-migrate-tableview3dtsx-dealer-embed-scott-review-2026-04-20)
- Filed to beads: _none this cycle_
- Carry-forward targets: **M-1 / L-1** — fold into `aia-core-t4dp` implementation (qualityTier half, blocked on T-027 `aia-core-y39z`); **L-2** — route to Jean for T-015 slice decision
- Closed carry-forward: Cycle 32 **H-1(a)** (theme prop-threading gap) — CLOSED; T-030 **AC-5 theme dimension** — SATISFIED
- Still open carry-forward: Cycle 32 **AC-4** (source-string-only resize assertion, L-2 from Cycle 32); Cycle 32 **AC-5 qualityTier dimension** → `aia-core-t4dp` (blocked on T-027 `aia-core-y39z`); Cycle 32 **M-1 / M-2 / M-3** (dealer-embed data-layer seams) → resolve during T-033; Cycle 32 **L-4** (useTableStateQuery spec drift) → route to Jean

### Cycle 34 — aia-core-nuy2 (T-017 Action-status badge on nameplate, Scott review, 2026-04-20)

**Source:** [docs/agent/reviews/cycle-34-aia-core-nuy2-2026-04-20.md](../../docs/agent/reviews/cycle-34-aia-core-nuy2-2026-04-20.md)
**Source task:** aia-core-nuy2 — T-017 Action-status badge on nameplate (fold/check/call/bet/raise/all-in pill above seat nameplate)

#### Summary

`aia-core-nuy2` lands T-017 — a per-seat action-status badge composed as a sibling of `<Nameplates>` inside `<PokerTable>`. New `<ActionBadge>` / `<ActionBadges>` components plus a `computeActionBadgeWorldPosition` helper place the pill above the nameplate, and the `handsToTableState` adapter gains a `deriveLastAction()` helper so `SeatState.lastAction` now carries real `street` + `(bet|raise).amount` values — closing the **T-003 LOW #4** (`lastAction.amount`) carry-forward in passing. Suite 1814 → 1839 (+25); lint clean. Scott flagged **0 CRITICAL, 0 HIGH, 2 MEDIUM, 4 LOW**. **All 4 ACs SATISFIED**; `prefers-reduced-motion` honored (no new animations introduced). **No beads filings this cycle** — all findings are MEDIUM / LOW and tracked in this ledger only.

#### Rolled-forward findings (MEDIUM / LOW — not filed to beads)

1. **[MEDIUM] M-1 — `useFrame` billboard callback registers for every seat's `<ActionBadge>` even when hidden**
   - **Location:** `frontend/src/scenes3d/components/ActionBadge.tsx`
   - **Category:** performance / hooks-before-early-return
   - **Description:** `<ActionBadge>` registers a `useFrame` billboard callback unconditionally at the top of the component, then falls through to a hidden return when `shouldShowBadge(lastAction, phase)` is false. Every seat therefore pays per-frame cost regardless of whether a pill is visible, and the waste scales linearly with table size (9-max × 60fps = 540 no-op frame callbacks/sec at steady state). Classic hooks-before-early-return pattern — functionally harmless today but an unnecessary hot-path tax.
   - **Recommended fix:** gate the child mount at the `<ActionBadges>` level — only render an `<ActionBadge>` for seats where `shouldShowBadge` is true, so the `useFrame` hook is never registered for hidden badges. Keeps the per-badge component simple and eliminates the waste.

2. **[MEDIUM] M-2 — `deriveLastAction` assumes `HandActionResponse[]` is chronological with no pinned contract**
   - **Location:** `frontend/src/scenes3d/data/handsToTableState.ts`
   - **Category:** test depth / implicit contract
   - **Description:** `deriveLastAction()` walks the hand's `actions` array and returns the last entry matching the target seat, relying on the backend emitting actions in chronological order. No test scrambles the array to pin the contract; if the API ever returns `actions` sorted by `id DESC`, by street-then-position, or out-of-order after an edit, every seat's `lastAction` silently becomes stale or wrong.
   - **Recommended fix:** either (a) sort by `created_at` (or `sequence_no`) inside `deriveLastAction()` before the final-match walk, or (b) add a scrambled-order unit test that pins "chronological input is required" as the contract. Preferred: (a) — defense-in-depth against backend change.

3. **[LOW] L-1 — `computeActionBadgeWorldPosition` lacks multi-seat / multi-count coverage**
   - **Location:** `frontend/test/scenes3d/components/ActionBadge.test.tsx` (helper tests)
   - **Category:** test depth
   - **Description:** The world-position helper is only exercised at `(seatIndex=0, seatCount=6)`; other seat indices and table sizes (2-max, 4-max, 9-max) are not pinned. A regression that silently breaks badge placement for non-zero seats would escape the current probe.
   - **Recommended fix:** add an exhaustive matrix test — iterate over `seatCount ∈ {2, 4, 6, 9}` × `seatIndex ∈ [0, seatCount)` and assert the returned `[x, y, z]` matches the nameplate anchor formula. Cheap and high-leverage.

4. **[LOW] L-2 — No `<PokerTable>` integration test asserts `<ActionBadges>` mount + `state.phase` threading**
   - **Location:** `frontend/test/scenes3d/components/PokerTable.test.tsx`
   - **Category:** test depth / scene-level probe
   - **Description:** Unit tests cover `<ActionBadge>` and `<ActionBadges>` in isolation, but no scene-level probe asserts that `<PokerTable>` actually mounts `<ActionBadges>` as a sibling of `<Nameplates>` with the correct `phase` threaded through from `state.phase`. A refactor that accidentally drops the sibling or passes a stale phase would not be caught.
   - **Recommended fix:** add a single `<PokerTable>` integration test that renders with a known `TableState` and asserts (a) `<ActionBadges>` is mounted and (b) the phase prop matches `state.phase`. Cluster with L-1 in a test-depth follow-up.

5. **[LOW] L-3 — `default:` branch of `formatActionLabel` unreachable in production**
   - **Location:** `frontend/src/scenes3d/components/ActionBadge.tsx` (helper)
   - **Category:** documentation / defense-in-depth
   - **Description:** The `default:` branch of the `formatActionLabel` switch returns a fallback string but is unreachable in production because the `handsToTableState` adapter whitelists action kinds to the known set before they reach the badge. Coverage shows the branch untaken; not a bug, but unannotated.
   - **Recommended fix:** add a one-line comment (`// defense-in-depth: adapter whitelists kinds; unreachable at runtime`) or an `assertNever(kind)` exhaustiveness check. No behavioral change.

6. **[LOW] L-4 — Badge Y-coordinate not pinned against seat-pad surface**
   - **Location:** `frontend/test/scenes3d/components/ActionBadge.test.tsx` (helper tests)
   - **Category:** test depth / anchor drift
   - **Description:** `computeActionBadgeWorldPosition` tests pin the badge Y-coordinate relative to the nameplate's bottom edge but not against the seat-pad surface anchor. If nameplate geometry shifts (e.g., a future T-02x change to nameplate height or offset), the badge would continue to test green against the nameplate while drifting off the seat-pad visually.
   - **Recommended fix:** add an anchor test that pins `badge.y - seatPad.y` (the absolute offset above the table surface) in addition to the nameplate-relative offset. Cluster with L-1 in the same test-depth pass.

#### Recommendation

**No beads filings** — all findings are MEDIUM / LOW. **M-1** is a small, self-contained refactor (gate child mount in `<ActionBadges>`) worth picking up in the next scenes3d touch; **M-2** should be folded into the next `handsToTableState` change (either the sort-on-entry fix or a scrambled-order test). **L-1 / L-2 / L-4** are test-depth upgrades that cluster naturally — one follow-up task can knock all three out. **L-3** is a one-line comment whenever someone is next in `ActionBadge.tsx`. **All 4 ACs SATISFIED**; **T-003 LOW #4** (`lastAction.amount` deferral) is CLOSED in passing via the new `deriveLastAction()` helper — no longer a carry-forward.

#### Links

- Review artifact: [docs/agent/reviews/cycle-34-aia-core-nuy2-2026-04-20.md](../../docs/agent/reviews/cycle-34-aia-core-nuy2-2026-04-20.md)
- Prior cycle: [Cycle 33 — aia-core-r11d](#cycle-33--aia-core-r11d-h-1a-theme-only-forwarding-in-dealer-embed-scott-review-2026-04-20)
- Filed to beads: _none this cycle_
- Carry-forward targets: **M-1** — gate `<ActionBadge>` mount in `<ActionBadges>` during next scenes3d touch; **M-2** — sort-on-entry (or scrambled-order test) during next `handsToTableState` change; **L-1 / L-2 / L-4** — cluster into a single test-depth follow-up; **L-3** — annotate inline on next `ActionBadge.tsx` touch
- Closed carry-forward: **T-003 LOW #4** (`lastAction.amount` deferral) — CLOSED in passing via new `deriveLastAction()` in `handsToTableState`
- Still open carry-forward: Cycle 32 **AC-4** (source-string-only resize assertion); Cycle 32 **AC-5 qualityTier dimension** → `aia-core-t4dp` (blocked on T-027 `aia-core-y39z`); Cycle 32 **M-1 / M-2 / M-3** (dealer-embed data-layer seams) → resolve during T-033; Cycle 32 **L-4** (useTableStateQuery spec drift) → route to Jean; Cycle 33 **M-1 / L-1** → fold into `aia-core-t4dp`; Cycle 33 **L-2** (railColor shape mismatch) → route to Jean

### Cycle 35 — aia-core-bsxn (T-012 Pot sweep animation, Scott review, 2026-04-21)

**Source:** [docs/agent/reviews/cycle-35-aia-core-bsxn-2026-04-21.md](../../docs/agent/reviews/cycle-35-aia-core-bsxn-2026-04-21.md)
**Source task:** aia-core-bsxn — T-012 Pot sweep animation (pot chips fly from center to winning seat on resolution, split-pot proportional-to-`profitLoss` math with last-share fixup, all-fold resolution, reduced-motion sync completion)

#### Summary

`aia-core-bsxn` lands T-012 — a controller+driver split mirroring T-010 (`ChipSlideController`) and T-011 (`StreetCollectController`). New `computePotSweepDeltas` pure reducer in `frontend/src/scenes3d/animations/potSweeps.ts`, `PotSweepController` (scope tagging + in-flight tracking + reduced-motion sync completion) in `PotSweepController.ts`, and the React adapter `<PotSweepDriver>` in `PotSweepDriver.tsx`. `<PokerTable>` integrates the driver, threads `potDisplay = max(0, state.pot + depositedTotal − potSweepInFlight − potSweepArrived)`, renders `<FlyingPotSweepSlug>` per active sweep, and coordinates scope cancellation on `handId`/`streetIndex` changes with T-011's street-collect flow. Suite 1839 → 1866 (+27); lint baseline unchanged. Scott flagged **0 CRITICAL, 2 HIGH, 4 MEDIUM, 2 LOW**. **ACs 1 / 3 / 4 SATISFIED**; **AC-2 PARTIAL** — main-vs-side-pot chop edge carried forward via **H-1**. **2 HIGH findings filed to beads as P1 bugs this cycle** (H-1, H-2).

#### Filed Bug Cards

1. **[HIGH] H-1 — Pot sweep split excludes winners with `profitLoss ≤ 0`**
   - **Location:** `frontend/src/scenes3d/animations/potSweeps.ts:92-103`
   - **Category:** correctness / split-pot edge
   - **Description:** `computePotSweepDeltas` clamps each winner's `profitLoss` via `Math.max(0, pl ?? 0)` and splits strictly proportional to the clamped value, with a last-share fixup that absorbs rounding. When one winner has `profitLoss > 0` but a co-winner has `profitLoss ≤ 0` (realistic main-vs-side-pot scenarios — e.g. a short stack wins only a side pot smaller than their contribution, so their `profitLoss` is negative even though `result === 'won'`), the non-positive winner's share computes to zero and the last-share fixup routes the entire pot to the positive winner. Similarly, a `won` seat whose clamped PL is exactly `0` alongside a positive co-winner gets zero chips. The existing "equal-shares fallback" branch only triggers when **every** winner has `plSum === 0`, not when the sum is mixed.
   - **Recommended fix:** when any winner with `result === 'won'` has a clamped `profitLoss ≤ 0`, fall back to an equal split across all declared winners (or use `Math.max(epsilon, pl)` per winner) so every winner receives a visible chip amount. Add a dedicated unit test covering mixed-sign `profitLoss` among winners (closes Cycle 35 **M-4** in passing).
   - **Files:** `frontend/src/scenes3d/animations/potSweeps.ts`, `frontend/test/scenes3d/potSweeps.test.ts`
   - **Beads id:** `aia-core-sqi1` (P1 bug; parent `aia-core-6o9t`; discovered-from `aia-core-bsxn`)

2. **[HIGH] H-2 — `potDisplay` one-frame flash at winner state**
   - **Location:** `frontend/src/scenes3d/PokerTable.tsx:350-363`
   - **Category:** render ordering / visual pop
   - **Description:** `potDisplay = max(0, state.pot + depositedTotal − potSweepInFlight() − potSweepArrived)` is computed during `<PokerTable>`'s render. `potSweepInFlight()` reads from `potSweepControllerRef.current`, which is only updated from `<PotSweepDriver>`'s `useEffect` after children commit. On the first render carrying the winner state, the driver's sync effect has not yet fired → no slug is registered → `potSweepInFlight() === 0` and `potDisplay === state.pot`. The next render (triggered by `setActiveSweeps` inside `handleSweepStart`) collapses `potDisplay` to 0. Users see a one-frame flash of the full pot stack at `POT_CHIP_WORLD_POSITION` before the sweep begins. Under reduced-motion the sweep completes synchronously within the second effect pass, so the user still sees `pot=full → pot=0` within two frames with no interpolation. Integration tests do not assert on the very first committed frame and therefore do not catch this. **Same pattern as T-011's `committedThisStreet` outflow path** — consider applying the same state-backed fix there too.
   - **Recommended fix:** derive pot-sweep outflow from React state (sum of `activeSweeps` amounts maintained by `onSweepStart` / `onSweepComplete`) rather than a live controller read, so `potDisplay` reflects the outflow on the same commit as the slug appearing. Add a regression test that asserts the pot display never renders full pot after the winner state is committed.
   - **Files:** `frontend/src/scenes3d/PokerTable.tsx` (+ potentially `PotSweepDriver.tsx` if controller→state plumbing change needed)
   - **Beads id:** `aia-core-xc33` (P1 bug; parent `aia-core-6o9t`; discovered-from `aia-core-bsxn`)

#### Rolled-forward findings (MEDIUM / LOW — not filed to beads)

1. **[MEDIUM] M-1 — AC-2 "proportional to `profit_loss`" semantics wrong for main-vs-side-pot chops**
   - **Location:** `specs/table-3d-revamp-010/tasks.md:273` (AC authorship) / `frontend/src/scenes3d/animations/potSweeps.ts:92-103` (faithful impl)
   - **Category:** spec drift / AC semantics
   - **Description:** Hank implemented AC-2 literally — shares proportional to winners' positive `profitLoss`. For a clean equal-contribution two-way chop of a single pot, PLs happen to match pot-contribution-weighted share and the visual is correct. For main-vs-side-pot aggregated into `state.pot`, `profitLoss` is the wrong signal — a long-stack side-pot winner + short-stack main-pot winner split the visible pot proportional to their PLs, not what each actually pocketed. Implementation is faithful to the written AC; Scott is flagging the AC itself.
   - **Recommended fix:** route to Jean — likely to wire `sidePots` explicitly (one sweep per pot) rather than animate a single aggregated pot chip. Not blocking T-012 closure; treat as a self-note for Jean's next pass.

2. **[MEDIUM] M-2 — `<FlyingChipSlug>` and `<FlyingPotSweepSlug>` near-duplicates**
   - **Location:** `frontend/src/scenes3d/PokerTable.tsx:632-678`
   - **Category:** cosmetic refactor / duplication
   - **Description:** The two flying-slug components duplicate the same "read live position from controller, render a minimal mesh at that world position, handle fallback on missing id" pattern. Only the controller reference and position-getter differ. A generic `<FlyingSlug controller={...} getInFlightPosition={...} />` (or a shared `getInFlightPosition(key)` adapter on both controllers) would remove the duplication without behavior change.
   - **Recommended fix:** extract a generic `<FlyingSlug>` in a follow-up scenes3d refactor pass when T-010/T-011/T-012 have all stabilized. No behavior impact.

3. **[MEDIUM] M-3 — `sweptBySeat` reset only on `handId` change**
   - **Location:** `frontend/src/scenes3d/PokerTable.tsx:332-346`
   - **Category:** state lifecycle / masked staleness
   - **Description:** `sweptBySeat` is reset in a `useEffect` keyed only on `state.handId`. Any intra-hand state update that re-enters the "winner resolved" branch (e.g. an edit that briefly clears and restores winners within the same hand) could leave `potSweepArrived` carrying a stale delta — the `Math.max(0, …)` clamp masks this as 0 rather than surfacing the inconsistency.
   - **Recommended fix:** reset `sweptBySeat` on the winner-appearance transition (false → true on `hasWinners`) rather than only on `handId` change; or add a prod-comment pinning the backend invariant that prevents intra-hand winner churn.

4. **[MEDIUM] M-4 — No unit coverage for mixed-sign `profitLoss` across winners**
   - **Location:** `frontend/test/scenes3d/potSweeps.test.ts`
   - **Category:** test depth / regression gap
   - **Description:** The split-pot test matrix covers equal positive PLs and the fallback-when-all-zero branch, but nothing pins behavior when winners have mixed-sign `profitLoss` (positive + zero, positive + negative). This is the exact regression surface of **H-1**.
   - **Recommended fix:** add a scrambled-sign matrix test as part of the H-1 fix — winners `[{pl:+50},{pl:-10}]`, `[{pl:+40},{pl:0}]`, `[{pl:+30},{pl:-5},{pl:+15}]`, each asserted to yield a non-zero share for every `won` seat summing to the full pot. Closes in passing with H-1.

5. **[LOW] L-1 — `onSweepStart`-before-`createTween` ordering comment should cross-reference `ChipSlideController` Cycle 19 M-3 convention**
   - **Location:** `frontend/src/scenes3d/animations/PotSweepController.ts:99-108`
   - **Category:** documentation / convention trace
   - **Description:** The ordering (fire `onSweepStart` before the tween is created so React state updates batch ahead of the first frame) is intentional but not annotated. The same convention was established in `ChipSlideController` during Cycle 19 M-3 and carried into `StreetCollectController` in T-011. A cross-reference comment would pin the convention in one place.
   - **Recommended fix:** one-line comment referencing the Cycle 19 M-3 convention. No behavior change.

6. **[LOW] L-2 — Ref-syncing `useEffect` has no dep array**
   - **Location:** `frontend/src/scenes3d/animations/PotSweepDriver.tsx:71-80`
   - **Category:** documentation / lint-convention trace
   - **Description:** The effect intentionally fires every render to keep the controller's callback refs pointing at the latest `onSweepStart` / `onSweepComplete` closures — the established "latest-ref" pattern already used by `ChipSlideDriver`. No dep array is correct, but an inline comment would prevent a well-meaning future edit from adding `[onSweepStart, onSweepComplete]`.
   - **Recommended fix:** add `// latest-ref pattern — intentional no-dep-array; matches ChipSlideDriver convention` above the effect. No behavior change.

#### Recommendation

**2 HIGH findings filed to beads as P1 bugs** — H-1 (split-pot correctness; also closes M-4 in passing) and H-2 (one-frame pot flash; same pattern worth revisiting in T-011's outflow path). **MEDIUM / LOW findings remain in this ledger** — M-1 routes to Jean for AC-2 re-authoring (likely via explicit `sidePots` threading); M-2 is cosmetic and clusters with future scenes3d refactor; M-3 is a lifecycle tightening (or a prod-comment pinning the invariant); L-1 / L-2 are documentation-only annotations. **T-012 is landable with H-1 / H-2 filed and tracked** — ACs 1 / 3 / 4 SATISFIED, AC-2 PARTIAL carried to H-1.

#### Links

- Review artifact: [docs/agent/reviews/cycle-35-aia-core-bsxn-2026-04-21.md](../../docs/agent/reviews/cycle-35-aia-core-bsxn-2026-04-21.md)
- Prior cycle: [Cycle 34 — aia-core-nuy2](#cycle-34--aia-core-nuy2-t-017-action-status-badge-on-nameplate-scott-review-2026-04-20)
- Filed to beads: **H-1** → `aia-core-sqi1` (P1 bug) + **H-2** → `aia-core-xc33` (P1 bug) — parent `aia-core-6o9t`, discovered-from `aia-core-bsxn`
- Carry-forward targets: **M-1** — route to Jean for AC-2 re-authoring (`sidePots`-explicit animation); **M-2** — generic `<FlyingSlug>` extraction during next scenes3d refactor; **M-3** — lifecycle tightening on next `PokerTable.tsx` touch; **L-1 / L-2** — documentation annotations on next controller/driver touch
- Closed carry-forward: **M-4** — will close in passing with H-1 fix (mixed-sign test coverage required by H-1 acceptance)
- Still open carry-forward: Cycle 32 **AC-4** (source-string-only resize assertion); Cycle 32 **AC-5 qualityTier dimension** → `aia-core-t4dp` (blocked on T-027 `aia-core-y39z`); Cycle 32 **M-1 / M-2 / M-3** (dealer-embed data-layer seams) → resolve during T-033; Cycle 32 **L-4** (useTableStateQuery spec drift) → route to Jean; Cycle 33 **M-1 / L-1** → fold into `aia-core-t4dp`; Cycle 33 **L-2** (railColor shape mismatch) → route to Jean; Cycle 34 **M-1 / M-2 / L-1 / L-2 / L-3 / L-4** — all remain as documented in Cycle 34 ledger

### Cycle 36 — aia-core-sqi1 (H-1 Pot sweep split excludes winners with `profitLoss ≤ 0`, Scott review, 2026-04-21)

**Source:** [docs/agent/reviews/cycle-36-aia-core-sqi1-2026-04-21.md](../../docs/agent/reviews/cycle-36-aia-core-sqi1-2026-04-21.md)
**Source task:** aia-core-sqi1 — H-1 Pot sweep split excludes winners with `profitLoss ≤ 0` (Cycle 35 carry-forward; P1 bug; parent `aia-core-6o9t`; discovered-from `aia-core-bsxn`)

#### Summary

`aia-core-sqi1` closes Cycle 35 **H-1** by replacing the strict `plSum > 0` guard in `computePotSweepDeltas` with an `allPositive === true` gate: proportional-to-PL split runs only when every winner's clamped `profitLoss` is strictly positive; otherwise the reducer falls back to an equal split across all declared winners, preserving the existing last-share fixup so totals reconcile exactly to `state.pot`. Five regression tests land in `frontend/test/scenes3d/potSweeps.test.ts` covering the mixed-sign matrix mandated by Cycle 35 **M-4** (`[+50,-10]`, `[+40,0]`, `[+30,-5,+15]`, all-zero, all-negative), each asserting a non-zero share for every `won` seat and exact pot reconciliation. Frontend suite 1866 → 1871 (+5); lint delta 0. Scott flagged **0 CRITICAL, 0 HIGH, 0 MEDIUM, 2 LOW** — both cosmetic and local to `potSweeps.ts`. **H-1 fully resolved; M-4 closed in passing.** **No beads filings this cycle.** H-2 (`aia-core-xc33`, `potDisplay` one-frame flash) is independent and unaffected by this fix.

#### Filed Bug Cards

_None. 0 CRITICAL, 0 HIGH this cycle._

#### Rolled-forward findings (MEDIUM / LOW — not filed to beads)

1. **[LOW] L-1 — Redundant guard `plSum > 0 && allPositive`**
   - **Location:** `frontend/src/scenes3d/animations/potSweeps.ts:106`
   - **Category:** cosmetic / redundant predicate
   - **Description:** `plSum > 0` is implied by `allPositive === true` (a non-empty list of strictly positive numbers always sums to > 0). The compound guard is belt-and-braces and defensible as a readable assertion of intent, but the `plSum > 0` conjunct is mathematically redundant.
   - **Recommended fix:** drop `plSum > 0 &&` and rely on `allPositive` alone, or leave with an inline comment noting the redundancy is intentional. No behavior change either way.

2. **[LOW] L-2 — Variable `positivePls` now carries clamped (not strictly positive) values**
   - **Location:** `frontend/src/scenes3d/animations/potSweeps.ts:95`
   - **Category:** cosmetic / naming drift
   - **Description:** With the `allPositive` gate in place, `positivePls` holds the clamped PLs (`Math.max(0, pl ?? 0)` — which include zero and formerly-negative entries). The name is a pre-existing artifact from before the fallback branch handled mixed-sign inputs; `clampedPls` more accurately describes the contents.
   - **Recommended fix:** rename `positivePls` → `clampedPls` in a future cosmetic pass on this file. No behavior change.

#### Recommendation

No beads filings this cycle — both findings are LOW cosmetic issues local to `potSweeps.ts`. **L-1** and **L-2** fold into the next touch on the pot-sweep reducer. **H-1 is genuinely resolved** — the `allPositive` gate eliminates the zero-share failure mode for mixed-sign winner PLs, and the five new regression tests pin the behavior. **Cycle 35 M-4 is closed in passing** by the mixed-sign test matrix. **H-2 (`aia-core-xc33`) remains independently open** — it targets a render-ordering issue in `<PokerTable>`'s `potDisplay` derivation and was not in scope here.

#### Links

- Review artifact: [docs/agent/reviews/cycle-36-aia-core-sqi1-2026-04-21.md](../../docs/agent/reviews/cycle-36-aia-core-sqi1-2026-04-21.md)
- Prior cycle: [Cycle 35 — aia-core-bsxn](#cycle-35--aia-core-bsxn-t-012-pot-sweep-animation-scott-review-2026-04-21)
- Filed to beads: _none this cycle_ (0 CRIT, 0 HIGH)
- Carry-forward targets: **L-1**, **L-2** — both cosmetic, local to `frontend/src/scenes3d/animations/potSweeps.ts`; fold into next touch on the pot-sweep reducer
- Closed carry-forward: Cycle 35 **H-1** (pot sweep split excludes winners with clamped `profitLoss ≤ 0`) — GENUINELY CLOSED via `aia-core-sqi1`; Cycle 35 **M-4** (no unit coverage for mixed-sign `profitLoss` across winners) — CLOSED by the five new regression tests in `potSweeps.test.ts`; AC-2 upgraded PARTIAL → SATISFIED for the single-pot mixed-sign case (main-vs-side-pot aggregate semantics remain tracked under Cycle 35 **M-1** routed to Jean)
- Still open carry-forward: Cycle 35 **H-2** (`aia-core-xc33`, `potDisplay` one-frame flash) — independent; Cycle 35 **M-1 / M-2 / M-3 / L-1 / L-2** — all remain as documented in Cycle 35 ledger; plus all prior Cycle 32–34 items as documented in Cycle 35 ledger


### Cycle 37 — aia-core-xc33 (H-2 `potDisplay` one-frame flash at winner state, Scott review, 2026-04-21)

**Source:** [docs/agent/reviews/cycle-37-aia-core-xc33-2026-04-21.md](../../docs/agent/reviews/cycle-37-aia-core-xc33-2026-04-21.md)
**Source task:** aia-core-xc33 — H-2 `potDisplay` one-frame flash at winner state (Cycle 35 carry-forward; P1 bug; parent `aia-core-6o9t`; discovered-from `aia-core-bsxn`)

#### Summary

`aia-core-xc33` closes Cycle 35 **H-2** by deriving pot-sweep outflow from React state rather than a live controller ref read. `<PokerTable>` now computes `potSweepInFlight` as the sum of `activeSweeps` amounts (maintained by `onSweepStart` / `onSweepComplete`) with an inline `computePotSweepDeltas(prev, state, layout)` fallback for the transitional render in which the reducer would have proposed deltas but `<PotSweepDriver>`'s effect has not yet committed. On the first render carrying `result === 'won'`, `potDisplay` now reflects the sweep outflow on the same commit as the slug appearing — the pot `<ChipStack>` either unmounts or carries amount `0` instead of flashing the full pot. A Profiler-based regression test (red at `amount=50` → green) lands in `frontend/test/scenes3d/PokerTable.potSweep.test.tsx` pinning "pot display never renders full pot on or after the winner state commit." Frontend suite 1866 → 1872 (+6); lint delta 0. T-012 AC-1 / AC-3 / AC-4 + Cycle 35 **H-1** (mixed-sign split) + reduced-motion sync completion all preserved (7/7 potSweep, 1872/1872 full suite). Scott flagged **0 CRITICAL, 0 HIGH, 2 MEDIUM, 2 LOW**. **H-2 fully resolved. No beads filings this cycle per Anna contract** (MED/LOW → tasks.md only).

#### Filed Bug Cards

_None. 0 CRITICAL, 0 HIGH this cycle._

#### Rolled-forward findings (MEDIUM / LOW — not filed to beads)

1. **[MEDIUM] M-1 — T-011 `inFlightForSeat` has symmetric latent flash in chip-slide**
   - **Location:** T-011 chip-slide integration in `<PokerTable>` (`inFlightForSeat` / `committedThisStreet` outflow path)
   - **Category:** render ordering / latent visual pop (same pattern as H-2)
   - **Description:** The fix H-2 applied to pot-sweep outflow — derive from React state with an inline reducer fallback rather than reading a live controller ref — has a symmetric surface in T-011's chip-slide path: `inFlightForSeat` is read from `chipSlideControllerRef.current` during render, and on the first commit carrying a new deposit the driver's effect has not yet registered the slug → seat stack still shows the pre-deposit value for one frame before collapsing. Flagged in the H-2 review as "same pattern worth revisiting" (Cycle 35 H-2 description). Out of scope for H-2 P1 fix; no evidence this reproduces in current frontend QA, but the render-during-ref-read shape is identical.
   - **Recommended fix:** if frontend QA reproduces a one-frame chip-stack flash on street-commit, promote to a standalone P2 bug in a future planning pass and apply the same state-backed derivation (mirror the `activeSweeps` sum + inline reducer fallback from H-2). No action this cycle.

2. **[MEDIUM] M-2 — Inline `computePotSweepDeltas` runs every render while tween inactive**
   - **Location:** `frontend/src/scenes3d/PokerTable.tsx` (`potSweepInFlight` derivation)
   - **Category:** perf polish / redundant reducer call
   - **Description:** The inline `computePotSweepDeltas(prev, state, layout)` fallback executes on every render, including renders where `state.result !== 'won'` (no sweep could possibly be proposed). Cost is O(seats) per render with negligible material impact at current seat counts (≤ 9), but the work is pure overhead on non-winner commits.
   - **Recommended fix:** early-return `0` when `state.result !== 'won'` before calling the reducer. Optional perf polish; no behavior change.

3. **[LOW] L-1 — `prevStateRef` update effect lacks explanatory comment**
   - **Location:** `frontend/src/scenes3d/PokerTable.tsx` (`prevStateRef` sync effect)
   - **Category:** documentation / convention trace
   - **Description:** The `prevStateRef` is updated in a `useEffect` rather than during render so that the inline `computePotSweepDeltas(prev, state, layout)` fallback sees the *previous* commit's state on the transitional render (the one where `state.result` first flips to `'won'`). Intentional and correct, but unannotated — a well-meaning future edit could move the assignment into render and silently break the fallback.
   - **Recommended fix:** one-line comment explaining "useEffect (not render) so fallback sees prev-commit state on the winner-transition render." No behavior change.

4. **[LOW] L-2 — Reduced-motion path not Profiler-instrumented in regression test**
   - **Location:** `frontend/test/scenes3d/PokerTable.potSweep.test.tsx`
   - **Category:** test depth / coverage add
   - **Description:** The Profiler-based regression test pins the animated path. The reduced-motion path executes the same `computePotSweepDeltas` + `activeSweeps` derivation and completes the sweep synchronously in the driver effect — covered by construction (no tween state to race against), but not Profiler-instrumented. If a future change diverges the two paths, the reduced-motion branch would not independently regression-test the "no full-pot flash" invariant.
   - **Recommended fix:** add a mirror Profiler test under `prefers-reduced-motion: reduce` asserting the same `potDisplay` invariant. Optional coverage add.

#### Recommendation

**No beads filings this cycle** per Anna contract — all findings MEDIUM / LOW. **M-1** is a symmetric-pattern follow-up for T-011's chip-slide outflow path; promote only if frontend QA reproduces. **M-2** is an optional early-return perf polish. **L-1 / L-2** are documentation / test-depth adds that cluster into the next `<PokerTable>` touch. **H-2 is genuinely resolved** — the Profiler regression test pins behavior on the exact failing frame (red at `amount=50` → green on fix), and all prior invariants (T-012 AC-1 / AC-3 / AC-4, Cycle 35 H-1 mixed-sign split, reduced-motion sync completion) remain green (7/7 potSweep, 1872/1872 full suite).

#### Links

- Review artifact: [docs/agent/reviews/cycle-37-aia-core-xc33-2026-04-21.md](../../docs/agent/reviews/cycle-37-aia-core-xc33-2026-04-21.md)
- Prior cycle: [Cycle 36 — aia-core-sqi1](#cycle-36--aia-core-sqi1-h-1-pot-sweep-split-excludes-winners-with-profitloss--0-scott-review-2026-04-21)
- Filed to beads: _none this cycle_ (0 CRIT, 0 HIGH; MED/LOW → tasks.md only per Anna contract)
- Carry-forward targets: **M-1** — symmetric latent flash in T-011 chip-slide path, promote to P2 bug only if frontend QA reproduces; **M-2** — `state.result !== 'won'` early-return in `potSweepInFlight` derivation, optional perf polish; **L-1** — inline comment on `prevStateRef` update effect; **L-2** — Profiler-instrumented reduced-motion mirror test
- Closed carry-forward: Cycle 35 **H-2** (`potDisplay` one-frame flash at winner state) — GENUINELY CLOSED via `aia-core-xc33`; T-012 AC-1 / AC-3 / AC-4 remain SATISFIED; Cycle 35 **H-1** mixed-sign split + reduced-motion sync completion preserved unchanged
- Still open carry-forward: Cycle 35 **M-1 / M-2 / M-3 / L-1 / L-2** — all remain as documented in Cycle 35 ledger; Cycle 36 **L-1 / L-2** (`potSweeps.ts` cosmetics) — both still open; plus all prior Cycle 32–34 items as documented in Cycle 35 ledger

### Cycle 38 — aia-core-z6w8 (T-014 PBR table materials, lighting, and env map, Scott review, 2026-04-21)

**Source:** [docs/agent/reviews/cycle-38-aia-core-z6w8-2026-04-21.md](../../docs/agent/reviews/cycle-38-aia-core-z6w8-2026-04-21.md)
**Source task:** aia-core-z6w8 — T-014 PBR table materials, lighting, and env map (feature; parent `aia-core-6o9t`; dependency T-004) — **CLOSED**

#### Summary

`aia-core-z6w8` implements T-014 by introducing a new `frontend/src/scenes3d/components/tableMaterials.ts` module that builds procedural `DataTexture` maps (felt normal, felt roughness, rail normal) lazily and caches them at module scope — **zero** added bundled asset bytes. `<Table>` consumes these as PBR felt (normal + roughness + `metalness=0.0` + `roughness=0.92`) and rail (coarse normal + `metalness=0.1` + `roughness=0.55` + distinct color) materials, and now accepts a `qualityTier` prop. `<PokerTable>` adds a named `<directionalLight name="key-light">` whose `castShadow` + `shadow-mapSize-*` props are gated to `qualityTier === 'high'`, plus a drei `<Environment preset="studio" background={false}>` gated off on `qualityTier === 'low'` with tier-specific `resolution` (Medium 64, High 256). 18 new tests land across 3 new files (`Table.test.tsx`, `tableMaterials.test.ts`, extended `PokerTable.test.tsx` "T-014 PBR lighting + env map" block); drei mocks extended with an `Environment` passthrough across 4 neighbor test files (no semantic change). Frontend suite 1872 → 1890 (+18); lint delta 0. All 4 ACs SATISFIED. Scott flagged **0 CRITICAL, 0 HIGH, 2 MEDIUM, 2 LOW**. **T-014 CLOSED. No beads filings this cycle per Anna contract** (MED/LOW → tasks.md only).

#### Filed Bug Cards

_None. 0 CRITICAL, 0 HIGH this cycle._

#### Rolled-forward findings (MEDIUM / LOW — not filed to beads)

1. **[MEDIUM] M-1 — Env-map resolutions drift from plan.md § "Quality Tiers & Performance Budget"**
   - **Location:** `frontend/src/scenes3d/PokerTable.tsx` (`<Environment resolution={...}>` gating)
   - **Category:** plan contract drift / downstream-tier config
   - **Description:** plan.md calls for **256² baked** on Medium and **drei `<Environment>` preset** on High. Implementation ships Medium → `resolution={64}` (4× smaller than plan) and High → `resolution={256}` (which matches what plan reserves for Medium). Functional today — both tiers remain low-res relative to a real HDRI — but T-027 (Zustand quality-tier slice) and T-038 (tier gating of every visual feature) will read these as canonical per-tier settings, so the drift will confuse downstream callers and the passing test locks in the drift.
   - **Recommended fix:** Medium → `resolution={256}`; High → drei preset without an explicit `resolution` override (drei defaults to 256 for preset-backed environments; `preset="studio"` already chosen). Relax the `≤ 128` test assertion to `≤ 256` to match plan. Owner: T-038.

2. **[MEDIUM] M-2 — Renderer shadow-map not enabled → `castShadow` at High tier is a dead signal today**
   - **Location:** `frontend/src/scenes3d/PokerCanvas.tsx` (no `shadows` prop on `<Canvas>`); `frontend/src/scenes3d/PokerTable.tsx` (key-light `castShadow={qualityTier === 'high'}`)
   - **Category:** runtime signal inert until canvas-level config lands
   - **Description:** Three.js requires `renderer.shadowMap.enabled = true` (or R3F's `<Canvas shadows>`) for any `castShadow` flag to produce visible shadows. Without that, AC-1's "responds to light direction" still works (diffuse shading is independent of shadow casting), but AC-4's "shadows disabled on Medium" guarantee passes **trivially** — shadows never render in any tier. Unit tests assert the *intent* (shadow-map props only emitted at High) which is still verifiable, so AC-4 coverage is contract-correct. plan.md § "Project Phases" places canvas-shadow enablement under quality-tier rollout (T-027 / T-038).
   - **Recommended fix:** enable `<Canvas shadows>` conditionally when `qualityTier === 'high'` so AC-4 shadow gating has runtime effect. Owner: T-038. No action this cycle.

3. **[LOW] L-1 — `<Environment background={false}>` is drei's default; explicit prop is redundant**
   - **Location:** `frontend/src/scenes3d/PokerTable.tsx` (`<Environment>` props)
   - **Category:** cosmetic / documentation-via-code
   - **Description:** drei's `<Environment>` defaults to `background={false}`. The explicit pass is harmless and makes intent readable, but it's not load-bearing.
   - **Recommended fix:** drop the prop or leave as an intent marker. Cosmetic.

4. **[LOW] L-2 — `getTableMaterialTextures()` called inline in `<Table>` render body without `useMemo`**
   - **Location:** `frontend/src/scenes3d/components/Table.tsx` (`getTableMaterialTextures()` call site)
   - **Category:** cosmetic / convention trace
   - **Description:** The module-level cache in `tableMaterials.ts` makes every call after the first an O(1) pointer read, so there is no performance hit. Future maintainers may assume a `useMemo` / `useRef` is required for renderer handles (consistent with other `scenes3d/components/` modules) and introduce one.
   - **Recommended fix:** add a one-line `useMemo(() => getTableMaterialTextures(), [])` guard for consistency, or add an inline `// cached at module scope` comment at the call site. Cosmetic.

#### Recommendation

**No beads filings this cycle** per Anna contract — all findings MEDIUM / LOW. **M-1** (env-map resolution drift) and **M-2** (canvas-level shadow enablement) are both structural hand-offs to T-038 (tier gating) and cluster naturally there; **M-1** should land alongside the T-027 quality-tier slice so the canonical per-tier values live in one place. **L-1** is a drop-or-keep cosmetic decision; **L-2** folds into the next `<Table>` touch. **T-014 is genuinely closed** — all 4 ACs SATISFIED, 18 new tests pin the PBR + lighting + env-map + tier-gating contract, zero bundled-asset footprint, zero regression (`playerMode` / `EquityBadge` / `potSweep` / `seatHighlights` / `theme` suites all green with mock-extension only).

#### Links

- Review artifact: [docs/agent/reviews/cycle-38-aia-core-z6w8-2026-04-21.md](../../docs/agent/reviews/cycle-38-aia-core-z6w8-2026-04-21.md)
- Prior cycle: [Cycle 37 — aia-core-xc33](#cycle-37--aia-core-xc33-h-2-potdisplay-one-frame-flash-at-winner-state-scott-review-2026-04-21)
- Filed to beads: _none this cycle_ (0 CRIT, 0 HIGH; MED/LOW → tasks.md only per Anna contract)
- Carry-forward targets: **M-1** — env-map resolution drift vs plan.md, owner T-038 (cluster with T-027 quality-tier slice); **M-2** — canvas-level `<Canvas shadows>` enablement, owner T-038; **L-1** — drop redundant `<Environment background={false}>` prop or keep as intent marker; **L-2** — `useMemo` / module-scope-cache comment on `getTableMaterialTextures()` call site
- Closed carry-forward: **T-014 CLOSED** — all 4 ACs SATISFIED (AC-1 felt PBR normal + roughness; AC-2 rail visually distinct across color/roughness/metalness/normal; AC-3 ≤ 500KB gzipped trivially met via zero added bundled assets; AC-4 Medium shadows-off + low-res env map — shadow gating is contract-correct, runtime enablement deferred to T-038 per M-2); T-027 (`aia-core-y39z`) dependency on T-014 now resolved
- Still open carry-forward: Cycle 35 **M-1 / M-2 / M-3 / L-1 / L-2** — all remain as documented in Cycle 35 ledger; Cycle 36 **L-1 / L-2** (`potSweeps.ts` cosmetics) — both still open; Cycle 37 **M-1** (T-011 chip-slide symmetric latent flash) / **M-2** (`potSweepInFlight` early-return) / **L-1** (`prevStateRef` comment) / **L-2** (Profiler reduced-motion mirror test) — all remain as documented in Cycle 37 ledger; plus all prior Cycle 32–34 items as documented in Cycle 35 ledger

### Cycle 39 — aia-core-y39z (T-027 Zustand quality-tier slice + tier mappings, Scott review, 2026-04-21)

**Source:** [docs/agent/reviews/cycle-39-aia-core-y39z-2026-04-21.md](../../docs/agent/reviews/cycle-39-aia-core-y39z-2026-04-21.md)
**Source task:** aia-core-y39z — T-027 Zustand quality-tier slice + tier mappings (feature; parent `aia-core-6o9t`; dependency T-014) — **CLOSED**

#### Summary

`aia-core-y39z` implements T-027 by adding a `qualityTier` + `manualOverride` slice to `useTableStore` with `setTier` / `setManualOverride` actions matching plan.md § "State Shape (Zustand Slices)" name-for-name and type-for-type. The canonical tier mapping lands in a new `frontend/src/scenes3d/state/qualitySettings.ts` module exporting `QUALITY_TIER_SETTINGS` (10 attributes × 3 tiers, every value matching plan.md § "Quality Tiers & Performance Budget" exactly), `QUALITY_TIER_NAMES`, `resolveDefaultQualityTier`, `nextLowerTier` / `nextHigherTier` helpers, `MOBILE_BREAKPOINT_PX`, `DEFAULT_QUALITY_TIER_DESKTOP` / `_MOBILE`, and supporting types. Initial `qualityTier` derives from `resolveDefaultQualityTier()` (reads `window.innerWidth`, threshold 768px). Persist envelope widened via `partialize` to include both new keys alongside existing `theme`. `frontend/src/scenes3d/index.ts` re-exports the full public surface. 19 new tests land across 2 new files (`qualitySettings.test.ts` 10 tests, `tableStore.quality.test.ts` 9 tests) covering canonical values, defaults, breakpoint logic, `window.innerWidth` fallback, tier-step helpers, slice shape, action mutation, persist roundtrip, partialize whitelist, and subscriber notification for AC-2. **Cycle 38 M-1 (env-map resolution drift vs plan.md) is now CLOSED at the canonical-data layer** — `qualitySettings.ts` encodes `medium.envMap = { mode: 'baked', resolution: 256 }` and `high.envMap = { mode: 'preset', resolution: null }` exactly per plan. Call-site literals in `PokerTable.tsx` / `CardAtlas.ts` remain unchanged per cycle contract and migrate in T-038 / `aia-core-t4dp`. Frontend suite 1890 → 1909 (+19); lint delta 0. AC-1 / AC-2 / AC-3 SATISFIED; AC-4 (settings-panel tier dropdown) DEFERRED with no open carrier. Scott flagged **0 CRITICAL, 0 HIGH, 1 MEDIUM, 2 LOW**. **T-027 CLOSED. No beads filings this cycle per Anna contract** (MED/LOW → tasks.md only).

#### Filed Bug Cards

_None. 0 CRITICAL, 0 HIGH this cycle._

#### Rolled-forward findings (MEDIUM / LOW — not filed to beads)

1. **[MEDIUM] M-1 — T-027 AC-4 (settings-panel tier dropdown) deferred with no open carrier**
   - **Location:** `frontend/src/scenes3d/components/TableSettingsPanel.tsx` (theme-only today; no quality-tier control)
   - **Category:** AC coverage gap / deferred scope without owner
   - **Description:** T-027 AC-4 calls for a settings-panel dropdown that drives `setTier` + flips `manualOverride=true`. The slice + actions land in this cycle, but no UI surface wires them — `TableSettingsPanel` still covers only the theme slice. Out of scope for T-027 per the cycle contract, but there is no downstream beads task scoped to add it: `aia-core-t4dp` (T-038 tier gating) is about propagating `qualityTier` into render code, and `aia-core-cas4` (T-028 FPS monitor) is about auto-downshift, not user-facing controls. Without an open carrier, AC-4 silently slips.
   - **Recommended fix:** Jean triage — either extend the T-038 scope to include a `TableSettingsPanel` tier dropdown alongside the read-site migration, or spin a new atomic task (`T-027b` / successor) scoped specifically to the UI control. Either lands alongside or immediately after T-038 / `aia-core-t4dp`.

2. **[LOW] L-1 — `QUALITY_TIER_SETTINGS` nested objects not deep-frozen**
   - **Location:** `frontend/src/scenes3d/state/qualitySettings.ts` (`QUALITY_TIER_SETTINGS` constant)
   - **Category:** cosmetic / immutability convention
   - **Description:** The top-level record is `as const`-asserted, but nested `shadows` / `envMap` objects are not deep-frozen, so consumers could theoretically mutate `QUALITY_TIER_SETTINGS.high.shadows.mapSize` at runtime and silently shift every consumer. Matches the existing theme-slice style (theme literals are likewise not deep-frozen), so strict-equivalence with current codebase.
   - **Recommended fix:** optional — add a `deepFreeze` pass at module load, or land a project-wide convention pass covering both theme and quality tables. Cosmetic; no behavior change.

3. **[LOW] L-2 — `PokerTable.tsx` / `CardAtlas.ts` still hold inline tier-derived literals (resolution drift not yet eliminated at call site)**
   - **Location:** `frontend/src/scenes3d/PokerTable.tsx` (`<Environment resolution={64 | 256}>` gating); `frontend/src/scenes3d/CardAtlas.ts` (tier-derived atlas sizing, if applicable)
   - **Category:** plan-vs-code drift at render call sites
   - **Description:** Cycle 38 **M-1** is closed at the canonical-data layer (`qualitySettings.ts` now holds plan-correct values), but the live render path in `PokerTable.tsx` still uses the old inline literals (`resolution={64}` on Medium, `resolution={256}` on High) — i.e. the runtime scene still ships the drift. Tests currently pin the inline values, so a future edit against the canonical mapping would regress without a signal. Explicitly deferred per cycle contract: call-site migration is T-038 / `aia-core-t4dp` scope.
   - **Recommended fix:** T-038 / `aia-core-t4dp` — replace inline tier literals in `PokerTable.tsx` and `CardAtlas.ts` with reads from `QUALITY_TIER_SETTINGS[tier]`, update pinning tests to read from the same source, retire the drift-locked-in assertions from Cycle 38. No action this cycle.

#### Recommendation

**No beads filings this cycle** per Anna contract — all findings MEDIUM / LOW. **M-1** is the substantive follow-up: AC-4 needs a Jean triage pass to assign a carrier (extend T-038 or spin a successor task) before the T-027 deferral silently slips. **L-1** is a cosmetic deep-freeze that clusters with a future immutability pass covering both theme and quality tables. **L-2** is explicit per-contract deferral to T-038 / `aia-core-t4dp` — the canonical data is now plan-correct, the call-site migration lands with the tier-gating work. **T-027 is genuinely closed** — slice API matches plan name-for-name, all 30 tier values pinned by test, Cycle 38 M-1 closed at the mapping layer, persist envelope correctly widened, zero lint delta, zero regression (all prior suites green). **Unblocks `aia-core-t4dp` (T-038) and `aia-core-cas4` (T-028).**

#### Links

- Review artifact: [docs/agent/reviews/cycle-39-aia-core-y39z-2026-04-21.md](../../docs/agent/reviews/cycle-39-aia-core-y39z-2026-04-21.md)
- Prior cycle: [Cycle 38 — aia-core-z6w8](#cycle-38--aia-core-z6w8-t-014-pbr-table-materials-lighting-and-env-map-scott-review-2026-04-21)
- Filed to beads: _none this cycle_ (0 CRIT, 0 HIGH; MED/LOW → tasks.md only per Anna contract)
- Carry-forward targets: **M-1** — T-027 AC-4 (settings-panel tier dropdown) deferred with no open carrier, needs Jean triage to extend T-038 or spin a successor; **L-1** — `QUALITY_TIER_SETTINGS` nested-object deep-freeze (optional, matches existing theme-slice style); **L-2** — `PokerTable.tsx` / `CardAtlas.ts` inline tier-derived literals (explicitly deferred to T-038 / `aia-core-t4dp`)
- Closed carry-forward: **T-027 CLOSED** — AC-1 / AC-2 / AC-3 SATISFIED (default high/medium by viewport; tier change re-renders via Zustand subscribe without reload; canonical mapping exported from single module); AC-4 explicitly DEFERRED (tracked under M-1). **Cycle 38 M-1 (env-map resolution drift vs plan.md) CLOSED at the canonical-data layer** — `qualitySettings.ts` values match plan.md exactly; call-site migration remains under T-038 / `aia-core-t4dp` per L-2. T-027 (`aia-core-y39z`) dependency on T-014 resolved; downstream `aia-core-t4dp` and `aia-core-cas4` unblocked.
- Still open carry-forward: Cycle 35 **M-1 / M-2 / M-3 / L-1 / L-2** — all remain as documented in Cycle 35 ledger; Cycle 36 **L-1 / L-2** (`potSweeps.ts` cosmetics) — both still open; Cycle 37 **M-1** (T-011 chip-slide symmetric latent flash) / **M-2** (`potSweepInFlight` early-return) / **L-1** (`prevStateRef` comment) / **L-2** (Profiler reduced-motion mirror test) — all remain as documented in Cycle 37 ledger; Cycle 38 **M-2** (canvas-level `<Canvas shadows>` enablement, owner T-038) / **L-1** (redundant `<Environment background={false}>`) / **L-2** (`useMemo` / module-cache comment on `getTableMaterialTextures()`) — all remain as documented in Cycle 38 ledger; plus all prior Cycle 32–34 items as documented in Cycle 35 ledger

### Cycle 43 — aia-core-auus (T-013 Showdown reveal + winning-hand glow, Scott review, 2026-04-21)

**Source:** [docs/agent/reviews/cycle-43-aia-core-auus-2026-04-21.md](../../docs/agent/reviews/cycle-43-aia-core-auus-2026-04-21.md)
**Source task:** aia-core-auus — T-013 Showdown reveal + winning-hand glow (feature; parent `aia-core-6o9t`) — **CLOSED**

#### Summary

`aia-core-auus` lands T-013 by adding a `<ShowdownGlows>` composer inside [frontend/src/scenes3d/components/SeatHighlight.tsx](../../frontend/src/scenes3d/components/SeatHighlight.tsx) that renders per-winner card outlines (2 per winner) plus a seat ring glow whenever `phase === 'showdown'` and the seat carries `result === 'won'`. A 3s fade-in / hold / fade-out envelope is driven by a pure `showdownGlowOpacity` helper; an `expiredKeyRef` guard prevents the timer-restart loop that would otherwise re-fire the envelope on every re-render once the 3s window closes. Glows auto-clear on timeout, on `handId` change, or on any phase transition away from `showdown`. Reduced-motion collapses the envelope to a constant peak opacity so the "glow appears" AC still fires without animation. Reveal semantics (AC-1 face-up on showdown / AC-4 muck never reveals) pass-through from the pre-existing `canSee()` gate in `<HoleCards>` and are verified at the scene integration level, not re-implemented. All 4 T-013 ACs SATISFIED. Frontend suite 1937 → 1963 (+26); lint delta 0. Scott flagged **0 CRITICAL, 0 HIGH, 2 MEDIUM, 2 LOW**. **No beads filings this cycle per Anna contract** (MED/LOW → tasks.md only). **This is the last open feature in the T-010 epic** — after close, only T-038-style carry-forwards remain.

#### Filed Bug Cards

_None. 0 CRITICAL, 0 HIGH this cycle._

#### Rolled-forward findings (MEDIUM / LOW — not filed to beads)

1. **[MEDIUM] M-1 — Quality-tier gating not wired for showdown glow**
   - **Location:** [frontend/src/scenes3d/state/qualitySettings.ts](../../frontend/src/scenes3d/state/qualitySettings.ts) (`QUALITY_TIER_SETTINGS` — no `showdownGlow` field); [frontend/src/scenes3d/components/SeatHighlight.tsx](../../frontend/src/scenes3d/components/SeatHighlight.tsx) (`<ShowdownGlows>` renders unconditionally across all tiers)
   - **Category:** plan-vs-implementation alignment / tier gating
   - **Description:** plan.md § Quality Tiers calls out "showdown glow: off on Low", but `QUALITY_TIER_SETTINGS` carries no `showdownGlow` field and `<ShowdownGlows>` does not consult the tier. On Low the glow still renders, at odds with the plan matrix.
   - **Recommended fix:** Extend `QualitySettings` / `QUALITY_TIER_SETTINGS` with `showdownGlow: boolean` (low=false, medium=true, high=true); gate `<ShowdownGlows>` on `QUALITY_TIER_SETTINGS[useTableStore(s => s.qualityTier)].showdownGlow`. Natural cluster with any future `qualitySettings` touch; no open carrier today.

2. **[MEDIUM] M-2 — `<ShowdownGlows>` uses static `seatAnchorLocalToWorld` rather than subscribing to `useDealTargetRegistry()`**
   - **Location:** [frontend/src/scenes3d/components/SeatHighlight.tsx](../../frontend/src/scenes3d/components/SeatHighlight.tsx) (`<ShowdownGlows>` anchor lookup)
   - **Category:** latent issue / future-feature interaction
   - **Description:** The composer resolves seat / card anchors via the static `seatAnchorLocalToWorld` helper. Today every anchor is deterministic from seat index, so the rendered outlines line up with the real card positions. When T-023 (replay scrubber) lands, anchors may be scrubbed / re-seated via `useDealTargetRegistry()`; the static helper would continue to render against the canonical layout while the actual cards move, producing a ghost glow. No current-build defect.
   - **Recommended fix:** When T-023 lands (or earlier if the deal registry becomes authoritative), migrate `<ShowdownGlows>` to subscribe to `useDealTargetRegistry()` for both the card outline and ring-glow anchors. Follow-up only; no carrier today.

3. **[LOW] L-1 — No ARIA announcement on hand resolve**
   - **Location:** [frontend/src/scenes3d/components/SeatHighlight.tsx](../../frontend/src/scenes3d/components/SeatHighlight.tsx) (`<ShowdownGlows>` — no `role="status"` / `aria-live` surface)
   - **Category:** accessibility / consistency
   - **Description:** Consistent with the rest of the T-018 family (action-status badge, pot sweep, etc.), the showdown glow is a visual-only surface with no live-region announcement. Screen-reader users get no signal when a hand resolves.
   - **Recommended fix:** Eventually cluster a single accessibility pass across the T-018 family that introduces an `aria-live="polite"` surface surfacing hand-resolve / action events. Not blocking; no open carrier.

4. **[LOW] L-2 — `SHOWDOWN_GLOW_COLOR` hard-coded cyan accent, not theme-slice driven**
   - **Location:** [frontend/src/scenes3d/components/SeatHighlight.tsx](../../frontend/src/scenes3d/components/SeatHighlight.tsx) (`SHOWDOWN_GLOW_COLOR` module constant)
   - **Category:** theming / cosmetic
   - **Description:** The glow colour is a module-level cyan literal, independent of the theme slice (`classic` / `modern` / `vintage`). Every theme shows the same cyan wash. Consistent with several other accent surfaces today (action badge, sweep highlight), so not a regression — but the "theme all active" intent from T-030 AC-5 would eventually expect this to flow from a theme token.
   - **Recommended fix:** When a theme-token pass lands for accent colours, migrate `SHOWDOWN_GLOW_COLOR` to a `theme.accent` lookup. Cosmetic; no open carrier.

#### Recommendation

**No beads filings this cycle** per Anna contract — all findings MEDIUM / LOW. **M-1** is the most substantive follow-up (plan says Low=off, runtime renders on Low); clusters with any `qualitySettings` touch. **M-2** is a latent issue only when T-023 replay scrubber lands. **L-1** and **L-2** are accessibility / theming follow-ups that cluster with broader passes. **`aia-core-auus` is genuinely closed** — all 4 T-013 ACs SATISFIED (AC-1 faces up on showdown; AC-2 winning cards + seat glow at result='won'; AC-3 3s envelope + auto-clear; AC-4 muck never reveals), reduced-motion fallback verified, `expiredKeyRef` guard prevents timer-restart pathology, zero lint delta, zero regression (1963 / 1963 green). **T-013 is the last open feature in the T-010 epic** — after this close, only T-038-style carry-forwards remain.

#### Links

- Review artifact: [docs/agent/reviews/cycle-43-aia-core-auus-2026-04-21.md](../../docs/agent/reviews/cycle-43-aia-core-auus-2026-04-21.md)
- Prior cycle: [Cycle 42 — aia-core-cas4](#cycle-42--aia-core-cas4-t-028-usefpsmonitor--auto-degrade-with-toast-scott-review-2026-04-21)
- Filed to beads: _None this cycle_
- Carry-forward targets: **M-1** — `QUALITY_TIER_SETTINGS.showdownGlow` gating (no open carrier, clusters with any future `qualitySettings` touch); **M-2** — `<ShowdownGlows>` anchor subscription to `useDealTargetRegistry()` (latent, activates when T-023 lands); **L-1** — ARIA live-region announcement on hand resolve, T-018 family accessibility pass (no open carrier); **L-2** — `SHOWDOWN_GLOW_COLOR` → `theme.accent` token migration (no open carrier)
- Closed carry-forward: **T-013 CLOSED** — all 4 ACs SATISFIED (AC-1 showdown reveal via `canSee()`; AC-2 winning cards + seat ring glow at `result='won'`; AC-3 3s fade-in/hold/fade-out envelope with auto-clear on timeout / `handId` change / phase exit; AC-4 muck never reveals). **T-013 is the final open feature in the T-010 epic** — remaining open work is limited to T-038-style carry-forwards (no new features).
- Still open carry-forward: Cycle 35 **M-1 / M-2 / M-3 / L-1 / L-2** — unchanged; Cycle 36 **L-1 / L-2** (`potSweeps.ts` cosmetics) — unchanged; Cycle 37 **M-1 / M-2 / L-1 / L-2** — unchanged; Cycle 38 **L-1** / **L-2** — unchanged; Cycle 39 **L-1** — unchanged; Cycle 40 **L-1** / **L-2** — unchanged; Cycle 41 **M-1** / **M-2** / **L-1** / **L-2** — unchanged; Cycle 42 **M-1** / **M-2** / **L-1** / **L-2** — unchanged; plus Cycle 43 **M-1** / **M-2** / **L-1** / **L-2** newly opened this cycle

---

### Cycle 42 — aia-core-cas4 (T-028 `useFPSMonitor` + auto-degrade with toast, Scott review, 2026-04-21)

**Source:** [docs/agent/reviews/cycle-42-aia-core-cas4-2026-04-21.md](../../docs/agent/reviews/cycle-42-aia-core-cas4-2026-04-21.md)
**Source task:** aia-core-cas4 — T-028 (feature; deps T-027) — **CLOSE PENDING**

#### Summary

`aia-core-cas4` lands the auto-degrade FPS monitor from plan.md § Quality Tiers. New / rewritten surfaces: **(1)** [useFPSMonitor.ts](../../frontend/src/scenes3d/state/useFPSMonitor.ts) — `useFPSMonitor()` hook + `<FPSMonitor />` zero-render R3F wrapper; 120-sample rolling window; 3000ms sustained-below-30fps threshold → `setTier(nextLowerTier(tier))`; downgrade-only; `manualOverride=true` halts all auto-degrade; never drops below `low` (silent no-op at the floor); **(2)** [tableStore.ts](../../frontend/src/scenes3d/state/tableStore.ts) grows a `tierToast: string | null` session-scoped slice + `setTierToast` / `dismissTierToast`; NOT added to `partialize` so it never round-trips through `localStorage`; **(3)** [QualityToast.tsx](../../frontend/src/scenes3d/components/QualityToast.tsx) — DOM-side `role="status"` pill with a `Dismiss` button wired to `dismissTierToast`; reads copy from the store, not hard-coded. `<FPSMonitor />` mounted in [PokerTable.tsx](../../frontend/src/scenes3d/PokerTable.tsx); `QualityToast` + hook constants re-exported from `scenes3d/index.ts`. 16 new tests across 3 files: 10 for the hook (all 6 ACs + hysteresis + no-upgrade + teardown), 3 for the toast component, 3 for the store slice. Frontend suite 1921 → 1937 (+16); lint delta 0. All 6 T-028 ACs SATISFIED at the code + state layer (AC-3 carries a MED — see below). **Recovery-gate flag** added beyond plan.md pseudocode: one `avg ≥ 30` frame must land between drops, closing a latent re-trigger hole where residual sub-30fps samples still in the rolling window would push the counter over 3000ms again within ~4 frames of a drop (the canonical AC-6 "120 @ 20fps → 120 @ 60fps = exactly one drop" sequence fails without it). Scott flagged **0 CRITICAL, 0 HIGH, 2 MEDIUM, 2 LOW**. **No beads filings this cycle per Anna contract** (MED/LOW → tasks.md only).

#### Filed Bug Cards

_None. 0 CRITICAL, 0 HIGH this cycle._

#### Rolled-forward findings (MEDIUM / LOW — not filed to beads)

1. **[MEDIUM] M-1 — `<QualityToast>` not yet mounted into any consumer route**
   - **Location:** [frontend/src/dealer/TableView3D.tsx](../../frontend/src/dealer/TableView3D.tsx), [frontend/src/views/PlaybackView.tsx](../../frontend/src/views/PlaybackView.tsx), [frontend/src/views/PlayerView.tsx](../../frontend/src/views/PlayerView.tsx) (per plan.md § Phase 6 consumer map)
   - **Category:** end-to-end completeness / AC-3 surface coverage
   - **Description:** `<QualityToast>` is exported from `scenes3d/index.ts` but no consumer renders it. The `<FPSMonitor />` side-effect runs and writes `tierToast`, but a live user on the current staging build would never see the notification — AC-3 ("Toast appears on tier change") is satisfied at the component + state layer but not at the end-user-visible layer. Not a regression; matches the Phase 6 sequencing where consumer-route migrations (T-030 / T-031 / T-032) are the designated mount sites.
   - **Recommended fix:** Mount `<QualityToast />` next to each `<PokerCanvas>` host as part of the consumer-route migrations (T-030 landed; T-031 / T-032 still open). Carry-forward: track against **T-031** and **T-032** or file a small standalone follow-up under epic `aia-core-6o9t` if a user-visible toast is wanted before those migrations land.

2. **[MEDIUM] M-2 — Rolling-window semantics: "2s rolling window" prose ≠ 120-sample implementation under low-fps regimes**
   - **Location:** [frontend/src/scenes3d/state/useFPSMonitor.ts](../../frontend/src/scenes3d/state/useFPSMonitor.ts) L59–L66; [plan.md](./plan.md) § Quality Tiers & Performance Budget
   - **Category:** spec-vs-implementation alignment
   - **Description:** plan.md prose says "2-second rolling window"; AC-1 pins "120 samples"; the pseudocode encodes the 120-sample variant. At a sustained 20fps the 120-sample window spans 6 real seconds of wall time, not 2. The implementation matches the pseudocode + AC-1 exactly, but the prose drift means two future readers can reach opposite interpretations. A strict 2-second wall-time window would require timestamp-keyed sample eviction (O(1) with a ring-buffer of `{fps, t}` pairs). Not a correctness defect — AC-6 still passes — but worth disambiguating in plan.md.
   - **Recommended fix:** Jean triage / plan.md clarification — add a sentence: "120 samples ≈ 2s at the 60fps target; at lower instantaneous fps the window spans proportionally more wall time." No code change. Alternatively, if the wall-time semantics is the intended behaviour, file a follow-up to switch to timestamped sample eviction.

3. **[LOW] L-1 — Hard-coded inline styles in `<QualityToast>`**
   - **Location:** [frontend/src/scenes3d/components/QualityToast.tsx](../../frontend/src/scenes3d/components/QualityToast.tsx) L18–L46
   - **Category:** style / duplication
   - **Description:** Inline `CSSProperties` literals duplicate the visual idiom of [ActiveHandDashboard.tsx](../../frontend/src/dealer/ActiveHandDashboard.tsx)'s `styles.toast` block (dark pill, white text, fixed bottom-centre). No shared toast-style token in the codebase yet, so this is consistent with existing dealer-surface conventions, but both surfaces will drift independently.
   - **Recommended fix:** When a third toast surface lands, extract a shared token. Not blocking.

4. **[LOW] L-2 — `awaitingRecovery` gate is hook-local, not a store field**
   - **Location:** [frontend/src/scenes3d/state/useFPSMonitor.ts](../../frontend/src/scenes3d/state/useFPSMonitor.ts) L58
   - **Category:** design / failure-mode documentation
   - **Description:** The recovery-gate flag is a `useRef` inside the hook. If a consumer ever mounts two `<FPSMonitor />` instances simultaneously (e.g. a migration accident inside `<SessionReplayShell>` + `<PlaybackView>`), each gets an independent recovery gate and could therefore race to drop the same tier twice. Not a bug today (only one `<FPSMonitor />` lives in the tree, mounted via `<PokerTable>`).
   - **Recommended fix:** None — documented in-file. Revisit only if a migration pattern ever mounts `<PokerTable>` more than once in the same React tree.

#### Recommendation

**No beads filings this cycle** per Anna contract — all findings MEDIUM / LOW. **M-1** is the most actionable — it's an end-to-end completeness gap that naturally clusters with the T-031 / T-032 consumer-route migrations; add a Scott-flagged todo to those tasks' AC checklists or file a small epic-scoped follow-up under `aia-core-6o9t` if staging visibility is wanted sooner. **M-2** is a plan.md prose-vs-pseudocode disambiguation, zero-code. **L-1** and **L-2** are cosmetic / documentation-only. **`aia-core-cas4` is ready to close** — all 6 T-028 ACs SATISFIED (AC-1 canonical constants exported; AC-2 3000ms-sustained verified; AC-3 canonical copy + dismiss + re-raise verified; AC-4 `manualOverride` end-to-end via T-027 settings-panel carrier; AC-5 floor no-op verified; AC-6 canonical 120→120 sequence verified with recovery-gate-guaranteed single drop), zero lint delta, zero regression (1937 / 1937 across 126 test files).

#### Links

- Review artifact: [docs/agent/reviews/cycle-42-aia-core-cas4-2026-04-21.md](../../docs/agent/reviews/cycle-42-aia-core-cas4-2026-04-21.md)
- Prior cycle: [Cycle 41 — aia-core-iz16](#cycle-41--aia-core-iz16-t-038-tier-gating-cleanup--settings-panel-tier-dropdown-scott-review-2026-04-21)
- Filed to beads: _None this cycle_
- Carry-forward targets: **M-1** — `<QualityToast>` mount into `TableView3D.tsx` / `PlaybackView.tsx` / `PlayerView.tsx`, natural cluster with T-031 / T-032; **M-2** — plan.md prose vs. 120-sample pseudocode disambiguation, Jean triage (no code); **L-1** — shared toast-style token if/when a third toast surface lands; **L-2** — `awaitingRecovery` as hook-local ref, documented failure mode only
- Closed carry-forward: _None this cycle._
- Still open carry-forward: Cycle 35 M-1 / M-2 / M-3 / L-1 / L-2 — unchanged; Cycle 36 L-1 / L-2 (`potSweeps.ts` cosmetics) — unchanged; Cycle 37 M-1 / M-2 / L-1 / L-2 — unchanged; Cycle 38 **L-1** / **L-2** — still ledger-only; Cycle 39 **L-1** — still ledger-only; Cycle 40 **L-1** / **L-2** — unchanged; Cycle 41 **M-1** / **M-2** / **L-1** / **L-2** — unchanged; plus Cycle 42 **M-1** / **M-2** / **L-1** / **L-2** newly opened this cycle

---

### Cycle 41 — aia-core-iz16 (T-038 tier gating cleanup + settings-panel tier dropdown, Scott review, 2026-04-21)

**Source:** [docs/agent/reviews/cycle-41-aia-core-iz16-2026-04-21.md](../../docs/agent/reviews/cycle-41-aia-core-iz16-2026-04-21.md)
**Source task:** aia-core-iz16 — T-038 (refactor; parent `aia-core-6o9t`; `discovered-from: aia-core-t4dp`; deps T-027 / T-030) — **CLOSED**

#### Summary

`aia-core-iz16` lands the three-item T-038 cleanup: **(1)** `<Canvas shadows>` is now runtime-enabled at `qualityTier === 'high'` via [PokerCanvas.tsx](../../frontend/src/scenes3d/PokerCanvas.tsx) reading `useTableStore` (closes Cycle 38 **M-2** at the renderer level — the T-014 `castShadow={qualityTier === 'high'}` intent now produces visible shadows, not just a dead prop); **(2)** every tier literal flagged in Cycle 39 **L-2** is migrated to `QUALITY_TIER_SETTINGS` reads — `<Environment resolution>` now reads `QUALITY_TIER_SETTINGS[tier].envMap.resolution` (Medium 64→256 drift retired at the call site, closing Cycle 38 **M-1** transitively), `getAtlasSize` returns `QUALITY_TIER_SETTINGS[tier].cardAtlasResolution`, key-light shadow-map dims read from `QUALITY_TIER_SETTINGS.high.shadows.mapSize`, env-map presence gate uses `settings.envMap.mode !== 'none'`, `Table.tsx` `mapsEnabled` derives from `settings.pbr !== 'lambert'`; **(3)** [TableSettingsPanel.tsx](../../frontend/src/scenes3d/components/TableSettingsPanel.tsx) grows a tier radiogroup (low / medium / high) wired to `setTier` + `setManualOverride(true)` — **T-027 AC-4 now SATISFIED** with a landed carrier. Surgical diff across 5 source files + 4 test files; 12 new / reworked tests; 2 Cycle-38 drift-locked assertions retired in [PokerTable.test.tsx](../../frontend/test/scenes3d/PokerTable.test.tsx) AC-4 block. Frontend suite 1909 → 1921 (+12); lint delta 0. All 4 T-038 ACs SATISFIED. Scott flagged **0 CRITICAL, 0 HIGH, 2 MEDIUM, 2 LOW**. **No beads filings this cycle per Anna contract** (MED/LOW → tasks.md only).

#### Filed Bug Cards

_None. 0 CRITICAL, 0 HIGH this cycle._

#### Rolled-forward findings (MEDIUM / LOW — not filed to beads)

1. **[MEDIUM] M-1 — `<Environment preset>` name still tier-literal on PokerTable call site**
   - **Location:** [frontend/src/scenes3d/PokerTable.tsx](../../frontend/src/scenes3d/PokerTable.tsx) L491 (`preset={qualityTier === 'high' ? 'studio' : 'apartment'}`)
   - **Category:** design / data-locality
   - **Description:** `QUALITY_TIER_SETTINGS[tier].envMap.mode` encodes `'baked' | 'preset'` but NOT the specific drei preset name, so the mapping `high → 'studio'`, `medium → 'apartment'` is invisible to downstream callers. Not flagged in the original Cycle 39 L-2 (which targeted `resolution` only), so strictly outside this cycle's scope — but it is the last tier-derived literal on this call site and a natural cluster-point for "every tier value flows from qualitySettings."
   - **Recommended fix:** Extend `EnvMapSettings` with optional `presetName?: 'studio' | 'apartment' | ...`; migrate `PokerTable.tsx` to read it; update plan.md § Quality Tiers table. Defer to the next `qualitySettings` touch.

2. **[MEDIUM] M-2 — `castShadow` + shadow-map emission diverges from canonical `settings.medium.shadows.enabled=true`**
   - **Location:** [frontend/src/scenes3d/PokerTable.tsx](../../frontend/src/scenes3d/PokerTable.tsx) L505–L513 (`castShadow={qualityTier === 'high'}` + `{...(qualityTier === 'high' ? { 'shadow-mapSize-width': ..., ... } : {})}`)
   - **Category:** canonical-vs-runtime divergence
   - **Description:** `QUALITY_TIER_SETTINGS.medium.shadows.enabled === true` (512² per plan.md), but the runtime emits shadow-map props only at `qualityTier === 'high'`. T-014 chose this conservative runtime and [PokerTable.test.tsx](../../frontend/test/scenes3d/PokerTable.test.tsx) AC-4 medium-shadows-off pins it. Task constraint "Do NOT change tier values" kept the divergence this cycle — but this is now the only remaining tier literal driving behaviour that disagrees with `qualitySettings`, and future readers will expect `settings.shadows.enabled` to be the single source of truth.
   - **Recommended fix:** Jean triage. Either (a) update the runtime to honour `settings.shadows.enabled` + relax the T-014 medium-shadows-off test, or (b) update plan.md + `qualitySettings.ts` to reflect the implementation (Medium shadows-off). Plan-vs-implementation alignment, not pure cleanup.

3. **[LOW] L-1 — Pre-existing unused `eslint-disable` in PokerCanvas.test.tsx**
   - **Location:** [frontend/test/scenes3d/PokerCanvas.test.tsx](../../frontend/test/scenes3d/PokerCanvas.test.tsx) L21
   - **Category:** style
   - **Description:** Unused `eslint-disable` directive predates this cycle; not introduced by the T-038 edits. Surfaces under `npx eslint` as a warning.
   - **Recommended fix:** Drop on next file touch.

4. **[LOW] L-2 — `handleTierSelect` allocates inline arrow per tier button**
   - **Location:** [frontend/src/scenes3d/components/TableSettingsPanel.tsx](../../frontend/src/scenes3d/components/TableSettingsPanel.tsx) L~150 (`onClick={() => handleTierSelect(tier)}`)
   - **Category:** micro-perf / convention
   - **Description:** Three arrows allocated per render (one per tier). Harmless; matches the existing felt / card-back / mode pattern (same inline-arrow idiom). Flagged only for completeness — changing the tier group would introduce inconsistency with the rest of the panel.
   - **Recommended fix:** None — match the existing idiom.

#### Recommendation

**No beads filings this cycle** per Anna contract — all findings MEDIUM / LOW. **M-1** is a structural follow-up that extends the canonical mapping one field further (preset name); **M-2** is a plan-vs-implementation alignment item that requires a Jean triage decision (flip runtime to match plan, or flip plan to match runtime) — both cluster naturally at the next `qualitySettings` / T-014 touch and neither blocks T-038's cleanup ACs. **L-1** is pre-existing; **L-2** is cosmetic consistency. **`aia-core-iz16` is genuinely closed** — all 4 T-038 ACs SATISFIED (AC-1 canvas shadows runtime-enabled at High; AC-2 every Cycle-39-L-2-flagged literal migrated; AC-3 tier dropdown wired to `setTier` + `setManualOverride(true)`, T-027 AC-4 now has a landed carrier; AC-4 full suite green), Cycle 38 **M-1** and **M-2** CLOSED, Cycle 39 **L-2** and **M-1** CLOSED, zero lint delta, zero regression across T-014 / T-027 / T-030 / theme / persistence suites (1921 / 1921 green across 123 test files).

#### Links

- Review artifact: [docs/agent/reviews/cycle-41-aia-core-iz16-2026-04-21.md](../../docs/agent/reviews/cycle-41-aia-core-iz16-2026-04-21.md)
- Prior cycle: [Cycle 40 — aia-core-t4dp](#cycle-40--aia-core-t4dp-h-1b-qualitytier-wiring-scott-review-2026-04-21)
- Filed to beads: _None this cycle_
- Carry-forward targets: **M-1** — `<Environment preset>` name → `QUALITY_TIER_SETTINGS.envMap.presetName` migration (no open carrier); **M-2** — `castShadow` / shadow-map canonical-vs-runtime alignment, needs Jean triage (no open carrier); **L-1** — pre-existing unused `eslint-disable` in `PokerCanvas.test.tsx` (cosmetic); **L-2** — inline-arrow allocation in `TableSettingsPanel` tier group (cosmetic, matches existing idiom)
- Closed carry-forward: **`aia-core-iz16` CLOSED** — all 4 T-038 ACs SATISFIED (AC-1 canvas shadows runtime-effective at High, AC-2 Cycle 39 L-2 literals fully migrated, AC-3 tier dropdown lands T-027 AC-4, AC-4 full suite green); **Cycle 38 M-1** (env-map 64→256 drift) CLOSED at call site; **Cycle 38 M-2** (canvas shadows) CLOSED at renderer; **Cycle 39 L-2** (inline tier literals in `PokerTable.tsx` / `CardAtlas.ts`) CLOSED; **Cycle 39 M-1** (`TableSettingsPanel` tier dropdown / T-027 AC-4 deferral) CLOSED via landed carrier
- Still open carry-forward: Cycle 35 M-1 / M-2 / M-3 / L-1 / L-2 — unchanged; Cycle 36 L-1 / L-2 (`potSweeps.ts` cosmetics) — unchanged; Cycle 37 M-1 / M-2 / L-1 / L-2 — unchanged; Cycle 38 **L-1** (`<Environment background={false}>`) / **L-2** (`useMemo` on `getTableMaterialTextures()`) — still ledger-only; Cycle 39 **L-1** (deep-freeze `QUALITY_TIER_SETTINGS`) — still ledger-only; Cycle 40 **L-1** (`useShallow` consolidation in `TableView3D.tsx`) / **L-2** (baseline-diff guard in new `aia-core-t4dp` test block) — both unchanged; plus Cycle 41 **M-1** / **M-2** / **L-1** / **L-2** newly opened this cycle

---

### Cycle 40 — aia-core-t4dp (H-1(b) qualityTier wiring, Scott review, 2026-04-21)

**Source:** [docs/agent/reviews/cycle-40-aia-core-t4dp-2026-04-21.md](../../docs/agent/reviews/cycle-40-aia-core-t4dp-2026-04-21.md)
**Source task:** aia-core-t4dp — H-1(b) qualityTier half of Cycle 32 H-1 split (bug; parent `aia-core-6o9t`; `blocked-by: aia-core-y39z` resolved) — **CLOSED**

#### Summary

`aia-core-t4dp` closes the qualityTier half of the Cycle 32 H-1 split by wiring `useTableStore((s) => s.qualityTier)` through `TableView3D.tsx` into `<PokerTable qualityTier={qualityTier}>` — paired with the already-closed `aia-core-r11d` (theme half), both dimensions of **T-030 AC-5 "theme all active"** now flow store → dealer embed. Surgical diff: 1 selector + 1 prop on [frontend/src/dealer/TableView3D.tsx](../../frontend/src/dealer/TableView3D.tsx), 3 new prop-threading tests in [frontend/test/dealer/TableView3D.test.tsx](../../frontend/test/dealer/TableView3D.test.tsx) covering `high` / `low` / `medium`. Frontend suite 1909 → 1912 (+3); lint delta 0. **All 4 ACs SATISFIED. Cycle 32 H-1 is FULLY RESOLVED** — both halves (theme via `aia-core-r11d`, qualityTier via `aia-core-t4dp`) landed. Scott flagged **0 CRITICAL, 0 HIGH, 1 MEDIUM, 2 LOW**. **T-027 AC-4 remains deferred but now has an open carrier** (newly filed `T-038` beads task — see M-1 outcome below). **No beads filings for MED/LOW this cycle** per Anna contract.

#### Filed Bug Cards

_None. 0 CRITICAL, 0 HIGH this cycle._

#### Rolled-forward findings (MEDIUM / LOW — not filed to beads)

1. **[MEDIUM] M-1 — T-038 carrier gap (addressed this cycle via Jean triage)**
   - **Location:** cross-cutting — `specs/table-3d-revamp-010/tasks.md` ledger rows (Cycle 38 M-2, Cycle 39 L-2, Cycle 39 M-1) that named "T-038 / `aia-core-t4dp`" as owner
   - **Category:** design / ownership ambiguity
   - **Description:** Prior cycles routed three carry-forwards to "T-038 / `aia-core-t4dp`" — (1) canvas-level `<Canvas shadows>` enablement, (2) `PokerTable.tsx` / `CardAtlas.ts` inline tier-literal migration, (3) `TableSettingsPanel` tier dropdown (T-027 AC-4). The `aia-core-t4dp` description was narrowly scoped to route-level store → props forwarding only; closing it without a successor would have left the other three orphaned.
   - **Outcome this cycle:** Jean triage created a minimal **T-038** section in `tasks.md` (above, before `## Bugs / Findings`) covering all three work items, and Logan filed it as a fresh beads task. Carry-forward ownership is now explicit and traceable. (See Still-open / Carry-forward targets below for the new beads ID.)

2. **[LOW] L-1 — `theme` + `qualityTier` selectors could consolidate via `useShallow`**
   - **Location:** [frontend/src/dealer/TableView3D.tsx](../../frontend/src/dealer/TableView3D.tsx) (L44–L45)
   - **Category:** convention / cosmetic
   - **Description:** Two separate `useTableStore` calls produce two subscriptions. A single `useShallow`-wrapped selector returning `{ theme, qualityTier }` would consolidate them, matching Zustand's own docs recommendation for related fields. Zero runtime impact today.
   - **Recommended fix:** not this cycle. If ever touched, use `useShallow` from `zustand/react/shallow`. Cosmetic only.

3. **[LOW] L-2 — Symmetric-positive 3-tier coverage; could add baseline-diff guard**
   - **Location:** [frontend/test/dealer/TableView3D.test.tsx](../../frontend/test/dealer/TableView3D.test.tsx) (L417–L448, the new `aia-core-t4dp` describe block)
   - **Category:** test-hygiene
   - **Description:** The 3 new tests each set a tier and observe the same tier on props. They don't actively verify the selector is reading from the store (vs. being hardcoded to a default). Because the `low` fixture differs from happy-dom's default (`high`), the 3-tier coverage triangulates the wiring at defense-in-depth level, so this is not a coverage gap — just a hygiene tightening opportunity.
   - **Recommended fix:** optional baseline-diff guard (read `useTableStore.getState().qualityTier` as baseline, pick a different tier, assert prop reflects the difference). Defense-in-depth only.

#### Recommendation

**No beads filings this cycle** per Anna contract — all findings MEDIUM / LOW. **M-1** is resolved this cycle via Jean triage (T-038 now exists in tasks.md and in beads; three Cycle 38/39 carry-forwards now have an explicit owner). **L-1** is a cosmetic consolidation clustering with any future `TableView3D` selector-layer touch. **L-2** is a defense-in-depth test hygiene upgrade that does not currently leave a gap. **`aia-core-t4dp` is genuinely closed** — all 4 ACs SATISFIED, 3 new tests pin store → props wiring at `high` / `low` / `medium`, zero lint delta, zero regression (all prior TableView3D describe blocks plus full 1912-test suite green). **Cycle 32 H-1 is FULLY RESOLVED** — both halves (theme via `aia-core-r11d`, qualityTier via `aia-core-t4dp`) now closed; T-030 AC-5 "theme all active" SATISFIED across both dimensions.

#### Links

- Review artifact: [docs/agent/reviews/cycle-40-aia-core-t4dp-2026-04-21.md](../../docs/agent/reviews/cycle-40-aia-core-t4dp-2026-04-21.md)
- Prior cycle: [Cycle 39 — aia-core-y39z](#cycle-39--aia-core-y39z-t-027-zustand-quality-tier-slice--tier-mappings-scott-review-2026-04-21)
- Filed to beads: **T-038** (new) — tier gating cleanup + settings-panel tier dropdown — P2 task, parent `aia-core-6o9t`, `discovered-from: aia-core-t4dp`; ID recorded inline with the T-038 section above and in the Still-open carry-forward entry below
- Carry-forward targets: **L-1** — `theme` + `qualityTier` selector `useShallow` consolidation (cosmetic, no open carrier); **L-2** — baseline-diff guard in new `aia-core-t4dp` test block (test-hygiene, no open carrier)
- Closed carry-forward: **`aia-core-t4dp` CLOSED** — all 4 ACs SATISFIED (AC-1 T-030 AC-5 "theme all active" qualityTier dim; AC-2 Cycle 32 H-1 fully resolved; AC-3 store tier changes reflected in embed; AC-4 new `TableView3D.test.tsx` assertions; AC-5 full suite green). **Cycle 32 H-1 FULLY RESOLVED** (both halves landed). **Cycle 38 M-2, Cycle 39 L-2, Cycle 39 M-1** carrier gap CLOSED via **new T-038 beads task** (see Filed to beads above); the underlying work items remain open **in T-038**, not as orphaned ledger rows.
- Still open carry-forward: Cycle 35 **M-1 / M-2 / M-3 / L-1 / L-2** — all remain as documented in Cycle 35 ledger; Cycle 36 **L-1 / L-2** (`potSweeps.ts` cosmetics) — both still open; Cycle 37 **M-1 / M-2 / L-1 / L-2** — all remain as documented in Cycle 37 ledger; Cycle 38 **M-2** (canvas `<Canvas shadows>`) / **L-1** (redundant `<Environment background={false}>`) / **L-2** (`useMemo` on `getTableMaterialTextures()`) — M-2 now carried by **T-038**; L-1 / L-2 remain as cosmetic ledger-only items; Cycle 39 **M-1** (`TableSettingsPanel` tier dropdown) / **L-1** (deep-freeze `QUALITY_TIER_SETTINGS`) / **L-2** (`PokerTable.tsx` / `CardAtlas.ts` inline tier literals) — M-1 and L-2 now carried by **T-038**; L-1 remains ledger-only; plus all prior Cycle 32–34 items as documented in Cycle 35 ledger


---

### Cycle 44 — aia-core-uja6 (T-023b `<SessionReplayShell>` cross-hand timeline, Scott review, 2026-04-21)

**Source:** [docs/agent/reviews/cycle-44-aia-core-uja6-2026-04-21.md](../../docs/agent/reviews/cycle-44-aia-core-uja6-2026-04-21.md)
**Source task:** aia-core-uja6 — T-023b `<SessionReplayShell>` cross-hand timeline + speed controls (feature; deps T-023) — **CLOSED**

#### Summary

`aia-core-uja6` replaces the T-023b stub with the full [frontend/src/scenes3d/SessionReplayShell.tsx](../../frontend/src/scenes3d/SessionReplayShell.tsx) implementation: a cross-hand timeline that drives the Zustand `replay` slice (`handIndex` / `streetIndex` / `isPlaying` / `speed`) and auto-advances via a single `useEffect` state machine — **1500/speed ms per street**, **1000/speed ms inter-hand pause**, halt at last hand. Reuses pre-existing `<SessionScrubber>` (AC-1) and `handsToTableState` (AC-5 context propagation). Exports a new `phaseFromStreetIndex` helper (inverse of `streetIndexFromPhase`) — **closes Cycle 23 LOW-4** so T-030 / T-031 downstream consumers no longer need to reinvent it. All playback-only; dev-only `console.warn` fires when mounted from any route other than `#/playback` (AC-6). ACs 1 / 2 / 3 / 4 / 6 / 7 **SATISFIED**; **AC-5 PARTIAL** — context propagation proven at unit level, E2E driver cancellation relies on pre-existing `handId` keying inside `<PokerTable>` and is deferred to T-031 wire-up. Frontend suite **1963 → 1977 (+14)**; lint delta 0. Scott flagged **0 CRITICAL, 0 HIGH, 2 MEDIUM, 3 LOW**. **No beads filings this cycle per Anna contract** (MED/LOW → tasks.md only).

#### Filed Bug Cards

_None. 0 CRITICAL, 0 HIGH this cycle._

#### Rolled-forward findings (MEDIUM / LOW — not filed to beads)

1. **[MEDIUM] M-1 — Cycle 23 MED-1 (4× speed = 375ms < `CHIP_SLIDE_DURATION_MS` 400ms) re-surfaces in `<SessionReplayShell>`; no runtime guard**
   - **Location:** [frontend/src/scenes3d/SessionReplayShell.tsx](../../frontend/src/scenes3d/SessionReplayShell.tsx) (speed selector → 1500/speed auto-advance cadence); downstream chip-slide animations in `<PokerTable>` (`CHIP_SLIDE_DURATION_MS` 400ms)
   - **Category:** timing / latent cross-cycle carry-forward
   - **Description:** Cycle 23 MED-1 identified that at 4× speed the per-street cadence (1500/4 = 375ms) undercuts the chip-slide duration (400ms), so chip animations would clip during replay. The hand-scrubber alone never exercised this path — it was a latent issue. `<SessionReplayShell>` now actively emits 375ms cadence at 4× across entire sessions. No runtime guard (e.g. clamp speed to `max(speed, CHIP_SLIDE_DURATION_MS / PER_STREET_BASE_MS)`, or lengthen the cadence) is present.
   - **Recommended fix:** Decide — (a) clamp max speed so cadence ≥ `CHIP_SLIDE_DURATION_MS`; (b) raise `PER_STREET_BASE_MS` floor at higher speeds; or (c) accept the clip and document it. **Hard pre-gate for T-031** (first consumer to drive both surfaces together) — resolve before `<SessionReplayShell>` lands in `<PlaybackView>`. Not T-023b-internal.

2. **[MEDIUM] M-2 — AC-5 hand-change tween cancellation has no integration-level test**
   - **Location:** [frontend/src/scenes3d/SessionReplayShell.tsx](../../frontend/src/scenes3d/SessionReplayShell.tsx) (hand-change branch in auto-advance `useEffect`); [frontend/src/scenes3d/PokerTable.tsx](../../frontend/src/scenes3d/PokerTable.tsx) (existing `handId` keying on animated subtrees)
   - **Category:** test coverage / defense-in-depth
   - **Description:** AC-5 ("any in-flight tweens for the prior hand are cancelled on hand change") is exercised only at the context-propagation layer — unit tests prove the `handId` reaching `<PokerTable>` changes when the shell advances. The actual tween-cancellation path depends on pre-existing `handId` keying inside `<PokerTable>` children (remount-on-key semantics); there is no integration test that runs a real tween, triggers a hand change, and asserts the tween is interrupted. The mechanism exists and is covered structurally, but an end-to-end assertion is deferred.
   - **Recommended fix:** Add integration test inside T-031 wire-up that starts a chip slide / card deal animation mid-street, triggers a hand-change via `<SessionReplayShell>`, asserts all active tween refs cleared / unmounted. Deferred to T-031 per plan.md. No open carrier distinct from T-031.

3. **[LOW] L-1 — AC-6 dev-only off-route `console.warn` has no test**
   - **Location:** [frontend/src/scenes3d/SessionReplayShell.tsx](../../frontend/src/scenes3d/SessionReplayShell.tsx) (dev-only `if (import.meta.env.DEV) { if (hash !== '#/playback') console.warn(...) }`)
   - **Category:** test coverage / cosmetic
   - **Description:** The off-route dev-warn exists in source but no test asserts it fires on a non-playback route and stays silent on `#/playback`. ~10 lines with `vi.stubEnv('DEV', true)` + `vi.spyOn(console, 'warn')`.
   - **Recommended fix:** Optional; cluster with T-031 integration test suite. No open carrier.

4. **[LOW] L-2 — Scrub does not auto-pause while playing**
   - **Location:** [frontend/src/scenes3d/SessionReplayShell.tsx](../../frontend/src/scenes3d/SessionReplayShell.tsx) (scrub handler sets `handIndex` / `streetIndex` without toggling `isPlaying`)
   - **Category:** UX / convention
   - **Description:** Scrubbing while `isPlaying === true` lets the auto-advance timer continue to race the user's scrub input. Matches the pre-existing `<HandScrubberPanel>` behaviour (same idiom), so not a regression — but a small UX improvement would auto-pause on scrub.
   - **Recommended fix:** Optional UX tightening in T-031 (or an isolated polish pass) — call `setIsPlaying(false)` from the scrub handler. No open carrier.

5. **[LOW] L-3 — `game` prop on `<SessionReplayShell>` extends plan.md § Public API**
   - **Location:** [frontend/src/scenes3d/SessionReplayShell.tsx](../../frontend/src/scenes3d/SessionReplayShell.tsx) (public API signature); [specs/table-3d-revamp-010/plan.md](../../specs/table-3d-revamp-010/plan.md) § Public API
   - **Category:** plan-vs-implementation drift / documentation
   - **Description:** plan.md § Public API documents `<SessionReplayShell gameId hands initialHandIndex initialSpeed>`. Implementation adds a `game` prop (used by `handsToTableState` for seat mapping / blinds context). Harmless extension; plan.md needs a trailing amendment.
   - **Recommended fix:** Amend plan.md § Public API to include `game` in the canonical signature; note it as required for seat / blinds context propagation. Jean follow-up, ~3 lines.

#### Recommendation

**No beads filings this cycle** per Anna contract — all findings MEDIUM / LOW. **M-1** is the only substantive cross-cycle item: Cycle 23 MED-1 has finally been promoted from "latent in scrubber-only" to "hot path in replay shell", and must be resolved as a **hard pre-gate for T-031** before `<SessionReplayShell>` mounts inside `<PlaybackView>`. **M-2** is a coverage tightening that naturally belongs in T-031 (where the full driver stack lands). **L-1** / **L-2** / **L-3** are cosmetic / test-hygiene / doc-amendment follow-ups. **`aia-core-uja6` is genuinely closed** — ACs 1 / 2 / 3 / 4 / 6 / 7 SATISFIED, AC-5 PARTIAL (propagation proven; E2E cancellation deferred to T-031 where the driver lives), `phaseFromStreetIndex` helper landed (closes Cycle 23 LOW-4), suite 1977 / 1977 green, lint delta 0.

#### Links

- Review artifact: [docs/agent/reviews/cycle-44-aia-core-uja6-2026-04-21.md](../../docs/agent/reviews/cycle-44-aia-core-uja6-2026-04-21.md)
- Prior cycle: [Cycle 43 — aia-core-auus](#cycle-43--aia-core-auus-t-013-showdown-reveal--winning-hand-glow-scott-review-2026-04-21)
- Filed to beads: _None this cycle_
- Carry-forward targets: **M-1** — Cycle 23 MED-1 speed-vs-chip-slide clamp, **hard pre-gate for T-031** (no new open carrier; folds into T-031 `aia-core-bl5v`); **M-2** — AC-5 hand-change tween-cancellation integration test, deferred to T-031; **L-1** — AC-6 dev-warn test coverage (cluster with T-031 suite); **L-2** — auto-pause on scrub UX tightening (cluster with T-031); **L-3** — plan.md § Public API amendment to include `game` prop (Jean follow-up)
- Closed carry-forward: **`aia-core-uja6` CLOSED** — ACs 1 / 2 / 3 / 4 / 6 / 7 SATISFIED, AC-5 PARTIAL (propagation verified; E2E driver cancellation deferred to T-031 where the driver-integration tests live); **T-023b CLOSED**; **Cycle 23 LOW-4** (missing `phaseFromStreetIndex` inverse helper) **CLOSED** — helper landed and exported from `SessionReplayShell.tsx`, available to T-030 / T-031 downstream consumers without reinvention
- Still open carry-forward: Cycle 23 **MED-1** now consolidated into Cycle 44 **M-1** (hard pre-gate for T-031); Cycle 35 **M-1 / M-2 / M-3 / L-1 / L-2** — unchanged; Cycle 36 **L-1 / L-2** — unchanged; Cycle 37 **M-1 / M-2 / L-1 / L-2** — unchanged; Cycle 38 **L-1 / L-2** — unchanged; Cycle 39 **L-1** — unchanged; Cycle 40 **L-1 / L-2** — unchanged; Cycle 41 **M-1 / M-2 / L-1 / L-2** — unchanged; Cycle 42 **M-1 / M-2 / L-1 / L-2** — unchanged; Cycle 43 **M-1 / M-2 / L-1 / L-2** — unchanged; plus Cycle 44 **M-1 / M-2 / L-1 / L-2 / L-3** newly opened this cycle

### Cycle 45 — aia-core-bl5v (T-031 `<PlaybackView>` migration to declarative 3D stack, Scott review, 2026-04-21)

**Source:** [docs/agent/reviews/cycle-45-aia-core-bl5v-2026-04-21.md](../../docs/agent/reviews/cycle-45-aia-core-bl5v-2026-04-21.md)
**Source task:** aia-core-bl5v — T-031 `<PlaybackView>` migration to `<SessionReplayShell>` + `<PokerCanvas><PokerTable>` (feature; deps T-023b, T-030) — **CLOSED**

#### Summary

`aia-core-bl5v` rewrites [frontend/src/views/PlaybackView.tsx](../../frontend/src/views/PlaybackView.tsx) from **414 → 126 lines**, replacing the legacy `pokerScene` / direct Three.js imports + client-side `calculateEquity` wiring with the declarative `<SessionReplayShell>` + `<PokerCanvas><PokerTable viewer="spectator" equityOverlay>` stack landed in Cycles 44 / prior. `<QualityToast>` is mounted at route root — **closes Cycle 42 M-1 for the playback route** (one of three carrier routes flagged in Cycle 42). The Cycle 44 hard pre-gate (**M-1** — 4× speed 375ms < `CHIP_SLIDE_DURATION_MS` 400ms) is resolved upstream in [frontend/src/scenes3d/SessionReplayShell.tsx](../../frontend/src/scenes3d/SessionReplayShell.tsx) via `const ms = Math.max(CHIP_SLIDE_DURATION_MS, MS_PER_STREET / speed)`, which clamps 375 → 400ms — pinned by 2 new pre-gate tests. 15 new `<PlaybackView>` tests cover composition, prop threading, polling, back-nav, and the absence of legacy `pokerScene` / Three.js imports. Frontend suite lands **1970 / 1970 green**; lint delta 0. All ACs **SATISFIED**. Scott flagged **0 CRITICAL, 0 HIGH, 2 MEDIUM, 3 LOW**. **No beads filings this cycle per Anna contract** (MED/LOW → tasks.md only).

#### Filed Bug Cards

_None. 0 CRITICAL, 0 HIGH this cycle._

#### Rolled-forward findings (MEDIUM / LOW — not filed to beads)

1. **[MEDIUM] M-1 — `<PresetToolbar>` / `<TableSettingsPanel>` not wired into `<PlaybackView>`**
   - **Location:** [frontend/src/views/PlaybackView.tsx](../../frontend/src/views/PlaybackView.tsx) (route root composition)
   - **Category:** scope / plan-vs-implementation question
   - **Description:** The canonical 3D-revamp shell includes `<PresetToolbar>` and `<TableSettingsPanel>` as sibling chrome alongside `<PokerCanvas>`. `<PlaybackView>` omits both. May be intentional — a playback / spectator surface does not obviously need the live settings / preset controls — but plan.md does not explicitly carve it out.
   - **Recommended fix:** Confirm with Jean / plan.md whether playback should retain or omit these controls. If omit, annotate plan.md § Public API / § Routes. If retain, small follow-up to add them. No open carrier; decision needed before any dependent playback polish.

2. **[MEDIUM] M-2 — Polling test robustness: 4× `advanceTimersByTimeAsync(0)` flushes**
   - **Location:** [frontend/src/views/PlaybackView.test.tsx](../../frontend/src/views/PlaybackView.test.tsx) (polling test block)
   - **Category:** test hygiene / flakiness risk
   - **Description:** The polling assertion uses four back-to-back `vi.advanceTimersByTimeAsync(0)` flushes to drain the microtask / macrotask queue between poll ticks. Works deterministically today but is brittle to upstream `useHandPolling` scheduling changes (additional `await` or `Promise.resolve` inserts silently break it).
   - **Recommended fix:** Replace the 4×-flush idiom with an explicit `waitFor(() => expect(...).toHaveBeenCalledTimes(n))` keyed on observable mock call count. Cluster with a future test-hygiene sweep.

3. **[LOW] L-1 — Duplicate `<SessionReplayShell>` imports**
   - **Location:** [frontend/src/views/PlaybackView.tsx](../../frontend/src/views/PlaybackView.tsx) (import block)
   - **Category:** cosmetic
   - **Description:** Two import statements resolve `<SessionReplayShell>` — leftover from the rewrite. Harmless; bundlers dedupe.
   - **Recommended fix:** Delete the duplicate import. ~1 line.

4. **[LOW] L-2 — `FAKE_TABLE_STATE` fixture duplication across test files**
   - **Location:** [frontend/src/views/PlaybackView.test.tsx](../../frontend/src/views/PlaybackView.test.tsx) + other scenes3d / views test files
   - **Category:** test hygiene
   - **Description:** The `FAKE_TABLE_STATE` fixture literal is copy-pasted across multiple test files. Drift risk when the shape evolves.
   - **Recommended fix:** Extract to `frontend/test/fixtures/tableState.ts` (or similar) and import. Cluster with a future test-fixture consolidation pass.

5. **[LOW] L-3 — `ACTIVE_POLL_INTERVAL_MS` duplicates `useHandPolling` constant**
   - **Location:** [frontend/src/views/PlaybackView.tsx](../../frontend/src/views/PlaybackView.tsx) (local const); [frontend/src/hooks/useHandPolling.ts](../../frontend/src/hooks/useHandPolling.ts) (source of truth)
   - **Category:** DRY
   - **Description:** `<PlaybackView>` declares its own `ACTIVE_POLL_INTERVAL_MS` rather than importing the canonical value from `useHandPolling`.
   - **Recommended fix:** Export the constant from `useHandPolling.ts` and import in `<PlaybackView>`. ~3 lines.

#### Recommendation

**No beads filings this cycle** per Anna contract — all findings MEDIUM / LOW. **M-1** is a plan-level scope question for Jean (retain or omit `<PresetToolbar>` / `<TableSettingsPanel>` in playback chrome). **M-2** is test hygiene with no behavioural impact today. **L-1 / L-2 / L-3** are cosmetic / DRY cleanups suitable for clustering in a future polish pass. **`aia-core-bl5v` is genuinely closed** — all ACs SATISFIED, Cycle 44 **M-1** pre-gate RESOLVED upstream in `<SessionReplayShell>` (375 → 400ms clamp, pinned by 2 tests), Cycle 42 **M-1 for the playback route** CLOSED via `<QualityToast>` mount at route root, 414 → 126 LOC reduction, legacy `pokerScene` / Three.js imports fully removed, suite 1970 / 1970 green, lint delta 0.

#### Links

- Review artifact: [docs/agent/reviews/cycle-45-aia-core-bl5v-2026-04-21.md](../../docs/agent/reviews/cycle-45-aia-core-bl5v-2026-04-21.md)
- Prior cycle: [Cycle 44 — aia-core-uja6](#cycle-44--aia-core-uja6-t-023b-sessionreplayshell-cross-hand-timeline-scott-review-2026-04-21)
- Filed to beads: _None this cycle_
- Carry-forward targets: **M-1** — `<PresetToolbar>` / `<TableSettingsPanel>` retain-or-omit decision in `<PlaybackView>` (Jean plan-level); **M-2** — polling test `waitFor`-based rewrite (test hygiene sweep); **L-1** — duplicate `<SessionReplayShell>` import removal; **L-2** — `FAKE_TABLE_STATE` fixture extraction; **L-3** — `ACTIVE_POLL_INTERVAL_MS` canonical export from `useHandPolling`
- Closed carry-forward: **`aia-core-bl5v` CLOSED** — all ACs SATISFIED; **T-031 CLOSED**; **Cycle 44 M-1** (4× speed vs `CHIP_SLIDE_DURATION_MS`) **CLOSED** — resolved upstream in `<SessionReplayShell>` via `Math.max(CHIP_SLIDE_DURATION_MS, MS_PER_STREET / speed)` clamp, pinned by 2 new pre-gate tests; **Cycle 42 M-1 for playback route** **CLOSED** — `<QualityToast>` mounted at `<PlaybackView>` root (one of three Cycle 42 carrier routes; `<DealerView>` + `<TableView3D>` remain)
- Still open carry-forward: Cycle 35 **M-1 / M-2 / M-3 / L-1 / L-2** — unchanged; Cycle 36 **L-1 / L-2** — unchanged; Cycle 37 **M-1 / M-2 / L-1 / L-2** — unchanged; Cycle 38 **L-1 / L-2** — unchanged; Cycle 39 **L-1** — unchanged; Cycle 40 **L-1 / L-2** — unchanged; Cycle 41 **M-1 / M-2 / L-1 / L-2** — unchanged; Cycle 42 **M-1** — reduced scope (playback route CLOSED; `<DealerView>` / `<TableView3D>` carriers remain) / **M-2 / L-1 / L-2** — unchanged; Cycle 43 **M-1 / M-2 / L-1 / L-2** — unchanged; Cycle 44 **M-2 / L-1 / L-2 / L-3** — unchanged (M-1 CLOSED this cycle); plus Cycle 45 **M-1 / M-2 / L-1 / L-2 / L-3** newly opened this cycle

### Cycle 46 — aia-core-wohq (T-033 `pokerScene.ts` deletion, pre-check HALTED, Scott review, 2026-04-21)

**Source:** [docs/agent/reviews/cycle-46-aia-core-wohq-2026-04-21.md](../../docs/agent/reviews/cycle-46-aia-core-wohq-2026-04-21.md)
**Source task:** aia-core-wohq — T-033 Delete `pokerScene.ts`, its tests, and dead helpers — **NOT CLOSED** (re-blocked on `aia-core-pvkr`)

#### Summary

`aia-core-wohq` attempted the Phase B deletion of [frontend/src/scenes/pokerScene.ts](../../frontend/src/scenes/pokerScene.ts) + sibling test + 8 scene helpers. Phase B **halted on pre-check**: `grep -r "pokerScene\|createPokerScene" frontend/src frontend/test` returns live-code hits in [frontend/src/dealer/DealerPreview.tsx](../../frontend/src/dealer/DealerPreview.tsx) (L2 import of `createPokerScene`, L116 call site inside canvas-expand `useEffect`; plus L3 import + L87 call of `calculateEquity`). No closed migration task covers `DealerPreview.tsx` — T-030 handled `TableView3D.tsx`, T-031 handled `views/PlaybackView.tsx`, T-032 handled `pages/TableView.tsx`. Per caller contract, Phase B refused to delete live code and made **zero file changes**. Suite unchanged at 1970 / 1970 green; lint delta 0. Scott flagged **0 CRITICAL, 1 HIGH, 1 MEDIUM, 2 LOW**. **T-033 NOT CLOSED** — `aia-core-wohq` re-transitioned from `in_progress` → `blocked` pending resolution of `aia-core-pvkr`.

#### Filed Bug Cards

- **H-1 → `aia-core-pvkr`** — **P1 task** (not bug — migrate-vs-delete decision, not a defect). Title: _"DealerPreview.tsx — migrate to `<PokerTable>` or delete (T-033 pre-gate)"_. Parent: `aia-core-6o9t`. Discovered-from: `aia-core-wohq`. Blocks: `aia-core-wohq`. M-1 folded into the same card as orphaned-module context (zero `src/` importers of `DealerPreview` other than its own test; tree-shakable dead module is a plausible resolution path). Either resolution (delete or migrate) re-opens T-033.

#### Rolled-forward findings (MEDIUM / LOW — not filed to beads)

1. **[MEDIUM] M-1 — `DealerPreview.tsx` has zero `src/` importers (likely orphan)**
   - **Location:** [frontend/src/dealer/DealerPreview.tsx](../../frontend/src/dealer/DealerPreview.tsx)
   - **Category:** dead-code / spec gap
   - **Description:** `grep -r "DealerPreview" frontend/src` returns only the self-definition; the only consumer is its own sibling test file. Combined with the T-030 dealer-embed migration having landed via `TableView3D.tsx` + declarative `<PokerTable>`, this module appears to be a tree-shakable orphan kept alive purely by its own test.
   - **Recommended fix:** Owned by `aia-core-pvkr` — Jean migrate-vs-delete decision. Leaving here as a pointer; all actionable work tracks in the beads task.

2. **[LOW] L-1 — Stale doc refs to deleted-in-spirit modules**
   - **Location:** [frontend/README.md](../../frontend/README.md) L148-168; [frontend/src/scenes3d/components/tableLayout.ts](../../frontend/src/scenes3d/components/tableLayout.ts) L7; [frontend/src/scenes3d/components/Table.tsx](../../frontend/src/scenes3d/components/Table.tsx) L29; [frontend/src/scenes3d/components/CardAtlas.ts](../../frontend/src/scenes3d/components/CardAtlas.ts) L261
   - **Category:** docs / comment hygiene
   - **Description:** README documents `scenes/table.js`, `scenes/tableGeometry.js`, `scenes/cards.js`, `scenes/holeCards.js`, `scenes/communityCards.js`, `scenes/chipStacks.js` as live architecture. Three `scenes3d/` source files cite `scenes/tableGeometry.ts` / `scenes/cards.ts` as their port origin. All dangle once T-033 lands.
   - **Recommended fix:** Fold into T-034 (docs) plus a one-line comment sweep in the three `scenes3d/` files.

3. **[LOW] L-2 — Helper sibling-tests form clean self-contained deletion bundle**
   - **Location:** [frontend/test/scenes/tableGeometry.test.ts](../../frontend/test/scenes/tableGeometry.test.ts), [frontend/test/scenes/chipStacks.test.ts](../../frontend/test/scenes/chipStacks.test.ts), [frontend/test/scenes/holeCards.test.ts](../../frontend/test/scenes/holeCards.test.ts), [frontend/test/scenes/communityCards.test.ts](../../frontend/test/scenes/communityCards.test.ts), [frontend/test/scenes/seatCamera.test.ts](../../frontend/test/scenes/seatCamera.test.ts), [frontend/test/scenes/showdown.test.ts](../../frontend/test/scenes/showdown.test.ts), [frontend/test/scenes/cards.test.ts](../../frontend/test/scenes/cards.test.ts), [frontend/test/scenes/table.test.ts](../../frontend/test/scenes/table.test.ts)
   - **Category:** informational
   - **Description:** Each helper listed in T-033 has exactly one sibling test with zero non-self importers (modulo `table.test.ts` → `seatCamera.ts`, internal to the deletion set). Deletion is atomic.
   - **Recommended fix:** None — informational; swept with the helpers when T-033 re-runs after `aia-core-pvkr` lands.

#### Recommendation

**H-1 filed to beads as `aia-core-pvkr` (P1 task)** — blocks `aia-core-wohq`, which is re-transitioned to `blocked`. **T-033 NOT CLOSED this cycle.** Zero files changed; suite / lint unchanged (1970 / 1970). MED / LOW findings in this ledger per Anna contract. When `aia-core-pvkr` lands (either path), re-open `aia-core-wohq` and re-run Phase B as a single combined deletion commit.

#### Links

- Review artifact: [docs/agent/reviews/cycle-46-aia-core-wohq-2026-04-21.md](../../docs/agent/reviews/cycle-46-aia-core-wohq-2026-04-21.md)
- Prior cycle: [Cycle 45 — aia-core-bl5v](#cycle-45--aia-core-bl5v-t-031-playbackview-migration-to-declarative-3d-stack-scott-review-2026-04-21)
- Filed to beads: **aia-core-pvkr** (P1 task; parent aia-core-6o9t; discovered-from aia-core-wohq; blocks aia-core-wohq)
- Re-blocked: **aia-core-wohq** — `in_progress` → `blocked` on `aia-core-pvkr`; **T-033 NOT CLOSED**
- Carry-forward targets: **M-1** — owned by `aia-core-pvkr`; **L-1** — fold into T-034; **L-2** — informational only
- Closed carry-forward: _None this cycle_
- Still open carry-forward: Cycle 35 **M-1 / M-2 / M-3 / L-1 / L-2** — unchanged; Cycle 36 **L-1 / L-2** — unchanged; Cycle 37 **M-1 / M-2 / L-1 / L-2** — unchanged; Cycle 38 **L-1 / L-2** — unchanged; Cycle 39 **L-1** — unchanged; Cycle 40 **L-1 / L-2** — unchanged; Cycle 41 **M-1 / M-2 / L-1 / L-2** — unchanged; Cycle 42 **M-1** (reduced scope per Cycle 45) / **M-2 / L-1 / L-2** — unchanged; Cycle 43 **M-1 / M-2 / L-1 / L-2** — unchanged; Cycle 44 **M-2 / L-1 / L-2 / L-3** — unchanged; Cycle 45 **M-1 / M-2 / L-1 / L-2 / L-3** — unchanged; plus Cycle 46 **M-1** (owned by `aia-core-pvkr`) / **L-1 / L-2** newly opened this cycle

### Cycle 47 — aia-core-pvkr (T-033 pre-gate — DealerPreview.tsx DELETE, Scott review, 2026-04-21)

**Source:** [docs/agent/reviews/cycle-47-aia-core-pvkr-2026-04-21.md](../../docs/agent/reviews/cycle-47-aia-core-pvkr-2026-04-21.md)
**Source task:** aia-core-pvkr — DealerPreview.tsx migrate-or-delete (T-033 pre-gate) — **CLOSED**

#### Summary

`aia-core-pvkr` resolves the Cycle 46 **H-1** T-033 pre-gate via the **DELETE** path: [frontend/src/dealer/DealerPreview.tsx](../../frontend/src/dealer/DealerPreview.tsx) (~350 lines) + its sibling test [frontend/test/dealer/DealerPreview.test.tsx](../../frontend/test/dealer/DealerPreview.test.tsx) were full orphans (zero `frontend/src/` importers beyond the self-test; superseded by the T-030 dealer-embed migration via `<TableView3D>` + declarative `<PokerTable>`). [docs/frontend/architecture.md](../../docs/frontend/architecture.md) L98 scrubbed of the stale `DealerPreview` reference. T-033 pre-check re-verified: `createPokerScene` in [frontend/src/scenes/pokerScene.ts](../../frontend/src/scenes/pokerScene.ts) and `calculateEquity` in [frontend/src/poker/evaluator.ts](../../frontend/src/poker/evaluator.ts) are now single-site self-declarations with no live external callers — **T-033 can proceed**. Suite **1970 → 1954** (−16 tests from the deleted `DealerPreview.test.tsx`), all green; lint delta ≤ 0. Scott flagged **0 CRITICAL, 0 HIGH, 2 MEDIUM, 2 LOW**. **No beads filings this cycle per Anna contract** (MED/LOW → tasks.md only).

#### Filed Bug Cards

_None — all findings MEDIUM / LOW, recorded below only._

#### Rolled-forward findings (MEDIUM / LOW — not filed to beads)

1. **[MEDIUM] M-1 — `calculateEquity` is now a soft orphan in `frontend/src/`**
   - **Location:** [frontend/src/poker/evaluator.ts](../../frontend/src/poker/evaluator.ts) (`calculateEquity` export)
   - **Category:** dead-code / T-033 pre-check
   - **Description:** With `DealerPreview.tsx` deleted, `calculateEquity` is a single-site self-reference in `frontend/src/`. T-033's pre-check must confirm whether the T-031 declarative stack's server-side equity supersedes all remaining callers before deleting it as a "dead helper." Non-blocking for T-033 entry, but a required pre-check inside T-033.
   - **Recommended fix:** Flag as a T-033 pre-check item — audit test-only vs live callers before deletion; fold resolution into the T-033 deletion bundle if orphan status is confirmed.

2. **[MEDIUM] M-2 — `architecture.md` prose not scanned beyond L98**
   - **Location:** [docs/frontend/architecture.md](../../docs/frontend/architecture.md)
   - **Category:** docs hygiene
   - **Description:** Only the single L98 reference to `DealerPreview` was surgically scrubbed this cycle. A full-document grep sweep for `DealerPreview`, `createPokerScene`, `calculateEquity`, and the `scenes/` helper module names was not performed — other stale prose may remain.
   - **Recommended fix:** Fold a post-T-033 grep sweep into T-034 (docs).

3. **[LOW] L-1 — `<StreetScrubber>` usage count drops by one**
   - **Location:** [frontend/src/scenes3d/SessionScrubber.tsx](../../frontend/src/scenes3d/SessionScrubber.tsx) and its consumers
   - **Category:** reachability audit
   - **Description:** `DealerPreview.tsx` was a `<StreetScrubber>` consumer; deletion removes one call site. Verify `<StreetScrubber>` (or its successor `<SessionScrubber>`) remains reachable through the T-023 / T-023b / T-031 canonical paths.
   - **Recommended fix:** Informational — covered implicitly by existing `<SessionReplayShell>` + `<PlaybackView>` integration tests.

4. **[LOW] L-2 — No commit this cycle beyond deletion**
   - **Category:** informational
   - **Description:** Per Anna contract, no MED/LOW beads filings. This line is a placeholder pointer confirming Cycle 47 committed only the DELETE bundle + the L98 scrub.

#### Recommendation

**`aia-core-pvkr` CLOSED** via DELETE path — Cycle 46 **H-1** pre-gate RESOLVED. `aia-core-wohq` (T-033) unblocked and ready for re-run; its only blocker was `aia-core-pvkr`. Zero MED/LOW beads filings per Anna contract. T-033 entry-ready: `createPokerScene` + `calculateEquity` confirmed as single-site self-references with no live external callers. M-1 (`calculateEquity` orphan status) and M-2 (architecture.md full-doc grep sweep) are T-033 / T-034 pre-check items, not blockers for T-033 entry.

#### Links

- Review artifact: [docs/agent/reviews/cycle-47-aia-core-pvkr-2026-04-21.md](../../docs/agent/reviews/cycle-47-aia-core-pvkr-2026-04-21.md)
- Prior cycle: [Cycle 46 — aia-core-wohq](#cycle-46--aia-core-wohq-t-033-pokerscene-ts-deletion-pre-check-halted-scott-review-2026-04-21)
- Filed to beads: _None_
- Closed: **aia-core-pvkr** — DELETE path landed; T-033 pre-gate RESOLVED
- Unblocked: **aia-core-wohq** (T-033) — `blocked` → `open`
- Closed carry-forward: **Cycle 46 H-1** (owned by `aia-core-pvkr`) CLOSED; **Cycle 46 M-1** (`DealerPreview.tsx` orphan) CLOSED (resolved via deletion)
- Still open carry-forward: Cycle 35 **M-1 / M-2 / M-3 / L-1 / L-2** — unchanged; Cycle 36 **L-1 / L-2** — unchanged; Cycle 37 **M-1 / M-2 / L-1 / L-2** — unchanged; Cycle 38 **L-1 / L-2** — unchanged; Cycle 39 **L-1** — unchanged; Cycle 40 **L-1 / L-2** — unchanged; Cycle 41 **M-1 / M-2 / L-1 / L-2** — unchanged; Cycle 42 **M-1** (reduced scope per Cycle 45) / **M-2 / L-1 / L-2** — unchanged; Cycle 43 **M-1 / M-2 / L-1 / L-2** — unchanged; Cycle 44 **M-2 / L-1 / L-2 / L-3** — unchanged; Cycle 45 **M-1 / M-2 / L-1 / L-2 / L-3** — unchanged; Cycle 46 **L-1** (fold into T-034) / **L-2** (informational) — unchanged (**H-1** and **M-1** CLOSED this cycle); plus Cycle 47 **M-1** (T-033 pre-check) / **M-2** (T-034 grep sweep) / **L-1** (informational) / **L-2** (informational) newly opened this cycle

### Cycle 48 — aia-core-wohq (T-033 `pokerScene.ts` + helpers deletion retry, Scott review, 2026-04-21)

**Source:** [docs/agent/reviews/cycle-48-aia-core-wohq-2026-04-21.md](../../docs/agent/reviews/cycle-48-aia-core-wohq-2026-04-21.md)
**Source task:** aia-core-wohq — T-033 Delete `pokerScene.ts`, its tests, and dead helpers — **CLOSED**

#### Summary

`aia-core-wohq` lands T-033 on retry after the Cycle 46 HALT and Cycle 47 pre-gate clear. All 9 imperative scene helpers + [frontend/src/scenes/pokerScene.ts](../../frontend/src/scenes/pokerScene.ts) deleted along with their 9 sibling test files; the entire [frontend/src/poker/evaluator.ts](../../frontend/src/poker/evaluator.ts) module + its test deleted as a strict orphan per user directive (resolves Cycle 47 **M-1**). 2 dead `vi.mock()` blocks scrubbed from dealer tests; 4 lineage doc-comments updated to past-tense (partial fold-in of Cycle 46 **L-1**). 4 empty directories removed. Net: **20 files deleted** (10 source + 10 tests), **4 dirs removed**, **6 files modified** (mock scrubs + lineage comments). Full frontend suite **1954 → 1844** (−110 tests, expected for the deleted modules), all green; lint delta 0. Scott flagged **0 CRITICAL, 0 HIGH, 2 MEDIUM, 2 LOW**. **No beads filings this cycle per Anna contract** (MED/LOW → tasks.md only). ACs 1/2/4/5 SATISFIED; **AC-3 PARTIAL** (residual literal-string hits are intentional negative assertions inside tests that prove the SUT source no longer imports the legacy names).

#### Filed Bug Cards

_None — all findings MEDIUM / LOW, recorded below only._

#### Rolled-forward findings (MEDIUM / LOW — not filed to beads)

1. **[MEDIUM] M-1 — AC-3 literal-grep tension with negative-assertion test strings**
   - **Location:** [frontend/test/views/PlaybackView.test.tsx](../../frontend/test/views/PlaybackView.test.tsx) L14-15, L357, L361-363; [frontend/test/dealer/TableView3D.test.tsx](../../frontend/test/dealer/TableView3D.test.tsx) L14, L359, L365-366; [frontend/test/pages/TableView.test.tsx](../../frontend/test/pages/TableView.test.tsx) L280, L286
   - **Category:** convention / AC wording
   - **Description:** AC-3's literal grep still matches the legacy names — but every surviving hit is a *negative assertion* regex that verifies the SUT source does NOT import those symbols. Literal AC-3 reads as a failure; intent AC-3 is fully satisfied.
   - **Recommended fix:** Defer to **T-034** — either string-obfuscate the negative-assertion patterns (e.g. `'create' + 'PokerScene'`) or amend AC-3 to exclude `frontend/test/**/*.test.{ts,tsx}` guards.

2. **[MEDIUM] M-2 — Full `evaluator.ts` deletion slightly wider than strict T-033 wording**
   - **Location:** (deleted) `frontend/src/poker/evaluator.ts` + `frontend/test/poker/evaluator.test.ts`
   - **Category:** correctness / scope
   - **Description:** T-033's phrasing authorizes deleting `calculateEquity` if unreferenced but says "otherwise leave it." Phase B pre-check confirmed **zero** `frontend/src/` importers for *any* `evaluator.ts` export (`calculateEquity`, `handCategory`, `HandRank`, `EquityResult`, `Card`, `InternalCard`), so the entire file was deleted per the user's "if the entire module is orphaned, delete the whole file" directive.
   - **Recommended fix:** No action needed — documented here. If analytics-dashboard-007 or any later work wants hand-category naming back, restore from git history rather than re-implementing.

3. **[LOW] L-1 — Dealer tests retain no-op context after `vi.mock()` strip**
   - **Location:** `frontend/test/dealer/*.test.tsx` (Scott's review, "Dealer test files still carry dangling imports / residues after vi.mock strip")
   - **Category:** test hygiene
   - **Description:** Scrubbing the `vi.mock()` blocks left behind a small amount of now-inert setup. Not broken, just cosmetic.
   - **Recommended fix:** Drive-by clean up on the next dealer-test touch.

4. **[LOW] L-2 — Stale doc/comment refs outside the lineage-updated set**
   - **Location:** [frontend/test/scenes3d/tableLayout.test.ts](../../frontend/test/scenes3d/tableLayout.test.ts) L54 (describe-string still cites a deleted sibling); [docs/frontend/architecture.md](../../docs/frontend/architecture.md) (residual prose beyond the Cycle 47 L98 scrub)
   - **Category:** docs / comment hygiene
   - **Description:** The four lineage doc-comments updated this cycle partially resolve Cycle 46 **L-1**, but a describe-string literal and the wider architecture.md prose still mention deleted modules.
   - **Recommended fix:** Fold remainder into **T-034** (docs pass) alongside Cycle 47 **M-2** grep sweep.

#### Recommendation

**T-033 CLOSED.** `aia-core-wohq` landed the full deletion bundle; **Cycle 47 M-1** (`calculateEquity` soft orphan) **RESOLVED** via deletion; **Cycle 46 L-1** partially resolved (4 lineage comments updated; remainder deferred to T-034). All MED/LOW findings are non-blocking documentation / spec-wording carry-forwards. T-034 (docs) is unblocked and ready.

#### Links

- Review artifact: [docs/agent/reviews/cycle-48-aia-core-wohq-2026-04-21.md](../../docs/agent/reviews/cycle-48-aia-core-wohq-2026-04-21.md)
- Prior cycle: [Cycle 47 — aia-core-pvkr](#cycle-47--aia-core-pvkr-t-033-pre-gate--dealerpreviewtsx-delete-scott-review-2026-04-21)
- Filed to beads: _None_
- Closed: **aia-core-wohq** (T-033) — full deletion bundle landed
- Unblocked: **aia-core-7uds** (T-034 — docs pass)
- Closed carry-forward: **Cycle 47 M-1** (`calculateEquity` orphan) RESOLVED via deletion; **Cycle 46 L-1** partially resolved (4/? files updated; remainder → T-034)
- Still open carry-forward: Cycle 35 **M-1 / M-2 / M-3 / L-1 / L-2** — unchanged; Cycle 36 **L-1 / L-2** — unchanged; Cycle 37 **M-1 / M-2 / L-1 / L-2** — unchanged; Cycle 38 **L-1 / L-2** — unchanged; Cycle 39 **L-1** — unchanged; Cycle 40 **L-1 / L-2** — unchanged; Cycle 41 **M-1 / M-2 / L-1 / L-2** — unchanged; Cycle 42 **M-1** (reduced scope per Cycle 45) / **M-2 / L-1 / L-2** — unchanged; Cycle 43 **M-1 / M-2 / L-1 / L-2** — unchanged; Cycle 44 **M-2 / L-1 / L-2 / L-3** — unchanged; Cycle 45 **M-1 / M-2 / L-1 / L-2 / L-3** — unchanged; Cycle 46 **L-1** (remainder, fold into T-034) / **L-2** (informational) — unchanged; Cycle 47 **M-2** (T-034 grep sweep) / **L-1 / L-2** (informational) — unchanged (**M-1** CLOSED this cycle); plus Cycle 48 **M-1** (T-034 AC-3 obfuscation or amendment) / **M-2** (informational) / **L-1** (drive-by) / **L-2** (T-034 docs sweep) newly opened this cycle


### Cycle 49 — aia-core-ewtb (T-029 mobile touch / tap-target / 360px-width audit, Scott review, 2026-04-21)

**Source:** [docs/agent/reviews/cycle-49-aia-core-ewtb-2026-04-21.md](../../docs/agent/reviews/cycle-49-aia-core-ewtb-2026-04-21.md)
**Source task:** aia-core-ewtb — T-029 Mobile touch / tap-target / 360px-width audit — **CLOSED**

#### Summary

`aia-core-ewtb` lands T-029. New [frontend/test/scenes3d/mobileAudit.test.tsx](../../frontend/test/scenes3d/mobileAudit.test.tsx) (12 tests) at 360×780 covers **AC-2** (tap targets ≥ 44×44), **AC-3** (no horizontal overflow — structural), and **AC-4** (reduced-motion + no hover-required UX). Audit surfaced and fixed two latent tap-target gaps: [frontend/src/scenes3d/QualityToast.tsx](../../frontend/src/scenes3d/QualityToast.tsx) dismiss button and [frontend/src/scenes3d/SessionScrubber.tsx](../../frontend/src/scenes3d/SessionScrubber.tsx) prev/next controls. **AC-1** (gesture matrix) satisfied via new [docs/frontend/mobile-gesture-matrix.md](../../docs/frontend/mobile-gesture-matrix.md). ACs **1 / 2 / 4 SATISFIED**; **AC-3 PARTIAL** (structural only — happy-dom has no layout engine, so true pixel-level overflow cannot be asserted in-suite). Full frontend suite **1844 → 1856** (+12), all green; lint delta 0. Scott flagged **0 CRITICAL, 0 HIGH, 2 MEDIUM, 2 LOW**. **No beads filings this cycle per Anna contract** (MED/LOW → tasks.md only).

#### Filed Bug Cards

_None — all findings MEDIUM / LOW, recorded below only._

#### Rolled-forward findings (MEDIUM / LOW — not filed to beads)

1. **[MEDIUM] M-1 — AC-3 structural vs pixel-level overflow**
   - **Location:** [frontend/test/scenes3d/mobileAudit.test.tsx](../../frontend/test/scenes3d/mobileAudit.test.tsx)
   - **Category:** test harness / AC fidelity
   - **Description:** happy-dom has no layout engine; AC-3 assertions verify structural width/style contracts but cannot measure `documentElement.scrollWidth` against the 360px viewport at runtime.
   - **Recommended fix:** Follow-up Playwright or `@vitest/browser` harness at 360×780 asserting `documentElement.scrollWidth <= 360`. Defer to a future mobile-polish pass.

2. **[MEDIUM] M-2 — PlaybackView route-level 360px composition not E2E-asserted**
   - **Location:** [frontend/src/views/PlaybackView.tsx](../../frontend/src/views/PlaybackView.tsx); back-button source [frontend/src/views/playbackStyles.ts](../../frontend/src/views/playbackStyles.ts)
   - **Category:** coverage gap
   - **Description:** The full route composition is not rendered end-to-end at 360px inside the audit suite; the back button is 48×48 via `playbackStyles.ts` but not explicitly asserted. Fold into M-1's browser harness when it lands.
   - **Recommended fix:** Add a PlaybackView-at-360 case to the Playwright follow-up from M-1.

3. **[LOW] L-1 — `MIN_TAP_TARGET_PX` duplicated across 4 overlay files**
   - **Location:** overlay files in [frontend/src/scenes3d/](../../frontend/src/scenes3d/) (plus inline `44` in `SessionScrubber.tsx`)
   - **Category:** DRY / constants hygiene
   - **Description:** Four copies of the same constant exist across overlay files.
   - **Recommended fix:** Extract to `frontend/src/scenes3d/constants.ts` and import; rolls L-2 in the same commit.

4. **[LOW] L-2 — `SessionScrubber` uses inline `44` instead of named constant**
   - **Location:** [frontend/src/scenes3d/SessionScrubber.tsx](../../frontend/src/scenes3d/SessionScrubber.tsx)
   - **Category:** readability
   - **Description:** Magic number usage; resolved automatically by the L-1 extraction.
   - **Recommended fix:** Resolved by L-1.

#### Recommendation

**T-029 CLOSED.** `aia-core-ewtb` landed the audit harness plus two latent tap-target fixes and the gesture-matrix doc. All MED/LOW findings are non-blocking polish / harness-upgrade carry-forwards. No new beads filings per Anna contract.

#### Links

- Review artifact: [docs/agent/reviews/cycle-49-aia-core-ewtb-2026-04-21.md](../../docs/agent/reviews/cycle-49-aia-core-ewtb-2026-04-21.md)
- Prior cycle: [Cycle 48 — aia-core-wohq](#cycle-48--aia-core-wohq-t-033-pokerscenets--helpers-deletion-retry-scott-review-2026-04-21)
- Filed to beads: _None_
- Closed: **aia-core-ewtb** (T-029) — mobile audit + two tap-target fixes + gesture matrix landed
- Unblocked: _None new_
- Still open carry-forward: Cycle 35 **M-1 / M-2 / M-3 / L-1 / L-2**; Cycle 36 **L-1 / L-2**; Cycle 37 **M-1 / M-2 / L-1 / L-2**; Cycle 38 **L-1 / L-2**; Cycle 39 **L-1**; Cycle 40 **L-1 / L-2**; Cycle 41 **M-1 / M-2 / L-1 / L-2**; Cycle 42 **M-1** (reduced per Cycle 45) / **M-2 / L-1 / L-2**; Cycle 43 **M-1 / M-2 / L-1 / L-2**; Cycle 44 **M-2 / L-1 / L-2 / L-3**; Cycle 45 **M-1 / M-2 / L-1 / L-2 / L-3**; Cycle 46 **L-1** (remainder → T-034) / **L-2**; Cycle 47 **M-2** (T-034 grep sweep) / **L-1 / L-2**; Cycle 48 **M-1** (T-034 AC-3) / **M-2 / L-1 / L-2** — all unchanged; plus Cycle 49 **M-1** (Playwright/browser 360px harness) / **M-2** (PlaybackView E2E at 360) / **L-1** (extract `MIN_TAP_TARGET_PX`) / **L-2** (resolved by L-1) newly opened this cycle
