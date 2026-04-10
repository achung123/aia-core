#!/bin/sh
set -e

if [ "$SEED_DATA" = "1" ]; then
  # Use an ephemeral demo database so real poker.db is never touched
  export DATABASE_URL="sqlite:///./demo.db"
  rm -f /app/demo.db
  echo "SEED_DATA=1: using ephemeral demo.db (poker.db untouched)"
fi

echo "Running Alembic migrations..."
uv run alembic upgrade head

if [ "$SEED_DATA" = "1" ]; then
  echo "Seeding demo data..."
  uv run python scripts/seed_demo_game.py || echo "Seed skipped"
fi

echo "Starting uvicorn..."
exec uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
