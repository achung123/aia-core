<!--
STATUS REPORT TEMPLATE
======================
Output template for Logan's project-wide status reports.
Used by the `@logan status` command when no specific task ID is given.

PLACEHOLDER LEGEND
==================
{{PROJECT_NAME}}          Required. Human-readable project name.
{{DATE}}                  Required. Report generation date (YYYY-MM-DD).
{{TOTAL}}                 Required. Total tracked tasks.
{{CLOSED}}                Required. Number of closed tasks.
{{IN_PROGRESS}}           Required. Number of in-progress tasks.
{{BLOCKED}}               Required. Number of open tasks with unresolved dependencies.
{{READY}}                 Required. Number of open tasks with no blockers.
{{IN_PROGRESS_ROWS}}      Required. Table rows for in-progress tasks.
{{READY_ROWS}}            Required. Table rows for ready tasks.
{{BLOCKED_ROWS}}          Required. Table rows for blocked tasks (with blocker info).
{{RECENTLY_CLOSED_ROWS}}  Required. Table rows for recently closed tasks.
-->

# Project Status — {{PROJECT_NAME}}

**Date:** {{DATE}}
**Total:** {{TOTAL}} | **Closed:** {{CLOSED}} | **In Progress:** {{IN_PROGRESS}} | **Blocked:** {{BLOCKED}} | **Ready:** {{READY}}

---

## In Progress

| Beads ID | Title | Priority | Assignee |
|----------|-------|----------|----------|
{{IN_PROGRESS_ROWS}}

---

## Ready Now

| Beads ID | Title | Priority | Category |
|----------|-------|----------|----------|
{{READY_ROWS}}

---

## Blocked

| Beads ID | Title | Priority | Waiting On |
|----------|-------|----------|------------|
{{BLOCKED_ROWS}}

---

## Recently Closed

| Beads ID | Title | Closed Date | Reason |
|----------|-------|-------------|--------|
{{RECENTLY_CLOSED_ROWS}}
