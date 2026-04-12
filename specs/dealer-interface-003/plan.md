# Plan — Dealer Interface

**Project ID:** dealer-interface-003
**Date:** 2026-04-07
**Status:** Draft

---

## Overview

Build a mobile-first dealer interface accessible at `#/dealer` within the existing Vite frontend. The interface walks a dealer through creating a game, photographing each player's hole cards and the community cards using the device's native camera, reviewing model detections with correction capability, and submitting each completed hand to the backend. Preact is introduced for the dealer views to handle the multi-step stateful UI, while existing vanilla JS views remain untouched.

---

## Tech Stack & Tools

| Technology | Purpose |
|---|---|
| Preact (~3KB) | Lightweight component framework for the dealer interface's stateful multi-step UI |
| Vite (existing) | Build tool — extended with JSX/esbuild config for Preact |
| `<input capture>` HTML5 | Native camera access on mobile — no getUserMedia complexity |
| FastAPI (existing) | Backend — existing image upload, detection, and hand creation endpoints |
| SQLAlchemy (existing) | ORM — no schema changes needed |
| YOLO / MockCardDetector (existing) | Card detection model already wired into the image routes |

---

## Architecture Components

### Dealer Preact App

A self-contained Preact component tree mounted at `#/dealer`. Uses Preact's `useState`/`useReducer` for step-by-step state management. Renders inside the existing `#app` container via the hash router.

### Dealer State Machine

Manages the multi-step flow: `create-game` → `hand-dashboard` → `player-grid` → `camera-capture` → `detection-review` → (loop per player) → `submit-hand` → `hand-dashboard`. State includes the active game ID, per-player card assignments, community card assignments, and checkmark tracking.

### API Integration Layer

New functions added to `frontend/src/api/client.js` for image upload (`uploadImage`) and detection results (`getDetectionResults`). The existing `createSession()` and `createHand()` functions are reused as-is.

### Card Picker Component

A reusable dropdown/grid for selecting a card from the standard 52-card deck (4 suits × 13 ranks). Used in the detection correction flow when the dealer needs to fix a misdetection.

---

## Project Phases

### Phase 1: Foundation (Preact + Route)

Wire Preact into the Vite build. Register `#/dealer` as a new route. Render a placeholder dealer view that proves the Preact → Vite → Router integration works end-to-end.

**Deliverables:**
- Preact installed and configured in Vite
- `#/dealer` route renders a Preact root component
- Existing views unaffected

### Phase 2: Game Creation

Build the game creation form — date picker, player selection, inline player creation, and the POST to create a game session.

**Deliverables:**
- Game creation form component
- Player selection with fetch from API
- Inline new-player creation
- Navigation to Hand Dashboard on success

### Phase 3: Hand Dashboard & Player Grid

Build the dashboard that shows game info and hand count, and the player grid with tappable icons and checkmark tracking.

**Deliverables:**
- Hand Dashboard view with hand count and "Enter Hand" / "Add Hand" buttons
- Player Grid with icons, checkmarks, and Table icon
- State management for per-player card tracking

### Phase 4: Camera Capture & Detection

Wire up native camera input, image upload to backend, detection result retrieval, and the detection review/correction UI.

**Deliverables:**
- Native camera trigger via `<input type="file" capture>`
- Image upload + detection result fetching
- Detection review display with confidence scores
- Card correction picker

### Phase 5: Hand Submission & Polish

Assemble the accumulated state into a `HandCreate` payload, submit via existing endpoint, handle errors, and reset for the next hand.

**Deliverables:**
- Payload assembly from accumulated state
- Frontend duplicate-card validation
- Submit hand + navigate back to dashboard
- Loading states and error handling

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Native `<input capture>` behavior varies across mobile browsers/OS versions | Test on iOS Safari and Android Chrome; both support `capture="environment"` for rear camera. Fallback to standard file picker if capture attribute unsupported. |
| Card detection model accuracy may be low for real-world photos (lighting, angle) | Detection review + correction UI lets dealer fix mistakes. Confidence threshold can flag low-confidence detections. |
| Preact JSX compilation conflicts with existing vanilla JS build | Preact components live in a separate `src/dealer/` directory with `.jsx` extensions; Vite scopes JSX transform to those files only. |
| Mobile network latency on local WiFi for image upload | Show loading indicators. Images are typically <2MB (phone cameras auto-compress for web uploads). Can add client-side resize if needed. |
| Community card photo with 5 cards may confuse the model (more objects) | Model already trained on multi-card scenes. Detection review lets dealer correct any issues. |

---

## External Dependencies

- Device with camera-capable mobile browser (iOS Safari 11+, Android Chrome 60+)
- Backend FastAPI server running on local network and accessible from the device
- Card detection model (`CardDetector`) deployed and functional on the backend
