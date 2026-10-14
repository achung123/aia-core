---
name: feature-delivery
description: Run the end-to-end aia-core feature delivery pipeline — Jean (plan) → Logan (sync) → Hank (implement) → Scott (review) → land. Use when taking a new feature idea, design doc, or epic-sized request from zero to shipped.
---

# Feature Delivery

Take a feature idea or design doc from zero to shipped, coordinating the canonical aia-core agent pipeline: plan (Jean), sync (Logan), implement (Hank), review (Scott) — with proper handoffs and quality gates between each phase.

## When to use

- A user brings a new feature idea, design doc, or epic-sized request
- A spec exists but has not yet been synced into beads
- You are Anna (or a human acting as orchestrator) and need the standard pipeline

Do **not** use this skill for single-task bug fixes (use the `bug-fix` skill) or ad-hoc refactors.

## Context

- Jean writes `specs/<project>/spec.md`, `plan.md`, `tasks.md` — always after mandatory intake
- Logan imports `tasks.md` into beads with dependencies and priorities
- Hank implements ready tasks using the `tdd-cycle` skill
- Scott reviews via `@scott check` (fast) or `@scott loop-review` (recorded) — CRITICAL/HIGH get filed back into beads

## Instructions

1. **Phase 1 — Plan (Jean).**
   - Invoke `@jean plan <idea or doc>`
   - Jean will run intake questions first — answer them
   - Confirm `specs/<project-id>/{spec,plan,tasks}.md` exist before proceeding
2. **Phase 2 — Sync (Logan).**
   - Invoke `@logan sync <project-id>`
   - Verify the Sync Summary table reports all T-NNN tasks mapped to beads IDs with dependencies linked and blocked statuses set correctly
3. **Phase 3 — Ready check (Logan).**
   - Invoke `@logan ready` to confirm at least one task is unblocked
   - If nothing is ready, stop and investigate the dependency graph
4. **Phase 4 — Implement + review loop.** For each ready task, in priority order:
   - `@logan claim <id>`
   - `@hank implement <id>` — Hank runs the `tdd-cycle`, `new-endpoint`, or `db-migration` skills as needed
   - `@scott check <id>` (or `@scott loop-review <id>` if orchestrated by Anna)
   - If CRITICAL/HIGH findings → file back into beads at P0/P1 and resolve before moving on
   - `@logan close <id>` once clean
5. **Phase 5 — Land.** When the epic is complete, run the `land-session` skill to push everything to remote.

## Output format

```
## Feature Delivered — <project-id>

| Phase | Agent | Artifact |
|-------|-------|----------|
| Plan | Jean | specs/<project-id>/{spec,plan,tasks}.md |
| Sync | Logan | N tasks, M deps → beads |
| Implement | Hank | N tasks closed via TDD |
| Review | Scott | N reviews, C critical / H high / M medium / L low |
| Land | — | git push ✅ |

**Epic status:** ✅ Complete
**Bugs filed during review:** <N or "none">
```

## Anti-patterns

- Skipping Jean's intake phase to "save time" — intake is mandatory
- Implementing before Logan has synced tasks into beads
- Merging review feedback inline without filing CRITICAL/HIGH as beads tasks
- Closing a task before Scott reviewed the implementation
- Moving to the next task while CRITICAL findings from the previous are still open
- Stopping after the last task without running the `land-session` skill — work not pushed is work not delivered
