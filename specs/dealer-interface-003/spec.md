# Spec — Dealer Interface

**Project ID:** dealer-interface-003
**Date:** 2026-04-07
**Status:** Draft
**Scope:** Mobile-first dealer interface for camera-based card recording during live poker sessions

---

## Table of Contents

1. [Epic 1: Dealer Route & Preact Integration](#epic-1-dealer-route--preact-integration)
2. [Epic 2: Game Creation Flow](#epic-2-game-creation-flow)
3. [Epic 3: Hand Management Dashboard](#epic-3-hand-management-dashboard)
4. [Epic 4: Player Grid & Card Capture](#epic-4-player-grid--card-capture)
5. [Epic 5: Community Card Capture](#epic-5-community-card-capture)
6. [Epic 6: Detection Review & Correction](#epic-6-detection-review--correction)
7. [Epic 7: Hand Submission](#epic-7-hand-submission)

---

## Epic 1: Dealer Route & Preact Integration

Add Preact as a dependency and wire up a new `#/dealer` hash route in the existing Vite app. The dealer interface is rendered entirely by Preact while existing vanilla JS views remain untouched.

### S-1.1 — Install Preact & Configure Vite

**As a** developer, **I want** Preact installed and aliased in the Vite config, **so that** I can write JSX components for the dealer interface without affecting existing vanilla JS views.

**Acceptance Criteria:**
1. `preact` is added to `package.json` dependencies
2. Vite config includes JSX/esbuild settings targeting Preact's `h` function
3. `npm run dev` and `npm run build` both succeed without errors
4. Existing `#/playback` and `#/data` views remain functional

---

### S-1.2 — Dealer Route Registration

**As a** dealer, **I want** to navigate to `#/dealer` to reach the dealer interface, **so that** the dealer workflow is accessible alongside existing views.

**Acceptance Criteria:**
1. `#/dealer` is registered in the router and renders a Preact-mounted container
2. A "Dealer" link appears in the navigation bar
3. Navigating to `#/dealer` renders the dealer root component
4. Navigating away from `#/dealer` unmounts Preact cleanly (no memory leaks)

---

## Epic 2: Game Creation Flow

Provide a single-screen form where the dealer creates a new game session by selecting a date and picking players — one button press starts the session.

### S-2.1 — Game Creation Form

**As a** dealer, **I want** a form with date picker and player selection, **so that** I can start a new game session with one tap.

**Acceptance Criteria:**
1. The form displays a date input defaulting to today
2. A player list is fetched from `GET /players` and displayed as selectable chips/toggles
3. The dealer can select 2–10 players
4. A "Create Game" button calls `POST /games` with the selected date and player names
5. Validation prevents submission with fewer than 2 players
6. On success, the dealer is navigated to the Hand Management Dashboard

---

### S-2.2 — Inline Player Creation

**As a** dealer, **I want** to add a new player name inline if they're not in the system, **so that** I don't have to leave the game creation flow to register a new player.

**Acceptance Criteria:**
1. A text input + "Add" button appears below the player list
2. Submitting calls `POST /players` and adds the new player to the selectable list
3. The newly created player is auto-selected
4. Duplicate names show an inline error

---

## Epic 3: Hand Management Dashboard

After game creation, the dealer sees a persistent dashboard that tracks hand progression and provides entry points for recording new hands.

### S-3.1 — Hand Dashboard View

**As a** dealer, **I want** to see a dashboard showing the current game status and hand count, **so that** I know how many hands have been recorded and can start a new one.

**Acceptance Criteria:**
1. The dashboard displays the game date, player names, and total hands recorded
2. Two buttons are shown: "Enter First Hand" (when 0 hands) or "Add New Hand" (when ≥1 hand)
3. Both buttons navigate to the Player Grid view
4. The dashboard refreshes hand count after each hand submission

---

### S-3.2 — Return to Dashboard After Hand Submission

**As a** dealer, **I want** to return to the dashboard after submitting a hand, **so that** I can immediately start recording the next hand.

**Acceptance Criteria:**
1. After a successful hand submission, the dealer is navigated back to the dashboard
2. The hand count is incremented
3. The button text updates to "Add New Hand"

---

## Epic 4: Player Grid & Card Capture

Display all game players as tappable icons on a grid. Tapping a player opens the native camera to photograph their hole cards, uploads the photo, and runs card detection.

### S-4.1 — Player Grid View

**As a** dealer, **I want** to see all players in the current game as tappable icons/cards, **so that** I can select which player's cards to photograph.

**Acceptance Criteria:**
1. Each player is shown as a labeled tile/icon (name + avatar placeholder)
2. Players with recorded cards display a green checkmark overlay
3. Players without recorded cards are visually distinct (no checkmark)
4. A "Table" icon is displayed above or before the player icons for community cards
5. The grid is mobile-friendly (large tap targets, wrapping layout)

---

### S-4.2 — Native Camera Capture for Hole Cards

**As a** dealer, **I want** to tap a player and take a photo of their cards using the native camera, **so that** the cards can be detected by the backend model.

**Acceptance Criteria:**
1. Tapping a player opens an `<input type="file" accept="image/*" capture="environment">` control
2. After the dealer takes/selects a photo, the image is uploaded via `POST /games/{game_id}/hands/image`
3. Detection results are fetched via `GET /games/{game_id}/hands/image/{upload_id}`
4. A loading indicator is shown during upload and detection
5. On success, the dealer is shown the Detection Review screen for that player

---

### S-4.3 — Player Card State Tracking

**As a** dealer, **I want** recorded cards to persist in local state as I move between players, **so that** I don't lose progress while recording a hand.

**Acceptance Criteria:**
1. Detected (and optionally corrected) cards for each player are stored in component state
2. Navigating between players does not reset already-recorded cards
3. The player grid reflects current state (checkmarks for recorded, empty for pending)
4. State is reset when a new hand starts

---

## Epic 5: Community Card Capture

A dedicated "Table" icon on the player grid allows the dealer to photograph all community cards (flop + turn + river) in a single shot at the end of the hand.

### S-5.1 — Community Card Camera Capture

**As a** dealer, **I want** to tap the Table icon and photograph the community cards, **so that** the flop, turn, and river are recorded via model detection.

**Acceptance Criteria:**
1. Tapping the Table icon triggers the same native camera flow as player capture
2. The image is uploaded to `POST /games/{game_id}/hands/image`
3. Detection results are fetched and shown on the Detection Review screen
4. The Table icon shows a checkmark once community cards are confirmed
5. Up to 5 cards are expected (3 flop + 1 turn + 1 river)

---

## Epic 6: Detection Review & Correction

After each photo is processed, the dealer reviews the model's card predictions and can correct any misdetections before confirming.

### S-6.1 — Detection Results Display

**As a** dealer, **I want** to see the detected card values after taking a photo, **so that** I can verify the model's predictions.

**Acceptance Criteria:**
1. Detected cards are displayed as labeled card representations (e.g., "A♥", "K♦")
2. Confidence scores are shown alongside each detection
3. The original photo is displayed for reference
4. For player captures, exactly 2 cards are expected
5. For community captures, 3–5 cards are expected

---

### S-6.2 — Card Correction Interface

**As a** dealer, **I want** to tap a detected card and change its value, **so that** I can fix any misdetections before confirming.

**Acceptance Criteria:**
1. Tapping a card opens a picker with all 52 card options (rank + suit)
2. The selected correction replaces the detected value in local state
3. The original detected value is visually distinguished from corrected values
4. A "Confirm" button saves the (corrected) cards to the hand's local state and returns to the Player Grid

---

## Epic 7: Hand Submission

Once all players and community cards have been recorded, the dealer submits the complete hand to the backend in a single request.

### S-7.1 — Submit Hand Button

**As a** dealer, **I want** a "Submit Hand" button that appears when all cards are recorded, **so that** I can finalize the hand and persist it to the database.

**Acceptance Criteria:**
1. The "Submit Hand" button is enabled only when all players AND community cards have checkmarks
2. Pressing it sends `POST /games/{game_id}/hands` with the accumulated `HandCreate` payload (community cards + player entries)
3. On success, local state is cleared and the dealer returns to the Hand Dashboard
4. On error, an inline message is displayed and the dealer can retry
5. The button is disabled during submission to prevent double-submits

---

### S-7.2 — Hand Submission Payload Assembly

**As a** dealer, **I want** the frontend to assemble detection results into the correct API payload, **so that** the hand is persisted correctly.

**Acceptance Criteria:**
1. Community cards map to `flop_1`, `flop_2`, `flop_3`, `turn`, `river` fields
2. Each player's cards map to a `PlayerHandEntry` with `player_name`, `card_1`, `card_2`
3. Card values use the `Card` enum format expected by the backend (e.g., `"AH"`, `"KD"`)
4. Duplicate card validation runs on the frontend before submission
