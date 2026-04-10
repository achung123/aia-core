#!/bin/sh
set -e

if [ "$SEED_DATA" = "1" ]; then
  echo "SEED_DATA=1: wiping existing database for a clean seed..."
  : > /app/poker.db
fi

echo "Running Alembic migrations..."
uv run alembic upgrade head

if [ "$SEED_DATA" = "1" ]; then
  echo "Seeding demo data..."
  uv run python scripts/seed_demo_game.py || echo "Seed skipped (may already exist)"
fi

echo "Starting uvicorn..."
exec uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
