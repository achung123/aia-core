# Plan — All In Analytics Core Backend

**Project ID:** aia-core-001
**Date:** 2026-03-09
**Status:** Draft
**Scope:** Pilot (MVP text-only) through V1 (image ingestion) — backend only

---

## Overview

Overhaul and extend the existing All In Analytics FastAPI backend to support full hand tracking (community + hole cards), per-player statistics, CSV bulk ingestion, historical querying, and image-based card detection. The current minimal Game/Community schema is replaced with a normalized relational model. Deployment remains local (SQLite + Docker) for Pilot; V1 adds an image processing pipeline.

---

## Tech Stack & Tools

| Technology | Purpose |
|---|---|
| Python 3.12 | Runtime — already in use |
| FastAPI | API framework — already in use |
| SQLAlchemy 2.x | ORM — upgrade to 2.x declarative style with proper relationships |
| Alembic | Database migrations — manage schema changes across versions |
| SQLite | Local database for Pilot tier — already in use |
| Pydantic v2 | Request/response validation — already in use |
| Pytest | Testing — already in use |
| Poetry | Dependency management — already in use |
| Docker | Containerized deployment — already in use |
| Uvicorn | ASGI server — already in use |
| python-multipart | File upload support (CSV + images) |
| Pillow | Image file validation and preprocessing (V1) |
| Ruff | Linting — already in use |

---

## Architecture Components

### API Layer (FastAPI Routers)

Modular routers organized by domain:
- `routes/games.py` — Game session CRUD
- `routes/hands.py` — Hand recording, retrieval, editing
- `routes/players.py` — Player CRUD
- `routes/upload.py` — CSV ingestion pipeline
- `routes/stats.py` — Statistics and leaderboard endpoints
- `routes/search.py` — Historical querying / filtering
- `routes/images.py` — Image upload and detection (V1)

The existing `routes/game.py` will be replaced by the new router structure.

### Database Layer

Normalized relational schema with SQLAlchemy 2.x models:
- `Player` — player registry (name, created_at)
- `GameSession` — game session metadata (date, status, participants)
- `GamePlayer` — many-to-many link between games and players
- `Hand` — per-hand community cards + metadata
- `PlayerHand` — per-player hole cards, result, profit/loss per hand
- `ImageUpload` — uploaded image metadata and detection results (V1)
- `CardDetection` — per-card detection result with confidence (V1)
- `DetectionCorrection` — user corrections for retraining data (V1)

Managed via Alembic migrations so schema evolves without data loss.

### Validation Layer

Pydantic v2 models enforce:
- Card validity (rank + suit within standard 52-card deck)
- No duplicate cards within a single hand (community + all hole cards)
- Date format consistency
- CSV schema conformance
- Image file type and size constraints (V1)

### Statistics Engine

Query-based computations (no separate analytics store for MVP):
- Win rate, profit/loss, hand frequency — computed from `PlayerHand` records
- Leaderboard — aggregated query across all players
- Per-session breakdowns — filtered by game_id
- All stats are read-derived; no denormalized stat tables in Pilot

### Image Processing Pipeline (V1)

- Image stored on local filesystem (or S3 in future tiers)
- Card detection model invoked after upload (pluggable interface)
- Results stored as `CardDetection` records with confidence scores
- User reviews/corrects before data becomes a Hand record
- Corrections stored for model improvement feedback loop

---

## Project Phases

### Phase 1: Foundation (Pilot)

Redesign the database schema, set up Alembic migrations, rebuild the Pydantic models, and establish the new router structure. Remove/replace legacy code.

**Deliverables:**
- New SQLAlchemy 2.x models (Player, GameSession, GamePlayer, Hand, PlayerHand)
- Alembic migration setup with initial migration
- New Pydantic request/response models with card validation
- Refactored FastAPI app with new router structure
- Full test coverage for models and validation

### Phase 2: Core CRUD (Pilot)

Implement game session management, hand recording, and player operations.

**Deliverables:**
- Game session CRUD endpoints (create, get, list, complete)
- Hand recording endpoints (create hand with community + hole cards)
- Hand retrieval endpoints (get single hand, list hands per game)
- Hand result recording (win/loss/fold + profit/loss per player)
- Player CRUD endpoints
- Integration tests for all endpoints

### Phase 3: CSV Ingestion (Pilot)

Build the bulk upload pipeline for importing historical data from CSV files.

**Deliverables:**
- Defined CSV schema
- CSV upload + validation endpoint
- CSV commit endpoint (transactional bulk insert)
- Validation error reporting with row-level detail
- Tests with sample CSV fixtures

### Phase 4: Editing & Corrections (Pilot)

Enable post-hoc corrections to hand data.

**Deliverables:**
- Edit community cards endpoint
- Edit player hole cards endpoint
- Add/remove player from hand endpoints
- Re-validation on every edit
- Tests for correction workflows

### Phase 5: Statistics (Pilot)

Expose player and session-level statistics.

**Deliverables:**
- Player stats endpoint (win rate, profit/loss, hand frequency)
- Per-session stats endpoint
- Leaderboard endpoint with sortable metrics
- Tests for stat computation accuracy

### Phase 6: Historical Querying (Pilot)

Advanced search and filtering across hands and games.

**Deliverables:**
- Search by player, date range, and card
- Pagination support
- Combined filter support
- Tests for query edge cases

### Phase 7: Image Ingestion (V1)

Backend support for image-based card capture.

**Deliverables:**
- Image upload endpoint with file validation
- Card detection pipeline integration (pluggable interface)
- Detection result storage and retrieval
- Review/confirm workflow (detected → corrected → committed)
- Correction feedback storage for retraining
- Tests with mock detection results

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Database redesign breaks existing data | Use Alembic migrations; provide a one-time migration script for any existing SQLite data |
| Card validation complexity (duplicate detection across community + N players) | Centralize validation in a single Pydantic validator; test exhaustively with edge cases |
| CSV schema ambiguity (community cards repeated per row vs. per hand) | Define strict schema up front; validation endpoint catches mismatches before commit |
| Image detection model not available for V1 | Design a pluggable interface so the pipeline works with a mock/stub detector; swap in real model later |
| Stats queries slow on large datasets | Acceptable for Pilot (SQLite, local). If needed later, add materialized views or caching |
| Scope creep from V1 image features | Image pipeline is Phase 7 — all Pilot features are complete and tested before V1 work begins |

---

## External Dependencies

- No external services required for Pilot — everything runs locally
- V1 image detection model: TBD — the backend defines the interface; model implementation is a separate concern
- Future cloud deployment (Aurora, Lambda, S3) is out of scope for this plan but the architecture is compatible
