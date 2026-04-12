# Plan — Frontend React + TypeScript Migration

**Project ID:** frontend-react-ts-006
**Date:** 2025-04-11
**Status:** Draft

---

## Overview

Big-bang migration of the All In Analytics frontend from **JavaScript + Preact** to **TypeScript (strict) + React**. The work happens on a dedicated feature branch off `achung/player-participation-005` with a frontend feature freeze in effect. The codebase comprises 61 source files (30 source + 20 tests + configs) across a custom hash router, Preact component tree, Three.js 3D scenes, and vanilla DOM components — all of which will be rewritten as typed React components.

---

## Tech Stack & Tools

| Technology | Purpose |
|---|---|
| React 19 + ReactDOM | UI component library — replaces Preact |
| TypeScript 5.x (`strict: true`) | Static type system for all frontend source |
| Vite 8 + `@vitejs/plugin-react` | Build tooling — replaces `@preact/preset-vite` |
| React Router 7 (`HashRouter`) | Declarative routing — replaces custom 80-line hash router |
| Zustand 5 | Lightweight state management — replaces `useReducer` + sessionStorage |
| CSS Modules (`.module.css`) | Scoped component styles — replaces inline style objects + global CSS |
| Vitest 4 + React Testing Library | Test runner + DOM testing utilities — replaces Preact render helpers |
| ESLint + `@typescript-eslint` | Linting with TypeScript-aware rules |
| Three.js + `@types/three` | 3D poker table (unchanged library, now typed) |
| qrcode + `@types/qrcode` | QR code generation (unchanged library, now typed) |

---

## Architecture Components

### Typed API Client (`api/client.ts`)

The existing fetch wrapper is converted to TypeScript with response type interfaces matching the backend Pydantic models. All 20+ API functions get typed parameters and return `Promise<T>` with specific response shapes. This is the first file migrated because everything depends on it.

### React Router Shell (`App.tsx` + route config)

A top-level `<HashRouter>` replaces the custom router. Five route entries (`/`, `/playback`, `/data`, `/dealer`, `/player`) are declared as `<Route>` elements. Navigation guards (active dealer game check) are implemented as a React Router loader or a wrapper component. The `<nav>` element is extracted into a `NavBar.tsx` component.

### Zustand Dealer Store (`stores/dealerStore.ts`)

The 12-action reducer from `dealerState.js` is re-implemented as a Zustand store with typed actions. The `persist` middleware handles sessionStorage serialization (replacing the manual `saveState`/`loadSavedState` functions). Components subscribe to store slices instead of receiving state via props, eliminating deep prop-drilling in the dealer workflow.

### React Component Tree

All JSX components migrate from `import { h } from 'preact'` / `import { useState } from 'preact/hooks'` to standard React imports. The 9 vanilla DOM components in `components/` are rewritten as JSX components. Each component gets a typed props interface and a co-located CSS module.

### Three.js Scene Layer (`scenes/*.ts`)

The 7 scene files are renamed to `.ts` and annotated with Three.js types. No architectural change — these files remain framework-agnostic and are consumed by React components via `useRef` + `useEffect`. The `@types/three` package provides all necessary type definitions.

### Test Infrastructure

Vitest remains the test runner. `@testing-library/react` replaces Preact's render helper. Tests are renamed from `.test.jsx` → `.test.tsx` and updated to use RTL's `render()`, `screen`, `fireEvent`, and `waitFor` APIs.

---

## Project Phases

### Phase 1: Foundation (Tasks T-001 → T-005)

Set up the TypeScript + React project skeleton — dependencies, configs, build verification — so that all subsequent migration work compiles and runs.

**Deliverables:**
- `tsconfig.json` with strict mode
- `vite.config.ts` with React plugin
- Updated `package.json` (React, Zustand, React Router, TS, RTL deps)
- ESLint config for TypeScript + React
- CSS Module declarations
- Green `npm run dev` and `npm run build`

### Phase 2: Core Infrastructure (Tasks T-006 → T-009)

Migrate the three foundational layers that everything else depends on: API client, router, and state management.

**Deliverables:**
- Typed `api/client.ts` with response interfaces
- React Router configuration with all 5 routes
- Zustand dealer store with persistence
- Poker hand evaluator TS conversion

### Phase 3: Component Migration (Tasks T-010 → T-019)

Port all Preact JSX components and vanilla DOM components to React TSX, working from leaf components inward to the app shell. This is the largest phase.

**Deliverables:**
- All dealer components (10 files) → `.tsx`
- All view components (5 files) → `.tsx`
- All vanilla DOM components (9 files) → `.tsx` with CSS Modules
- Player and mobile components (5 files) → `.tsx`

### Phase 4: Three.js & Utilities (Tasks T-020 → T-021)

Convert the framework-agnostic Three.js scene code and remaining utilities to TypeScript.

**Deliverables:**
- All 7 scene files → `.ts` with Three.js types
- `counter.js` removed or converted (appears unused)

### Phase 5: Testing & Validation (Tasks T-022 → T-024)

Migrate all tests to React Testing Library, verify coverage parity, and ensure the full application works end-to-end.

**Deliverables:**
- All ~20 test files → `.test.tsx` with RTL
- Test count matches or exceeds pre-migration levels
- Full `npm run test` pass

### Phase 6: Integration & Cleanup (Tasks T-025 → T-028)

Update Docker, CI, remove dead code, and prepare for merge.

**Deliverables:**
- Updated `Dockerfile` and `docker-compose.yml`
- CI pipeline with TS type-check + lint + test
- Zero `.js`/`.jsx` source files remaining
- Zero Preact imports remaining
- Clean merge candidate

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Preact/React API differences cause subtle bugs | Medium | Preact's API is 95% compatible with React; the `h()` → JSX and hooks import changes are mechanical. `preact/compat` differences (event handling, refs) will be caught by strict TS and tests. |
| Three.js integration breaks under React | Medium | Three.js is framework-agnostic — it attaches to a `<canvas>` element via refs. The integration pattern (`useRef` + `useEffect`) is well-documented. Test with visual inspection. |
| Zustand migration introduces state bugs | High | The existing `dealerState.test.js` has strong reducer coverage. Port these tests first, then verify the Zustand store passes them identically. |
| Big-bang branch diverges from main | Medium | Feature freeze is in effect. Keep the branch short-lived (aim for < 2 weeks). Rebase frequently. |
| `strict: true` TypeScript creates excessive annotation burden | Low | Most types are inferrable. Explicitly type props interfaces and API responses; let TS infer the rest. Phase 1 validates the strictness level on scaffolded code before committing to 60+ file conversions. |
| CSS Module migration breaks layouts | Low | Visual regression testing — compare screenshots before/after. CSS Modules only scope class names; the actual CSS rules carry over directly. |

---

## Dependencies

| Dependency | Notes |
|---|---|
| Backend API contracts stable | Frontend types depend on backend Pydantic model shapes. No backend changes expected during migration. |
| Branch `achung/player-participation-005` | Migration branch forks from here. Must be in a stable state before branching. |
| Node.js ≥ 22.12.0 | Already required by Vite 8. No change. |
| `@types/three` version parity | Must match the installed `three@0.183.2` version. |
