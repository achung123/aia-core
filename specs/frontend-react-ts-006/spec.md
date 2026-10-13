# Spec — Frontend React + TypeScript Migration

**Project ID:** frontend-react-ts-006
**Date:** 2025-04-11
**Status:** Draft

---

## Table of Contents

1. [Epic 1: Project Scaffolding & Build Tooling](#epic-1-project-scaffolding--build-tooling)
2. [Epic 2: Core Infrastructure Migration](#epic-2-core-infrastructure-migration)
3. [Epic 3: Dealer Interface Migration](#epic-3-dealer-interface-migration)
4. [Epic 4: Playback & Data Views Migration](#epic-4-playback--data-views-migration)
5. [Epic 5: Player & Mobile Views Migration](#epic-5-player--mobile-views-migration)
6. [Epic 6: Three.js Scene TypeScript Conversion](#epic-6-threejs-scene-typescript-conversion)
7. [Epic 7: Testing Infrastructure & Coverage](#epic-7-testing-infrastructure--coverage)
8. [Epic 8: Docker & CI Integration](#epic-8-docker--ci-integration)

---

## Epic 1: Project Scaffolding & Build Tooling

Set up the new TypeScript + React project foundation — `tsconfig.json`, Vite config, package dependencies, and strict linting — so that all subsequent migration work builds on a clean, typed base.

### S-1.1 — TypeScript + React Vite Project Setup

**As a** developer, **I want** the frontend project initialized with React, TypeScript (strict mode), and Vite, **so that** all new and migrated code is type-checked from the start.

**Acceptance Criteria:**
1. `package.json` replaces `preact` and `@preact/preset-vite` with `react`, `react-dom`, `@vitejs/plugin-react`, and `typescript`
2. `tsconfig.json` exists with `strict: true`, `jsx: "react-jsx"`, and path aliases matching the project layout
3. `vite.config.ts` uses `@vitejs/plugin-react` instead of the Preact preset
4. `npm run dev` starts successfully and renders a placeholder page
5. `npm run build` produces a production bundle with zero TS errors

### S-1.2 — ESLint + Prettier TypeScript Configuration

**As a** developer, **I want** ESLint configured with `@typescript-eslint` and React rules, **so that** code quality is enforced consistently during migration.

**Acceptance Criteria:**
1. ESLint config extends `@typescript-eslint/recommended` and `plugin:react/recommended`
2. Unused variables, `any` usage, and missing return types are flagged as errors
3. `npm run lint` passes with zero errors on the scaffolded project

### S-1.3 — CSS Modules Setup

**As a** developer, **I want** CSS Modules enabled in the Vite build, **so that** component styles are scoped and don't leak globally.

**Acceptance Criteria:**
1. Vite resolves `*.module.css` imports with scoped class names
2. A TypeScript declaration file (`*.module.css.d.ts` or a global declaration) exists so TS doesn't error on CSS imports
3. The existing `style.css` global styles remain functional alongside module CSS

---

## Epic 2: Core Infrastructure Migration

Migrate the foundational layers — API client, router, and state management — from vanilla JS/Preact to typed React equivalents.

### S-2.1 — API Client TypeScript Conversion

**As a** developer, **I want** `api/client.js` converted to a fully-typed TypeScript module, **so that** all API calls have typed request/response shapes and compile-time safety.

**Acceptance Criteria:**
1. `api/client.ts` exports all existing functions with typed parameters and return types
2. Response types are defined as TypeScript interfaces matching the backend's Pydantic models
3. All existing API tests pass after migration to the new typed client

### S-2.2 — React Router Integration

**As a** developer, **I want** the custom hash router replaced with React Router, **so that** routing is declarative, supports nested routes, and has access to typed route params.

**Acceptance Criteria:**
1. `react-router-dom` is installed and configured with a `HashRouter` (preserving existing URL scheme)
2. All 5 existing routes (`/`, `/playback`, `/data`, `/dealer`, `/player`) are defined as `<Route>` elements
3. Navigation links use `<Link>` or `<NavLink>` components
4. The "active dealer game" navigation guard logic is preserved (disabling playback link during active game)
5. The custom `router.js` and its test are removed

### S-2.3 — Zustand State Management

**As a** developer, **I want** the dealer state machine migrated from `useReducer` + sessionStorage to a typed Zustand store, **so that** state is accessible from any component without prop drilling and persists across page refreshes.

**Acceptance Criteria:**
1. A `dealerStore.ts` defines the full dealer state shape with TypeScript interfaces
2. All reducer actions from `dealerState.js` are re-implemented as Zustand actions
3. `sessionStorage` persistence is handled via Zustand's `persist` middleware
4. The `dealer-state-change` custom event mechanism is replaced by Zustand's subscription/selector model
5. All existing dealer state tests pass against the new store

---

## Epic 3: Dealer Interface Migration

Convert the dealer workflow — the largest and most complex feature area (15 component + logic files) — from Preact JSX to React TSX.

### S-3.1 — Dealer App Shell & Navigation

**As a** developer, **I want** `DealerApp.jsx` converted to a React TSX component using the new Zustand store and React Router, **so that** the dealer workflow renders correctly within the new architecture.

**Acceptance Criteria:**
1. `DealerApp.tsx` renders all dealer steps using the Zustand store instead of `useReducer`
2. `sessionStorage` save/restore logic is removed (handled by Zustand persist middleware)
3. All child component imports reference the new `.tsx` files
4. The component renders without runtime errors in the dev server

### S-3.2 — Game Selection & Creation Components

**As a** developer, **I want** `GameSelector.jsx` and `GameCreateForm.jsx` converted to typed React TSX, **so that** game session creation flow is fully typed.

**Acceptance Criteria:**
1. Both components are `.tsx` files with typed props interfaces
2. API calls use the typed client functions
3. Form state and callbacks are typed
4. Existing test coverage is preserved in new `.test.tsx` files

### S-3.3 — Hand Dashboard & Player Grid

**As a** developer, **I want** `HandDashboard.jsx` and `PlayerGrid.jsx` converted to React TSX, **so that** the core dealer hand management UI is typed and rendered via React.

**Acceptance Criteria:**
1. Both components are `.tsx` files with fully-typed props
2. Player state reads come from the Zustand store
3. Event handlers and API interactions are typed
4. Existing tests migrate to React Testing Library

### S-3.4 — Camera, Detection & Card Picker Components

**As a** developer, **I want** `CameraCapture.jsx`, `DetectionReview.jsx`, and `CardPicker.jsx` converted to React TSX, **so that** the card detection workflow is typed.

**Acceptance Criteria:**
1. All three components are `.tsx` files with typed props
2. Camera/media API interactions have proper TypeScript types
3. Detection result data structures are typed interfaces
4. Existing tests pass with React Testing Library

### S-3.5 — Outcome, Preview & QR Components

**As a** developer, **I want** `OutcomeButtons.jsx`, `DealerPreview.jsx`, and `QRCodeDisplay.jsx` converted to React TSX, **so that** the full dealer workflow is complete in the new stack.

**Acceptance Criteria:**
1. All three components are `.tsx` files with typed props
2. `QRCodeDisplay` uses the `qrcode` library with proper TS types
3. `OutcomeButtons` outcome validation logic is typed
4. All existing tests pass with React Testing Library

### S-3.6 — Dealer State Logic & Hand Payload Utilities

**As a** developer, **I want** `dealerState.js` and `handPayload.js` converted to TypeScript, **so that** all dealer business logic benefits from type safety.

**Acceptance Criteria:**
1. `dealerState.ts` exports typed reducer, initial state, and validation functions (now consumed by Zustand store)
2. `handPayload.ts` exports typed payload builder functions
3. All existing unit tests pass after conversion
4. No `any` types except where strictly necessary for third-party interop

---

## Epic 4: Playback & Data Views Migration

Convert the playback, data dashboard, and landing page views — including the vanilla DOM components — to React TSX.

### S-4.1 — Landing Page Conversion

**As a** developer, **I want** `LandingPage.jsx` converted to React TSX, **so that** the app entry point renders as a React component.

**Acceptance Criteria:**
1. `LandingPage.tsx` uses React hooks instead of Preact hooks
2. Navigation links use React Router's `<Link>` components
3. Dealer game active state reads from the Zustand store (replacing sessionStorage polling)
4. Inline styles are migrated to a CSS module

### S-4.2 — Playback View Conversion

**As a** developer, **I want** `playbackView.js` and `MobilePlaybackView.jsx` converted to React TSX, **so that** the Three.js poker scene playback works within the React component tree.

**Acceptance Criteria:**
1. Both files are `.tsx` with typed props and state
2. Three.js scene lifecycle (create, update, dispose) is managed via `useEffect` and `useRef`
3. Scrubber integration reads from the typed API client
4. Existing test passes with React Testing Library

### S-4.3 — Data View Conversion

**As a** developer, **I want** `dataView.js` (vanilla DOM) converted to a React TSX component, **so that** the data dashboard is part of the React component tree.

**Acceptance Criteria:**
1. `DataView.tsx` replaces the imperative DOM construction with JSX
2. All data fetching uses the typed API client
3. The component supports the same session/hand browsing functionality as the original

### S-4.4 — Vanilla UI Components Conversion

**As a** developer, **I want** the 9 files in `components/` (sessionForm, handRecordForm, handEditForm, playerManagement, sessionScrubber, streetScrubber, statsSidebar, resultOverlay, equityOverlay) converted from vanilla DOM manipulation to React TSX components with CSS Modules, **so that** the codebase has a uniform React component model.

**Acceptance Criteria:**
1. Each vanilla component is replaced by a `.tsx` file with typed props
2. `document.createElement` / `appendChild` patterns are replaced with JSX
3. Inline styles are extracted to CSS modules
4. Components integrate with the typed API client and Zustand store where applicable

---

## Epic 5: Player & Mobile Views Migration

Convert the player-facing and mobile-optimized components.

### S-5.1 — Player App Conversion

**As a** developer, **I want** `PlayerApp.jsx` converted to React TSX, **so that** the player participation interface is typed and rendered via React.

**Acceptance Criteria:**
1. `PlayerApp.tsx` is a typed React component
2. Route params (if any) are accessed via React Router hooks
3. Existing test passes with React Testing Library

### S-5.2 — Mobile Components Conversion

**As a** developer, **I want** `EquityRow.jsx`, `SessionScrubber.jsx`, and `StreetScrubber.jsx` (mobile/) converted to React TSX, **so that** mobile views are part of the typed React codebase.

**Acceptance Criteria:**
1. All three components are `.tsx` with typed props interfaces
2. Existing tests pass with React Testing Library
3. Mobile-specific styling uses CSS Modules

---

## Epic 6: Three.js Scene TypeScript Conversion

Convert the 7 Three.js scene files to TypeScript for full type coverage.

### S-6.1 — Scene Core & Table Geometry

**As a** developer, **I want** `pokerScene.js` and `tableGeometry.js` converted to TypeScript, **so that** the 3D scene setup and table geometry have typed interfaces.

**Acceptance Criteria:**
1. Both files are `.ts` with typed function parameters and return types
2. Three.js types from `@types/three` are used throughout
3. `createPokerScene` returns a typed object with scene, camera, renderer, etc.
4. Existing poker scene tests pass

### S-6.2 — Card, Chip & Visual Element Modules

**As a** developer, **I want** `cards.js`, `chipStacks.js`, `communityCards.js`, `holeCards.js`, and `table.js` converted to TypeScript, **so that** all scene visual modules are fully typed.

**Acceptance Criteria:**
1. All 5 files are `.ts` with typed exports
2. Three.js mesh/group/material types are explicit
3. No `any` types for Three.js objects
4. Scene integration continues to work end-to-end

---

## Epic 7: Testing Infrastructure & Coverage

Set up React Testing Library, migrate all existing tests, and ensure coverage parity.

### S-7.1 — Test Infrastructure Setup

**As a** developer, **I want** Vitest configured with React Testing Library and `jsdom`/`happy-dom`, **so that** React component tests can render and query the DOM.

**Acceptance Criteria:**
1. `@testing-library/react` and `@testing-library/jest-dom` are installed
2. Vitest config uses `happy-dom` (or `jsdom`) environment
3. A sample component test renders and passes
4. `npm run test` executes successfully

### S-7.2 — Test Migration & Coverage Parity

**As a** developer, **I want** all existing Vitest tests migrated from Preact rendering to React Testing Library, **so that** test coverage is preserved across the migration.

**Acceptance Criteria:**
1. All `*.test.jsx` files are converted to `*.test.tsx`
2. Preact `render(h(Component))` calls are replaced with RTL's `render(<Component />)`
3. `preact/hooks` test utilities are replaced with React equivalents
4. Test count and pass rate match or exceed pre-migration levels

---

## Epic 8: Docker & CI Integration

Update build and deployment infrastructure for the new stack.

### S-8.1 — Dockerfile & docker-compose Updates

**As a** developer, **I want** the frontend `Dockerfile` and `docker-compose.yml` updated for the React + TS build, **so that** containerized development and deployment work with the new stack.

**Acceptance Criteria:**
1. `Dockerfile` builds the TypeScript frontend successfully
2. `docker-compose.yml` volume mounts include `tsconfig.json` and any new config files
3. `npm run dev` inside the container serves the React app with hot reload
4. `npm run build` inside the container produces a production-ready `dist/`

### S-8.2 — CI Pipeline Validation

**As a** developer, **I want** the CI pipeline updated to run TypeScript type-checking, linting, and tests for the frontend, **so that** regressions are caught before merge.

**Acceptance Criteria:**
1. CI runs `npx tsc --noEmit` (type check)
2. CI runs `npm run lint` (ESLint)
3. CI runs `npm run test` (Vitest)
4. All three checks pass on the migration branch before merge to main

### S-8.3 — Cleanup & Old Code Removal

**As a** developer, **I want** all original `.js` and `.jsx` source files removed and the migration branch verified clean, **so that** no dead Preact code remains in the codebase.

**Acceptance Criteria:**
1. No `.js` or `.jsx` files remain in `frontend/src/` (except config files if needed)
2. No Preact imports exist in the codebase
3. `package.json` has no Preact dependencies
4. Full test suite passes after cleanup
5. Production build succeeds
