#!/bin/sh
set -e

# Ensure upload directory exists (bind-mount may not create it)
mkdir -p /app/uploads

if [ "$SEED_DATA" = "1" ]; then
  # Use a tmpfs-backed demo database so real poker.db is never touched.
  export DATABASE_URL="sqlite:////tmp/demo.db"
  rm -f /tmp/demo.db
  echo "SEED_DATA=1: using ephemeral /tmp/demo.db (poker.db untouched)"
fi

if [ "$SEED_DATA" = "1" ] || [ "${RUN_DB_MIGRATIONS:-0}" = "1" ]; then
  echo "Running Alembic migrations..."
  .venv/bin/alembic upgrade head
else
  echo "Skipping Alembic migrations (RUN_DB_MIGRATIONS=0)"
fi

if [ "$SEED_DATA" = "1" ]; then
  echo "Seeding demo data..."
  .venv/bin/python scripts/seed_demo_game.py || echo "Seed skipped"
fi

echo "Starting uvicorn..."
set -- \
  app.main:app \
  --host 0.0.0.0 \
  --port 8000

if [ "${UVICORN_PROXY_HEADERS:-1}" = "1" ]; then
  set -- "$@" \
    --proxy-headers \
    --forwarded-allow-ips "${UVICORN_FORWARDED_ALLOW_IPS:-172.29.0.2}"
fi

if [ "${UVICORN_RELOAD:-0}" = "1" ]; then
  set -- "$@" --reload
fi

exec .venv/bin/uvicorn "$@"
