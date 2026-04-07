#!/bin/sh
set -e

echo "Running Alembic migrations..."
uv run alembic upgrade head

if [ "$SEED_DATA" = "1" ]; then
  echo "Seeding demo data..."
  uv run python scripts/seed_demo_game.py || echo "Seed skipped (may already exist)"
fi

echo "Starting uvicorn..."
exec uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
