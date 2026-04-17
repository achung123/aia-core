# Code Review Report — frontend-react-ts-006

**Date:** 2026-04-12
**Target:** `frontend/Dockerfile`, `docker-compose.yml`, `test/test_docker_config.py`
**Reviewer:** Scott (automated)
**Cycle:** 26

**Task:** T-027 — Update Dockerfile + docker-compose
**Beads ID:** aia-core-qzlj

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 1 |
| MEDIUM | 2 |
| LOW | 2 |
| **Total Findings** | **5** |

---

## Acceptance Criteria Verification

| AC # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | `Dockerfile` builds the TS frontend successfully | SATISFIED | `frontend/Dockerfile` L11: `RUN npm run build` with `vite build` script | node:22-alpine base, npm install, then vite build verifies TS compilation |
| 2 | `docker-compose.yml` mounts `tsconfig.json`, `vite.config.ts`, and any new config files | SATISFIED | `docker-compose.yml` L56–57: both volume mounts present | No stale `vite.config.js` reference remains |
| 3 | `npm run dev` works inside the container with hot reload | NOT VERIFIED | Requires running Docker | `host: '0.0.0.0'` in `vite.config.ts` L12 ensures binding; volume mounts enable hot reload |
| 4 | `npm run build` produces a production `dist/` inside the container | SATISFIED | `frontend/Dockerfile` L11: `RUN npm run build` | `package.json` script: `"build": "vite build"` |
| 5 | CI config includes type-check, lint, and test steps | NOT APPLICABLE | No CI changes in this changeset | Deferred — not in scope for this PR |

---

## Findings

### [HIGH] Undeclared PyYAML dependency in test

**File:** `test/test_docker_config.py`
**Line(s):** 5
**Category:** correctness

**Problem:**
The test imports `yaml` (PyYAML), but PyYAML is not a declared dependency in `pyproject.toml` under `[project].dependencies`, `[dependency-groups].test`, or `[dependency-groups].dev`. It is only available as a transitive dependency (via alembic or another package). If that transitive dependency changes, this test will break with an `ImportError`.

**Code:**
```python
import yaml
```

**Suggested Fix:**
Add `pyyaml` to the `test` dependency group in `pyproject.toml`:
```toml
[dependency-groups]
test = [
    "pytest",
    "pytest-mock",
    "pyyaml",
]
```

**Impact:** Test suite fragility — a dependency upgrade could silently remove PyYAML and break this test file.

---

### [MEDIUM] Missing `.dockerignore` for frontend

**File:** `frontend/Dockerfile`
**Line(s):** 8
**Category:** design

**Problem:**
No `frontend/.dockerignore` exists. The `COPY . .` directive will copy `node_modules/` (if present locally), `.git/`, build artifacts, and other unnecessary files into the Docker build context. This bloats the image, slows builds, and risks leaking secrets or credentials that may exist in local files.

**Code:**
```dockerfile
COPY . .
```

**Suggested Fix:**
Create `frontend/.dockerignore`:
```
node_modules
dist
.git
*.md
```

**Impact:** Larger image size, slower builds, and potential inclusion of sensitive files in the image. Low security risk in dev-only context but a Docker best practice gap.

---

### [MEDIUM] Container runs as root

**File:** `frontend/Dockerfile`
**Line(s):** 1–15
**Category:** security

**Problem:**
The Dockerfile does not create or switch to a non-root user. The container process runs as `root` by default. While this is a development container, running as root is a Docker security anti-pattern that could allow container-escape privilege escalation.

**Code:**
```dockerfile
FROM node:22-alpine
# ... no USER directive ...
CMD ["npm", "run", "dev"]
```

**Suggested Fix:**
Add a non-root user after installing dependencies:
```dockerfile
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser
```
Note: this may conflict with volume mount permissions in dev mode. Acceptable to defer for dev-only containers.

**Impact:** Low in dev context. Would be HIGH for production images.

---

### [LOW] Optional package-lock.json in COPY

**File:** `frontend/Dockerfile`
**Line(s):** 5
**Category:** correctness

**Problem:**
The glob `package-lock.json*` means the Docker build will silently succeed even if `package-lock.json` is missing, leading to non-reproducible `npm install` results.

**Code:**
```dockerfile
COPY package.json package-lock.json* ./
```

**Suggested Fix:**
If the lockfile should always exist, remove the glob:
```dockerfile
COPY package.json package-lock.json ./
```
Or document the intent if the glob is deliberate (e.g., for environments that use `npm ci` vs `npm install`).

**Impact:** Minor reproducibility concern. Common Dockerfile pattern.

---

### [LOW] `npm run build` output is stale at runtime

**File:** `frontend/Dockerfile`
**Line(s):** 11
**Category:** design

**Problem:**
`RUN npm run build` creates a `dist/` directory during image build. At runtime, `docker-compose.yml` mounts volumes over `/app/src`, so the built output is immediately stale. The comment on L10 documents the intent (TS compilation gate), which makes this acceptable — but the `dist/` folder wastes ~5–15 MB of image space.

**Code:**
```dockerfile
# Verify TypeScript compilation and production build
RUN npm run build
```

**Suggested Fix:**
Optionally add `RUN rm -rf dist` after the build step to reclaim space, or accept as-is since the intent is documented.

**Impact:** Negligible. The comment documents intent clearly.

---

## Positives

- **Clean Dockerfile structure**: Package-first COPY for layer caching, then full COPY — follows Docker best practices for npm projects
- **`--host` removal is correct**: `host: '0.0.0.0'` is already configured in `vite.config.ts` L12, so removing it from the CMD avoids duplication
- **Volume fix is precise**: `vite.config.js` → `vite.config.ts` and `tsconfig.json` addition are exactly what's needed
- **Well-structured tests**: Two test classes with clear separation (compose vs Dockerfile), descriptive assertion messages, and good coverage of the acceptance criteria
- **`test_frontend_volume_targets_exist`**: Smart regression test that catches host-path drift
- **No preact references** in Dockerfile or docker-compose.yml (T-028 handles the remaining JSX files)

---

## Overall Assessment

The changes are solid and well-scoped. The Dockerfile correctly validates TS compilation at build time, the docker-compose volumes are accurate, and the tests provide good regression coverage. The one **HIGH** finding (undeclared PyYAML dependency) should be addressed before merging to prevent future test breakage. The **MEDIUM** findings (.dockerignore, root user) are standard Docker hardening items that can be deferred for a dev-only container but should be tracked.

No CRITICAL findings. AC 1, 2, and 4 are satisfied. AC 3 requires runtime verification. AC 5 is out of scope for this changeset.
