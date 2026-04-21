# All In Analytics — Frontend

A browser-based poker session playback viewer and data dashboard.
Built with [Vite](https://vitejs.dev/) + [Three.js](https://threejs.org/).

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | `^20.19.0` or `>=22.12.0` (required by Vite 8) |
| npm | `>=10` (bundled with Node.js 22) |

Check your versions:

```bash
node --version
npm --version
```

---

## Installation

```bash
cd frontend
npm install
```

---

## Development

```bash
npm run dev
```

The dev server starts at **http://localhost:5173**.

To point the frontend at a non-default backend, set `VITE_API_BASE_URL` before starting:

```bash
VITE_API_BASE_URL=http://localhost:8000 npm run dev
```

---

## Build

```bash
npm run build
```

Output is written to `frontend/dist/`. The `dist/` directory contains a fully self-contained static bundle (HTML, JS, CSS, assets) that can be served by any static file host or by FastAPI directly.

To preview the production build locally:

```bash
npm run preview
```

---

## Environment Variables

### Frontend (`VITE_*` prefix — inlined at build time)

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_BASE_URL` | `http://localhost:8000` | Base URL of the FastAPI backend. Set this to your deployed backend origin at build time. |

Usage in `src/api/client.js`:

```js
const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
```

Because Vite inlines `VITE_*` variables at build time, you must rebuild (`npm run build`) after changing this value — it cannot be overridden at runtime in the static bundle.

### Backend (`src/app/main.py`)

| Variable | Default | Description |
|----------|---------|-------------|
| `ALLOWED_ORIGINS` | `http://localhost:5173` | Comma-separated list of origins the FastAPI CORS middleware will accept. Must include whatever origin serves the frontend. Wildcards (`*`) are not permitted (credentials are enabled). |

Example for a deployed environment:

```bash
export ALLOWED_ORIGINS="https://app.example.com,https://www.example.com"
```

---

## Deployment

After building the frontend (`npm run build`), mount `frontend/dist/` as a `StaticFiles` directory in FastAPI so the app can serve the SPA from the same process.

> **Warning — remove or relocate `@app.get("/")` before mounting StaticFiles**
>
> `src/app/main.py` currently defines `@app.get("/")` (the JSON welcome response).
> FastAPI resolves explicit route handlers before the `StaticFiles` mount, so that route
> will be matched on every `GET /` request — meaning every browser page load returns the
> JSON welcome object instead of `index.html`.
>
> Before mounting at `"/"`, either **remove** the welcome route entirely or **move it** to
> a different prefix (e.g. `/api/`):
>
> ```python
> # src/app/main.py — updated excerpt
> from fastapi.staticfiles import StaticFiles
>
> # Option A: remove the welcome route entirely
> # (delete or comment out the @app.get("/") handler)
>
> # Option B: move it to /api/
> @app.get("/api/")
> def root():
>     return {"message": "All In Analytics API"}
>
> # Register all other API routers here, then mount the SPA last:
> app.mount("/", StaticFiles(directory="frontend/dist", html=True), name="frontend")
> ```

```python
from fastapi.staticfiles import StaticFiles

# After all API routers are registered (and @app.get("/") removed or relocated):
app.mount("/", StaticFiles(directory="frontend/dist", html=True), name="frontend")
```

The `html=True` flag makes FastAPI fall back to `index.html` for unknown paths, which is required for the hash-based client-side router (`#/playback`, `#/data`).

> **Note:** `StaticFiles` must be mounted **last** — after all API routes — otherwise it will shadow the API endpoints.

Set `ALLOWED_ORIGINS` to the origin that will serve the frontend (or the same backend origin if you are serving both from FastAPI):

```bash
export ALLOWED_ORIGINS="https://app.example.com"
```

---

## How the 3D Scene Works

The `#/playback` route renders an interactive 3D poker table using a declarative React Three Fiber (R3F) tree rooted at `<PokerTable>`. All 3D code lives in `src/scenes3d/`. Here is a plain-language tour for backend developers who are not familiar with WebGL.

### The public component — `<PokerTable>` (`src/scenes3d/PokerTable.tsx`)

`<PokerTable>` is a declarative scene: you pass it a `TableState` (seats, cards, pot, phase, …), a `viewer` policy, a `qualityTier`, and a `theme`, and it renders the whole table. It is mounted inside a `<PokerCanvas>` wrapper (`src/scenes3d/PokerCanvas.tsx`) which is an R3F `<Canvas>` with quality-tier-aware shadows. The container's size drives the renderer; there is no window-level resize listener.

### The table and seats (`src/scenes3d/components/Table.tsx`, `Seat.tsx`, `tableLayout.ts`)

The felt surface is an ellipse ($3.5 \times 2.0$ units) with PBR felt + rail materials. Ten seat positions are computed in `tableLayout.ts` (single source of truth shared with the animation drivers). Each seat gets a DOM `<Nameplate>` projected from 3D world-space to 2D screen-space every frame.

### Cards (`src/scenes3d/components/Card.tsx`, `CardAtlas.ts`)

All 52 card faces live in a single GPU texture atlas whose resolution is chosen per quality tier. `<Card>` renders through an `InstancedMesh` that UV-indexes into the atlas — constant draw-call cost regardless of how many cards are on the table. `<Card>.faceUp` routes through `canSee()` (see below) so the viewer never sees cards they shouldn't.

### Chips (`src/scenes3d/components/ChipInstances.tsx`, `ChipStack.tsx`, `PotChipCluster.tsx`)

Chips use `InstancedMesh` per denomination. Each seat has a committed-chip stack at `seatCommitChipWorldPosition(seat)`; the pot cluster sits at `POT_CHIP_WORLD_POSITION`. Chip colours come from the denomination palette in `ChipInstances.tsx`.

### Animations — controller + driver split (`src/scenes3d/animations/`)

Every animated effect is two files: a pure **controller** (state machine, tween math, zero React / zero Three.js) and an R3F **driver** that mounts it via `useFrame`. Current pairs are `DealAnimationController` / `DealAnimationDriver` (cards dealing in), `ChipSlideController` / `ChipSlideDriver` (bets sliding to the pot), and `PotSweepController` / `PotSweepDriver` (pot sweeping to winners).

### Visibility policy (`src/scenes3d/state/visibilityPolicy.ts`)

`canSee({ viewerSeat, cardOwnerSeat, policy, phase, ownerFolded })` is a single pure function that decides whether each card renders face-up for the current viewer. **Spectator** policy only reveals non-folded hole cards at showdown; **player** policy always reveals the viewer's own cards and hides opponents until showdown. `canSee()` is a render-time presentation filter only — actual authorisation (which hole cards even reach the client) lives on the backend.

### Quality tiers and auto-degrade (`src/scenes3d/state/qualitySettings.ts`, `useFPSMonitor.ts`)

`QUALITY_TIER_SETTINGS[tier]` is the canonical map of per-tier settings (PBR on/off, env-map resolution, shadow-map size, AA mode, card atlas resolution, etc.). Every tier-gated value reads from it — no inline ternaries scattered through the scene. `useFPSMonitor` / `<FPSMonitor>` runs a 120-sample rolling FPS window and, if the average stays below the degrade threshold for 3000 ms, steps down to the next lower tier exactly once (gated by a recovery flag). `<TableSettingsPanel>` exposes a tier radiogroup that flips `manualOverride=true` when a user picks a tier, halting the auto-degrade loop. `<QualityToast>` is the DOM surface users see when an auto-degrade fires.

### Session replay (`src/scenes3d/SessionReplayShell.tsx`, `components/HandScrubberPanel.tsx`)

`/playback` composes `<SessionReplayShell>` + `<HandScrubberPanel>` + `<PokerCanvas><PokerTable>`. `<SessionReplayShell>` owns the replay store slice (`handIndex`, `streetIndex`, `isPlaying`, `speed`) and auto-advances streets on a floored timer (never faster than a chip-slide) with an inter-hand pause. `handsToTableState` in `scenes3d/data/` adapts backend `HandResponse[]` payloads into the `TableState` the scene consumes.
