# Tasks — Compose Security Hardening

**Project ID:** compose-security-hardening-011
**Date:** 2026-04-22
**Total Tasks:** 19
**Status:** Draft

---

## Task Index

| ID | Finding | Severity | Priority | Dependencies | Title |
|---|---|---|---|---|---|
| T-001 | F-01 | CRITICAL | 0 | none | Hot-reloading dev backend published to host, bypassing nginx |
| T-002 | F-07 | HIGH | 1 | none | Vite dev server exposed directly on port 5173 |
| T-003 | F-02 | HIGH | 1 | none | No TLS termination; all traffic is plaintext HTTP |
| T-004 | F-03 | HIGH | 1 | none | Avahi container runs with `network_mode: host` |
| T-005 | F-04 | HIGH | 1 | none | Containers run as root; writable bind-mounts cover source and DB |
| T-006 | F-05 | HIGH | 1 | none | No resource limits; trivial host DoS |
| T-007 | F-06 | HIGH | 1 | none | Nginx proxy exposes no security headers and no rate limiting |
| T-008 | F-08 | MEDIUM | 2 | none | `depends_on` lacks `condition: service_healthy` |
| T-009 | F-09 | MEDIUM | 2 | none | Permissive `ALLOWED_ORIGINS` includes `0.0.0.0` |
| T-010 | F-10 | MEDIUM | 2 | T-001 | `X-Forwarded-For` set by proxy but backend trust unclear |
| T-011 | F-11 | MEDIUM | 2 | none | Floating / unpinned base images |
| T-012 | F-12 | MEDIUM | 2 | none | No logging driver configured; no rotation |
| T-013 | F-13 | MEDIUM | 2 | none | Source code and entrypoint script bind-mounted read-write |
| T-014 | F-14 | MEDIUM | 2 | none | SQLite DB bind-mounted into container; no backup / permission strategy |
| T-015 | F-15 | LOW | 3 | none | `container_name` hard-coded prevents scaling and collides on multi-project hosts |
| T-016 | F-16 | LOW | 3 | none | No explicit `networks:` declaration |
| T-017 | F-17 | LOW | 3 | none | `nginx` proxy has no `server_tokens off;` and leaks version |
| T-018 | F-18 | LOW | 3 | none | Entrypoint runs Alembic migrations on every start without locking |
| T-019 | F-19 | LOW | 3 | none | No `.dockerignore` scrutiny; risk of leaking `poker.db` / `.env` into images |

---

## Task Details

### T-001 — F-01 Hot-reloading dev backend published to host, bypassing nginx

**Category:** infra
**Finding:** F-01 — Hot-reloading dev backend published to host, bypassing nginx
**Severity:** CRITICAL
**Priority:** 0
**Dependencies:** none
**Story Ref:** —
**Source file(s):** `docker-compose.yml`; `scripts/docker/proxy.conf`; `scripts/docker/docker-entrypoint.sh`; `scripts/docker/share.sh`

Remove direct host publication of backend port 8000 from the shared compose path, route API traffic only through nginx on an internal service path, and isolate dev-only reload behavior into compose overrides so hostile LAN traffic cannot reach uvicorn directly.

**Acceptance Criteria:**
1. The shared compose path no longer publishes `8000:8000` for `backend` or `backend-gpu`, and backend reachability is limited to internal compose networking.
2. The proxy has an explicit upstream and `/api/` routing path to the backend, or an equivalent internal-only API route, so nginx becomes the only ingress.
3. Dev-only reload and any direct backend exposure live in an override file or profile, while the non-dev startup path drops `--reload` and enables proxy-header trust settings.

---

### T-002 — F-07 Vite dev server exposed directly on port 5173

**Category:** infra
**Finding:** F-07 — Vite dev server exposed directly on port 5173
**Severity:** HIGH
**Priority:** 1
**Dependencies:** none
**Story Ref:** —
**Source file(s):** `docker-compose.yml`; `frontend/vite.config.ts`; `frontend/Dockerfile`; `scripts/docker/proxy.conf`

Remove direct host publication of the Vite dev server, tighten Vite filesystem serving, and ensure frontend traffic flows through the proxy or a built static bundle path instead of raw dev-server exposure.

**Acceptance Criteria:**
1. The shared compose path no longer publishes `5173:5173` for `frontend`, and LAN access goes through the proxy path only.
2. `vite.config.ts` uses strict filesystem serving and an explicit allowlist rather than permissive host/file access defaults.
3. The shared or prod frontend path remains reachable without requiring direct host access to the Vite dev server.

---

### T-003 — F-02 No TLS termination; all traffic is plaintext HTTP

**Category:** infra
**Finding:** F-02 — No TLS termination; all traffic is plaintext HTTP
**Severity:** HIGH
**Priority:** 1
**Dependencies:** none
**Story Ref:** —
**Source file(s):** `docker-compose.yml`; `scripts/docker/proxy.conf`; `docs/local-network-setup.md`

Add HTTPS termination at the proxy with local-cert support for `aia.local`, redirect HTTP to HTTPS, and document the dev and prod certificate path so LAN traffic is no longer plaintext.

**Acceptance Criteria:**
1. The proxy configuration includes a `443` TLS server block with mounted certificate and key paths appropriate for local-network use.
2. Port `80` redirects to HTTPS, and HSTS is included once the HTTPS path is stable.
3. `docs/local-network-setup.md` documents the mkcert-style local certificate flow and notes the intended ACME or production certificate path.

---

### T-004 — F-03 Avahi container runs with `network_mode: host`

**Category:** infra
**Finding:** F-03 — Avahi container runs with `network_mode: host`
**Severity:** HIGH
**Priority:** 1
**Dependencies:** none
**Story Ref:** —
**Source file(s):** `docker-compose.yml`

Replace or pin the Avahi image and harden the service around the minimum privileges needed for mDNS, keeping host networking only if it is validated as required for the current discovery setup.

**Acceptance Criteria:**
1. The `mdns` image is versioned and digest-pinned to a maintained source or replaced by a locally controlled image.
2. If host networking remains, the service drops all capabilities except the minimum required set and uses `no-new-privileges` plus a read-only filesystem.
3. The compose comments or adjacent docs capture whether explicit UDP `5353` publishing was evaluated as an alternative to host networking.

---

### T-005 — F-04 Containers run as root; writable bind-mounts cover source and DB

**Category:** infra
**Finding:** F-04 — Containers run as root; writable bind-mounts cover source and DB
**Severity:** HIGH
**Priority:** 1
**Dependencies:** none
**Story Ref:** —
**Source file(s):** `backend/Dockerfile`; `backend/Dockerfile.gpu`; `frontend/Dockerfile`; `docker-compose.yml`

Run backend and frontend processes as a dedicated non-root user, chown the working tree during image build, and add runtime hardening flags so container compromise does not translate to root-level write access.

**Acceptance Criteria:**
1. Each runtime Dockerfile declares a non-root `USER` with owned working directories and startup-compatible permissions.
2. Compose applies `no-new-privileges` and read-only or `tmpfs` constraints where the services can support them.
3. The stack still boots and reads its required assets under the non-root user without falling back to UID 0.

---

### T-006 — F-05 No resource limits; trivial host DoS

**Category:** infra
**Finding:** F-05 — No resource limits; trivial host DoS
**Severity:** HIGH
**Priority:** 1
**Dependencies:** none
**Story Ref:** —
**Source file(s):** `docker-compose.yml`

Add explicit memory, CPU, and PID caps for every compose service, with GPU service values tuned separately from CPU defaults so malformed traffic or runaway reload behavior cannot exhaust the host unchecked.

**Acceptance Criteria:**
1. Every long-running service declares memory, CPU, and PID limits using the compose-supported mechanism already used by this repo.
2. GPU reservations remain intact while the GPU profile also gains explicit operational limits or documented exceptions.
3. The limit values are recorded in compose comments or docs so later tuning can happen without rediscovering the baseline.

---

### T-007 — F-06 Nginx proxy exposes no security headers and no rate limiting

**Category:** infra
**Finding:** F-06 — Nginx proxy exposes no security headers and no rate limiting
**Severity:** HIGH
**Priority:** 1
**Dependencies:** none
**Story Ref:** —
**Source file(s):** `scripts/docker/proxy.conf`

Add a shared security-header policy, request and body timeouts, and request rate limiting at the nginx layer so abuse and browser-based attacks hit a hardened edge first.

**Acceptance Criteria:**
1. The proxy sends baseline hardening headers including `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, and a starter CSP or documented equivalent policy.
2. Request limiting is defined and applied to API traffic through nginx.
3. Timeout settings for headers, request bodies, and responses are present to reduce slow-loris style abuse.

---

### T-008 — F-08 `depends_on` lacks `condition: service_healthy`

**Category:** infra
**Finding:** F-08 — `depends_on` lacks `condition: service_healthy`
**Severity:** MEDIUM
**Priority:** 2
**Dependencies:** none
**Story Ref:** —
**Source file(s):** `docker-compose.yml`; `backend/src/app/main.py`

Add healthchecks for the services that receive traffic and convert `depends_on` to the long form with `condition: service_healthy` so startup sequencing follows readiness instead of mere container launch.

**Acceptance Criteria:**
1. Backend, frontend, and proxy each expose a cheap healthcheck target or command suitable for compose health monitoring.
2. `depends_on` uses `condition: service_healthy` where an upstream must be ready before a dependent starts serving traffic.
3. Startup no longer relies on transient 502s or manual waiting to reach a healthy steady state.

---

### T-009 — F-09 Permissive `ALLOWED_ORIGINS` includes `0.0.0.0`

**Category:** infra
**Finding:** F-09 — Permissive `ALLOWED_ORIGINS` includes `0.0.0.0`
**Severity:** MEDIUM
**Priority:** 2
**Dependencies:** none
**Story Ref:** —
**Source file(s):** `docker-compose.yml`

Clean the origin list, split dev and non-dev origins into environment-specific configuration, and make the secure `aia.local` origin explicit so CORS stops carrying invalid or stale values.

**Acceptance Criteria:**
1. `http://0.0.0.0:5173` is removed from the allowed origin list.
2. Origin values are parameterized by environment or compose override instead of a single hard-coded mixed list.
3. The secured `aia.local` origin is accounted for in the configuration path intended to follow TLS rollout.

---

### T-010 — F-10 `X-Forwarded-For` set by proxy but backend trust unclear

**Category:** infra
**Finding:** F-10 — `X-Forwarded-For` set by proxy but backend trust unclear
**Severity:** MEDIUM
**Priority:** 2
**Dependencies:** T-001
**Story Ref:** —
**Source file(s):** `scripts/docker/proxy.conf`; `scripts/docker/docker-entrypoint.sh`; `docker-compose.yml`

After backend ingress is proxy-only, configure uvicorn and nginx to trust forwarded headers only from the proxy boundary and normalize real client IP handling.

**Acceptance Criteria:**
1. Backend startup uses `--proxy-headers` and a narrowed `--forwarded-allow-ips` value instead of trusting arbitrary clients.
2. Nginx normalizes client IP handling with explicit trusted-source configuration before passing forwarding headers upstream.
3. There is no remaining direct host path that would let arbitrary clients bypass the proxy and spoof forwarding headers.

---

### T-011 — F-11 Floating / unpinned base images

**Category:** infra
**Finding:** F-11 — Floating / unpinned base images
**Severity:** MEDIUM
**Priority:** 2
**Dependencies:** none
**Story Ref:** —
**Source file(s):** `docker-compose.yml`; `backend/Dockerfile`; `backend/Dockerfile.gpu`; `frontend/Dockerfile`

Pin runtime and build-stage images by digest and record the update strategy so rebuilds are reproducible and less exposed to supply-chain drift.

**Acceptance Criteria:**
1. Compose images and Dockerfile `FROM` or `COPY --from=` stages use explicit versions plus digests instead of floating tags.
2. The current `latest` or implicitly floating inputs are removed from the build path.
3. The repo records how those digests will be kept current, such as Dependabot, Renovate, or a documented manual review step.

---

### T-012 — F-12 No logging driver configured; no rotation

**Category:** infra
**Finding:** F-12 — No logging driver configured; no rotation
**Severity:** MEDIUM
**Priority:** 2
**Dependencies:** none
**Story Ref:** —
**Source file(s):** `docker-compose.yml`

Add bounded logging configuration to each service so log growth cannot fill the host disk and runtime logs remain predictable.

**Acceptance Criteria:**
1. Each service has a `logging` stanza with a bounded driver and rotation options such as `max-size` and `max-file`.
2. The chosen log-retention defaults are consistent across services unless a service-specific reason is documented.
3. The compose file remains valid with the logging policy applied across the stack.

---

### T-013 — F-13 Source code and entrypoint script bind-mounted read-write

**Category:** infra
**Finding:** F-13 — Source code and entrypoint script bind-mounted read-write
**Severity:** MEDIUM
**Priority:** 2
**Dependencies:** none
**Story Ref:** —
**Source file(s):** `docker-compose.yml`

Flip source, config, model, and script bind mounts to read-only and leave writable access only where the application genuinely needs to persist data.

**Acceptance Criteria:**
1. Source, config, model, and script bind mounts use `:ro` in the compose path intended for shared use.
2. Only data-bearing mounts remain writable, and each writable mount has a clear operational reason.
3. The developer workflow still starts successfully with the read-only mount posture in place.

---

### T-014 — F-14 SQLite DB bind-mounted into container; no backup / permission strategy

**Category:** infra
**Finding:** F-14 — SQLite DB bind-mounted into container; no backup / permission strategy
**Severity:** MEDIUM
**Priority:** 2
**Dependencies:** none
**Story Ref:** —
**Source file(s):** `docker-compose.yml`; `docs/deployment.md`

Move SQLite storage to a named volume or dedicated data path, update `DATABASE_URL` accordingly, and document backup or restore handling plus file-permission expectations.

**Acceptance Criteria:**
1. Compose uses a named volume or equivalent managed data path for SQLite storage instead of a raw bind-mounted file.
2. `DATABASE_URL` points at the managed data path used by the container runtime.
3. Deployment documentation includes a backup and restore recipe plus ownership or permission guidance for the retained data.

---

### T-015 — F-15 `container_name` hard-coded prevents scaling and collides on multi-project hosts

**Category:** infra
**Finding:** F-15 — `container_name` hard-coded prevents scaling and collides on multi-project hosts
**Severity:** LOW
**Priority:** 3
**Dependencies:** none
**Story Ref:** —
**Source file(s):** `docker-compose.yml`

Remove hard-coded container names so compose project scoping and multi-stack operation work naturally.

**Acceptance Criteria:**
1. Services rely on default compose naming instead of hard-coded `container_name` values.
2. Internal service discovery still works through service names or explicit aliases where needed.
3. The stack can be run under different compose project names without naming collisions.

---

### T-016 — F-16 No explicit `networks:` declaration

**Category:** infra
**Finding:** F-16 — No explicit `networks:` declaration
**Severity:** LOW
**Priority:** 3
**Dependencies:** none
**Story Ref:** —
**Source file(s):** `docker-compose.yml`

Declare separate edge and internal networks and attach only the services that need each segment so lateral movement and unintended east-west exposure are reduced.

**Acceptance Criteria:**
1. Compose defines at least `edge` and `internal` networks with explicit service attachments.
2. Proxy, frontend, backend, and auxiliary services are attached only to the minimum networks required for their traffic.
3. Service-to-service routing still works after network segmentation is introduced.

---

### T-017 — F-17 `nginx` proxy has no `server_tokens off;` and leaks version

**Category:** infra
**Finding:** F-17 — `nginx` proxy has no `server_tokens off;` and leaks version
**Severity:** LOW
**Priority:** 3
**Dependencies:** none
**Story Ref:** —
**Source file(s):** `scripts/docker/proxy.conf`

Disable nginx version disclosure at the edge.

**Acceptance Criteria:**
1. `server_tokens off;` is present in the active nginx configuration path used by the stack.
2. The intended deployment path no longer discloses an nginx version in standard response headers or error pages.
3. The configuration placement matches the repo's existing nginx structure rather than introducing a parallel config path.

---

### T-018 — F-18 Entrypoint runs Alembic migrations on every start without locking

**Category:** infra
**Finding:** F-18 — Entrypoint runs Alembic migrations on every start without locking
**Severity:** LOW
**Priority:** 3
**Dependencies:** none
**Story Ref:** —
**Source file(s):** `scripts/docker/docker-entrypoint.sh`

Gate migrations behind an explicit flag or lock so repeat starts and future multi-replica deployments do not race schema upgrades automatically.

**Acceptance Criteria:**
1. The entrypoint no longer runs migrations unconditionally on every container start.
2. Migrations still have an intentional execution path through an environment flag, wrapper command, or dedicated job.
3. The chosen behavior is documented close to the compose or entrypoint configuration so operators know when migrations will run.

---

### T-019 — F-19 No `.dockerignore` scrutiny; risk of leaking `poker.db` / `.env` into images

**Category:** infra
**Finding:** F-19 — No `.dockerignore` scrutiny; risk of leaking `poker.db` / `.env` into images
**Severity:** LOW
**Priority:** 3
**Dependencies:** none
**Story Ref:** —
**Source file(s):** `.dockerignore`; `backend/poker.db`; `backend/uploads/`; `npm_data/`; `npm_letsencrypt/`

Audit the build context and add or update `.dockerignore` so local databases, uploads, env files, git metadata, and large runtime directories cannot be baked into images.

**Acceptance Criteria:**
1. A repo-root `.dockerignore` exists and excludes the audit-listed sensitive or bulky paths.
2. The effective build context no longer includes local databases, uploads, env files, git metadata, or the retained reverse-proxy runtime directories.
3. The ignore list covers both backend and frontend image builds from the repo root.

---

## Bugs / Findings

- Audit source: [docs/agent/security/2026-04-21-audit-docker-compose.md](../../docs/agent/security/2026-04-21-audit-docker-compose.md)
- Coverage: T-001 through T-019 map one-to-one to F-01 through F-19 from the audit; F-20 through F-29 are post-review findings against T-001, T-002, T-003, T-005, T-007, T-010, T-015, T-017, and T-019.
- Priority policy for Logan sync: CRITICAL -> 0, HIGH -> 1, MEDIUM -> 2, LOW -> 3.

### F-20 — [MEDIUM] Dev override re-exposes backend on all host interfaces while docs describe it as localhost-only

**Source Task:** aia-core-7nvl / T-001
**Reviewer:** Tessa (Sage)

`docker-compose.dev.yml` publishes backend port `8000` on all host interfaces for `backend` and `backend-gpu`, while `README.md` and `docs/local-network-setup.md` describe the override path as localhost-only direct debugging. The override also preserves the direct-publication runtime path using proxy-header parsing and wildcard forwarded trust, so the effective exposure is broader than the docs claim.

**Suggested fix:** Bind the dev override to `127.0.0.1:8000:8000` for both backend services and/or tighten the direct-publication runtime path; align the docs with the actual behavior.

### F-21 — [MEDIUM] WSL2 shared path collapses nginx rate limiting to the Windows forwarder hop

**Source Task:** aia-core-6uc7 / T-007
**Reviewer:** Tessa (Sage)

`proxy.conf` keys the limiter on `$binary_remote_addr`, while the documented WSL2 share path routes LAN traffic through Windows `portproxy`; one noisy client can therefore exhaust the shared bucket for all clients behind that host.

**Suggested fix:** Key rate limiting on a client identity that survives the Windows forwarder hop, or explicitly document and bound the shared-bucket behavior for the WSL2 share path.

### F-22 — [LOW] Proxy regression tests do not lock throttling on all throttled backend prefixes

**Source Task:** aia-core-6uc7 / T-007
**Reviewer:** Tessa (Sage)

`test_docker_config.py` verifies `limit_req` for `/api/` but only checks route presence, not throttling assertions, for the direct backend prefixes.

**Suggested fix:** Extend the proxy regression tests so every backend prefix that should be throttled is asserted to carry the intended `limit_req` policy.

### F-23 — [MEDIUM] Read-only backend breaks the documented `SEED_DATA=1` demo startup path

**Source Task:** aia-core-qft2 / T-005
**Reviewer:** Tessa (Sage)

`docker-compose.yml` now runs backend services with a read-only root filesystem, but `scripts/docker/docker-entrypoint.sh` still switches `SEED_DATA=1` to `/app/demo.db` and deletes that file on startup. `README.md` and `docs/deployment.md` still advertise the demo mode, so the documented path no longer works under the hardened runtime.

**Suggested fix:** Move `demo.db` to a writable path compatible with the hardened runtime, or explicitly remove the mode from the hardened compose and docs; add regression coverage.

### F-24 — [MEDIUM] TLS rollout still trusts the plaintext `http://aia.local` browser origin

**Source Task:** aia-core-1ad1 / T-003
**Reviewer:** Tessa (Sage)

`docker-compose.yml` still includes `http://aia.local` in `ALLOWED_ORIGINS`, and `backend/src/app/main.py` feeds that env var into FastAPI CORS `allow_origins`. That leaves the new HTTPS edge trusting the plaintext browser origin and weakens the intended boundary.

**Suggested fix:** Switch the shared-edge `aia.local` origin to `https://aia.local` and leave broader origin hygiene to queued follow-up F-09 if needed.

### F-25 — [MEDIUM] Shared-access docs still advertise plaintext or direct-port paths after proxy-only frontend hardening

**Source Task:** aia-core-5d4b / T-002
**Reviewer:** Tessa (Sage)

`README.md` and `docs/deployment.md` still mention direct host-IP, plaintext, or direct-port sharing paths that conflict with the hardened proxy-only HTTPS model. That leaves the shared-access docs pointing operators back to `5173` or `8000` paths the hardened frontend flow is meant to retire.

**Suggested fix:** Align the shared-access docs to the proxy-only `80`/`443` path and keep direct `5173` or `8000` access documented only as localhost-only dev overrides.

### F-26 — [LOW] Deployment guide still describes shared ingress proxying on port 80 instead of redirecting to 443

**Source Task:** aia-core-hldf / T-010
**Reviewer:** Tessa (Sage)

`docs/deployment.md` still describes nginx on port `80` as the active proxy path, but `scripts/docker/proxy.conf` now uses port `80` for redirect-only and proxies actual traffic on `443`. The deployment guide therefore mismatches the hardened ingress model.

**Suggested fix:** Align `docs/deployment.md` to the redirect-on-`80` / proxy-on-`443` model and add a regression assertion if appropriate.

### F-27 — [LOW] Project-scoped naming docs overstate multi-stack coexistence while host ports and host-network mDNS remain singleton resources

**Source Task:** aia-core-09kj / T-015
**Reviewer:** Tessa (Sage)

`docs/local-network-setup.md` implies distinct compose project names avoid proxy or mDNS collisions, but `docker-compose.yml` still binds host ports `80` and `443` and keeps mDNS on host networking. Project-scoped naming avoids container-name collisions, not singleton host-resource conflicts.

**Suggested fix:** Narrow the docs and any related test claim to project-scoped naming only, and explicitly call out the remaining singleton host ports and host-network mDNS constraint.

### F-28 — [LOW] `server_tokens` regression can false-pass on commented text

**Source Task:** aia-core-dj5x / T-017
**Reviewer:** Tessa (Sage)

`backend/test/test_docker_config.py` only asserts the substring `server_tokens off;` exists. A future commented-out line would still satisfy the test even though nginx would ignore it.

**Suggested fix:** Tighten the test to require an active, uncommented directive.

### F-29 — [LOW] Repo-root build context still includes local virtualenv and tool caches

**Source Task:** aia-core-8o7a / T-019
**Reviewer:** Tessa (Sage)

`.dockerignore` does not exclude `.venv`, `.pytest_cache`, or `.ruff_cache`, so repo-root Docker builds can still send local runtime and tool artifacts in the build context.

**Suggested fix:** Add those patterns to `.dockerignore` and extend regression coverage.