# Tasks — Frontend React + TypeScript Migration

**Project ID:** frontend-react-ts-006
**Date:** 2025-04-11
**Total Tasks:** 28
**Status:** Draft

---

## Task Index

| ID | Title | Category | Dependencies | Story Ref |
|---|---|---|---|---|
| T-001 | Create migration branch | setup | none | S-1.1 |
| T-002 | Swap Preact deps for React + TypeScript | setup | T-001 | S-1.1 |
| T-003 | Configure tsconfig.json (strict) | setup | T-002 | S-1.1 |
| T-004 | Configure Vite for React + TS | setup | T-002 | S-1.1 |
| T-005 | Set up ESLint + CSS Modules | setup | T-003, T-004 | S-1.2, S-1.3 |
| T-006 | Convert API client to TypeScript | refactor | T-003 | S-2.1 |
| T-007 | Implement React Router | refactor | T-004 | S-2.2 |
| T-008 | Implement Zustand dealer store | refactor | T-006 | S-2.3 |
| T-009 | Convert poker evaluator to TypeScript | refactor | T-003 | S-3.6 |
| T-010 | Convert dealer state & hand payload to TS | refactor | T-008 | S-3.6 |
| T-011 | Convert GameSelector + GameCreateForm to TSX | refactor | T-008, T-006 | S-3.2 |
| T-012 | Convert HandDashboard + PlayerGrid to TSX | refactor | T-008, T-006 | S-3.3 |
| T-013 | Convert CameraCapture + DetectionReview to TSX | refactor | T-008 | S-3.4 |
| T-014 | Convert CardPicker + OutcomeButtons to TSX | refactor | T-008 | S-3.4, S-3.5 |
| T-015 | Convert DealerPreview + QRCodeDisplay to TSX | refactor | T-008 | S-3.5 |
| T-016 | Convert DealerApp shell to TSX | refactor | T-011, T-012, T-013, T-014, T-015 | S-3.1 |
| T-017 | Convert LandingPage to TSX | refactor | T-007, T-008 | S-4.1 |
| T-018 | Convert vanilla DOM components to React TSX (batch 1: forms) | refactor | T-006, T-007 | S-4.4 |
| T-019 | Convert vanilla DOM components to React TSX (batch 2: overlays & sidebars) | refactor | T-006, T-007 | S-4.4 |
| T-020 | Convert playbackView + MobilePlaybackView to TSX | refactor | T-007, T-006 | S-4.2 |
| T-021 | Convert dataView to React TSX | refactor | T-006, T-007 | S-4.3 |
| T-022 | Convert PlayerApp + mobile components to TSX | refactor | T-007, T-006 | S-5.1, S-5.2 |
| T-023 | Convert Three.js scene core to TypeScript | refactor | T-003 | S-6.1 |
| T-024 | Convert Three.js visual modules to TypeScript | refactor | T-023 | S-6.2 |
| T-025 | Set up React Testing Library + migrate test infra | test | T-004 | S-7.1 |
| T-026 | Migrate all component tests to RTL | test | T-025, T-016, T-022 | S-7.2 |
| T-027 | Update Dockerfile + docker-compose | infra | T-004 | S-8.1, S-8.2 |
| T-028 | Final cleanup: remove JS/JSX, verify zero Preact refs | refactor | T-026, T-027 | S-8.3 |

---

## Task Details

### T-001 — Create migration branch

**Category:** setup
**Dependencies:** none
**Story Ref:** S-1.1

Create a new feature branch off `achung/player-participation-005` for the full frontend migration. This is the working branch for all subsequent tasks.

**Acceptance Criteria:**
1. Branch `frontend-react-ts-006` (or similar) exists, forked from `achung/player-participation-005`
2. Branch is checked out locally and pushed to remote

---

### T-002 — Swap Preact deps for React + TypeScript

**Category:** setup
**Dependencies:** T-001
**Story Ref:** S-1.1

Update `package.json`: remove `preact` and `@preact/preset-vite`, add `react`, `react-dom`, `@vitejs/plugin-react`, `typescript`, `@types/react`, `@types/react-dom`, `react-router-dom`, `zustand`, `@testing-library/react`, `@testing-library/jest-dom`. Run `npm install`.

**Acceptance Criteria:**
1. `preact` and `@preact/preset-vite` are removed from `package.json`
2. `react`, `react-dom`, `typescript`, `react-router-dom`, `zustand` are in dependencies
3. `@types/react`, `@types/react-dom`, `@vitejs/plugin-react`, `@testing-library/react` are in devDependencies
4. `npm install` completes without errors
5. `node_modules` contains React and not Preact

---

### T-003 — Configure tsconfig.json (strict)

**Category:** setup
**Dependencies:** T-002
**Story Ref:** S-1.1

Create `tsconfig.json` with strict mode enabled, JSX set to `react-jsx`, and appropriate `include`/`exclude` paths.

**Acceptance Criteria:**
1. `tsconfig.json` has `"strict": true`
2. `"jsx": "react-jsx"` is set (no need to import React in every file)
3. `"moduleResolution": "bundler"` for Vite compatibility
4. `"include": ["src"]` and `"exclude": ["node_modules", "dist"]`
5. `npx tsc --noEmit` runs (may have errors from unconverted files — that's expected)

---

### T-004 — Configure Vite for React + TS

**Category:** setup
**Dependencies:** T-002
**Story Ref:** S-1.1

Replace `vite.config.js` with `vite.config.ts`. Use `@vitejs/plugin-react` instead of the Preact preset. Preserve the existing proxy configuration and dev server settings.

**Acceptance Criteria:**
1. `vite.config.ts` exists with `@vitejs/plugin-react` plugin
2. All 7 proxy rules (`/games`, `/players`, `/stats`, `/upload`, `/images`, `/docs`, `/openapi.json`) are preserved
3. Dev server port remains 5173 with `host: '0.0.0.0'`
4. `npm run dev` starts without build errors (app may not render yet — that's fine)

---

### T-005 — Set up ESLint + CSS Modules

**Category:** setup
**Dependencies:** T-003, T-004
**Story Ref:** S-1.2, S-1.3

Configure ESLint with TypeScript + React rules. Add a CSS module type declaration so `*.module.css` imports are valid TypeScript.

**Acceptance Criteria:**
1. ESLint config extends `@typescript-eslint/recommended` and `plugin:react/recommended`
2. A `src/types/css.d.ts` (or similar) declares the module type for `*.module.css`
3. `npm run lint` passes on config files (no source code to lint yet)
4. A sample `.module.css` file can be imported in a `.tsx` file without TS errors

---

### T-006 — Convert API client to TypeScript

**Category:** refactor
**Dependencies:** T-003
**Story Ref:** S-2.1

Convert `api/client.js` → `api/client.ts`. Define TypeScript interfaces for all API response types (game session, hand, player, stats, leaderboard, etc.) based on the backend Pydantic models. Type all function signatures.

**Acceptance Criteria:**
1. `api/client.ts` exports all ~20 existing functions with typed params and return types
2. Response interfaces are defined in `api/types.ts` (or co-located in `client.ts`)
3. The `request()` helper is generic: `request<T>(path, options): Promise<T>`
4. `api/client.test.js` → `api/client.test.ts` and passes

---

### T-007 — Implement React Router

**Category:** refactor
**Dependencies:** T-004
**Story Ref:** S-2.2

Replace the custom `router.js` with React Router. Create an `App.tsx` with `<HashRouter>` containing all 5 routes. Implement a `NavBar.tsx` component with `<NavLink>` elements. Preserve the "active dealer game" navigation guard.

**Acceptance Criteria:**
1. `App.tsx` renders a `<HashRouter>` with routes for `/`, `/playback`, `/data`, `/dealer`, `/player`
2. `NavBar.tsx` shows navigation links with active state highlighting
3. Playback link is disabled when a dealer game is active (reads from Zustand store)
4. `router.js` and `router.test.js` are deleted
5. `main.tsx` (renamed from `main.js`) renders `<App />` into `#app`
6. `index.html` script src updated to `/src/main.tsx`

---

### T-008 — Implement Zustand dealer store

**Category:** refactor
**Dependencies:** T-006
**Story Ref:** S-2.3

Create `stores/dealerStore.ts` as a Zustand store with the `persist` middleware. Re-implement all 12 reducer actions from `dealerState.js` as Zustand actions. Type the full state shape and action signatures.

**Acceptance Criteria:**
1. `stores/dealerStore.ts` exports a typed Zustand store
2. All actions from the existing reducer are implemented: `SET_GAME`, `SET_PLAYER_CARDS`, `SET_COMMUNITY_CARDS`, `SET_HAND_ID`, `SET_PLAYER_STATUS`, `NEW_HAND`, `ADD_PLAYER`, `REMOVE_PLAYER`, `FINISH_HAND`, `RESET`, `RESTORE_STATE`, `SET_COMMUNITY_RECORDED`
3. `persist` middleware saves to sessionStorage with the key `aia_dealer_state`
4. `validateOutcomeStreets` is exported as a typed utility function
5. All existing `dealerState.test.js` assertions pass against the new store

---

### T-009 — Convert poker evaluator to TypeScript

**Category:** refactor
**Dependencies:** T-003
**Story Ref:** S-3.6

Convert `poker/evaluator.js` → `poker/evaluator.ts`. Add types for card representations, hand ranks, and evaluation results.

**Acceptance Criteria:**
1. `poker/evaluator.ts` exports typed evaluation functions
2. Card and hand rank types are defined as TypeScript types/enums
3. No `any` types
4. If tests exist, they pass after conversion

---

### T-010 — Convert dealer state & hand payload to TS

**Category:** refactor
**Dependencies:** T-008
**Story Ref:** S-3.6

Convert `dealer/dealerState.js` → `dealer/dealerState.ts` and `dealer/handPayload.js` → `dealer/handPayload.ts`. These now serve as the type/logic layer consumed by the Zustand store.

**Acceptance Criteria:**
1. Both files are `.ts` with fully typed exports
2. Reducer types, initial state, and action types are exported for use by the Zustand store
3. `handPayload.ts` payload builder functions have typed inputs/outputs
4. All existing tests (`dealerState.test.js`, `handPayload.test.js`) pass after conversion to `.test.ts`

---

### T-011 — Convert GameSelector + GameCreateForm to TSX

**Category:** refactor
**Dependencies:** T-008, T-006
**Story Ref:** S-3.2

Convert `dealer/GameSelector.jsx` → `GameSelector.tsx` and `dealer/GameCreateForm.jsx` → `GameCreateForm.tsx`. Define typed props interfaces. Use the typed API client and Zustand store.

**Acceptance Criteria:**
1. Both components are `.tsx` files with `interface Props { ... }` definitions
2. API calls use typed client functions
3. State interactions use the Zustand `useDealerStore` hook
4. Components render without TS errors in `npm run dev`

---

### T-012 — Convert HandDashboard + PlayerGrid to TSX

**Category:** refactor
**Dependencies:** T-008, T-006
**Story Ref:** S-3.3

Convert `dealer/HandDashboard.jsx` → `HandDashboard.tsx` and `dealer/PlayerGrid.jsx` → `PlayerGrid.tsx`.

**Acceptance Criteria:**
1. Both components are `.tsx` with typed props
2. Player state reads from Zustand store
3. Event handlers are typed (`React.MouseEvent`, `React.ChangeEvent`, etc.)
4. Components render without TS errors

---

### T-013 — Convert CameraCapture + DetectionReview to TSX

**Category:** refactor
**Dependencies:** T-008
**Story Ref:** S-3.4

Convert `dealer/CameraCapture.jsx` → `CameraCapture.tsx` and `dealer/DetectionReview.jsx` → `DetectionReview.tsx`. Type the media API interactions and detection result data structures.

**Acceptance Criteria:**
1. Both components are `.tsx` with typed props
2. `navigator.mediaDevices` usage has proper TS types
3. Detection result interfaces are defined
4. Components render without TS errors

---

### T-014 — Convert CardPicker + OutcomeButtons to TSX

**Category:** refactor
**Dependencies:** T-008
**Story Ref:** S-3.4, S-3.5

Convert `dealer/CardPicker.jsx` → `CardPicker.tsx` and `dealer/OutcomeButtons.jsx` → `OutcomeButtons.tsx`.

**Acceptance Criteria:**
1. Both components are `.tsx` with typed props
2. Card selection callbacks are typed
3. Outcome validation uses the typed `validateOutcomeStreets` from the store
4. Components render without TS errors

---

### T-015 — Convert DealerPreview + QRCodeDisplay to TSX

**Category:** refactor
**Dependencies:** T-008
**Story Ref:** S-3.5

Convert `dealer/DealerPreview.jsx` → `DealerPreview.tsx` and `dealer/QRCodeDisplay.jsx` → `QRCodeDisplay.tsx`. Install `@types/qrcode` if needed.

**Acceptance Criteria:**
1. Both components are `.tsx` with typed props
2. `qrcode` library usage is properly typed
3. Components render without TS errors

---

### T-016 — Convert DealerApp shell to TSX

**Category:** refactor
**Dependencies:** T-011, T-012, T-013, T-014, T-015
**Story Ref:** S-3.1

Convert `dealer/DealerApp.jsx` → `DealerApp.tsx`. This is the orchestrator — it depends on all dealer child components being converted first. Replace `useReducer` with Zustand store, remove manual sessionStorage logic.

**Acceptance Criteria:**
1. `DealerApp.tsx` renders all dealer steps using the Zustand store
2. No `useReducer` or manual `sessionStorage` calls remain
3. All child imports reference `.tsx` files
4. The full dealer workflow (select game → deal hands → finish) works end-to-end in the dev server

---

### T-017 — Convert LandingPage to TSX

**Category:** refactor
**Dependencies:** T-007, T-008
**Story Ref:** S-4.1

Convert `views/LandingPage.jsx` → `LandingPage.tsx`. Replace Preact hooks with React hooks, navigation with React Router `<Link>`, and dealer state check with Zustand selector.

**Acceptance Criteria:**
1. `LandingPage.tsx` imports from `react` not `preact`
2. Navigation uses `<Link to="...">` from React Router
3. Dealer game active state reads from Zustand store
4. Inline styles extracted to `LandingPage.module.css`

---

### T-018 — Convert vanilla DOM components to React TSX (batch 1: forms)

**Category:** refactor
**Dependencies:** T-006, T-007
**Story Ref:** S-4.4

Convert `components/sessionForm.js`, `components/handRecordForm.js`, `components/handEditForm.js`, and `components/playerManagement.js` from vanilla DOM to React TSX with CSS Modules.

**Acceptance Criteria:**
1. Four `.tsx` files replace the four `.js` files
2. All `document.createElement` / `appendChild` patterns are replaced with JSX
3. Each component has a typed props interface
4. Form state uses `useState` / controlled components
5. Styles use CSS Modules (`.module.css` files)

---

### T-019 — Convert vanilla DOM components to React TSX (batch 2: overlays & sidebars)

**Category:** refactor
**Dependencies:** T-006, T-007
**Story Ref:** S-4.4

Convert `components/sessionScrubber.js`, `components/streetScrubber.js`, `components/statsSidebar.js`, `components/resultOverlay.js`, and `components/equityOverlay.js` from vanilla DOM to React TSX with CSS Modules.

**Acceptance Criteria:**
1. Five `.tsx` files replace the five `.js` files
2. All imperative DOM manipulation is replaced with JSX
3. Each component has a typed props interface
4. Styles use CSS Modules
5. Components integrate with typed API client where needed

---

### T-020 — Convert playbackView + MobilePlaybackView to TSX

**Category:** refactor
**Dependencies:** T-007, T-006
**Story Ref:** S-4.2

Convert `views/playbackView.js` → `PlaybackView.tsx` and `views/MobilePlaybackView.jsx` → `MobilePlaybackView.tsx`. Manage Three.js scene lifecycle with `useRef` + `useEffect`.

**Acceptance Criteria:**
1. Both files are `.tsx` with typed props/state
2. Three.js scene is created in `useEffect` and disposed in its cleanup
3. Canvas element is accessed via `useRef<HTMLCanvasElement>`
4. Scrubber integration uses typed API client

---

### T-021 — Convert dataView to React TSX

**Category:** refactor
**Dependencies:** T-006, T-007
**Story Ref:** S-4.3

Convert `views/dataView.js` (vanilla DOM) → `DataView.tsx`. Replace imperative DOM construction with JSX.

**Acceptance Criteria:**
1. `DataView.tsx` is a React component with typed props
2. All data fetching uses the typed API client
3. Session/hand browsing functionality preserved
4. Styles use CSS Modules

---

### T-022 — Convert PlayerApp + mobile components to TSX

**Category:** refactor
**Dependencies:** T-007, T-006
**Story Ref:** S-5.1, S-5.2

Convert `player/PlayerApp.jsx` → `PlayerApp.tsx`, `mobile/EquityRow.jsx` → `EquityRow.tsx`, `mobile/SessionScrubber.jsx` → `SessionScrubber.tsx`, `mobile/StreetScrubber.jsx` → `StreetScrubber.tsx`.

**Acceptance Criteria:**
1. All four components are `.tsx` with typed props
2. React Router hooks used for route params/navigation
3. Mobile-specific styles use CSS Modules
4. Components render without TS errors

---

### T-023 — Convert Three.js scene core to TypeScript

**Category:** refactor
**Dependencies:** T-003
**Story Ref:** S-6.1

Convert `scenes/pokerScene.js` → `pokerScene.ts` and `scenes/tableGeometry.js` → `tableGeometry.ts`. Install `@types/three`. Type all function signatures, parameters, and return values.

**Acceptance Criteria:**
1. Both files are `.ts` with Three.js types from `@types/three`
2. `createPokerScene` returns a typed object (`{ scene: THREE.Scene, camera: THREE.PerspectiveCamera, ... }`)
3. `computeSeatPositions` returns typed `THREE.Vector3[]`
4. Existing `pokerScene.test.js` passes after conversion to `.test.ts`

---

### T-024 — Convert Three.js visual modules to TypeScript

**Category:** refactor
**Dependencies:** T-023
**Story Ref:** S-6.2

Convert `scenes/cards.js`, `scenes/chipStacks.js`, `scenes/communityCards.js`, `scenes/holeCards.js`, and `scenes/table.js` to TypeScript.

**Acceptance Criteria:**
1. All 5 files are `.ts`
2. Three.js mesh, group, and material types are explicit
3. No `any` types for Three.js objects
4. Scene integration works end-to-end (verified via playback view)

---

### T-025 — Set up React Testing Library + migrate test infra

**Category:** test
**Dependencies:** T-004
**Story Ref:** S-7.1

Configure Vitest with React Testing Library. Update `vitest` config for `happy-dom` environment. Create a test setup file that imports `@testing-library/jest-dom` matchers. Verify with a sample test.

**Acceptance Criteria:**
1. `@testing-library/react` and `@testing-library/jest-dom` are installed and configured
2. Vitest config references a setup file that extends expect with jest-dom matchers
3. A sample `Smoke.test.tsx` renders a React component and asserts on DOM content
4. `npm run test -- Smoke` passes

---

### T-026 — Migrate all component tests to RTL

**Category:** test
**Dependencies:** T-025, T-016, T-022
**Story Ref:** S-7.2

Convert all ~20 test files from Preact rendering to React Testing Library. Rename `.test.jsx` → `.test.tsx`, replace `render(h(Component))` with RTL `render(<Component />)`, update assertions.

**Acceptance Criteria:**
1. All test files are `.test.tsx` (or `.test.ts` for non-component tests)
2. No imports from `preact` or `preact/hooks` in any test file
3. All tests use RTL `render`, `screen`, `fireEvent`, `waitFor`
4. `npm run test` passes with all tests green
5. Test count matches or exceeds the pre-migration count

---

### T-027 — Update Dockerfile + docker-compose

**Category:** infra
**Dependencies:** T-004
**Story Ref:** S-8.1, S-8.2

Update `frontend/Dockerfile` and `docker-compose.yml` for the new build. Add `tsconfig.json` to volume mounts. Update CI to run `tsc --noEmit`, `lint`, and `test`.

**Acceptance Criteria:**
1. `Dockerfile` builds the TS frontend successfully
2. `docker-compose.yml` mounts `tsconfig.json`, `vite.config.ts`, and any new config files
3. `npm run dev` works inside the container with hot reload
4. `npm run build` produces a production `dist/` inside the container
5. CI config includes type-check, lint, and test steps

---

### T-028 — Final cleanup: remove JS/JSX, verify zero Preact refs

**Category:** refactor
**Dependencies:** T-026, T-027
**Story Ref:** S-8.3

Remove all original `.js` and `.jsx` source files from `frontend/src/`. Verify no Preact imports remain. Run full build + test suite. Remove `counter.js` (appears unused).

**Acceptance Criteria:**
1. `find frontend/src -name '*.js' -o -name '*.jsx'` returns zero results (except config files outside `src/`)
2. `grep -r 'preact' frontend/src/` returns zero matches
3. `package.json` has no `preact` dependency
4. `npm run build` succeeds
5. `npm run test` passes all tests
6. Branch is ready for PR review and merge

---
