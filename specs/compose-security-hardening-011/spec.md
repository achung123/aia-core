# Spec — Compose Security Hardening

**Project ID:** compose-security-hardening-011
**Date:** 2026-04-22
**Status:** Draft

---

## Source Artifact

- Audit report: [docs/agent/security/2026-04-21-audit-docker-compose.md](../../docs/agent/security/2026-04-21-audit-docker-compose.md)

---

## Goal

Turn the current compose stack from a LAN-exposed development posture into a tracked hardening program that closes audit findings F-01 through F-19 with one implementation task per finding.

---

## Scope

- In scope: `docker-compose.yml`, backend and frontend Dockerfiles, nginx proxy config, docker entrypoint/share scripts, local-network and deployment documentation, and repo-root image build-context hygiene.
- In scope: finding-driven remediation for F-01 through F-19 with severity-derived priorities for Logan sync.
- Out of scope: application-layer auth, backend route authorization, runtime pentesting, and unrelated frontend/backend feature work.

---

## Epics

### E-1 — Exposure Control

As a maintainer, I need direct backend and frontend exposure removed from the host and trusted HTTPS ingress in place so the stack is not serving development servers onto shared networks.

**Acceptance focus:** F-01, F-02, F-07, F-10.

### E-2 — Runtime and Edge Hardening

As a maintainer, I need the compose services, proxy, images, mounts, logs, and storage paths hardened so compromise impact and operational failure modes are reduced.

**Acceptance focus:** F-03, F-04, F-05, F-06, F-08, F-09, F-11, F-12, F-13, F-14.

### E-3 — Compose Hygiene and Maintainability

As a maintainer, I need safer defaults for naming, network segmentation, version disclosure, migration startup behavior, and build context contents so future deployment variants stay maintainable and less error-prone.

**Acceptance focus:** F-15, F-16, F-17, F-18, F-19.

---

## Findings Source

- All remediation work in this project is derived from [docs/agent/security/2026-04-21-audit-docker-compose.md](../../docs/agent/security/2026-04-21-audit-docker-compose.md).
- The execution plan is intentionally finding-driven: each task in `tasks.md` maps to exactly one audit finding ID.