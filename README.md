# All In Analytics Core

All In Analytics is a poker session tracker and analysis tool for Texas Hold'em home games. It records hands, computes win probabilities in real time, and visualises everything on an interactive 3D table.

The project is split into two pieces that run side-by-side during development:

| Component | Stack | Default URL |
|-----------|-------|-------------|
| **Backend** (this repo root) | Python 3.12 · FastAPI · SQLAlchemy · SQLite · Alembic | `http://localhost:8000` |
| **Frontend** (`frontend/`) | Vite · Three.js · vanilla JS | `http://localhost:5173` |

## What It Does

- **Game session management** — create sessions, add players, record hands with community and hole cards, results, and P&L.
- **CSV import** — bulk-import entire games from a CSV file (validate first, then commit).
- **3D playback visualiser** — scrub through hands and streets on a rendered poker table with animated card dealing, chip stacks, fold/win indicators, and per-player equity badges that update live as the board is revealed.
- **Equity engine** — client-side Texas Hold'em equity calculator (exhaustive on turn/river, Monte Carlo pre-flop) shows every player's win probability at each street.
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
    poker/              # Equity calculator / hand evaluator
    scenes/             # Three.js scene objects (table, cards, chips)
    views/              # Page-level views (playback, data)
test/                   # pytest test suite (mirrors src/ structure)
alembic/                # Database migration environment
  versions/             # Migration scripts
scripts/                # Utility scripts (seeding, setup)
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

Optionally seed a demo game with 5 players and 5 hands:

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

The frontend is now live at **http://localhost:5173**. It proxies API calls to the backend at `localhost:8000` (configurable via `VITE_API_BASE_URL`).

## Running Tests

```bash
uv run pytest test/           # full suite
uv run pytest test/ -v        # verbose
uv run pytest test/test_foo.py  # single file
```

## Linting & Formatting

```bash
uv run ruff check src/ test/   # lint
uv run ruff format src/ test/  # auto-format
```

Pre-commit hooks enforce both automatically on `git commit`.

## Docker

### Docker Compose (recommended)

Spin up both backend and frontend with one command:

```bash
docker compose up --build
```

- Backend → http://localhost:8000 (with hot-reload via mounted `src/`)
- Frontend → http://localhost:5173 (with hot-reload via mounted `frontend/src/`)

To stop: `docker compose down`

### Backend only

```bash
docker build -t all-in-analytics-core .
docker run -p 8000:8000 -v $(pwd)/src:/src all-in-analytics-core
```

## API Overview

| Method | Path | Description |
|--------|------|-------------|
| GET | `/games` | List all game sessions |
| POST | `/games` | Create a new game session |
| GET | `/games/{id}/hands` | List hands for a session |
| POST | `/games/{id}/hands` | Record a new hand |
| PATCH | `/games/{id}/hands/{num}` | Edit community cards |
| PATCH | `/games/{id}/hands/{num}/players/{name}` | Edit hole cards |
| GET | `/players` | List all players |
| POST | `/players` | Create a player |
| POST | `/upload/csv` | Validate a CSV file |
| POST | `/upload/csv/commit` | Import a validated CSV |
| GET | `/stats/leaderboard` | Player leaderboard |
| GET | `/stats/players/{name}` | Per-player stats |
| GET | `/stats/games/{id}` | Per-game stats |

Full API docs available at `/docs` when the backend is running.
