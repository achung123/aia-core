# All In Analytics Core

All In Analytics is a poker session tracker and analysis tool for Texas Hold'em home games. It records hands, computes win probabilities in real time, and visualises everything on an interactive 3D table.

The project is split into two pieces that run side-by-side during development:

| Component | Stack | Default URL |
|-----------|-------|-------------|
| **Backend** (this repo root) | Python 3.12 · FastAPI · SQLAlchemy · SQLite · Alembic | `http://localhost:8000` |
| **Frontend** (`frontend/`) | Vite · Preact · Three.js | `http://localhost:5173` |

## What It Does

- **Game session management** — create sessions, add players, record hands with community and hole cards, results, and P&L.
- **Dealer interface** — mobile-first dealer view to manage the current hand: deal, capture cards via camera, record results.
- **Player interface** — players join from their phones, capture their own hole cards via camera, and view live hand status.
- **Card detection** — YOLO-based playing card recognition from camera photos, with detection review and correction.
- **3D playback visualiser** — scrub through hands and streets on a rendered poker table with animated card dealing, chip stacks, fold/win indicators, and per-player equity badges that update live as the board is revealed.
- **Equity engine** — client-side Texas Hold'em equity calculator (exhaustive on turn/river, Monte Carlo pre-flop) shows every player's win probability at each street.
- **CSV import/export** — bulk-import entire games from a CSV file (validate first, then commit), or export any session to CSV.
- **Stats & leaderboard** — per-player and per-game statistics, searchable hand history.
- **Data management UI** — create/edit games and hands, import CSVs, and load any session into the visualiser from the data view.

## Project Layout

```
src/
  app/                  # FastAPI application
    main.py             # Entry point, router registration, CORS
    database/           # SQLAlchemy models, engine, queries
    routes/             # One file per endpoint group
  pydantic_models/      # Pydantic request/response schemas
frontend/
  src/
    api/                # API client (fetch wrapper)
    components/         # UI components (scrubbers, forms, overlays)
    dealer/             # Dealer interface (hand management, camera capture)
    mobile/             # Mobile components (session/street scrubbers, equity)
    player/             # Player interface (join game, capture cards)
    poker/              # Equity calculator / hand evaluator
    scenes/             # Three.js scene objects (table, cards, chips)
    views/              # Page-level views (playback, data, landing)
test/                   # pytest test suite (mirrors src/ structure)
alembic/                # Database migration environment
  versions/             # Migration scripts
scripts/                # Utility scripts (seeding, setup)
models/                 # YOLO model weights for card detection
```

## Prerequisites

- **Python 3.12+**
- **Node.js 18+** and **npm**
- [**uv**](https://docs.astral.sh/uv/) — Python package manager

## Getting Started

### 1. Clone and install dependencies

```bash
git clone <repo-url> && cd aia-core

# Python dependencies
uv sync --group test --group dev

# Frontend dependencies
cd frontend && npm install && cd ..
```

### 2. Set up the database

The backend uses SQLite (`poker.db` in the project root). Run Alembic migrations to create the schema:

```bash
uv run alembic upgrade head
```

Optionally seed demo games:

```bash
uv run python scripts/seed_demo_game.py
```

### 3. Start the backend

```bash
uv run uvicorn app.main:app --reload
```

The API is now live at **http://localhost:8000**. Visit http://localhost:8000/docs for the interactive Swagger UI.

### 4. Start the frontend

In a separate terminal:

```bash
cd frontend
npm run dev
```

The frontend is now live at **http://localhost:5173**. It proxies API calls to the backend at `localhost:8000`.

**Frontend views:**

| Route | View |
|-------|------|
| `#/` | Landing page with navigation cards |
| `#/dealer` | Dealer interface — manage hands, capture cards |
| `#/player` | Player interface — join game, capture hole cards |
| `#/playback` | 3D table playback with hand/street scrubbers |
| `#/data` | Data management — create/edit games, import CSV |

## Docker

The `backend` and `backend-gpu` services are mutually exclusive via Docker Compose profiles — only one runs at a time.

### CPU (default)

```bash
docker compose --profile cpu down && docker compose --profile cpu up --build
```

### GPU-accelerated inference

Requires NVIDIA GPU + [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html).

```bash
docker compose --profile gpu down && docker compose --profile gpu up --build
```

This builds a CUDA-enabled backend image (~6GB) and passes the GPU through to the container. YOLO inference goes from ~1-3s (CPU) to ~20-50ms (GPU).

### Services

| Service | URL | Description |
|---------|-----|-------------|
| `backend` | http://localhost:8000 | FastAPI backend (CPU, hot-reload) |
| `backend-gpu` | http://localhost:8000 | FastAPI backend (GPU, hot-reload) |
| `frontend` | http://localhost:5173 | Vite dev server (hot-reload) |
| `tunnel` | Random `*.trycloudflare.com` URL | Cloudflare tunnel for remote access |

### Database Persistence

The SQLite database is bind-mounted from the host at `./poker.db`. Data survives `docker compose down`.

When `SEED_DATA=1` (the default in docker-compose.yml), the database is wiped and re-seeded on every container start. To preserve data between restarts, set `SEED_DATA=0`:

```yaml
environment:
  - SEED_DATA=0
```

### Cloudflare Tunnel

The tunnel service uses `--protocol http2` (TCP) instead of the default QUIC (UDP) for stability. It has `restart: unless-stopped` so Docker auto-restarts it on crashes.

For local network play (recommended), skip the tunnel and connect devices directly:

```
http://<host-ip>:5173
```

Add your machine's IP to `ALLOWED_ORIGINS` if needed, or rely on the built-in private IP regex in CORS config.

## Running Tests

```bash
# Backend
uv run pytest test/           # full suite
uv run pytest test/ -v        # verbose
uv run pytest test/test_foo.py  # single file

# Frontend
cd frontend
npx vitest run                # full suite
npx vitest run src/views/     # specific directory
```

## Linting & Formatting

```bash
uv run ruff check src/ test/   # lint
uv run ruff format src/ test/  # auto-format
```

Pre-commit hooks enforce both automatically on `git commit`.

## API Overview

| Method | Path | Description |
|--------|------|-------------|
| **Games** | | |
| GET | `/games` | List all game sessions |
| POST | `/games` | Create a new game session |
| GET | `/games/{id}` | Get a game session |
| PATCH | `/games/{id}/complete` | Mark game as complete |
| PATCH | `/games/{id}/reactivate` | Reactivate a completed game |
| GET | `/games/{id}/export/csv` | Export game to CSV |
| **Hands** | | |
| GET | `/games/{id}/hands` | List hands for a session |
| POST | `/games/{id}/hands` | Record a new hand |
| GET | `/games/{id}/hands/{num}` | Get a specific hand |
| PATCH | `/games/{id}/hands/{num}` | Edit community cards |
| GET | `/games/{id}/hands/{num}/status` | Hand status (for polling) |
| GET | `/games/{id}/hands/{num}/equity` | Server-side equity calculation |
| PATCH | `/games/{id}/hands/{num}/results` | Record results for all players |
| **Player Hands** | | |
| POST | `/games/{id}/hands/{num}/players` | Add player to a hand |
| DELETE | `/games/{id}/hands/{num}/players/{name}` | Remove player from a hand |
| PATCH | `/games/{id}/hands/{num}/players/{name}` | Edit hole cards |
| PATCH | `/games/{id}/hands/{num}/players/{name}/result` | Update player result |
| **Card Detection** | | |
| POST | `/games/{id}/hands/image` | Upload image for card detection |
| GET  | `/games/{id}/hands/image/{upload_id}` | Get detection results |
| POST | `/games/{id}/hands/image/{upload_id}/confirm` | Confirm detected cards |
| GET | `/images/corrections` | List detection corrections |
| **Players** | | |
| GET | `/players` | List all players |
| POST | `/players` | Create a player |
| GET | `/players/{name}` | Get a player |
| **CSV Import** | | |
| GET | `/upload/csv/schema` | Get expected CSV schema |
| POST | `/upload/csv` | Validate a CSV file |
| POST | `/upload/csv/commit` | Import a validated CSV |
| **Stats** | | |
| GET | `/stats/leaderboard` | Player leaderboard |
| GET | `/stats/players/{name}` | Per-player stats |
| GET | `/stats/games/{id}` | Per-game stats |
| **Search** | | |
| GET | `/hands` | Search hands across all games |

Full API docs available at `/docs` when the backend is running.
