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

```python
from fastapi.staticfiles import StaticFiles

# After all API routers are registered:
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

The `#/playback` route renders an interactive 3D poker table using Three.js. Here is a plain-language tour for backend developers who are not familiar with WebGL.

### Scene initialization (`src/scenes/table.js`)

A `WebGLRenderer` is attached to a `<canvas>` element. A `PerspectiveCamera` is positioned above and slightly behind the table centre (`y=8, z=5`), looking straight down at the origin. Ambient and directional lights provide basic illumination. A `requestAnimationFrame` loop runs continuously, calling `renderer.render(scene, camera)` on every frame.

### The table and seat positions (`src/scenes/tableGeometry.js`)

The felt surface is a `CylinderGeometry` scaled to an ellipse (`3.5 × 2.0` units). Ten seat positions are computed by distributing points evenly around a slightly larger ellipse. Each seat gets a CSS `<div>` label that is projected from 3D world-space to 2D screen-space every frame, so the labels follow the seats as the canvas resizes.

### Card meshes (`src/scenes/cards.js`)

Each card is a thin `BoxGeometry` (0.7 × 1.0 × 0.02 units). The face texture is rendered on an off-screen `<canvas>` (rank, suit symbol, red/black colour) and uploaded to the GPU as a `CanvasTexture`. Face-down cards show a solid blue back face. When a card is revealed, a 300 ms Y-axis rotation animation swaps the front material from back-texture to face-texture at the halfway point, giving the appearance of a flip.

### Hole cards (`src/scenes/holeCards.js`)

Each occupied seat gets two card meshes placed slightly in front of and to the sides of the seat position. Folded hands show a "FOLD" sprite instead of cards. When a hand is marked as a winner, a brief glow animation fires on those meshes.

### Community cards (`src/scenes/communityCards.js`)

Up to five community cards are laid out horizontally across the table centre. Each card slides in from off-screen (z = 5) to its target position over 500 ms using a linear interpolation (`lerpVectors`), mimicking cards being dealt.

### Chip stacks (`src/scenes/chipStacks.js`)

Each seat has a stack of five cylinder discs. Stack height is proportional to the player's cumulative profit/loss for the session: positive P&L scales the stack up (yellow), negative scales it down (red), neutral is grey. Height changes animate over 400 ms. The scrubber component (see below) drives these updates as the user steps through hands.

### Session scrubber (`src/components/sessionScrubber.js`)

A horizontal scrubber bar lets the user step backward and forward through the hands in a session. On each step, the playback view recomputes cumulative P&L for every player from hand 0 up to the selected index, then calls the chip stack and card controllers to update the scene accordingly.
