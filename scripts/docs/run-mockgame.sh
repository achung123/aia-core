#!/bin/bash
# Reset the throwaway mock instance, then play the mock game and take screenshots.
# usage: run-mockgame.sh <output-dir> <worktree-root> [playwright-dir]
# Needs: backend deps (uv) and frontend deps in <worktree-root>; Playwright in <playwright-dir>/node_modules.
set -e
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
OUT=$1; ROOT=$2; PW=${3:-$ROOT/frontend}
DB=/tmp/aia-mock/mock.db
mkdir -p /tmp/aia-mock "$OUT"
for port in 8096 5196; do
  ss -ltnp 2>/dev/null | grep ":$port " | sed 's/.*pid=\([0-9]*\).*/\1/' | xargs -r kill || true
done
sleep 2
rm -f /tmp/aia-mock/mock.db*
(cd "$ROOT/backend" && DATABASE_URL=sqlite:///$DB uv run alembic upgrade head >/dev/null 2>&1)
(cd "$ROOT/backend" && DATABASE_URL=sqlite:///$DB ALLOWED_ORIGINS=http://127.0.0.1:5196 \
  nohup uv run uvicorn app.main:app --host 127.0.0.1 --port 8096 > /tmp/aia-mock/be.log 2>&1 &)
(cd "$ROOT/frontend" && AIA_DISABLE_HMR=1 VITE_API_BASE_URL=http://127.0.0.1:8096 \
  nohup npx vite --host 127.0.0.1 --port 5196 --strictPort > /tmp/aia-mock/fe.log 2>&1 &)
for i in $(seq 1 60); do
  curl -s http://127.0.0.1:8096/healthz >/dev/null && curl -s http://127.0.0.1:5196 >/dev/null && break
  sleep 1
done
# ES modules resolve packages relative to the script, so run a copy from
# inside a project that has @playwright/test installed.
cd "$PW"
cp "$SCRIPT_DIR/mockgame.mjs" ./.mockgame.run.mjs
trap 'rm -f ./.mockgame.run.mjs' EXIT
node ./.mockgame.run.mjs "$OUT" "$ROOT/backend/test/data/ah-2h.jpg"
