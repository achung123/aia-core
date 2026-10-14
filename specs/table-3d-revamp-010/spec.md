# Spec — 3D Table View Revamp

**Project ID:** table-3d-revamp-010
**Date:** 2026-04-18
**Status:** Draft

---

## Context

The existing 3D table view ([frontend/src/scenes/pokerScene.ts](frontend/src/scenes/pokerScene.ts)) uses vanilla Three.js driven imperatively by three consumers:

| Consumer | File | Route | Role |
|---|---|---|---|
| Dealer embed | [frontend/src/dealer/TableView3D.tsx](frontend/src/dealer/TableView3D.tsx) | `#/dealer` (embedded panel) | Live view for the dealer while recording a hand |
| Full-page playback | [frontend/src/views/PlaybackView.tsx](frontend/src/views/PlaybackView.tsx) | `#/playback?gameId=<id>` (reached via the "▶ Playback" button in [frontend/src/views/DataView.tsx](frontend/src/views/DataView.tsx)) | Review a completed or in-progress game, hand-by-hand |
| Player POV | [frontend/src/pages/TableView.tsx](frontend/src/pages/TableView.tsx) | `#/player/table?game=<id>&player=<name>` (after joining from `PlayerApp.tsx`) | Player sees their own hole cards + community; opponents hidden until showdown |

All three render flops/turns/rivers, seat labels, and basic hole cards, but lack animation, chip visualization, action state, equity overlays, theming, and an interactive cross-hand replay. This project rebuilds the 3D view on `@react-three/fiber` + `drei` as a declarative React scene graph, layers on a rich set of dealer-facing features, tightens the player POV privacy guarantees, and ships a cross-hand Session Timeline on the playback route only — all while remaining mobile-first (60fps on 2022+ phones, 30fps floor on older devices).

**Non-goals (this project):**
- Audio / haptics (deferred to a follow-up project)
- Backend schema or endpoint changes — existing hand/action/equity endpoints only
- Full-session replay in the dealer embed or player interface — those are limited to the per-hand street scrubber. Full-session (cross-hand) replay ships **only** on the full-page playback route (see S-4.4).
- Equity overlay in the player interface — strictly disabled (see S-3.5, S-5.3nd/src/views/DataView.tsx)) | Review a completed or in-progress game, hand-by-hand |
| Player POV | [frontend/src/pages/TableView.tsx](frontend/src/pages/TableView.tsx) | `#/player/table?game=<id>&player=<name>` (after joining from `PlayerApp.tsx`) | Player sees their own hole cards + community; opponents hidden until showdown |

All three render flops/turns/rivers, seat labels, and basic hole cards, but lack animation, chip visualization, action state, equity overlays, theming, and an interactive cross-hand replay. This project rebuilds the 3D view on `@react-three/fiber` + `drei` as a declarative React scene graph, layers on a rich set of dealer-facing features, tightens the player POV privacy guarantees, and ships a cross-hand Session Timeline on the playback route only — all while remaining mobile-first (60fps on 2022+ phones, 30fps floor on older devices).

**Non-goals (this project):**
- Audio / haptics (deferred to a follow-up project)
- Backend schema or endpoint changes — existing hand/action/equity endpoints only
- Full-session replay in the dealer embed or player interface — those are limited to the per-hand street scrubber. Full-session (cross-hand) replay ships **only** on the full-page playback route (see S-4.4).
- Equity overlay in the player interface — strictly disabled (see S-3.5, S-5.3).

---

## Table of Contents

1. [Epic 1: Foundation — R3F Scene Architecture](#epic-1-foundation--r3f-scene-architecture)
2. [Epic 2: Visual Upgrades — Materials, Animation, Theme](#epic-2-visual-upgrades--materials-animation-theme)
3. [Epic 3: Player Presence & Action State](#epic-3-player-presence--action-state)
4. [Epic 4: Camera, Interaction & Replay](#epic-4-camera-interaction--replay)
5. [Epic 5: Player Interface POV Restriction](#epic-5-player-interface-pov-restriction)
6. [Epic 6: Performance & Mobile Budget](#epic-6-performance--mobile-budget)
7. [Epic 7: Consumer Integration & Cleanup](#epic-7-consumer-integration--cleanup)

---

## Epic 1: Foundation — R3F Scene Architecture

Replace the imperative vanilla Three.js scene with a declarative `@react-three/fiber` scene graph. This epic delivers a working feature-parity R3F table, with the vanilla module still alive in parallel for rollback safety during development, and deletes the vanilla module once all consumers are migrated (in Epic 7).

### S-1.1 — Add R3F + drei Dependencies and Baseline Canvas

**As a** frontend developer, **I want** `@react-three/fiber` and `@react-three/drei` installed with a bare `<PokerCanvas>` component rendering an empty scene, **so that** I have a foundation for building the new table.

**Acceptance Criteria:**
1. `@react-three/fiber` and `@react-three/drei` are added to `frontend/package.json` at versions compatible with React 19 and `three@0.183`.
2. A new component `frontend/src/scenes3d/PokerCanvas.tsx` exports a `<PokerCanvas>` that wraps R3F `<Canvas>` with baseline camera, lighting, and dpr/perf defaults.
3. A smoke Vitest test mounts `<PokerCanvas>` with a mocked R3F renderer and asserts the container renders without error.
4. No existing consumers (`TableView3D`, `PlaybackView.tsx`, `pages/TableView.tsx` player route) are changed — the new scene lives side-by-side with `pokerScene.ts`.

### S-1.2 — Declarative Table, Seats, and Camera Rig

**As a** frontend developer, **I want** the table geometry, seat positions, and camera rig expressed as R3F components, **so that** state changes drive scene updates via props rather than imperative mutation.

**Acceptance Criteria:**
1. Components `<Table>`, `<Seat>`, `<CameraRig>` live under `frontend/src/scenes3d/` with typed props.
2. `<Seat>` accepts `seatIndex`, `playerName`, `isActive` and renders at the same circular layout as `pokerScene.ts`.
3. `<CameraRig>` wraps drei `OrbitControls` with touch gestures enabled and damping tuned for mobile.
4. Component tests verify seat count, positioning invariants, and that `isActive=false` dims the seat.

### S-1.3 — Card Texture Atlas and `<Card>` Component

**As a** frontend developer, **I want** a single texture atlas containing all 52 card faces + card back rendered via a `<Card>` component, **so that** card rendering is GPU-efficient and avoids the per-card CanvasTexture cost.

**Acceptance Criteria:**
1. A build step or runtime module generates a single `CardAtlas` texture containing all 52 faces + 1 back.
2. `<Card>` accepts `rank`, `suit`, `faceUp`, `position`, `rotation` props and uses atlas UV offsets for the face.
3. Visual parity with the current card rendering is verified via a Vitest snapshot of `<Card>` props → scene graph.
4. Memory profile: rendering 9 seats × 2 hole cards + 5 community cards uses exactly one shared texture.

### S-1.4 — Chip Stack Primitive via InstancedMesh

**As a** frontend developer, **I want** a `<ChipStack>` primitive backed by `InstancedMesh`, **so that** rendering all players' stacks plus the pot stays within a low draw-call budget.

**Acceptance Criteria:**
1. `<ChipStack>` accepts `amount` (float) and `position`, renders a stack of disc instances keyed by chip denomination (White/Red/Green/Black per `alpha-feedback-008`).
2. All chip stacks on the table share a single `InstancedMesh` per denomination — draw calls do not scale linearly with player count.
3. Chips decompose amounts into denominations using the existing chip-denomination constants (no duplication).
4. A test verifies that updating one player's `amount` does not re-create the mesh.

### S-1.5 — Scene Props Contract and Adapter from Hand State

**As a** frontend developer, **I want** a single typed `<PokerTable>` component that accepts a `TableState` prop (hand + players + pot + street), **so that** all existing hand-state shapes map cleanly to the new scene.

**Acceptance Criteria:**
1. A `TableState` TypeScript type is defined in `frontend/src/scenes3d/types.ts` with fields: `communityCards`, `seats[]`, `pot`, `street`, `dealerSeat`, `sbSeat`, `bbSeat`, `currentSeat`.
2. An adapter function `handsToTableState(hands, options)` replaces the existing `handToCardData` / `buildSeatPlayerMap` / `computeStreetIndex` helpers from `TableView3D.tsx`.
3. `<PokerTable state={…}>` renders an equivalent scene to what `pokerScene.ts` produces today (community + hole cards + seat names).
4. Unit tests cover the adapter with representative `HandResponse` fixtures including empty, preflop, flop, turn, river, and showdown hands.

---

## Epic 2: Visual Upgrades — Materials, Animation, Theme

Make the table look and feel premium: realistic felt, lighting, smooth card-deal animation, chip motion, showdown reveal, and a user-switchable theme.

### S-2.1 — Animated Card Dealing (Preflop, Flop, Turn, River)

**As a** viewer, **I want** cards to fly in and flip when dealt instead of appearing instantly, **so that** the table feels alive.

**Acceptance Criteria:**
1. Transitioning `TableState.street` from one value to the next animates the newly revealed card(s) from the deck position to the table, then flips face-up over ≤ 500ms total.
2. Hole cards at hand start deal one per seat in a dealer-rotation order.
3. Animations honor `prefers-reduced-motion` — users with that setting get instant placement.
4. Animations are interruptible — rapid state updates do not leave stale card meshes.

### S-2.2 — Chip Motion on Bets and Calls

**As a** viewer, **I want** chips to slide from a player's stack into the pot when they bet, call, or raise, **so that** I can see the money flow.

**Acceptance Criteria:**
1. When `TableState.seats[i].committedThisStreet` increases, a chip-stack slug animates from the seat into the pot position over ~400ms.
2. The originating `<ChipStack>` visibly shrinks by the committed amount at animation start.
3. Concurrent bets from different seats animate independently without visual interference.
4. Fold does not move chips — the stack stays put and the seat dims (covered in S-3.3).

### S-2.3 — Pot Sweep to Winner at Hand End

**As a** viewer, **I want** the pot to slide to the winning seat at showdown, **so that** the payoff is visually obvious.

**Acceptance Criteria:**
1. When a hand's result resolves with `won` for a specific seat, the pot's chip cluster animates to that seat and merges into their stack over ≤ 800ms.
2. Split pots (multiple `won` seats) split the pot proportionally by their `profit_loss`.
3. After the sweep, the pot chip stack is empty and seat stacks reflect updated amounts.
4. If no showdown occurs (all-fold), the pot still sweeps to the single remaining active seat.

### S-2.4 — Showdown Reveal and Winning Hand Highlight

**As a** viewer, **I want** opponent hole cards to flip face-up at showdown with the winning hand highlighted, **so that** I can see who won and why.

**Acceptance Criteria:**
1. When `TableState.street === 'showdown'`, all non-folded seats' hole cards flip face-up.
2. The winning seat's hole cards + the relevant community cards receive a soft glowing outline for ≥ 3 seconds.
3. The highlight color is driven by the active theme.
4. Hole cards for folded seats remain face-down regardless of street.

### S-2.5 — Premium Table Materials and Lighting

**As a** viewer, **I want** a realistic felt surface with rail, soft shadows, and ambient lighting, **so that** the table looks polished rather than flat-shaded.

**Acceptance Criteria:**
1. Table surface uses a PBR material with a felt normal/roughness map; wood/leather rail is distinct from the playing surface.
2. A key light casts soft shadows beneath cards and chips (shadow quality is subject to the active quality tier — see Epic 6).
3. An environment map or HDRI provides subtle reflections on chip edges and card surfaces.
4. Total added asset weight ≤ 500KB gzipped, and frame budget stays within the mobile target on High quality.

### S-2.6 — Theme System (Dark / Light / Felt Color / Card Back)

**As a** user, **I want** to switch between dark and light modes and pick a felt color and card back, **so that** the table matches my preference and the app's overall theme.

**Acceptance Criteria:**
1. A `ThemeProvider` exposes `{ mode: 'dark'|'light', feltColor, cardBack }` via React context.
2. A settings panel component lets the user pick each option; selection persists via Zustand `persist` middleware.
3. Theme changes apply to material colors, lighting intensity, and the card-back texture without remounting the scene.
4. At least three felt colors and two card-back designs ship in the initial release.

---

## Epic 3: Player Presence & Action State

Make each seat a first-class visual citizen: nameplate, stack, action status, turn indicator, and per-seat equity.

### S-3.1 — Nameplate with Live Stack Amount

**As a** viewer, **I want** each seat to show the player's name and current chip stack in a readable nameplate, **so that** I always know who has how much.

**Acceptance Criteria:**
1. A `<Nameplate>` sprite/HTML billboard renders above each seat showing `player_name` and a formatted stack value.
2. Nameplates face the camera at all times (billboarding).
3. Stack updates animate the numeric value (tween) over ~300ms.
4. Text stays legible on mobile viewports down to 360px wide.

### S-3.2 — Action Status Badge on Nameplate

**As a** viewer, **I want** each seat's last action (check, call, bet $X, raise $X, fold, all-in) displayed on the nameplate, **so that** I can follow the hand without scrolling.

**Acceptance Criteria:**
1. A small badge on the nameplate shows the current-street action label.
2. The badge clears at the start of each new street (except `fold`/`all-in` which persist to hand end).
3. Action data comes from the existing actions endpoint — no new backend required.
4. Unknown or missing action renders no badge (not an "undefined" placeholder).

### S-3.3 — Action Highlights (Fold Dim, Bet Glow, Turn Pulse)

**As a** viewer, **I want** visual cues for seat state — dim for folded, glow for bet/raise, pulse for current-to-act — **so that** the action is readable at a glance on mobile.

**Acceptance Criteria:**
1. Folded seats render at reduced opacity (nameplate + hole cards + chip stack all dimmed).
2. A seat that bet or raised on the current street shows a subtle color-accent glow around the nameplate for ~1.5s.
3. The `currentSeat` (player to act) pulses with a soft ring animation until they act or the street advances.
4. Only one seat pulses at a time; the pulse halts cleanly when the seat changes.

### S-3.4 — Dealer Button and SB/BB Markers with Rotation

**As a** viewer, **I want** the dealer button and SB/BB chips to visibly sit next to the correct seats and animate their rotation between hands, **so that** I can follow position changes.

**Acceptance Criteria:**
1. `<DealerButton>`, `<SmallBlindMarker>`, `<BigBlindMarker>` components render next to seats given by `TableState.dealerSeat`, `sbSeat`, `bbSeat`.
2. When the hand changes and blinds rotate, the markers animate to their new seats over ~600ms.
3. Missing `sbSeat`/`bbSeat` (e.g., heads-up or no-blinds hand) hides the affected marker.
4. Marker positions are consistent with physical poker conventions (dealer button to the right of SB).

### S-3.5 — Per-Seat Equity Overlay Badge

**As a** dealer viewing the table or **a** spectator reviewing playback, **I want** live win-equity percentages rendered above each seat once at least two players have hole cards, **so that** I can see the hand dynamics.

**Scope / gating (strict):**
- **Enabled** in the **dealer embed** ([frontend/src/dealer/TableView3D.tsx](frontend/src/dealer/TableView3D.tsx)) and the **full-page playback route** ([frontend/src/views/PlaybackView.tsx](frontend/src/views/PlaybackView.tsx)).
- **Disabled entirely** in the **player interface** — no equity badge renders for the viewer, opponents, or the pot, regardless of game state. The equity endpoint is **not fetched** from the player interface.

**Acceptance Criteria:**
1. `<PokerTable>` accepts a boolean `equityOverlay` prop (default `false`). Equity badges render only when `equityOverlay === true`.
2. When `equityOverlay === true`, an `<EquityBadge>` renders above each non-folded seat when equity data is available.
3. Equity values come from the existing `GET /games/{gameId}/hands/{handNumber}/equity` endpoint.
4. Values update when community cards change (flop → turn → river) without remounting the scene.
5. When the equity fetch fails, no badges render and no error UI appears in the scene.
6. When `visibilityPolicy === 'player'`, `<PokerTable>` **must** reject `equityOverlay === true` — the prop is ignored (or a dev-only warning is logged) and no equity badges or endpoint calls are made. This is enforced in a unit test.

---

## Epic 4: Camera, Interaction & Replay

Give users precise control over what they're looking at and the ability to replay any hand street-by-street.

### S-4.1 — Camera Preset Buttons (Top-Down, Default Orbit, Cinematic)

**As a** viewer, **I want** quick-access buttons for top-down, default, and cinematic camera angles, **so that** I can pick the view that suits my task without fiddling with orbit.

**Acceptance Criteria:**
1. A toolbar overlay exposes three buttons: Top-Down, Default, Cinematic.
2. Selecting a preset tweens the camera position + target over ~600ms.
3. Cinematic preset performs a slow orbit around the table center until the user interacts.
4. User's manual orbit drag pauses the cinematic preset and returns control.

### S-4.2 — Seat POV Preset

**As a** viewer, **I want** a "seat POV" preset that places the camera behind a chosen seat, **so that** I can experience the table from a player's perspective.

**Acceptance Criteria:**
1. Selecting a seat via a dropdown/menu animates the camera to behind that seat, looking at the community.
2. OrbitControls is constrained to small left/right rotation from that vantage (no flipping behind the seat).
3. Tapping elsewhere or selecting another preset returns to the prior camera state.
4. On the Player interface (Epic 5), seat POV is the default and cannot be changed.

### S-4.3 — Per-Hand Street Scrubber

**As a** viewer, **I want** a scrubber to step the visualization through preflop → flop → turn → river → showdown of the currently selected hand, **so that** I can replay the action without refetching.

**Acceptance Criteria:**
1. A horizontal scrubber UI renders five segments labeled Preflop, Flop, Turn, River, Showdown.
2. Dragging the scrubber updates the scene's `street` in real time and re-runs the deal/chip/reveal animations for that street.
3. Play/pause buttons auto-advance the scrubber at ~1.5s per street.
4. Hands that ended early (e.g., all-fold on the turn) clamp the scrubber to the reached street.
5. The scrubber works on touch (iOS Safari, Android Chrome) with a comfortable tap-target size.

### S-4.4 — Full-Session Replay (Playback Route Only)

**As a** user reviewing a completed game session, **I want** a continuous cross-hand timeline that plays every hand of the session back-to-back with playback-speed controls, **so that** I can watch the whole game unfold without manually selecting each hand.

**Scope note:** This feature is exclusive to the full-page playback route reached by clicking the “▶ Playback” button in [frontend/src/views/DataView.tsx](frontend/src/views/DataView.tsx) (navigates to `#/playback?gameId=<id>` — [frontend/src/views/PlaybackView.tsx](frontend/src/views/PlaybackView.tsx)). The dealer embed ([frontend/src/dealer/TableView3D.tsx](frontend/src/dealer/TableView3D.tsx)) and the player interface ([frontend/src/pages/TableView.tsx](frontend/src/pages/TableView.tsx) at `#/player/table`) **do not** receive this UI — they keep only the per-hand scrubber (S-4.3).

**Acceptance Criteria:**
1. The playback route exposes a **Session Timeline** UI above the per-hand scrubber that spans all hands of the selected game, with each hand represented as a segment sized proportionally to its street count (or fixed-width if preferred, documented in the implementation).
2. A **Play** button auto-advances: it plays the current hand's streets with the S-4.3 per-street timing, then auto-advances to the next hand's preflop and continues, until the session ends or the user pauses.
3. **Playback speed** controls (0.5×, 1×, 2×, 4×) scale both the per-street dwell time (S-4.3) and the inter-hand transition pause. Speed persists in the theme/settings slice per user.
4. Dragging the session timeline jumps directly to any hand; the per-hand scrubber resets to preflop for the landed hand.
5. Inter-hand transitions visibly reset the table state (clear community, rotate blinds via S-3.4, reset chip commitments) before the next hand's deal animation starts.
6. The Session Timeline is **not rendered** when the consumer is the dealer embed or the player interface — it is gated behind a `sessionReplay: boolean` prop on `<PokerTable>` (or an equivalent playback-only wrapper component).
7. The Session Timeline meets the 44×44pt tap-target and 360px-width constraints (Epic 6).

---

## Epic 5: Player Interface POV Restriction

The player-facing view is privacy-gated: a player sees only their own hole cards plus the community. Opponent hole cards are visible only if the opponent reaches showdown with them.

### S-5.1 — Viewer Identity and Visibility Policy

**As a** player using the live interface, **I want** the scene to know who I am and which cards I'm allowed to see, **so that** my view never leaks opponents' information.

**Acceptance Criteria:**
1. `<PokerTable>` accepts an optional `viewerSeat` prop and a `visibilityPolicy` enum with values `spectator` (see all at showdown, all face-down otherwise) and `player` (see own + showdown-reached opponents only).
2. When `visibilityPolicy === 'player'`, all non-viewer hole cards render face-down unless both: (a) the hand is at `showdown`, and (b) the opposing seat did not fold.
3. A unit test covers each combination: own cards (always visible), folded opponent (never visible), showdown opponent (visible at showdown), in-progress opponent (hidden).
4. The visibility policy has no effect on community cards — those follow `street` only.

### S-5.2 — Seat-Locked Camera for Player View

**As a** player, **I want** the camera locked to my seat's POV with limited orbit, **so that** the experience feels like sitting at the table.

**Acceptance Criteria:**
1. When `visibilityPolicy === 'player'`, the camera initializes at the viewer's seat POV (S-4.2).
2. OrbitControls is constrained to ±30° yaw and limited pitch; zoom range is tightened to prevent seeing behind opponents.
3. Camera preset buttons are hidden.
4. Double-tap resets to default seat POV.

### S-5.3 — Player-Scoped Action UI (No Equity)

**As a** player, **I want** action highlights and nameplates for all players but **no equity overlay at all**, **so that** I get the tactical information I need without seeing opponent hole cards and without the app leaking equity (which can be back-solved to infer opponent ranges).

**Acceptance Criteria:**
1. No `<EquityBadge>` renders in player mode — not for the viewer, not for opponents, not for the pot. The equity endpoint is never fetched while mounted in player mode.
2. Action highlights (S-3.3) and nameplates (S-3.1, S-3.2) render for all seats.
3. Dealer button / SB / BB markers (S-3.4) render unchanged.
4. No UI path in player mode exposes opponent hole-card values (verified by a test that asserts only viewer's seat cards have `faceUp === true` while street < showdown).
5. The `equityOverlay` prop passed into `<PokerTable>` from the player interface is hard-coded to `false`; wiring it to `true` is prevented via a runtime guard when `visibilityPolicy === 'player'` (see S-3.5 AC #6).

---

## Epic 6: Performance & Mobile Budget

Keep the frame budget tight on mobile: instrument, degrade automatically when overloaded, and expose a manual quality knob.

### S-6.1 — Manual Quality Setting (Low / Medium / High)

**As a** user on varied hardware, **I want** a Low/Medium/High quality toggle in the settings panel, **so that** I can trade visual fidelity for frame rate on my device.

**Acceptance Criteria:**
1. A `qualityTier` setting (`low`|`medium`|`high`) is stored in Zustand with `persist`.
2. Each tier controls at minimum: shadow enable/quality, light count, DPR cap, PBR material vs simplified shader, anti-aliasing.
3. High is the default on desktop; Medium is the default on mobile (viewport width ≤ 768px on first visit).
4. Changing the tier applies without reloading the page.

### S-6.2 — FPS Monitor with Auto-Degrade Below 30fps

**As a** user on an older phone, **I want** the scene to automatically drop to a lower quality tier when FPS sustains below 30, **so that** the experience stays playable without me touching settings.

**Acceptance Criteria:**
1. An FPS sampler computes a 2-second rolling average.
2. When the average falls below 30fps for ≥ 3 seconds at High, the tier auto-drops to Medium; from Medium, drops to Low.
3. The user is notified via a small transient toast that quality was adjusted.
4. Manual override (S-6.1) overrides and locks the auto-degrade logic for that session.

### S-6.3 — Mobile Touch Controls and Layout

**As a** mobile user, **I want** pinch-zoom, single-finger orbit, and tap targets sized for touch, **so that** the 3D view is comfortable on my phone.

**Acceptance Criteria:**
1. OrbitControls touch gestures work on iOS Safari and Android Chrome (pinch-zoom, one-finger orbit, two-finger pan).
2. All UI overlays (toolbar, scrubber, settings) meet a minimum 44×44pt tap target.
3. The canvas and overlays remain legible at 360px viewport width with no horizontal scrolling.
4. Device orientation changes resize the canvas without quality regression or flicker.

---

## Epic 7: Consumer Integration & Cleanup

Swap each consumer of the old `pokerScene.ts` over to `<PokerTable>`, then delete the vanilla module.

### S-7.1 — Dealer HandDashboard Embed Migration

**As a** dealer, **I want** the embedded 3D view in HandDashboard to use the new R3F scene with all Epic 2–4 features, **so that** live dealing gains the full visual upgrade.

**Acceptance Criteria:**
1. `frontend/src/dealer/TableView3D.tsx` is rewritten (or replaced) to render `<PokerTable>` with dealer (spectator) visibility policy.
2. All existing tests in `frontend/test/dealer/TableView3D.test.tsx` continue to pass (or are updated to reflect the new internal structure while preserving behavioral guarantees — no-leak, renders-canvas, updates-on-hand-change).
3. The embed honors `min(400px, 50vh)` container sizing.
4. Equity, action highlights, and theme all work in the embed.

### S-7.2 — Full-Page Playback Migration

**As a** user reviewing past hands, **I want** the playback route to use the new scene, **so that** I get the scrubber, camera presets, animated replay, and full-session replay.

**Acceptance Criteria:**
1. `frontend/src/views/PlaybackView.tsx` renders `<PokerTable>` + toolbar + per-hand scrubber + **Session Timeline** (S-4.4).
2. Hand-selection UI feeds the selected hand into the scene and resets the per-hand scrubber to preflop.
3. Camera preset buttons (S-4.1), theme toggle (S-2.6), and playback-speed controls (S-4.4) are available in this view.
4. Visibility policy is `spectator` (full information).
5. Navigating from a game session row in the dashboard into this route arrives with the correct `gameId`, loads all hands, and the Session Timeline is populated and ready to play.

### S-7.3 — Player Interface Integration

**As a** player joining a live game, **I want** the player interface to show a POV-restricted 3D view with my own hole cards and community cards, **so that** I can follow the hand on my phone.

**Acceptance Criteria:**
1. The player interface route renders `<PokerTable>` with `visibilityPolicy='player'` and `viewerSeat` bound to the player's session seat.
2. Equity shows only for the viewer (S-5.3).
3. Seat POV camera lock is applied (S-5.2).
4. Nameplates and action highlights render for all seats.

### S-7.4 — Delete Vanilla `pokerScene.ts` and Dead Code

**As a** maintainer, **I want** the legacy `pokerScene.ts`, its tests, and the `handToCardData`-style helpers removed once all consumers are migrated, **so that** the codebase has a single 3D source of truth.

**Acceptance Criteria:**
1. `frontend/src/scenes/pokerScene.ts` and `frontend/test/scenes/pokerScene.test.ts` are deleted.
2. No runtime imports reference the old module (verified by `grep`).
3. The full frontend test suite passes.
4. A short migration note is added to `docs/frontend/architecture.md`'s 3D rendering section pointing to the new R3F scene.
