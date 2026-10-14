# Plan — Compose Security Hardening

**Project ID:** compose-security-hardening-011
**Date:** 2026-04-22
**Status:** Draft

---

## Inputs

- Source audit: [docs/agent/security/2026-04-21-audit-docker-compose.md](../../docs/agent/security/2026-04-21-audit-docker-compose.md)
- Primary implementation surfaces: `docker-compose.yml`, `backend/Dockerfile`, `backend/Dockerfile.gpu`, `frontend/Dockerfile`, `frontend/vite.config.ts`, `scripts/docker/proxy.conf`, `scripts/docker/docker-entrypoint.sh`, `docs/local-network-setup.md`, `docs/deployment.md`

---

## Delivery Strategy

1. **Immediate exposure reduction**
   - Start with T-001 and T-002 to remove direct backend/frontend LAN exposure.
   - Land T-003 early so proxy traffic can move to HTTPS as soon as ingress is consolidated.

2. **Short-term hardening**
   - T-004 through T-007 address runtime privileges, image trust, resource caps, and nginx edge protections.
   - T-013 should stay near the runtime-hardening work because mount posture and container user posture are tightly related.

3. **Operational resilience**
   - T-008 through T-014 improve readiness, origin handling, forwarded-header trust, image pinning, logging, and SQLite persistence/backup posture.

4. **Low-risk cleanup**
   - T-015 through T-019 capture the low-severity compose hygiene work without blocking higher-value remediations.

---

## Dependency Policy

- Keep tasks independent by default so Logan does not over-block ready work.
- T-010 depends on T-001 because forwarded-header trust hardening only makes sense once backend ingress is proxy-only.
- T-001 and T-002 are intentionally first in the queue because they close the direct backend and frontend exposure paths called out in the audit roadmap.

---

## Risks and Notes

- Compose splitting or override-file changes can alter the current developer workflow; document the new startup paths alongside the implementation.
- Local TLS for `aia.local` needs certificate generation and trust instructions that are realistic for the team machines.
- Moving SQLite storage to named volumes needs a backup and migration path to avoid accidental local data loss.

---

## Findings Source

- This plan is anchored to [docs/agent/security/2026-04-21-audit-docker-compose.md](../../docs/agent/security/2026-04-21-audit-docker-compose.md).
- Task priorities in `tasks.md` use the audit severity mapping requested for Logan sync: CRITICAL -> 0, HIGH -> 1, MEDIUM -> 2, LOW -> 3.
