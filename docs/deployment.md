# Deployment & Local Network Sharing

| Field | Value |
|---|---|
| **Title** | All In Analytics — Docker Compose & WSL Network Sharing |
| **Date** | 2026-04-14 |
| **Author** | Kurt (Nightcrawler) |
| **Scope** | `docker-compose.yml`, `backend/Dockerfile`, `backend/Dockerfile.gpu`, `frontend/Dockerfile`, `scripts/docker/docker-entrypoint.sh`, `scripts/docker/share.sh`, `scripts/docker/unshare.sh` |
| **Status** | Current |

---

## Table of Contents

1. [Overview](#overview)
2. [Service Architecture](#service-architecture)
3. [Docker Compose Services](#docker-compose-services)
4. [Dockerfiles](#dockerfiles)
5. [Entrypoint Script](#entrypoint-script)
6. [Environment Variables](#environment-variables)
7. [Volume Mounts](#volume-mounts)
8. [Starting the Stack](#starting-the-stack)
9. [WSL Network Sharing](#wsl-network-sharing)

---

## Overview

The shared compose path is a proxy-fronted, network-segmented stack: **nginx**
owns host ingress on ports 80 and 443 and is the only service attached to the
explicit `edge` and `internal` networks. Port 80 serves only as an
HTTP-to-HTTPS redirect, while port 443 proxies browser traffic to the
**Node.js/Vite frontend** on `edge` and API traffic to the **Python/FastAPI
backend** (CPU or GPU variant) on `internal`. Docker Compose still uses
bind-mounted source directories for development, but the frontend and backend
are no longer published directly on the host in the shared path.

Forwarded-header trust is now bounded to that proxy edge. The shared compose
internal network reserves `172.29.0.2` for nginx, and the backend entrypoint
defaults `UVICORN_FORWARDED_ALLOW_IPS` to that address so uvicorn only accepts
`X-Forwarded-For` / `X-Forwarded-Proto` from nginx.

For poker nights on WSL2, `share.sh` exposes only the nginx proxy through the
Windows host by configuring Windows port forwarding for ports 80 and 443 and
publishing `aia.local` from Windows. That path improves reachability, but it does not
preserve distinct client source IPs to nginx, so IP-based rate limiting becomes
per-forwarder rather than per-client.

---

## Service Architecture

Shared ingress flow:

`LAN client -> Windows portproxy (WSL2 only) -> nginx :443 (TLS proxy) -> frontend:5173 or backend:8000`

Redirect-only HTTP path:

`LAN client -> Windows portproxy (WSL2 only) -> nginx :80 -> 301 redirect to https://...`

Segmented container flows:

`edge` network: nginx <-> frontend:5173

`internal` network: nginx <-> backend:8000

`backend -> /app/data/poker.db / models`

Direct publication of `5173` and `8000` is no longer part of the shared compose
path. The dev-only override restores `127.0.0.1:8000` and `127.0.0.1:5173` for
local debugging without reopening those ports to the LAN. See
`docs/local-network-setup.md` for the current supported sharing flow.

---

## Docker Compose Services

Defined in [docker-compose.yml](../docker-compose.yml). Three services, two profiles.

| Service | Profile | Base Image | Port | Purpose |
|---|---|---|---|---|
| `backend` | `cpu` | `python:3.12.13` ([Dockerfile](../backend/Dockerfile)) | 8000 | FastAPI backend with CPU-only PyTorch |
| `backend-gpu` | `gpu` | `nvidia/cuda:12.1.0-runtime-ubuntu22.04` ([Dockerfile.gpu](../backend/Dockerfile.gpu)) | 8000 | FastAPI backend with CUDA 12.1 PyTorch |
| `frontend` | *(default)* | `node:22.22.2-alpine` ([frontend/Dockerfile](../frontend/Dockerfile)) | 5173 | Vite dev server (internal-only in shared compose; `127.0.0.1:5173` via dev override) |

The `backend` and `backend-gpu` services share the same volume mounts (via YAML anchor `&backend-volumes`) and environment variables (via `&backend-env`). They never run simultaneously — use one profile or the other.

The `backend-gpu` service has a network alias `backend` on the `internal` segment so the proxy can reach it at the same hostname regardless of which profile is active. It reserves one NVIDIA GPU via Docker's device reservation.

The `frontend` service has no profile — it starts with either `cpu` or `gpu`.

## Pinned Image Refresh

The shared compose proxy image and every external Dockerfile image input are digest-pinned so rebuilds stay reproducible. Until Dependabot or Renovate is configured for OCI digests in this repo, keep those refs current with a manual review step:

1. Resolve the candidate image tag and manifest digest with `docker buildx imagetools inspect <image:tag>`.
2. Update the matching `image`, `FROM`, or `COPY --from=` line only after reviewing the upstream release notes for that tag.
3. Re-run `docker compose config` and `cd backend && uv run pytest test/test_docker_config.py -q` before landing the digest bump.

---

## Dockerfiles

### Backend CPU — [Dockerfile](../backend/Dockerfile)

| Stage | What happens |
|---|---|
| Base image | `python:3.12.13` |
| uv install | Copied from `ghcr.io/astral-sh/uv:0.5.9` |
| System deps | `libgl1`, `libglib2.0-0` (OpenCV requirements for ultralytics) |
| Dependency cache | `pyproject.toml` + `uv.lock` copied early; `uv sync --frozen --group test` runs on stubs |
| PyTorch | CPU-only wheels from `download.pytorch.org/whl/cpu` |
| ultralytics | Installed into the project venv |
| Entrypoint | [docker-entrypoint.sh](../scripts/docker/docker-entrypoint.sh) |

### Backend GPU — [Dockerfile.gpu](../backend/Dockerfile.gpu)

| Stage | What happens |
|---|---|
| Base image | `nvidia/cuda:12.1.0-runtime-ubuntu22.04` |
| uv install | Copied from `ghcr.io/astral-sh/uv:0.5.9` |
| Python 3.12 | Installed from `ppa:deadsnakes` |
| System deps | Same as CPU + `curl`, `python3.12-dev` |
| PyTorch | CUDA 12.1 wheels from `download.pytorch.org/whl/cu121` |
| NVIDIA env | `NVIDIA_VISIBLE_DEVICES=all`, `NVIDIA_DRIVER_CAPABILITIES=compute,utility` |
| Entrypoint | Same [docker-entrypoint.sh](../scripts/docker/docker-entrypoint.sh) |

### Frontend — [frontend/Dockerfile](../frontend/Dockerfile)

| Stage | What happens |
|---|---|
| Base image | `node:22.22.2-alpine` |
| Dependencies | `npm install` from `package.json` |
| Build check | `npm run build` verifies TypeScript compilation |
| Runtime | `npm run dev` — Vite dev server with HMR |

---

## Entrypoint Script

Defined in [docker-entrypoint.sh](../scripts/docker/docker-entrypoint.sh). Runs on every backend container start.

```
1. mkdir -p /app/uploads
2. If SEED_DATA=1:
   - Switch to ephemeral `/tmp/demo.db` on the writable tmpfs (poker.db untouched)
   - Delete any previous `/tmp/demo.db`
3. If `SEED_DATA=1` or `RUN_DB_MIGRATIONS=1`, run Alembic migrations (`alembic upgrade head`)
   - Otherwise skip migrations and leave the existing schema untouched
4. If SEED_DATA=1:
   - Run seed_demo_game.py
5. Start uvicorn on `0.0.0.0:8000`
6. When `UVICORN_PROXY_HEADERS=1` (shared path default), add
   `--proxy-headers --forwarded-allow-ips=${UVICORN_FORWARDED_ALLOW_IPS:-172.29.0.2}`
7. When `UVICORN_RELOAD=1` (dev override only), add `--reload`
```

The `SEED_DATA=1` mode creates a throwaway `/tmp/demo.db` for demonstration purposes without touching the real `poker.db`. The hardened backend keeps working because `/tmp` remains writable even when the rest of the container filesystem is read-only.

Both the shared compose file and the dev override default `RUN_DB_MIGRATIONS` to
`0`, so ordinary container restarts no longer auto-upgrade the schema. Run
migrations intentionally when you change Alembic state:

```bash
AIA_RUN_DB_MIGRATIONS=1 docker compose --profile cpu up backend
docker compose run --rm -e RUN_DB_MIGRATIONS=1 backend
```

Swap `backend-gpu` / `--profile gpu` into those commands when you are using the
CUDA-backed service.

The dev override keeps `UVICORN_PROXY_HEADERS=0` because that path publishes the
backend on `127.0.0.1:8000` for direct debugging rather than routing through
nginx. That avoids trusting spoofable forwarded headers on the bypass path.

---

## Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `PYTHONPATH` | `/app/src` | Makes `app` and `pydantic_models` packages importable |
| `DATABASE_URL` | `${AIA_DATABASE_URL:-sqlite:////app/data/poker.db}` | SQLAlchemy database URL inside the managed SQLite data path |
| `SEED_DATA` | `0` | Set to `1` to seed demo data on a throwaway `/tmp/demo.db` |
| `RUN_DB_MIGRATIONS` | `${AIA_RUN_DB_MIGRATIONS:-0}` | Opt-in startup migration gate; set to `1` only when you intentionally want the container start path to run `alembic upgrade head` |
| `ALLOWED_ORIGINS` | `https://aia.local` | Comma-separated CORS origins injected into the backend container |
| `UVICORN_FORWARDED_ALLOW_IPS` | `172.29.0.2` | Shared-path trust boundary for proxy headers; only nginx's reserved bridge IP is trusted by default |

The shared compose path sets `ALLOWED_ORIGINS` from `${AIA_SHARED_ALLOWED_ORIGINS:-https://aia.local}` so the shared HTTPS edge stays explicit once TLS is enabled.

The shared compose path also sets `UVICORN_FORWARDED_ALLOW_IPS` from `${AIA_TRUSTED_PROXY_IPS:-172.29.0.2}`. If you change the reserved proxy IP on the compose network, update that env var in lockstep.

The dev override sets `ALLOWED_ORIGINS` from `${AIA_DEV_ALLOWED_ORIGINS:-http://localhost:5173,http://127.0.0.1:5173,https://aia.local}` so direct localhost debugging stays separate from the shared edge origin.

The dev override also keeps `UVICORN_PROXY_HEADERS=0` so direct loopback access
does not trust any forwarded headers when it bypasses nginx.

The localhost-only debug origins are:

| Origin | When used |
|---|---|
| `http://localhost:5173` | Browser accessing frontend directly |
| `http://127.0.0.1:5173` | Loopback access |

`http://0.0.0.0:5173` is intentionally excluded because browsers do not emit it as a valid request origin.

Additional private-network origins (`192.168.*`, `10.*`, etc.) are handled by a regex in `main.py` — no env var needed for LAN access.

---

## Container User Mapping

Backend and frontend images run as a non-root `app` user. The compose build passes `AIA_UID` and `AIA_GID` through to the Dockerfiles so the runtime UID/GID can be changed. Uploaded card photos live in the named volume `card-uploads`, which takes its ownership from the image, so they do not depend on which host user runs Docker.

SQLite no longer depends on a host-owned bind-mounted file. The runtime image pre-creates `/app/data` as `app:app` before Docker attaches the named volume so the first-run write path stays compatible with the hardened non-root runtime.

If your Linux or WSL user is not `1000:1000`, build with:

```bash
AIA_UID=$(id -u) AIA_GID=$(id -g) docker compose up --build
```

The shared compose path also mounts source, config, scripts, and model assets read-only inside the containers. Only the named SQLite volume and uploads directory remain writable.

---

## Volume Mounts

Source and config paths are bind-mounted read-only for live-reload. Runtime data paths stay writable.

### Backend Volumes

| Host Path | Container Path | Mode | Purpose |
|---|---|---|---|
| `./backend/src` | `/app/src` | `ro` | Application source code (live-reload) |
| `./backend/alembic` | `/app/alembic` | `ro` | Migration scripts |
| `./backend/alembic.ini` | `/app/alembic.ini` | `ro` | Alembic configuration |
| `./backend/pyproject.toml` | `/app/pyproject.toml` | `ro` | Project metadata and dependencies |
| `./backend/uv.lock` | `/app/uv.lock` | `ro` | Locked dependency versions |
| `./scripts/docker/docker-entrypoint.sh` | `/app/docker-entrypoint.sh` | `ro` | Entrypoint script |
| `./scripts` | `/app/scripts` | `ro` | Utility scripts (seed, etc.) |
| `./backend/models` | `/app/models` | `ro` | YOLO model weights |
| `poker-data` | `/app/data` | `rw` | Named volume containing `/app/data/poker.db` |
| `card-uploads` | `/app/uploads` | `rw` | Named volume of uploaded images for card detection |

### Frontend Volumes

| Host Path | Container Path | Mode | Purpose |
|---|---|---|---|
| `./frontend/src` | `/app/src` | `ro` | React/TypeScript source (HMR) |
| `./frontend/index.html` | `/app/index.html` | `ro` | Entry HTML |
| `./frontend/public` | `/app/public` | `ro` | Static assets |
| `./frontend/vite.config.ts` | `/app/vite.config.ts` | `ro` | Vite configuration |
| `./frontend/tsconfig.json` | `/app/tsconfig.json` | `ro` | TypeScript configuration |

---

## SQLite Persistence and Backups

The shared compose path now stores SQLite in the named volume `poker-data`, mounted at `/app/data` inside whichever backend profile is active. Both compose files point `DATABASE_URL` at `/app/data/poker.db`, so the runtime no longer depends on the fragile `./backend/poker.db:/app/poker.db` file bind mount.

The backend runtime image pre-creates `/app/data` as `app:app` before Docker first attaches the named volume. That keeps the volume writable for the non-root runtime user without weakening the read-only root filesystem posture.

### Backup recipe

Take a quiesced backup so SQLite is not being written while you copy the file:

```bash
docker compose stop backend backend-gpu proxy
mkdir -p backups
docker compose run --rm -T --entrypoint python -v "$PWD/backups:/backup" backend \
   -c "from pathlib import Path; Path('/backup/poker.db').write_bytes(Path('/app/data/poker.db').read_bytes())"
```

If the GPU profile owns the database, substitute `backend-gpu` for `backend` in the one-off backup command. Rename `backups/poker.db` after each run if you want to retain multiple snapshots.

### Restore a backup

To restore a backup, stop the stack, then reverse the copy into `/app/data/poker.db` before bringing the proxy and backend back up:

```bash
docker compose stop backend backend-gpu proxy
docker compose run --rm -T --entrypoint python -v "$PWD/backups:/backup" backend \
   -c "from pathlib import Path; Path('/app/data/poker.db').write_bytes(Path('/backup/poker.db').read_bytes())"
```

Keep the backend stopped until the restore completes, then restart the profile you normally run.

---

## Starting the Stack

### CPU mode (default)

```bash
docker compose --profile cpu up --build
```

### Local direct-debug override

Use the override when you want direct loopback access to the hot-reloading
backend or frontend without reopening either service to the LAN:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml --profile cpu up --build
```

### GPU mode (NVIDIA GPU required)

```bash
docker compose --profile gpu up --build
```

Requires the [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html) to be installed on the host.

### With demo data

```bash
SEED_DATA=1 docker compose --profile cpu up --build
```

This starts the backend against `/tmp/demo.db`, recreates the demo dataset on each boot, and leaves the persisted `poker-data` volume untouched.

### Frontend only (for frontend development against a local backend)

```bash
docker compose up frontend --build
```

---

## WSL Network Sharing

Two scripts in `scripts/` enable sharing the running application with other devices on the same Wi-Fi network. This is designed for **Windows Subsystem for Linux (WSL2)**, where the Docker containers run inside a WSL VM that isn't directly reachable from the LAN.

### The Problem

```
Phone on Wi-Fi -> Windows LAN IP:80/443 -> WSL2 nginx:80/443
```

WSL2 runs in a Hyper-V VM with its own virtual network adapter. Other devices on the Wi-Fi can reach the Windows host IP, but not the WSL internal IP. Port forwarding bridges this gap.

### share.sh

Defined in [scripts/docker/share.sh](../scripts/docker/share.sh). Run from within WSL:

```bash
./scripts/docker/share.sh
```

What it does:

1. **Gets the WSL IP** — `hostname -I` returns the WSL2 VM's internal IP (e.g. `172.30.x.x`)
2. **Resets existing port forwarding** — Clears any stale `netsh portproxy` rules
3. **Creates the proxy port-forward rules** via PowerShell calling `netsh`:
   - `0.0.0.0:80` → `WSL_IP:80` (HTTP redirect into nginx)
   - `0.0.0.0:443` → `WSL_IP:443` (HTTPS entrypoint into nginx)
4. **Discovers the Windows Wi-Fi IP** — Queries `Get-NetIPAddress` for the Wi-Fi adapter's IPv4 address
5. **Prints the shareable URLs** — `https://aia.local` and, when the local certificate includes the current LAN IP as a SAN, `https://192.168.1.42`

Players on the same Wi-Fi should open `https://aia.local` on their phones to
access the proxied app. `http://aia.local` remains available only as an HTTP to
HTTPS redirect.

Security note: Windows `netsh interface portproxy` does not preserve distinct
LAN client source IPs into WSL. On this shared path, nginx rate limiting keyed
by `$binary_remote_addr` buckets the Windows forwarder hop rather than each
individual client. Treat WSL2 sharing as a reachability convenience; when
meaningful per-client IP throttling matters, use native Linux/macOS ingress or
another ingress layer that preserves source addresses.

### unshare.sh

Defined in [scripts/docker/unshare.sh](../scripts/docker/unshare.sh). Tears down the port forwarding:

```bash
./scripts/docker/unshare.sh
```

Runs `netsh interface portproxy reset` via PowerShell to remove all forwarding rules.

Current flow:

`Windows LAN IP:80/443 -> netsh portproxy -> WSL2 nginx:80 (redirect) / 443 (TLS proxy) -> frontend/backend`

### Prerequisites

- **Windows 10/11** with WSL2 enabled
- **Administrator privileges** — `netsh portproxy` requires elevation. The script calls PowerShell from WSL, which inherits the WSL terminal's privilege level. If permissions fail, run your WSL terminal as Administrator.
- **Windows Firewall** — Ports 80 and 443 must be allowed through the Windows firewall for inbound proxy access. `share.sh` creates the matching `AIA-HTTP` and `AIA-HTTPS` rules after the UAC prompt. If you need to recreate them manually:
  ```powershell
  # Run in an elevated PowerShell
   New-NetFirewallRule -DisplayName "AIA-HTTP"  -Direction Inbound -LocalPort 80  -Protocol TCP -Action Allow
   New-NetFirewallRule -DisplayName "AIA-HTTPS" -Direction Inbound -LocalPort 443 -Protocol TCP -Action Allow
  ```

### Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Phone can't reach the URL | Windows Firewall blocking proxy ports | Re-run `./scripts/docker/share.sh` or allow inbound TCP on 80 and 443 |
| `netsh` command fails | WSL terminal not elevated | Restart terminal as Administrator |
| Wrong LAN IP printed | Multiple network adapters | Script filters for `Wi-Fi` interface; if yours is named differently (e.g. `Ethernet`), edit the `InterfaceAlias` filter in `scripts/docker/share.sh` |
| Connection works briefly then breaks | WSL IP changed after reboot | Re-run `./scripts/docker/share.sh` — WSL2 gets a new IP on each boot |
| CORS error in browser | Frontend URL doesn't match `ALLOWED_ORIGINS` | The `main.py` regex already allows private IPs; if using a custom domain, add it to `ALLOWED_ORIGINS` |
